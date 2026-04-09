---
inclusion: manual
---

# Environments and Deployment

## Environment Overview

### Local Development (DEV/TST)
**Purpose**: Active development and testing on developer's machine

**Configuration**:
- Backend: http://localhost:3001 (hot reload enabled)
- Frontend: http://localhost:3000 (hot reload enabled)
- Database: Docker PostgreSQL on localhost:5432
- Scheduler: Disabled (manual cycle execution via admin API)
- Test data: Full seed data with 100+ test users
- NODE_ENV: `development`

### Acceptance (ACC)
**Purpose**: Pre-production testing and validation environment

**Configuration**:
- URL: https://acc.armouredsouls.com
- Location: Scaleway VPS (nl-ams-1 region)
- Deployment: Automatic on push to `main` branch
- Database: PostgreSQL in Docker on VPS
- Scheduler: Enabled (automated daily cycles)
- Test data: Limited test accounts for QA
- SSL: Automatic via Caddy + Let's Encrypt
- NODE_ENV: `acceptance`

### Production (PRD)
**Purpose**: Live game environment for real players

**Configuration**:
- URL: https://armouredsouls.com
- Location: Scaleway VPS (separate instance)
- Deployment: Manual promotion with approval required
- Database: PostgreSQL in Docker on VPS
- Scheduler: Enabled (automated daily cycles)
- Test data: None (only essential game data)
- SSL: Automatic via Caddy + Let's Encrypt
- NODE_ENV: `production`

## Environment Comparison

| Aspect | Local (DEV/TST) | ACC | PRD |
|--------|-----------------|-----|-----|
| NODE_ENV | `development` | `acceptance` | `production` |
| Location | Developer machine | Scaleway VPS | Scaleway VPS |
| Database | Local Docker | VPS Docker | VPS Docker |
| CORS | Permissive | acc.armouredsouls.com | armouredsouls.com |
| Scheduler | Disabled | Enabled | Enabled |
| Test Users | 100+ | Limited | None |
| Hot Reload | Yes | No | No |
| Source Maps | Yes | Yes | No |
| Log Level | `debug` | `info` | `warn` |
| Backups | Manual | Daily automated (2 AM) | Daily automated (2 AM) |
| SSL | None (HTTP) | Let's Encrypt (HTTPS) | Let's Encrypt (HTTPS) |

## Local Development Setup

### Prerequisites
- Node.js 20 LTS
- Docker Desktop
- Git

### Initial Setup (First Time)
```bash
# Clone repository
git clone https://github.com/RobertTeunissen/ArmouredSouls.git
cd ArmouredSouls/prototype

# Start PostgreSQL database
docker compose up -d

# Backend setup
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed

# Frontend setup
cd ../frontend
npm install
```

### Daily Development Workflow
**Terminal 1 - Backend**:
```bash
cd app/backend
npm run dev  # Starts on http://localhost:3001
```

**Terminal 2 - Frontend**:
```bash
cd app/frontend
npm run dev  # Starts on http://localhost:3000
```

**Access**: Navigate to http://localhost:3000 in browser

### Testing Locally
```bash
# Run backend tests
cd app/backend
npm test

# Run specific test file
npm test -- tests/facility.test.ts

# Run with coverage
npm test -- --coverage
```

## Deployment Pipeline

### ACC Deployment (Automatic)
**Trigger**: Push to `main` branch

**Pipeline stages**:
1. **Test Stage** (parallel execution)
   - Backend: Jest unit + property tests
   - Frontend: Build + ESLint
2. **E2E Stage**
   - Playwright end-to-end tests
3. **Deploy Stage**
   - rsync artifacts to VPS
   - `npm ci --production`
   - Pre-migration database backup
   - `npx prisma migrate deploy`
   - PM2 restart
4. **Smoke Tests**
   - Health endpoint check
   - Frontend loads successfully
   - Login API responds correctly

**Monitoring**: GitHub Actions tab shows real-time progress

**Expected duration**: ~5 minutes

### PRD Deployment (Manual with Approval)
**Trigger**: Manual workflow dispatch

**Process**:
1. Navigate to GitHub → Actions → Deploy
2. Click "Run workflow"
3. Select `environment: production`
4. Await reviewer approval (required)
5. Execute same pipeline as ACC with PRD secrets

**Approval requirement**: At least 1 designated reviewer must approve

**Purpose**: Prevents accidental production deployments

## Environment Variables

### Local (.env)
```bash
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://armouredsouls:password@localhost:5432/armouredsouls
CORS_ORIGIN=
SCHEDULER_ENABLED=false
LOG_LEVEL=debug
JWT_SECRET=default-dev-secret
JWT_EXPIRATION=24h
BCRYPT_SALT_ROUNDS=10
```

### ACC (.env on VPS)
```bash
NODE_ENV=acceptance
PORT=3001
DATABASE_URL=postgresql://as_acc:STRONG_PASSWORD@127.0.0.1:5432/armouredsouls_acc
CORS_ORIGIN=https://acc.armouredsouls.com
SCHEDULER_ENABLED=true
LOG_LEVEL=info
JWT_SECRET=GENERATED_WITH_OPENSSL
# Scheduler times (UTC)
LEAGUE_SCHEDULE=0 20 * * *      # 8 PM daily
TOURNAMENT_SCHEDULE=0 8 * * *   # 8 AM daily
TAGTEAM_SCHEDULE=0 12 * * *     # 12 PM daily
SETTLEMENT_SCHEDULE=0 23 * * *  # 11 PM daily
```

### PRD (.env on VPS)
Same as ACC but with:
- `NODE_ENV=production`
- Different database credentials
- Different JWT_SECRET
- `CORS_ORIGIN=https://armouredsouls.com,https://www.armouredsouls.com`
- `LOG_LEVEL=warn`

## VPS Architecture

### Scaleway DEV1-S Specs
- 2 vCPU
- 2 GB RAM
- 20 GB SSD
- Ubuntu 22.04 LTS

### Services Running
- **Caddy**: Reverse proxy on ports 80/443
- **Backend**: Node.js via PM2 on port 3001
- **PostgreSQL**: Docker container on port 5432 (internal)
- **Frontend**: Static files served by Caddy

### Directory Structure on VPS
```
/opt/armouredsouls/
├── backend/
│   ├── dist/              # Compiled TypeScript
│   ├── node_modules/
│   ├── prisma/
│   └── .env
├── frontend/
│   └── dist/              # Built React app
├── scripts/
│   ├── backup.sh
│   └── restore.sh
├── backups/               # Daily database dumps
└── docker-compose.production.yml
```

### PM2 Process Management
```bash
# On VPS
pm2 status                 # View running processes
pm2 logs armouredsouls-backend  # View logs
pm2 restart armouredsouls-backend  # Restart backend
pm2 monit                  # Real-time monitoring
```

### Caddy Configuration
- Automatic HTTPS via Let's Encrypt
- Reverse proxy to backend on /api/*
- Serves frontend static files
- Gzip compression enabled
- Security headers configured

## Database Management

### Local Database Reset
```bash
cd app/backend
npm run db:reset  # Drops, recreates, applies migrations, seeds
```

### VPS Database Backup
```bash
# Automatic daily at 2 AM via cron
# Manual backup:
ssh deploy@VPS_IP
/opt/armouredsouls/scripts/backup.sh
```

### VPS Database Restore
```bash
ssh deploy@VPS_IP
/opt/armouredsouls/scripts/restore.sh /opt/armouredsouls/backups/FILENAME.sql.gz
```

## Monitoring and Logs

### Local Logs
- Backend: Terminal output (npm run dev)
- Frontend: Browser console + terminal
- Database: `docker compose logs -f`

### VPS Logs
```bash
# Backend logs
pm2 logs armouredsouls-backend

# Caddy logs
sudo journalctl -u caddy -f

# Database logs
docker logs armouredsouls-db-prod -f

# Backup logs
tail -f /var/log/armouredsouls/backup.log
```

### Health Checks
```bash
# Local
curl http://localhost:3001/api/health

# ACC
curl https://acc.armouredsouls.com/api/health

# PRD
curl https://armouredsouls.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-03-02T...",
  "environment": "acceptance"
}
```

## Security Considerations

### Secrets Management
- Never commit `.env` files
- Use `.env.example` as template
- Generate JWT secrets: `openssl rand -hex 32`
- Rotate secrets periodically
- Different secrets per environment

### GitHub Secrets
Required for CI/CD:
- `ACC_SSH_KEY` - Private SSH key for ACC VPS
- `ACC_VPS_IP` - ACC VPS public IP
- `ACC_VPS_USER` - SSH user (deploy)
- `PRD_SSH_KEY` - Private SSH key for PRD VPS
- `PRD_VPS_IP` - PRD VPS public IP
- `PRD_VPS_USER` - SSH user (deploy)

### Firewall (UFW on VPS)
```bash
sudo ufw status
# Allows: 22 (SSH), 80 (HTTP), 443 (HTTPS)
# Blocks: Everything else including direct database access
```

## Troubleshooting

### Local Issues
- Database won't start: `docker compose down -v && docker compose up -d`
- Port in use: `lsof -ti:3001 | xargs kill -9`
- Prisma errors: `npx prisma generate && npx prisma migrate deploy`

### VPS Issues
- Backend not responding: `pm2 restart armouredsouls-backend`
- Database connection failed: `docker ps` (check if running)
- SSL certificate issues: `sudo systemctl restart caddy`
- Deployment failed: Check GitHub Actions logs

### Common Deployment Issues
- Migration conflicts: Pre-deployment backup allows rollback
- Build failures: Check test logs in GitHub Actions
- Permission errors: Ensure deploy user owns /opt/armouredsouls
- Out of memory: Check PM2 logs, may need to upgrade VPS

## Quick Reference

### Local Development
```bash
# Start everything
docker compose up -d
cd backend && npm run dev  # Terminal 1
cd frontend && npm run dev # Terminal 2

# Reset database
cd backend && npm run db:reset

# Run tests
cd backend && npm test
```

### Deployment
```bash
# Deploy to ACC
git push origin main  # Automatic

# Deploy to PRD
# GitHub → Actions → Deploy → Run workflow → Select production → Approve
```

### VPS Management
```bash
# SSH into VPS
ssh deploy@VPS_IP

# Check services
pm2 status
docker ps
sudo systemctl status caddy

# View logs
pm2 logs armouredsouls-backend
docker logs armouredsouls-db-prod

# Restart services
pm2 restart armouredsouls-backend
docker restart armouredsouls-db-prod
sudo systemctl restart caddy
```
