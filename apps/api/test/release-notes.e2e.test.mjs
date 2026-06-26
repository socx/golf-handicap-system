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
const API_PORT = 3943;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;
const ADMIN_USER_ID = 'aaaab010-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

let apiProcess;
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

function buildToken(role = 'admin', sub = ADMIN_USER_ID) {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign({ sub, role, tokenType: 'access' }, secret, { expiresIn: '30m' });
}

async function requestJson(path, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
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
    `ALTER TABLE system_settings
     ADD COLUMN IF NOT EXISTS release_notes_markdown TEXT NOT NULL DEFAULT E'# What''s New\n\n## Initial Release\n- Dashboard analytics improvements\n- Handicap override tools\n- Maintenance banner support\n'`,
  );

  await dbPool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active, deleted_at)
     VALUES ($1, 'release-notes-admin@example.test', 'seed-hash', 'admin', TRUE, NULL)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email, role = EXCLUDED.role,
           is_active = EXCLUDED.is_active, deleted_at = EXCLUDED.deleted_at,
           updated_at = NOW()`,
    [ADMIN_USER_ID],
  );

  await dbPool.query(
    `INSERT INTO system_settings (id, release_notes_markdown)
     VALUES (1, E'# What''s New\n\n## Initial Release\n- Dashboard analytics improvements\n')
     ON CONFLICT (id) DO UPDATE
       SET release_notes_markdown = EXCLUDED.release_notes_markdown,
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
  await dbPool.query('DELETE FROM users WHERE id = $1', [ADMIN_USER_ID]);
  await dbPool.end();
});

test('GET /api/release-notes returns public markdown content', async () => {
  const response = await requestJson('/api/release-notes');
  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.match(response.json.markdown, /# What's New/);
});

test('PATCH /api/admin/release-notes updates markdown for admins', async () => {
  const token = buildToken('admin', ADMIN_USER_ID);
  const response = await requestJson('/api/admin/release-notes', {
    method: 'PATCH',
    token,
    body: {
      markdown: '# What\'s New\n\n## June Update\n- Added maintenance banner\n- Improved dashboard stats',
    },
  });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.match(response.json.markdown, /June Update/);

  const persisted = await dbPool.query('SELECT release_notes_markdown FROM system_settings WHERE id = 1');
  assert.match(persisted.rows[0].release_notes_markdown, /June Update/);
});
