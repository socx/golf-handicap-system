#!/bin/bash
# PostgreSQL restore testing script
# Periodically tests backup restore capability by restoring to a test database
# Usage: ./pg-restore-test.sh [--backup-file <path>] [--test-db-suffix test]
#
# Configuration via environment variables:
#   DB_NAME: Source database name (default: ghs_db)
#   DB_USER: PostgreSQL user (default: ghs_db_super_user)
#   DB_HOST: PostgreSQL host (default: 127.0.0.1)
#   DB_PORT: PostgreSQL port (default: 5432)
#   BACKUP_DIR: Backup directory (default: /var/backups/ghs/postgres)
#   TEST_RETAIN_DAYS: Days to keep test logs (default: 30)

set -euo pipefail

# Configuration
DB_NAME="${DB_NAME:-ghs_db}"
DB_USER="${DB_USER:-ghs_db_super_user}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ghs/postgres}"
TEST_RETAIN_DAYS="${TEST_RETAIN_DAYS:-30}"

# Test parameters
BACKUP_FILE="${1:-}"
TEST_DB_SUFFIX="${2:-test_$(date +%s)}"
TEST_DB_NAME="${DB_NAME}_${TEST_DB_SUFFIX}"
TEST_DIR="${BACKUP_DIR}/restore-tests"

mkdir -p "${TEST_DIR}/logs"
chmod 700 "${TEST_DIR}"

# Logging
log() {
  local level="$1"
  shift
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
  echo "${msg}" | tee -a "${TEST_DIR}/logs/restore-test.log"
}

log_json() {
  local status="$1"
  local message="$2"
  local backup_file="${3:-unknown}"
  local duration="${4:-0}"
  
  local json_log="{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"event\":\"restore_test\",\"status\":\"${status}\",\"message\":\"${message}\",\"backup_file\":\"${backup_file}\",\"test_db\":\"${TEST_DB_NAME}\",\"duration_sec\":${duration}}"
  echo "${json_log}" >> "${TEST_DIR}/logs/restore-test-status.jsonl"
  echo "${json_log}"
}

# Database connectivity check
check_db_connectivity() {
  if ! pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" >/dev/null 2>&1; then
    log "ERROR" "PostgreSQL connection failed (${DB_HOST}:${DB_PORT})"
    log_json "FAILED" "Database connectivity check failed" "" 0
    exit 1
  fi
  log "INFO" "Database connectivity check passed"
}

# Find latest backup if not specified
find_latest_backup() {
  local backup_type="${1:-daily}"
  local backup_subdir="${BACKUP_DIR}/${backup_type}"
  
  if [[ ! -d "${backup_subdir}" ]]; then
    log "ERROR" "Backup directory not found: ${backup_subdir}"
    log_json "FAILED" "Backup directory not found" "" 0
    exit 1
  fi
  
  # Find most recent backup file
  local latest=$(find "${backup_subdir}" -maxdepth 1 -type f -name "${DB_NAME}-*.dump" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
  
  if [[ -z "${latest}" ]]; then
    log "ERROR" "No backup files found in ${backup_subdir}"
    log_json "FAILED" "No backup files found" "" 0
    exit 1
  fi
  
  echo "${latest}"
}

# Create test database
create_test_db() {
  log "INFO" "Creating test database: ${TEST_DB_NAME}"
  
  if psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -tc "SELECT 1 FROM pg_database WHERE datname = '${TEST_DB_NAME}'" | grep -q 1; then
    log "WARN" "Test database already exists, dropping: ${TEST_DB_NAME}"
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "DROP DATABASE ${TEST_DB_NAME};"
  fi
  
  if ! psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "CREATE DATABASE ${TEST_DB_NAME};"; then
    log "ERROR" "Failed to create test database: ${TEST_DB_NAME}"
    log_json "FAILED" "Failed to create test database" "" 0
    exit 1
  fi
  
  log "INFO" "Test database created: ${TEST_DB_NAME}"
}

# Perform restore test
perform_restore() {
  local backup_file="$1"
  
  if [[ ! -f "${backup_file}" ]]; then
    log "ERROR" "Backup file not found: ${backup_file}"
    log_json "FAILED" "Backup file not found" "${backup_file}" 0
    exit 1
  fi
  
  log "INFO" "Restoring backup: ${backup_file} -> ${TEST_DB_NAME}"
  
  local start_time=$(date +%s)
  
  if ! pg_restore \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${TEST_DB_NAME}" \
    --verbose \
    --no-password \
    "${backup_file}" 2>"${TEST_DIR}/logs/${TEST_DB_SUFFIX}.restore.log"; then
    
    log "ERROR" "pg_restore failed for ${backup_file}"
    log_json "FAILED" "pg_restore failed" "${backup_file}" 0
    
    # Cleanup failed test database
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};" || true
    
    exit 1
  fi
  
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  log "INFO" "Restore completed successfully (${duration}s)"
  
  # Perform basic validation on restored database
  if validate_restored_db; then
    log_json "SUCCESS" "Restore test completed successfully" "${backup_file}" "${duration}"
  else
    log "WARN" "Restore completed but validation warnings present"
    log_json "WARNING" "Restore completed with validation warnings" "${backup_file}" "${duration}"
  fi
}

# Validate restored database
validate_restored_db() {
  log "INFO" "Validating restored database: ${TEST_DB_NAME}"
  
  # Check database is accessible
  if ! psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TEST_DB_NAME}" -c "SELECT version();" >/dev/null 2>&1; then
    log "ERROR" "Cannot query restored database"
    return 1
  fi
  
  # Count tables in restored database
  local table_count=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TEST_DB_NAME}" -tc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' ')
  log "INFO" "Restored database has ${table_count} tables"
  
  # Check key tables exist
  if psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TEST_DB_NAME}" -tc "SELECT 1 FROM information_schema.tables WHERE table_name='schema_migrations';" | grep -q 1; then
    log "INFO" "schema_migrations table found"
  else
    log "WARN" "schema_migrations table not found"
    return 1
  fi
  
  log "INFO" "Database validation completed"
  return 0
}

# Cleanup test database
cleanup_test_db() {
  if [[ "${CLEANUP:-true}" != "false" ]]; then
    log "INFO" "Dropping test database: ${TEST_DB_NAME}"
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};" || true
  fi
}

# Cleanup old test logs
cleanup_old_logs() {
  log "INFO" "Cleaning restore test logs older than ${TEST_RETAIN_DAYS} days"
  find "${TEST_DIR}/logs" -maxdepth 1 -type f -mtime "+${TEST_RETAIN_DAYS}" -delete || true
}

# Main execution
main() {
  log "INFO" "=== PostgreSQL Restore Test Script Started ==="
  log "INFO" "Source DB=${DB_NAME}, Test DB=${TEST_DB_NAME}, Host=${DB_HOST}:${DB_PORT}"
  
  check_db_connectivity
  
  # Find or use specified backup
  if [[ -z "${BACKUP_FILE}" ]]; then
    log "INFO" "No backup file specified, finding latest daily backup..."
    BACKUP_FILE=$(find_latest_backup "daily")
    log "INFO" "Using backup: ${BACKUP_FILE}"
  fi
  
  create_test_db
  
  trap cleanup_test_db EXIT
  
  perform_restore "${BACKUP_FILE}"
  
  cleanup_old_logs
  
  log "INFO" "=== PostgreSQL Restore Test Script Completed ==="
}

main "$@"
