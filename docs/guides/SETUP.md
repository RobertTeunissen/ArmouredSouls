# Armoured Souls - Setup Guide

**Last Updated**: February 1, 2026  
**Platform**: VS Code on macOS (also works on Windows/Linux)

Complete setup guide for running the Phase 1 prototype locally, including database reset instructions for testing new versions.

---

## ⚠️ CRITICAL: Fix Stale Local Migrations FIRST

**If you're seeing errors like**: `Migration '20260127122708_prototype2' failed to apply` or `relation "robots" does not exist`

**YOU HAVE STALE LOCAL MIGRATIONS!** Your local folder still has old (deleted) migrations.

### Check If You Have This Issue

```bash
cd ArmouredSouls/prototype/backend
ls prisma/migrations/
```
### Fix Steps (Do This Before Anything Else!)

```bash
# 1. Navigate to backend
cd ArmouredSouls/prototype/backend

# 2. DELETE your local migrations folder completely
rm -rf prisma/migrations

# 3. Pull ONLY the migrations folder from repository
git checkout origin/copilot/start-phase-1-milestones -- prisma/migrations

# 4. Verify you now have ONLY ONE migration
ls prisma/migrations/
# Should show ONLY: 20260127201247_complete_future_state_schema

--> This is outdated. As of Feb 1, 2026, there are 5 migrations:

```
migrations/
  └─ 20260127201247_complete_future_state_schema/
    └─ migration.sql
  └─ 20260130072527_add_stance_yield/
    └─ migration.sql
  └─ 20260130093500_decimal_robot_attributes/
    └─ migration.sql
  └─ 20260130153010_add_matchmaking_schema/
    └─ migration.sql
  └─ 20260201144700_add_draws_field/
    └─ migration.sql
```

# 5. Now drop database and start fresh
cd ..  # Back to prototype folder
docker compose down -v
docker compose up -d
sleep 15  # Wait for PostgreSQL to start

# 6. Apply the ONE new migration
cd backend
npx prisma migrate deploy
npx prisma db seed
npx prisma generate

# 7. Start backend
npm run dev
```

**Why This Happens**: Git pull doesn't automatically delete local files that were removed from the repository. You must manually delete old migrations and checkout fresh ones from git.

---

## 🚨 CRITICAL: Environment Variable Not Found (DATABASE_URL)

**If you're seeing this error**:
```
Error code: P1012
error: Environment variable not found: DATABASE_URL.
```

**YOU'RE MISSING THE .env FILE!** The `.env` file is required but not tracked in git.

### Quick Fix

```bash
cd ArmouredSouls/prototype/backend
cp .env.example .env
```

**That's it!** Now Prisma commands will work.

### Why This Happens

The `.env` file contains sensitive credentials (database passwords, JWT secrets) and is intentionally not committed to git. You must create it manually from the `.env.example` template.

**For detailed troubleshooting**, see [TROUBLESHOOTING_DATABASE_URL.md](TROUBLESHOOTING_DATABASE_URL.md)

---

## ⚡ Quick Testing Reference

**For detailed setup instructions, see the sections below. This section provides quick commands for testing the matchmaking system.**

### 🔐 Admin Access

**Frontend UI:**
- URL: http://localhost:3000/login
- Username: `admin`
- Password: `admin123`

**API Token (for curl commands):**
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | \
  jq -r '.token')

echo $TOKEN
```

### ⚡ Quick Test Commands 

**View Database State:**
```bash
cd prototype/backend
node scripts/showDatabaseSummary.js
```

**Run Complete Cycle:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | jq -r '.token')

curl -X POST http://localhost:3001/api/admin/cycles/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cycles": 1, "autoRepair": true}' | jq '.'
```

**Run 10 Cycles:**
```bash
curl -X POST http://localhost:3001/api/admin/cycles/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cycles": 10, "autoRepair": true}' | jq '.'
```

### 📊 Admin API Quick Reference

```bash
# Get system stats
curl http://localhost:3001/api/admin/stats \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Run matchmaking
curl -X POST http://localhost:3001/api/admin/matchmaking/run \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Execute battles
curl -X POST http://localhost:3001/api/admin/battles/run \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Rebalance leagues
curl -X POST http://localhost:3001/api/admin/leagues/rebalance \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Repair all robots
curl -X POST http://localhost:3001/api/admin/repair/all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deductCosts": false}' | jq '.'
```

### 🧪 Testing Scripts

```bash
cd prototype/backend

# View database
node scripts/showDatabaseSummary.js

# Test matchmaking
node scripts/testMatchmakingSimple.js

# Test battles
node scripts/testBattleExecution.js

# Test rebalancing
node scripts/testLeagueRebalancing.js

# Test admin API
node scripts/testAdminAPI.js
```

### 👥 Test Accounts Reference

| Type | Username | Password | Role | Credits |
|------|----------|----------|------|---------|
| Admin | `admin` | `admin123` | admin | ₡10,000,000 |
| Player 1-5 | `player1`-`player5` | `password123` | user | ₡2,000,000 |
| Test Users | `test_user_001`-`test_user_100` | `testpass123` | user | ₡2,000,000 |

--> This is not complete!

---

## ✅ Prerequisites

Install these once:

1. **Node.js 20+** - [Download](https://nodejs.org/)
   ```bash
   node --version  # Should show v20.x or higher
   ```

2. **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop)
   ```bash
   docker --version
   docker compose version
   ```

3. **VS Code** (recommended) - [Download](https://code.visualstudio.com/)

---

## 🚀 Initial Setup (First Time Only)

### 1. Clone and Navigate
```bash
git clone https://github.com/RobertTeunissen/ArmouredSouls.git
cd ArmouredSouls/prototype
```

### 2. Start Database
```bash
docker compose up -d
```

Verify it's running:
```bash
docker ps  # Should show 'armouredsouls-db' container
```

### 3. Setup Backend
```bash
cd backend

# Create environment file
cp .env.example .env

# Install dependencies
npm install

# Setup database
npm run prisma:generate
npm run prisma:migrate
npx tsx prisma/seed.ts
```

### 4. Setup Frontend
```bash
cd ../frontend
npm install
```

---

## 🎮 Running the Application

**Open 2 terminals in VS Code** (Terminal → Split Terminal):

### Terminal 1 - Backend:
```bash
cd prototype/backend
npm run dev
```
✅ Should show: `🚀 Backend server running on http://localhost:3001`

### Terminal 2 - Frontend:
```bash
cd prototype/frontend
npm run dev
```
✅ Should show: `➜ Local: http://localhost:3000/`

---

## 🔄 Testing a New Version (Reset Everything)

When you need to test a fresh build or reset everything:

### Quick Reset (Recommended)
```bash
# Stop all servers (Ctrl+C in both terminals)

# Navigate to prototype directory
cd ArmouredSouls/prototype

# Pull latest changes
git pull

# Reset database
cd backend
npx prisma migrate reset --force

# Restart servers
npm run dev  # In terminal 1

cd ../frontend
npm run dev  # In terminal 2
```

### Testing New Version with Database Changes (EXACT STEPS)

**Use these steps when there are schema changes (new migrations):**

```bash
# Step 1: Stop ALL running servers
# Press Ctrl+C in backend terminal (Terminal 1)
# Press Ctrl+C in frontend terminal (Terminal 2)

# Step 2: Navigate to repository root
cd /path/to/ArmouredSouls

# Step 3: Pull latest changes from branch
git pull origin copilot/start-phase-1-milestones

# Step 4: Navigate to backend
cd prototype/backend

# Step 5: Reset database with new migrations
# This will:
# - Drop the database
# - Run all migrations (including new ones)
# - Run the seed script
npx prisma migrate reset --force

# Step 6: Start backend server (Terminal 1)
npm run dev

# Step 7: In NEW terminal, start frontend (Terminal 2)
cd prototype/frontend
npm run dev

# Step 8: Test in browser
# Open http://localhost:3000
# Login as player1 / password123
```

**What happens during `npx prisma migrate reset --force`:**
1. Drops the entire database
2. Recreates the database
3. Runs ALL migrations in order (including the new `20260127000000_add_loadout_type_to_weapons`)
4. Runs `prisma/seed.ts` to populate with test data

**No need to:**
- ❌ Stop Docker database (`docker compose down`)
- ❌ Manually run `prisma:generate`
- ❌ Manually run `prisma:migrate`  
- ❌ Manually run seed script

**The `migrate reset` command does it all automatically!**

### Full Clean Reset (If Having Issues)
```bash
# Stop all servers (Ctrl+C in both terminals)

# Navigate to prototype directory
cd ArmouredSouls/prototype

# Stop and remove database
docker compose down -v

# Pull latest changes
git pull

# Clean backend
cd backend
rm -rf node_modules package-lock.json dist
npm install
npm run prisma:generate
npm run prisma:migrate
npx tsx prisma/seed.ts

# Clean frontend
cd ../frontend
rm -rf node_modules package-lock.json dist
npm install

# Restart database
cd ..
docker compose up -d

# Start servers
cd backend && npm run dev  # Terminal 1
cd frontend && npm run dev  # Terminal 2
```

---

## 🛠️ Common Commands

### Database Management
```bash
cd backend

# View database (opens http://localhost:5555)
npm run prisma:studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Create new migration (after schema changes)
npm run prisma:migrate

# Regenerate Prisma client
npm run prisma:generate
```

### Server Management
```bash
# Check if database is running
docker ps

# Restart database
docker compose restart

# Stop database
docker compose down

# View database logs
docker compose logs -f
```

### Build Commands
```bash
# Backend
cd backend
npm run build  # Compiles TypeScript to dist/

# Frontend
cd frontend
npm run build  # Builds to dist/
```

---

## 🐛 Troubleshooting

**This section covers common installation issues, Prisma errors, and database problems.**

### 🔧 Migration Conflicts (IMPORTANT!)

**Issue**: You see errors like:
```
Error: P3018
Migration name: 20260127122708_prototype2
Database error: ERROR: relation "robots" does not exist
```
OR
```
2 migrations found in prisma/migrations
```
(when there should only be 1)

**Root Cause**: Your local database's `_prisma_migrations` table still has records of old migrations that were deleted from the repository when we consolidated to ONE comprehensive migration.

---

### ✅ SOLUTION: Nuclear Database Reset

This is the **ONLY** way to reliably fix migration conflicts:

```bash
# Step 1: Stop backend server if running (Ctrl+C)

# Step 2: Navigate to backend directory
cd prototype/backend

# Step 3: IMPORTANT - Pull latest code to ensure old migrations are gone!
git pull origin copilot/start-phase-1-milestones

# Step 4: Verify only 1 migration exists
ls -la prisma/migrations/
# Should ONLY show: 20260127201247_complete_future_state_schema
# If you see other migrations, DELETE them manually!

# Step 5: Stop Docker and REMOVE the database volume
docker compose down
docker volume rm prototype_postgres_data

# Step 6: Start Docker (creates fresh database with no history)
docker compose up -d

# Step 7: Wait for PostgreSQL to be ready (IMPORTANT!)
echo "Waiting for PostgreSQL to start..."
sleep 15

# Step 8: Apply the ONE comprehensive migration
npx prisma migrate deploy

# Step 9: Seed the database with test data
npx prisma db seed

# Step 10: Regenerate Prisma Client
npx prisma generate

# Step 11: Start backend
npm run dev
```

---

### ⚠️ Critical Steps Explained

1. **Pull latest code** - Old migration folders might still exist on your local machine
2. **Remove docker volume** - `docker compose down` alone doesn't clear the `_prisma_migrations` table!
3. **Wait 15 seconds** - PostgreSQL needs time to initialize before accepting connections
4. **Use `migrate deploy`** not `migrate reset` - Deploy applies migrations without trying to reset first

---

### 🔍 Verification

After running the commands above, verify everything worked:

```bash
# Check migrations directory (should show ONLY 1 folder)
ls -la prototype/backend/prisma/migrations/
# Output: 20260127201247_complete_future_state_schema

# Open Prisma Studio to inspect database
cd prototype/backend
npx prisma studio
# Open http://localhost:5555
# Should see tables: User, Robot, Weapon, WeaponInventory, Facility, Battle
# Users table should have 6 test users
# Weapons table should have 11 weapons

# Test backend starts successfully
npm run dev
# Should see: "🚀 Backend server running on http://localhost:3001"

# Test login API
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","password":"password123"}'
# Should return user object with token
```

---

### 🆘 Alternative Methods (If Above Fails)

**Method 2: If `docker volume rm` fails**
```bash
# Find exact volume name
docker volume ls | grep postgres

# Try removing with exact name
docker volume rm backend_postgres_data
# OR
docker volume rm armouredsouls_postgres_data
# (Use the exact name from docker volume ls)

# If still fails, force remove:
docker volume rm -f prototype_postgres_data
```

**Method 3: Manual database drop**
```bash
# Stop docker
docker compose down

# Start docker
docker compose up -d
sleep 15

# Drop and recreate database manually
docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS armouredsouls;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE armouredsouls;"

# Apply migration
cd backend
npx prisma migrate deploy
npx prisma db seed
npx prisma generate
npm run dev
```

**Method 4: Nuclear Docker reset (LAST RESORT)**
```bash
# WARNING: This removes ALL Docker data, not just this project!
docker compose down
docker system prune -a --volumes
# Type 'y' to confirm

# Then restart everything:
cd prototype
docker compose up -d
sleep 15
cd backend
npx prisma migrate deploy
npx prisma db seed
npx prisma generate
npm run dev
```

---

### 💡 Why This Works

- **Removing the docker volume** deletes the `_prisma_migrations` table that stores migration history
- **Fresh PostgreSQL** starts with no knowledge of old migrations
- **`migrate deploy`** applies only the ONE comprehensive migration that exists in the repository
- **No conflicts** because the database has no prior migration history to conflict with

---

### Database Won't Connect
**Issue**: Backend can't connect to database

**Fix**:
```bash
# Check database is running
docker ps

# If not running, start it
cd prototype
docker compose up -d

# Check backend .env file has correct DATABASE_URL
cat backend/.env | grep DATABASE_URL
# Should show: DATABASE_URL="******localhost:5432/armouredsouls"
```

### Port Already in Use
**Issue**: "Port 3000/3001 already in use"

**Fix**:
```bash
# Find and kill process using port
lsof -ti:3001 | xargs kill -9  # For backend
lsof -ti:3000 | xargs kill -9  # For frontend

# Or change ports in:
# Backend: edit backend/.env → PORT=3002
# Frontend: Vite will prompt to use different port automatically
```

### Prisma Errors
**Issue**: "Prisma Client not generated" or migration errors

**Fix**:
```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

### Node Modules Issues
**Issue**: Dependencies not installing or outdated

**Fix**:
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### "Cannot find module" Errors
**Issue**: TypeScript can't find modules

**Fix**:
```bash
# Rebuild everything
cd backend
npm run build

cd ../frontend
npm run build
```

**Troubleshooting Login Issues:**

If login fails even after database seeds successfully:

1. **Verify backend is running:**
   ```bash
   cd prototype/backend
   npm run dev
   # Should see: 🚀 Backend server running on http://localhost:3001
   ```

2. **Test backend health endpoint:**
   ```bash
   curl http://localhost:3001/api/health
   # Should return: {"status":"ok","message":"Armoured Souls API is running"}
   ```

3. **Test login API directly:**
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"player1","password":"password123"}'
   # Should return token and user object
   ```

4. **Check frontend:**
   - Start frontend: `cd prototype/frontend && npm run dev`
   - Open http://localhost:3000
   - Open browser console (F12) and check for errors


**Common Issues:**
- Backend not running on port 3001
- Frontend trying to connect to wrong URL (check `prototype/frontend/src/config.ts` or similar)
- CORS errors in browser console
- Database connection error (check backend terminal for Prisma errors)
- Missing .env file (backend needs DATABASE_URL)
npm run dev
```

---

## 📊 Seed Data Reference

### Test Users
| Type | Username | Password | Role | Starting Credits |
|------|----------|----------|------|------------------|
| Admin | admin | admin123 | admin | ₡10,000,000 |
| Player 1-5 | player1-player5 | password123 | user | ₡2,000,000 |
| Test Users | test_user_001-test_user_100 | testpass123 | user | ₡2,000,000 |

### Weapons (10 Total)
- **Energy**: Laser Rifle (₡150k), Plasma Cannon (₡300k), Ion Beam (₡400k)
- **Ballistic**: Machine Gun (₡100k), Shotgun (₡120k), Railgun (₡350k)
- **Melee**: Power Sword (₡180k), Hammer (₡200k)
- **Explosive**: Grenade Launcher (₡250k), Rocket Launcher (₡320k)

### Economy
- Robot frame: ₡500,000
- Attribute upgrade: (level + 1) × 1,500 Credits (increased Feb 8, 2026 - see [OPTION_C_IMPLEMENTATION.md](../OPTION_C_IMPLEMENTATION.md))
- 23 attributes per robot (Combat Systems, Defensive Systems, Chassis & Mobility, AI Processing, Team Coordination)

--> Old seed data, not up to date!

---

## 📝 VS Code Tips

### Recommended Extensions
- **Prisma** - Syntax highlighting for Prisma schema
- **ESLint** - JavaScript/TypeScript linting
- **Tailwind CSS IntelliSense** - Tailwind autocomplete

### Workspace Setup
1. Open `ArmouredSouls` folder in VS Code
2. Use split terminal: Terminal → Split Terminal
3. Save workspace: File → Save Workspace As...

### Debug Configuration
VS Code launch.json for debugging:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/prototype/backend"
    }
  ]
}
```

---

## 🆘 Quick Help

**Fresh start everything:**
```bash
cd ArmouredSouls/prototype
docker compose down -v
cd backend && npx prisma migrate reset --force
```

**Check everything is running:**
```bash
docker ps                              # Database should be running
curl http://localhost:3001/api/health  # Backend check
open http://localhost:3000             # Frontend (opens browser)
```

**View logs:**
```bash
docker compose logs -f                 # Database logs
# Backend/frontend logs are in the terminals
```

---

For more details, see:
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Complete schema reference
- [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Attribute system details
- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) - Facility and economy system

---

## 🌐 VPS Deployment

For deploying to a Scaleway VPS (acceptance or production), see the deployment guides:

- [VPS Setup Guide](VPS_SETUP.md) — Provision a new VPS from scratch
- [Deployment Guide](DEPLOYMENT.md) — CI/CD pipeline and deployment procedures
- [Maintenance Guide](MAINTENANCE.md) — Logs, backups, and monitoring
- [Troubleshooting Guide](TROUBLESHOOTING.md) — Common issues and rollback
- [Architecture Decisions](DECISIONS.md) — Project structure rationale and risk register

---

**Happy coding! 🤖⚔️**
