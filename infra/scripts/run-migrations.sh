#!/usr/bin/env bash
# run-migrations.sh — Execute database migrations in order with rollback support.
#
# Usage:
#   run-migrations.sh [--dry-run] [--rollback-dir DIR]
#
# Environment variables:
#   DATABASE_URL       PostgreSQL connection URL (required)
#   MIGRATIONS_DIR     Directory containing .sql files (default: db/migrations)
#   DRY_RUN           Pass --dry-run to test without applying
#   ROLLBACK_DIR      Directory to write rollback scripts (default: /tmp/ghs-rollbacks)
#
# Example:
#   export DATABASE_URL="postgresql://user:pass@localhost/ghs_db"
#   bash infra/scripts/run-migrations.sh --dry-run

set -euo pipefail

DB_URL="${DATABASE_URL:-}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-db/migrations}"
DRY_RUN=${DRY_RUN:-0}
ROLLBACK_DIR="${ROLLBACK_DIR:-/tmp/ghs-rollbacks}"
VERBOSE="${VERBOSE:-0}"

# Parse CLI flags.
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --rollback-dir)
      ROLLBACK_DIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 1
      ;;
  esac
done

# Pre-flight checks.
if [ -z "$DB_URL" ]; then
  echo "[run-migrations] ERROR: DATABASE_URL not set" >&2
  exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "[run-migrations] ERROR: Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

echo "[run-migrations] Connecting to database..."
if ! psql "$DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
  echo "[run-migrations] ERROR: Failed to connect to database" >&2
  exit 1
fi

echo "[run-migrations] Creating schema_migrations table if needed..."
psql "$DB_URL" <<EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF

# Find all migration files sorted numerically.
MIGRATION_FILES=($(find "$MIGRATIONS_DIR" -name "*.sql" -type f | sort -V))

if [ ${#MIGRATION_FILES[@]} -eq 0 ]; then
  echo "[run-migrations] No migrations found in $MIGRATIONS_DIR; nothing to do."
  exit 0
fi

echo "[run-migrations] Found ${#MIGRATION_FILES[@]} migration file(s)"

mkdir -p "$ROLLBACK_DIR"
ROLLBACK_SCRIPT="$ROLLBACK_DIR/rollback-$(date +%Y%m%d%H%M%S).sql"
APPLIED_COUNT=0
SKIPPED_COUNT=0

# Process each migration.
for FILE in "${MIGRATION_FILES[@]}"; do
  FILENAME=$(basename "$FILE")
  VERSION="${FILENAME%.sql}"

  # Check if already applied.
  if psql "$DB_URL" -tc "SELECT 1 FROM schema_migrations WHERE version = '$VERSION'" | grep -q 1; then
    echo "[run-migrations] SKIP: $FILENAME (already applied)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  echo "[run-migrations] RUN: $FILENAME"

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[run-migrations]   (dry-run mode: checking syntax only)"

    DRY_RUN_SQL="$(mktemp /tmp/ghs-migration-dry-run.XXXXXX.sql)"
    {
      echo "BEGIN;"
      cat "$FILE"
      echo "ROLLBACK;"
    } > "$DRY_RUN_SQL"

    if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$DRY_RUN_SQL"; then
      rm -f "$DRY_RUN_SQL"
      echo "[run-migrations] ERROR: Migration syntax check failed for $FILENAME" >&2
      exit 1
    fi

    rm -f "$DRY_RUN_SQL"
  else
    # Execute migration inside a transaction.
    if ! psql "$DB_URL" <<EOF
BEGIN;
$(cat "$FILE")
INSERT INTO schema_migrations (version) VALUES ('$VERSION');
COMMIT;
EOF
    then
      echo "[run-migrations] ERROR: Migration failed for $FILENAME" >&2
      exit 1
    fi

    # Append a rollback instruction (simplified: not a true inverse).
    echo "-- Rollback for $VERSION" >> "$ROLLBACK_SCRIPT"
    echo "DELETE FROM schema_migrations WHERE version = '$VERSION';" >> "$ROLLBACK_SCRIPT"
    echo "" >> "$ROLLBACK_SCRIPT"

    APPLIED_COUNT=$((APPLIED_COUNT + 1))
  fi
done

if [ "$DRY_RUN" -eq 1 ]; then
  echo "[run-migrations] DRY-RUN COMPLETE: All migration syntax is valid."
  exit 0
fi

echo "[run-migrations] Migration complete: $APPLIED_COUNT applied, $SKIPPED_COUNT skipped."
echo "[run-migrations] Rollback script written to: $ROLLBACK_SCRIPT"

# Show current migration state.
echo "[run-migrations] Current migration state:"
psql "$DB_URL" -c "SELECT version, executed_at FROM schema_migrations ORDER BY executed_at;"
