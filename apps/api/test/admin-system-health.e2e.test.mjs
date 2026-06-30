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
const SUPER_ADMIN_ID = 'c8fe5d5f-ec40-4d10-ae59-63f7ce4d7c41';
const ADMIN_NON_SUPER_ID = 'f6f35ec1-51bc-4aa4-9b5f-2b2dc9699308';

let apiProcess;
let dbPool;

function buildToken(sub, role = 'admin') {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign({ sub, role, tokenType: 'access' }, secret, { expiresIn: '30m' });
}

async function requestJson(path, { token } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers });
  const json = await response.json();
  return { status: response.status, json };
}

async function waitForHealth(maxAttempts = 40, delayMs = 250) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // Retry while server starts.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error('API did not become healthy in time');
}

before(async () => {
  dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

  await dbPool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[SUPER_ADMIN_ID, ADMIN_NON_SUPER_ID]]);
  await dbPool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active, deleted_at)
     VALUES ($1, 'health-super-admin@example.test', 'seed-hash', 'admin', TRUE, NULL),
            ($2, 'health-admin@example.test', 'seed-hash', 'admin', TRUE, NULL)`,
    [SUPER_ADMIN_ID, ADMIN_NON_SUPER_ID],
  );

  apiProcess = spawn('node', ['--import', 'tsx', 'apps/api/src/index.ts'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      API_PORT: String(API_PORT),
      SUPER_ADMIN_EMAILS: 'health-super-admin@example.test',
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
  try {
    await dbPool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[SUPER_ADMIN_ID, ADMIN_NON_SUPER_ID]]);
    await dbPool.end();
  } catch {
    // no-op cleanup
  }

  if (apiProcess) {
    apiProcess.kill();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
});

test('GET /api/admin/system-health returns health payload for super admin', async () => {
  const token = buildToken(SUPER_ADMIN_ID, 'admin');
  const response = await requestJson('/api/admin/system-health', { token });

  assert.equal(response.status, 200, `Expected 200, got ${response.status}`);
  assert.ok(response.json.modules, 'Expected modules in payload');
  assert.ok(response.json.modules.database, 'Expected database module status');
  assert.ok(response.json.modules.cache, 'Expected cache module status');
  assert.ok(response.json.modules.objectStorage, 'Expected object storage module status');
  assert.ok(response.json.modules.queue, 'Expected queue module status');
  assert.equal(typeof response.json.api?.uptimeSeconds, 'number');
});

test('GET /api/admin/system-health rejects non-super admins', async () => {
  const token = buildToken(ADMIN_NON_SUPER_ID, 'admin');
  const response = await requestJson('/api/admin/system-health', { token });

  assert.equal(response.status, 403, `Expected 403, got ${response.status}`);
  assert.equal(response.json.error?.code, 'forbidden_super_admin');
});

test('GET /api/admin/system-health rejects non-admin users', async () => {
  const token = buildToken(SUPER_ADMIN_ID, 'player');
  const response = await requestJson('/api/admin/system-health', { token });

  assert.equal(response.status, 403, `Expected 403, got ${response.status}`);
});
