# Infra

Nginx reverse-proxy configuration and systemd service files for the GHS services (`ghs-web`, `ghs-api`, `ghs-worker`) live in the shared infrastructure repo:

**https://github.com/socx/do-nginx-infra/tree/nginx-config**

This repo's responsibility is only to deploy the application code to the correct path and restart those services. See `.github/workflows/deploy.yml`.

## Deploy target

| Service     | Working directory              | Port  |
|-------------|-------------------------------|-------|
| `ghs-web`   | `/opt/apps/ghs/apps/web`      | 5175  |
| `ghs-api`   | `/opt/apps/ghs/apps/api`      | 3005  |
| `ghs-worker`| `/opt/apps/ghs/apps/worker`   | —     |

## Required repo secrets

| Secret            | Description                     |
|-------------------|---------------------------------|
| `DROPLET_HOST`    | DigitalOcean droplet IP/hostname|
| `DROPLET_USER`    | SSH username (e.g. `deploy`)    |
| `DROPLET_SSH_KEY` | Private SSH key for that user   |
