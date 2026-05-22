#!/usr/bin/env bash
# logging-setup.sh — Install Loki + Promtail and configure centralized log collection.
#
# Run once on the droplet as root:
#   sudo bash infra/scripts/logging-setup.sh
#
# Installs:
#   - Loki (127.0.0.1:3100)
#   - Promtail (127.0.0.1:9080)
#
# Collected logs:
#   - systemd journals (ghs-api/ghs-web/ghs-worker + system units)
#   - nginx access logs
#   - postgresql logs

set -euo pipefail

LOKI_VERSION="${LOKI_VERSION:-2.9.8}"
PROMTAIL_VERSION="${PROMTAIL_VERSION:-2.9.8}"

echo "[logging-setup] Installing dependencies..."
apt-get update -qq
apt-get install -y curl wget unzip

if ! id loki >/dev/null 2>&1; then
  useradd --system --home /var/lib/loki --shell /usr/sbin/nologin loki
fi
if ! id promtail >/dev/null 2>&1; then
  useradd --system --home /var/lib/promtail --shell /usr/sbin/nologin promtail
fi

echo "[logging-setup] Installing Loki ${LOKI_VERSION}..."
cd /tmp
wget -q -O loki.zip "https://github.com/grafana/loki/releases/download/v${LOKI_VERSION}/loki-linux-amd64.zip"
unzip -oq loki.zip
install -m 0755 loki-linux-amd64 /usr/local/bin/loki
rm -f loki.zip loki-linux-amd64

echo "[logging-setup] Installing Promtail ${PROMTAIL_VERSION}..."
wget -q -O promtail.zip "https://github.com/grafana/loki/releases/download/v${PROMTAIL_VERSION}/promtail-linux-amd64.zip"
unzip -oq promtail.zip
install -m 0755 promtail-linux-amd64 /usr/local/bin/promtail
rm -f promtail.zip promtail-linux-amd64

mkdir -p /etc/loki /etc/promtail /var/lib/loki/chunks /var/lib/loki/compactor /var/lib/promtail
cp infra/logging/loki-config.yml /etc/loki/config.yml
cp infra/logging/promtail-config.yml /etc/promtail/config.yml

chown -R loki:loki /etc/loki /var/lib/loki
chown -R promtail:promtail /etc/promtail /var/lib/promtail

cat > /etc/systemd/system/loki.service <<'EOF'
[Unit]
Description=Loki log aggregation
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=loki
Group=loki
ExecStart=/usr/local/bin/loki -config.file=/etc/loki/config.yml
Restart=on-failure
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/promtail.service <<'EOF'
[Unit]
Description=Promtail log collector
After=network-online.target loki.service
Wants=network-online.target

[Service]
Type=simple
User=promtail
Group=promtail
ExecStart=/usr/local/bin/promtail -config.file=/etc/promtail/config.yml
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "[logging-setup] Enabling services..."
systemctl daemon-reload
systemctl enable loki promtail
systemctl restart loki promtail
sleep 2

echo "[logging-setup] Verifying service status..."
systemctl status loki --no-pager | head -5
systemctl status promtail --no-pager | head -5

echo ""
echo "[logging-setup] Done."
echo "Loki API: http://127.0.0.1:3100"
echo "Promtail: http://127.0.0.1:9080"
echo "Search logs in Grafana Explore by labels: unit, requestId, userId, job"
