# Tournament System - Testing Guide

**Version:** 1.0  
**Last Updated:** February 5, 2026  
**Status:** Complete Implementation

---

## Quick Start Testing

### Prerequisites
```bash
# 1. Pull latest code
git pull

# 2. Install dependencies (if needed)
cd prototype/backend && npm install
cd prototype/frontend && npm install

# 3. Reset database
cd prototype/backend
npm run prisma:reset

# 4. Apply migrations
npm run prisma:migrate

# 5. Seed database (optional - includes test users)
npm run prisma:seed
```

### Running the System
```bash
# Terminal 1: Start backend
cd prototype/backend
npm run dev

# Terminal 2: Start frontend
cd prototype/frontend
npm run dev

# Terminal 3: Open browser
# Navigate to: http://localhost:5173
# Login as admin: admin@armouredsouls.com / password
```

---

## Test Scenario 1: Fresh Database (No Data)

### Steps
1. Reset database (clean slate)
2. Start backend
3. Start frontend
4. Login to admin panel
5. Navigate to "Daily Cycle" tab
6. Click "Run 1 Day"

### Expected Results

**First Cycle (No User Generation):**
```json
{
  "cycle": 1,
  "repairPreTournament": { "robotsRepaired": 0 },
  "tournaments": {
    "tournamentsExecuted": 0,
    "roundsExecuted": 0,
    "matchesExecuted": 0,
    "tournamentsCompleted": 0,
    "tournamentsCreated": 0
  },
  "repairPreLeague": { "robotsRepaired": 0 },
  "matchmaking": { "matchesCreated": 0 },
  "battles": { "battlesProcessed": 0 },
  "finances": { "usersProcessed": 0 }
}
```

**Status:** ✅ SUCCESS - This is expected behavior

**Why No Tournament?**
- Tournament auto-creation requires ≥8 battle-ready robots
- Fresh database has 0 robots
- Console log: `[Tournament] Insufficient robots for auto-tournament (0/8)`

---

## Test Scenario 2: Fresh Database WITH User Generation

### Steps
1. Reset database
2. Start backend and frontend
3. Login to admin panel
4. Navigate to "Daily Cycle" tab
5. Enable "Generate users per cycle" checkbox
6. Click "Run 10 Days"

### Expected Results by Cycle

**Cycle 1:**
- Users created: 1 (total: 1)
- Robots: 1
- Tournament: No (need 8+)

**Cycle 2:**
- Users created: 2 (total: 3)
- Robots: 3
- Tournament: No (need 8+)

**Cycle 3:**
- Users created: 3 (total: 6)
- Robots: 6
- Tournament: No (need 8+)

**Cycle 4:**
- Users created: 4 (total: 10)
- Robots: 10
- Tournament: **YES! First tournament auto-created!** 🏆
- Participants: All 10 battle-ready robots
- Bracket: 16-slot bracket (6 byes for top seeds)
- Round 1 execution: 5 matches fought

**Cycle 5:**
- Users created: 5 (total: 15)
- Tournament: Round 2 execution (Quarter-finals)
- New robots wait for next tournament

**Cycle 6:**
- Tournament: Round 3 execution (Semi-finals)

**Cycle 7:**
- Tournament: Round 4 execution (Finals)
- Champion crowned! 🏆
- First tournament completes

**Cycle 8:**
- Tournament: **New tournament auto-created!**
- All 15 battle-ready robots participate

### Console Logs to Watch For

**Cycle 1-3 (Before Tournament):**
```
[Admin] === Cycle 1 (1/10) ===
[Admin] Generated 1 users for cycle 1
[Tournament] Insufficient robots for auto-tournament (1/8)
```

**Cycle 4 (First Tournament):**
```
[Admin] === Cycle 4 (4/10) ===
[Admin] Generated 4 users for cycle 4
[Tournament] Auto-creating tournament with 10 eligible robots
[Tournament] Created tournament with 10 participants
[Tournament] Created 16-slot bracket (6 byes, 10 real matches)
[Admin] Auto-created tournament: All-Robots Tournament #1
[Admin] Tournaments: 1 executed, 1 rounds, 5 matches
```

**Cycle 7 (Finals):**
```
[Admin] === Cycle 7 (7/10) ===
[Tournament] Tournament completed! Champion: [RobotName]
[Admin] Tournaments: 1 executed, 1 rounds, 1 matches, 1 completed
```

---

## Test Scenario 3: With Seeded Data

### Setup
```bash
cd prototype/backend
npm run prisma:seed
```

### Expected State
- 100 users with robots
- All robots have weapons
- Sufficient robots for tournaments

### Test Steps
1. Login to admin panel
2. Navigate to "Tournaments" tab
3. Click "Create Tournament"

### Expected Results
- ✅ Tournament created immediately
- ✅ Shows participant count (e.g., "91 participants")
- ✅ Shows bracket size (e.g., "128-slot bracket")
- ✅ Shows current round: "Round 1/7"
- ✅ Lists all Round 1 matches
- ✅ Some matches marked as "Bye" (auto-complete)

### Execute Tournament
1. Click "Execute Round" button
2. Wait for processing (~5-30 seconds depending on matches)
3. Check results:
   - ✅ All non-bye matches completed
   - ✅ Winners advanced to next round
   - ✅ Current round increments
   - ✅ Round 2 matches now visible

---

## Test Scenario 4: Viewing Tournament Results

### As Admin
**Navigate to: Admin Panel → Tournaments Tab**

Can see:
- ✅ Active tournament details
- ✅ Current round matches
- ✅ Execute round button
- ✅ Participant count
- ✅ Tournament progress

### As Regular User
**Navigate to: Tournaments Page (nav menu)**

Can see:
- ✅ List of all tournaments
- ✅ Filter by status (All/Active/Pending/Completed)
- ✅ Status badges (🔴 Live, ⏳ Pending, ✓ Completed)
- ✅ Progress bars for active tournaments
- ✅ Champion names for completed tournaments
- ✅ Tournament stats (participants, rounds, dates)

**Navigate to: My Robots Page**

Can see:
- ✅ Upcoming tournament matches (with 🏆 badge)
- ✅ Round names (Finals, Semi-finals, Quarter-finals)
- ✅ Yellow border distinguishing tournament matches
- ✅ Both league and tournament matches displayed

**Navigate to: Battle History Page**

Can see:
- ✅ Past tournament battles (with 🏆 badge)
- ✅ Tournament name and round info
- ✅ Yellow double border for tournament battles
- ✅ Tournament rewards displayed

---

## Verification Checklist

### Backend Functionality
- [ ] Daily cycle completes without errors
- [ ] Tournament auto-creates when ≥8 robots available
- [ ] Tournament matches execute correctly
- [ ] Winners advance to next round properly
- [ ] Tournament completes and crowns champion
- [ ] New tournament auto-creates after completion
- [ ] Rewards calculated correctly (tournament size-based)
- [ ] Battle records created for all matches
- [ ] Bye matches auto-complete (no battle)

### Frontend Functionality
- [ ] Admin panel loads without errors
- [ ] Tournaments tab displays active tournaments
- [ ] Create tournament button works
- [ ] Execute round button works
- [ ] Tournament details display correctly
- [ ] Public tournaments page shows all tournaments
- [ ] Filter tabs work (All/Active/Pending/Completed)
- [ ] My Robots shows upcoming tournament matches
- [ ] Battle history shows tournament battles
- [ ] Tournament badges (🏆) display correctly
- [ ] Round names display correctly

### Error Handling
- [ ] Graceful handling of insufficient robots
- [ ] Clear error messages for failed operations
- [ ] Console logs helpful for debugging
- [ ] No white screen crashes
- [ ] Proper loading states

---

## Common Issues & Troubleshooting

### Issue: No Tournaments Created

**Symptom:** Daily cycle runs but no tournaments appear

**Possible Causes:**
1. **Insufficient robots** (<8 available)
   - Check: Admin panel → Stats → Total robots
   - Solution: Run more cycles with user generation enabled
   - Or: Manually seed database with test users

2. **Robots not battle-ready**
   - Robots need ≥75% HP
   - Robots need weapons equipped
   - Solution: Enable auto-repair in daily cycle

3. **Active tournament already exists**
   - Only creates new tournament if none active
   - Solution: Wait for current tournament to complete

**How to Verify:**
Check backend console for:
```
[Tournament] Insufficient robots for auto-tournament (X/8)
```
Or:
```
[Tournament] Active tournament exists. Skipping auto-creation.
```

### Issue: Admin Panel Blank White Page

**Symptom:** Navigating to /admin#tournaments shows blank page

**Cause:** Fixed in commit 1e812f8 (API response structure mismatch)

**Verify Fix:**
- Check browser console (F12) for errors
- Should see no errors related to `currentRoundMatches`
- Tournament details should load successfully

**If Still Broken:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check backend is running
4. Verify latest code pulled

### Issue: Battle History Shows Nothing

**Symptom:** Battle history page empty or shows error

**Possible Causes:**
1. **No battles yet** (fresh database)
   - Normal for new installations
   - Solution: Run some daily cycles to generate battles

2. **API error** (check console)
   - Check browser console (F12)
   - Look for error messages
   - Solution: Check backend logs for API errors

3. **Authentication issue**
   - Token expired or missing
   - Solution: Re-login

**Debugging:**
- Open browser console (F12)
- Look for logs starting with `[BattleHistory]`
- Error details will show specific issue

### Issue: Tournament Matches Don't Execute

**Symptom:** Execute round button doesn't work

**Possible Causes:**
1. **No current round matches**
   - Tournament already completed
   - Or all matches are byes (auto-complete)

2. **API error**
   - Check backend logs
   - Check browser console

3. **Robots not ready**
   - Should auto-repair before tournaments
   - Check robot HP levels

**Solution:**
- Check backend console for error details
- Verify tournament status in database
- Ensure auto-repair is enabled

---

## Performance Testing

### Small Tournament (15 robots)
- **Creation time:** <1 second
- **Match execution (per round):** 1-3 seconds
- **Total tournament duration:** 4 cycles (4 rounds)

### Medium Tournament (100 robots)
- **Creation time:** 1-2 seconds
- **Match execution (per round):** 5-15 seconds
- **Total tournament duration:** 7 cycles (7 rounds)

### Large Tournament (1000 robots)
- **Creation time:** 5-10 seconds
- **Match execution (per round):** 30-90 seconds
- **Total tournament duration:** 10 cycles (10 rounds)

**Note:** Execution time varies based on:
- Number of matches in round
- Server hardware
- Database performance
- Other concurrent operations

---

## Testing Reward Calculations

### Tournament Size Multiplier

**Formula:** `1 + (log10(totalParticipants / 10) × 0.5)`

**Examples:**
- 15 robots: `1.09×`
- 100 robots: `1.5×`
- 1,000 robots: `2.0×`
- 100,000 robots: `3.0×`

### Round Progress Multiplier

**Formula:** `currentRound / maxRounds`

**Examples (100 robots, 7 rounds):**
- Round 1: `1/7 = 0.14` (14%)
- Round 4: `4/7 = 0.57` (57%)
- Round 7 (Finals): `7/7 = 1.0` (100%)

### Win Rewards

**Formula:** `20,000 × tournamentSizeMultiplier × roundProgressMultiplier`

**Examples:**
- 15 robots, Round 2/4: ₡10,880
- 100 robots, Round 3/4: ₡22,500
- 100 robots, Finals: ₡30,000
- 1,000 robots, Round 5/10: ₡20,000
- 100k robots, Round 8/17: ₡28,235

### Participation Rewards (Losers)

**Formula:** `winnerReward × 0.30`

**Examples:**
- 100 robots, Finals loser: ₡9,000
- 1,000 robots, Semi-finals loser: ₡5,200

### Prestige Rewards

**Formula:** `15 × roundProgressMultiplier × tournamentSizeMultiplier + 500 (finals only)`

**Examples:**
- Quarter-finals: +11 prestige
- Semi-finals: +17 prestige
- Finals winner: +23 prestige + 500 bonus = +523 total

---

## Database Inspection

### Useful Queries

**Check tournament status:**
```sql
SELECT id, name, status, currentRound, maxRounds, totalParticipants, winnerId
FROM Tournament
ORDER BY createdAt DESC
LIMIT 10;
```

**Check tournament matches:**
```sql
SELECT id, tournamentId, round, robot1Id, robot2Id, winnerId, isByeMatch, status
FROM TournamentMatch
WHERE tournamentId = [TOURNAMENT_ID]
ORDER BY round, matchOrder;
```

**Check eligible robots:**
```sql
SELECT id, name, currentHP, maxHP, (currentHP * 1.0 / maxHP) as hpPercentage
FROM Robot
WHERE name != 'Bye Robot'
  AND currentHP >= maxHP * 0.75
ORDER BY elo DESC;
```

**Check battle history with tournaments:**
```sql
SELECT b.id, b.battleType, b.tournamentId, b.tournamentRound, 
       r1.name as robot1Name, r2.name as robot2Name, b.winnerId
FROM Battle b
LEFT JOIN Robot r1 ON b.robot1Id = r1.id
LEFT JOIN Robot r2 ON b.robot2Id = r2.id
WHERE b.tournamentId IS NOT NULL
ORDER BY b.createdAt DESC
LIMIT 20;
```

---

## API Testing (Optional)

### Using curl or Postman

**Get all tournaments:**
```bash
curl -X GET http://localhost:3001/api/admin/tournaments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Create tournament:**
```bash
curl -X POST http://localhost:3001/api/admin/tournaments/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Execute tournament round:**
```bash
curl -X POST http://localhost:3001/api/admin/tournaments/[ID]/execute-round \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Get eligible robots:**
```bash
curl -X GET http://localhost:3001/api/admin/tournaments/eligible-robots \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Success Criteria

A successful tournament system test should demonstrate:

1. ✅ **Auto-Creation:** Tournament automatically creates when conditions met
2. ✅ **Bracket Generation:** Proper power-of-2 bracket with byes
3. ✅ **Match Execution:** All matches process correctly
4. ✅ **Winner Advancement:** Winners move to next round
5. ✅ **Tournament Completion:** Champion crowned, next tournament starts
6. ✅ **Reward Distribution:** Size-based rewards calculated correctly
7. ✅ **Battle Records:** All matches saved to database
8. ✅ **UI Display:** All tournament info visible to users
9. ✅ **No Errors:** System runs smoothly without crashes
10. ✅ **Performance:** Handles tournaments of various sizes efficiently

---

## Additional Resources

- **PRD:** `/docs/PRD_TOURNAMENT_SYSTEM.md` - Complete specification
- **Implementation Summary:** `/docs/TOURNAMENT_IMPLEMENTATION_SUMMARY.md`
- **Completion Guide:** `/docs/TOURNAMENT_SYSTEM_COMPLETE.md`
- **Frontend Fixes:** `/docs/FRONTEND_FIXES_SUMMARY.md`

---

## Support & Feedback

**Found a bug?** Check:
1. Browser console (F12) for frontend errors
2. Backend terminal for API errors
3. Database for data inconsistencies

**Performance issues?** Consider:
1. Database indexing (already implemented)
2. Number of concurrent tournaments
3. Tournament size limits

**Questions?** Refer to:
- PRD for design decisions
- Implementation summary for code details
- This guide for expected behavior

---

**Happy Testing!** 🏆
