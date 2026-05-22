#!/bin/bash
# Blue-green health check validator for GHS backend
# Validates health check endpoints on both active and staging slots
#
# Usage: ./blue-green-health-check.sh [--check-both] [--timeout 30]
#
# Configuration via environment variables:
#   HEALTH_CHECK_TIMEOUT: HTTP request timeout in seconds (default: 30)

set -euo pipefail

# Configuration
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-30}"
CHECK_BOTH="${1:-}"
TIMEOUT_FLAG="${2:-30}"

if [[ "${TIMEOUT_FLAG}" == "--timeout" ]]; then
  HEALTH_CHECK_TIMEOUT="${3:-30}"
fi

# Logging
log() {
  local level="$1"
  shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
}

# Check single endpoint
check_endpoint() {
  local name="$1"
  local url="$2"
  local timeout="${HEALTH_CHECK_TIMEOUT}"
  
  log "INFO" "Checking endpoint: ${name} at ${url}"
  
  if timeout "${timeout}" curl -sf "${url}" >/dev/null 2>&1; then
    log "INFO" "✓ ${name} is healthy"
    return 0
  else
    log "ERROR" "✗ ${name} is unhealthy or unreachable"
    return 1
  fi
}

# Check both slots (if available)
check_both_slots() {
  local blue_ok=0
  local green_ok=0
  
  if check_endpoint "Blue (3005)" "http://127.0.0.1:3005/api/health"; then
    blue_ok=1
  fi
  
  if check_endpoint "Green (3006)" "http://127.0.0.1:3006/api/health"; then
    green_ok=1
  fi
  
  log "INFO" "Slot status: Blue=${blue_ok}, Green=${green_ok}"
  
  return $((1 - (blue_ok + green_ok)))
}

# Check via public domain (through nginx)
check_public_endpoint() {
  log "INFO" "Checking public endpoint: https://ghs.socx.org.uk/api/health"
  
  if timeout "${HEALTH_CHECK_TIMEOUT}" curl -sf --insecure "https://ghs.socx.org.uk/api/health" >/dev/null 2>&1; then
    log "INFO" "✓ Public endpoint is healthy"
    return 0
  else
    log "ERROR" "✗ Public endpoint is unreachable"
    return 1
  fi
}

# Main
main() {
  log "INFO" "=== Blue-Green Health Check Started ==="
  
  if [[ "${CHECK_BOTH}" == "--check-both" ]]; then
    log "INFO" "Checking both slots"
    if check_both_slots; then
      return 0
    else
      log "WARN" "One or more slots failed health check"
      return 1
    fi
  else
    log "INFO" "Checking public endpoint"
    if check_public_endpoint; then
      log "INFO" "=== Health Check Passed ==="
      return 0
    else
      log "ERROR" "=== Health Check Failed ==="
      return 1
    fi
  fi
}

main
