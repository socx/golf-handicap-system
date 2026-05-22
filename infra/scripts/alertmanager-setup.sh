#!/usr/bin/env bash
# alertmanager-setup.sh — Install and configure AlertManager for Slack/email notifications.
#
# Run once on the droplet as root:
#   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
#   export ALERT_EMAIL="ops@example.com"
#   export SMTP_FROM="alertmanager@example.com"
#   export SMTP_SMARTHOST="smtp.gmail.com:587"
#   sudo -E bash infra/scripts/alertmanager-setup.sh

set -euo pipefail

ALERTMANAGER_VERSION="0.26.0"
APP_USER="prometheus"
ALERTMANAGER_HOME="/opt/alertmanager"

echo "[alertmanager-setup] Installing AlertManager $ALERTMANAGER_VERSION..."
mkdir -p "$ALERTMANAGER_HOME/etc" "$ALERTMANAGER_HOME/data"
chown -R "$APP_USER:$APP_USER" "$ALERTMANAGER_HOME"

cd /tmp
wget -q https://github.com/prometheus/alertmanager/releases/download/v${ALERTMANAGER_VERSION}/alertmanager-${ALERTMANAGER_VERSION}.linux-amd64.tar.gz
tar -xzf alertmanager-${ALERTMANAGER_VERSION}.linux-amd64.tar.gz
cp alertmanager-${ALERTMANAGER_VERSION}.linux-amd64/alertmanager /usr/local/bin/
cp alertmanager-${ALERTMANAGER_VERSION}.linux-amd64/amtool /usr/local/bin/
rm -rf alertmanager-${ALERTMANAGER_VERSION}.linux-amd64*
chmod +x /usr/local/bin/alertmanager /usr/local/bin/amtool

# Create alertmanager.yml with Slack and email support.
cat > "$ALERTMANAGER_HOME/etc/alertmanager.yml" <<EOF
global:
  resolve_timeout: 5m

route:
  receiver: 'default'
  repeat_interval: 12h
  group_by: ['alertname', 'cluster', 'service']
  routes:
    - match:
        severity: critical
      receiver: 'critical'
      repeat_interval: 1h

receivers:
  - name: 'default'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL:-}'
        channel: '#alerts'
        title: 'GHS Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}\n{{ end }}'
    email_configs:
      - to: '${ALERT_EMAIL:-}'
        from: '${SMTP_FROM:-alertmanager@example.com}'
        smarthost: '${SMTP_SMARTHOST:-smtp.gmail.com:587}'
        auth_username: '${SMTP_USER:-}'
        auth_password: '${SMTP_PASSWORD:-}'

  - name: 'critical'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL:-}'
        channel: '#critical-alerts'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}\n{{ end }}'
EOF

chown "$APP_USER:$APP_USER" "$ALERTMANAGER_HOME/etc/alertmanager.yml"

# Create systemd service.
cat > /etc/systemd/system/alertmanager.service <<'EOF'
[Unit]
Description=Prometheus AlertManager
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=prometheus
Group=prometheus
ExecStart=/usr/local/bin/alertmanager \
  --config.file=/opt/alertmanager/etc/alertmanager.yml \
  --storage.path=/opt/alertmanager/data \
  --web.listen-address=127.0.0.1:9093
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "[alertmanager-setup] Enabling and starting AlertManager..."
systemctl daemon-reload
systemctl enable alertmanager
systemctl start alertmanager
sleep 2

echo "[alertmanager-setup] Done!"
echo "AlertManager listening on http://127.0.0.1:9093"
