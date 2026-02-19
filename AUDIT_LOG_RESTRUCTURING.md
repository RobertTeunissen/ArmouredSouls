# AUDIT LOG RESTRUCTURING - COMPLETE

## What Changed

The AuditLog table structure has been completely restructured to store **ONE event per robot** instead of one event per battle.

## Before vs After

### OLD Structure (One Event Per Battle)
```sql
-- ONE row per battle
id  | userId | robotId | battleId | eventType        | payload
----|--------|---------|----------|------------------|---------------------------
123 | 60     | 54      | NULL     | battle_complete  | {robot1Id: 54, robot2Id: 75,
                                                       streamingRevenue1: 1002,
                                                       streamingRevenue2: 1004,
                                                       robot1PrestigeAwarded: 3,
                                                       robot2PrestigeAwarded: 3,
                                                       ...}
```

**Problems:**
- ❌ userId/robotId only set to robot1
- ❌ Had to parse payload to find robot2 data
- ❌ Queries like "all battles for user X" required payload parsing
- ❌ Complex aggregation logic

### NEW Structure (One Event Per Robot)
```sql
-- TWO rows per battle (one per robot)
id  | userId | robotId | battleId | eventType        | payload
----|--------|---------|----------|------------------|------------------
124 | 60     | 54      | 102      | battle_complete  | {result: "loss",
                                                        opponentId: 75,
                                                        credits: 1315,
                                                        prestige: 3,
                                                        streamingRevenue: 1002}

125 | 61     | 75      | 102      | battle_complete  | {result: "win",
                                                        opponentId: 54,
                                                        credits: 4383,
                                                        prestige: 3,
                                                        streamingRevenue: 1004}
```

**Benefits:**
- ✅ userId, robotId, battleId all in columns
- ✅ Easy queries: `SELECT * WHERE userId = 60`
- ✅ Simplified payload (only that robot's data)
- ✅ Complete audit trail per robot
- ✅ No more payload parsing for aggregation

## Schema Changes

**Added column:**
```sql
ALTER TABLE audit_logs ADD COLUMN battle_id INTEGER;
```

**Added indexes:**
```sql
CREATE INDEX audit_logs_battle_id_idx ON audit_logs(battle_id);
CREATE INDEX audit_logs_cycle_number_battle_id_idx ON audit_logs(cycle_number, battle_id);
```

## Code Changes

### 1. Event Logger
**File:** `eventLogger.ts`

Added `battleId` parameter:
```typescript
await eventLogger.logEvent(
  cycleNumber,
  EventType.BATTLE_COMPLETE,
  payload,
  {
    userId: robot.userId,
    robotId: robot.id,
    battleId: battle.id,  // NEW!
  }
);
```

### 2. Battle Orchestrator  
**File:** `battleOrchestrator.ts`

**OLD:** Created ONE event with both robots
**NEW:** Creates TWO events (one per robot)

```typescript
// Event 1: Robot 1's perspective
await eventLogger.logEvent(
  cycleNumber,
  EventType.BATTLE_COMPLETE,
  {
    result: 'loss',
    opponentId: robot2.id,
    credits: 1315,
    prestige: 3,
    fame: 13,
    streamingRevenue: 1002,
    repairCost: 0,
    // ... only robot1 data
  },
  {
    userId: robot1.userId,
    robotId: robot1.id,
    battleId: battle.id,
  }
);

// Event 2: Robot 2's perspective  
await eventLogger.logEvent(
  cycleNumber,
  EventType.BATTLE_COMPLETE,
  {
    result: 'win',
    opponentId: robot1.id,
    credits: 4383,
    prestige: 3,
    fame: 13,
    streamingRevenue: 1004,
    repairCost: 0,
    // ... only robot2 data
  },
  {
    userId: robot2.userId,
    robotId: robot2.id,
    battleId: battle.id,
  }
);
```

### 3. Cycle Snapshot Service
**File:** `cycleSnapshotService.ts`

**MUCH SIMPLER!** No more robot-to-user mapping:

```typescript
// OLD: ~80 lines with complex mapping
// Get robot1 and robot2 from payload
// Query database for userId for each robot
// Aggregate both robots separately

// NEW: ~20 lines, direct aggregation
battleCompleteEvents.forEach((event: any) => {
  const metric = getOrCreateMetric(event.userId); // userId already in column!
  const payload = event.payload;
  
  metric.battlesParticipated++;
  metric.totalCreditsEarned += payload.credits || 0;
  metric.streamingIncome += payload.streamingRevenue || 0;
  metric.totalPrestigeEarned += payload.prestige || 0;
  metric.totalRepairCosts += payload.repairCost || 0;
});
```

### 4. CSV Export Service
**File:** `cycleCsvExportService.ts`

**SIMPLIFIED!** Each event already has one robot:

```typescript
// OLD: Created 2 rows per event (one per robot)
// NEW: One row per event (event is already for one robot)

for (const event of battleEvents) {
  const robot = await prisma.robot.findUnique({
    where: { id: event.robotId }  // robotId in column!
  });
  
  const payload = event.payload;
  
  rows.push({
    robot_id: robot.id,
    result: payload.result,  // Already computed
    credits: payload.credits,  // Already for this robot
    streaming_revenue: payload.streamingRevenue,  // Already for this robot
  });
}
```

## Payload Simplification

### OLD Payload (100+ fields)
```json
{
  "battleId": 102,
  "robot1Id": 54,
  "robot2Id": 75,
  "winnerId": 75,
  "robot1ELOBefore": 1200,
  "robot1ELOAfter": 1195,
  "robot2ELOBefore": 1210,
  "robot2ELOAfter": 1215,
  "eloChange": 5,
  "robot1DamageDealt": 450,
  "robot2DamageDealt": 500,
  "winnerReward": 4383,
  "loserReward": 1315,
  "robot1PrestigeAwarded": 3,
  "robot2PrestigeAwarded": 3,
  "streamingRevenue1": 1002,
  "streamingRevenue2": 1004,
  "streamingRevenueDetails1": {
    "baseAmount": 500,
    "battleMultiplier": 1.2,
    "fameMultiplier": 1.0,
    "studioMultiplier": 1.67,
    "robotBattles": 50,
    "robotFame": 100,
    "studioLevel": 2
  },
  "streamingRevenueDetails2": { ... },
  "robot1RepairCost": 0,
  "robot2RepairCost": 0,
  ...
}
```

### NEW Payload (~20 fields)
```json
{
  "result": "win",
  "opponentId": 54,
  "isDraw": false,
  "isByeMatch": false,
  "eloBefore": 1210,
  "eloAfter": 1215,
  "eloChange": 5,
  "damageDealt": 500,
  "finalHP": 850,
  "finalShield": 200,
  "credits": 4383,
  "prestige": 3,
  "fame": 13,
  "streamingRevenue": 1004,
  "repairCost": 0,
  "battleType": "tournament",
  "leagueType": "bronze",
  "durationSeconds": 45
}
```

**Removed:**
- ❌ Calculation details (streamingRevenueDetails)
- ❌ Opponent's data (now in separate event)
- ❌ Duplicate fields (robot1X, robot2X)

**Result:** Cleaner, smaller, easier to read

## Query Examples

### OLD: Get all battles for User 60
```sql
-- Had to check BOTH userId column AND payload
SELECT * FROM audit_logs 
WHERE cycleNumber = 2 
  AND eventType = 'battle_complete'
  AND (
    userId = 60 
    OR payload->>'robot2UserId' = '60'  -- Had to parse payload!
  );
```

### NEW: Get all battles for User 60
```sql
-- Simple!
SELECT * FROM audit_logs 
WHERE cycleNumber = 2 
  AND eventType = 'battle_complete'
  AND userId = 60;
```

### NEW: Get all battles for a specific battle
```sql
-- Get both robots' events for battle 102
SELECT * FROM audit_logs 
WHERE battleId = 102 
  AND eventType = 'battle_complete';
-- Returns 2 rows (one per robot)
```

## Migration Steps

1. **Run migration:**
   ```bash
   cd prototype/backend
   npx prisma migrate deploy
   ```

2. **Test with new cycle:**
   - Execute a new cycle
   - Check that TWO events are created per battle
   - Verify cycle summary shows correct values

3. **Backfill old data (optional):**
   - Old events will have `battleId = NULL`
   - New aggregation code handles both formats
   - Can backfill battleId from payload if needed

## Testing Checklist

- [ ] Migration runs successfully
- [ ] New cycle execution creates 2 events per battle
- [ ] Events have userId, robotId, battleId populated
- [ ] Cycle snapshot aggregation works
- [ ] Cycle summary page displays correctly
- [ ] CSV export includes all battles
- [ ] Both old and new events can be read

## Impact on Frontend

**No changes needed!** The frontend reads from:
1. CycleSnapshot table (already updated)
2. API endpoints (already updated)

The frontend doesn't directly query AuditLog, so it's unaffected.

## Future: Tag Team Battles

Tag team battles will create **FOUR events** (one per robot):
- Team 1, Robot 1 event
- Team 1, Robot 2 event  
- Team 2, Robot 1 event
- Team 2, Robot 2 event

Same pattern, same benefits.

---

**Status:** ✅ Complete and ready for testing
**Migration file:** `prisma/migrations/20260219000000_add_battle_id_to_audit_log/migration.sql`
