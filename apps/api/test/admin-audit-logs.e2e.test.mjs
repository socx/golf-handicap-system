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
const API_PORT = 3939;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

const ADMIN_USER_ID = 'eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1';
const PLAYER_USER_ID = 'eeeeeee2-eeee-4eee-8eee-eeeeeeeeeee2';
const THIRD_USER_ID = 'eeeeeee3-eeee-4eee-8eee-eeeeeeeeeee3';

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
       ($1, 'audit-admin@example.test', 'seed-password-hash', 'admin', TRUE, NULL),
       ($2, 'audit-player@example.test', 'seed-password-hash', 'player', TRUE, NULL),
       ($3, 'audit-third@example.test', 'seed-password-hash', 'player', TRUE, NULL)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [ADMIN_USER_ID, PLAYER_USER_ID, THIRD_USER_ID],
  );

  await dbPool.query(
    `INSERT INTO audit_logs (event_type, user_id, actor_user_id, ip_address, metadata, created_at)
     VALUES
       ('story6_event_login', $1, $2, '203.0.113.10', '{"feature":"auth","password":"hidden-value","token":"secret-token"}'::jsonb, NOW() - INTERVAL '2 days'),
       ('story6_event_round', $2, $1, '203.0.113.11', '{"feature":"rounds","safe":"ok","nested":{"secret":"remove-me","detail":"keep-me"}}'::jsonb, NOW() - INTERVAL '1 day'),
       ('story6_event_misc', $3, $1, '203.0.113.12', '{"feature":"misc","authorization":"Bearer xyz","note":"keep"}'::jsonb, NOW() - INTERVAL '12 hours')`,
    [PLAYER_USER_ID, ADMIN_USER_ID, THIRD_USER_ID],
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

  await dbPool.query("DELETE FROM audit_logs WHERE event_type IN ('story6_event_login', 'story6_event_round', 'story6_event_misc')");
  await dbPool.query("DELETE FROM audit_logs WHERE event_type IN ('admin_access_allowed', 'admin_access_denied') AND metadata->>'path' LIKE '%admin/audit-logs%'");
  await dbPool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [ADMIN_USER_ID, PLAYER_USER_ID, THIRD_USER_ID]);
  await dbPool.end();
});

test('GET /api/admin/audit-logs returns paginated logs with filters and timestamp/ip fields', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson('/api/admin/audit-logs?page=1&limit=2&eventType=story6_event_round', { token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.ok(Array.isArray(response.json.logs));
  assert.equal(response.json.pagination.page, 1);
  assert.equal(response.json.pagination.limit, 2);
  assert.equal(response.json.filters.eventType, 'story6_event_round');
  assert.ok(response.json.pagination.total >= 1);

  const eventLog = response.json.logs.find((log) => log.event_type === 'story6_event_round');
  assert.ok(eventLog, 'Expected filtered event to be present');
  assert.equal(eventLog.ip_address, '203.0.113.11');
  assert.ok(typeof eventLog.created_at === 'string' && eventLog.created_at.includes('T'));
});

test('GET /api/admin/audit-logs supports user and date range filters', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const from = encodeURIComponent('2000-01-01');
  const to = encodeURIComponent('2100-01-01');
  const response = await requestJson(`/api/admin/audit-logs?userId=${PLAYER_USER_ID}&from=${from}&to=${to}`, { token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.filters.userId, PLAYER_USER_ID);
  assert.ok(response.json.logs.length >= 1);
  assert.ok(response.json.logs.every((log) => log.user_id === PLAYER_USER_ID || log.actor_user_id === PLAYER_USER_ID));
});

test('GET /api/admin/audit-logs supports comma-separated eventType filters', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson('/api/admin/audit-logs?eventType=story6_event_login,story6_event_round', { token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.filters.eventType, 'story6_event_login,story6_event_round');
  assert.ok(response.json.logs.length >= 2);
  assert.ok(response.json.logs.every((log) => ['story6_event_login', 'story6_event_round'].includes(log.event_type)));
});

test('GET /api/admin/audit-logs redacts sensitive metadata keys', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson('/api/admin/audit-logs?eventType=story6_event_login', { token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  const loginEvent = response.json.logs.find((log) => log.event_type === 'story6_event_login');
  assert.ok(loginEvent);

  assert.equal(Object.prototype.hasOwnProperty.call(loginEvent.metadata, 'password'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(loginEvent.metadata, 'token'), false);
  assert.equal(loginEvent.metadata.feature, 'auth');

  const nestedResponse = await requestJson('/api/admin/audit-logs?eventType=story6_event_round', { token });
  const nestedEvent = nestedResponse.json.logs.find((log) => log.event_type === 'story6_event_round');
  assert.ok(nestedEvent);
  assert.equal(Object.prototype.hasOwnProperty.call(nestedEvent.metadata.nested, 'secret'), false);
  assert.equal(nestedEvent.metadata.nested.detail, 'keep-me');
});

test('GET /api/admin/audit-logs returns 403 for non-admin users', async () => {
  const token = buildToken('player', PLAYER_USER_ID);
  const response = await requestJson('/api/admin/audit-logs', { token });

  assert.equal(response.status, 403, JSON.stringify(response.json));
  assert.equal(response.json.error.code, 'forbidden');
});
