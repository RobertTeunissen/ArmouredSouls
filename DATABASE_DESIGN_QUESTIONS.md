# DATABASE TABLES AND DESIGN QUESTIONS - ANSWERED

This document addresses all user questions about database tables, redundant fields, and design decisions.

---

## 1. CycleSnapshot Table - What is it used for?

### Purpose
The `CycleSnapshot` table stores aggregated statistics for each cycle to enable fast analytics queries without reprocessing all audit log events.

### Used By

**1. Cycle Summary Page** (`/api/analytics/cycle-summary`)
- Displays income, expenses, purchases, balance per cycle
- Shows breakdown of battle credits, merchandising, streaming, operating costs, repairs

**2. Comparison Service** (`comparisonService.ts`)
- Compare two cycles side-by-side
- Show changes in income/expenses between cycles

**3. Trend Analysis** (`trendAnalysisService.ts`)
- Historical trends over multiple cycles
- Income vs expenses trends
- Performance trends

**4. Robot Performance Service** (`robotPerformanceService.ts`)
- Robot stats aggregated per cycle
- Battles participated, wins, losses, earnings

**5. Facility Recommendations** (`facilityRecommendationService.ts`)
- Analyze spending patterns across cycles
- Recommend facility upgrades based on historical data

### Data Stored
```typescript
{
  cycle_number: 2,
  stableMetrics: [
    {
      userId: 60,
      battlesParticipated: 5,
      totalCreditsEarned: 19266,
      streamingIncome: 5010,
      merchandising: 0,
      totalExpenses: 16368,
      repairCosts: 14768,
      operatingCosts: 1600,
      balance: 122113  // Stored balance at end of cycle
    }
  ]
}
```

### Why Not Just Query AuditLog?
- **Performance**: Aggregating thousands of events is slow
- **Complexity**: Would need to join/aggregate multiple event types
- **Consistency**: Snapshot ensures same calculation logic each time
- **Speed**: Analytics page loads instantly instead of taking seconds

---

## 2 & 6. Tournament LeagueType - Why "bronze"?

### Problem (FIXED ✅)
Tournament battles were storing `leagueType: 'bronze'` (from robot's current league) even though tournaments don't have leagues.

### Root Cause
```typescript
// OLD CODE (WRONG)
leagueType: robot1.currentLeague  // Copied from robot
```

Tournaments are **separate from leagues**. A Bronze league robot can fight a Gold league robot in a tournament.

### Solution Applied
```typescript
// NEW CODE (CORRECT)
leagueType: null  // Tournaments don't have leagues
```

### Where Fixed
1. **Battle table** - Tournament battles now have `leagueType: null`
2. **Event payloads** - Tournament events have `leagueType: null`

**Files changed:**
- `tournamentBattleOrchestrator.ts` (line 381, 197, 241)

---

## 3. isDraw Field - Why redundant?

### Problem (FIXED ✅)
Event payloads had BOTH `isDraw: false` AND `result: "win/loss/draw"`.

**Example (OLD):**
```json
{
  "result": "win",
  "isDraw": false,  // Redundant!
  "opponentId": 75
}
```

### Why Redundant?
You can determine if it's a draw from the `result` field:
- `result === "draw"` → It's a draw
- `result === "win"` or `result === "loss"` → Not a draw

### Solution Applied
Removed `isDraw` field completely. Just use `result`:

**Example (NEW):**
```json
{
  "result": "draw",  // Clear and simple
  "opponentId": 75
}
```

**Files changed:**
- `battleOrchestrator.ts` (League battles)
- `tournamentBattleOrchestrator.ts` (Tournament battles)

---

## 4. Tag Team Battles - Still Not Normalized

### Current Problem ❌
Tag team battles create **2 events** (one per team), but should create **4 events** (one per robot).

**Current (WRONG):**
```
Tag Battle #50 → 2 events

Event 1: Team 1 (aggregated)
  userId: ??? (which robot's user?)
  robotId: ??? (which robot?)
  payload: { team1Credits: 5000, team2Credits: 2000, ... }

Event 2: Team 2 (aggregated)
  Same problem...
```

### Target (CORRECT): 4 Events, One Per Robot
```
Tag Battle #50 → 4 events

Event 1: Team 1, Robot A
  userId: 60
  robotId: 54
  battleId: 50
  payload: { result: "win", credits: 2500, streamingRevenue: 500, ... }

Event 2: Team 1, Robot B  
  userId: 61
  robotId: 55
  battleId: 50
  payload: { result: "win", credits: 2500, streamingRevenue: 502, ... }

Event 3: Team 2, Robot C
  userId: 62
  robotId: 75
  battleId: 50
  payload: { result: "loss", credits: 1000, streamingRevenue: 501, ... }

Event 4: Team 2, Robot D
  userId: 63
  robotId: 76
  battleId: 50
  payload: { result: "loss", credits: 1000, streamingRevenue: 503, ... }
```

### Revenue Split
**Team wins ₡5,000 credits + ₡1,002 streaming**
- Robot A: ₡2,500 credits + ₡501 streaming
- Robot B: ₡2,500 credits + ₡501 streaming

**Team loses ₡2,000 credits + ₡1,008 streaming**
- Robot C: ₡1,000 credits + ₡504 streaming
- Robot D: ₡1,000 credits + ₡504 streaming

### Implementation Needed
**File:** `tagTeamBattleOrchestrator.ts`

**Changes:**
1. Create 4 events instead of 2
2. Split team credits 50/50 between active and reserve robots
3. Split team streaming revenue 50/50
4. Each event has individual robotId, userId, battleId

**Status:** ⏳ TODO (complex change, requires careful refactoring)

---

## 5. TournamentMatch Table - Why separate from Battle?

### What TournamentMatch Stores
```typescript
{
  id: 1,
  tournamentId: 10,
  round: 1,
  matchNumber: 1,
  robot1Id: 54,
  robot2Id: 75,
  winnerId: 75,
  battleId: 102,
  status: 'completed',
  isByeMatch: false,
  parentMatchId: null  // ← Not in Battle table!
}
```

### Why Separate?

**Tournament-Specific Data:**
1. **Bracket Structure** - Parent/child match relationships
   - Quarterfinal match → points to Semifinal match (parent)
   - Winner advances to parent match
2. **Round Tracking** - Which round of the tournament
3. **Match Numbering** - Position in bracket (QF1, QF2, SF1, SF2, F)
4. **Bye Matches** - Robots that advance without fighting
5. **Advancement Logic** - Winner of Match 1 goes to Match 5

**Battle Table:**
- Records the actual combat that took place
- Damage dealt, HP, ELO changes
- Combat events, duration
- **No parent/child relationships**
- **No bracket structure**

### Example: 8-Robot Tournament

**TournamentMatch Table:**
```
Round 1 (Quarterfinals):
- Match 1: Robot 54 vs 75, winner→Match 5
- Match 2: Robot 55 vs 76, winner→Match 5
- Match 3: Robot 56 vs 77, winner→Match 6
- Match 4: Robot 57 vs 78, winner→Match 6

Round 2 (Semifinals):
- Match 5: Winner(M1) vs Winner(M2), winner→Match 7
- Match 6: Winner(M3) vs Winner(M4), winner→Match 7

Round 3 (Finals):
- Match 7: Winner(M5) vs Winner(M6)
```

**Battle Table:**
- Just stores 7 battle records (one per match)
- No parent/child links
- No advancement logic

### Could We Merge Them?

**No**, because:
1. Battle table is used for League, Tournament, and Tag battles
2. Only tournaments need bracket structure
3. Adding `parentMatchId`, `round`, `matchNumber` to Battle would clutter it
4. Separation of concerns: Battle = combat, TournamentMatch = structure

---

## 7. robot1RepairCost and robot2RepairCost - Are They Used?

### Investigation Results

**In Battle Table:**
- ✅ Fields exist: `robot1RepairCost`, `robot2RepairCost`
- ❌ Always set to 0 (deprecated)
- Comment says: "Deprecated: repair costs calculated by RepairService"

**In Event Payloads:**
- ✅ `repairCost` field exists (singular)
- ✅ **IS USED** by:
  - `cycleSnapshotService.ts` - Aggregates repair costs
  - `cycleCsvExportService.ts` - Exports to CSV

### Why Deprecated in Battle Table?

**Old System:**
```typescript
// Calculated during battle
robot1RepairCost: 1500
robot2RepairCost: 800
```

**New System:**
```typescript
// Calculated by RepairService when user actually repairs
// Depends on: repair academy level, discounts, etc.
// Not known at battle time
```

**Repair costs are calculated LATER:**
1. Battle happens → Robot damaged (finalHP < maxHP)
2. User decides to repair
3. RepairService calculates cost (with discounts, upgrades)
4. Cost logged in `robot_repair` audit event

### Can We Remove Them?

**From Battle Table:** ✅ Yes, they're always 0
**From Event Payloads:** ❌ No, `repairCost` (singular) is used

**Recommendation:**
1. Keep `repairCost` in event payloads (currently used)
2. Remove `robot1RepairCost` and `robot2RepairCost` from Battle table (always 0)

**Status:** ⏳ Could be cleaned up in future schema migration

---

## Summary of Fixes

| Issue | Status | Solution |
|-------|--------|----------|
| 1. CycleSnapshot usage | ℹ️ Answered | Used for fast analytics queries |
| 2. Tournament leagueType | ✅ Fixed | Set to null (tournaments don't have leagues) |
| 3. isDraw redundancy | ✅ Fixed | Removed, use `result: "draw"` instead |
| 4. Tag team 4 events | ❌ TODO | Need to refactor to create 4 events |
| 5. TournamentMatch table | ℹ️ Answered | Stores bracket structure, not in Battle |
| 6. Tournament leagueType (duplicate) | ✅ Fixed | Same as #2 |
| 7. repair cost fields | ℹ️ Answered | Battle table fields deprecated, payload field used |

---

## Files Modified

- ✅ `battleOrchestrator.ts` - Removed isDraw
- ✅ `tournamentBattleOrchestrator.ts` - Removed isDraw, fixed leagueType
- ⏳ `tagTeamBattleOrchestrator.ts` - TODO: Create 4 events

---

**Status:** Partially complete - Tag team refactoring still needed
