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
const API_PORT = 3935;
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
  await dbPool.query(`
    INSERT INTO users (id, email, password_hash, role, is_active, deleted_at)
    VALUES
      ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'adminlist-active-admin@example.test', 'seed-password-hash', 'admin', TRUE, NULL),
      ('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'adminlist-active-player@example.test', 'seed-password-hash', 'player', TRUE, NULL),
      ('aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'adminlist-inactive-player@example.test', 'seed-password-hash', 'player', FALSE, NULL),
      ('aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'adminlist-deleted-player@example.test', 'seed-password-hash', 'player', TRUE, NOW()),
      ('aaaaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'adminlist-second-admin@example.test', 'seed-password-hash', 'admin', TRUE, NULL)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active,
          deleted_at = EXCLUDED.deleted_at,
          updated_at = NOW();
  `);

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

  await dbPool.query("DELETE FROM audit_logs WHERE event_type IN ('admin_access_allowed', 'admin_access_denied') AND metadata->>'path' LIKE '%admin/users%'");
  await dbPool.query("DELETE FROM users WHERE email LIKE 'adminlist-%@example.test'");
  await dbPool.end();
});

test('GET /api/admin/users', async (t) => {
  await t.test('returns paginated list for admins and excludes deleted by default', async () => {
    const token = buildToken('admin');
    const response = await requestJson('/api/admin/users?page=1&limit=2', { token });

    assert.equal(response.status, 200, JSON.stringify(response.json));
    assert.equal(response.json.includeDeleted, false);
    assert.equal(response.json.pagination.page, 1);
    assert.equal(response.json.pagination.limit, 2);
    assert.ok(response.json.pagination.total >= 4);
    assert.equal(response.json.users.length, 2);

    const hasDeleted = response.json.users.some((user) => user.email === 'adminlist-deleted-player@example.test');
    assert.equal(hasDeleted, false);
  });

  await t.test('supports search + role + status filters', async () => {
    const token = buildToken('admin');
    const response = await requestJson('/api/admin/users?search=inactive&role=player&status=inactive', { token });

    assert.equal(response.status, 200, JSON.stringify(response.json));
    assert.ok(response.json.users.length >= 1);
    assert.equal(response.json.users[0].email, 'adminlist-inactive-player@example.test');
    assert.equal(response.json.users[0].role, 'player');
    assert.equal(response.json.users[0].is_active, false);
  });

  await t.test('includeDeleted=true includes soft-deleted users', async () => {
    const token = buildToken('admin');
    const response = await requestJson('/api/admin/users?search=deleted&includeDeleted=true', { token });

    assert.equal(response.status, 200, JSON.stringify(response.json));
    assert.equal(response.json.includeDeleted, true);
    const deletedUser = response.json.users.find((user) => user.email === 'adminlist-deleted-player@example.test');
    assert.ok(deletedUser);
    assert.ok(deletedUser.deleted_at);
  });

  await t.test('returns 403 for non-admin users', async () => {
    const token = buildToken('player');
    const response = await requestJson('/api/admin/users', { token });

    assert.equal(response.status, 403, JSON.stringify(response.json));
    assert.equal(response.json.error.code, 'forbidden');
  });
});
