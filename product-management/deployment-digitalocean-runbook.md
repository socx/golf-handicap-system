# DigitalOcean Deployment and Rollback Runbook

This runbook covers deployment for `ghs.socx.org.uk`.

- **Nginx** configuration is managed in [socx/do-nginx-infra](https://github.com/socx/do-nginx-infra/tree/nginx-config). No nginx config lives in this repo.
- **Process management** uses systemd units `ghs-web`, `ghs-api`, `ghs-worker` defined in that same infra repo. No PM2.
- **Automated deploy** runs via `.github/workflows/deploy.yml` on every push to `main`.

## 1. Prerequisites

- DigitalOcean droplet with SSH access and the infra repo applied (nginx + systemd units installed)
- Domain DNS for `ghs.socx.org.uk` pointed at the droplet
- TLS certificate present in `/etc/letsencrypt/live/ghs.socx.org.uk/`
- Node.js 20 (via nvm) accessible to the `deploy` user
- Repo secrets set: `DROPLET_HOST`, `DROPLET_USER`, `DROPLET_SSH_KEY`

## 2. Deploy Target

All app code is extracted to `/opt/apps/ghs/` on the droplet:

| Service      | Path                           | Port  |
|--------------|-------------------------------|-------|
| `ghs-web`    | `/opt/apps/ghs/apps/web`      | 5175  |
| `ghs-api`    | `/opt/apps/ghs/apps/api`      | 3005  |
| `ghs-worker` | `/opt/apps/ghs/apps/worker`   | —     |

## 3. Automated Deploy (normal path)

Push to `main`. The workflow in `.github/workflows/deploy.yml`:
1. Builds the frontend (`apps/web`)
2. Runs API tests (`apps/api`)
3. Tarballs the repo (no `.git` or `node_modules`)
4. SCPs the tarball to the droplet
5. SSHes in, extracts to `/opt/apps/ghs`, installs prod dependencies, then restarts `ghs-web`, `ghs-api`, `ghs-worker` via systemd

## 4. Manual Deploy

```bash
ssh deploy@<droplet>
APP_DIR=/opt/apps/ghs

# extract a tarball you've prepped locally (release.tgz)
sudo mkdir -p "$APP_DIR" && sudo chown deploy:deploy "$APP_DIR"
tar -xzf /tmp/release.tgz -C "$APP_DIR"

cd "$APP_DIR/apps/web"    && npm ci --omit=dev
cd "$APP_DIR/apps/api"    && npm ci --omit=dev
cd "$APP_DIR/apps/worker" && npm ci --omit=dev

sudo systemctl daemon-reload
sudo systemctl restart ghs-web ghs-api ghs-worker
```

## 5. Smoke Checks

```bash
curl -fsS https://ghs.socx.org.uk/ >/dev/null
curl -fsS https://ghs.socx.org.uk/api/health
```

Expected API response: JSON with `status: "ok"`.

## 6. Rollback

Re-deploy a previous known-good git SHA via `workflow_dispatch` (pick the commit in the Actions UI), or manually:

```bash
ssh deploy@<droplet>

# extract a tarball of the previous release
tar -xzf /tmp/previous-release.tgz -C /opt/apps/ghs

cd /opt/apps/ghs/apps/web    && npm ci --omit=dev
cd /opt/apps/ghs/apps/api    && npm ci --omit=dev
cd /opt/apps/ghs/apps/worker && npm ci --omit=dev

sudo systemctl restart ghs-web ghs-api ghs-worker
```

Re-run smoke checks. If still failing, inspect logs:

```bash
sudo journalctl -u ghs-web   -n 200 --no-pager
sudo journalctl -u ghs-api   -n 200 --no-pager
sudo journalctl -u ghs-worker -n 200 --no-pager
sudo journalctl -u nginx      -n 200 --no-pager
```