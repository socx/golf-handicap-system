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
const API_PORT = 3952;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

const ADMIN_USER_ID = 'e0010001-1111-4111-8111-111111111111';
const PLAYER_USER_ID = 'e0010002-2222-4222-8222-222222222222';
const PLAYER1_ID = 'e0010003-3333-4333-8333-333333333333';
const PLAYER2_ID = 'e0010004-4444-4444-8444-444444444444';
const COURSE_ID = 'e0010005-5555-4555-8555-555555555555';
const TEE_ID = 'e0010006-6666-4666-8666-666666666666';
const ROUND1_ID = 'e0010007-7777-4777-8777-777777777777';
const ROUND2_ID = 'e0010008-8888-4888-8888-888888888888';

let apiProcess;
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

function buildToken(role = 'admin', sub = ADMIN_USER_ID) {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign({ sub, role, tokenType: 'access' }, secret, { expiresIn: '30m' });
}

async function requestJson(path, { method = 'GET', token } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { method, headers });
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
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

before(async () => {
  await dbPool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active, deleted_at)
     VALUES
       ($1, 'admin-dashboard@example.test', 'seed-hash', 'admin', TRUE, NULL),
       ($2, 'admin-dashboard-player@example.test', 'seed-hash', 'player', TRUE, NULL)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email, role = EXCLUDED.role,
           password_hash = EXCLUDED.password_hash,
           is_active = EXCLUDED.is_active, deleted_at = NULL,
           updated_at = NOW()`,
    [ADMIN_USER_ID, PLAYER_USER_ID],
  );

  await dbPool.query(
    `INSERT INTO players (id, user_id, first_name, last_name, email, country, handicap_index, deleted_at)
     VALUES
       ($1, NULL, 'System', 'Player1', 'system-player1@example.test', 'GB', 5.5, NULL),
       ($2, $3, 'System', 'Player2', 'system-player2@example.test', 'GB', 14.2, NULL)
     ON CONFLICT (id) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           email = EXCLUDED.email,
           country = EXCLUDED.country,
           handicap_index = EXCLUDED.handicap_index,
           deleted_at = NULL,
           updated_at = NOW()`,
    [PLAYER1_ID, PLAYER2_ID, PLAYER_USER_ID],
  );

  await dbPool.query(
    `INSERT INTO courses (id, name, city, country, deleted_at)
     VALUES ($1, 'Admin Dash Course', 'Leeds', 'GB', NULL)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, city = EXCLUDED.city, country = EXCLUDED.country, deleted_at = NULL, updated_at = NOW()`,
    [COURSE_ID],
  );

  await dbPool.query(
    `INSERT INTO tee_configurations (id, course_id, name, tee_colour, hole_count, course_rating, slope_rating, deleted_at)
     VALUES ($1, $2, 'White', 'White', 18, 71.8, 125, NULL)
     ON CONFLICT (id) DO UPDATE
       SET course_id = EXCLUDED.course_id,
           name = EXCLUDED.name,
           tee_colour = EXCLUDED.tee_colour,
           hole_count = EXCLUDED.hole_count,
           course_rating = EXCLUDED.course_rating,
           slope_rating = EXCLUDED.slope_rating,
           deleted_at = NULL,
           updated_at = NOW()`,
    [TEE_ID, COURSE_ID],
  );

  await dbPool.query(
    `INSERT INTO rounds (
       id, player_id, tee_configuration_id, played_at, status,
       gross_score, adjusted_gross_score, total_putts, total_gir, total_fairways_hit, total_penalties, deleted_at
     )
     VALUES
       ($1, $2, $4, NOW() - INTERVAL '1 day', 'pending', 81, 79, 34, 7, 5, 3, NULL),
       ($3, $5, $4, NOW() - INTERVAL '2 day', 'approved', 75, 73, 31, 10, 7, 1, NULL)
     ON CONFLICT (id) DO UPDATE
       SET player_id = EXCLUDED.player_id,
           tee_configuration_id = EXCLUDED.tee_configuration_id,
           played_at = EXCLUDED.played_at,
           status = EXCLUDED.status,
           gross_score = EXCLUDED.gross_score,
           adjusted_gross_score = EXCLUDED.adjusted_gross_score,
           total_putts = EXCLUDED.total_putts,
           total_gir = EXCLUDED.total_gir,
           total_fairways_hit = EXCLUDED.total_fairways_hit,
           total_penalties = EXCLUDED.total_penalties,
           deleted_at = NULL,
           updated_at = NOW()`,
    [ROUND1_ID, PLAYER1_ID, ROUND2_ID, TEE_ID, PLAYER2_ID],
  );

  for (let i = 0; i < 24; i += 1) {
    await dbPool.query(
      `INSERT INTO audit_logs (id, event_type, user_id, actor_user_id, ip_address, metadata, created_at)
       VALUES (gen_random_uuid(), 'admin_dashboard_test_event', $1, $1, '127.0.0.1', $2::jsonb, NOW() - ($3::int || ' minutes')::interval)`,
      [ADMIN_USER_ID, JSON.stringify({ sequence: i }), i],
    );
  }

  apiProcess = spawn('node', ['--import', 'tsx', 'apps/api/src/index.ts'], {
    cwd: ROOT_DIR,
    env: { ...process.env, API_PORT: String(API_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  apiProcess.stdout.on('data', (chunk) => process.stdout.write(`[api] ${chunk}`));
  apiProcess.stderr.on('data', (chunk) => process.stderr.write(`[api] ${chunk}`));

  await waitForHealth();
});

after(async () => {
  if (apiProcess) apiProcess.kill();

  await dbPool.query("DELETE FROM audit_logs WHERE event_type = 'admin_dashboard_test_event'");
  await dbPool.query('DELETE FROM rounds WHERE id IN ($1, $2)', [ROUND1_ID, ROUND2_ID]);
  await dbPool.query('DELETE FROM tee_configurations WHERE id = $1', [TEE_ID]);
  await dbPool.query('DELETE FROM courses WHERE id = $1', [COURSE_ID]);
  await dbPool.query('DELETE FROM players WHERE id IN ($1, $2)', [PLAYER1_ID, PLAYER2_ID]);
  await dbPool.query('DELETE FROM users WHERE id IN ($1, $2)', [ADMIN_USER_ID, PLAYER_USER_ID]);
  await dbPool.end();
});

test('GET /api/admin/dashboard enforces admin-only access', async () => {
  const token = buildToken('player', PLAYER_USER_ID);
  const response = await requestJson('/api/admin/dashboard', { token });

  assert.equal(response.status, 403, JSON.stringify(response.json));
  assert.equal(response.json.error.code, 'forbidden');
});

test('GET /api/admin/dashboard returns system metrics and activity', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson('/api/admin/dashboard', { token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.overview.totalPlayers >= 2, true);
  assert.equal(response.json.overview.totalRounds >= 2, true);
  assert.equal(response.json.overview.pendingRounds >= 1, true);
  assert.equal(Array.isArray(response.json.handicapDistribution.buckets), true);
  assert.equal(response.json.handicapDistribution.buckets.length > 0, true);
  assert.equal(Array.isArray(response.json.recentActivity), true);
  assert.equal(response.json.recentActivity.length, 20);
  assert.equal(response.json.recentActivity[0].eventType, 'admin_dashboard_test_event');
});
