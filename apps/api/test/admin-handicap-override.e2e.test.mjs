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
const API_PORT = 3940;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

const ADMIN_USER_ID = 'fffffff1-ffff-4fff-8fff-ffffffffffff';
const PLAYER_USER_ID = 'fffffff2-ffff-4fff-8fff-ffffffffffff';
const PLAYER_ID      = 'fffffff3-ffff-4fff-8fff-ffffffffffff';

let apiProcess;
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

function buildToken(role = 'admin', sub = ADMIN_USER_ID) {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign({ sub, role, tokenType: 'access' }, secret, { expiresIn: '30m' });
}

async function requestJson(path, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const response = await fetch(`${BASE_URL}${path}`, opts);
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
       ($1, 'story9-admin@example.test', 'seed-hash', 'admin', TRUE, NULL),
       ($2, 'story9-player@example.test', 'seed-hash', 'player', TRUE, NULL)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email, role = EXCLUDED.role,
           is_active = EXCLUDED.is_active, deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [ADMIN_USER_ID, PLAYER_USER_ID],
  );

  await dbPool.query(
    `INSERT INTO players (id, first_name, last_name, country, handicap_index)
     VALUES ($1, 'Story9', 'Player', 'GB', 18.0)
     ON CONFLICT (id) DO UPDATE
       SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
           country = EXCLUDED.country, handicap_index = EXCLUDED.handicap_index,
           deleted_at = NULL, updated_at = NOW()`,
    [PLAYER_ID],
  );

  await dbPool.query('DELETE FROM handicap_overrides WHERE player_id = $1', [PLAYER_ID]);

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
  await dbPool.query('DELETE FROM handicap_overrides WHERE player_id = $1', [PLAYER_ID]);
  await dbPool.query('DELETE FROM players WHERE id = $1', [PLAYER_ID]);
  await dbPool.query('DELETE FROM users WHERE id IN ($1, $2)', [ADMIN_USER_ID, PLAYER_USER_ID]);
  await dbPool.end();
});

test('POST /api/admin/handicap-override/:playerId applies override and returns 201', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson(`/api/admin/handicap-override/${PLAYER_ID}`, {
    method: 'POST',
    token,
    body: { newIndex: 14.3, reason: 'WHS exceptional reduction per committee' },
  });

  assert.equal(response.status, 201, JSON.stringify(response.json));
  assert.equal(response.json.override.newIndex, 14.3);
  assert.equal(response.json.override.reason, 'WHS exceptional reduction per committee');
  assert.equal(response.json.override.previousIndex, 18.0);

  // Verify player handicap_index was updated
  const player = await dbPool.query('SELECT handicap_index FROM players WHERE id = $1', [PLAYER_ID]);
  assert.equal(Number(player.rows[0].handicap_index), 14.3);
});

test('GET /api/admin/handicap-override/:playerId lists overrides after creation', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson(`/api/admin/handicap-override/${PLAYER_ID}`, { token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.ok(Array.isArray(response.json.overrides));
  assert.ok(response.json.total >= 1);

  const override = response.json.overrides.find((o) => o.reason === 'WHS exceptional reduction per committee');
  assert.ok(override, 'Expected seeded override to be present');
  assert.equal(override.newIndex, 14.3);
  assert.equal(override.adminEmail, 'story9-admin@example.test');
});

test('POST /api/handicap/override/:playerId applies override via story path alias', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson(`/api/handicap/override/${PLAYER_ID}`, {
    method: 'POST',
    token,
    body: { newIndex: 13.8, reason: 'Committee adjustment' },
  });

  assert.equal(response.status, 201, JSON.stringify(response.json));
  assert.equal(response.json.override.newIndex, 13.8);
  assert.equal(response.json.override.reason, 'Committee adjustment');
});

test('POST override logs manual entry in handicap history records', async () => {
  const record = await dbPool.query(
    `SELECT cap_adjustments, handicap_index
     FROM handicap_records
     WHERE player_id = $1
     ORDER BY calculation_date DESC
     LIMIT 1`,
    [PLAYER_ID],
  );

  assert.equal(record.rowCount, 1);
  assert.equal(Number(record.rows[0].handicap_index), 13.8);
  assert.equal(record.rows[0].cap_adjustments.method, 'manual_override');
});

test('POST /api/admin/handicap-override/:playerId returns 400 when reason is missing', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson(`/api/admin/handicap-override/${PLAYER_ID}`, {
    method: 'POST',
    token,
    body: { newIndex: 12.0 },
  });

  assert.equal(response.status, 400, JSON.stringify(response.json));
  assert.equal(response.json.error.code, 'validation_error');
});

test('POST /api/admin/handicap-override/:playerId returns 403 for non-admin users', async () => {
  const token = buildToken('player', PLAYER_USER_ID);
  const response = await requestJson(`/api/admin/handicap-override/${PLAYER_ID}`, {
    method: 'POST',
    token,
    body: { newIndex: 10.0, reason: 'Unauthorized attempt' },
  });

  assert.equal(response.status, 403, JSON.stringify(response.json));
});
