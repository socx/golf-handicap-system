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
const API_PORT = 3936;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

let apiProcess;
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db' });

function buildToken(sub, role = 'player') {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  return jwt.sign(
    { sub, role, tokenType: 'access' },
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
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('API did not become healthy in time');
}

async function ensureUser(userId, role, email) {
  await dbPool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = TRUE, deleted_at = NULL`,
    [userId, email, 'PENDING_PASSWORD_RESET', role],
  );
}

function buildNineHoles() {
  return Array.from({ length: 9 }, (_, idx) => ({
    holeNumber: idx + 1,
    distanceYards: 320 + idx,
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
    penalties: 0,
  }));
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
  if (apiProcess) {
    apiProcess.kill('SIGTERM');
    await new Promise((resolve) => {
      apiProcess.once('exit', () => resolve());
      setTimeout(() => resolve(), 1500);
    });
  }

  await dbPool.end();
});

test('player users can access own player profile/list but not other players', async () => {
  const suffix = Date.now();
  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const playerUserAId = '11111111-1111-4111-8111-111111111112';
  const playerUserBId = '11111111-1111-4111-8111-111111111113';

  const adminToken = buildToken(adminUserId, 'admin');
  const playerTokenA = buildToken(playerUserAId, 'player');

  await ensureUser(adminUserId, 'admin', `admin.scope.${suffix}@example.com`);
  await ensureUser(playerUserAId, 'player', `player.a.scope.${suffix}@example.com`);
  await ensureUser(playerUserBId, 'player', `player.b.scope.${suffix}@example.com`);

  let playerAId = null;
  let playerBId = null;

  try {
    const playerARes = await requestJson('/api/players', {
      method: 'POST',
      token: adminToken,
      body: {
        first_name: 'Player',
        last_name: `A-${suffix}`,
        country: 'GB',
        email: `player.a.profile.${suffix}@example.com`,
        user_id: playerUserAId,
      },
    });
    assert.equal(playerARes.status, 201, JSON.stringify(playerARes.json));
    playerAId = playerARes.json.player.id;

    const playerBRes = await requestJson('/api/players', {
      method: 'POST',
      token: adminToken,
      body: {
        first_name: 'Player',
        last_name: `B-${suffix}`,
        country: 'GB',
        email: `player.b.profile.${suffix}@example.com`,
        user_id: playerUserBId,
      },
    });
    assert.equal(playerBRes.status, 201, JSON.stringify(playerBRes.json));
    playerBId = playerBRes.json.player.id;

    const ownProfile = await requestJson(`/api/players/${playerAId}`, { token: playerTokenA });
    assert.equal(ownProfile.status, 200, JSON.stringify(ownProfile.json));
    assert.equal(ownProfile.json.player.id, playerAId);

    const ownList = await requestJson('/api/players', { token: playerTokenA });
    assert.equal(ownList.status, 200, JSON.stringify(ownList.json));
    assert.equal(ownList.json.players.length, 1);
    assert.equal(ownList.json.players[0].id, playerAId);

    const otherProfile = await requestJson(`/api/players/${playerBId}`, { token: playerTokenA });
    assert.equal(otherProfile.status, 403);
    assert.equal(otherProfile.json.error.code, 'forbidden');

    const adminList = await requestJson('/api/players', { token: adminToken });
    assert.equal(adminList.status, 200, JSON.stringify(adminList.json));
    assert.ok(adminList.json.players.some((p) => p.id === playerAId));
    assert.ok(adminList.json.players.some((p) => p.id === playerBId));
  } finally {
    if (playerAId) {
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerAId]);
      await dbPool.query('DELETE FROM handicap_records WHERE player_id = $1', [playerAId]);
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerAId]);
    }
    if (playerBId) {
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerBId]);
      await dbPool.query('DELETE FROM handicap_records WHERE player_id = $1', [playerBId]);
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerBId]);
    }
    await dbPool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUserId, playerUserAId, playerUserBId]);
  }
});

test('player users can access own rounds and handicap history/eligibility only', async () => {
  const suffix = Date.now();
  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const playerUserAId = '11111111-1111-4111-8111-111111111112';
  const playerUserBId = '11111111-1111-4111-8111-111111111113';

  const adminToken = buildToken(adminUserId, 'admin');
  const playerTokenA = buildToken(playerUserAId, 'player');

  await ensureUser(adminUserId, 'admin', `admin.rounds.${suffix}@example.com`);
  await ensureUser(playerUserAId, 'player', `player.a.rounds.${suffix}@example.com`);
  await ensureUser(playerUserBId, 'player', `player.b.rounds.${suffix}@example.com`);

  let playerAId = null;
  let playerBId = null;
  let courseId = null;
  let teeConfigId = null;
  let roundAId = null;
  let roundBId = null;

  try {
    const playerARes = await requestJson('/api/players', {
      method: 'POST',
      token: adminToken,
      body: {
        first_name: 'Rounds',
        last_name: `A-${suffix}`,
        country: 'GB',
        email: `player.a.rounds.${suffix}@example.com`,
        user_id: playerUserAId,
      },
    });
    assert.equal(playerARes.status, 201, JSON.stringify(playerARes.json));
    playerAId = playerARes.json.player.id;

    const playerBRes = await requestJson('/api/players', {
      method: 'POST',
      token: adminToken,
      body: {
        first_name: 'Rounds',
        last_name: `B-${suffix}`,
        country: 'GB',
        email: `player.b.rounds.${suffix}@example.com`,
        user_id: playerUserBId,
      },
    });
    assert.equal(playerBRes.status, 201, JSON.stringify(playerBRes.json));
    playerBId = playerBRes.json.player.id;

    const courseRes = await requestJson('/api/courses', {
      method: 'POST',
      token: adminToken,
      body: {
        name: `Scope Course ${suffix}`,
        city: 'Test City',
        country: 'GB',
      },
    });
    assert.equal(courseRes.status, 201, JSON.stringify(courseRes.json));
    courseId = courseRes.json.id;

    const teeRes = await requestJson(`/api/courses/${courseId}/configurations`, {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Members',
        teeColour: 'White',
        holes: buildNineHoles(),
      },
    });
    assert.equal(teeRes.status, 201, JSON.stringify(teeRes.json));
    teeConfigId = teeRes.json.id;

    const roundARes = await requestJson('/api/rounds', {
      method: 'POST',
      token: adminToken,
      body: {
        playerId: playerAId,
        teeConfigurationId: teeConfigId,
        playedAt: '2026-06-01T09:00:00.000Z',
        holeScores: buildNineHoleScores(),
      },
    });
    assert.equal(roundARes.status, 201, JSON.stringify(roundARes.json));
    roundAId = roundARes.json.round.id;

    const roundBRes = await requestJson('/api/rounds', {
      method: 'POST',
      token: adminToken,
      body: {
        playerId: playerBId,
        teeConfigurationId: teeConfigId,
        playedAt: '2026-06-02T09:00:00.000Z',
        holeScores: buildNineHoleScores(),
      },
    });
    assert.equal(roundBRes.status, 201, JSON.stringify(roundBRes.json));
    roundBId = roundBRes.json.round.id;

    await requestJson(`/api/rounds/${roundAId}/approve`, { method: 'POST', token: adminToken });
    await requestJson(`/api/rounds/${roundBId}/approve`, { method: 'POST', token: adminToken });

    await dbPool.query(
      `INSERT INTO handicap_records
       (player_id, handicap_index, num_differentials, average_differential, differentials_used, rounds_used, pcc_values, cap_adjustments)
       VALUES ($1, 12.3, 3, 12.111, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb),
              ($2, 9.5, 3, 9.111, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb)`,
      [playerAId, playerBId],
    );

    const ownRounds = await requestJson('/api/rounds', { token: playerTokenA });
    assert.equal(ownRounds.status, 200, JSON.stringify(ownRounds.json));
    assert.equal(ownRounds.json.rounds.length, 1);
    assert.equal(ownRounds.json.rounds[0].playerId, playerAId);

    const ownRoundDetail = await requestJson(`/api/rounds/${roundAId}`, { token: playerTokenA });
    assert.equal(ownRoundDetail.status, 200, JSON.stringify(ownRoundDetail.json));
    assert.equal(ownRoundDetail.json.round.id, roundAId);

    const otherRoundDetail = await requestJson(`/api/rounds/${roundBId}`, { token: playerTokenA });
    assert.equal(otherRoundDetail.status, 403);
    assert.equal(otherRoundDetail.json.error.code, 'forbidden');

    const ownEligibility = await requestJson(`/api/handicap/eligibility/${playerAId}`, { token: playerTokenA });
    assert.equal(ownEligibility.status, 200, JSON.stringify(ownEligibility.json));
    assert.equal(ownEligibility.json.playerId, playerAId);

    const ownHistory = await requestJson(`/api/handicap/history/${playerAId}`, { token: playerTokenA });
    assert.equal(ownHistory.status, 200, JSON.stringify(ownHistory.json));
    assert.equal(ownHistory.json.playerId, playerAId);

    const otherEligibility = await requestJson(`/api/handicap/eligibility/${playerBId}`, { token: playerTokenA });
    assert.equal(otherEligibility.status, 403);
    assert.equal(otherEligibility.json.error.code, 'forbidden');

    const otherHistory = await requestJson(`/api/handicap/history/${playerBId}`, { token: playerTokenA });
    assert.equal(otherHistory.status, 403);
    assert.equal(otherHistory.json.error.code, 'forbidden');

    const adminRounds = await requestJson('/api/rounds', { token: adminToken });
    assert.equal(adminRounds.status, 200, JSON.stringify(adminRounds.json));
    const adminPlayers = new Set(adminRounds.json.rounds.map((r) => r.playerId));
    assert.ok(adminPlayers.has(playerAId));
    assert.ok(adminPlayers.has(playerBId));
  } finally {
    if (playerAId) {
      await dbPool.query('DELETE FROM handicap_records WHERE player_id = $1', [playerAId]);
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerAId]);
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerAId]);
    }
    if (playerBId) {
      await dbPool.query('DELETE FROM handicap_records WHERE player_id = $1', [playerBId]);
      await dbPool.query('DELETE FROM rounds WHERE player_id = $1', [playerBId]);
      await dbPool.query('DELETE FROM players WHERE id = $1', [playerBId]);
    }
    if (teeConfigId) {
      await dbPool.query('DELETE FROM tee_configurations WHERE id = $1', [teeConfigId]);
    }
    if (courseId) {
      await dbPool.query('DELETE FROM courses WHERE id = $1', [courseId]);
    }
    await dbPool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUserId, playerUserAId, playerUserBId]);
  }
});
