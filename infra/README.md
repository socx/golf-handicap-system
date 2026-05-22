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
