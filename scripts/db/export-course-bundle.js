const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { loadEnvFromRoot } = require('./load-env');

loadEnvFromRoot();

function parseArgs(argv) {
  const args = { courseId: '', output: '' };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if ((arg === '--course-id' || arg === '-c') && argv[i + 1]) {
      args.courseId = String(argv[i + 1]).trim();
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
  const { courseId: cliCourseId, output: cliOutput } = parseArgs(process.argv.slice(2));

  const sourceDatabaseUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL || '';
  const courseId = cliCourseId || process.env.COURSE_ID || '';
  const outputPath = path.resolve(cliOutput || process.env.EXPORT_PATH || `./tmp/course-bundle-${courseId || 'unknown'}.json`);

  if (!sourceDatabaseUrl) {
    throw new Error('Missing SOURCE_DATABASE_URL (or DATABASE_URL)');
  }

  if (!courseId) {
    throw new Error('Missing course id. Provide --course-id <uuid> or COURSE_ID env var');
  }

  const client = new Client({ connectionString: sourceDatabaseUrl });
  await client.connect();

  try {
    const courses = await queryRows(
      client,
      'SELECT * FROM courses WHERE id = $1',
      [courseId],
    );

    if (courses.length === 0) {
      throw new Error(`No course found for id: ${courseId}`);
    }

    const teeConfigurations = await queryRows(
      client,
      'SELECT * FROM tee_configurations WHERE course_id = $1 ORDER BY created_at ASC',
      [courseId],
    );

    const teeConfigIds = teeConfigurations.map((row) => row.id);

    let holes = [];

    if (teeConfigIds.length > 0) {
      holes = await queryRows(
        client,
        'SELECT * FROM holes WHERE tee_configuration_id = ANY($1::uuid[]) ORDER BY tee_configuration_id ASC, hole_number ASC',
        [teeConfigIds],
      );
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      source: {
        courseId,
      },
      counts: {
        courses: courses.length,
        tee_configurations: teeConfigurations.length,
        holes: holes.length,
      },
      data: {
        courses,
        tee_configurations: teeConfigurations,
        holes,
      },
    };

    ensureDirForFile(outputPath);
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

    console.log(`Exported course bundle to ${outputPath}`);
    console.log(JSON.stringify(payload.counts));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[export-course-bundle] failed:', error.message);
  process.exit(1);
});
