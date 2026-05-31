# Armoured Souls — Deployment Guide

**Last Updated**: April 9, 2026  
**Status**: ✅ Current

How to deploy Armoured Souls to ACC (acceptance) and PRD (production) environments.

---

## Prerequisites

- VPS provisioned per [VPS_SETUP.md](VPS_SETUP.md)
- GitHub repository secrets configured (see [Environment Secrets](#environment-secrets) below)
- Domain DNS pointing to VPS IP

---

## First Deployment

The CI/CD pipeline handles subsequent deployments automatically, but the first deploy requires a few manual steps.

### 1. Push code and let CI/CD deploy

Merge your changes to `main`. The pipeline will:
1. Run backend tests (unit + property)
2. Build and lint frontend
3. Run E2E tests
4. Deploy to ACC automatically

### 2. Run initial database migration

SSH into the VPS after the first deploy completes:

```bash
ssh deploy@YOUR_VPS_IP
cd /opt/armouredsouls/backend
npx prisma migrate deploy
```

### 3. Seed the database

```bash
# ACC — seeds weapons, facilities, and test accounts
NODE_ENV=acceptance npx prisma db seed

# PRD — seeds only essential game data (weapons, facilities), no test users
NODE_ENV=production npx prisma db seed
```

### 4. Start the backend with PM2

```bash
cd /opt/armouredsouls
pm2 start ecosystem.config.js
pm2 save
```

### 5. Verify

```bash
curl http://localhost:3001/api/health
# Should return: {"status":"ok","database":"connected",...}
```

Check the frontend loads via your domain in a browser.

---

## Subsequent Deployments

### ACC (Automatic)

Every push to `main` triggers the full pipeline:

1. **Stage 1**: Backend tests (unit + integration) + frontend build/lint/unit tests (parallel)
2. **Stage 2**: E2E tests — provisions a PostgreSQL 17 service container, runs database migrations, seeds test data (`npx prisma db seed`), starts the backend server, builds the frontend, installs Playwright Chromium, and runs the full Playwright E2E suite. Uploads HTML report and failure artifacts (screenshots, traces) to GitHub Actions. 15-minute timeout. Blocks deployment on failure.
3. **Deploy**: rsync artifacts → `npm ci --production` → pre-migration backup → `prisma migrate deploy` → PM2 restart
4. **Enhanced health check**: Validates HTTP 200 + `disk.status` != "critical" + `modules.status` == "ok". Catches partial builds and disk issues.
5. **Deploy notifications**: On success → Discord "✅ Deploy complete". On failure → Discord "🚨 Deploy FAILED" with link to the Actions run.
6. **Smoke tests**: Health endpoint, frontend load, login API

No manual action needed. Deploy success/failure notifications are sent to the `#ops-alerts` Discord channel automatically. See [MONITORING.md](MONITORING.md) for webhook configuration.

### PRD (Manual Promotion)

Production deploys require explicit approval:

1. Go to **GitHub → Actions → Deploy**
2. Click **Run workflow**
3. Select `environment: production`
4. Click **Run workflow**
5. A reviewer must approve the deployment in the GitHub environment protection rules

The PRD pipeline runs the same steps as ACC but uses `PRD_*` secrets and targets the production VPS.

---

## Environment Secrets

Configure these in **GitHub → Settings → Secrets and variables → Actions**:

### ACC Secrets

| Secret | Description |
|--------|-------------|
| `ACC_SSH_KEY` | Private SSH key for the deploy user on ACC VPS |
| `ACC_VPS_IP` | Public IP of the ACC VPS |
| `ACC_VPS_USER` | SSH user (typically `deploy`) |

### PRD Secrets

| Secret | Description |
|--------|-------------|
| `PRD_SSH_KEY` | Private SSH key for the deploy user on PRD VPS |
| `PRD_VPS_IP` | Public IP of the PRD VPS |
| `PRD_VPS_USER` | SSH user (typically `deploy`) |

### GitHub Environment Protection

Set up a `production` environment in **GitHub → Settings → Environments** with:
- Required reviewers (at least 1)
- Deployment branch restriction: `main` only

---

## Environment Variables

Each VPS has its own `.env` file at `/opt/armouredsouls/backend/.env`. See `.env.production.example` for all available variables.

Key differences between environments:

| Variable | ACC | PRD |
|----------|-----|-----|
| `NODE_ENV` | `acceptance` | `production` |
| `CORS_ORIGIN` | `https://acc.armouredsouls.com` | `https://armouredsouls.com,https://www.armouredsouls.com` |
| `DATABASE_URL` | ACC database credentials | PRD database credentials |
| `JWT_SECRET` | Unique per environment | Unique per environment |
| `SCHEDULER_ENABLED` | `true` | `true` |

---

## Verifying a Deployment

### Health Check

```bash
# From the VPS
curl http://localhost:3001/api/health

# Remotely (via Caddy)
curl https://acc.armouredsouls.com/api/health
```

Expected response:

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-...",
  "environment": "acceptance"
}
```

### Smoke Tests

The CI/CD pipeline runs these automatically after deploy, but you can run them manually:

```bash
# Health endpoint
curl -sf https://acc.armouredsouls.com/api/health

# Frontend loads
curl -sf -o /dev/null -w "%{http_code}" https://acc.armouredsouls.com/

# Login API responds (expect 401, not 5xx)
curl -sf -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' \
  https://acc.armouredsouls.com/api/auth/login
```

### PM2 Status

```bash
ssh deploy@YOUR_VPS_IP
pm2 status
pm2 logs armouredsouls-backend --lines 20
```

---

## User Uploads Directory

The image upload feature stores user-uploaded robot images on the local filesystem. The uploads directory must exist with correct permissions before the feature can be used.

### Create Uploads Directory

```bash
ssh deploy@YOUR_VPS_IP
mkdir -p /opt/armouredsouls/backend/uploads/user-robots
chown deploy:deploy /opt/armouredsouls/backend/uploads/user-robots
chmod 755 /opt/armouredsouls/backend/uploads/user-robots
```

### Caddy Static File Serving

The `Caddyfile` includes a `handle /uploads/*` block that serves uploaded images as static files from the backend directory. This is already configured in `app/Caddyfile` — no manual Caddy changes are needed on deploy. The block sets:
- `root * /opt/armouredsouls/backend`
- `Cache-Control: public, max-age=86400`
- `X-Content-Type-Options: nosniff`

### Backup Considerations

The `uploads/user-robots/` directory is not included in the PostgreSQL backup. Consider adding a separate rsync or tar backup for uploaded images if data durability is critical. Orphaned images are cleaned up automatically during the daily settlement cycle (Step 15).

---

## Spec 36 — Cron Schedule Restructure

### Hard Prerequisite: Spec 35 (Booking Office)

Spec 36 (Cron Schedule Restructure) **must not be deployed** until Spec 35 (Booking Office) is live and its `subscription` table migration has been applied. The application enforces this with a startup assertion — if the `subscription` table does not exist, the backend will exit with a FATAL error.

### Rollback Procedure

If a critical defect is discovered after deploying Spec 36, the slot map can be reverted via `.env` overrides without a code rollback:

**Step 1 — Restore previous schedule via env vars:**

```bash
# In /opt/armouredsouls/backend/.env, set:
LEAGUE_SCHEDULE='0 20 * * *'
TAGTEAM_SCHEDULE='0 12 * * *'
KOTH_SCHEDULE='0 16 * * 1,3,5'
SETTLEMENT_SCHEDULE='0 23 * * *'
```

**Step 2 — Restore deleted helpers from git history:**

```bash
# Restore shouldRunTagTeamMatchmaking (one function + one export line)
git checkout HEAD~1 -- app/backend/src/services/tag-team/tagTeamMatchmakingService.ts
# Restore getNextKothScheduledDate's kothDays array (one constant)
git checkout HEAD~1 -- app/backend/src/services/cycle/cycleScheduler.ts
```

**Step 3 — Restart the application:**

```bash
pm2 restart armouredsouls-backend
```

The scheduler picks up the new env values on restart. No database migration rollback is needed — Spec 36 has no schema changes.


---

## Spec 37 — Team Battles (2v2 and 3v3)

### Hard Prerequisites: Spec 35 → Spec 36 → Spec 37

Spec 37 (Team Battles) **must not be deployed** until both Spec 35 (Booking Office) and Spec 36 (Cron Schedule Restructure) are live. The dependency chain is:

1. **Spec 35 (Booking Office)** — provides the `subscriptions` table, `eventRegistry`, `isRobotSubscribedTo`, and locking predicates. Team Battle matchmaking calls `isRobotSubscribedTo` to gate pool inclusion.
2. **Spec 36 (Cron Schedule Restructure)** — provides the 10-slot daily cron map with reserved stubs for `team_2v2_league` (09:00 UTC) and `team_3v3_league` (14:00 UTC). Spec 37 replaces those stubs with real handlers.
3. **Spec 37 (Team Battles)** — registers `league_2v2` and `league_3v3` as subscribable events, adds the `TeamBattle`, `TeamBattleMember`, and `ScheduledTeamBattleMatch` tables, and activates the 2v2/3v3 cron handlers.

### Deploy Steps

After merging Spec 37 to `main`:

1. CI/CD deploys to ACC automatically (standard pipeline)
2. The Prisma migration creates `team_battle`, `team_battle_member`, and `scheduled_team_battle_match` tables, adds `totalLeague2v2Wins`/`totalLeague3v3Wins` to `Robot`, and renames event types (`league` → `league_1v1`, `tournament` → `tournament_1v1`) in `subscriptions` and `battles` tables
3. On startup, the backend registers `league_2v2` and `league_3v3` in the Event Registry and replaces the reserved-slot stubs with real handlers
4. The next daily cycle at 09:00 UTC (2v2) and 14:00 UTC (3v3) will execute Team Battle matchmaking and battles

### Verification After Deploy

```bash
# Verify migration applied
cd /opt/armouredsouls/backend && npx prisma migrate status

# Verify new tables exist
psql -c "SELECT COUNT(*) FROM team_battle;" $DATABASE_URL
psql -c "SELECT COUNT(*) FROM team_battle_member;" $DATABASE_URL
psql -c "SELECT COUNT(*) FROM scheduled_team_battle_match;" $DATABASE_URL

# Verify event type rename completed
psql -c "SELECT COUNT(*) FROM subscriptions WHERE event_type IN ('league', 'tournament');" $DATABASE_URL
# Should return 0

# Verify health endpoint
curl -sf https://acc.armouredsouls.com/api/health
```

### Rollback Procedure

If a critical defect is discovered after deploying Spec 37:

**Option A — Disable Team Battle cron slots via env vars (no code rollback):**

```bash
# In /opt/armouredsouls/backend/.env, override schedules to never fire:
TEAM_2V2_LEAGUE_SCHEDULE='0 0 30 2 *'
TEAM_3V3_LEAGUE_SCHEDULE='0 0 30 2 *'
```

Restart PM2. The slots will not fire (Feb 30 never occurs). Existing teams and data remain intact but no new battles are scheduled.

**Option B — Full code rollback:**

```bash
# Revert to pre-Spec-37 commit
git checkout <pre-spec-37-sha> -- app/backend/src/services/team-battle/
git checkout <pre-spec-37-sha> -- app/backend/src/services/cycle/cycleScheduler.ts
pm2 restart armouredsouls-backend
```

Note: The database migration (new tables, renamed event types) is forward-only. The new tables are harmless if unused. The event type rename (`league` → `league_1v1`) is consumed by all code paths after Spec 37 — a full rollback would need to also revert the migration or update code to handle both old and new names.
