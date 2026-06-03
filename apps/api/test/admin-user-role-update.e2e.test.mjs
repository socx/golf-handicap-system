import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);
const { loadEnvFromRoot } = require('../../../scripts/db/load-env');
loadEnvFromRoot();

const ROOT_DIR = new URL('../../..', import.meta.url).pathname;
const API_PORT = 3936;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

const ACTOR_ID = 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const TARGET_ID = 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const ACTOR_EMAIL = 'admin-role-actor@example.test';
const TARGET_EMAIL = 'admin-role-target@example.test';

let apiProcess;
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

function buildAdminToken() {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign(
    { sub: ACTOR_ID, role: 'admin', tokenType: 'access' },
    secret,
    { expiresIn: '30m' },
  );
}

function buildPlayerToken() {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign(
    { sub: TARGET_ID, role: 'player', tokenType: 'access' },
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

// IDs of other admin users temporarily deactivated for test isolation
let otherAdminIds = [];

beforeEach(async () => {
  const otherAdmins = await dbPool.query(
    "SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE AND id NOT IN ($1, $2) AND deleted_at IS NULL",
    [ACTOR_ID, TARGET_ID],
  );
  otherAdminIds = otherAdmins.rows.map((r) => r.id);
  if (otherAdminIds.length > 0) {
    await dbPool.query(`UPDATE users SET is_active = FALSE WHERE id = ANY($1::uuid[])`, [otherAdminIds]);
  }

  await dbPool.query(`
    INSERT INTO users (id, email, password_hash, role, is_active, deleted_at)
    VALUES
      ($1, $2, 'seed-password-hash', 'admin', TRUE, NULL),
      ($3, $4, 'seed-password-hash', 'player', TRUE, NULL)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active,
          deleted_at = EXCLUDED.deleted_at,
          updated_at = NOW();
  `, [ACTOR_ID, ACTOR_EMAIL, TARGET_ID, TARGET_EMAIL]);
});

afterEach(async () => {
  await dbPool.query(
    "DELETE FROM audit_logs WHERE event_type = 'auth_user_role_updated' AND user_id IN ($1, $2)",
    [ACTOR_ID, TARGET_ID],
  );
  await dbPool.query("DELETE FROM users WHERE id IN ($1, $2)", [ACTOR_ID, TARGET_ID]);
  if (otherAdminIds.length > 0) {
    await dbPool.query(`UPDATE users SET is_active = TRUE WHERE id = ANY($1::uuid[])`, [otherAdminIds]);
    otherAdminIds = [];
  }
});

after(async () => {
  if (apiProcess) {
    apiProcess.kill();
  }
  await dbPool.end();
});

test('PATCH /api/admin/users/:id/role - updates a user role and logs the change', async () => {
  const token = buildAdminToken();
  const response = await requestJson(`/api/admin/users/${TARGET_ID}/role`, {
    method: 'PATCH',
    token,
    body: { role: 'admin' },
  });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.user.id, TARGET_ID);
  assert.equal(response.json.user.role, 'admin');

  const auditResult = await dbPool.query(
    `SELECT event_type, metadata->>'old_role' AS old_role, metadata->>'new_role' AS new_role
     FROM audit_logs
     WHERE event_type = 'auth_user_role_updated' AND user_id = $1 AND metadata->>'new_role' = 'admin'
     ORDER BY created_at DESC LIMIT 1`,
    [TARGET_ID],
  );

  assert.equal(auditResult.rowCount, 1, 'Expected one role update audit log');
  assert.equal(auditResult.rows[0].old_role, 'player');
  assert.equal(auditResult.rows[0].new_role, 'admin');
});

test('PATCH /api/admin/users/:id/role - rejects demoting the last remaining admin', async () => {
  const token = buildAdminToken();
  const response = await requestJson(`/api/admin/users/${ACTOR_ID}/role`, {
    method: 'PATCH',
    token,
    body: { role: 'player' },
  });

  assert.equal(response.status, 409, JSON.stringify(response.json));
  assert.equal(response.json.error.code, 'last_admin_required');
});

test('PATCH /api/admin/users/:id/role - returns 403 for non-admin users', async () => {
  const token = buildPlayerToken();
  const response = await requestJson(`/api/admin/users/${TARGET_ID}/role`, {
    method: 'PATCH',
    token,
    body: { role: 'admin' },
  });

  assert.equal(response.status, 403, JSON.stringify(response.json));
  assert.equal(response.json.error.code, 'forbidden');
});
