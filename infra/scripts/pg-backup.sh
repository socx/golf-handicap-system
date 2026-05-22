#!/usr/bin/env bash
# pg-backup.sh — Daily pg_dump backup with 7-day retention.
#
# Install:
#   sudo cp pg-backup.sh /usr/local/bin/ghs-pg-backup
#   sudo chmod +x /usr/local/bin/ghs-pg-backup
#   sudo cp ghs-db-backup.service ghs-db-backup.timer /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now ghs-db-backup.timer
#
# Verify:
#   sudo systemctl list-timers ghs-db-backup.timer
#   sudo journalctl -u ghs-db-backup.service -n 50

set -euo pipefail

DB_NAME="${DB_NAME:-ghs_db}"
DB_USER="${DB_USER:-ghs_db_super_user}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ghs/postgres}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "[ghs-pg-backup] Starting backup of $DB_NAME at $TIMESTAMP"

pg_dump \
  --username="$DB_USER" \
  --format=custom \
  --file="$BACKUP_FILE" \
  "$DB_NAME"

echo "[ghs-pg-backup] Backup written to $BACKUP_FILE"

# Remove backups older than RETAIN_DAYS.
find "$BACKUP_DIR" -name "${DB_NAME}-*.dump" -mtime +"$RETAIN_DAYS" -delete
echo "[ghs-pg-backup] Pruned backups older than ${RETAIN_DAYS} days"
