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
const API_PORT = 3951;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

const ADMIN_USER_ID = 'd0010001-1111-4111-8111-111111111111';
const PLAYER_USER_ID = 'd0010002-2222-4222-8222-222222222222';
const OTHER_PLAYER_USER_ID = 'd0010003-3333-4333-8333-333333333333';
const PLAYER_ID = 'd0010004-4444-4444-8444-444444444444';
const OTHER_PLAYER_ID = 'd0010005-5555-4555-8555-555555555555';
const COURSE_ID = 'd0010006-6666-4666-8666-666666666666';
const TEE_ID = 'd0010007-7777-4777-8777-777777777777';

const ROUND_IDS = [
  'd0011001-1111-4111-8111-111111111111',
  'd0011002-2222-4222-8222-222222222222',
  'd0011003-3333-4333-8333-333333333333',
  'd0011004-4444-4444-8444-444444444444',
  'd0011005-5555-4555-8555-555555555555',
  'd0011006-6666-4666-8666-666666666666',
];
const DELETED_ROUND_ID = 'd0011007-7777-4777-8777-777777777777';

let apiProcess;
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

function buildToken(role = 'player', sub = PLAYER_USER_ID) {
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

async function seedRounds() {
  const now = Date.now();

  for (let index = 0; index < ROUND_IDS.length; index += 1) {
    const roundId = ROUND_IDS[index];
    const playedAt = new Date(now - index * 86400000).toISOString();

    await dbPool.query(
      `INSERT INTO rounds (
         id, player_id, tee_configuration_id, played_at, status,
         gross_score, adjusted_gross_score, total_putts, total_gir, total_fairways_hit, total_penalties
       )
       VALUES ($1, $2, $3, $4, 'approved', $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [roundId, PLAYER_ID, TEE_ID, playedAt, 74 + index, 72 + index, 30 + index, 10, 7, 2],
    );

    await dbPool.query(
      `INSERT INTO hole_scores (id, round_id, hole_number, strokes, putts, gir, fairway_hit, in_sand, penalties, net_double_bogey_adjusted)
       VALUES
         (gen_random_uuid(), $1, 1, 4, 2, TRUE, TRUE, FALSE, 0, 4),
         (gen_random_uuid(), $1, 10, 5, 2, FALSE, FALSE, FALSE, 1, 5)
       ON CONFLICT DO NOTHING`,
      [roundId],
    );
  }

  await dbPool.query(
    `INSERT INTO rounds (
       id, player_id, tee_configuration_id, played_at, status,
       gross_score, adjusted_gross_score, total_putts, total_gir, total_fairways_hit, total_penalties, deleted_at
     )
     VALUES ($1, $2, $3, NOW() - INTERVAL '2 hours', 'approved', 99, 98, 45, 3, 1, 9, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [DELETED_ROUND_ID, PLAYER_ID, TEE_ID],
  );

  await dbPool.query(
    `INSERT INTO hole_scores (id, round_id, hole_number, strokes, putts, gir, fairway_hit, in_sand, penalties, net_double_bogey_adjusted)
     VALUES (gen_random_uuid(), $1, 1, 8, 4, FALSE, FALSE, FALSE, 2, 8)
     ON CONFLICT DO NOTHING`,
    [DELETED_ROUND_ID],
  );
}

before(async () => {
  await dbPool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active, deleted_at)
     VALUES
       ($1, 'dashboard-admin@example.test', 'seed-hash', 'admin', TRUE, NULL),
       ($2, 'dashboard-player@example.test', 'seed-hash', 'player', TRUE, NULL),
       ($3, 'dashboard-player-2@example.test', 'seed-hash', 'player', TRUE, NULL)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email, role = EXCLUDED.role,
           password_hash = EXCLUDED.password_hash,
           is_active = EXCLUDED.is_active, deleted_at = NULL,
           updated_at = NOW()`,
    [ADMIN_USER_ID, PLAYER_USER_ID, OTHER_PLAYER_USER_ID],
  );

  await dbPool.query(
    `INSERT INTO players (id, user_id, first_name, last_name, email, country, handicap_index, deleted_at)
     VALUES
       ($1, $2, 'Dash', 'Player', 'dash-player@example.test', 'GB', 11.2, NULL),
       ($3, $4, 'Other', 'Player', 'other-player@example.test', 'GB', 8.4, NULL)
     ON CONFLICT (id) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           email = EXCLUDED.email,
           country = EXCLUDED.country,
           handicap_index = EXCLUDED.handicap_index,
           deleted_at = NULL,
           updated_at = NOW()`,
    [PLAYER_ID, PLAYER_USER_ID, OTHER_PLAYER_ID, OTHER_PLAYER_USER_ID],
  );

  await dbPool.query(
    `INSERT INTO courses (id, name, city, country, deleted_at)
     VALUES ($1, 'Dashboard Valley', 'London', 'GB', NULL)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, city = EXCLUDED.city, country = EXCLUDED.country, deleted_at = NULL, updated_at = NOW()`,
    [COURSE_ID],
  );

  await dbPool.query(
    `INSERT INTO tee_configurations (id, course_id, name, tee_colour, hole_count, course_rating, slope_rating, deleted_at)
     VALUES ($1, $2, 'Blue', 'Blue', 18, 72.4, 128, NULL)
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

  await seedRounds();

  for (let i = 0; i < 12; i += 1) {
    await dbPool.query(
      `INSERT INTO handicap_records (
         id, player_id, calculation_date, handicap_index,
         num_differentials, average_differential, differentials_used, rounds_used, pcc_values, cap_adjustments
       )
       VALUES (
         gen_random_uuid(), $1, NOW() - ($2::int || ' days')::interval, $3,
         8, 10.123, '[]'::jsonb, '["r1","r2","r3","r4","r5","r6","r7","r8"]'::jsonb, '{}'::jsonb, '{}'::jsonb
       )`,
      [PLAYER_ID, i, 12.4 - i * 0.1],
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

  await dbPool.query('DELETE FROM hole_scores WHERE round_id = ANY($1::uuid[])', [[...ROUND_IDS, DELETED_ROUND_ID]]);
  await dbPool.query('DELETE FROM rounds WHERE id = ANY($1::uuid[])', [[...ROUND_IDS, DELETED_ROUND_ID]]);
  await dbPool.query('DELETE FROM handicap_records WHERE player_id = $1', [PLAYER_ID]);
  await dbPool.query('DELETE FROM tee_configurations WHERE id = $1', [TEE_ID]);
  await dbPool.query('DELETE FROM courses WHERE id = $1', [COURSE_ID]);
  await dbPool.query('DELETE FROM players WHERE id IN ($1, $2)', [PLAYER_ID, OTHER_PLAYER_ID]);
  await dbPool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [ADMIN_USER_ID, PLAYER_USER_ID, OTHER_PLAYER_USER_ID]);
  await dbPool.end();
});

test('GET /api/dashboard returns player dashboard summary and excludes deleted rounds', async () => {
  const token = buildToken('player', PLAYER_USER_ID);
  const response = await requestJson('/api/dashboard', { token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.playerId, PLAYER_ID);
  assert.equal(Array.isArray(response.json.recentRounds), true);
  assert.equal(response.json.recentRounds.length, 5);
  assert.equal(response.json.recentRounds.some((round) => round.id === DELETED_ROUND_ID), false);
  assert.equal(Array.isArray(response.json.handicapTrend), true);
  assert.equal(response.json.handicapTrend.length, 10);
  assert.equal(typeof response.json.stats.girPercentage, 'number');
  assert.equal(typeof response.json.stats.firPercentage, 'number');
  assert.equal(typeof response.json.stats.averagePutts, 'number');
  assert.equal(typeof response.json.stats.averagePenalties, 'number');
  assert.equal(typeof response.json.stats.scoringAverages.front9, 'number');
  assert.equal(typeof response.json.stats.scoringAverages.back9, 'number');
  assert.equal(typeof response.json.stats.scoringAverages.overall, 'number');
});

test('GET /api/dashboard prevents players from querying another playerId', async () => {
  const token = buildToken('player', PLAYER_USER_ID);
  const response = await requestJson(`/api/dashboard?playerId=${OTHER_PLAYER_ID}`, { token });

  assert.equal(response.status, 400, JSON.stringify(response.json));
  assert.equal(response.json.error.code, 'validation_error');
});

test('GET /api/dashboard allows admin to request a specific playerId', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson(`/api/dashboard?playerId=${PLAYER_ID}`, { token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.playerId, PLAYER_ID);
});
