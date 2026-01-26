# Armoured Souls - Setup Guide

**Last Updated**: January 26, 2026  
**Platform**: VS Code on macOS (also works on Windows/Linux)

Complete setup guide for running the Phase 1 prototype locally, including database reset instructions for testing new versions.

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

### Access the Application
Open browser to: **http://localhost:3000**

Test accounts:
- `player1` / `password123` (₡2,000,000)
- `admin` / `admin123` (₡10,000,000)

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

---

## 📊 Seed Data Reference

### Test Users
| Username | Password | Role | Starting Credits |
|----------|----------|------|------------------|
| admin | admin123 | admin | ₡10,000,000 |
| player1 | password123 | user | ₡2,000,000 |
| player2 | password123 | user | ₡2,000,000 |
| player3-5 | password123 | user | ₡2,000,000 each |

### Weapons (10 Total)
- **Energy**: Laser Rifle (₡150k), Plasma Cannon (₡300k), Ion Beam (₡400k)
- **Ballistic**: Machine Gun (₡100k), Shotgun (₡120k), Railgun (₡350k)
- **Melee**: Power Sword (₡180k), Hammer (₡200k)
- **Explosive**: Grenade Launcher (₡250k), Rocket Launcher (₡320k)

### Economy
- Robot frame: ₡500,000
- Attribute upgrade: (level + 1) × 1,000 Credits
- 23 attributes per robot (Combat Systems, Defensive Systems, Chassis & Mobility, AI Processing, Team Coordination)

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
docker ps                    # Database should be running
curl http://localhost:3001/api/health  # Backend check
open http://localhost:3000   # Frontend (opens browser)
```

**View logs:**
```bash
docker compose logs -f       # Database logs
# Backend/frontend logs are in the terminals
```

---

For more details, see:
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Complete schema reference
- [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Attribute system details
- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) - Facility and economy system

**Happy coding! 🤖⚔️**
