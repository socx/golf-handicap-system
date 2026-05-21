const { execSync } = require('node:child_process');

function run(command) {
  try {
    return {
      ok: true,
      out: execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim(),
    };
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString().trim() : '';
    return { ok: false, out: stderr || error.message };
  }
}

function majorFromNode(version) {
  const match = version.replace(/^v/, '').match(/^(\d+)\./);
  return match ? Number(match[1]) : null;
}

function majorFromText(text) {
  const match = text.match(/(\d+)\./);
  return match ? Number(match[1]) : null;
}

function majorFromRedis(text) {
  const match = text.match(/v=(\d+\.\d+\.\d+)/);
  return match ? majorFromText(match[1]) : majorFromText(text);
}

const checks = [
  {
    name: 'Node.js',
    command: 'node -v',
    expected: 20,
    parse: majorFromNode,
  },
  {
    name: 'PostgreSQL client',
    command: 'psql --version',
    expected: 16,
    parse: majorFromText,
  },
  {
    name: 'Redis server',
    command: 'redis-server --version',
    expected: 7,
    parse: majorFromRedis,
  },
];

let failed = false;

console.log('Version checks:');
for (const check of checks) {
  const result = run(check.command);
  if (!result.ok) {
    failed = true;
    console.log(`- ${check.name}: NOT FOUND (${result.out})`);
    continue;
  }

  const major = check.parse(result.out);
  const ok = major === check.expected;
  if (!ok) failed = true;
  console.log(`- ${check.name}: ${result.out} ${ok ? '[OK]' : `[EXPECTED ${check.expected}.x]`}`);
}

console.log('\nRuntime checks:');
const postgresReady = run('pg_isready -h localhost -p 5432');
if (postgresReady.ok && /accepting connections/i.test(postgresReady.out)) {
  console.log(`- PostgreSQL runtime: ${postgresReady.out} [OK]`);
} else {
  failed = true;
  console.log(`- PostgreSQL runtime: NOT READY (${postgresReady.out})`);
}

const redisPing = run('redis-cli ping');
if (redisPing.ok && redisPing.out === 'PONG') {
  console.log('- Redis runtime: PONG [OK]');
} else {
  failed = true;
  console.log(`- Redis runtime: NOT READY (${redisPing.out})`);
}

if (failed) {
  console.error('\nOne or more checks failed.');
  process.exit(1);
}

console.log('\nAll checks passed.');
