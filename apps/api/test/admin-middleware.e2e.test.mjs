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
const API_PORT = 3933;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

let apiProcess;
let dbPool;

function buildAdminToken() {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign(
    { sub: '11111111-1111-4111-8111-111111111111', role: 'admin', tokenType: 'access' },
    secret,
    { expiresIn: '30m' },
  );
}

function buildPlayerToken() {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign(
    { sub: '22222222-2222-4222-8222-222222222222', role: 'player', tokenType: 'access' },
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
      // Retry until server is up.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('API did not become healthy in time');
}

before(async () => {
  // Initialize database pool
  dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

  // Start API server
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

  // Wait for API to be ready
  await waitForHealth();
});

after(async () => {
  // Clean up database
  try {
    await dbPool.query("DELETE FROM audit_logs WHERE event_type IN ('admin_access_allowed', 'admin_access_denied')");
    await dbPool.end();
  } catch (error) {
    console.error('Error cleaning up database:', error);
  }

  if (apiProcess) {
    apiProcess.kill();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
});

test('Admin access middleware', async (t) => {
  await t.test('logs successful admin access to admin endpoint', async () => {
    const adminToken = buildAdminToken();
    const response = await requestJson('/api/admin/status', { token: adminToken });

    assert.equal(response.status, 200, `Expected 200, got ${response.status}: ${JSON.stringify(response.json)}`);
    assert.equal(response.json.admin, true, 'Admin status should return admin flag');

    // Check audit logs for admin_access_allowed event
    const auditResult = await dbPool.query(
      `SELECT event_type, metadata->>'role' as role
       FROM audit_logs
       WHERE event_type = 'admin_access_allowed' AND metadata->>'path' LIKE '%admin/status%'
       ORDER BY created_at DESC LIMIT 1`,
    );

    assert.ok(auditResult.rows.length > 0, 'Should have logged admin access');
    const auditLog = auditResult.rows[0];
    assert.equal(auditLog.event_type, 'admin_access_allowed', 'Event type should be admin_access_allowed');
    assert.equal(auditLog.role, 'admin', 'Role should be admin');
  });

  await t.test('logs denied admin access for non-admin users', async () => {
    const playerToken = buildPlayerToken();
    const response = await requestJson('/api/admin/status', { token: playerToken });

    assert.equal(response.status, 403, `Expected 403, got ${response.status}`);

    // Check audit logs for admin_access_denied event
    const auditResult = await dbPool.query(
      `SELECT event_type, metadata->>'errorCode' as error_code, metadata->>'attemptedRole' as attempted_role
       FROM audit_logs
       WHERE event_type = 'admin_access_denied' AND metadata->>'path' LIKE '%admin/status%'
       ORDER BY created_at DESC LIMIT 1`,
    );

    assert.ok(auditResult.rows.length > 0, 'Should have logged denied access');
    const auditLog = auditResult.rows[0];
    assert.equal(auditLog.event_type, 'admin_access_denied', 'Event type should be admin_access_denied');
    assert.equal(auditLog.error_code, 'forbidden', 'Error code should be forbidden');
    assert.equal(auditLog.attempted_role, 'player', 'Attempted role should be player');
  });

  await t.test('logs denied admin access when token is invalid or missing', async () => {
    const response = await requestJson('/api/admin/status', { token: 'invalid-token' });

    assert.equal(response.status, 401, `Expected 401, got ${response.status}`);

    // Check audit logs for admin_access_denied event
    const auditResult = await dbPool.query(
      `SELECT event_type, metadata->>'errorCode' as error_code
       FROM audit_logs
       WHERE event_type = 'admin_access_denied' AND metadata->>'path' LIKE '%admin/status%' AND metadata->>'errorCode' = 'unauthorized'
       ORDER BY created_at DESC LIMIT 1`,
    );

    assert.ok(auditResult.rows.length > 0, 'Should have logged denied access with unauthorized error');
  });

  await t.test('logs include IP address and HTTP method', async () => {
    const adminToken = buildAdminToken();
    const response = await requestJson('/api/admin/status', { token: adminToken, method: 'GET' });

    assert.equal(response.status, 200);

    // Check audit logs include IP and method
    const auditResult = await dbPool.query(
      `SELECT ip_address, metadata->>'method' as method
       FROM audit_logs
       WHERE event_type = 'admin_access_allowed' AND metadata->>'path' LIKE '%admin/status%'
       ORDER BY created_at DESC LIMIT 1`,
    );

    assert.ok(auditResult.rows.length > 0, 'Should have audit log');
    const auditLog = auditResult.rows[0];
    assert.ok(auditLog.ip_address, 'Should have IP address');
    assert.equal(auditLog.method, 'GET', 'Should include HTTP method in logs');
  });
});
