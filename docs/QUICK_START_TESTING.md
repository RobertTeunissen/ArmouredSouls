# Quick Start Testing - Matchmaking System

**Last Updated**: January 31, 2026

Ultra-quick reference for testing the matchmaking system.

---

## 🔐 Admin Login

**Frontend UI:**
- URL: http://localhost:5173/login
- Username: `admin`
- Password: `admin123`

**API Token:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | \
  jq -r '.token')

echo $TOKEN
```

---

## 🚀 Start Services

```bash
# Terminal 1: Backend
cd prototype/backend
npm run dev

# Terminal 2: Frontend
cd prototype/frontend
npm run dev
```

**URLs:**
- Backend: http://localhost:3001
- Frontend: http://localhost:5173

---

## ⚡ Quick Tests

### Test #1: View Database State
```bash
cd prototype/backend
node scripts/showDatabaseSummary.js
```

### Test #2: Run Complete Cycle
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | jq -r '.token')

curl -X POST http://localhost:3001/api/admin/cycles/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cycles": 1, "autoRepair": true}' | jq '.'
```

### Test #3: Run 10 Cycles
```bash
curl -X POST http://localhost:3001/api/admin/cycles/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cycles": 10, "autoRepair": true}' | jq '.'
```

### Test #4: Check Results
```bash
node scripts/showDatabaseSummary.js
```

---

## 📊 Admin API Endpoints

**Get System Stats:**
```bash
curl http://localhost:3001/api/admin/stats \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Run Matchmaking:**
```bash
curl -X POST http://localhost:3001/api/admin/matchmaking/run \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Execute Battles:**
```bash
curl -X POST http://localhost:3001/api/admin/battles/run \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Rebalance Leagues:**
```bash
curl -X POST http://localhost:3001/api/admin/leagues/rebalance \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Repair All Robots:**
```bash
curl -X POST http://localhost:3001/api/admin/repair/all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deductCosts": false}' | jq '.'
```

---

## 🧪 Testing Scripts

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

---

## 👥 Test Accounts

| Type | Username | Password | Role |
|------|----------|----------|------|
| Admin | `admin` | `admin123` | admin |
| Player 1-5 | `player1` | `password123` | player |
| Test 1-100 | `test1` | `test123` | player |

---

## 🎯 Frontend Pages

| Page | URL | What to Check |
|------|-----|---------------|
| Login | http://localhost:5173/login | Admin login works |
| Dashboard | http://localhost:5173/dashboard | Upcoming/recent matches |
| Battle History | http://localhost:5173/battle-history | All battles with pagination |
| League Standings | http://localhost:5173/league-standings | All 6 tiers with rankings |

---

## ✅ Success Criteria

- ✅ Can login as admin
- ✅ Matchmaking creates ~50 matches
- ✅ Battles execute successfully
- ✅ Stats update (ELO, HP, LP)
- ✅ Battle logs generated
- ✅ Frontend displays data correctly

---

## 🐛 Quick Fixes

**Can't login?**
```bash
cd prototype/backend
npm run seed
```

**No matches created?**
```bash
# Repair robots first
curl -X POST http://localhost:3001/api/admin/repair/all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deductCosts": false}'
```

**Database issues?**
```bash
cd prototype
docker compose down -v
docker compose up -d
sleep 15
cd backend
npx prisma migrate deploy
npm run seed
```

---

## 📚 Full Documentation

For detailed instructions, see:
- **[MATCHMAKING_TESTING_GUIDE.md](./MATCHMAKING_TESTING_GUIDE.md)** - Complete testing guide
- **[MATCHMAKING_SYSTEM_GUIDE.md](./MATCHMAKING_SYSTEM_GUIDE.md)** - System documentation
- **[SETUP.md](./SETUP.md)** - Initial setup

---

**That's it! You're ready to test! 🎮**
