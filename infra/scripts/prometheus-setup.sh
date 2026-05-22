#!/usr/bin/env bash
# prometheus-setup.sh — Install and configure Prometheus + Node Exporter + Grafana.
#
# Run once on the droplet as root:
#   sudo bash infra/scripts/prometheus-setup.sh
#
# After installation:
#   - Prometheus listens on http://127.0.0.1:9090
#   - Node Exporter listens on http://127.0.0.1:9100
#   - Grafana listens on http://127.0.0.1:3000 (default password: admin/admin)

set -euo pipefail

PROMETHEUS_VERSION="2.50.0"
NODE_EXPORTER_VERSION="1.7.0"
GRAFANA_VERSION="10.2.0"
APP_USER="prometheus"
PROM_HOME="/opt/prometheus"

echo "[prometheus-setup] Installing system packages..."
apt-get update -qq
apt-get install -y curl wget gnupg lsb-release

echo "[prometheus-setup] Creating prometheus user..."
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --no-create-home --shell /bin/false "$APP_USER" || true
fi

mkdir -p "$PROM_HOME/etc" "$PROM_HOME/data"
chown -R "$APP_USER:$APP_USER" "$PROM_HOME"

# Install Prometheus.
echo "[prometheus-setup] Installing Prometheus $PROMETHEUS_VERSION..."
cd /tmp
wget -q https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz
tar -xzf prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz
cp prometheus-${PROMETHEUS_VERSION}.linux-amd64/prometheus /usr/local/bin/
cp prometheus-${PROMETHEUS_VERSION}.linux-amd64/promtool /usr/local/bin/
rm -rf prometheus-${PROMETHEUS_VERSION}.linux-amd64*
chmod +x /usr/local/bin/prometheus /usr/local/bin/promtool

# Install Node Exporter.
echo "[prometheus-setup] Installing Node Exporter $NODE_EXPORTER_VERSION..."
wget -q https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
tar -xzf node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
cp node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64/node_exporter /usr/local/bin/
rm -rf node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64*
chmod +x /usr/local/bin/node_exporter

# Install Grafana.
echo "[prometheus-setup] Installing Grafana $GRAFANA_VERSION..."
wget -q https://dl.grafana.com/oss/release/grafana-${GRAFANA_VERSION}.linux-amd64.tar.gz
tar -xzf grafana-${GRAFANA_VERSION}.linux-amd64.tar.gz -C /opt
ln -sf /opt/grafana-${GRAFANA_VERSION} /opt/grafana
rm grafana-${GRAFANA_VERSION}.linux-amd64.tar.gz

# Create basic prometheus.yml if not already present.
if [ ! -f "$PROM_HOME/etc/prometheus.yml" ]; then
  cat > "$PROM_HOME/etc/prometheus.yml" <<'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: []

rule_files:
  - "/opt/prometheus/etc/alerts.yml"

scrape_configs:
  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['127.0.0.1:9090']

  # Node Exporter (system metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['127.0.0.1:9100']

  # API application metrics (port 3005)
  - job_name: 'ghs-api'
    static_configs:
      - targets: ['127.0.0.1:3005']
    metrics_path: '/metrics'
EOF
  chown "$APP_USER:$APP_USER" "$PROM_HOME/etc/prometheus.yml"
fi

# Create systemd services.
cat > /etc/systemd/system/prometheus.service <<'EOF'
[Unit]
Description=Prometheus monitoring system
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=prometheus
Group=prometheus
ExecStart=/usr/local/bin/prometheus \
  --config.file=/opt/prometheus/etc/prometheus.yml \
  --storage.tsdb.path=/opt/prometheus/data \
  --web.listen-address=127.0.0.1:9090
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/node-exporter.service <<'EOF'
[Unit]
Description=Prometheus Node Exporter
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=prometheus
Group=prometheus
ExecStart=/usr/local/bin/node_exporter --web.listen-address=127.0.0.1:9100
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/grafana.service <<'EOF'
[Unit]
Description=Grafana dashboard and graph editor
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=prometheus
Group=prometheus
WorkingDirectory=/opt/grafana
ExecStart=/opt/grafana/bin/grafana-server --config=/opt/grafana/conf/defaults.ini
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "[prometheus-setup] Enabling and starting services..."
systemctl daemon-reload
systemctl enable prometheus node-exporter grafana
systemctl start prometheus node-exporter grafana
sleep 2

echo "[prometheus-setup] Verifying services..."
systemctl status prometheus --no-pager | head -3
systemctl status node-exporter --no-pager | head -3
systemctl status grafana --no-pager | head -3

echo ""
echo "[prometheus-setup] Done!"
echo "Prometheus: http://127.0.0.1:9090"
echo "Node Exporter: http://127.0.0.1:9100"
echo "Grafana: http://127.0.0.1:3000 (default creds: admin/admin)"
