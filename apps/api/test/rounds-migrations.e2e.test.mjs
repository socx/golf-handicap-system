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
const MIGRATION_PATH = path.join(ROOT_DIR, 'db/migrations/009_rounds_and_hole_scores.sql');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db';

function makeSchemaName() {
  return `test_rounds_mig_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

test('migration 009 creates rounds + hole_scores schema, constraints, and indexes; rollback is clean', async () => {
  const sql = await fs.readFile(MIGRATION_PATH, 'utf8');
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  const schemaName = makeSchemaName();

  try {
    await client.query('BEGIN');

    await client.query(`CREATE SCHEMA ${schemaName}`);
    await client.query(`SET LOCAL search_path TO ${schemaName}, public`);

    await client.query(`
      CREATE TABLE players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
    `);

    await client.query(`
      CREATE TABLE tee_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
    `);

    await client.query(sql);

    const roundsExists = await client.query(
      `SELECT to_regclass($1) AS regclass`,
      [`${schemaName}.rounds`],
    );
    assert.ok(roundsExists.rows[0].regclass);

    const holeScoresExists = await client.query(
      `SELECT to_regclass($1) AS regclass`,
      [`${schemaName}.hole_scores`],
    );
    assert.ok(holeScoresExists.rows[0].regclass);

    const uniqueHolePerRound = await client.query(
      `SELECT 1
       FROM pg_indexes
       WHERE schemaname = $1
         AND tablename = 'hole_scores'
         AND indexname = 'idx_hole_scores_round_hole_unique'`,
      [schemaName],
    );
    assert.equal(uniqueHolePerRound.rowCount, 1);

    const playerDateIndex = await client.query(
      `SELECT 1
       FROM pg_indexes
       WHERE schemaname = $1
         AND tablename = 'rounds'
         AND indexname = 'idx_rounds_player_played_at'`,
      [schemaName],
    );
    assert.equal(playerDateIndex.rowCount, 1);

    const teeConfigIndex = await client.query(
      `SELECT 1
       FROM pg_indexes
       WHERE schemaname = $1
         AND tablename = 'rounds'
         AND indexname = 'idx_rounds_tee_configuration_id'`,
      [schemaName],
    );
    assert.equal(teeConfigIndex.rowCount, 1);

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
      // no-op: transaction may already be closed
    }
    client.release();
    await pool.end();
  }
});
