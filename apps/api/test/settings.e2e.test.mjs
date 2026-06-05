import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const require = createRequire(import.meta.url);
const { loadEnvFromRoot } = require('../../../scripts/db/load-env');
loadEnvFromRoot();

const ROOT_DIR = new URL('../../..', import.meta.url).pathname;
const API_PORT = 3941;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

const USER_ID = 'aaaaab01-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_EMAIL = 'settings-e2e@example.test';
const PASSWORD = 'TestPass123';

let apiProcess;
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

function buildToken(role = 'player', sub = USER_ID) {
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
  const hash = await bcrypt.hash(PASSWORD, 12);
  await dbPool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active, deleted_at)
     VALUES ($1, $2, $3, 'player', TRUE, NULL)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role, is_active = EXCLUDED.is_active,
           deleted_at = EXCLUDED.deleted_at, updated_at = NOW()`,
    [USER_ID, USER_EMAIL, hash],
  );

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
  await dbPool.query('DELETE FROM notification_preferences WHERE user_id = $1', [USER_ID]);
  await dbPool.query('DELETE FROM users WHERE id = $1', [USER_ID]);
  await dbPool.end();
});

test('GET /api/auth/preferences returns 401 without token', async () => {
  const { status } = await requestJson('/api/auth/preferences');
  assert.equal(status, 401);
});

test('GET /api/auth/preferences returns preferences for authenticated user', async () => {
  const token = buildToken('player', USER_ID);
  const { status, json } = await requestJson('/api/auth/preferences', { token });
  assert.equal(status, 200);
  assert.ok(json.preferences, 'should return preferences object');
  assert.equal(typeof json.preferences.handicap_updates_enabled, 'boolean');
  assert.equal(typeof json.preferences.round_submitted_enabled, 'boolean');
  assert.equal(typeof json.preferences.round_approved_enabled, 'boolean');
  assert.equal(typeof json.preferences.marketing_enabled, 'boolean');
});

test('PATCH /api/auth/preferences updates notification preferences', async () => {
  const token = buildToken('player', USER_ID);
  const { status, json } = await requestJson('/api/auth/preferences', {
    method: 'PATCH',
    token,
    body: { handicap_updates_enabled: true, marketing_enabled: true },
  });
  assert.equal(status, 200);
  assert.equal(json.preferences.handicap_updates_enabled, true);
  assert.equal(json.preferences.marketing_enabled, true);
});

test('PATCH /api/auth/profile updates email', async () => {
  const token = buildToken('player', USER_ID);
  const newEmail = `settings-e2e-updated-${Date.now()}@example.test`;
  const { status, json } = await requestJson('/api/auth/profile', {
    method: 'PATCH',
    token,
    body: { email: newEmail },
  });
  assert.equal(status, 200);
  assert.equal(json.email, newEmail);

  // Restore email
  await dbPool.query('UPDATE users SET email = $1 WHERE id = $2', [USER_EMAIL, USER_ID]);
});

test('PATCH /api/auth/password changes password with correct current password', async () => {
  const token = buildToken('player', USER_ID);
  const newPassword = 'NewPass456!';
  const { status, json } = await requestJson('/api/auth/password', {
    method: 'PATCH',
    token,
    body: { currentPassword: PASSWORD, newPassword },
  });
  assert.equal(status, 200);
  assert.ok(json.message);

  // Restore original password
  const hash = await bcrypt.hash(PASSWORD, 12);
  await dbPool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, USER_ID]);
});

test('PATCH /api/auth/password returns 400 with wrong current password', async () => {
  const token = buildToken('player', USER_ID);
  const { status } = await requestJson('/api/auth/password', {
    method: 'PATCH',
    token,
    body: { currentPassword: 'wrong-password', newPassword: 'doesnotmatter' },
  });
  assert.equal(status, 400);
});
