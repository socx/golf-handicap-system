import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const require = createRequire(import.meta.url);
const { loadEnvFromRoot } = require('../../../scripts/db/load-env');
loadEnvFromRoot();

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

async function createTeeConfigWithHoles(token, courseId, holes, { courseRating, slopeRating } = {}) {
  const response = await requestJson(`/api/courses/${courseId}/configurations`, {
    method: 'POST',
    token,
    body: {
      name: 'Members',
      teeColour: 'White',
      courseRating,
      slopeRating,
      holes,
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return response.json;
}

async function createRound(token, payload) {
  const response = await requestJson('/api/rounds', {
    method: 'POST',
    token,
    body: payload,
  });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return response.json;
}

async function deleteRound(token, roundId) {
  return requestJson(`/api/rounds/${roundId}`, {
    method: 'DELETE',
    token,
  });
}

async function getHandicapEligibility(token, playerId) {
  return requestJson(`/api/handicap/eligibility/${playerId}`, {
    method: 'GET',
    token,
  });
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

test('POST /api/rounds calculates score differential for known WHS-style 18-hole and 9-hole examples', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerId = null;
  let course18Id = null;
  let course9Id = null;

  try {
    const player = await createPlayer(token, `${suffix}-diff`);
    playerId = player.id;

    const course18 = await createCourse(token, `${suffix}-diff-18`);
    course18Id = course18.id;
    const config18 = await createTeeConfigWithHoles(token, course18.id, buildEighteenHolesUniform(), {
      courseRating: 72,
      slopeRating: 120,
    });

    const scores18 = Array.from({ length: 18 }, (_, idx) => ({
      holeNumber: idx + 1,
      strokes: 5,
      putts: 2,
      gir: false,
      fairwayHit: false,
      inSand: false,
      penalties: 0,
    }));

    const response18 = await requestJson('/api/rounds', {
      method: 'POST',
      token,
      body: {
        playerId: player.id,
        teeConfigurationId: config18.id,
        playedAt: '2026-07-01T09:00:00.000Z',
        playingHandicap: 0,
        holeScores: scores18,
      },
    });

    assert.equal(response18.status, 201, JSON.stringify(response18.json));
    assert.equal(response18.json.round.adjustedGrossScore, 90);
    assert.equal(response18.json.round.flags.is9Hole, false);
    assert.equal(response18.json.round.pcc, 0);
    assert.equal(response18.json.round.scoreDifferential, 16.95);

    const course9 = await createCourse(token, `${suffix}-diff-9`);
    course9Id = course9.id;
    const config9 = await createTeeConfigWithHoles(token, course9.id, buildNineHolesUniform(), {
      courseRating: 36,
      slopeRating: 120,
    });

    const scores9 = Array.from({ length: 9 }, (_, idx) => ({
      holeNumber: idx + 1,
      strokes: 5,
      putts: 2,
      gir: false,
      fairwayHit: false,
      inSand: false,
      penalties: 0,
    }));

    const response9 = await requestJson('/api/rounds', {
      method: 'POST',
      token,
      body: {
        playerId: player.id,
        teeConfigurationId: config9.id,
        playedAt: '2026-07-02T09:00:00.000Z',
        playingHandicap: 0,
        holeScores: scores9,
      },
    });

    assert.equal(response9.status, 201, JSON.stringify(response9.json));
    assert.equal(response9.json.round.adjustedGrossScore, 45);
    assert.equal(response9.json.round.flags.is9Hole, true);
    assert.equal(response9.json.round.pcc, 0);
    assert.equal(response9.json.round.scoreDifferential, 8.475);
  } finally {
    if (playerId) {
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerId]);
    }
    if (course18Id) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [course18Id]);
    }
    if (course9Id) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [course9Id]);
    }
    if (playerId) {
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerId]);
    }
  }
});

test('PATCH /api/admin/tee-configurations/:id/pcc recalculates stored PCC and backfills round differentials', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerId = null;
  let courseId = null;
  let roundId = null;

  try {
    const player = await createPlayer(token, `${suffix}-pcc`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-pcc`);
    courseId = course.id;

    const config = await createTeeConfigWithHoles(token, course.id, buildEighteenHolesUniform(), {
      courseRating: 72,
      slopeRating: 120,
    });

    const createResponse = await requestJson('/api/rounds', {
      method: 'POST',
      token,
      body: {
        playerId: player.id,
        teeConfigurationId: config.id,
        playedAt: '2026-07-03T09:00:00.000Z',
        playingHandicap: 0,
        holeScores: Array.from({ length: 18 }, (_, idx) => ({
          holeNumber: idx + 1,
          strokes: 5,
          putts: 2,
          gir: false,
          fairwayHit: false,
          inSand: false,
          penalties: 0,
        })),
      },
    });

    assert.equal(createResponse.status, 201, JSON.stringify(createResponse.json));
    roundId = createResponse.json.round.id;
    assert.equal(createResponse.json.round.pcc, 0);
    assert.equal(createResponse.json.round.scoreDifferential, 16.95);

    const overrideResponse = await requestJson(`/api/admin/tee-configurations/${config.id}/pcc`, {
      method: 'PATCH',
      token,
      body: {
        playedOn: '2026-07-03',
        pcc: 2,
      },
    });

    assert.equal(overrideResponse.status, 200, JSON.stringify(overrideResponse.json));
    assert.equal(overrideResponse.json.dailyPcc.pcc, 2);
    assert.equal(overrideResponse.json.dailyPcc.source, 'override');
    assert.equal(overrideResponse.json.updatedRounds, 1);

    const getResponse = await requestJson(`/api/rounds/${roundId}`, {
      method: 'GET',
      token,
    });

    assert.equal(getResponse.status, 200, JSON.stringify(getResponse.json));
    assert.equal(getResponse.json.round.pcc, 2);
    assert.equal(getResponse.json.round.scoreDifferential, 15.067);
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

test('GET /api/rounds/:id returns round aggregates and hole scores', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerId = null;
  let courseId = null;
  let createdRoundId = null;

  try {
    const player = await createPlayer(token, `${suffix}-get`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-get`);
    courseId = course.id;

    const config = await createTeeConfigWithHoles(token, courseId, buildNineHolesUniform());
    const holeScores = buildNineHoleScores();

    const createResponse = await requestJson('/api/rounds', {
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

    assert.equal(createResponse.status, 201, JSON.stringify(createResponse.json));
    createdRoundId = createResponse.json.round.id;

    const getResponse = await requestJson(`/api/rounds/${createdRoundId}`, {
      method: 'GET',
      token,
    });

    assert.equal(getResponse.status, 200, JSON.stringify(getResponse.json));
    assert.equal(getResponse.json.round.id, createdRoundId);
    assert.equal(getResponse.json.round.grossScore, createResponse.json.round.grossScore);
    assert.equal(getResponse.json.round.adjustedGrossScore, createResponse.json.round.adjustedGrossScore);
    assert.deepEqual(getResponse.json.round.totals, createResponse.json.round.totals);
    assert.equal(getResponse.json.teeConfiguration.id, config.id);
    assert.equal(getResponse.json.teeConfiguration.courseId, course.id);
    assert.equal(getResponse.json.teeConfiguration.courseName, course.name);
    assert.equal(getResponse.json.teeConfiguration.name, 'Members');
    assert.equal(getResponse.json.teeConfiguration.teeColour, 'White');
    assert.equal(getResponse.json.teeConfiguration.holeCount, 9);
    assert.equal(getResponse.json.holeScores.length, 9);
    assert.equal(getResponse.json.holeScores[0].holeNumber, 1);
    assert.equal(getResponse.json.holeScores[8].holeNumber, 9);
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

test('GET /api/rounds/:id returns 404 for unknown rounds', async () => {
  const token = buildAdminToken();
  const unknownRoundId = '00000000-0000-4000-8000-000000000000';

  const response = await requestJson(`/api/rounds/${unknownRoundId}`, {
    method: 'GET',
    token,
  });

  assert.equal(response.status, 404);
  assert.equal(response.json.error.code, 'not_found');
});

test('GET /api/rounds filters by player/date and sorts by playedAt descending', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerOneId = null;
  let playerTwoId = null;
  let courseOneId = null;
  let courseTwoId = null;

  try {
    const playerOne = await createPlayer(token, `${suffix}-search-p1`);
    playerOneId = playerOne.id;
    const playerTwo = await createPlayer(token, `${suffix}-search-p2`);
    playerTwoId = playerTwo.id;

    const courseOne = await createCourse(token, `${suffix}-search-c1`);
    courseOneId = courseOne.id;
    const courseTwo = await createCourse(token, `${suffix}-search-c2`);
    courseTwoId = courseTwo.id;

    const configOne = await createTeeConfig(token, courseOne.id);
    const configTwo = await createTeeConfig(token, courseTwo.id);

    await createRound(token, {
      playerId: playerOne.id,
      teeConfigurationId: configOne.id,
      playedAt: '2026-05-01T10:00:00.000Z',
      holeScores: buildNineHoleScores(),
    });

    const roundTwo = await createRound(token, {
      playerId: playerOne.id,
      teeConfigurationId: configOne.id,
      playedAt: '2026-05-03T10:00:00.000Z',
      holeScores: buildNineHoleScores(),
    });

    const roundThree = await createRound(token, {
      playerId: playerOne.id,
      teeConfigurationId: configTwo.id,
      playedAt: '2026-05-04T10:00:00.000Z',
      holeScores: buildNineHoleScores(),
    });

    await createRound(token, {
      playerId: playerTwo.id,
      teeConfigurationId: configOne.id,
      playedAt: '2026-05-05T10:00:00.000Z',
      holeScores: buildNineHoleScores(),
    });

    const response = await requestJson(
      `/api/rounds?playerId=${playerOne.id}&from=2026-05-02&to=2026-05-04`,
      { method: 'GET', token },
    );

    assert.equal(response.status, 200, JSON.stringify(response.json));
    assert.equal(response.json.pagination.total, 2);
    assert.equal(response.json.rounds.length, 2);
    assert.equal(response.json.rounds[0].id, roundThree.round.id);
    assert.equal(response.json.rounds[1].id, roundTwo.round.id);
    assert.ok(response.json.rounds.every((round) => round.playerId === playerOne.id));
  } finally {
    if (playerOneId) {
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerOneId]);
    }
    if (playerTwoId) {
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerTwoId]);
    }
    if (courseOneId) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [courseOneId]);
    }
    if (courseTwoId) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [courseTwoId]);
    }
    if (playerOneId) {
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerOneId]);
    }
    if (playerTwoId) {
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerTwoId]);
    }
  }
});

test('GET /api/rounds filters by course and excludes soft-deleted rounds with pagination', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerOneId = null;
  let playerTwoId = null;
  let courseOneId = null;
  let courseTwoId = null;

  try {
    const playerOne = await createPlayer(token, `${suffix}-page-p1`);
    playerOneId = playerOne.id;
    const playerTwo = await createPlayer(token, `${suffix}-page-p2`);
    playerTwoId = playerTwo.id;

    const courseOne = await createCourse(token, `${suffix}-page-c1`);
    courseOneId = courseOne.id;
    const courseTwo = await createCourse(token, `${suffix}-page-c2`);
    courseTwoId = courseTwo.id;

    const configOne = await createTeeConfig(token, courseOne.id);
    const configTwo = await createTeeConfig(token, courseTwo.id);

    const roundOne = await createRound(token, {
      playerId: playerOne.id,
      teeConfigurationId: configOne.id,
      playedAt: '2026-05-01T09:00:00.000Z',
      holeScores: buildNineHoleScores(),
    });

    const roundTwo = await createRound(token, {
      playerId: playerTwo.id,
      teeConfigurationId: configOne.id,
      playedAt: '2026-05-06T09:00:00.000Z',
      holeScores: buildNineHoleScores(),
    });

    await createRound(token, {
      playerId: playerOne.id,
      teeConfigurationId: configTwo.id,
      playedAt: '2026-05-07T09:00:00.000Z',
      holeScores: buildNineHoleScores(),
    });

    await dbPool.query('UPDATE rounds SET deleted_at = NOW() WHERE id = $1', [roundOne.round.id]);

    const pageOne = await requestJson(
      `/api/rounds?courseId=${courseOne.id}&page=1&limit=1`,
      { method: 'GET', token },
    );

    assert.equal(pageOne.status, 200, JSON.stringify(pageOne.json));
    assert.equal(pageOne.json.pagination.page, 1);
    assert.equal(pageOne.json.pagination.limit, 1);
    assert.equal(pageOne.json.pagination.total, 1);
    assert.equal(pageOne.json.pagination.totalPages, 1);
    assert.equal(pageOne.json.rounds.length, 1);
    assert.equal(pageOne.json.rounds[0].id, roundTwo.round.id);
    assert.equal(pageOne.json.rounds[0].courseId, courseOne.id);
    assert.equal(pageOne.json.rounds[0].courseName, courseOne.name);
  } finally {
    if (playerOneId) {
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerOneId]);
    }
    if (playerTwoId) {
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerTwoId]);
    }
    if (courseOneId) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [courseOneId]);
    }
    if (courseTwoId) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [courseTwoId]);
    }
    if (playerOneId) {
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerOneId]);
    }
    if (playerTwoId) {
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerTwoId]);
    }
  }
});

test('DELETE /api/rounds/:id soft-deletes round, logs audit events, and excludes it from search', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerId = null;
  let courseId = null;
  let roundId = null;

  try {
    const player = await createPlayer(token, `${suffix}-delete`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-delete`);
    courseId = course.id;

    const config = await createTeeConfig(token, course.id);
    const created = await createRound(token, {
      playerId: player.id,
      teeConfigurationId: config.id,
      playedAt: '2026-06-10T09:00:00.000Z',
      holeScores: buildNineHoleScores(),
    });

    roundId = created.round.id;

    await dbPool.query('UPDATE rounds SET score_differential = $2 WHERE id = $1', [roundId, 11.7]);

    const deleteResponse = await deleteRound(token, roundId);

    assert.equal(deleteResponse.status, 200, JSON.stringify(deleteResponse.json));
    assert.equal(deleteResponse.json.message, 'Round deleted');
    assert.equal(deleteResponse.json.round.id, roundId);
    assert.equal(deleteResponse.json.handicapRecalculationRequested, true);
    assert.ok(deleteResponse.json.round.deletedAt);

    const deletedRoundResult = await dbPool.query('SELECT deleted_at FROM rounds WHERE id = $1', [roundId]);
    assert.equal(deletedRoundResult.rowCount, 1);
    assert.ok(deletedRoundResult.rows[0].deleted_at);

    const getResponse = await requestJson(`/api/rounds/${roundId}`, {
      method: 'GET',
      token,
    });
    assert.equal(getResponse.status, 404);

    const listResponse = await requestJson(`/api/rounds?playerId=${player.id}`, {
      method: 'GET',
      token,
    });
    assert.equal(listResponse.status, 200, JSON.stringify(listResponse.json));
    assert.equal(listResponse.json.pagination.total, 0);
    assert.equal(listResponse.json.rounds.length, 0);

    const auditResponse = await dbPool.query(
      `SELECT event_type, metadata
       FROM audit_logs
       WHERE event_type IN ('round_deleted', 'handicap_recalculation_requested')
         AND metadata->>'roundId' = $1
       ORDER BY created_at ASC`,
      [roundId],
    );

    assert.deepEqual(
      auditResponse.rows.map((row) => row.event_type),
      ['round_deleted', 'handicap_recalculation_requested'],
    );
    assert.equal(auditResponse.rows[1].metadata.reason, 'round_deleted');
  } finally {
    if (roundId) {
      await dbPool.query("DELETE FROM audit_logs WHERE event_type IN ('round_deleted', 'handicap_recalculation_requested') AND metadata->>'roundId' = $1", [roundId]);
    }
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

test('DELETE /api/rounds/:id returns 404 for unknown or already deleted rounds', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();
  const unknownRoundId = '00000000-0000-4000-8000-000000000000';

  let playerId = null;
  let courseId = null;
  let roundId = null;

  try {
    const unknownResponse = await deleteRound(token, unknownRoundId);
    assert.equal(unknownResponse.status, 404);
    assert.equal(unknownResponse.json.error.code, 'not_found');

    const player = await createPlayer(token, `${suffix}-delete-404`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-delete-404`);
    courseId = course.id;

    const config = await createTeeConfig(token, course.id);
    const created = await createRound(token, {
      playerId: player.id,
      teeConfigurationId: config.id,
      playedAt: '2026-06-11T09:00:00.000Z',
      holeScores: buildNineHoleScores(),
    });
    roundId = created.round.id;

    const firstDelete = await deleteRound(token, roundId);
    assert.equal(firstDelete.status, 200, JSON.stringify(firstDelete.json));

    const secondDelete = await deleteRound(token, roundId);
    assert.equal(secondDelete.status, 404);
    assert.equal(secondDelete.json.error.code, 'not_found');
  } finally {
    if (roundId) {
      await dbPool.query("DELETE FROM audit_logs WHERE event_type IN ('round_deleted', 'handicap_recalculation_requested') AND metadata->>'roundId' = $1", [roundId]);
    }
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

test('POST /api/handicap/calculate/:playerId applies WHS selection count, lowest differentials, 0.96 multiplier, and truncation', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerId = null;
  let courseId = null;

  try {
    const player = await createPlayer(token, `${suffix}-hcp-select`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-hcp-select`);
    courseId = course.id;

    const config = await createTeeConfigWithHoles(token, course.id, buildEighteenHolesUniform(), {
      courseRating: 72,
      slopeRating: 120,
    });

    const targetDifferentials = [12.3, 10.2, 9.8, 11.1, 8.7, 13.4, 7.6, 10.5, 9.1, 8.9];
    const createdRounds = [];

    for (let i = 0; i < targetDifferentials.length; i += 1) {
      const response = await requestJson('/api/rounds', {
        method: 'POST',
        token,
        body: {
          playerId: player.id,
          teeConfigurationId: config.id,
          playedAt: `2026-07-${String(10 + i).padStart(2, '0')}T09:00:00.000Z`,
          playingHandicap: 0,
          holeScores: Array.from({ length: 18 }, (_, idx) => ({
            holeNumber: idx + 1,
            strokes: 5,
            putts: 2,
            gir: false,
            fairwayHit: false,
            inSand: false,
            penalties: 0,
          })),
        },
      });

      assert.equal(response.status, 201, JSON.stringify(response.json));
      createdRounds.push(response.json.round.id);
    }

    for (let i = 0; i < createdRounds.length; i += 1) {
      await dbPool.query('UPDATE rounds SET score_differential = $2, pcc = 0 WHERE id = $1', [createdRounds[i], targetDifferentials[i]]);
    }

    const calculateResponse = await requestJson(`/api/handicap/calculate/${player.id}`, {
      method: 'POST',
      token,
    });

    assert.equal(calculateResponse.status, 200, JSON.stringify(calculateResponse.json));
    assert.equal(calculateResponse.json.eligibilityStatus, 'eligible');
    assert.equal(calculateResponse.json.roundsConsidered, 10);
    assert.equal(calculateResponse.json.selection.countUsed, 3);

    const selectedValues = calculateResponse.json.selection.selectedDifferentials.map((item) => item.value).sort((a, b) => a - b);
    assert.deepEqual(selectedValues, [7.6, 8.7, 8.9]);
    assert.equal(calculateResponse.json.selection.averageDifferential, 8.4);
    assert.equal(calculateResponse.json.selection.multiplier, 0.96);
    assert.equal(calculateResponse.json.handicapIndex, 8.0);

    const historyResult = await dbPool.query(
      'SELECT handicap_index FROM handicap_records WHERE player_id = $1 ORDER BY calculation_date DESC LIMIT 1',
      [player.id],
    );
    assert.equal(Number(historyResult.rowCount || 0), 1);
    assert.equal(Number(historyResult.rows[0].handicap_index), 8.0);
  } finally {
    if (playerId) {
      await dbPool.query('DELETE FROM handicap_records WHERE player_id = $1', [playerId]);
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

test('POST /api/handicap/calculate/:playerId supports 9-hole pairing rules', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerId = null;
  let courseId = null;

  try {
    const player = await createPlayer(token, `${suffix}-hcp-9hole`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-hcp-9hole`);
    courseId = course.id;

    const config = await createTeeConfigWithHoles(token, course.id, buildNineHolesUniform(), {
      courseRating: 36,
      slopeRating: 120,
    });

    const nineHoleDifferentials = [8.1, 8.3, 9.0, 8.8, 7.9, 8.0];
    const createdRounds = [];

    for (let i = 0; i < nineHoleDifferentials.length; i += 1) {
      const response = await requestJson('/api/rounds', {
        method: 'POST',
        token,
        body: {
          playerId: player.id,
          teeConfigurationId: config.id,
          playedAt: `2026-08-${String(10 + i).padStart(2, '0')}T09:00:00.000Z`,
          playingHandicap: 0,
          holeScores: Array.from({ length: 9 }, (_, idx) => ({
            holeNumber: idx + 1,
            strokes: 5,
            putts: 2,
            gir: false,
            fairwayHit: false,
            inSand: false,
            penalties: 0,
          })),
        },
      });

      assert.equal(response.status, 201, JSON.stringify(response.json));
      createdRounds.push(response.json.round.id);
    }

    for (let i = 0; i < createdRounds.length; i += 1) {
      await dbPool.query('UPDATE rounds SET score_differential = $2, pcc = 0 WHERE id = $1', [createdRounds[i], nineHoleDifferentials[i]]);
    }

    const calculateResponse = await requestJson(`/api/handicap/calculate/${player.id}`, {
      method: 'POST',
      token,
    });

    assert.equal(calculateResponse.status, 200, JSON.stringify(calculateResponse.json));
    assert.equal(calculateResponse.json.eligibilityStatus, 'eligible');
    assert.equal(calculateResponse.json.roundsConsidered, 3);
    assert.equal(calculateResponse.json.selection.countUsed, 1);

    const pairedItems = calculateResponse.json.effectiveDifferentials.filter((item) => item.source === 'paired_9_hole');
    assert.equal(pairedItems.length, 3);
    assert.ok(pairedItems.every((item) => item.roundIds.length === 2));
    assert.equal(calculateResponse.json.selection.selectedDifferentials.length, 1);
  } finally {
    if (playerId) {
      await dbPool.query('DELETE FROM handicap_records WHERE player_id = $1', [playerId]);
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

test('GET /api/handicap/eligibility/:playerId returns eligible holes with 9-hole pairing applied', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerId = null;
  let courseId = null;

  try {
    const player = await createPlayer(token, `${suffix}-eligibility`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-eligibility`);
    courseId = course.id;

    const config = await createTeeConfigWithHoles(token, course.id, buildNineHolesUniform(), {
      courseRating: 36,
      slopeRating: 120,
    });

    const createdRounds = [];

    for (let i = 0; i < 7; i += 1) {
      const response = await requestJson('/api/rounds', {
        method: 'POST',
        token,
        body: {
          playerId: player.id,
          teeConfigurationId: config.id,
          playedAt: `2026-09-${String(10 + i).padStart(2, '0')}T09:00:00.000Z`,
          playingHandicap: 0,
          holeScores: Array.from({ length: 9 }, (_, idx) => ({
            holeNumber: idx + 1,
            strokes: 5,
            putts: 2,
            gir: false,
            fairwayHit: false,
            inSand: false,
            penalties: 0,
          })),
        },
      });

      assert.equal(response.status, 201, JSON.stringify(response.json));
      createdRounds.push(response.json.round.id);
    }

    for (let i = 0; i < createdRounds.length; i += 1) {
      await dbPool.query('UPDATE rounds SET score_differential = $2, pcc = 0 WHERE id = $1', [createdRounds[i], 8 + i / 10]);
    }

    const eligibilityResponse = await getHandicapEligibility(token, player.id);

    assert.equal(eligibilityResponse.status, 200, JSON.stringify(eligibilityResponse.json));
    assert.equal(eligibilityResponse.json.eligibilityStatus, 'eligible');
    assert.equal(eligibilityResponse.json.totalEligibleHoles, 54);
    assert.equal(eligibilityResponse.json.minimumRequiredHoles, 54);
  } finally {
    if (playerId) {
      await dbPool.query('DELETE FROM handicap_records WHERE player_id = $1', [playerId]);
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

test('POST /api/handicap/calculate/:playerId returns insufficient_holes when fewer than 54 eligible holes', async () => {
  const token = buildAdminToken();
  const suffix = Date.now();

  let playerId = null;
  let courseId = null;

  try {
    const player = await createPlayer(token, `${suffix}-insufficient-holes`);
    playerId = player.id;

    const course = await createCourse(token, `${suffix}-insufficient-holes`);
    courseId = course.id;

    const config = await createTeeConfigWithHoles(token, course.id, buildNineHolesUniform(), {
      courseRating: 36,
      slopeRating: 120,
    });

    const createdRounds = [];

    for (let i = 0; i < 5; i += 1) {
      const response = await requestJson('/api/rounds', {
        method: 'POST',
        token,
        body: {
          playerId: player.id,
          teeConfigurationId: config.id,
          playedAt: `2026-10-${String(10 + i).padStart(2, '0')}T09:00:00.000Z`,
          playingHandicap: 0,
          holeScores: Array.from({ length: 9 }, (_, idx) => ({
            holeNumber: idx + 1,
            strokes: 5,
            putts: 2,
            gir: false,
            fairwayHit: false,
            inSand: false,
            penalties: 0,
          })),
        },
      });

      assert.equal(response.status, 201, JSON.stringify(response.json));
      createdRounds.push(response.json.round.id);
    }

    for (let i = 0; i < createdRounds.length; i += 1) {
      await dbPool.query('UPDATE rounds SET score_differential = $2, pcc = 0 WHERE id = $1', [createdRounds[i], 9 + i / 10]);
    }

    const calculateResponse = await requestJson(`/api/handicap/calculate/${player.id}`, {
      method: 'POST',
      token,
    });

    assert.equal(calculateResponse.status, 200, JSON.stringify(calculateResponse.json));
    assert.equal(calculateResponse.json.eligibilityStatus, 'insufficient_holes');
    assert.equal(calculateResponse.json.totalEligibleHoles, 36);
    assert.equal(calculateResponse.json.minimumRequiredHoles, 54);

    const historyResult = await dbPool.query('SELECT id FROM handicap_records WHERE player_id = $1', [player.id]);
    assert.equal(Number(historyResult.rowCount || 0), 0);
  } finally {
    if (playerId) {
      await dbPool.query('DELETE FROM handicap_records WHERE player_id = $1', [playerId]);
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
