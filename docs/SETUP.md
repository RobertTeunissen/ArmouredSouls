# Phase 1 Setup Guide

**Last Updated**: January 24, 2026

This guide will help you set up the Phase 1 local prototype of Armoured Souls on your machine.

## ✅ Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js 20+**
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **Docker Desktop**
   - Download: https://www.docker.com/products/docker-desktop
   - Verify: `docker --version` and `docker-compose --version`

3. **Git**
   - Download: https://git-scm.com/
   - Verify: `git --version`

4. **Code Editor** (recommended)
   - VS Code: https://code.visualstudio.com/

## 📥 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/RobertTeunissen/ArmouredSouls.git
cd ArmouredSouls/prototype
```

### Step 2: Start the Database

```bash
# Start PostgreSQL in Docker
docker-compose up -d

# Verify it's running
docker ps
```

You should see a container named `armouredsouls-db` running.

### Step 3: Set Up the Backend

```bash
cd backend

# Create environment file
cp .env.example .env

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed the database with sample data
npx tsx prisma/seed.ts
```

Expected output:
```
🌱 Seeding database...
Creating components...
✅ Created 3 chassis, 3 weapons, 3 armor
Creating test users...
✅ Created 6 users
   - admin/admin123 (admin role)
   - player1-5/password123 (regular users)
✅ Database seeded successfully!
```

### Step 4: Set Up the Frontend

```bash
cd ../frontend

# Install dependencies
npm install
```

### Step 5: Start the Development Servers

Open two terminal windows/tabs:

**Terminal 1 - Backend:**
```bash
cd ArmouredSouls/prototype/backend
npm run dev
```

Expected output:
```
🚀 Backend server running on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd ArmouredSouls/prototype/frontend
npm run dev
```

Expected output:
```
VITE v5.0.11  ready in 500 ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

### Step 6: Verify Installation

1. Open your browser to http://localhost:3000
2. You should see the Armoured Souls homepage
3. Status should show "Armoured Souls API is running"

## 🔧 Development Tools

### Prisma Studio (Database GUI)

View and edit your database visually:

```bash
cd backend
npm run prisma:studio
```

Opens at http://localhost:5555

### Database Commands

```bash
# View database
npm run prisma:studio

# Create a new migration
npm run prisma:migrate

# Generate Prisma client (after schema changes)
npm run prisma:generate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Restart Services

**Restart Database:**
```bash
docker-compose restart
```

**Restart Backend:**
- Press `Ctrl+C` in the backend terminal
- Run `npm run dev` again

**Restart Frontend:**
- Press `Ctrl+C` in the frontend terminal
- Run `npm run dev` again

## 🐛 Troubleshooting

### Database Won't Start

**Problem**: `docker-compose up -d` fails

**Solutions**:
1. Check Docker is running:
   ```bash
   docker ps
   ```
2. Check if port 5432 is already in use:
   ```bash
   # On macOS/Linux
   lsof -i :5432
   
   # On Windows
   netstat -ano | findstr :5432
   ```
3. Change the port in `docker-compose.yml`:
   ```yaml
   ports:
     - "5433:5432"  # Use 5433 instead
   ```
   Then update `DATABASE_URL` in `backend/.env` to use port 5433

### Backend Won't Start

**Problem**: Port 3001 already in use

**Solution**: Change port in `backend/.env`:
```
PORT=3002
```

**Problem**: Database connection fails

**Solutions**:
1. Verify database is running: `docker ps`
2. Check `DATABASE_URL` in `backend/.env`
3. Restart database: `docker-compose restart`

**Problem**: Prisma errors

**Solutions**:
1. Regenerate Prisma client:
   ```bash
   npm run prisma:generate
   ```
2. Run migrations again:
   ```bash
   npm run prisma:migrate
   ```

### Frontend Won't Start

**Problem**: Port 3000 already in use

**Solution**: Frontend will prompt you to use a different port (usually 3001). Say yes.

**Problem**: Can't connect to backend

**Solutions**:
1. Verify backend is running on port 3001
2. Check browser console for CORS errors
3. If backend is on a different port, update `vite.config.ts`:
   ```typescript
   proxy: {
     '/api': {
       target: 'http://localhost:3002', // Update port
       changeOrigin: true,
     },
   }
   ```

### npm install Fails

**Problem**: Dependency installation errors

**Solutions**:
1. Clear npm cache:
   ```bash
   npm cache clean --force
   ```
2. Delete `node_modules` and `package-lock.json`:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
3. Update npm:
   ```bash
   npm install -g npm@latest
   ```

## 📊 Test Data

The seed script creates:

### Users
| Username | Password | Role | Currency |
|----------|----------|------|----------|
| admin | admin123 | admin | ₡10,000,000 |
| player1 | password123 | user | ₡1,000,000 |
| player2 | password123 | user | ₡1,000,000 |
| player3 | password123 | user | ₡1,000,000 |
| player4 | password123 | user | ₡1,000,000 |
| player5 | password123 | user | ₡1,000,000 |

### Weapons (11 Total)

**Energy Weapons:**
- Laser Rifle (₡150,000) - Accuracy +3, Energy Efficiency +5, Targeting +2
- Plasma Cannon (₡300,000) - Attack +5, Crit +4, Heat Management -3
- Ion Beam (₡400,000) - Energy Efficiency +8, Armor Pen +6, Reload +4

**Ballistic Weapons:**
- Machine Gun (₡100,000) - Attack +2, Reload +6, Weapon Handling +3
- Railgun (₡350,000) - Armor Pen +10, Accuracy +5, Reload -2
- Shotgun (₡120,000) - Attack +4, Crit +5, Accuracy -3

**Melee Weapons:**
- Power Sword (₡180,000) - Strength +6, Counter +5, Agility +3
- Hammer (₡200,000) - Strength +8, Attack +6, Speed -2

**Explosive Weapons:**
- Rocket Launcher (₡320,000) - Attack +7, Crit +6, Reload -4
- Grenade Launcher (₡250,000) - Attack +5, Tactical +4, Reload -2

### Robot Attributes

Each robot starts with 25 attributes at level 1:
- **Combat** (8): Attack Power, Accuracy, Critical Strike, Defense Rating, Evasion, Counter Attack, Armor Penetration, Damage Resistance
- **Technical** (6): Weapon Handling, Energy Efficiency, Targeting Systems, Heat Management, Shield Operations, Reload Speed
- **Physical** (6): Hull Integrity, Speed, Agility, Strength, Stamina, Structural Stability
- **Mental** (5): Tactical Awareness, Composure, Adaptability, Aggression, Combat Intelligence

## 🚀 Next Steps

Now that you have the basic setup running:

1. **Explore the code structure**
   - Backend: `backend/src/index.ts`
   - Frontend: `frontend/src/App.tsx`
   - Database: `backend/prisma/schema.prisma`

2. **Review the documentation**
   - [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Complete attribute system and economy
   - [PHASE1_PLAN.md](PHASE1_PLAN.md) - Development plan
   - [GAME_DESIGN.md](GAME_DESIGN.md) - Game design decisions

3. **Understand the game economy**
   - Starting balance: ₡1,000,000 Credits
   - Robot frame: ₡500,000
   - Weapons: ₡100,000 - ₡400,000
   - Upgrades: (level + 1) × 1,000 Credits

4. **Start building features**
   - Authentication system
   - Robot creator with 25 attributes
   - Weapon shop
   - Battle simulator with formula-based combat
   - UI pages

## 📚 Additional Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **Express Docs**: https://expressjs.com/
- **React Docs**: https://react.dev/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Vite Docs**: https://vitejs.dev/

## 🆘 Getting Help

If you encounter issues not covered in this guide:

1. Check the [QUESTIONS.md](QUESTIONS.md) for known issues
2. Review error messages carefully
3. Search for similar issues online
4. Document the issue for future reference

---

**Happy coding! 🤖⚔️**
