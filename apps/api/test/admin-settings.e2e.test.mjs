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
const API_PORT = 3942;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

const ADMIN_USER_ID = 'aaaab001-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const PLAYER_USER_ID = 'aaaab002-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

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
    `CREATE TABLE IF NOT EXISTS system_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      pcc_override SMALLINT NULL,
      notification_settings JSONB NOT NULL DEFAULT '{"round_submitted": true, "round_approved": true, "maintenance_alerts": true}'::jsonb,
      maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
      maintenance_message TEXT NOT NULL DEFAULT 'Scheduled maintenance is in progress. Some features may be temporarily unavailable.',
      updated_by UUID NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT system_settings_singleton_chk CHECK (id = 1),
      CONSTRAINT system_settings_pcc_override_chk CHECK (pcc_override IS NULL OR (pcc_override BETWEEN -1 AND 3)),
      CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
  );

  await dbPool.query(
    `ALTER TABLE system_settings
     ADD COLUMN IF NOT EXISTS maintenance_message TEXT NOT NULL DEFAULT 'Scheduled maintenance is in progress. Some features may be temporarily unavailable.'`,
  );

  await dbPool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active, deleted_at)
     VALUES
       ($1, 'story10-admin@example.test', 'seed-hash', 'admin', TRUE, NULL),
       ($2, 'story10-player@example.test', 'seed-hash', 'player', TRUE, NULL)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email, role = EXCLUDED.role,
           is_active = EXCLUDED.is_active, deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [ADMIN_USER_ID, PLAYER_USER_ID],
  );

  await dbPool.query(
    `INSERT INTO system_settings (id, pcc_override, notification_settings, maintenance_mode, maintenance_message, updated_by)
     VALUES (1, NULL, '{"round_submitted": true, "round_approved": true, "maintenance_alerts": true}'::jsonb, FALSE, 'Scheduled maintenance is in progress. Some features may be temporarily unavailable.', NULL)
     ON CONFLICT (id) DO UPDATE SET
       pcc_override = EXCLUDED.pcc_override,
       notification_settings = EXCLUDED.notification_settings,
       maintenance_mode = EXCLUDED.maintenance_mode,
       maintenance_message = EXCLUDED.maintenance_message,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
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
  await dbPool.query('DELETE FROM system_settings WHERE id = 1');
  await dbPool.query('DELETE FROM users WHERE id IN ($1, $2)', [ADMIN_USER_ID, PLAYER_USER_ID]);
  await dbPool.end();
});

test('GET /api/admin/settings returns 403 for non-admin users', async () => {
  const token = buildToken('player', PLAYER_USER_ID);
  const response = await requestJson('/api/admin/settings', { token });
  assert.equal(response.status, 403, JSON.stringify(response.json));
});

test('GET /api/admin/settings returns settings for admin users', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson('/api/admin/settings', { token });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.settings.pccOverride, null);
  assert.equal(response.json.settings.maintenanceMode, false);
  assert.equal(response.json.settings.maintenanceMessage, 'Scheduled maintenance is in progress. Some features may be temporarily unavailable.');
  assert.equal(response.json.settings.notificationSettings.round_submitted, true);
});

test('PATCH /api/admin/settings updates values and writes audit log', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson('/api/admin/settings', {
    method: 'PATCH',
    token,
    body: {
      pccOverride: 2,
      maintenanceMode: true,
      maintenanceMessage: 'Planned maintenance in progress. Round approvals may be delayed.',
      notificationSettings: {
        round_submitted: false,
        round_approved: true,
        maintenance_alerts: false,
      },
    },
  });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.settings.pccOverride, 2);
  assert.equal(response.json.settings.maintenanceMode, true);
  assert.equal(response.json.settings.maintenanceMessage, 'Planned maintenance in progress. Round approvals may be delayed.');
  assert.equal(response.json.settings.notificationSettings.round_submitted, false);
  assert.equal(response.json.settings.notificationSettings.maintenance_alerts, false);

  const settingsRow = await dbPool.query(
    `SELECT pcc_override, maintenance_mode, maintenance_message, notification_settings
     FROM system_settings
     WHERE id = 1`,
  );
  assert.equal(Number(settingsRow.rows[0].pcc_override), 2);
  assert.equal(Boolean(settingsRow.rows[0].maintenance_mode), true);
  assert.equal(settingsRow.rows[0].maintenance_message, 'Planned maintenance in progress. Round approvals may be delayed.');
  assert.equal(settingsRow.rows[0].notification_settings.round_submitted, false);

  const auditRow = await dbPool.query(
    `SELECT event_type, actor_user_id
     FROM audit_logs
     WHERE event_type = 'admin_system_settings_updated'
     ORDER BY created_at DESC
     LIMIT 1`,
  );
  assert.equal(auditRow.rows.length, 1);
  assert.equal(auditRow.rows[0].event_type, 'admin_system_settings_updated');
  assert.equal(auditRow.rows[0].actor_user_id, ADMIN_USER_ID);
});

test('PATCH /api/admin/settings validates pccOverride range', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson('/api/admin/settings', {
    method: 'PATCH',
    token,
    body: { pccOverride: 10 },
  });

  assert.equal(response.status, 400, JSON.stringify(response.json));
  assert.equal(response.json.error.code, 'validation_error');
});

test('GET /api/maintenance returns public maintenance state without auth', async () => {
  await dbPool.query(
    `UPDATE system_settings
     SET maintenance_mode = TRUE,
         maintenance_message = 'Maintenance banner message from admin settings.',
         updated_at = NOW()
     WHERE id = 1`,
  );

  const response = await requestJson('/api/maintenance');
  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.maintenanceMode, true);
  assert.equal(response.json.maintenanceMessage, 'Maintenance banner message from admin settings.');
});
