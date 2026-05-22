#!/bin/bash
# PostgreSQL backup & restore testing setup script
# Installs backup scripts and configures systemd timers for automated backups
# Usage: sudo bash infra/scripts/backup-setup.sh

set -euo pipefail

echo "[ghs-backup-setup] Starting PostgreSQL backup infrastructure setup..."

# Verify PostgreSQL is installed
if ! command -v pg_dump &> /dev/null; then
  echo "[ghs-backup-setup] ERROR: PostgreSQL client tools not found"
  echo "[ghs-backup-setup] Please install postgresql-client: sudo apt-get install postgresql-client-16"
  exit 1
fi

# Create backup directory structure
BACKUP_DIR="/var/backups/ghs/postgres"
mkdir -p "${BACKUP_DIR}"/{hourly,daily,logs,restore-tests}
chmod 700 "${BACKUP_DIR}"

echo "[ghs-backup-setup] Created backup directory: ${BACKUP_DIR}"

# Install backup script
cp infra/scripts/pg-backup.sh /usr/local/bin/ghs-pg-backup
chmod +x /usr/local/bin/ghs-pg-backup
echo "[ghs-backup-setup] Installed: /usr/local/bin/ghs-pg-backup"

# Install restore test script
cp infra/scripts/pg-restore-test.sh /usr/local/bin/ghs-pg-restore-test
chmod +x /usr/local/bin/ghs-pg-restore-test
echo "[ghs-backup-setup] Installed: /usr/local/bin/ghs-pg-restore-test"

# Install systemd service and timer units
cp infra/systemd/ghs-db-backup-hourly.service /etc/systemd/system/
cp infra/systemd/ghs-db-backup-hourly.timer /etc/systemd/system/
cp infra/systemd/ghs-db-backup-daily.service /etc/systemd/system/
cp infra/systemd/ghs-db-backup-daily.timer /etc/systemd/system/
cp infra/systemd/ghs-db-restore-test.service /etc/systemd/system/
cp infra/systemd/ghs-db-restore-test.timer /etc/systemd/system/

echo "[ghs-backup-setup] Installed systemd units"

# Reload systemd daemon
systemctl daemon-reload
echo "[ghs-backup-setup] Reloaded systemd daemon"

# Enable and start timers
systemctl enable ghs-db-backup-hourly.timer ghs-db-backup-daily.timer ghs-db-restore-test.timer
systemctl start ghs-db-backup-hourly.timer ghs-db-backup-daily.timer ghs-db-restore-test.timer

echo "[ghs-backup-setup] Enabled and started backup timers"

# Verify installation
echo ""
echo "[ghs-backup-setup] Verification:"
echo "  Hourly backup timer:"
systemctl status ghs-db-backup-hourly.timer --no-pager || true
echo ""
echo "  Daily backup timer:"
systemctl status ghs-db-backup-daily.timer --no-pager || true
echo ""
echo "  Restore test timer:"
systemctl status ghs-db-restore-test.timer --no-pager || true

# List scheduled timers
echo ""
echo "[ghs-backup-setup] Next scheduled backup times:"
systemctl list-timers ghs-db-backup-hourly.timer ghs-db-backup-daily.timer ghs-db-restore-test.timer --no-pager || true

# Test connectivity and first backup
echo ""
echo "[ghs-backup-setup] Testing backup configuration..."

if ! pg_isready -h 127.0.0.1 -p 5432 -U ghs_db_super_user >/dev/null 2>&1; then
  echo "[ghs-backup-setup] WARNING: Cannot connect to PostgreSQL as ghs_db_super_user"
  echo "[ghs-backup-setup] Verify database credentials in systemd service files:"
  echo "[ghs-backup-setup]   - /etc/systemd/system/ghs-db-backup-*.service"
  echo "[ghs-backup-setup]   - /etc/systemd/system/ghs-db-restore-test.service"
else
  echo "[ghs-backup-setup] Database connectivity OK"
  
  # Run first manual backup test
  echo "[ghs-backup-setup] Running first manual backup test (daily)..."
  if /usr/local/bin/ghs-pg-backup --daily; then
    echo "[ghs-backup-setup] First backup successful!"
    
    # Check backup file
    LATEST_BACKUP=$(find "${BACKUP_DIR}/daily" -maxdepth 1 -type f -name "*.dump" -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)
    if [[ -n "${LATEST_BACKUP}" ]]; then
      BACKUP_SIZE=$(du -h "${LATEST_BACKUP}" | cut -f1)
      echo "[ghs-backup-setup] Backup file: ${LATEST_BACKUP} (${BACKUP_SIZE})"
    fi
  else
    echo "[ghs-backup-setup] First backup failed - check logs at ${BACKUP_DIR}/logs/"
  fi
fi

echo ""
echo "[ghs-backup-setup] Setup complete!"
echo ""
echo "[ghs-backup-setup] Useful commands:"
echo "  # View backup history"
echo "  sudo journalctl -u ghs-db-backup-daily.service -n 50"
echo "  sudo journalctl -u ghs-db-backup-hourly.service -n 50"
echo ""
echo "  # View backup logs"
echo "  sudo tail -f /var/backups/ghs/postgres/logs/backup.log"
echo "  sudo cat /var/backups/ghs/postgres/logs/backup-status.jsonl | jq"
echo ""
echo "  # Run manual restore test"
echo "  sudo /usr/local/bin/ghs-pg-restore-test"
echo ""
echo "  # List scheduled timers"
echo "  systemctl list-timers ghs-db-* --no-pager"
echo ""
echo "  # Check backup directory"
echo "  ls -lh /var/backups/ghs/postgres/{hourly,daily}/"
