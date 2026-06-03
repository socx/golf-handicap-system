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
const API_PORT = 3932;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

let apiProcess;
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

function buildToken(role = 'admin') {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign(
    { sub: '11111111-1111-4111-8111-111111111111', role, tokenType: 'access' },
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
      // Keep retrying until server starts.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('API did not become healthy in time');
}

before(async () => {
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

  await dbPool.end();
});

test('GET /api/players/:id requires admin role', async () => {
  const token = buildToken('player');
  const response = await requestJson('/api/players/11111111-1111-4111-8111-111111111111', { token });

  assert.equal(response.status, 403);
  assert.equal(response.json.error.code, 'forbidden');
});

test('GET /api/players/:id includes handicap summary and round stats', async () => {
  const adminToken = buildToken('admin');
  const suffix = Date.now();

  const playerCreate = await requestJson('/api/players', {
    method: 'POST',
    token: adminToken,
    body: {
      first_name: 'Story',
      last_name: `Detail-${suffix}`,
      country: 'GB',
      email: `players.detail.${suffix}@example.com`,
    },
  });

  assert.equal(playerCreate.status, 201);

  const playerId = playerCreate.json.player.id;
  let courseId;
  let teeConfigId;

  try {
    const courseResult = await dbPool.query(
      `INSERT INTO courses (name, city, country)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [`Story Detail Course ${suffix}`, 'Girona', 'ES'],
    );
    courseId = courseResult.rows[0].id;

    const teeResult = await dbPool.query(
      `INSERT INTO tee_configurations (course_id, name, tee_colour, hole_count, course_rating, slope_rating)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [courseId, 'Championship', 'Blue', 18, 72.3, 131],
    );
    teeConfigId = teeResult.rows[0].id;

    const olderRound = await dbPool.query(
      `INSERT INTO rounds (player_id, tee_configuration_id, played_at, status)
       VALUES ($1, $2, $3, 'approved')
       RETURNING id`,
      [playerId, teeConfigId, '2026-05-10T08:00:00.000Z'],
    );

    const newerRound = await dbPool.query(
      `INSERT INTO rounds (player_id, tee_configuration_id, played_at, status)
       VALUES ($1, $2, $3, 'approved')
       RETURNING id`,
      [playerId, teeConfigId, '2026-05-20T08:00:00.000Z'],
    );

    await dbPool.query(
      `INSERT INTO rounds (player_id, tee_configuration_id, played_at, status, deleted_at)
       VALUES ($1, $2, $3, 'approved', NOW())`,
      [playerId, teeConfigId, '2026-05-25T08:00:00.000Z'],
    );

    await dbPool.query(
      `INSERT INTO handicap_records
       (player_id, calculation_date, handicap_index, num_differentials, average_differential, differentials_used, rounds_used, pcc_values, cap_adjustments)
       VALUES
       ($1, $2, $3, 8, 12.111, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
       ($1, $4, $5, 8, 11.987, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb)`,
      [playerId, '2026-05-11T08:00:00.000Z', 12.3, '2026-05-21T08:00:00.000Z', 11.1],
    );

    const detailResponse = await requestJson(`/api/players/${playerId}`, { token: adminToken });
    assert.equal(detailResponse.status, 200);

    assert.equal(detailResponse.json.player.id, playerId);
    assert.equal(detailResponse.json.handicap_summary.current_handicap_index, '11.1');
    assert.equal(detailResponse.json.handicap_summary.last_handicap_update_date, '2026-05-21T08:00:00.000Z');
    assert.equal(detailResponse.json.round_stats.round_count, 2);
    assert.equal(detailResponse.json.round_stats.last_round_date, '2026-05-20T08:00:00.000Z');

    await dbPool.query('DELETE FROM rounds WHERE id = $1', [olderRound.rows[0].id]);
    await dbPool.query('DELETE FROM rounds WHERE id = $1', [newerRound.rows[0].id]);
  } finally {
    await dbPool.query('DELETE FROM handicap_records WHERE player_id = $1', [playerId]);
    await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerId]);
    if (teeConfigId) {
      await dbPool.query('DELETE FROM tee_configurations WHERE id = $1', [teeConfigId]);
    }
    if (courseId) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [courseId]);
    }
    await dbPool.query('DELETE FROM players WHERE id = $1', [playerId]);
  }
});
