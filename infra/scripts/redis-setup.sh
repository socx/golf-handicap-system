#!/usr/bin/env bash
# redis-setup.sh — Install and configure Redis for GHS API response caching.
#
# Run once on the droplet as root:
#   sudo bash infra/scripts/redis-setup.sh
#
# Result:
#   - Redis bound to 127.0.0.1:6379
#   - AOF persistence enabled
#   - LRU eviction policy configured for cache workloads

set -euo pipefail

REDIS_BIND_ADDR="${REDIS_BIND_ADDR:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_MAXMEMORY="${REDIS_MAXMEMORY:-256mb}"

echo "[redis-setup] Installing redis-server..."
apt-get update -qq
apt-get install -y redis-server

REDIS_CONF="/etc/redis/redis.conf"

echo "[redis-setup] Configuring ${REDIS_CONF}"
sed -i "s/^bind .*/bind ${REDIS_BIND_ADDR}/" "$REDIS_CONF"
sed -i "s/^port .*/port ${REDIS_PORT}/" "$REDIS_CONF"
sed -i "s/^supervised .*/supervised systemd/" "$REDIS_CONF"
sed -i "s/^#* *appendonly .*/appendonly yes/" "$REDIS_CONF"

if grep -q "^maxmemory " "$REDIS_CONF"; then
  sed -i "s/^maxmemory .*/maxmemory ${REDIS_MAXMEMORY}/" "$REDIS_CONF"
else
  printf "\nmaxmemory %s\n" "$REDIS_MAXMEMORY" >> "$REDIS_CONF"
fi

if grep -q "^maxmemory-policy " "$REDIS_CONF"; then
  sed -i "s/^maxmemory-policy .*/maxmemory-policy allkeys-lru/" "$REDIS_CONF"
else
  printf "maxmemory-policy allkeys-lru\n" >> "$REDIS_CONF"
fi

echo "[redis-setup] Enabling and restarting redis-server..."
systemctl enable redis-server
systemctl restart redis-server
sleep 1

echo "[redis-setup] Verifying redis-server status..."
systemctl status redis-server --no-pager | head -5

echo "[redis-setup] Verifying ping response..."
redis-cli -h "$REDIS_BIND_ADDR" -p "$REDIS_PORT" ping

echo ""
echo "[redis-setup] Done."
echo "Set REDIS_URL=redis://${REDIS_BIND_ADDR}:${REDIS_PORT} in APP_ENV_FILE."
