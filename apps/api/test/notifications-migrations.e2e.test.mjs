import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const MIGRATION_PATH = path.join(ROOT_DIR, 'db/migrations/014_notification_preferences.sql');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db';

function makeSchemaName() {
  return `test_notifications_mig_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

test('migration 014 creates notification_preferences with defaults, FK, and user insert trigger', async () => {
  const sql = await fs.readFile(MIGRATION_PATH, 'utf8');
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  const schemaName = makeSchemaName();

  try {
    await client.query('BEGIN');

    await client.query(`CREATE SCHEMA ${schemaName}`);
    await client.query(`SET LOCAL search_path TO ${schemaName}, public`);

    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'player',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `);

    const existingUser = await client.query(
      `INSERT INTO users (email, role)
       VALUES ($1, 'player')
       RETURNING id`,
      [`existing-${Date.now()}@example.com`],
    );
    const existingUserId = existingUser.rows[0].id;

    await client.query(sql);

    const tableExists = await client.query(
      `SELECT to_regclass($1) AS regclass`,
      [`${schemaName}.notification_preferences`],
    );
    assert.ok(tableExists.rows[0].regclass);

    const columnRows = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'notification_preferences'
       ORDER BY ordinal_position`,
      [schemaName],
    );
    const columns = columnRows.rows.map((row) => row.column_name);

    for (const required of [
      'user_id',
      'handicap_updates_enabled',
      'round_submitted_enabled',
      'round_approved_enabled',
      'marketing_enabled',
      'created_at',
      'updated_at',
    ]) {
      assert.equal(columns.includes(required), true, `missing column ${required}`);
    }

    const backfilledPrefs = await client.query(
      `SELECT user_id, handicap_updates_enabled, round_submitted_enabled, round_approved_enabled, marketing_enabled
       FROM notification_preferences
       WHERE user_id = $1`,
      [existingUserId],
    );

    assert.equal(backfilledPrefs.rowCount, 1);
    assert.equal(backfilledPrefs.rows[0].handicap_updates_enabled, true);
    assert.equal(backfilledPrefs.rows[0].round_submitted_enabled, true);
    assert.equal(backfilledPrefs.rows[0].round_approved_enabled, true);
    assert.equal(backfilledPrefs.rows[0].marketing_enabled, false);

    const newUser = await client.query(
      `INSERT INTO users (email, role)
       VALUES ($1, 'player')
       RETURNING id`,
      [`new-${Date.now()}@example.com`],
    );

    const triggerPrefs = await client.query(
      `SELECT user_id
       FROM notification_preferences
       WHERE user_id = $1`,
      [newUser.rows[0].id],
    );
    assert.equal(triggerPrefs.rowCount, 1);

    const fkRows = await client.query(
      `SELECT conname
       FROM pg_constraint
       WHERE conname = 'notification_preferences_user_id_fkey'
         AND conrelid = 'notification_preferences'::regclass`,
    );
    assert.equal(fkRows.rowCount, 1);

    await client.query('ROLLBACK');

    const schemaStillExists = await client.query(
      `SELECT to_regnamespace($1) AS ns`,
      [schemaName],
    );
    assert.equal(schemaStillExists.rows[0].ns, null);
  } finally {
    try {
      await client.query('ROLLBACK');
    } catch {
      // no-op
    }
    client.release();
    await pool.end();
  }
});
