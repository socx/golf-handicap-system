const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { loadEnvFromRoot } = require('./load-env');

loadEnvFromRoot();

function parseArgs(argv) {
  const args = { userIdsCsv: '', input: '', dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if ((arg === '--user-ids' || arg === '-u') && argv[i + 1]) {
      args.userIdsCsv = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }

    if ((arg === '--input' || arg === '-i') && argv[i + 1]) {
      args.input = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }

    if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
}

function unique(values) {
  return [...new Set(values)];
}

function parseIdsCsv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function loadIdsFromInput(inputPath) {
  const resolved = path.resolve(inputPath);
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));

  if (Array.isArray(parsed)) {
    return parsed.map((value) => String(value).trim()).filter(Boolean);
  }

  if (Array.isArray(parsed.userIds)) {
    return parsed.userIds.map((value) => String(value).trim()).filter(Boolean);
  }

  throw new Error('Input JSON must be an array of ids or an object with userIds: []');
}

async function main() {
  const { userIdsCsv, input, dryRun } = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL');
  }

  const inputIds = input ? loadIdsFromInput(input) : [];
  const envIds = parseIdsCsv(process.env.USER_IDS || '');
  const cliIds = parseIdsCsv(userIdsCsv);
  const userIds = unique([...cliIds, ...inputIds, ...envIds]);

  if (userIds.length === 0) {
    throw new Error('No user ids supplied. Use --user-ids, --input, or USER_IDS env var');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('BEGIN');

    const playersResult = await client.query(
      'SELECT id FROM players WHERE user_id = ANY($1::uuid[])',
      [userIds],
    );
    const playerIds = playersResult.rows.map((row) => row.id);

    const roundsResult = playerIds.length
      ? await client.query('SELECT id FROM rounds WHERE player_id = ANY($1::uuid[])', [playerIds])
      : { rows: [] };
    const roundIds = roundsResult.rows.map((row) => row.id);

    const passwordReset = dryRun
      ? await client.query('SELECT COUNT(*)::int AS total FROM password_reset_tokens WHERE user_id = ANY($1::uuid[])', [userIds])
      : await client.query('DELETE FROM password_reset_tokens WHERE user_id = ANY($1::uuid[])', [userIds]);

    const activation = dryRun
      ? await client.query('SELECT COUNT(*)::int AS total FROM account_activation_tokens WHERE user_id = ANY($1::uuid[])', [userIds])
      : await client.query('DELETE FROM account_activation_tokens WHERE user_id = ANY($1::uuid[])', [userIds]);

    const holeScores = roundIds.length
      ? dryRun
        ? await client.query('SELECT COUNT(*)::int AS total FROM hole_scores WHERE round_id = ANY($1::uuid[])', [roundIds])
        : await client.query('DELETE FROM hole_scores WHERE round_id = ANY($1::uuid[])', [roundIds])
      : { rowCount: 0, rows: [{ total: 0 }] };

    const rounds = playerIds.length
      ? dryRun
        ? await client.query('SELECT COUNT(*)::int AS total FROM rounds WHERE player_id = ANY($1::uuid[])', [playerIds])
        : await client.query('DELETE FROM rounds WHERE player_id = ANY($1::uuid[])', [playerIds])
      : { rowCount: 0, rows: [{ total: 0 }] };

    const handicapRecords = playerIds.length
      ? dryRun
        ? await client.query('SELECT COUNT(*)::int AS total FROM handicap_records WHERE player_id = ANY($1::uuid[])', [playerIds])
        : await client.query('DELETE FROM handicap_records WHERE player_id = ANY($1::uuid[])', [playerIds])
      : { rowCount: 0, rows: [{ total: 0 }] };

    const players = dryRun
      ? await client.query('SELECT COUNT(*)::int AS total FROM players WHERE user_id = ANY($1::uuid[])', [userIds])
      : await client.query('DELETE FROM players WHERE user_id = ANY($1::uuid[])', [userIds]);

    const users = dryRun
      ? await client.query('SELECT COUNT(*)::int AS total FROM users WHERE id = ANY($1::uuid[])', [userIds])
      : await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);

    const countOf = (result) => (dryRun ? Number(result.rows[0]?.total || 0) : Number(result.rowCount || 0));

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    console.log(dryRun ? 'Dry run complete (no rows deleted)' : 'Hard delete users completed');
    console.log(
      JSON.stringify(
        {
          inputUserIds: userIds.length,
          dryRun,
          deleted: {
            password_reset_tokens: countOf(passwordReset),
            account_activation_tokens: countOf(activation),
            hole_scores: countOf(holeScores),
            rounds: countOf(rounds),
            handicap_records: countOf(handicapRecords),
            players: countOf(players),
            users: countOf(users),
          },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[hard-delete-users] failed:', error.message);
  process.exit(1);
});
