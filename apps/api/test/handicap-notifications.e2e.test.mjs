import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);
const { loadEnvFromRoot } = require('../../../scripts/db/load-env');
loadEnvFromRoot();

const ROOT_DIR = new URL('../../..', import.meta.url).pathname;
const API_PORT = 3934;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

let apiProcess;
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

function buildAdminToken() {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign(
    { sub: '11111111-1111-4111-8111-111111111111', role: 'admin', tokenType: 'access' },
    secret,
    { expiresIn: '30m' },
  );
}

async function requestJson(path, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  return { status: response.status, json };
}

async function waitForHealth(maxAttempts = 40, delayMs = 250) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // retry until healthy
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('API did not become healthy in time');
}

async function ensureNotificationTables() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id UUID PRIMARY KEY,
      handicap_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      round_submitted_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      round_approved_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT notification_preferences_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS notification_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      sent_at TIMESTAMPTZ,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function seedScenario({ preferenceEnabled }) {
  const suffix = Date.now() + Math.floor(Math.random() * 1000);

  const userResult = await dbPool.query(
    `INSERT INTO users (email, password_hash, role, is_active)
     VALUES ($1, $2, 'player', TRUE)
     RETURNING id`,
    [`notify-${suffix}@example.com`, 'PENDING_PASSWORD_RESET'],
  );
  const userId = userResult.rows[0].id;

  const playerResult = await dbPool.query(
    `INSERT INTO players (first_name, last_name, country, user_id, handicap_index)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    ['Notify', `Player-${suffix}`, 'GB', userId, 15.0],
  );
  const playerId = playerResult.rows[0].id;

  await dbPool.query(
    `INSERT INTO notification_preferences (user_id, handicap_updates_enabled, round_submitted_enabled, round_approved_enabled, marketing_enabled)
     VALUES ($1, $2, TRUE, TRUE, FALSE)
     ON CONFLICT (user_id)
     DO UPDATE SET handicap_updates_enabled = EXCLUDED.handicap_updates_enabled`,
    [userId, preferenceEnabled],
  );

  const courseResult = await dbPool.query(
    `INSERT INTO courses (name, city, country)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [`Notify Course ${suffix}`, 'Leeds', 'GB'],
  );
  const courseId = courseResult.rows[0].id;

  const teeResult = await dbPool.query(
    `INSERT INTO tee_configurations (course_id, name, tee_colour, hole_count, course_rating, slope_rating)
     VALUES ($1, $2, $3, 18, 72.1, 130)
     RETURNING id`,
    [courseId, 'Medal', 'Blue'],
  );
  const teeConfigurationId = teeResult.rows[0].id;

  const roundDiffs = [9.1, 8.7, 8.2];
  for (let i = 0; i < roundDiffs.length; i += 1) {
    await dbPool.query(
      `INSERT INTO rounds (player_id, tee_configuration_id, played_at, score_differential, is_9_hole, pcc, status)
       VALUES ($1, $2, $3, $4, FALSE, 0, 'approved')`,
      [playerId, teeConfigurationId, new Date(Date.now() - (i + 1) * 86400000).toISOString(), roundDiffs[i]],
    );
  }

  return { userId, playerId, courseId, teeConfigurationId };
}

async function cleanupScenario({ userId, playerId, courseId, teeConfigurationId }) {
  if (userId) await dbPool.query('DELETE FROM notification_history WHERE user_id = $1', [userId]);
  if (playerId) await dbPool.query('DELETE FROM handicap_records WHERE player_id = $1', [playerId]);
  if (playerId) await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerId]);
  if (teeConfigurationId) await dbPool.query('DELETE FROM tee_configurations WHERE id = $1', [teeConfigurationId]);
  if (courseId) await dbPool.query('DELETE FROM courses WHERE id = $1', [courseId]);
  if (playerId) await dbPool.query('DELETE FROM players WHERE id = $1', [playerId]);
  if (userId) await dbPool.query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]);
  if (userId) await dbPool.query('DELETE FROM users WHERE id = $1', [userId]);
}

before(async () => {
  await ensureNotificationTables();

  apiProcess = spawn('node', ['--import', 'tsx', 'apps/api/src/index.ts'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      API_PORT: String(API_PORT),
      EMAIL_TRANSPORT: 'mock',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  apiProcess.stdout.on('data', (chunk) => {
    process.stdout.write(`[api] ${chunk}`);
  });
  apiProcess.stderr.on('data', (chunk) => {
    process.stderr.write(`[api] ${chunk}`);
  });

  await waitForHealth();
});

after(async () => {
  if (apiProcess) {
    apiProcess.kill('SIGTERM');
    await new Promise((resolve) => {
      apiProcess.once('exit', () => resolve());
      setTimeout(() => resolve(), 1500);
    });
  }
  await dbPool.end();
});

test('POST /api/handicap/calculate/:playerId sends handicap update notification and logs history', async () => {
  const token = buildAdminToken();
  const seeded = await seedScenario({ preferenceEnabled: true });

  try {
    const calculateResponse = await requestJson(`/api/handicap/calculate/${seeded.playerId}`, {
      method: 'POST',
      token,
    });

    assert.equal(calculateResponse.status, 200, JSON.stringify(calculateResponse.json));
    assert.equal(calculateResponse.json.eligibilityStatus, 'eligible');

    const historyResult = await dbPool.query(
      `SELECT type, status, payload
       FROM notification_history
       WHERE user_id = $1 AND type = 'handicap_update'
       ORDER BY created_at DESC
       LIMIT 1`,
      [seeded.userId],
    );

    assert.equal(historyResult.rowCount, 1);
    assert.equal(historyResult.rows[0].status, 'sent');
    assert.equal(historyResult.rows[0].payload.oldIndex, 15);
    assert.equal(historyResult.rows[0].payload.newIndex, calculateResponse.json.handicapIndex);
    assert.equal(typeof historyResult.rows[0].payload.roundsUsed, 'number');
    assert.ok(historyResult.rows[0].payload.roundsUsed >= 1);
  } finally {
    await cleanupScenario(seeded);
  }
});

test('POST /api/handicap/calculate/:playerId respects notification preferences and logs skipped status', async () => {
  const token = buildAdminToken();
  const seeded = await seedScenario({ preferenceEnabled: false });

  try {
    const calculateResponse = await requestJson(`/api/handicap/calculate/${seeded.playerId}`, {
      method: 'POST',
      token,
    });

    assert.equal(calculateResponse.status, 200, JSON.stringify(calculateResponse.json));
    assert.equal(calculateResponse.json.eligibilityStatus, 'eligible');

    const historyResult = await dbPool.query(
      `SELECT status, payload
       FROM notification_history
       WHERE user_id = $1 AND type = 'handicap_update'
       ORDER BY created_at DESC
       LIMIT 1`,
      [seeded.userId],
    );

    assert.equal(historyResult.rowCount, 1);
    assert.equal(historyResult.rows[0].status, 'skipped');
    assert.equal(historyResult.rows[0].payload.reason, 'preference_disabled');
  } finally {
    await cleanupScenario(seeded);
  }
});
