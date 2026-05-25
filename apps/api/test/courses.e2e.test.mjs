import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';

const ROOT_DIR = new URL('../../..', import.meta.url).pathname;
const API_PORT = 3925;
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

async function cleanupCourse(courseId, token) {
  if (!courseId) return;
  await requestJson(`/api/courses/${courseId}`, { method: 'DELETE', token });
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

test('courses flow 1: create many, list, get one, delete one, list excludes deleted', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  const c1 = await requestJson('/api/courses', {
    method: 'POST',
    token,
    body: {
      name: `E2E Flow1 A ${suffix}`,
      city: 'Flow City A',
      country: 'US',
    },
  });
  const c2 = await requestJson('/api/courses', {
    method: 'POST',
    token,
    body: {
      name: `E2E Flow1 B ${suffix}`,
      city: 'Flow City B',
      country: 'GB',
    },
  });
  const c3 = await requestJson('/api/courses', {
    method: 'POST',
    token,
    body: {
      name: `E2E Flow1 C ${suffix}`,
      city: 'Flow City C',
      country: 'IE',
    },
  });

  assert.equal(c1.status, 201);
  assert.equal(c2.status, 201);
  assert.equal(c3.status, 201);

  const createdIds = [c1.json.id, c2.json.id, c3.json.id];

  try {
    const list1 = await requestJson('/api/courses?limit=200');
    assert.equal(list1.status, 200);

    const listedIds = (list1.json.courses || []).map((course) => course.id);
    for (const id of createdIds) {
      assert.equal(listedIds.includes(id), true, `created course should be in list: ${id}`);
    }

    const targetId = c2.json.id;
    const getOne = await requestJson(`/api/courses/${targetId}`);
    assert.equal(getOne.status, 200);
    assert.equal(getOne.json.id, targetId);
    assert.equal(getOne.json.name, c2.json.name);

    const delOne = await requestJson(`/api/courses/${targetId}`, { method: 'DELETE', token });
    assert.equal(delOne.status, 200);
    assert.equal(delOne.json.message, 'Course deleted');

    const list2 = await requestJson('/api/courses?limit=200');
    assert.equal(list2.status, 200);

    const listedIds2 = (list2.json.courses || []).map((course) => course.id);
    assert.equal(listedIds2.includes(targetId), false, 'deleted course should not appear in list');
    assert.equal(listedIds2.includes(c1.json.id), true, 'non-deleted course should remain in list');
    assert.equal(listedIds2.includes(c3.json.id), true, 'non-deleted course should remain in list');

    createdIds.splice(createdIds.indexOf(targetId), 1);
  } finally {
    await cleanupCourse(createdIds[0], token);
    await cleanupCourse(createdIds[1], token);
  }
});

test('courses flow 2: create, verify, update partial fields, verify only intended changes', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  const createResp = await requestJson('/api/courses', {
    method: 'POST',
    token,
    body: {
      name: `E2E Flow2 ${suffix}`,
      address: '1 Original Lane',
      city: 'Original City',
      country: 'US',
      phone: '+1-555-0101',
      email: 'flow2@example.com',
      website: 'https://flow2.example.com',
    },
  });

  assert.equal(createResp.status, 201);
  const courseId = createResp.json.id;

  try {
    const getBefore = await requestJson(`/api/courses/${courseId}`);
    assert.equal(getBefore.status, 200);
    assert.equal(getBefore.json.name, createResp.json.name);
    assert.equal(getBefore.json.address, createResp.json.address);
    assert.equal(getBefore.json.city, createResp.json.city);
    assert.equal(getBefore.json.country, createResp.json.country);
    assert.equal(getBefore.json.phone, createResp.json.phone);
    assert.equal(getBefore.json.email, createResp.json.email);
    assert.equal(getBefore.json.website, createResp.json.website);

    const patchResp = await requestJson(`/api/courses/${courseId}`, {
      method: 'PATCH',
      token,
      body: {
        city: 'Updated City',
        phone: '+1-555-9999',
        website: null,
      },
    });

    assert.equal(patchResp.status, 200);
    assert.equal(patchResp.json.city, 'Updated City');
    assert.equal(patchResp.json.phone, '+1-555-9999');
    assert.equal(patchResp.json.website, null);

    const getAfter = await requestJson(`/api/courses/${courseId}`);
    assert.equal(getAfter.status, 200);

    assert.equal(getAfter.json.name, createResp.json.name, 'name should remain unchanged');
    assert.equal(getAfter.json.address, createResp.json.address, 'address should remain unchanged');
    assert.equal(getAfter.json.country, createResp.json.country, 'country should remain unchanged');
    assert.equal(getAfter.json.email, createResp.json.email, 'email should remain unchanged');

    assert.equal(getAfter.json.city, 'Updated City');
    assert.equal(getAfter.json.phone, '+1-555-9999');
    assert.equal(getAfter.json.website, null);
  } finally {
    await cleanupCourse(courseId, token);
  }
});
