import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';

const ROOT_DIR = new URL('../../..', import.meta.url).pathname;
const API_PORT = 3926;
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

  return { status: response.status, json, headers: response.headers };
}

async function requestText(path, { method = 'GET', token } = {}) {
  const headers = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, { method, headers });
  const text = await response.text();
  return { status: response.status, text, headers: response.headers };
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

test('players export requires admin authentication', async () => {
  const response = await requestJson('/api/players/export?format=json');
  assert.equal(response.status, 401);
  assert.equal(response.json.error.code, 'unauthorized');
});

test('players export supports json/csv, respects filters, and excludes deleted by default', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();
  const searchToken = `export-${suffix}`;
  const club = `Export Club ${suffix}`;

  const p1 = await requestJson('/api/players', {
    method: 'POST',
    token,
    body: {
      first_name: 'Active',
      last_name: searchToken,
      club,
      country: 'GB',
      email: `active.${suffix}@example.com`,
      gender: 'male',
    },
  });

  const p2 = await requestJson('/api/players', {
    method: 'POST',
    token,
    body: {
      first_name: 'Deleted',
      last_name: searchToken,
      club,
      country: 'GB',
      email: `deleted.${suffix}@example.com`,
      gender: 'female',
    },
  });

  const p3 = await requestJson('/api/players', {
    method: 'POST',
    token,
    body: {
      first_name: 'Other',
      last_name: `other-${suffix}`,
      club: `Other Club ${suffix}`,
      country: 'US',
      email: `other.${suffix}@example.com`,
      gender: 'other',
    },
  });

  assert.equal(p1.status, 201);
  assert.equal(p2.status, 201);
  assert.equal(p3.status, 201);

  const idsToCleanup = [p1.json.player.id, p2.json.player.id, p3.json.player.id];

  try {
    const softDelete = await requestJson(`/api/players/${p2.json.player.id}`, { method: 'DELETE', token });
    assert.equal(softDelete.status, 200);

    const jsonDefault = await requestJson(
      `/api/players/export?format=json&club=${encodeURIComponent(club)}&country=GB&search=${encodeURIComponent(searchToken)}`,
      { token },
    );

    assert.equal(jsonDefault.status, 200);
    assert.equal(jsonDefault.json.format, 'json');
    assert.equal(jsonDefault.json.includeDeleted, false);
    assert.equal(Array.isArray(jsonDefault.json.players), true);
    assert.equal(jsonDefault.json.players.length, 1, 'deleted players should be excluded by default');

    const exportedActive = jsonDefault.json.players[0];
    for (const key of [
      'id',
      'first_name',
      'last_name',
      'middle_name',
      'dob',
      'gender',
      'club',
      'email',
      'country',
      'handicap_index',
      'user_id',
      'created_at',
      'updated_at',
      'deleted_at',
    ]) {
      assert.equal(Object.hasOwn(exportedActive, key), true, `missing exported field: ${key}`);
    }

    assert.equal(exportedActive.id, p1.json.player.id);

    const jsonWithDeleted = await requestJson(
      `/api/players/export?format=json&club=${encodeURIComponent(club)}&country=GB&search=${encodeURIComponent(searchToken)}&include_deleted=true`,
      { token },
    );

    assert.equal(jsonWithDeleted.status, 200);
    assert.equal(jsonWithDeleted.json.includeDeleted, true);

    const jsonIds = jsonWithDeleted.json.players.map((player) => player.id);
    assert.equal(jsonIds.includes(p1.json.player.id), true);
    assert.equal(jsonIds.includes(p2.json.player.id), true);
    assert.equal(jsonIds.includes(p3.json.player.id), false);

    const csvDefault = await requestText(
      `/api/players/export?format=csv&club=${encodeURIComponent(club)}&country=GB&search=${encodeURIComponent(searchToken)}`,
      { token },
    );

    assert.equal(csvDefault.status, 200);
    assert.equal((csvDefault.headers.get('content-type') || '').startsWith('text/csv'), true);
    assert.equal(csvDefault.text.includes('id,first_name,last_name,middle_name,dob,gender,club,email,country,handicap_index,user_id,created_at,updated_at,deleted_at'), true);
    assert.equal(csvDefault.text.includes(p1.json.player.id), true);
    assert.equal(csvDefault.text.includes(p2.json.player.id), false, 'deleted player should not be present without include_deleted');
  } finally {
    await cleanupPlayer(idsToCleanup[0], token);
    await cleanupPlayer(idsToCleanup[1], token);
    await cleanupPlayer(idsToCleanup[2], token);
  }
});
