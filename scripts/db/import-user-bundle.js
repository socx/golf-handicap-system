const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { loadEnvFromRoot } = require('./load-env');

loadEnvFromRoot();

function parseArgs(argv) {
  const args = { input: '' };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if ((arg === '--input' || arg === '-i') && argv[i + 1]) {
      args.input = String(argv[i + 1]).trim();
      i += 1;
    }
  }

  return args;
}

function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid JSON payload');
  }

  const data = raw.data || {};

  return {
    users: Array.isArray(data.users) ? data.users : [],
    players: Array.isArray(data.players) ? data.players : [],
    rounds: Array.isArray(data.rounds) ? data.rounds : [],
    hole_scores: Array.isArray(data.hole_scores) ? data.hole_scores : [],
    handicap_records: Array.isArray(data.handicap_records) ? data.handicap_records : [],
  };
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function upsertRows(client, tableName, rows, conflictColumn) {
  if (!rows || rows.length === 0) {
    return 0;
  }

  const columns = Object.keys(rows[0]);
  if (columns.length === 0) {
    return 0;
  }

  const quotedColumns = columns.map(quoteIdentifier);
  const updateColumns = columns.filter((col) => col !== conflictColumn);

  const chunks = 100;
  let inserted = 0;

  for (let start = 0; start < rows.length; start += chunks) {
    const batch = rows.slice(start, start + chunks);

    const values = [];
    const placeholders = [];

    for (let i = 0; i < batch.length; i += 1) {
      const row = batch[i];
      const rowPlaceholders = [];

      for (let j = 0; j < columns.length; j += 1) {
        values.push(row[columns[j]]);
        rowPlaceholders.push(`$${values.length}`);
      }

      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const conflict = quoteIdentifier(conflictColumn);
    const updateClause = updateColumns
      .map((col) => `${quoteIdentifier(col)} = EXCLUDED.${quoteIdentifier(col)}`)
      .join(', ');

    const sql = [
      `INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns.join(', ')})`,
      `VALUES ${placeholders.join(', ')}`,
      `ON CONFLICT (${conflict}) DO UPDATE SET ${updateClause}`,
    ].join(' ');

    await client.query(sql, values);
    inserted += batch.length;
  }

  return inserted;
}

async function main() {
  const { input: cliInput } = parseArgs(process.argv.slice(2));

  const destinationDatabaseUrl = process.env.DESTINATION_DATABASE_URL || process.env.DATABASE_URL || '';
  const inputRaw = cliInput || process.env.IMPORT_PATH || '';
  const inputPath = inputRaw ? path.resolve(inputRaw) : '';

  if (!destinationDatabaseUrl) {
    throw new Error('Missing DESTINATION_DATABASE_URL (or DATABASE_URL)');
  }

  if (!inputPath) {
    throw new Error('Missing input path. Provide --input <path> or IMPORT_PATH env var');
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const payload = normalizePayload(parsed);

  const client = new Client({ connectionString: destinationDatabaseUrl });
  await client.connect();

  try {
    await client.query('BEGIN');

    const users = await upsertRows(client, 'users', payload.users, 'id');
    const players = await upsertRows(client, 'players', payload.players, 'id');
    const rounds = await upsertRows(client, 'rounds', payload.rounds, 'id');
    const holeScores = await upsertRows(client, 'hole_scores', payload.hole_scores, 'id');
    const handicapRecords = await upsertRows(client, 'handicap_records', payload.handicap_records, 'id');

    await client.query('COMMIT');

    console.log('Import complete');
    console.log(JSON.stringify({
      users,
      players,
      rounds,
      holeScores,
      handicapRecords,
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[import-user-bundle] failed:', error.message);
  process.exit(1);
});
