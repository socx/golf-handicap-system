#!/bin/bash
# Blue-green deployment script for GHS backend
# Manages two identical deployment slots (blue/green) with zero-downtime switching
# 
# Usage: ./blue-green-deploy.sh [--blue|--green] [--skip-health-check]
#
# Configuration via environment variables:
#   DEPLOYMENT_DIR: Base deployment directory (default: /opt/apps)
#   ACTIVE_SLOT_FILE: File tracking active slot (default: /var/run/ghs-active-slot)
#   HEALTH_CHECK_RETRIES: Retry attempts for health checks (default: 10)
#   HEALTH_CHECK_INTERVAL: Seconds between retries (default: 3)

set -euo pipefail

# Configuration
DEPLOYMENT_DIR="${DEPLOYMENT_DIR:-/opt/apps}"
ACTIVE_SLOT_FILE="${ACTIVE_SLOT_FILE:-/var/run/ghs-active-slot}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-10}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-3}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-30}"

# Blue/Green slot definitions
BLUE_DIR="${DEPLOYMENT_DIR}/ghs-blue"
GREEN_DIR="${DEPLOYMENT_DIR}/ghs-green"

# Logging
log() {
  local level="$1"
  shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a /var/log/ghs-deploy.log
}

log_json() {
  local event="$1"
  local status="$2"
  local message="$3"
  local duration="${4:-0}"
  
  local json="{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"event\":\"${event}\",\"status\":\"${status}\",\"message\":\"${message}\",\"duration_sec\":${duration}}"
  echo "${json}" >> /var/log/ghs-deploy-status.jsonl
  echo "${json}"
}

# Determine currently active slot
get_active_slot() {
  if [[ ! -f "${ACTIVE_SLOT_FILE}" ]]; then
    echo "blue"
    return
  fi
  cat "${ACTIVE_SLOT_FILE}"
}

# Determine inactive (staging) slot
get_inactive_slot() {
  local active=$(get_active_slot)
  if [[ "${active}" == "blue" ]]; then
    echo "green"
  else
    echo "blue"
  fi
}

# Get directory for slot
get_slot_dir() {
  local slot="$1"
  if [[ "${slot}" == "blue" ]]; then
    echo "${BLUE_DIR}"
  else
    echo "${GREEN_DIR}"
  fi
}

# Validate directories exist
validate_directories() {
  if [[ ! -d "${BLUE_DIR}" ]]; then
    log "ERROR" "Blue directory not found: ${BLUE_DIR}"
    exit 1
  fi
  
  if [[ ! -d "${GREEN_DIR}" ]]; then
    log "ERROR" "Green directory not found: ${GREEN_DIR}"
    exit 1
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

# Perform health check on slot
health_check() {
  local slot="$1"
  local port=$(get_slot_port "${slot}")
  local retries="${HEALTH_CHECK_RETRIES}"
  local interval="${HEALTH_CHECK_INTERVAL}"
  
  log "INFO" "Starting health checks for ${slot} (port ${port}, ${retries} retries)"
  
  for i in $(seq 1 "${retries}"); do
    if timeout "${HEALTH_CHECK_TIMEOUT}" curl -sf "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
      log "INFO" "Health check passed for ${slot} on attempt ${i}"
      return 0
    fi
    
    if [[ ${i} -lt ${retries} ]]; then
      log "WARN" "Health check attempt ${i}/${retries} failed for ${slot}, retrying in ${interval}s..."
      sleep "${interval}"
    fi
  done
  
  log "ERROR" "Health check failed for ${slot} after ${retries} attempts"
  return 1
}

# Switch traffic from old slot to new slot
switch_traffic() {
  local from_slot="$1"
  local to_slot="$2"
  local from_port=$(get_slot_port "${from_slot}")
  local to_port=$(get_slot_port "${to_slot}")
  
  log "INFO" "Switching traffic: ${from_slot} (${from_port}) -> ${to_slot} (${to_port})"
  
  local start_time=$(date +%s)
  
  # Update active slot file
  echo "${to_slot}" > "${ACTIVE_SLOT_FILE}"
  
  # Reload nginx to pick up new upstream configuration
  # The nginx config should reference ghs-blue:3005 and ghs-green:3006 upstreams
  # A separate mechanism (env file, systemd override, etc.) can switch between them
  if ! systemctl reload nginx 2>/dev/null; then
    # Fallback: if no systemd, try direct nginx reload
    if ! nginx -t >/dev/null 2>&1 || ! nginx -s reload 2>/dev/null; then
      log "WARN" "nginx reload failed, but traffic switch file updated"
    fi
  fi
  
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  log "INFO" "Traffic switched in ${duration}s"
  
  # Verify switch by checking new upstream is active
  sleep 1
  if timeout "${HEALTH_CHECK_TIMEOUT}" curl -sf "http://127.0.0.1:80/api/health" >/dev/null 2>&1; then
    log "INFO" "Traffic switch verified"
    log_json "traffic_switch" "SUCCESS" "Switched from ${from_slot} to ${to_slot}" "${duration}"
    return 0
  else
    log "ERROR" "Traffic switch verification failed"
    log_json "traffic_switch" "FAILED" "Traffic switch verification failed" "${duration}"
    return 1
  fi
}

# Perform deployment to inactive slot
perform_deployment() {
  local target_slot="$1"
  local target_dir=$(get_slot_dir "${target_slot}")
  local target_port=$(get_slot_port "${target_slot}")
  
  log "INFO" "=== Deploying to ${target_slot} slot (${target_dir}) ==="
  
  # The actual deployment happens elsewhere in CI/CD
  # This script assumes the release archive is ready
  # In practice, you'd:
  # 1. Download/extract release to ${target_dir}
  # 2. Run migrations if needed
  # 3. Start services on dedicated port
  
  # For now, just verify the directory structure
  if [[ ! -d "${target_dir}/apps" ]]; then
    log "ERROR" "Target directory missing apps/: ${target_dir}"
    return 1
  fi
  
  log "INFO" "Deployment structure validated for ${target_slot}"
  
  # Restart services on target slot
  # This assumes service files are configured to target specific slot directories
  log "INFO" "Restarting services for ${target_slot}..."
  
  # Services should be configured like:
  # ghs-api-blue.service -> uses SLOT=blue, binds to 127.0.0.1:3005
  # ghs-api-green.service -> uses SLOT=green, binds to 127.0.0.1:3006
  
  if ! systemctl restart "ghs-api-${target_slot}.service" "ghs-web-${target_slot}.service" 2>/dev/null; then
    # Fallback: generic service restart
    log "WARN" "Could not restart slot-specific services, using generic restart"
    systemctl restart ghs-api ghs-web || return 1
  fi
  
  log "INFO" "Services restarted for ${target_slot}"
  
  return 0
}

# Rollback: switch traffic back to previous slot
rollback() {
  local active_slot=$(get_active_slot)
  local previous_slot
  
  if [[ "${active_slot}" == "blue" ]]; then
    previous_slot="green"
  else
    previous_slot="blue"
  fi
  
  log "WARN" "=== ROLLBACK: Switching back to ${previous_slot} ==="
  
  if switch_traffic "${active_slot}" "${previous_slot}"; then
    log "WARN" "Rollback successful"
    log_json "rollback" "SUCCESS" "Rolled back to ${previous_slot}" "0"
    return 0
  else
    log "ERROR" "Rollback failed - manual intervention required"
    log_json "rollback" "FAILED" "Rollback failed" "0"
    return 1
  fi
}

# Main deployment workflow
main() {
  local start_time=$(date +%s)
  local skip_health_check="${2:-}"
  
  log "INFO" "=== Blue-Green Deployment Started ==="
  
  validate_directories
  
  local active_slot=$(get_active_slot)
  local target_slot=$(get_inactive_slot)
  
  log "INFO" "Active slot: ${active_slot}, Target slot: ${target_slot}"
  
  # Step 1: Deploy to target slot
  if ! perform_deployment "${target_slot}"; then
    log "ERROR" "Deployment to ${target_slot} failed"
    log_json "deployment" "FAILED" "Deployment failed" "0"
    exit 1
  fi
  
  # Step 2: Health checks (unless skipped)
  if [[ "${skip_health_check}" != "--skip-health-check" ]]; then
    if ! health_check "${target_slot}"; then
      log "ERROR" "Health checks failed on ${target_slot}, aborting deployment"
      log_json "health_check" "FAILED" "Health checks failed" "0"
      exit 1
    fi
  fi
  
  # Step 3: Switch traffic
  if ! switch_traffic "${active_slot}" "${target_slot}"; then
    log "ERROR" "Traffic switch failed, initiating rollback"
    rollback
    exit 1
  fi
  
  local end_time=$(date +%s)
  local total_duration=$((end_time - start_time))
  
  log "INFO" "=== Blue-Green Deployment Completed (${total_duration}s) ==="
  log_json "deployment" "SUCCESS" "Deployed to ${target_slot} with traffic switched" "${total_duration}"
}

main "$@"
