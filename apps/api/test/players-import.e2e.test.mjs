import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);
const { loadEnvFromRoot } = require('../../../scripts/db/load-env');
loadEnvFromRoot();

const ROOT_DIR = new URL('../../..', import.meta.url).pathname;
const API_PORT = 3927;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

let apiProcess;

function buildAdminToken() {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign(
    { sub: '11111111-1111-4111-8111-111111111111', role: 'admin', tokenType: 'access' },
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

async function cleanupPlayer(playerId, token) {
  if (!playerId) return;
  await requestJson(`/api/players/${playerId}`, { method: 'DELETE', token });
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

after(async () => {
  if (!apiProcess) return;
  apiProcess.kill('SIGTERM');
  await new Promise((resolve) => {
    apiProcess.once('exit', () => resolve());
    setTimeout(() => resolve(), 1500);
  });
});

test('player import requires admin authentication', async () => {
  const response = await requestJson('/api/players/import', {
    method: 'POST',
    body: { csvText: 'name,dob,gender,club\nExample Player,1990-01-01,male,Import Club', dryRun: true },
  });

  assert.equal(response.status, 401);
  assert.equal(response.json.error.code, 'unauthorized');
});

test('player import supports dry run validation and importing valid rows', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();
  const club = `Import Club ${suffix}`;
  const cleanupIds = [];

  const dryRunCsv = [
    'name,dob,gender,club,email,country',
    `Jane Example,1991-06-15,female,${club},import.${suffix}@example.com,GB`,
    `Solo,1990-14-99,unknown,${club},not-an-email-${suffix},USA`,
  ].join('\n');

  const dryRunResponse = await requestJson('/api/players/import', {
    method: 'POST',
    token,
    body: { csvText: dryRunCsv, dryRun: true },
  });

  assert.equal(dryRunResponse.status, 200);
  assert.equal(dryRunResponse.json.dryRun, true);
  assert.equal(dryRunResponse.json.summary.rowCount, 2);
  assert.equal(dryRunResponse.json.summary.validRows, 1);
  assert.equal(dryRunResponse.json.summary.invalidRows, 1);
  assert.equal(dryRunResponse.json.rows[0].values.first_name, 'Jane');
  assert.equal(dryRunResponse.json.rows[0].values.last_name, 'Example');
  assert.equal(dryRunResponse.json.rows[1].issues.length >= 3, true);

  const importCsv = [
    'name,dob,gender,club,email,country',
    `Imported ${suffix} One,1988-04-10,male,${club},one.${suffix}@example.com,GB`,
    `Imported ${suffix} Two,1992-09-21,female,${club},two.${suffix}@example.com,US`,
  ].join('\n');

  const importResponse = await requestJson('/api/players/import', {
    method: 'POST',
    token,
    body: { csvText: importCsv, dryRun: false },
  });

  assert.equal(importResponse.status, 201);
  assert.equal(importResponse.json.dryRun, false);
  assert.equal(importResponse.json.summary.importedRows, 2);
  assert.equal(importResponse.json.players.length, 2);

  cleanupIds.push(...importResponse.json.players.map((player) => player.id));

  try {
    const listResponse = await requestJson(`/api/players?search=${encodeURIComponent(`Imported ${suffix}`)}`, { token });
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.json.players.length >= 2, true);
  } finally {
    await Promise.all(cleanupIds.map((playerId) => cleanupPlayer(playerId, token)));
  }
});
