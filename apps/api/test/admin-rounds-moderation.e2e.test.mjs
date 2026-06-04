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
const API_PORT = 3938;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

const ADMIN_USER_ID = 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1';
const PLAYER_USER_ID = 'ddddddd2-dddd-4ddd-8ddd-ddddddddddd2';
const PLAYER_ID = 'ddddddd3-dddd-4ddd-8ddd-ddddddddddd3';
const COURSE_ID = 'ddddddd4-dddd-4ddd-8ddd-ddddddddddd4';
const TEE_ID = 'ddddddd5-dddd-4ddd-8ddd-ddddddddddd5';
const PENDING_ROUND_ID = 'ddddddd6-dddd-4ddd-8ddd-ddddddddddd6';
const REJECT_ROUND_ID = 'ddddddd7-dddd-4ddd-8ddd-ddddddddddd7';

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
      // Retry until server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('API did not become healthy in time');
}

before(async () => {
  await dbPool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active, deleted_at)
     VALUES
       ($1, 'admin-moderation@example.test', 'seed-password-hash', 'admin', TRUE, NULL),
       ($2, 'player-moderation@example.test', 'seed-password-hash', 'player', TRUE, NULL)
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
     VALUES ($1, $2, 'Moderation', 'Player', 'moderation-player@example.test', 'GB', NULL)
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
     VALUES ($1, 'Moderation Course', 'GB', NULL)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           country = EXCLUDED.country,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [COURSE_ID],
  );

  await dbPool.query(
    `INSERT INTO tee_configurations (id, course_id, name, tee_colour, hole_count, course_rating, slope_rating, deleted_at)
     VALUES ($1, $2, 'Championship', 'Black', 18, 72.0, 113, NULL)
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
    `INSERT INTO rounds (id, player_id, tee_configuration_id, played_at, gross_score, score_differential, status, deleted_at)
     VALUES
       ($1, $3, $4, '2026-05-10T10:00:00.000Z', 84, 10.123, 'pending', NULL),
       ($2, $3, $4, '2026-05-11T10:00:00.000Z', 90, 12.456, 'pending', NULL)
     ON CONFLICT (id) DO UPDATE
       SET player_id = EXCLUDED.player_id,
           tee_configuration_id = EXCLUDED.tee_configuration_id,
           played_at = EXCLUDED.played_at,
           gross_score = EXCLUDED.gross_score,
           score_differential = EXCLUDED.score_differential,
           status = EXCLUDED.status,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [PENDING_ROUND_ID, REJECT_ROUND_ID, PLAYER_ID, TEE_ID],
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

  await dbPool.query(
    "DELETE FROM audit_logs WHERE event_type IN ('round_approved', 'round_rejected', 'handicap_recalculation_requested') AND metadata->>'roundId' IN ($1, $2)",
    [PENDING_ROUND_ID, REJECT_ROUND_ID],
  );
  await dbPool.query('DELETE FROM rounds WHERE id IN ($1, $2)', [PENDING_ROUND_ID, REJECT_ROUND_ID]);
  await dbPool.query('DELETE FROM tee_configurations WHERE id = $1', [TEE_ID]);
  await dbPool.query('DELETE FROM courses WHERE id = $1', [COURSE_ID]);
  await dbPool.query('DELETE FROM players WHERE id = $1', [PLAYER_ID]);
  await dbPool.query('DELETE FROM users WHERE id IN ($1, $2)', [ADMIN_USER_ID, PLAYER_USER_ID]);
  await dbPool.end();
});

test('POST /api/admin/rounds/:id/approve approves round, logs audit, and requests handicap recalculation', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson(`/api/admin/rounds/${PENDING_ROUND_ID}/approve`, {
    method: 'POST',
    token,
  });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.round.id, PENDING_ROUND_ID);
  assert.equal(response.json.round.status, 'approved');
  assert.equal(response.json.round.rejectionReason, null);
  assert.equal(response.json.handicapRecalculationRequested, true);

  const approvedAudit = await dbPool.query(
    "SELECT event_type FROM audit_logs WHERE event_type = 'round_approved' AND metadata->>'roundId' = $1",
    [PENDING_ROUND_ID],
  );
  assert.ok(approvedAudit.rowCount >= 1, 'Expected round_approved audit event');

  const handicapAudit = await dbPool.query(
    "SELECT event_type, metadata->>'reason' AS reason FROM audit_logs WHERE event_type = 'handicap_recalculation_requested' AND metadata->>'roundId' = $1 ORDER BY created_at DESC LIMIT 1",
    [PENDING_ROUND_ID],
  );
  assert.equal(handicapAudit.rowCount, 1);
  assert.equal(handicapAudit.rows[0].reason, 'round_approved');
});

test('POST /api/admin/rounds/:id/reject requires reason and logs rejection audit event', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);

  const missingReason = await requestJson(`/api/admin/rounds/${REJECT_ROUND_ID}/reject`, {
    method: 'POST',
    token,
    body: {},
  });

  assert.equal(missingReason.status, 400, JSON.stringify(missingReason.json));
  assert.equal(missingReason.json.error.code, 'validation_error');

  const rejected = await requestJson(`/api/admin/rounds/${REJECT_ROUND_ID}/reject`, {
    method: 'POST',
    token,
    body: { rejectionReason: 'Scorecard mismatch' },
  });

  assert.equal(rejected.status, 200, JSON.stringify(rejected.json));
  assert.equal(rejected.json.round.status, 'rejected');
  assert.equal(rejected.json.round.rejectionReason, 'Scorecard mismatch');

  const rejectedAudit = await dbPool.query(
    "SELECT event_type, metadata->>'reason' AS reason FROM audit_logs WHERE event_type = 'round_rejected' AND metadata->>'roundId' = $1 ORDER BY created_at DESC LIMIT 1",
    [REJECT_ROUND_ID],
  );

  assert.equal(rejectedAudit.rowCount, 1);
  assert.equal(rejectedAudit.rows[0].reason, 'Scorecard mismatch');
});

test('POST /api/admin/rounds/:id/approve rejects non-admin users', async () => {
  const token = buildToken('player', PLAYER_USER_ID);
  const response = await requestJson(`/api/admin/rounds/${PENDING_ROUND_ID}/approve`, {
    method: 'POST',
    token,
  });

  assert.equal(response.status, 403, JSON.stringify(response.json));
  assert.equal(response.json.error.code, 'forbidden');
});
