# Matchmaking System - Testing Guide

**Last Updated**: January 31, 2026

Complete guide for testing the matchmaking system, including how to access the admin portal, run tests, and verify system functionality.

---

## 🎯 Quick Start Testing

### Prerequisites
- Backend running: `cd prototype/backend && npm run dev`
- Frontend running: `cd prototype/frontend && npm run dev`
- Database seeded: `cd prototype/backend && npm run seed`

### Admin Access Credentials

**Username**: `admin`  
**Password**: `admin123`

The admin user is automatically created when you run `npm run seed`.

---

## 🔐 How to Access the Admin Portal

### Method 1: Via Frontend UI

1. **Start the application**:
   ```bash
   # Terminal 1: Start backend
   cd prototype/backend
   npm run dev
   # Should start on http://localhost:3001

   # Terminal 2: Start frontend
   cd prototype/frontend
   npm run dev
   # Should start on http://localhost:3000
   ```

2. **Login with admin credentials**:
   - Open browser: http://localhost:3000
   - Click "Login" or go to http://localhost:3000/login
   - Enter username: `admin`
   - Enter password: `admin123`
   - Click "Login"

3. **Access the Admin Portal**:
   - After login, look for the **⚡ Admin** link in the navigation bar (yellow text, right side)
   - Click on it to go to http://localhost:3000/admin
   - You'll see the Admin Portal with system controls

4. **What You Can Do in the Admin Portal**:
   - **View System Statistics**: See robot counts, match counts, battle stats
   - **Run Matchmaking**: Click "🎯 Run Matchmaking" to create matches
   - **Execute Battles**: Click "⚔️ Execute Battles" to run scheduled battles
   - **Rebalance Leagues**: Click "📊 Rebalance Leagues" for promotions/demotions
   - **Auto-Repair**: Click "🔧 Auto-Repair All Robots" to restore all HP
   - **Bulk Cycles**: Run 1-100 complete cycles automatically

**Note**: The **⚡ Admin** navigation link is only visible to users with the admin role. Regular players (player1-5, test_user_001-100) will NOT see this link.

### Method 2: Via API/curl (Direct API Testing)

1. **Get JWT token**:
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "admin123"}'
   ```

   **Response**:
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": "...",
       "username": "admin",
       "role": "admin"
     }
   }
   ```

2. **Copy the token** from the response

3. **Use token for admin endpoints**:
   ```bash
   TOKEN="your_token_here"
   
   # Get system stats
   curl http://localhost:3001/api/admin/stats \
     -H "Authorization: Bearer $TOKEN"
   ```

---

## 🧪 Testing Scenarios

### Scenario 1: Complete Daily Cycle Test

This tests the entire matchmaking workflow from start to finish.

**Step 1: Check initial state**
```bash
# View database summary
cd prototype/backend
node scripts/showDatabaseSummary.js
```

**Expected Output**:
```
📊 DATABASE SUMMARY
Users: 107 (1 admin + 5 players + 100 test + 1 bye-robot)
Robots: 101 (100 test robots + 1 bye-robot)
Battle-ready robots: 100/100 (100%)
```

**Step 2: Login as admin and get token**
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | \
  jq -r '.token')

echo "Token: $TOKEN"
```

**Step 3: Optional - Repair all robots**
```bash
curl -X POST http://localhost:3001/api/admin/repair/all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deductCosts": false}'
```

**Expected Output**:
```json
{
  "robotsRepaired": 100,
  "totalCost": 0,
  "costsDeducted": false,
  "repairs": [...]
}
```

**Step 4: Run matchmaking**
```bash
curl -X POST http://localhost:3001/api/admin/matchmaking/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Output**:
```json
{
  "matchesCreated": 50,
  "scheduledFor": "2026-01-31T08:00:00.000Z",
  "timestamp": "2026-01-31T07:00:00.000Z"
}
```

**Step 5: Execute battles**
```bash
curl -X POST http://localhost:3001/api/admin/battles/run \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Output**:
```json
{
  "summary": {
    "totalBattles": 50,
    "successfulBattles": 50,
    "failedBattles": 0
  },
  "details": [...]
}
```

**Step 6: Check battle results**
```bash
# View updated database
node scripts/showDatabaseSummary.js

# View specific battle logs via API
curl http://localhost:3001/api/matches/history \
  -H "Authorization: Bearer $TOKEN"
```

**Step 7: Rebalance leagues (optional, after 5+ cycles)**
```bash
curl -X POST http://localhost:3001/api/admin/leagues/rebalance \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Output**:
```json
{
  "summary": {
    "totalPromoted": 0,
    "totalDemoted": 0,
    "message": "Not enough battles for rebalancing"
  }
}
```

### Scenario 2: Bulk Cycle Testing

Test multiple complete cycles automatically.

**Run 10 complete cycles**:
```bash
curl -X POST http://localhost:3001/api/admin/cycles/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cycles": 10,
    "autoRepair": true
  }'
```

**Expected Output**:
```json
{
  "cyclesCompleted": 10,
  "results": [
    {
      "cycle": 1,
      "matchmakingSuccess": true,
      "matchesCreated": 50,
      "battlesSuccess": true,
      "battlesExecuted": 50,
      "rebalancingSuccess": true,
      "promotions": 10,
      "demotions": 10,
      "duration": "2.5s"
    },
    ...
  ],
  "totalDuration": "25s",
  "averageCycleDuration": "2.5s"
}
```

### Scenario 3: Test Frontend UI

**Test Dashboard**:
1. Login as admin (username: `admin`, password: `admin123`)
2. Go to Dashboard: http://localhost:3000/dashboard
3. Verify:
   - ✅ "Upcoming Matches" section shows scheduled matches
   - ✅ "Recent Matches" section shows last 5 battles
   - ✅ Battle readiness warnings appear if robots have low HP

**Test Battle History**:
1. Go to Battle History: http://localhost:3000/battle-history
2. Verify:
   - ✅ List of all battles with pagination
   - ✅ Win/loss indicators with colors (green win, red loss)
   - ✅ ELO changes shown (e.g., "+16" or "-16")
   - ✅ HP status displayed
   - ✅ Rewards shown in credits

**Test League Standings**:
1. Go to Leagues: http://localhost:3000/league-standings
2. Verify:
   - ✅ Tabs for all 6 tiers (Bronze, Silver, Gold, Platinum, Diamond, Champion)
   - ✅ Robot rankings with ELO, league points, W-L record
   - ✅ Your robots highlighted in the list
   - ✅ Pagination working for large leagues

### Scenario 4: Test Admin Portal UI

**Access Admin Portal**:
1. Login as admin at http://localhost:3000/login
2. Click the **⚡ Admin** link in navigation (yellow text, right side)
3. You'll be on http://localhost:3000/admin

**Test Admin Controls**:

1. **View System Statistics**:
   - Click "Refresh Stats" button
   - Verify you see:
     - ✅ Total robots count
     - ✅ Battle-ready percentage
     - ✅ Robots by tier (Bronze, Silver, Gold, etc.)
     - ✅ Scheduled/completed matches
     - ✅ Battle statistics (last 24 hours, total)

2. **Test Auto-Repair**:
   - Click "🔧 Auto-Repair All Robots"
   - Wait for success message
   - Verify: "Repaired X robots" appears
   - Stats automatically refresh

3. **Test Matchmaking**:
   - Click "🎯 Run Matchmaking"
   - Wait for success message
   - Verify: "Created X matches" appears
   - Scheduled matches count increases in stats

4. **Test Battle Execution**:
   - Click "⚔️ Execute Battles"
   - Wait for success message
   - Verify: "Total: X, Success: Y" appears
   - Completed battles count increases

5. **Test League Rebalancing**:
   - Click "📊 Rebalance Leagues"
   - Wait for success message
   - Verify: "Promoted: X, Demoted: Y" appears

6. **Test Bulk Cycles**:
   - Set cycles to 3
   - Check "Auto-repair before each cycle"
   - Click "🚀 Run 3 Cycles"
   - Wait for completion (may take 10-20 seconds)
   - Verify detailed results appear:
     - ✅ Cycles completed
     - ✅ Total duration
     - ✅ Average cycle duration
     - ✅ Breakdown of each cycle (repair, matchmaking, battles, rebalancing)

**Verify Regular Users Don't See Admin**:
1. Logout from admin account
2. Login as `player1` / `password123`
3. Verify: NO **⚡ Admin** link in navigation
4. Try accessing http://localhost:3000/admin directly
5. Verify: Still can access (no role check in route), but API calls will fail with 403 Forbidden

### Scenario 5: Test Battle Logs

**Get battle log via API**:
```bash
# First, get a battle ID from history
BATTLE_ID=$(curl -s http://localhost:3001/api/matches/history \
  -H "Authorization: Bearer $TOKEN" | \
  jq -r '.battles[0].id')

# Get detailed battle log
curl http://localhost:3001/api/matches/battles/$BATTLE_ID/log \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Output**:
```json
{
  "battle": {
    "id": "battle-id",
    "robot1": {...},
    "robot2": {...},
    "winner": "robot1",
    "durationSeconds": 35
  },
  "log": {
    "events": [
      {
        "timestamp": 0,
        "type": "battle_start",
        "message": "⚔️ Battle commences! Iron Gladiator (ELO 1200) vs Steel Gladiator (ELO 1200)..."
      },
      {
        "timestamp": 2.5,
        "type": "attack",
        "attacker": "robot1",
        "message": "💥 Iron Gladiator strikes with precision! Steel Gladiator takes damage."
      },
      {
        "timestamp": 35,
        "type": "battle_end",
        "winner": "robot1",
        "message": "🏆 VICTORY! Iron Gladiator emerges victorious!"
      },
      {
        "timestamp": 35,
        "type": "elo_change",
        "robot": "robot1",
        "message": "📈 Iron Gladiator: 1200 → 1216 (+16 ELO)"
      }
    ],
    "isByeMatch": false
  }
}
```

---

## 🔧 Testing Scripts Reference

All scripts are located in `prototype/backend/scripts/`

### Database Scripts

**Show database summary**:
```bash
cd prototype/backend
node scripts/showDatabaseSummary.js
```

**Test database connection**:
```bash
node scripts/testDb.js
```

**Verify database updates**:
```bash
node scripts/verifyDatabaseUpdate.js
```

### Matchmaking Scripts

**Test matchmaking**:
```bash
node scripts/testMatchmakingSimple.js
```

**Advanced matchmaking test**:
```bash
npm run test:matchmaking
# or
npx tsx scripts/testMatchmaking.ts
```

### Battle Execution Scripts

**Test battle execution**:
```bash
node scripts/testBattleExecution.js
```

**Execute scheduled battles**:
```bash
node scripts/executeBattles.js
```

### League Rebalancing Scripts

**Test league rebalancing**:
```bash
node scripts/testLeagueRebalancing.js
```

### Admin API Testing

**Test all admin endpoints**:
```bash
node scripts/testAdminAPI.js
```

This script tests:
- Login with admin credentials
- Get system stats
- Run matchmaking
- Execute battles
- Rebalance leagues
- Auto-repair robots
- Bulk cycle execution

---

## 📊 What to Look For

### Successful Matchmaking
- ✅ ~50 matches created for 100 robots
- ✅ All robots paired (or 1 with bye-robot if odd number)
- ✅ ELO differences within ±300
- ✅ No duplicate pairings in same cycle

### Successful Battle Execution
- ✅ All scheduled matches executed
- ✅ Battle records created in database
- ✅ Robot stats updated (ELO, HP, league points, W-L record)
- ✅ Credits awarded to users
- ✅ Battle logs generated

### Successful League Rebalancing
- ✅ Rebalancing runs every cycle
- ✅ Top 10% promoted (if ≥5 cycles in current league and ≥10 robots per tier)
- ✅ Bottom 10% demoted (same conditions)
- ✅ League points reset to 0 after tier change
- ✅ Cycles in current league reset to 0 after tier change
- ✅ ELO preserved during tier changes
- ✅ Instances rebalanced after moves

---

## 🐛 Troubleshooting

### Problem: "Cannot login as admin"

**Solution**:
```bash
# Re-seed database to recreate admin user
cd prototype/backend
npm run seed
```

**Verify admin user exists**:
```bash
npx prisma studio
# Open in browser, check Users table for username "admin"
```

### Problem: "No matches created"

**Possible causes**:
1. Robots have low HP (need ≥75%)
2. Robots missing weapons
3. Already scheduled for another match

**Solution**:
```bash
# Repair all robots first
curl -X POST http://localhost:3001/api/admin/repair/all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deductCosts": false}'

# Then run matchmaking
curl -X POST http://localhost:3001/api/admin/matchmaking/run \
  -H "Authorization: Bearer $TOKEN"
```

### Problem: "Battles not executing"

**Possible causes**:
1. No scheduled matches exist
2. Scheduled time is in the future
3. Database connection issue

**Solution**:
```bash
# Check for scheduled matches
node scripts/showDatabaseSummary.js

# Force execute with current timestamp
curl -X POST http://localhost:3001/api/admin/battles/run \
  -H "Authorization: Bearer $TOKEN"
```

### Problem: "League rebalancing does nothing"

**Requirements for rebalancing**:
- ≥10 robots in a tier
- Robots need ≥5 cycles in their current league
- Run multiple cycles to accumulate cycles in league (rebalancing now happens every cycle)

**Solution**:
```bash
# Run 10 cycles to accumulate battles
curl -X POST http://localhost:3001/api/admin/cycles/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cycles": 10, "autoRepair": true}'

# Then rebalance should work
curl -X POST http://localhost:3001/api/admin/leagues/rebalance \
  -H "Authorization: Bearer $TOKEN"
```

### Problem: "401 Unauthorized" on API calls

**Cause**: JWT token expired or invalid

**Solution**:
```bash
# Get fresh token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | \
  jq -r '.token')

# Verify token
echo $TOKEN
```

### Problem: "403 Forbidden" on admin endpoints

**Cause**: Logged in as regular user, not admin

**Solution**:
- Logout and login as admin (username: `admin`, password: `admin123`)
- Or use admin token for API calls

---

## 🎮 Test User Accounts

The seed script creates multiple test accounts:

### Admin Account
- **Username**: `admin`
- **Password**: `admin123`
- **Role**: admin
- **Currency**: ₡10,000,000

### Player Accounts (for manual testing)
- **Username**: `player1` to `player5`
- **Password**: `password123` (same for all)
- **Role**: player
- **Currency**: ₡50,000 each
- **Robots**: 1 robot each (customizable names)

### Test Accounts (for matchmaking)
- **Usernames**: `test_user_001` to `test_user_100`
- **Password**: `testpass123` (same for all)
- **Role**: user
- **Currency**: ₡100,000 each
- **Robots**: 1 robot each with creative names

### Special Account
- **Username**: `bye-robot-user`
- **Robot**: "Bye Robot" (used for odd-number matchmaking)
- **ELO**: 1000 (always loses)

---

## 📈 Performance Benchmarks

Expected performance on development machine:

| Operation | Expected Time | Acceptable Range |
|-----------|--------------|------------------|
| Matchmaking (100 robots) | <2 seconds | <5 seconds |
| Battle execution (50 battles) | <5 seconds | <30 seconds |
| League rebalancing | <1 second | <5 seconds |
| API response time | <100ms | <200ms |
| Complete cycle | <10 seconds | <40 seconds |
| 10 bulk cycles | <100 seconds | <400 seconds |

---

## 🧩 Integration Test Suite

Run the full integration test suite:

```bash
cd prototype/backend

# Run all tests
npm test

# Run specific test suites
npm test -- leagueInstanceService.test.ts
npm test -- matchmakingService.test.ts
npm test -- battleOrchestrator.test.ts
npm test -- leagueRebalancingService.test.ts
npm test -- combatMessageGenerator.test.ts
npm test -- integration.test.ts

# Run with coverage
npm test -- --coverage
```

**Expected Results**:
- ✅ 49 unit tests passing
- ✅ 4 integration tests passing (when database is available)
- ✅ >80% code coverage

---

## 📝 Manual Testing Checklist

Use this checklist for comprehensive manual testing:

### Backend API Testing
- [ ] Login as admin successfully
- [ ] Get system statistics
- [ ] Run matchmaking (creates ~50 matches)
- [ ] Execute battles (all succeed)
- [ ] View battle history
- [ ] Get battle logs with combat messages
- [ ] Repair all robots
- [ ] Rebalance leagues (after 5+ cycles)
- [ ] Run bulk cycles (10 cycles)
- [ ] Test all player endpoints (upcoming, history, standings)

### Frontend UI Testing
- [ ] Login page works
- [ ] Dashboard shows upcoming/recent matches
- [ ] Battle history page displays correctly
- [ ] Pagination works on battle history
- [ ] League standings show all 6 tiers
- [ ] Tab switching works on standings
- [ ] Your robots are highlighted
- [ ] ELO changes display correctly (green/red)
- [ ] Battle readiness warnings appear when needed
- [ ] Navigation links all work
- [ ] Logout works

### Edge Cases
- [ ] Test with odd number of robots (bye-robot match)
- [ ] Test with all robots below 75% HP (no matches)
- [ ] Test with empty league (no errors)
- [ ] Test with single robot in league (no match)
- [ ] Test promotion from Champion (no promotion)
- [ ] Test demotion from Bronze (no demotion)

---

## 🚀 Quick Test Command Reference

**One-liner to test everything**:
```bash
# Get token, run complete cycle, check results
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | jq -r '.token') && \
curl -s -X POST http://localhost:3001/api/admin/cycles/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cycles": 1, "autoRepair": true}' | jq '.'
```

**Quick health check**:
```bash
# Check if everything is running
curl http://localhost:3001/health && \
curl http://localhost:3000 && \
echo "✅ All systems operational"
```

---

## 📚 Additional Resources

- [MATCHMAKING_SYSTEM_GUIDE.md](./MATCHMAKING_SYSTEM_GUIDE.md) - Complete system documentation
- [PRD_MATCHMAKING.md](./PRD_MATCHMAKING.md) - Product requirements
- [MATCHMAKING_IMPLEMENTATION.md](./MATCHMAKING_IMPLEMENTATION.md) - Technical implementation details
- [SETUP.md](./SETUP.md) - Initial setup instructions

---

## 🎯 Success Criteria

Your matchmaking system is working correctly if:

✅ **Matchmaking**
- Creates ~50 matches for 100 robots
- Respects ELO ranges (±150 ideal, ±300 max)
- Handles odd numbers with bye-robot
- No duplicate pairings in same cycle

✅ **Battle Execution**
- All scheduled matches execute
- Stats update correctly (ELO, HP, LP, W-L)
- Battle logs generated with combat messages
- Credits awarded properly

✅ **League Progression**
- Promotions/demotions work after 5+ cycles
- Top 10% promoted, bottom 10% demoted
- League points reset, ELO preserved
- Instances balanced automatically

✅ **UI/UX**
- Dashboard shows relevant information
- Battle history paginated and filterable
- League standings display all tiers
- Admin can trigger all operations

---

**Happy Testing! 🎮**

If you encounter any issues not covered in this guide, check the troubleshooting section or refer to the main documentation files.
