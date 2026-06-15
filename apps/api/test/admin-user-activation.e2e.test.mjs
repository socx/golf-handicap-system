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
const API_PORT = 3941;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

const ADMIN_ID = 'f1111111-1111-4111-8111-111111111111';
const TARGET_ID = 'f2222222-2222-4222-8222-222222222222';

let apiProcess;
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

function buildToken(role = 'admin', sub = ADMIN_ID) {
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
       ($1, 'admin-activation@example.test', 'seed-password-hash', 'admin', TRUE, NULL),
       ($2, 'player-activation@example.test', 'seed-password-hash', 'player', FALSE, NULL)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [ADMIN_ID, TARGET_ID],
  );

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
    apiProcess.kill();
  }

  await dbPool.query("DELETE FROM audit_logs WHERE event_type IN ('auth_user_activated', 'auth_user_deactivated') AND user_id IN ($1, $2)", [ADMIN_ID, TARGET_ID]);
  await dbPool.query('DELETE FROM users WHERE id IN ($1, $2)', [ADMIN_ID, TARGET_ID]);
  await dbPool.end();
});

test('PATCH /api/users/:id/activate activates user and reports activation email sent', async () => {
  const token = buildToken('admin', ADMIN_ID);
  const response = await requestJson(`/api/users/${TARGET_ID}/activate`, { method: 'PATCH', token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.user.id, TARGET_ID);
  assert.equal(response.json.user.is_active, true);
  assert.equal(response.json.notificationEmailSent, true);

  const auditResult = await dbPool.query(
    `SELECT event_type
     FROM audit_logs
     WHERE event_type = 'auth_user_activated' AND user_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [TARGET_ID],
  );
  assert.equal(auditResult.rowCount, 1);
});

test('PATCH /api/users/:id/deactivate deactivates user and skips email flag', async () => {
  await dbPool.query('UPDATE users SET is_active = TRUE WHERE id = $1', [TARGET_ID]);
  const token = buildToken('admin', ADMIN_ID);
  const response = await requestJson(`/api/users/${TARGET_ID}/deactivate`, { method: 'PATCH', token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.user.is_active, false);
  assert.equal(response.json.notificationEmailSent, false);

  const auditResult = await dbPool.query(
    `SELECT event_type
     FROM audit_logs
     WHERE event_type = 'auth_user_deactivated' AND user_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [TARGET_ID],
  );
  assert.equal(auditResult.rowCount, 1);
});

test('PATCH /api/users/:id/activate rejects non-admin users', async () => {
  const token = buildToken('player', TARGET_ID);
  const response = await requestJson(`/api/users/${TARGET_ID}/activate`, { method: 'PATCH', token });

  assert.equal(response.status, 403, JSON.stringify(response.json));
  assert.equal(response.json.error.code, 'forbidden');
});
