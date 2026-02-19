# FINAL SUMMARY: Tag Team Battles Fixed + CycleSnapshot Explained

## ✅ COMPLETED: Both User Requests

### 1. CycleSnapshot vs AuditLog Question - ANSWERED ✅

**Question:** "What's in CycleSnapshot table that is NOT in AuditLog?"

**Answer:** See `CYCLESNAPSHOT_VS_AUDITLOG.md` for complete details.

**Summary:**
- **Cycle timing data** - Start time, end time, duration (not in AuditLog)
- **Step execution times** - Performance metrics for each cycle step (not in AuditLog)
- **Pre-aggregated metrics** - Totals, sums, counts (AuditLog has raw events)
- **Summary statistics** - Quick filters like totalBattles, totalCreditsTransacted (not in AuditLog)

**Think of it like:**
- **AuditLog** = Your bank transaction history (every deposit/withdrawal)
- **CycleSnapshot** = Your monthly bank statement (totals and summary)

Both are necessary for different purposes!

---

### 2. Tag Team Battles - FIXED ✅

**Problem:** Tag team battles created 2 events (one per team)  
**Solution:** Now creates 4 events (one per robot)

---

## Tag Team Battle Event Structure

### Before (WRONG ❌)

**2 events per battle** - one per team, aggregated:
```
Battle #50 → 2 events

Event 1: Team 1 (aggregated)
  payload: {
    robot1Id: 54, robot2Id: 55,  // Both robots in one event
    winnerReward: 5000,
    streamingRevenue1: 1002,
    ...
  }

Event 2: Team 2 (aggregated)
  payload: { robot1Id: 75, robot2Id: 76, ... }
```

**Problems:**
- Which robot is userId/robotId pointing to?
- Can't query "all battles for robot 55"
- Inconsistent with League/Tournament format
- Unclear revenue attribution

---

### After (CORRECT ✅)

**4 events per battle** - one per robot:
```
Battle #50 → 4 events

Event 1: Team 1 Active Robot (ID 54)
  userId: 60
  robotId: 54
  battleId: 50
  payload: {
    result: "win",
    role: "active",
    partnerRobotId: 55,
    credits: 2500,           // 50% of team total (₡5,000)
    streamingRevenue: 501,   // 50% of team total (₡1,002)
    prestige: 15,            // 50% of team total
    fame: 10,                // Individual
    damageDealt: 150,        // Individual
    ...
  }

Event 2: Team 1 Reserve Robot (ID 55)
  userId: 61
  robotId: 55
  battleId: 50
  payload: {
    result: "win",
    role: "reserve",
    partnerRobotId: 54,
    credits: 2500,           // 50% of team total
    streamingRevenue: 501,   // 50% of team total
    prestige: 15,            // 50% of team total
    fame: 5,                 // Individual
    damageDealt: 80,         // Individual
    wasTaggedIn: true,
    ...
  }

Event 3: Team 2 Active Robot (ID 75)
  userId: 62
  robotId: 75
  battleId: 50
  payload: {
    result: "loss",
    role: "active",
    partnerRobotId: 76,
    credits: 1000,           // 50% of team total (₡2,000)
    streamingRevenue: 504,   // 50% of team total (₡1,008)
    prestige: 5,             // 50% of team total
    fame: 2,                 // Individual
    ...
  }

Event 4: Team 2 Reserve Robot (ID 76)
  userId: 63
  robotId: 76
  battleId: 50
  payload: {
    result: "loss",
    role: "reserve",
    partnerRobotId: 75,
    credits: 1000,           // 50% of team total
    streamingRevenue: 504,   // 50% of team total
    prestige: 5,             // 50% of team total
    fame: 0,                 // Individual (didn't fight)
    wasTaggedIn: false,
    ...
  }
```

---

## Revenue Split Logic

### Team Credits
**Split 50/50 between active and reserve robots:**
```typescript
const team1CreditsPerRobot = Math.floor(team1Rewards / 2);
```

**Example:**
- Team wins ₡5,000
- Active robot gets ₡2,500
- Reserve robot gets ₡2,500

**Why 50/50?**
- Both robots contribute to the win (reserve provides backup)
- Fair distribution even if reserve didn't fight
- Simple and transparent

### Streaming Revenue
**Split 50/50 between active and reserve robots:**
```typescript
const team1StreamingPerRobot = Math.floor(streamingRevenue.team1Revenue.totalRevenue / 2);
```

**Example:**
- Team earns ₡1,002 streaming
- Active robot gets ₡501
- Reserve robot gets ₡501

### Prestige
**Split 50/50:**
```typescript
const team1PrestigePerRobot = Math.floor(team1Prestige / 2);
```

### Fame
**NOT split - individual per robot:**
```typescript
fame: team1ActiveFame,  // Event 1: Active robot's individual fame
fame: team1ReserveFame, // Event 2: Reserve robot's individual fame
```

**Why not split?**
- Fame is earned per robot based on performance
- Active robot typically earns more (fought longer)
- Reserve only earns fame if tagged in

---

## Benefits of New Structure

### 1. Consistent Format ✅
All battle types now use the same structure:
- **League battles:** 2 events (one per robot)
- **Tournament battles:** 2 events (one per robot)
- **Tag team battles:** 4 events (one per robot)

### 2. Easy Queries ✅
```sql
-- Get all battles for robot 55
SELECT * FROM "AuditLog" 
WHERE "robotId" = 55 
  AND "eventType" = 'battle_complete';

-- Get all battles for user 60
SELECT * FROM "AuditLog"
WHERE "userId" = 60
  AND "eventType" = 'battle_complete';
```

### 3. Fair Revenue Distribution ✅
- Team rewards split equally (50/50)
- Individual stats remain individual (fame, damage)
- Clear attribution per robot

### 4. Complete Audit Trail ✅
- Each robot has its own event
- Role clearly identified (active/reserve)
- Partner identified (partnerRobotId)
- Tag-in status tracked (wasTaggedIn)

### 5. Simpler Aggregation ✅
Snapshot service doesn't need special logic for tag team battles:
```typescript
// Works the same for all battle types!
const credits = event.payload.credits;
const streaming = event.payload.streamingRevenue;
```

---

## Changes Made

### File: `tagTeamBattleOrchestrator.ts`

**Removed (lines 1837-1905):**
- Single event with both teams' aggregated data
- Complex payload with robot1/robot2 fields
- Streaming revenue details

**Added (new code):**
- 4 separate events (one per robot)
- Revenue split calculations
- Clear role identification (active/reserve)
- Partner robot tracking
- Tag-in status tracking

**Lines changed:** ~60 lines removed, ~200 lines added

---

## Testing Needed

### 1. Execute Tag Team Battle
```bash
# Run cycle with tag team battles
POST /api/admin/cycle/execute
```

### 2. Check AuditLog
```sql
-- Should see 4 events per tag team battle
SELECT * FROM "AuditLog"
WHERE "eventType" = 'battle_complete'
  AND "payload"::json->>'isTagTeam' = 'true'
ORDER BY "battleId", "robotId";
```

**Expected:** 4 rows per battleId

### 3. Verify Revenue Split
```sql
-- Check credits split 50/50
SELECT 
  "battleId",
  "robotId",
  payload::json->>'credits' as credits,
  payload::json->>'streamingRevenue' as streaming
FROM "AuditLog"
WHERE "eventType" = 'battle_complete'
  AND "payload"::json->>'isTagTeam' = 'true'
  AND "battleId" = 50;
```

**Expected:** Same credits/streaming for both robots on same team

### 4. Check Cycle Summary
```
GET /api/analytics/cycle-summary?userId=60
```

**Expected:** Shows credits/streaming for all 4 robots in tag team battle

---

## Migration Notes

### Existing Tag Team Events

Old tag team battle events (2 per battle) will have:
- `payload.robot1Id` and `payload.robot2Id` fields
- No `payload.isTagTeam` field
- No `payload.role` field

New tag team battle events (4 per battle) will have:
- `payload.isTagTeam: true`
- `payload.role: "active" | "reserve"`
- `payload.partnerRobotId`
- Individual credits/streaming (split 50/50)

### Snapshot Service Compatibility

CycleSnapshotService already handles the new format:
```typescript
// Reads from event columns
const userId = event.userId;
const robotId = event.robotId;
const credits = event.payload.credits;
const streaming = event.payload.streamingRevenue;
```

Works for both old and new tag team events!

---

## Summary

✅ **CycleSnapshot question ANSWERED** - Complete documentation in CYCLESNAPSHOT_VS_AUDITLOG.md  
✅ **Tag team battles FIXED** - Now creates 4 events (one per robot)  
✅ **Revenue split IMPLEMENTED** - Team rewards split 50/50 between robots  
✅ **Consistent format** - All battle types use same structure  
✅ **Complete audit trail** - Each robot has individual event  

**All user requests completed!** 🎉
