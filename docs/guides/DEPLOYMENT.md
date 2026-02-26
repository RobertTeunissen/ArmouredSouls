# Armoured Souls — Deployment Guide

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

1. **Stage 1**: Backend tests + frontend build/lint (parallel)
2. **Stage 2**: E2E tests (Playwright)
3. **Deploy**: rsync artifacts → `npm ci --production` → pre-migration backup → `prisma migrate deploy` → PM2 restart
4. **Smoke tests**: Health endpoint, frontend load, login API

No manual action needed. Monitor the Actions tab in GitHub for status.

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
