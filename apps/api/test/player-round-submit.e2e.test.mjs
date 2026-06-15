import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const require = createRequire(import.meta.url);
const { loadEnvFromRoot } = require('../../../scripts/db/load-env');
loadEnvFromRoot();

const ROOT_DIR = new URL('../../..', import.meta.url).pathname;
const API_PORT = 3939;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db';

const ADMIN_USER_ID = 'eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1';
const PLAYER_USER_ID = 'eeeeeee2-eeee-4eee-8eee-eeeeeeeeeee2';
const PLAYER_ONE_ID = 'eeeeeee3-eeee-4eee-8eee-eeeeeeeeeee3';
const PLAYER_TWO_ID = 'eeeeeee4-eeee-4eee-8eee-eeeeeeeeeee4';
const COURSE_ID = 'eeeeeee5-eeee-4eee-8eee-eeeeeeeeeee5';
const TEE_ID = 'eeeeeee6-eeee-4eee-8eee-eeeeeeeeeee6';

let apiProcess;
const dbPool = new Pool({ connectionString: DATABASE_URL });

function buildToken(role, userId) {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign(
    { sub: userId, role, tokenType: 'access' },
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
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('API did not become healthy in time');
}

function buildHoles(holeCount) {
  return Array.from({ length: holeCount }, (_, index) => ({
    hole_number: index + 1,
    distance_yards: 320 + index * 5,
    par: index % 3 === 0 ? 5 : 4,
    stroke_index: index + 1,
  }));
}

function buildHoleScores(holeCount) {
  return Array.from({ length: holeCount }, (_, index) => ({
    holeNumber: index + 1,
    strokes: 4,
    putts: 2,
    gir: index % 2 === 0,
    fairwayHit: index % 2 === 1,
    inSand: false,
    penalties: 0,
  }));
}

before(async () => {
  await dbPool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active, deleted_at)
     VALUES
       ($1, 'round-admin@example.test', 'seed-password-hash', 'admin', TRUE, NULL),
       ($2, 'round-player@example.test', 'seed-password-hash', 'player', TRUE, NULL)
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
     VALUES
       ($1, $2, 'Round', 'Player', 'round-player-1@example.test', 'GB', NULL),
       ($3, NULL, 'Round', 'Other', 'round-player-2@example.test', 'GB', NULL)
     ON CONFLICT (id) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           email = EXCLUDED.email,
           country = EXCLUDED.country,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [PLAYER_ONE_ID, PLAYER_USER_ID, PLAYER_TWO_ID],
  );

  await dbPool.query(
    `INSERT INTO courses (id, name, country, deleted_at)
     VALUES ($1, 'Player Submission Course', 'GB', NULL)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           country = EXCLUDED.country,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [COURSE_ID],
  );

  await dbPool.query(
    `INSERT INTO tee_configurations (id, course_id, name, tee_colour, hole_count, course_rating, slope_rating, deleted_at)
     VALUES ($1, $2, 'Members', 'White', 9, 71.2, 125, NULL)
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

  await dbPool.query('DELETE FROM holes WHERE tee_configuration_id = $1', [TEE_ID]);
  const holes = buildHoles(9);
  for (const hole of holes) {
    await dbPool.query(
      `INSERT INTO holes (tee_configuration_id, hole_number, distance_yards, par, stroke_index)
       VALUES ($1, $2, $3, $4, $5)`,
      [TEE_ID, hole.hole_number, hole.distance_yards, hole.par, hole.stroke_index],
    );
  }

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
    apiProcess.kill('SIGTERM');
    await new Promise((resolve) => {
      apiProcess.once('exit', () => resolve());
      setTimeout(() => resolve(), 1500);
    });
  }

  await dbPool.query(
    "DELETE FROM audit_logs WHERE event_type IN ('round_created', 'round_updated', 'round_approved') AND metadata->>'playerId' IN ($1, $2)",
    [PLAYER_ONE_ID, PLAYER_TWO_ID],
  );
  await dbPool.query(
    "DELETE FROM notification_history WHERE user_id = $1 AND type IN ('round_submitted', 'round_updated', 'round_approved')",
    [PLAYER_USER_ID],
  );
  await dbPool.query('DELETE FROM hole_scores WHERE round_id IN (SELECT id FROM rounds WHERE player_id IN ($1, $2))', [PLAYER_ONE_ID, PLAYER_TWO_ID]);
  await dbPool.query('DELETE FROM rounds WHERE player_id IN ($1, $2)', [PLAYER_ONE_ID, PLAYER_TWO_ID]);
  await dbPool.query('DELETE FROM holes WHERE tee_configuration_id = $1', [TEE_ID]);
  await dbPool.query('DELETE FROM tee_configurations WHERE id = $1', [TEE_ID]);
  await dbPool.query('DELETE FROM courses WHERE id = $1', [COURSE_ID]);
  await dbPool.query('DELETE FROM players WHERE id IN ($1, $2)', [PLAYER_ONE_ID, PLAYER_TWO_ID]);
  await dbPool.query('DELETE FROM users WHERE id IN ($1, $2)', [ADMIN_USER_ID, PLAYER_USER_ID]);
  await dbPool.end();
});

test('POST /api/rounds allows players to submit only for themselves', async () => {
  const adminToken = buildToken('admin', ADMIN_USER_ID);
  const playerToken = buildToken('player', PLAYER_USER_ID);

  const playerRound = await requestJson('/api/rounds', {
    method: 'POST',
    token: playerToken,
    body: {
      playerId: PLAYER_ONE_ID,
      teeConfigurationId: TEE_ID,
      playedAt: '2026-05-20T08:00:00.000Z',
      playingHandicap: 12,
      holeScores: buildHoleScores(9),
    },
  });

  assert.equal(playerRound.status, 201, JSON.stringify(playerRound.json));
  assert.equal(playerRound.json.round.playerId, PLAYER_ONE_ID);

  const crossPlayerRound = await requestJson('/api/rounds', {
    method: 'POST',
    token: playerToken,
    body: {
      playerId: PLAYER_TWO_ID,
      teeConfigurationId: TEE_ID,
      playedAt: '2026-05-20T08:00:00.000Z',
      playingHandicap: 12,
      holeScores: buildHoleScores(9),
    },
  });

  assert.equal(crossPlayerRound.status, 403, JSON.stringify(crossPlayerRound.json));
  assert.equal(crossPlayerRound.json.error.code, 'forbidden');

  const adminRound = await requestJson('/api/rounds', {
    method: 'POST',
    token: adminToken,
    body: {
      playerId: PLAYER_TWO_ID,
      teeConfigurationId: TEE_ID,
      playedAt: '2026-05-20T08:00:00.000Z',
      playingHandicap: 12,
      holeScores: buildHoleScores(9),
    },
  });

  assert.equal(adminRound.status, 201, JSON.stringify(adminRound.json));
  assert.equal(adminRound.json.round.playerId, PLAYER_TWO_ID);
});

test('PATCH /api/rounds/:id enforces ownership and allows admin edits', async () => {
  const adminToken = buildToken('admin', ADMIN_USER_ID);
  const playerToken = buildToken('player', PLAYER_USER_ID);

  const ownRound = await requestJson('/api/rounds', {
    method: 'POST',
    token: playerToken,
    body: {
      playerId: PLAYER_ONE_ID,
      teeConfigurationId: TEE_ID,
      playedAt: '2026-05-22T08:00:00.000Z',
      playingHandicap: 12,
      holeScores: buildHoleScores(9),
    },
  });

  assert.equal(ownRound.status, 201, JSON.stringify(ownRound.json));

  const updatedOwnRound = await requestJson(`/api/rounds/${ownRound.json.round.id}`, {
    method: 'PATCH',
    token: playerToken,
    body: {
      playerId: PLAYER_ONE_ID,
      teeConfigurationId: TEE_ID,
      playedAt: '2026-05-22T08:00:00.000Z',
      playingHandicap: 11,
      holeScores: buildHoleScores(9).map((hole, index) =>
        index === 0
          ? { ...hole, strokes: 5 }
          : hole
      ),
    },
  });

  assert.equal(updatedOwnRound.status, 200, JSON.stringify(updatedOwnRound.json));
  assert.equal(updatedOwnRound.json.round.playerId, PLAYER_ONE_ID);
  assert.equal(updatedOwnRound.json.round.status, 'pending');

  const createdAudit = await dbPool.query(
    "SELECT event_type FROM audit_logs WHERE event_type = 'round_created' AND metadata->>'roundId' = $1",
    [ownRound.json.round.id],
  );
  assert.ok(createdAudit.rowCount >= 1, 'Expected round_created audit event');

  const updatedAudit = await dbPool.query(
    "SELECT event_type FROM audit_logs WHERE event_type = 'round_updated' AND metadata->>'roundId' = $1",
    [ownRound.json.round.id],
  );
  assert.ok(updatedAudit.rowCount >= 1, 'Expected round_updated audit event');

  const updatedNotification = await dbPool.query(
    `SELECT type, status, payload
     FROM notification_history
     WHERE user_id = $1 AND type = 'round_updated' AND payload->>'roundId' = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [PLAYER_USER_ID, ownRound.json.round.id],
  );
  assert.equal(updatedNotification.rowCount, 1, 'Expected round_updated notification history');
  assert.equal(updatedNotification.rows[0].type, 'round_updated');
  assert.ok(
    ['sent', 'failed', 'skipped'].includes(updatedNotification.rows[0].status),
    `Unexpected notification status: ${updatedNotification.rows[0].status}`,
  );

  const adminRound = await requestJson('/api/rounds', {
    method: 'POST',
    token: adminToken,
    body: {
      playerId: PLAYER_TWO_ID,
      teeConfigurationId: TEE_ID,
      playedAt: '2026-05-23T08:00:00.000Z',
      playingHandicap: 8,
      holeScores: buildHoleScores(9),
    },
  });

  assert.equal(adminRound.status, 201, JSON.stringify(adminRound.json));

  const forbiddenUpdate = await requestJson(`/api/rounds/${adminRound.json.round.id}`, {
    method: 'PATCH',
    token: playerToken,
    body: {
      playerId: PLAYER_TWO_ID,
      teeConfigurationId: TEE_ID,
      playedAt: '2026-05-23T08:00:00.000Z',
      playingHandicap: 8,
      holeScores: buildHoleScores(9),
    },
  });

  assert.equal(forbiddenUpdate.status, 403, JSON.stringify(forbiddenUpdate.json));

  const adminUpdate = await requestJson(`/api/rounds/${adminRound.json.round.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      playerId: PLAYER_TWO_ID,
      teeConfigurationId: TEE_ID,
      playedAt: '2026-05-24T08:00:00.000Z',
      playingHandicap: 7,
      holeScores: buildHoleScores(9).map((hole, index) =>
        index === 1
          ? { ...hole, penalties: 2 }
          : hole
      ),
    },
  });

  assert.equal(adminUpdate.status, 200, JSON.stringify(adminUpdate.json));
  assert.equal(adminUpdate.json.round.playerId, PLAYER_TWO_ID);
});
