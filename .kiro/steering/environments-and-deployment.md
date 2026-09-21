---
inclusion: manual
---

# Environments and Deployment Runbook

## Canonical sources
Use these for executable detail: `.github/workflows/deploy.yml`, `docs/guides/operations/DEPLOYMENT.md`, `VPS_PROVISIONING_PRD.md`, `MAINTENANCE.md`, `TROUBLESHOOTING.md`, `app/scripts/preflight.sh`, `app/scripts/deployment-health-check.sh`, and `app/scripts/restore.sh`. This file is the decision index, not a copy of workflow YAML.

## Environments
- **Local:** backend `http://localhost:3001`, frontend `http://localhost:3000`, PostgreSQL via Docker, `SCHEDULER_ENABLED=false`, `NODE_ENV=development`.
- **ACC:** `https://acc.armouredsouls.com`; push to `main` triggers the repository’s automatic acceptance deployment; scheduler enabled; `NODE_ENV=acceptance`.
- **PRD:** `https://armouredsouls.com`; deploy only through the manually dispatched production workflow and its required approval; `NODE_ENV=production`.
- Do not infer that PRD is live from repository files alone. Confirm deployment evidence before operating on it.

## Deployment policy
1. Required CI jobs must pass: backend lint/build/typecheck/tier/unit/integration/heavy, frontend lint/build/unit, E2E, and the steering guard. See `testing-strategy.md` and the workflow files.
2. Deployment transfers the built artifacts, performs a preflight disk check, installs production dependencies deterministically, generates Prisma, creates the pre-migration backup, runs `pnpm exec prisma migrate deploy`, reconciles PM2, and runs the bounded health check.
3. A committed migration is applied by deploy; do not treat it as a separate manual follow-up. Exceptional data repair, destructive migration observation, missing secrets, or required admin actions must be called out explicitly.
4. ACC deploys from `main`. PRD uses `workflow_dispatch`, the production environment, and reviewer approval. Never bypass required jobs, approvals, hooks, or health checks.

## Health and rollback
- `/api/health` checks database connectivity, disk, critical modules, environment, and returns an unhealthy status/503 when required checks fail.
- `deployment-health-check.sh` requires valid JSON, healthy status, connected database, acceptable disk, healthy modules, expected environment, and completion within its bounded deadline.
- Inspect the GitHub Actions run, PM2 logs, and health endpoint after deployment; perform frontend/login smoke checks.
- Backups use `/opt/armouredsouls/scripts/backup.sh`; restore uses `/opt/armouredsouls/scripts/restore.sh`. Restore is destructive: it can stop PM2 and drop/recreate the database. Follow `TROUBLESHOOTING.md` and confirm the backup before restoring.

## Daily scheduler (UTC)
The scheduler runs independent jobs, not one monolithic transaction:

| Time | Job |
|---|---|
| 00:00 | Settlement |
| 08:00 | 1v1 League |
| 09:00 | Team 2v2 League |
| 10:00 | 1v1 Tournament |
| 11:00 | Tag Team |
| 13:00 | KotH |
| 14:00 | Team 3v3 League |
| 15:00 | Team 2v2 Tournament |
| 17:00 | Grand Melee |
| 18:00 | Team 3v3 Tournament |

Verify schedule changes against `app/backend/src/services/cycle/cycleScheduler.ts`, `app/backend/src/config/env.ts`, and `docs/architecture/PRD_SERVICE_DIRECTORY.md`; do not rely on older PRD slot tables. The local admin bulk-cycle endpoint is for local development/seeding, not a replacement for production scheduling.

## Operations and secrets
- Logs: `pm2 logs armouredsouls-backend`, `sudo journalctl -u caddy -f`, `docker logs <postgres-container> -f`, and `/var/log/armouredsouls/backup.log`.
- Health: `curl http://localhost:3001/api/health`, `curl https://acc.armouredsouls.com/api/health`, or the verified production URL.
- Keep credentials in environment files/secrets only. Use `.env.example` and `.env.production.example`; never commit `.env`, tokens, or passwords. Parse env files as text—never `source .env`.
- Deployment, backup, firewall, PM2, Caddy, and VPS details belong in the linked operations guides.
