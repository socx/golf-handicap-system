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

## Required repo secrets

| Secret            | Description                     |
|-------------------|---------------------------------|
| `DROPLET_HOST`    | DigitalOcean droplet IP/hostname|
| `DROPLET_USER`    | SSH username (e.g. `deploy`)    |
| `DROPLET_SSH_KEY` | Private SSH key for that user   |
| `APP_ENV_FILE`    | Environment variables (includes `DATABASE_URL`) |
