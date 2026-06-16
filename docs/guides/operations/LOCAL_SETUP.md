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
cd ArmouredSouls/app

# Start PostgreSQL
docker compose up -d

# Backend
cd backend
cp .env.example .env
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm exec tsx prisma/seed.ts

# Frontend (new terminal)
cd ../frontend
pnpm install
```

The `.env.example` has sensible defaults for local development. No changes needed unless you want to customize ports or enable the cycle scheduler.

---

## Running Locally

Two terminals:

```bash
# Terminal 1 — Backend
cd app/backend
pnpm run dev
# → http://localhost:3001

# Terminal 2 — Frontend
cd app/frontend
pnpm run dev
# → http://localhost:3000
```

Test credentials are in `app/backend/prisma/seed.ts`. Do not commit credentials to docs.

---

## Database Management

### Reset (drop + recreate + migrate + seed)
```bash
cd app/backend
pnpm run db:reset
```

This runs `prisma migrate reset --force` which drops the database, re-applies all migrations, and re-seeds. Use this when you want a clean slate.

### Apply new migrations (after pulling changes)
```bash
cd app/backend
pnpm exec prisma migrate deploy
```

### Inspect the database
```bash
cd app/backend
pnpm exec prisma studio
# → http://localhost:5555
```

### Create a new migration (after editing schema.prisma)
```bash
cd app/backend
pnpm exec prisma migrate dev --name describe_your_change
```

This generates a migration SQL file, applies it, and regenerates the Prisma client.

### Regenerate Prisma client (after schema changes without migration)
```bash
pnpm exec prisma generate
```

### Prisma 7 Notes

Prisma 7 uses the `client` engine type which requires a driver adapter. The app handles this automatically in `src/lib/prisma.ts` via `@prisma/adapter-pg`. Standalone scripts and tests that create their own PrismaClient must also pass an adapter — see the existing scripts for the pattern.

The generated client lives at `app/backend/generated/prisma/` (not `@prisma/client`). Import from there or from `src/lib/prisma.ts`.

---

## Running Tests

### Backend (Jest 30)
```bash
cd app/backend
pnpm run test:unit          # Unit tests only
pnpm run test:integration   # Integration tests only
pnpm run test               # Both
pnpm run test:heavy         # Long-running / property-based tests
pnpm run test:all           # Everything
```

### Frontend (Vitest 4)
```bash
cd app/frontend
pnpm run test -- --run      # Single run (no watch mode)
pnpm run test:coverage      # With coverage report
```

### E2E (Playwright)

E2E tests run against a real backend with a seeded database. The test suite uses `test_user_001` (password: `testpass123`) as the primary seeded test account. Auth state is saved to `.auth/test_user_001.json` and reused across tests.

Available helpers in `tests/e2e/helpers/`:
- `loginAndGoToDashboard(page, username?, password?)` — logs in (defaults to `test_user_001` / `testpass123`)
- `navigateToProtectedPage(page, path)` — navigates with retry logic for auth race conditions, falls back to re-login as `test_user_001`
- `registerNewUser(page, options?)` — registers a fresh user via the UI with unique timestamp-based credentials, returns the generated username/email/password/stableName

```bash
cd app/frontend
pnpm exec playwright install     # One-time: install Chromium browser
pnpm run test:e2e           # Headless
pnpm run test:e2e:headed    # With browser visible
pnpm run test:e2e:debug     # Debug mode
```

Requires the backend running locally with a seeded database (see [Running Locally](#running-locally) above).

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
cd app/backend
pnpm run build

# Frontend — builds to dist/
cd app/frontend
pnpm run build
```

---

## Troubleshooting

### "Environment variable not found: DATABASE_URL"

You forgot to create the `.env` file:
```bash
cd app/backend
cp .env.example .env
```

### Database won't connect

```bash
# Check the container is running
docker ps | grep armouredsouls-db

# If not running
cd app
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
cd app/backend
pnpm run db:reset
```

This drops and recreates the database from scratch. If that doesn't work:
```bash
cd app
docker compose down -v    # Remove the database volume
docker compose up -d      # Fresh database
cd backend
pnpm exec prisma migrate deploy
pnpm exec tsx prisma/seed.ts
```

### "Prisma Client not generated"

```bash
cd app/backend
pnpm exec prisma generate
```

### Node modules issues

```bash
cd app/backend
rm -rf node_modules pnpm-lock.yaml
pnpm install

cd ../frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## VPS Deployment

For deploying to the Scaleway VPS (acceptance or production), see:

- [Deployment Guide](DEPLOYMENT.md) — CI/CD pipeline and deploy procedures
- [VPS Setup Guide](VPS_SETUP.md) — Provisioning a new VPS from scratch
- [Maintenance Guide](MAINTENANCE.md) — Logs, backups, monitoring
- [Troubleshooting](TROUBLESHOOTING.md) — Common production issues and rollback
- [Architecture Decisions](../../architecture/ARCHITECTURE.md) — Project structure rationale and risk register
