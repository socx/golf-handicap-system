import { test } from 'node:test';
import assert from 'node:assert';
import { dbPool } from '../db.js';
import { testUser } from '../testHelpers.js';

const API_URL = 'http://localhost:3000';

test('Navigation visibility E2E tests', async (t) => {
  // Clean up test users
  await dbPool.query('DELETE FROM users WHERE email LIKE ?', ['%test-nav%']);

  await t.test('Admin users should see admin navigation items', async () => {
    // Create admin user
    const adminUser = await testUser.create(
      'admin-test-nav@club.local',
      'password123',
      'admin'
    );

    // Login as admin
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin-test-nav@club.local',
        password: 'password123',
      }),
    });

    const { tokens } = await loginRes.json();
    assert.strictEqual(loginRes.status, 200);
    assert.ok(tokens.accessToken);

    // Fetch user profile
    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    const { user } = await meRes.json();
    assert.strictEqual(user.role, 'admin');

    // Clean up
    await dbPool.query('DELETE FROM users WHERE id = ?', [adminUser.id]);
  });

  await t.test('Player users should not see admin navigation items', async () => {
    // Create player user
    const playerUser = await testUser.create(
      'player-test-nav@club.local',
      'password123',
      'player'
    );

    // Login as player
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'player-test-nav@club.local',
        password: 'password123',
      }),
    });

    const { tokens } = await loginRes.json();
    assert.strictEqual(loginRes.status, 200);
    assert.ok(tokens.accessToken);

    // Fetch user profile
    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    const { user } = await meRes.json();
    assert.strictEqual(user.role, 'player');

    // Clean up
    await dbPool.query('DELETE FROM users WHERE id = ?', [playerUser.id]);
  });

  await t.test('Viewer users should have limited navigation', async () => {
    // Create viewer user
    const viewerUser = await testUser.create(
      'viewer-test-nav@club.local',
      'password123',
      'viewer'
    );

    // Login as viewer
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'viewer-test-nav@club.local',
        password: 'password123',
      }),
    });

    const { tokens } = await loginRes.json();
    assert.strictEqual(loginRes.status, 200);
    assert.ok(tokens.accessToken);

    // Fetch user profile
    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    const { user } = await meRes.json();
    assert.strictEqual(user.role, 'viewer');

    // Clean up
    await dbPool.query('DELETE FROM users WHERE id = ?', [viewerUser.id]);
  });
});
