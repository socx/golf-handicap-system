# Infra

Nginx reverse-proxy configuration and systemd service files for the GHS services (`ghs-web`, `ghs-api`, `ghs-worker`) live in the shared infrastructure repo:

**https://github.com/socx/do-nginx-infra/tree/nginx-config**

This repo's responsibility is only to deploy the application code to the correct path and restart those services. See `.github/workflows/ci.yml`.

## Deploy target

| Service     | Working directory              | Port  |
|-------------|-------------------------------|-------|
| `ghs-web`   | `/opt/apps/ghs/apps/web`      | 5175  |
| `ghs-api`   | `/opt/apps/ghs/apps/api`      | 3005  |
| `ghs-worker`| `/opt/apps/ghs/apps/worker`   | —     |

## Database migrations

Database migrations run automatically during deploy as part of the CI/CD workflow (see `.github/workflows/ci.yml`).

**Migration workflow:**
1. Extract release to droplet
2. Validate migrations with `--dry-run` flag
3. Execute migrations (if dry-run passes)
4. Restart services

**To add a migration:**
1. Create a new SQL file in `db/migrations/` with numeric prefix (e.g. `001_init_schema.sql`)
2. Commit and push to `main`
3. Next deploy will execute the migration automatically
4. Rollback scripts are generated in `/tmp/ghs-rollbacks/` on the droplet

**Manual migration execution:**
```bash
export DATABASE_URL="postgresql://user:pass@host/ghs_db"
bash infra/scripts/run-migrations.sh       # Run all pending migrations
bash infra/scripts/run-migrations.sh --dry-run  # Validate without applying
```

## Blue-green deployment (zero-downtime releases)

Blue-green deployment enables safe, reversible releases with automatic rollback and <30s switch time.

**Architecture:**
- Two parallel deployment slots: `/opt/apps/ghs-blue` and `/opt/apps/ghs-green`
- Services run on dedicated ports:
  - Blue: API on 3005, Web on 5175
  - Green: API on 3006, Web on 5176
- Nginx routes to active slot via `/var/run/ghs-active-slot` file
- Both slots stay running; traffic switches instantly with nginx reload

**Setup on droplet:**
```bash
sudo bash infra/scripts/blue-green-setup.sh
```

This installs:
- `/usr/local/bin/ghs-blue-green-deploy` — Deploy to staging slot
- `/usr/local/bin/ghs-blue-green-rollback` — Instant rollback to previous slot
- `/usr/local/bin/ghs-blue-green-health-check` — Validate health before switch
- Systemd service units: `ghs-api-blue`, `ghs-api-green`, `ghs-web-blue`, `ghs-web-green`

**Deployment workflow:**
```bash
# 1. Deploy to inactive (staging) slot
ghs-blue-green-deploy

# Or specify target slot explicitly:
ghs-blue-green-deploy --blue   # Deploy to blue slot
ghs-blue-green-deploy --green  # Deploy to green slot

# 2. Script automatically:
#    - Deploys code to staging slot
#    - Runs health checks on staging
#    - Switches traffic from active to staging
#    - Returns inactive slot to previous active state

# 3. Verify deployment
curl https://ghs.socx.org.uk/api/health

# 4. If issues detected, instant rollback:
ghs-blue-green-rollback

# Or force rollback:
ghs-blue-green-rollback --force
```

**Health checks:**
```bash
# Check public endpoint (via nginx)
ghs-blue-green-health-check

# Check both slots individually
ghs-blue-green-health-check --check-both

# Custom timeout
ghs-blue-green-health-check --timeout 60
```

**Monitoring deployment:**
```bash
# View deployment logs
tail -f /var/log/ghs-deploy.log

# View deployment status (JSON format for Loki)
cat /var/log/ghs-deploy-status.jsonl | jq

# Check current active slot
cat /var/run/ghs-active-slot

# Service status
systemctl status ghs-api-blue ghs-api-green
systemctl status ghs-web-blue ghs-web-green
```

**Switch time guarantees:**
- Deployment: ~20-60s (depends on app startup time)
- Health checks: configurable, default 10 retries × 3s = 30s buffer
- Traffic switch: <1s (nginx reload)
- Rollback: <30s (instant switch + health verification)

**Nginx configuration:**
Blue-green deployment requires nginx to route based on active slot. See `infra/nginx/blue-green-example.conf` for configuration options:
- **Symlink approach** (recommended): `/opt/apps/ghs` -> symlinks to active slot, simple but requires symlink management
- **Explicit upstreams**: Two upstream definitions with nginx reload (standard nginx, no modules required)
- **Lua-based**: Dynamic routing via Lua script that reads active slot file (requires ngx_http_lua_module)

The nginx config should be in the shared `do-nginx-infra` repository. Coordinate with infrastructure team to implement chosen approach.

**Integration with CI/CD:**
The `.github/workflows/ci.yml` deploy step should:
1. Extract release archive to both slots or one slot
2. Call `ghs-blue-green-deploy [--blue|--green]` to handle routing
3. Script handles health checks and traffic switching automatically

## Monitoring & alerting

Prometheus + Grafana for monitoring system and application metrics.

**Setup:**
```bash
# On the droplet:
sudo bash infra/scripts/prometheus-setup.sh

# Optionally configure AlertManager for Slack/email:
export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
export ALERT_EMAIL="ops@example.com"
sudo -E bash infra/scripts/alertmanager-setup.sh
```

**Access:**
- Prometheus: http://droplet-ip:9090 (port 9090, restrict via firewall)
- Grafana: http://droplet-ip:3000 (port 3000, default creds: admin/admin)
- Node Exporter: http://droplet-ip:9100 (system metrics)
- AlertManager: http://droplet-ip:9093 (alert management)

**Alerting rules:** See `infra/monitoring/alerts.yml`

**For API application metrics:**
- Add Prometheus client library to `apps/api`
- Expose `/metrics` endpoint on app (e.g., port 3005)
- Prometheus config auto-scrapes it

## Centralised logging (Loki + Promtail)

Loki + Promtail provide searchable centralized logs from app/system services.

**Provision on droplet:**
```bash
sudo bash infra/scripts/logging-setup.sh
```

**What gets aggregated:**
- Backend logs: systemd journal units including `ghs-api`, `ghs-web`, `ghs-worker`
- Frontend edge logs: nginx access logs (`/var/log/nginx/access.log`)
- Database events: PostgreSQL logs (`/var/log/postgresql/*.log`)

**Configuration files:**
- `infra/logging/loki-config.yml`
- `infra/logging/promtail-config.yml`

**Search fields in Grafana Explore (Loki labels):**
- `timestamp` (from log event time)
- `requestId` (from API structured logs)
- `userId` (from `x-user-id` request header when present)
- `unit`, `job`, `service`

**Retention policy:**
- 30-day log retention configured in `loki-config.yml` (`retention_period: 30d`)

## Database backups & restore testing

Automated PostgreSQL backups with dual schedule (hourly + daily) and monthly restore testing.

**Setup on droplet:**
```bash
sudo bash infra/scripts/backup-setup.sh
```

This installs:
- `/usr/local/bin/ghs-pg-backup` — Backup script
- `/usr/local/bin/ghs-pg-restore-test` — Restore test script
- Systemd service/timer units for automated backups

**Backup schedule:**
- **Hourly backups**: Run every hour, keep last 48 hours
- **Daily backups**: Run at 2:00 AM UTC, keep last 30 days
- **Restore tests**: Run monthly on the 1st at 3:00 AM UTC

**Backup directory structure:**
```
/var/backups/ghs/postgres/
├── hourly/              # Hourly backups (48-hour retention)
├── daily/               # Daily backups (30-day retention)
├── restore-tests/       # Monthly restore test logs
└── logs/
    ├── backup.log              # Human-readable backup log
    ├── backup-status.jsonl     # JSON log lines (parseable by Loki)
    └── restore-test.log        # Restore test results
```

**Configuration (env vars):**
```bash
DB_NAME=ghs_db
DB_USER=ghs_db_super_user
DB_HOST=127.0.0.1
DB_PORT=5432
BACKUP_DIR=/var/backups/ghs/postgres
BACKUP_RETENTION_HOURLY=48    # Hours
BACKUP_RETENTION_DAILY=30     # Days
```

**Manual backup execution:**
```bash
# Trigger daily backup immediately
sudo systemctl start ghs-db-backup-daily.service

# Trigger hourly backup immediately
sudo systemctl start ghs-db-backup-hourly.service

# Run restore test (creates temp test database, restores, validates, drops)
sudo /usr/local/bin/ghs-pg-restore-test

# Restore test with specific backup file
sudo /usr/local/bin/ghs-pg-restore-test /var/backups/ghs/postgres/daily/ghs_db-20260501-020000.dump

# Restore from backup to production database (manual recovery):
# 1. Create recovery database
psql -U ghs_db_super_user -c "CREATE DATABASE ghs_db_recovery;"
# 2. Restore backup
pg_restore -d ghs_db_recovery /var/backups/ghs/postgres/daily/ghs_db-20260501-020000.dump
# 3. Verify recovery database
psql -U ghs_db_super_user -d ghs_db_recovery -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
# 4. Swap databases (after validation)
psql -U ghs_db_super_user -c "ALTER DATABASE ghs_db RENAME TO ghs_db_old;"
psql -U ghs_db_super_user -c "ALTER DATABASE ghs_db_recovery RENAME TO ghs_db;"
# 5. Restart services
systemctl restart ghs-api ghs-web
```

**Monitoring backup health:**
```bash
# View backup logs
tail -f /var/backups/ghs/postgres/logs/backup.log

# View backup status (JSON format, parsed by Loki)
cat /var/backups/ghs/postgres/logs/backup-status.jsonl | jq '.[latest]'

# View recent backup history
systemctl status ghs-db-backup-daily.service --no-pager
systemctl status ghs-db-backup-hourly.service --no-pager

# Check backup file sizes
du -sh /var/backups/ghs/postgres/daily/*
du -sh /var/backups/ghs/postgres/hourly/*

# List scheduled timers
systemctl list-timers ghs-db-backup-* --no-pager

# View restore test results
tail -f /var/backups/ghs/postgres/restore-tests/logs/restore-test.log
```

**Backup alerts (via Prometheus + Loki):**
- `PostgreSQLBackupFailed` — Backup process exited with error (severity: critical)
- `PostgreSQLBackupMissed` — No successful backup in last 24 hours (severity: warning)
- `PostgreSQLRestoreTestFailed` — Monthly restore test failed (severity: warning)
- `BackupDiskSpaceLow` — Backup partition <10% free (severity: warning)

See `infra/monitoring/alerts.yml` for full alert rules.

**External backup storage (recommended for production):**

For additional RTO/RPO protection:
1. Configure WAL archiving to external storage (S3/Spaces) in PostgreSQL `postgresql.conf`
2. Copy daily backup dumps to DigitalOcean Spaces or external object storage
3. Maintain backup copies in geographic redundancy

Example:
```bash
# In compress/upload script (cron job):
# After backup-setup.sh completes, add:
aws s3 cp /var/backups/ghs/postgres/daily/ s3://my-backup-bucket/ghs-db/ --recursive
```

## Caching layer (Redis)

Redis is used for TTL-based API response caching for high-traffic reads.

**Provision Redis on droplet:**
```bash
sudo bash infra/scripts/redis-setup.sh
```

**APP_ENV_FILE values:**
```bash
REDIS_URL=redis://127.0.0.1:6379
CACHE_TTL_DASHBOARD_SECONDS=60
CACHE_TTL_LEADERBOARD_SECONDS=45
CACHE_TTL_SETTINGS_SECONDS=300
# Optional: protects manual invalidation endpoint
CACHE_ADMIN_KEY=<strong-random-value>
```

**Cached endpoints in `apps/api`:**
- `GET /api/dashboard`
- `GET /api/leaderboard?clubId=<id>`
- `GET /api/settings`

**Manual cache invalidation endpoint:**
```bash
# Invalidate all cached resources
curl -X POST "http://127.0.0.1:3005/api/cache/invalidate?target=all" \
  -H "x-cache-admin-key: $CACHE_ADMIN_KEY"

# Invalidate one cache resource
curl -X POST "http://127.0.0.1:3005/api/cache/invalidate?target=leaderboard" \
  -H "x-cache-admin-key: $CACHE_ADMIN_KEY"
```

**Automated smoke check (recommended):**
```bash
# Local API port check (on droplet)
BASE_URL="http://127.0.0.1:3005" CACHE_ADMIN_KEY="<your-key>" \
  bash infra/scripts/redis-smoke.sh

# Public domain check (skip local redis-cli ping)
CHECK_LOCAL_REDIS=false BASE_URL="https://ghs.socx.org.uk" CACHE_ADMIN_KEY="<your-key>" \
  bash infra/scripts/redis-smoke.sh
```

**Cache invalidation rules:**
- Dashboard cache: invalidate on round create/update/delete, handicap recalculation, and daily stats rollup.
- Leaderboard cache: invalidate on score posting, score correction, leaderboard rule/config changes.
- Settings cache: invalidate on tenant/app settings updates or feature-flag changes.
- Emergency/manual invalidation available via `POST /api/cache/invalidate`.

## Object storage (DigitalOcean Spaces)

Store PDFs, images, and assets in DigitalOcean Spaces (S3-compatible).

**Setup:**
```bash
# Configure bucket via DigitalOcean Console (or follow script guide):
bash infra/scripts/do-spaces-setup.sh
```

**GitHub repository secrets required:**
| Secret | Description |
|--------|-------------|
| `DO_SPACES_ENDPOINT` | https://nyc3.digitaloceanspaces.com (your region) |
| `DO_SPACES_REGION` | nyc3 (your region) |
| `DO_SPACES_BUCKET` | Bucket name |
| `DO_SPACES_KEY` | Access Key |
| `DO_SPACES_SECRET` | Secret Key |

**Usage in application:**
```javascript
const StorageClient = require('@ghs/storage-client');
const storage = new StorageClient();

// Upload file
const url = await storage.uploadFile(buffer, 'pdfs/invoice.pdf', {
  contentType: 'application/pdf',
});

// Get signed URL (expires in 1 hour)
const signedUrl = await storage.getSignedUrl('pdfs/invoice.pdf', 3600);

// Delete old files
await storage.deleteFile('pdfs/old-invoice.pdf');
```

**Storage client API:** See `packages/storage-client/src/index.js` for full documentation.

## Required repo secrets

| Secret            | Description                     |
|-------------------|---------------------------------|
| `DROPLET_HOST`    | DigitalOcean droplet IP/hostname|
| `DROPLET_USER`    | SSH username (e.g. `deploy`)    |
| `DROPLET_SSH_KEY` | Private SSH key for that user   |
| `APP_ENV_FILE`    | Environment variables (includes `DATABASE_URL`) |
| `DO_SPACES_KEY`   | DigitalOcean Spaces access key  |
| `DO_SPACES_SECRET`| DigitalOcean Spaces secret key  |
