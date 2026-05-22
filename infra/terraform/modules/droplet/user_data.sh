#!/bin/bash
# Droplet user_data script for GHS initialization
# Runs on first boot to set up the environment
# Variables injected by Terraform: project_name, environment

set -euo pipefail

PROJECT_NAME="${project_name:-ghs}"
ENVIRONMENT="${environment:-staging}"

echo "[ghs-init] Starting droplet initialization for $PROJECT_NAME ($ENVIRONMENT)"

# Update system packages
apt-get update
apt-get upgrade -y

# Install system dependencies
apt-get install -y \
  curl \
  wget \
  git \
  vim \
  htop \
  net-tools \
  ufw \
  sqlite3 \
  postgresql-client-16 \
  jq

echo "[ghs-init] System packages installed"

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "[ghs-init] Node.js installed: $(node --version)"

# Create deploy user
if ! id "deploy" &>/dev/null; then
  useradd -m -s /bin/bash deploy
  echo "[ghs-init] Created deploy user"
else
  echo "[ghs-init] Deploy user already exists"
fi

# Create application directories
mkdir -p /opt/apps/{ghs-blue,ghs-green}
chown -R deploy:deploy /opt/apps
chmod -R 755 /opt/apps

mkdir -p /var/backups/ghs/postgres
chown -R deploy:deploy /var/backups/ghs
chmod -R 755 /var/backups/ghs

echo "[ghs-init] Application directories created"

# Create log directory for systemd services
mkdir -p /var/log/ghs
touch /var/log/ghs-deploy.log /var/log/ghs-deploy-status.jsonl
chmod 666 /var/log/ghs-deploy.log /var/log/ghs-deploy-status.jsonl

echo "[ghs-init] Log directories created"

# Enable and start UFW firewall (will be configured by Terraform firewall module)
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

echo "[ghs-init] Firewall enabled with basic rules"

# Create environment file placeholder
mkdir -p /etc/ghs
touch /etc/ghs/.env.production
chmod 600 /etc/ghs/.env.production

echo "[ghs-init] Environment configuration directory created"

# Log completion
echo "[ghs-init] Droplet initialization completed at $(date)"
echo "[ghs-init] System ready for deployment"

# Write completion marker
touch /var/lib/cloud/instance/boot-finished
