const { execSync } = require('node:child_process');
const { loadEnvFromRoot } = require('./load-env');

const DEFAULT_DATABASE_URL = 'postgresql://localhost:5432/golf_db';

loadEnvFromRoot();

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const parsed = new URL(databaseUrl);
const dbName = parsed.pathname.replace(/^\//, '');

if (!dbName) {
  console.error('Unable to determine database name from DATABASE_URL.');
  process.exit(1);
}

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';

const existsCmd = `psql "${adminUrl.toString()}" -tAc "SELECT 1 FROM pg_database WHERE datname = ${sqlLiteral(dbName)};"`;
let existsOutput = '';
try {
  existsOutput = execSync(existsCmd).toString().trim();
} catch (error) {
  console.error('Failed to query PostgreSQL server for database existence.');
  process.exit(1);
}

if (existsOutput === '1') {
  console.log(`Database '${dbName}' already exists.`);
  process.exit(0);
}

const createCmd = `psql "${adminUrl.toString()}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${sqlIdentifier(dbName)};"`;
run(createCmd);
console.log(`Database '${dbName}' created.`);
