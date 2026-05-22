const fs = require('node:fs');
const path = require('node:path');

function parseEnvLine(line) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) return null;

  const key = match[1];
  let value = match[2].trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadEnvFile(envPath, options = {}) {
  if (!fs.existsSync(envPath)) return false;

  const override = options.override === true;

  const raw = fs.readFileSync(envPath, 'utf8');
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parsed = parseEnvLine(trimmed);
    if (!parsed) continue;

    if (override || process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }

  return true;
}

function loadEnvFromRoot() {
  const rootDir = path.resolve(__dirname, '..', '..');
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  const baseLoaded = loadEnvFile(path.join(rootDir, '.env'));

  if (nodeEnv) {
    loadEnvFile(path.join(rootDir, `.env.${nodeEnv}`), { override: true });
  }

  if (!baseLoaded && !nodeEnv) {
    loadEnvFile(path.join(rootDir, '.env.production'));
  }
}

module.exports = { loadEnvFromRoot };
