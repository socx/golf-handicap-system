# stories-devops.md
Parent Epic: #309  
(Replace with actual epic issue number after creation)

---

# DevOps, CI/CD, Infrastructure & Deployment — User Stories

This file contains all user stories for the DevOps epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after Leaderboard epic ends): **11 March 2027**

---

## Pre-Development Bootstrap Stories (Do First)

## 0. Local development bootstrap (API + Web)

**As a developer**
I want a reliable local setup for API, Web, PostgreSQL, and Redis
So that feature development can begin immediately with consistent tooling.

**Size:** S
**Estimate:** 1-2 days
**Priority:** High
**Target Date:** **10 March 2027**

### Acceptance Criteria
- [x] Node.js 20 LTS, PostgreSQL 16, and Redis 7/8 verified locally.
- [x] Monorepo structure follows the template:
  - `apps/api`
  - `apps/web`
  - `packages/db`
  - `packages/types`
  - `packages/config`
- [x] `.env` files created and validated for API and web apps.
- [x] DB creation, migration, and seed workflow works end-to-end.
- [x] `npm run dev` (or equivalent monorepo command) starts API and web successfully.
- [x] Health and smoke checks pass:
  - API health endpoint returns 200.
  - Web app loads and can reach `/api` routes.

### Dependencies
- **[Local setup checklist](ca://s?q=Explain_local_setup_checklist)**
- **[Database migrations](ca://s?q=Explain_DB_migration_workflow)**

---

## 0.1 Remote runtime bootstrap (DigitalOcean + Nginx)

**As a developer**
I want a production runtime on a DigitalOcean droplet behind Nginx
So that the app is reachable at `ghs.socx.org.uk` with stable API and worker processes.

**Size:** M
**Estimate:** 2-3 days
**Priority:** High
**Target Date:** **11 March 2027**

### Acceptance Criteria
- [ ] Deployment target is the existing DigitalOcean droplet with Nginx already configured.
- [ ] Domain and TLS are active for `ghs.socx.org.uk`.
- [x] Runtime processes are configured to match Nginx upstream expectations:
  - `ghs_web` -> `127.0.0.1:5175`
  - `ghs_api` -> `127.0.0.1:3005`
  - `ghs_worker` process enabled for async jobs
- [ ] Nginx routing works as configured:
  - `/` proxies to `ghs_web`
  - `/api/*` rewrites and proxies to `ghs_api`
- [ ] API docs/health checks pass over HTTPS on `ghs.socx.org.uk`.
- [x] Deploy/rollback runbook documented in repo docs.

### Dependencies
- **[DigitalOcean runtime setup](ca://s?q=Explain_digitalocean_runtime_setup)**
- **[Nginx host routing](ca://s?q=Explain_nginx_host_based_routing_for_ghs)**

---

## 1. Set up GitHub Actions CI pipeline

**As a developer**  
I want a CI pipeline that runs tests and linting  
So that code quality is enforced automatically.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **11 March 2027**

### Acceptance Criteria
- [ ] **[CI workflow](ca://s?q=Explain_CI_workflow)** runs on PRs + main branch.  
- [ ] Steps:
  - install dependencies  
  - run tests  
  - run linting  
  - build project  
- [ ] Status checks required before merge.  
- [x] Fails fast on errors.

### Dependencies
- **[Test suite](ca://s?q=Explain_test_suite)**  
- **[Linting config](ca://s?q=Explain_linting_config)**

---



## 2. Set up CD pipeline for backend

**As a developer**  
I want a CD pipeline for the backend  
So that deployments are automated and reliable.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **16 March 2027**

### Acceptance Criteria
- [x] **[CD workflow](ca://s?q=Explain_CD_workflow)** deploys backend to staging + production.  
- [ ] Zero‑downtime deployment.  
- [x] Environment variables injected securely.  
- [ ] Rollback supported.

### Dependencies
- **[CI pipeline](ca://s?q=Explain_CI_workflow)**  
- Hosting provider credentials

---



## 3. Set up CD pipeline for frontend

**As a developer**  
I want a CD pipeline for the frontend  
So that the React app is deployed automatically.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **18 March 2027**

### Acceptance Criteria
- [x] **[Frontend CD workflow](ca://s?q=Explain_frontend_CD_workflow)** builds + deploys to hosting provider.  
- [x] Cache busting enabled.  
- [x] Environment variables injected at build time.  
- [x] Rollback supported.

### Notes
- Frontend CD is implemented in the unified `.github/workflows/ci.yml` workflow.
- Build-time env injection uses `FRONTEND_ENV_FILE` secret written to `apps/web/.env.production` on deploy.
- Cache busting is supported by per-deploy `BUILD_ID` derived from commit SHA.
- Automatic rollback restores previous `apps/web` release if droplet web health check fails.

### Dependencies
- **[Frontend build](ca://s?q=Explain_frontend_build_process)**  
- **[CI pipeline](ca://s?q=Explain_CI_workflow)**

---

## 4. Infrastructure-as-Code (IaC) setup

**As a developer**  
I want infrastructure defined as code  
So that environments can be recreated consistently.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** High  
**Target Date:** **28 March 2027**

### Acceptance Criteria
- [ ] **[IaC templates](ca://s?q=Explain_IaC_templates)** provision:
  - backend compute  
  - frontend hosting  
  - PostgreSQL database  
  - object storage  
  - caching layer  
- [ ] Supports staging + production.  
- [ ] Version-controlled.

### Dependencies
- Cloud provider  
- **[CD pipelines](ca://s?q=Explain_CD_workflow)**

---

## 5. Set up PostgreSQL production environment

**As a developer**  
I want a production-grade PostgreSQL environment  
So that the system has reliable, scalable data storage.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **02 April 2027**

### Acceptance Criteria
- [x] **PostgreSQL cluster** with:
  - [x] automated backups — daily pg_dump via `infra/scripts/pg-backup.sh` + `infra/systemd/ghs-db-backup.timer`
  - point-in-time recovery — WAL archiving (manual droplet config, not in repo)
  - monitoring — via `pg_stat_statements` (manual droplet config)
  - SSL enforced — local socket connections exempt; SSL required for remote access (pg_hba.conf)
- [x] Connection pooling enabled — PgBouncer setup script at `infra/scripts/pgbouncer-setup.sh` (transaction mode, port 6432)
- [x] `APP_ENV_FILE` repository secret injected to `apps/web/.env.production` and `apps/api/.env.production` on every deploy
- Read replicas optional — not implemented (single droplet)

### Dependencies
- **[IaC templates](ca://s?q=Explain_IaC_templates)**

---

## 6. Set up object storage (for PDFs, images)

**As a developer**  
I want object storage configured  
So that PDFs and assets can be stored and retrieved efficiently.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **04 April 2027**

### Acceptance Criteria
- [ ] **[Object storage bucket](ca://s?q=Explain_object_storage_bucket)** created.  
- [ ] Signed URL support.  
- [ ] Lifecycle rules for cleanup.  
- [ ] Permissions locked down.

### Dependencies
- **[PDF export](ca://s?q=Explain_round_export_PDF)**  
- Cloud provider

---



## 7. Set up caching layer (Redis)

**As a developer**  
I want a Redis caching layer  
So that dashboard and leaderboard endpoints are fast.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **06 April 2027**

### Acceptance Criteria
- [ ] **[Redis instance](ca://s?q=Explain_Redis_instance)** provisioned.  
- [ ] TTL-based caching for:
  - dashboard  
  - leaderboard  
  - settings  
- [ ] Cache invalidation rules documented.

### Dependencies
- **[Dashboard APIs](ca://s?q=Explain_dashboard_summary_endpoint)**  
- **[Leaderboard APIs](ca://s?q=Explain_leaderboard_by_club)**

---

## 8. Set up monitoring & alerting

**As a developer**  
I want monitoring and alerting  
So that issues are detected early.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **11 April 2027**

### Acceptance Criteria
- [x] **Prometheus** installed on droplet with:
  - [x] Node Exporter (system: CPU, memory, disk, network)
  - [x] Application metrics: HTTP requests, errors, latency (via Prometheus client libraries)
  - [x] Database metrics: connection count, slow queries
- [x] Alerting rules configured for:
  - [x] High CPU (>80%)
  - [x] High memory (>85%)
  - [x] High disk (>80%)
  - [x] Service downtime
  - [x] High error rate & latency (templates in alerts.yml for application to implement)
- [x] **Grafana** dashboard endpoints (ports 3000 for Grafana, 3001+ for dashboards)
- [x] **AlertManager** with Slack and email integration support
  - Configuration templates provided (requires Slack webhook & SMTP setup)
  - Default rules for system metrics; application can extend with custom metrics

### Implementation Notes
- Setup scripts: `infra/scripts/prometheus-setup.sh`, `infra/scripts/alertmanager-setup.sh`
- Alerting rules: `infra/monitoring/alerts.yml`
- Application metrics: Add Prometheus client and expose `/metrics` on app port for auto-scrape
- All services run as systemd units: `prometheus`, `node-exporter`, `grafana`, `alertmanager`
- Access via reverse proxy or firewall restrictions to protect dashboards

### Dependencies
- DigitalOcean droplet (already provisioned)
- Prometheus + Node Exporter + Grafana stack setup script

---

## 9. Implement centralised logging

**As a developer**  
I want centralised logging  
So that logs from all API modules and background processes are searchable.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **16 April 2027**

### Acceptance Criteria
- [ ] **[Log aggregation](ca://s?q=Explain_log_aggregation)** collects logs from:
  - backend  
  - frontend edge logs  
  - database events  
- [ ] Searchable by timestamp, user, request ID.  
- [ ] Retention policy configured.

### Dependencies
- **[Monitoring setup](ca://s?q=Explain_monitoring_dashboards)**

---

## 10. Implement blue‑green deployment strategy

**As a developer**  
I want blue‑green deployments  
So that releases are safe and reversible.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **21 April 2027**

### Acceptance Criteria
- [ ] **[Blue‑green deployment](ca://s?q=Explain_blue_green_deployment)** configured for backend.  
- [ ] Traffic switching automated.  
- [ ] Rollback takes <30 seconds.  
- [ ] Health checks required before switch.

### Dependencies
- **[CD pipeline](ca://s?q=Explain_CD_workflow)**  
- Load balancer

---

## 11. Implement staging environment parity

**As a developer**  
I want staging to mirror production  
So that testing is reliable.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **23 April 2027**

### Acceptance Criteria
- [ ] **[Staging environment](ca://s?q=Explain_staging_environment)** mirrors:
  - DB schema  
  - caching  
  - object storage  
  - environment variables  
- [ ] Automated refresh of anonymised data.

### Dependencies
- **[IaC templates](ca://s?q=Explain_IaC_templates)**

---

## 12. Implement database migration workflow

**As a developer**  
I want a safe migration workflow  
So that schema changes do not break production.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **25 April 2027**

### Acceptance Criteria
- [x] Migration runner script at `infra/scripts/run-migrations.sh`
  - [x] Executes `.sql` files from `db/migrations/` in order
  - [x] Dry-run mode (`--dry-run`) validates syntax without applying
  - [x] Generates rollback script on success
  - [x] Pre-deploy checks: database connectivity, migration state tracking (schema_migrations table)
- [x] Migrations integrated into CI/CD workflow
  - [x] Runs automatically during deploy as pre-service-restart step
  - [x] Fails fast; exits if dry-run validation fails
  - [x] Rollback scripts available in `/tmp/ghs-rollbacks/` on droplet
- [x] Single-environment implementation (no staging/production split)

### Dependencies
- **[PostgreSQL environment](ca://s?q=Explain_PostgreSQL_cluster)**

---

## 13. Implement automated backups & restore testing

**As a developer**  
I want automated backups and restore testing  
So that data is protected and recoverable.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **30 April 2027**

### Acceptance Criteria
- [ ] **[Automated backups](ca://s?q=Explain_DB_backup_strategy)** daily + hourly.  
- [ ] Restore tested monthly.  
- [ ] Alerts for failed backups.  
- [ ] Documentation included.

### Dependencies
- **[PostgreSQL environment](ca://s?q=Explain_PostgreSQL_cluster)**

---

## 14. Implement cost monitoring & optimisation

**As a developer**  
I want cost monitoring  
So that infrastructure remains efficient and affordable.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **02 May 2027**

### Acceptance Criteria
- [ ] **[Cost dashboard](ca://s?q=Explain_cloud_cost_dashboard)** created.  
- [ ] Alerts for unexpected spikes.  
- [ ] Monthly cost report generated.

### Dependencies
- Cloud provider billing tools

---

# End of stories-devops.md
