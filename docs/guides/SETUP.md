# Armoured Souls — Setup Guide

**Last Updated**: April 2, 2026  
**Node.js**: 24 LTS  
**Prisma**: 7 (requires driver adapter — handled automatically by `src/lib/prisma.ts`)

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 24+ | [nodejs.org](https://nodejs.org/) or use `.nvmrc`: `nvm use` |
| Docker | Latest | [docker.com](https://www.docker.com/products/docker-desktop) |

Verify:
```bash
node --version    # v24.x
docker --version
docker compose version
```

---

## Initial Setup

```bash
# Clone
git clone https://github.com/RobertTeunissen/ArmouredSouls.git
cd ArmouredSouls/prototype

# Start PostgreSQL
docker compose up -d

# Backend
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts

# Frontend (new terminal)
cd ../frontend
npm install
```

The `.env.example` has sensible defaults for local development. No changes needed unless you want to customize ports or enable the cycle scheduler.

---

## Running Locally

Two terminals:

```bash
# Terminal 1 — Backend
cd prototype/backend
npm run dev
# → http://localhost:3001

# Terminal 2 — Frontend
cd prototype/frontend
npm run dev
# → http://localhost:3000
```

Test credentials are in `prototype/backend/prisma/seed.ts`. Do not commit credentials to docs.

---

## Database Management

### Reset (drop + recreate + migrate + seed)
```bash
cd prototype/backend
npm run db:reset
```

This runs `prisma migrate reset --force` which drops the database, re-applies all migrations, and re-seeds. Use this when you want a clean slate.

### Apply new migrations (after pulling changes)
```bash
cd prototype/backend
npx prisma migrate deploy
```

### Inspect the database
```bash
cd prototype/backend
npx prisma studio
# → http://localhost:5555
```

### Create a new migration (after editing schema.prisma)
```bash
cd prototype/backend
npx prisma migrate dev --name describe_your_change
```

This generates a migration SQL file, applies it, and regenerates the Prisma client.

### Regenerate Prisma client (after schema changes without migration)
```bash
npx prisma generate
```

### Prisma 7 Notes

Prisma 7 uses the `client` engine type which requires a driver adapter. The app handles this automatically in `src/lib/prisma.ts` via `@prisma/adapter-pg`. Standalone scripts and tests that create their own PrismaClient must also pass an adapter — see the existing scripts for the pattern.

The generated client lives at `prototype/backend/generated/prisma/` (not `@prisma/client`). Import from there or from `src/lib/prisma.ts`.

---

## Running Tests

### Backend (Jest 30)
```bash
cd prototype/backend
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test               # Both
npm run test:heavy         # Long-running / property-based tests
npm run test:all           # Everything
```

### Frontend (Vitest 4)
```bash
cd prototype/frontend
npm run test -- --run      # Single run (no watch mode)
npm run test:coverage      # With coverage report
```

### E2E (Playwright)
```bash
cd prototype/frontend
npm run test:e2e           # Headless
npm run test:e2e:headed    # With browser visible
npm run test:e2e:debug     # Debug mode
```

---

## Admin Quick Reference

### Run a cycle via API
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "<admin_user>", "password": "<admin_password>"}' | \
  jq -r '.token')

# Run 1 cycle
curl -X POST http://localhost:3001/api/admin/cycles/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cycles": 1}' | jq '.'
```

### Health check
```bash
curl http://localhost:3001/api/health
```

### Admin portal
Navigate to the admin page in the UI after logging in with an admin account. The admin portal provides cycle management, battle viewer, user management, and onboarding analytics.

---

## Build

```bash
# Backend — compiles TypeScript to dist/
cd prototype/backend
npm run build

# Frontend — builds to dist/
cd prototype/frontend
npm run build
```

---

## Troubleshooting

### "Environment variable not found: DATABASE_URL"

You forgot to create the `.env` file:
```bash
cd prototype/backend
cp .env.example .env
```

### Database won't connect

```bash
# Check the container is running
docker ps | grep armouredsouls-db

# If not running
cd prototype
docker compose up -d

# Verify DATABASE_URL in .env matches docker-compose.yml credentials
```

### Port already in use

```bash
lsof -ti:3001 | xargs kill -9   # Backend
lsof -ti:3000 | xargs kill -9   # Frontend
```

### Migration errors after pulling changes

If you see migration conflicts or "relation does not exist" errors:
```bash
cd prototype/backend
npm run db:reset
```

This drops and recreates the database from scratch. If that doesn't work:
```bash
cd prototype
docker compose down -v    # Remove the database volume
docker compose up -d      # Fresh database
cd backend
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

### "Prisma Client not generated"

```bash
cd prototype/backend
npx prisma generate
```

### Node modules issues

```bash
cd prototype/backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

---

## VPS Deployment

For deploying to the Scaleway VPS (acceptance or production), see:

- [Deployment Guide](DEPLOYMENT.md) — CI/CD pipeline and deploy procedures
- [VPS Setup Guide](VPS_SETUP.md) — Provisioning a new VPS from scratch
- [Maintenance Guide](MAINTENANCE.md) — Logs, backups, monitoring
- [Troubleshooting](TROUBLESHOOTING.md) — Common production issues and rollback
- [Architecture Decisions](DECISIONS.md) — Project structure rationale
