const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { loadEnvFromRoot } = require('./load-env');

loadEnvFromRoot();

function parseArgs(argv) {
  const args = { courseIdsCsv: '', input: '', dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if ((arg === '--course-ids' || arg === '-c') && argv[i + 1]) {
      args.courseIdsCsv = String(argv[i + 1]).trim();
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

  if (Array.isArray(parsed.courseIds)) {
    return parsed.courseIds.map((value) => String(value).trim()).filter(Boolean);
  }

  throw new Error('Input JSON must be an array of ids or an object with courseIds: []');
}

async function main() {
  const { courseIdsCsv, input, dryRun } = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL');
  }

  const inputIds = input ? loadIdsFromInput(input) : [];
  const envIds = parseIdsCsv(process.env.COURSE_IDS || '');
  const cliIds = parseIdsCsv(courseIdsCsv);
  const courseIds = unique([...cliIds, ...inputIds, ...envIds]);

  if (courseIds.length === 0) {
    throw new Error('No course ids supplied. Use --course-ids, --input, or COURSE_IDS env var');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('BEGIN');

    const teeResult = await client.query(
      'SELECT id FROM tee_configurations WHERE course_id = ANY($1::uuid[])',
      [courseIds],
    );
    const teeConfigIds = teeResult.rows.map((row) => row.id);

    const roundsResult = teeConfigIds.length
      ? await client.query('SELECT id FROM rounds WHERE tee_configuration_id = ANY($1::uuid[])', [teeConfigIds])
      : { rows: [] };
    const roundIds = roundsResult.rows.map((row) => row.id);

    const holeScores = roundIds.length
      ? dryRun
        ? await client.query('SELECT COUNT(*)::int AS total FROM hole_scores WHERE round_id = ANY($1::uuid[])', [roundIds])
        : await client.query('DELETE FROM hole_scores WHERE round_id = ANY($1::uuid[])', [roundIds])
      : { rowCount: 0, rows: [{ total: 0 }] };

    const rounds = teeConfigIds.length
      ? dryRun
        ? await client.query('SELECT COUNT(*)::int AS total FROM rounds WHERE tee_configuration_id = ANY($1::uuid[])', [teeConfigIds])
        : await client.query('DELETE FROM rounds WHERE tee_configuration_id = ANY($1::uuid[])', [teeConfigIds])
      : { rowCount: 0, rows: [{ total: 0 }] };

    const holes = teeConfigIds.length
      ? dryRun
        ? await client.query('SELECT COUNT(*)::int AS total FROM holes WHERE tee_configuration_id = ANY($1::uuid[])', [teeConfigIds])
        : await client.query('DELETE FROM holes WHERE tee_configuration_id = ANY($1::uuid[])', [teeConfigIds])
      : { rowCount: 0, rows: [{ total: 0 }] };

    const teeConfigurations = dryRun
      ? await client.query('SELECT COUNT(*)::int AS total FROM tee_configurations WHERE course_id = ANY($1::uuid[])', [courseIds])
      : await client.query('DELETE FROM tee_configurations WHERE course_id = ANY($1::uuid[])', [courseIds]);

    const courses = dryRun
      ? await client.query('SELECT COUNT(*)::int AS total FROM courses WHERE id = ANY($1::uuid[])', [courseIds])
      : await client.query('DELETE FROM courses WHERE id = ANY($1::uuid[])', [courseIds]);

    const countOf = (result) => (dryRun ? Number(result.rows[0]?.total || 0) : Number(result.rowCount || 0));

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    console.log(dryRun ? 'Dry run complete (no rows deleted)' : 'Hard delete courses completed');
    console.log(
      JSON.stringify(
        {
          inputCourseIds: courseIds.length,
          dryRun,
          deleted: {
            hole_scores: countOf(holeScores),
            rounds: countOf(rounds),
            holes: countOf(holes),
            tee_configurations: countOf(teeConfigurations),
            courses: countOf(courses),
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
  console.error('[hard-delete-courses] failed:', error.message);
  process.exit(1);
});
