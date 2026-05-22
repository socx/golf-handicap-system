#!/usr/bin/env bash
# pgbouncer-setup.sh — Install and configure PgBouncer connection pooler.
#
# Run once on the droplet as root (or with sudo):
#   sudo bash infra/scripts/pgbouncer-setup.sh
#
# PgBouncer listens on 127.0.0.1:6432 and proxies to PostgreSQL on 127.0.0.1:5432.
# Update DATABASE_URL in the API_ENV_FILE secret to:
#   postgresql://ghs_db_super_user:<password>@127.0.0.1:6432/ghs_db
#
# Pool mode: transaction — suitable for stateless Node.js API workers.

set -euo pipefail

DB_NAME="${DB_NAME:-ghs_db}"
DB_USER="${DB_USER:-ghs_db_super_user}"
# PASSWORD must be set in the calling environment or edited below.
DB_PASSWORD="${DB_PASSWORD:-}"

if [ -z "$DB_PASSWORD" ]; then
  echo "ERROR: DB_PASSWORD env var must be set." >&2
  exit 1
fi

echo "[pgbouncer-setup] Installing PgBouncer..."
apt-get update -qq
apt-get install -y pgbouncer

PGBOUNCER_CONF=/etc/pgbouncer/pgbouncer.ini
USERLIST=/etc/pgbouncer/userlist.txt

echo "[pgbouncer-setup] Writing $PGBOUNCER_CONF"
cat > "$PGBOUNCER_CONF" <<EOF
[databases]
${DB_NAME} = host=127.0.0.1 port=5432 dbname=${DB_NAME}

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = ${USERLIST}
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
reserve_pool_size = 5
reserve_pool_timeout = 3
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
pidfile = /var/run/postgresql/pgbouncer.pid
EOF

# Generate md5 password hash: md5 + md5(<password><user>)
MD5HASH="md5$(printf '%s' "${DB_PASSWORD}${DB_USER}" | md5sum | awk '{print $1}')"
echo "[pgbouncer-setup] Writing $USERLIST"
printf '"%s" "%s"\n' "$DB_USER" "$MD5HASH" > "$USERLIST"
chmod 640 "$USERLIST"
chown postgres:postgres "$USERLIST"

echo "[pgbouncer-setup] Enabling and starting pgbouncer..."
systemctl enable pgbouncer
systemctl restart pgbouncer
systemctl status pgbouncer --no-pager

echo ""
echo "[pgbouncer-setup] Done."
echo "Update DATABASE_URL to: postgresql://${DB_USER}:<password>@127.0.0.1:6432/${DB_NAME}"
