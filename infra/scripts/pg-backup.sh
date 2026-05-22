#!/bin/bash
# PostgreSQL backup script with dual backup schedule support
# Usage: ./pg-backup.sh [--hourly|--daily] [--full]
# 
# Configuration via environment variables:
#   DB_NAME: Database name (default: ghs_db)
#   DB_USER: PostgreSQL user (default: ghs_db_super_user)
#   DB_HOST: PostgreSQL host (default: 127.0.0.1)
#   DB_PORT: PostgreSQL port (default: 5432)
#   BACKUP_DIR: Backup directory (default: /var/backups/ghs/postgres)
#   BACKUP_RETENTION_HOURLY: Hours to keep hourly backups (default: 48)
#   BACKUP_RETENTION_DAILY: Days to keep daily backups (default: 30)

set -euo pipefail

# Configuration
DB_NAME="${DB_NAME:-ghs_db}"
DB_USER="${DB_USER:-ghs_db_super_user}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ghs/postgres}"
BACKUP_RETENTION_HOURLY="${BACKUP_RETENTION_HOURLY:-48}"
BACKUP_RETENTION_DAILY="${BACKUP_RETENTION_DAILY:-30}"

# Determine backup type from argument
BACKUP_TYPE="${1:-daily}"  # hourly | daily
BACKUP_MODE="${2:-standard}"  # standard | full
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

# Create subdirectories for organized retention
mkdir -p "${BACKUP_DIR}"/{hourly,daily,logs}
chmod 700 "${BACKUP_DIR}"

# Logging
log() {
  local level="$1"
  shift
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
  echo "${msg}" | tee -a "${BACKUP_DIR}/logs/backup.log"
}

log_json() {
  local status="$1"
  local message="$2"
  local backup_type="$3"
  local size="${4:-0}"
  local duration="${5:-0}"
  
  local json_log="{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"backup_type\":\"${backup_type}\",\"status\":\"${status}\",\"message\":\"${message}\",\"size_bytes\":${size},\"duration_sec\":${duration}}"
  echo "${json_log}" >> "${BACKUP_DIR}/logs/backup-status.jsonl"
  
  # Also emit to stdout for systemd/journald capture
  echo "${json_log}"
}

# Database connectivity check
check_db_connectivity() {
  if ! pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" >/dev/null 2>&1; then
    log "ERROR" "PostgreSQL connection failed (${DB_HOST}:${DB_PORT})"
    log_json "FAILED" "Database connectivity check failed" "${BACKUP_TYPE}" 0 0
    exit 1
  fi
  log "INFO" "Database connectivity check passed"
}

# Perform backup
perform_backup() {
  local backup_subdir="${BACKUP_DIR}/${BACKUP_TYPE}"
  local backup_file="${backup_subdir}/${DB_NAME}-${TIMESTAMP}.dump"
  
  log "INFO" "Starting ${BACKUP_TYPE} backup [${TIMESTAMP}]"
  
  local start_time=$(date +%s)
  
  if ! pg_dump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --format=custom \
    --verbose \
    --no-password \
    "${DB_NAME}" > "${backup_file}" 2>"${backup_subdir}/${TIMESTAMP}.log"; then
    
    log "ERROR" "pg_dump failed for ${DB_NAME}"
    log_json "FAILED" "pg_dump command failed" "${BACKUP_TYPE}" 0 0
    rm -f "${backup_file}"
    exit 1
  fi
  
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  local size=$(stat -f%z "${backup_file}" 2>/dev/null || stat -c%s "${backup_file}")
  
  log "INFO" "Backup completed: ${backup_file} (size=${size}, duration=${duration}s)"
  log_json "SUCCESS" "Backup completed successfully" "${BACKUP_TYPE}" "${size}" "${duration}"
  
  # Output backup file path for downstream processing
  echo "${backup_file}"
}

# Clean old backups based on retention policy
cleanup_old_backups() {
  local backup_subdir="${BACKUP_DIR}/${BACKUP_TYPE}"
  local find_mtime
  
  if [[ "${BACKUP_TYPE}" == "hourly" ]]; then
    # Keep hourly backups for N hours
    find_mtime="-mmin +$((BACKUP_RETENTION_HOURLY * 60))"
  else
    # Keep daily backups for N days
    find_mtime="-mtime +${BACKUP_RETENTION_DAILY}"
  fi
  
  log "INFO" "Cleaning ${BACKUP_TYPE} backups: find ${backup_subdir} -maxdepth 1 -name '${DB_NAME}-*.dump' ${find_mtime} -delete"
  
  find "${backup_subdir}" -maxdepth 1 -type f -name "${DB_NAME}-*.dump" ${find_mtime} -delete || true
  
  log "INFO" "Cleanup completed"
}

# Verify backup integrity
verify_backup() {
  local backup_file="$1"
  
  log "INFO" "Verifying backup integrity: ${backup_file}"
  
  if ! pg_restore -l "${backup_file}" >/dev/null 2>&1; then
    log "ERROR" "Backup file integrity check failed"
    return 1
  fi
  
  log "INFO" "Backup integrity verified"
  return 0
}

# Main execution
main() {
  log "INFO" "=== PostgreSQL Backup Script Started ==="
  log "INFO" "Type=${BACKUP_TYPE}, Mode=${BACKUP_MODE}, DB=${DB_NAME}, Host=${DB_HOST}:${DB_PORT}"
  
  check_db_connectivity
  
  local backup_file=$(perform_backup)
  
  if [[ -f "${backup_file}" ]]; then
    if verify_backup "${backup_file}"; then
      log "INFO" "Backup validated successfully"
    else
      log "WARN" "Backup validation warning, but backup file exists"
    fi
  fi
  
  cleanup_old_backups
  
  log "INFO" "=== PostgreSQL Backup Script Completed ==="
}

main "$@"
