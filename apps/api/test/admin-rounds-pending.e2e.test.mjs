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
const API_PORT = 3937;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

const ADMIN_USER_ID = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1';
const PLAYER_USER_ID = 'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2';
const PLAYER_ID = 'ccccccc3-cccc-4ccc-8ccc-ccccccccccc3';
const COURSE_ID = 'ccccccc4-cccc-4ccc-8ccc-ccccccccccc4';
const TEE_ID = 'ccccccc5-cccc-4ccc-8ccc-ccccccccccc5';
const ROUND_OLD_ID = 'ccccccc6-cccc-4ccc-8ccc-ccccccccccc6';
const ROUND_NEW_ID = 'ccccccc7-cccc-4ccc-8ccc-ccccccccccc7';
const ROUND_APPROVED_ID = 'ccccccc8-cccc-4ccc-8ccc-ccccccccccc8';

let apiProcess;
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

function buildToken(role = 'admin', sub = ADMIN_USER_ID) {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign(
    { sub, role, tokenType: 'access' },
    secret,
    { expiresIn: '30m' },
  );
}

async function requestJson(path, { method = 'GET', token } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, { method, headers });
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
      // Retry until server is up.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('API did not become healthy in time');
}

before(async () => {
  await dbPool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active, deleted_at)
     VALUES
       ($1, 'admin-pending@example.test', 'seed-password-hash', 'admin', TRUE, NULL),
       ($2, 'player-pending@example.test', 'seed-password-hash', 'player', TRUE, NULL)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [ADMIN_USER_ID, PLAYER_USER_ID],
  );

  await dbPool.query(
    `INSERT INTO players (id, user_id, first_name, last_name, email, country, deleted_at)
     VALUES ($1, $2, 'Pending', 'Player', 'pending-player@example.test', 'GB', NULL)
     ON CONFLICT (id) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           email = EXCLUDED.email,
           country = EXCLUDED.country,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [PLAYER_ID, PLAYER_USER_ID],
  );

  await dbPool.query(
    `INSERT INTO courses (id, name, country, deleted_at)
     VALUES ($1, 'Pending Queue Course', 'GB', NULL)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           country = EXCLUDED.country,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [COURSE_ID],
  );

  await dbPool.query(
    `INSERT INTO tee_configurations (id, course_id, name, tee_colour, hole_count, course_rating, slope_rating, deleted_at)
     VALUES ($1, $2, 'Blue', 'Blue', 18, 72.1, 128, NULL)
     ON CONFLICT (id) DO UPDATE
       SET course_id = EXCLUDED.course_id,
           name = EXCLUDED.name,
           tee_colour = EXCLUDED.tee_colour,
           hole_count = EXCLUDED.hole_count,
           course_rating = EXCLUDED.course_rating,
           slope_rating = EXCLUDED.slope_rating,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [TEE_ID, COURSE_ID],
  );

  await dbPool.query(
    `INSERT INTO rounds (id, player_id, tee_configuration_id, played_at, gross_score, status, deleted_at)
     VALUES
       ($1, $4, $5, '2026-05-01T10:00:00.000Z', 92, 'pending', NULL),
       ($2, $4, $5, '2026-05-04T10:00:00.000Z', 88, 'pending', NULL),
       ($3, $4, $5, '2026-05-03T10:00:00.000Z', 85, 'approved', NULL)
     ON CONFLICT (id) DO UPDATE
       SET player_id = EXCLUDED.player_id,
           tee_configuration_id = EXCLUDED.tee_configuration_id,
           played_at = EXCLUDED.played_at,
           gross_score = EXCLUDED.gross_score,
           status = EXCLUDED.status,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [ROUND_OLD_ID, ROUND_NEW_ID, ROUND_APPROVED_ID, PLAYER_ID, TEE_ID],
  );

  apiProcess = spawn('node', ['--import', 'tsx', 'apps/api/src/index.ts'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      API_PORT: String(API_PORT),
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
    apiProcess.kill();
  }

  await dbPool.query("DELETE FROM audit_logs WHERE event_type IN ('admin_access_allowed', 'admin_access_denied') AND metadata->>'path' LIKE '%admin/rounds/pending%'");
  await dbPool.query('DELETE FROM rounds WHERE id IN ($1, $2, $3)', [ROUND_OLD_ID, ROUND_NEW_ID, ROUND_APPROVED_ID]);
  await dbPool.query('DELETE FROM tee_configurations WHERE id = $1', [TEE_ID]);
  await dbPool.query('DELETE FROM courses WHERE id = $1', [COURSE_ID]);
  await dbPool.query('DELETE FROM players WHERE id = $1', [PLAYER_ID]);
  await dbPool.query('DELETE FROM users WHERE id IN ($1, $2)', [ADMIN_USER_ID, PLAYER_USER_ID]);
  await dbPool.end();
});

test('GET /api/admin/rounds/pending returns pending rounds with required fields sorted oldest first', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson('/api/admin/rounds/pending', { token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.ok(Array.isArray(response.json.rounds));
  assert.ok(response.json.total >= 2);

  const oldRoundIndex = response.json.rounds.findIndex((round) => round.id === ROUND_OLD_ID);
  const newRoundIndex = response.json.rounds.findIndex((round) => round.id === ROUND_NEW_ID);
  const approvedRoundIndex = response.json.rounds.findIndex((round) => round.id === ROUND_APPROVED_ID);

  assert.ok(oldRoundIndex >= 0, 'Expected seeded old pending round to be returned');
  assert.ok(newRoundIndex >= 0, 'Expected seeded new pending round to be returned');
  assert.equal(approvedRoundIndex, -1, 'Approved rounds must not be returned in pending queue');
  assert.ok(oldRoundIndex < newRoundIndex, 'Pending rounds should be sorted oldest first');

  const oldRound = response.json.rounds[oldRoundIndex];
  assert.equal(oldRound.gross_score, 92);
  assert.equal(oldRound.played_at, '2026-05-01T10:00:00.000Z');
  assert.equal(oldRound.player.first_name, 'Pending');
  assert.equal(oldRound.player.last_name, 'Player');
  assert.equal(oldRound.course.name, 'Pending Queue Course');
});

test('GET /api/admin/rounds/pending returns 403 for non-admin users', async () => {
  const token = buildToken('player', PLAYER_USER_ID);
  const response = await requestJson('/api/admin/rounds/pending', { token });

  assert.equal(response.status, 403, JSON.stringify(response.json));
  assert.equal(response.json.error.code, 'forbidden');
});
