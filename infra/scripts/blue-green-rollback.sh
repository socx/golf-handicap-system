#!/bin/bash
# Blue-green rollback script for GHS backend
# Quickly switches traffic back to previous slot in case of deployment issues
# 
# Usage: ./blue-green-rollback.sh [--force] [--no-health-check]
#
# Configuration via environment variables:
#   ACTIVE_SLOT_FILE: File tracking active slot (default: /var/run/ghs-active-slot)

set -euo pipefail

# Configuration
ACTIVE_SLOT_FILE="${ACTIVE_SLOT_FILE:-/var/run/ghs-active-slot}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-30}"

# Logging
log() {
  local level="$1"
  shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a /var/log/ghs-deploy.log
}

log_json() {
  local status="$1"
  local message="$2"
  local duration="${3:-0}"
  
  local json="{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"event\":\"rollback\",\"status\":\"${status}\",\"message\":\"${message}\",\"duration_sec\":${duration}}"
  echo "${json}" >> /var/log/ghs-deploy-status.jsonl
  echo "${json}"
}

# Get currently active slot
get_active_slot() {
  if [[ ! -f "${ACTIVE_SLOT_FILE}" ]]; then
    echo "blue"
    return
  fi
  cat "${ACTIVE_SLOT_FILE}"
}

# Get previous (target) slot
get_target_slot() {
  local active=$(get_active_slot)
  if [[ "${active}" == "blue" ]]; then
    echo "green"
  else
    echo "blue"
  fi
}

# Get port for slot
get_slot_port() {
  local slot="$1"
  if [[ "${slot}" == "blue" ]]; then
    echo "3005"
  else
    echo "3006"
  fi
}

# Quick health check
health_check() {
  local slot="$1"
  local port=$(get_slot_port "${slot}")
  
  log "INFO" "Quick health check on ${slot} (port ${port})"
  
  if timeout "${HEALTH_CHECK_TIMEOUT}" curl -sf "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
    log "INFO" "Health check passed for ${slot}"
    return 0
  else
    log "ERROR" "Health check failed for ${slot}"
    return 1
  fi
}

# Switch traffic
switch_traffic() {
  local from_slot="$1"
  local to_slot="$2"
  local from_port=$(get_slot_port "${from_slot}")
  local to_port=$(get_slot_port "${to_slot}")
  
  log "WARN" "ROLLBACK: Switching traffic: ${from_slot} (${from_port}) -> ${to_slot} (${to_port})"
  
  local start_time=$(date +%s)
  
  # Update active slot file
  echo "${to_slot}" > "${ACTIVE_SLOT_FILE}"
  
  # Reload nginx to pick up new upstream
  if ! systemctl reload nginx 2>/dev/null; then
    if ! nginx -t >/dev/null 2>&1 || ! nginx -s reload 2>/dev/null; then
      log "WARN" "nginx reload failed, but slot file updated"
    fi
  fi
  
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  log "WARN" "Rollback traffic switch completed in ${duration}s"
  
  return 0
}

# Main rollback
main() {
  local force_flag="${1:-}"
  local no_health_check="${2:-}"
  local start_time=$(date +%s)
  
  log "INFO" "=== Blue-Green Rollback Initiated ==="
  
  local active_slot=$(get_active_slot)
  local target_slot=$(get_target_slot)
  
  log "WARN" "Current active slot: ${active_slot}"
  log "WARN" "Target slot (previous): ${target_slot}"
  
  # Optional health check on target slot before rollback
  if [[ "${no_health_check}" != "--no-health-check" ]]; then
    if ! health_check "${target_slot}"; then
      log "ERROR" "Target slot failed health check, cannot rollback safely"
      if [[ "${force_flag}" != "--force" ]]; then
        log "ERROR" "Use --force to override safety check"
        exit 1
      fi
      log "WARN" "Force flag set, proceeding with rollback anyway"
    fi
  fi
  
  # Perform rollback switch
  if ! switch_traffic "${active_slot}" "${target_slot}"; then
    log "ERROR" "Rollback switch failed"
    log_json "FAILED" "Rollback switch failed" "0"
    exit 1
  fi
  
  # Verify rollback
  sleep 1
  if timeout "${HEALTH_CHECK_TIMEOUT}" curl -sf "http://127.0.0.1:80/api/health" >/dev/null 2>&1; then
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "WARN" "=== Rollback Successful (${duration}s) ==="
    log_json "SUCCESS" "Rolled back to ${target_slot}" "${duration}"
  else
    log "ERROR" "Rollback verification failed"
    log_json "FAILED" "Rollback verification failed" "0"
    exit 1
  fi
}

main "$@"
