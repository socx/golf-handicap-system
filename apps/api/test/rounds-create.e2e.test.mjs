import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;

const ROOT_DIR = new URL('../../..', import.meta.url).pathname;
const API_PORT = 3935;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db';

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
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  return { status: response.status, json };
}

function buildNineHoles() {
  return Array.from({ length: 9 }, (_, idx) => ({
    holeNumber: idx + 1,
    distanceYards: 300 + idx * 10,
    par: idx % 3 === 0 ? 5 : 4,
    strokeIndex: idx + 1,
  }));
}

function buildNineHolesUniform() {
  return Array.from({ length: 9 }, (_, idx) => ({
    holeNumber: idx + 1,
    distanceYards: 300 + idx * 10,
    par: 4,
    strokeIndex: idx + 1,
  }));
}

function buildEighteenHolesUniform() {
  return Array.from({ length: 18 }, (_, idx) => ({
    holeNumber: idx + 1,
    distanceYards: 320 + idx * 5,
    par: 4,
    strokeIndex: idx + 1,
  }));
}

function buildNineHoleScores() {
  return Array.from({ length: 9 }, (_, idx) => ({
    holeNumber: idx + 1,
    strokes: 4 + (idx % 2),
    putts: 2,
    gir: idx % 2 === 0,
    fairwayHit: idx % 2 === 1,
    inSand: false,
    penalties: idx % 4 === 0 ? 1 : 0,
  }));
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

async function createPlayer(token, suffix) {
  const response = await requestJson('/api/players', {
    method: 'POST',
    token,
    body: {
      first_name: `Round-${suffix}`,
      last_name: 'Player',
      country: 'GB',
      email: `round.player.${suffix}@ghs.local`,
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return response.json.player;
}

async function createCourse(token, suffix) {
  const response = await requestJson('/api/courses', {
    method: 'POST',
    token,
    body: {
      name: `Round Test Course ${suffix}`,
      city: 'Test City',
      country: 'GB',
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return response.json;
}

async function createTeeConfig(token, courseId) {
  return createTeeConfigWithHoles(token, courseId, buildNineHoles());
}

async function createTeeConfigWithHoles(token, courseId, holes) {
  const response = await requestJson(`/api/courses/${courseId}/configurations`, {
    method: 'POST',
    token,
    body: {
      name: 'Members',
      teeColour: 'White',
      holes,
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return response.json;
}

before(async () => {
  dbPool = new Pool({ connectionString: DATABASE_URL });

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
    apiProcess.kill('SIGTERM');
    await new Promise((resolve) => {
      apiProcess.once('exit', () => resolve());
      setTimeout(() => resolve(), 1500);
    });
  }
  if (dbPool) {
    await dbPool.end();
  }
});

test('POST /api/rounds requires authorization', async () => {
  const response = await requestJson('/api/rounds', {
    method: 'POST',
    body: {
      playerId: '11111111-1111-4111-8111-111111111111',
      teeConfigurationId: '22222222-2222-4222-8222-222222222222',
      playedAt: new Date().toISOString(),
      holeScores: buildNineHoleScores(),
    },
  });

  assert.equal(response.status, 401);
  assert.equal(response.json.error.code, 'unauthorized');
});

test('POST /api/rounds validates holeScores length against tee configuration hole_count', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerId = null;
  let courseId = null;

  try {
    const player = await createPlayer(token, `${suffix}-len`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-len`);
    courseId = course.id;

    const config = await createTeeConfig(token, courseId);

    const response = await requestJson('/api/rounds', {
      method: 'POST',
      token,
      body: {
        playerId: player.id,
        teeConfigurationId: config.id,
        playedAt: new Date().toISOString(),
        holeScores: buildNineHoleScores().slice(0, 8),
      },
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.error.code, 'validation_error');
    assert.match(response.json.error.message, /holeScores length/i);

    // Ensure no row was inserted into rounds on validation failure.
    const countResult = await dbPool.query(
      'SELECT COUNT(*)::int AS total FROM rounds WHERE player_id = $1',
      [player.id],
    );
    assert.equal(countResult.rows[0].total, 0);
  } finally {
    if (playerId) {
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerId]);
    }
    if (courseId) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [courseId]);
    }
    if (playerId) {
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerId]);
    }
  }
});

test('POST /api/rounds stores round + hole scores transactionally and returns totals', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let roundId = null;
  let playerId = null;
  let courseId = null;

  try {
    const player = await createPlayer(token, `${suffix}-ok`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-ok`);
    courseId = course.id;

    const config = await createTeeConfig(token, courseId);
    const holeScores = buildNineHoleScores();

    const response = await requestJson('/api/rounds', {
      method: 'POST',
      token,
      body: {
        playerId: player.id,
        teeConfigurationId: config.id,
        playedAt: new Date().toISOString(),
        playingHandicap: 12.4,
        holeScores,
      },
    });

    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(response.json.round.playerId, player.id);
    assert.equal(response.json.round.teeConfigurationId, config.id);
    assert.equal(response.json.round.playingHandicap, 12.4);
    assert.equal(response.json.round.flags.is9Hole, true);

    const expectedGross = holeScores.reduce((sum, hole) => sum + hole.strokes, 0);
    const expectedPutts = holeScores.reduce((sum, hole) => sum + hole.putts, 0);
    const expectedGir = holeScores.reduce((sum, hole) => sum + (hole.gir ? 1 : 0), 0);
    const expectedFairways = holeScores.reduce((sum, hole) => sum + (hole.fairwayHit ? 1 : 0), 0);
    const expectedPenalties = holeScores.reduce((sum, hole) => sum + hole.penalties, 0);

    assert.equal(response.json.round.grossScore, expectedGross);
    assert.equal(response.json.round.adjustedGrossScore, expectedGross);
    assert.equal(response.json.round.totals.putts, expectedPutts);
    assert.equal(response.json.round.totals.gir, expectedGir);
    assert.equal(response.json.round.totals.fairwaysHit, expectedFairways);
    assert.equal(response.json.round.totals.penalties, expectedPenalties);

    assert.equal(Array.isArray(response.json.holeScores), true);
    assert.equal(response.json.holeScores.length, 9);
    assert.equal(response.json.holeScores[0].holeNumber, 1);
    assert.equal(response.json.holeScores[8].holeNumber, 9);

    roundId = response.json.round.id;

    const dbRound = await dbPool.query('SELECT id FROM rounds WHERE id = $1', [roundId]);
    assert.equal(dbRound.rowCount, 1);

    const dbHoleScores = await dbPool.query('SELECT COUNT(*)::int AS total FROM hole_scores WHERE round_id = $1', [roundId]);
    assert.equal(dbHoleScores.rows[0].total, 9);
  } finally {
    if (playerId) {
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerId]);
    }
    if (courseId) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [courseId]);
    }
    if (playerId) {
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerId]);
    }
  }
});

test('POST /api/rounds computes net double bogey adjusted scores for 9-hole rounds', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerId = null;
  let courseId = null;

  try {
    const player = await createPlayer(token, `${suffix}-ndb9`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-ndb9`);
    courseId = course.id;

    const config = await createTeeConfigWithHoles(token, courseId, buildNineHolesUniform());

    const holeScores = Array.from({ length: 9 }, (_, idx) => ({
      holeNumber: idx + 1,
      strokes: 10,
      putts: 2,
      gir: false,
      fairwayHit: false,
      inSand: false,
      penalties: 0,
      // Ensure server ignores any client-provided adjusted value.
      netDoubleBogeyAdjusted: 1,
    }));

    const response = await requestJson('/api/rounds', {
      method: 'POST',
      token,
      body: {
        playerId: player.id,
        teeConfigurationId: config.id,
        playedAt: new Date().toISOString(),
        playingHandicap: 12.4,
        holeScores,
      },
    });

    assert.equal(response.status, 201, JSON.stringify(response.json));

    const expectedAdjustedByHole = [8, 8, 8, 7, 7, 7, 7, 7, 7];
    const adjustedFromResponse = response.json.holeScores.map((row) => row.netDoubleBogeyAdjusted);
    assert.deepEqual(adjustedFromResponse, expectedAdjustedByHole);
    assert.equal(response.json.round.adjustedGrossScore, expectedAdjustedByHole.reduce((sum, n) => sum + n, 0));
  } finally {
    if (playerId) {
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerId]);
    }
    if (courseId) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [courseId]);
    }
    if (playerId) {
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerId]);
    }
  }
});

test('POST /api/rounds supports 18-hole net double bogey with plus handicap edge case', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerId = null;
  let courseId = null;

  try {
    const player = await createPlayer(token, `${suffix}-ndb18`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-ndb18`);
    courseId = course.id;

    const config = await createTeeConfigWithHoles(token, courseId, buildEighteenHolesUniform());

    const holeScores = Array.from({ length: 18 }, (_, idx) => ({
      holeNumber: idx + 1,
      strokes: 7,
      putts: 2,
      gir: false,
      fairwayHit: false,
      inSand: false,
      penalties: 0,
    }));

    const response = await requestJson('/api/rounds', {
      method: 'POST',
      token,
      body: {
        playerId: player.id,
        teeConfigurationId: config.id,
        playedAt: new Date().toISOString(),
        playingHandicap: -2,
        holeScores,
      },
    });

    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(response.json.round.flags.is9Hole, false);

    const adjustedByHole = response.json.holeScores.map((row) => row.netDoubleBogeyAdjusted);
    assert.equal(adjustedByHole[16], 5); // SI 17
    assert.equal(adjustedByHole[17], 5); // SI 18
    assert.ok(adjustedByHole.slice(0, 16).every((value) => value === 6));
    assert.equal(response.json.round.adjustedGrossScore, 106);
  } finally {
    if (playerId) {
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerId]);
    }
    if (courseId) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [courseId]);
    }
    if (playerId) {
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerId]);
    }
  }
});
