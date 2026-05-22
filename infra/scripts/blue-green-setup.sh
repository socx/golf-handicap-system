#!/bin/bash
# Blue-green deployment infrastructure setup
# Installs scripts, systemd units, and validates configuration
# Usage: sudo bash infra/scripts/blue-green-setup.sh

set -euo pipefail

echo "[ghs-blue-green-setup] Starting blue-green deployment setup..."

# Create necessary directories
mkdir -p /opt/apps/ghs-blue /opt/apps/ghs-green
chmod 755 /opt/apps/ghs-blue /opt/apps/ghs-green

echo "[ghs-blue-green-setup] Created deployment directories"

# Install deployment scripts
cp infra/scripts/blue-green-deploy.sh /usr/local/bin/ghs-blue-green-deploy
cp infra/scripts/blue-green-rollback.sh /usr/local/bin/ghs-blue-green-rollback
cp infra/scripts/blue-green-health-check.sh /usr/local/bin/ghs-blue-green-health-check

chmod +x /usr/local/bin/ghs-blue-green-deploy
chmod +x /usr/local/bin/ghs-blue-green-rollback
chmod +x /usr/local/bin/ghs-blue-green-health-check

echo "[ghs-blue-green-setup] Installed deployment scripts to /usr/local/bin/"

# Create/initialize active slot file
ACTIVE_SLOT_FILE="/var/run/ghs-active-slot"
if [[ ! -f "${ACTIVE_SLOT_FILE}" ]]; then
  echo "blue" > "${ACTIVE_SLOT_FILE}"
fi
chmod 644 "${ACTIVE_SLOT_FILE}"

echo "[ghs-blue-green-setup] Initialized active slot file: ${ACTIVE_SLOT_FILE}"

# Install systemd service units
cp infra/systemd/ghs-api-blue.service /etc/systemd/system/
cp infra/systemd/ghs-api-green.service /etc/systemd/system/
cp infra/systemd/ghs-web-blue.service /etc/systemd/system/
cp infra/systemd/ghs-web-green.service /etc/systemd/system/

echo "[ghs-blue-green-setup] Installed systemd service units"

# Reload systemd
systemctl daemon-reload

echo "[ghs-blue-green-setup] Reloaded systemd daemon"

# Create log directory
mkdir -p /var/log
touch /var/log/ghs-deploy.log /var/log/ghs-deploy-status.jsonl
chmod 666 /var/log/ghs-deploy.log /var/log/ghs-deploy-status.jsonl

echo "[ghs-blue-green-setup] Created log files"

# Display next steps
echo ""
echo "[ghs-blue-green-setup] Setup complete!"
echo ""
echo "[ghs-blue-green-setup] Next steps:"
echo "  1. Configure nginx upstream to switch between ghs-blue:3005/5175 and ghs-green:3006/5176"
echo "  2. Deploy release to /opt/apps/ghs-blue (or ghs-green based on current slot)"
echo "  3. Run: ghs-blue-green-deploy [--blue|--green] [--skip-health-check]"
echo "  4. For rollback: ghs-blue-green-rollback [--force]"
echo "  5. For health check: ghs-blue-green-health-check [--check-both]"
echo ""
echo "[ghs-blue-green-setup] Useful commands:"
echo "  # View deployment logs"
echo "  tail -f /var/log/ghs-deploy.log"
echo "  cat /var/log/ghs-deploy-status.jsonl | jq"
echo ""
echo "  # View current active slot"
echo "  cat /var/run/ghs-active-slot"
echo ""
echo "  # Check service status"
echo "  systemctl status ghs-api-blue ghs-api-green"
echo "  systemctl status ghs-web-blue ghs-web-green"
echo ""
echo "  # View service logs"
echo "  journalctl -u ghs-api-blue -n 50"
echo "  journalctl -u ghs-api-green -n 50"
