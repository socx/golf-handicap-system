const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { loadEnvFromRoot } = require('./load-env');

loadEnvFromRoot();

function parseArgs(argv) {
  const args = { userId: '', output: '' };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if ((arg === '--user-id' || arg === '-u') && argv[i + 1]) {
      args.userId = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }

    if ((arg === '--output' || arg === '-o') && argv[i + 1]) {
      args.output = String(argv[i + 1]).trim();
      i += 1;
    }
  }

  return args;
}

async function queryRows(client, text, params) {
  const result = await client.query(text, params);
  return result.rows;
}

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  const { userId: cliUserId, output: cliOutput } = parseArgs(process.argv.slice(2));

  const sourceDatabaseUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL || '';
  const userId = cliUserId || process.env.USER_ID || '';
  const outputPath = path.resolve(cliOutput || process.env.EXPORT_PATH || `./tmp/user-bundle-${userId || 'unknown'}.json`);

  if (!sourceDatabaseUrl) {
    throw new Error('Missing SOURCE_DATABASE_URL (or DATABASE_URL)');
  }

  if (!userId) {
    throw new Error('Missing user id. Provide --user-id <uuid> or USER_ID env var');
  }

  const client = new Client({ connectionString: sourceDatabaseUrl });
  await client.connect();

  try {
    const users = await queryRows(
      client,
      'SELECT * FROM users WHERE id = $1',
      [userId],
    );

    if (users.length === 0) {
      throw new Error(`No user found for id: ${userId}`);
    }

    const players = await queryRows(
      client,
      'SELECT * FROM players WHERE user_id = $1 ORDER BY created_at ASC',
      [userId],
    );

    const playerIds = players.map((row) => row.id);

    let rounds = [];
    let handicapRecords = [];

    if (playerIds.length > 0) {
      rounds = await queryRows(
        client,
        'SELECT * FROM rounds WHERE player_id = ANY($1::uuid[]) ORDER BY played_at ASC, created_at ASC',
        [playerIds],
      );

      handicapRecords = await queryRows(
        client,
        'SELECT * FROM handicap_records WHERE player_id = ANY($1::uuid[]) ORDER BY calculation_date ASC, created_at ASC',
        [playerIds],
      );
    }

    const roundIds = rounds.map((row) => row.id);

    let holeScores = [];
    if (roundIds.length > 0) {
      holeScores = await queryRows(
        client,
        'SELECT * FROM hole_scores WHERE round_id = ANY($1::uuid[]) ORDER BY round_id ASC, hole_number ASC',
        [roundIds],
      );
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      source: {
        userId,
      },
      counts: {
        users: users.length,
        players: players.length,
        rounds: rounds.length,
        holeScores: holeScores.length,
        handicapRecords: handicapRecords.length,
      },
      data: {
        users,
        players,
        rounds,
        hole_scores: holeScores,
        handicap_records: handicapRecords,
      },
    };

    ensureDirForFile(outputPath);
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

    console.log(`Exported user bundle to ${outputPath}`);
    console.log(JSON.stringify(payload.counts));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[export-user-bundle] failed:', error.message);
  process.exit(1);
});
