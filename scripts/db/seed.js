const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFromRoot } = require('./load-env');

const DEFAULT_DATABASE_URL = 'postgresql://localhost:5432/golf_db';
const ROOT = path.resolve(__dirname, '..', '..');
const SEEDS_DIR = path.join(ROOT, 'packages', 'db', 'seeds');

loadEnvFromRoot();

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

if (!fs.existsSync(SEEDS_DIR)) {
  console.error(`Seeds directory not found: ${SEEDS_DIR}`);
  process.exit(1);
}

const files = fs
  .readdirSync(SEEDS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.log('No seed files found.');
  process.exit(0);
}

for (const file of files) {
  const fullPath = path.join(SEEDS_DIR, file);
  console.log(`Applying seed: ${file}`);
  run(`psql "${databaseUrl}" -v ON_ERROR_STOP=1 -f "${fullPath}"`);
}

console.log('Seed complete.');
