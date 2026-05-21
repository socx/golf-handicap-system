const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFromRoot } = require('./load-env');

const DEFAULT_DATABASE_URL = 'postgresql://localhost:5432/golf_db';
const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(ROOT, 'packages', 'db', 'migrations');

loadEnvFromRoot();

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  process.exit(1);
}

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.log('No migration files found.');
  process.exit(0);
}

for (const file of files) {
  const fullPath = path.join(MIGRATIONS_DIR, file);
  console.log(`Applying migration: ${file}`);
  run(`psql "${databaseUrl}" -v ON_ERROR_STOP=1 -f "${fullPath}"`);
}

console.log('Migrations complete.');
