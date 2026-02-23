# Product Requirements Document: Audit Log System

**Last Updated**: February 23, 2026  
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen  
**Epic**: Data Architecture - Audit & History Tracking

---

## Executive Summary

This PRD documents the Audit Log system architecture, which provides comprehensive event tracking for all game actions. The system uses a **one event per robot** architecture that enables efficient per-robot and per-user queries while maintaining complete audit trails.

**Key Achievement**: The restructured audit log enables simple queries without payload parsing, complete per-robot history tracking, and serves as the single source of truth for cycle snapshot aggregation.

---

## Background & Context

### Problem Statement

The original audit log structure stored **one event per battle** with both robots' data in the payload:

```json
{
  "id": 123,
  "userId": 60,
  "robotId": 54,
  "battleId": null,
  "eventType": "battle_complete",
  "payload": {
    "robot1Id": 54,
    "robot2Id": 75,
    "robot1PrestigeAwarded": 3,
    "robot2PrestigeAwarded": 3,
    "streamingRevenue1": 1002,
    "streamingRevenue2": 1004,
    "robot1ELOBefore": 1200,
    "robot1ELOAfter": 1195,
    "robot2ELOBefore": 1210,
    "robot2ELOAfter": 1215
    // ... 100+ fields
  }
}
```

**Problems with this approach:**
- ❌ userId/robotId only set to robot1 (robot2 data hidden in payload)
- ❌ Queries like "all battles for user X" required payload parsing
- ❌ Complex aggregation logic to extract robot2 data
- ❌ Massive payloads (100+ fields) with duplicate data
- ❌ Inconsistent with per-robot game design

### Solution: One Event Per Robot

Create **separate events for each robot** with simplified payloads containing only that robot's data.

---

## Architecture Design

### Database Schema

#### AuditLog Table

```prisma
model AuditLog {
  id           Int      @id @default(autoincrement())
  cycleNumber  Int
  eventType    String
  userId       Int?
  robotId      Int?
  battleId     Int?     // NEW: Direct reference to battle
  timestamp    DateTime @default(now())
  payload      Json
  
  // Relationships
  user   User?   @relation(fields: [userId], references: [id])
  robot  Robot?  @relation(fields: [robotId], references: [id])
  
  // Indexes
  @@index([cycleNumber])
  @@index([eventType])
  @@index([userId])
  @@index([robotId])
  @@index([battleId])
  @@index([cycleNumber, eventType])
  @@index([cycleNumber, battleId])
}
```

**Key changes:**
- Added `battleId` column for direct battle reference
- userId, robotId, battleId all in columns (not payload)
- Indexes for efficient querying

### Event Structure

#### Battle Complete Events (One Per Robot)

**Robot 1's event:**
```json
{
  "id": 124,
  "userId": 60,
  "robotId": 54,
  "battleId": 102,
  "cycleNumber": 2,
  "eventType": "battle_complete",
  "timestamp": "2026-02-20T10:00:45Z",
  "payload": {
    "result": "loss",
    "opponentId": 75,
    "isDraw": false,
    "isByeMatch": false,
    "eloBefore": 1200,
    "eloAfter": 1195,
    "eloChange": -5,
    "damageDealt": 450,
    "finalHP": 0,
    "finalShield": 0,
    "credits": 1315,
    "prestige": 3,
    "fame": 13,
    "streamingRevenue": 1002,
    "repairCost": 0,
    "battleType": "tournament",
    "leagueType": "bronze",
    "durationSeconds": 45
  }
}
```

**Robot 2's event:**
```json
{
  "id": 125,
  "userId": 61,
  "robotId": 75,
  "battleId": 102,
  "cycleNumber": 2,
  "eventType": "battle_complete",
  "timestamp": "2026-02-20T10:00:45Z",
  "payload": {
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
}
```

**Benefits:**
- ✅ Each robot has complete event with their data
- ✅ Simple queries: `WHERE userId = 60` or `WHERE robotId = 54`
- ✅ Smaller payloads (~20 fields vs 100+)
- ✅ No payload parsing needed for aggregation
- ✅ Complete audit trail per robot

---

## Event Types

### Battle Events

**battle_complete** - Battle finished (2 events per 1v1 battle, 4 events per tag team battle)
- **Architecture**: Each robot gets its own event with their perspective of the battle
- **Payload Structure**: 
  - `result`: 'win', 'loss', or 'draw' (from this robot's perspective)
  - `opponentId`: The opponent robot's ID
  - `isByeMatch`: Boolean indicating if this was a bye match
  - `eloBefore`, `eloAfter`, `eloChange`: ELO tracking for this robot
  - `damageDealt`, `finalHP`, `yielded`, `destroyed`: Combat stats for this robot
  - `credits`: Reward amount for this robot (winner/loser reward)
  - `prestige`, `fame`: Rewards earned by this robot
  - `streamingRevenue`: Streaming revenue earned by this robot
  - `battleType`, `leagueType`, `durationSeconds`: Battle metadata
- **Metadata**: `userId`, `robotId`, `battleId` stored in metadata columns (not payload)
- **Created by**: Battle orchestrators (`battleOrchestrator.ts`, `tagTeamBattleOrchestrator.ts`)
- **Used for**: Cycle snapshots, battle history, analytics, streaming revenue aggregation
- **Rationale**: Separate events per robot enable efficient per-robot and per-user queries without parsing complex payloads

### Robot Events

**robot_purchase** - Robot bought
- Payload: robotName, cost, balanceBefore, balanceAfter
- Created by: Robot creation endpoint
- Used for: Purchase history, economic tracking

**robot_repair** - Robot repaired
- Payload: repairCost, damageRepaired, balanceBefore, balanceAfter
- Created by: Repair service
- Used for: Maintenance costs, cycle snapshots

**attribute_upgrade** - Attribute upgraded
- Payload: attributeName, oldLevel, newLevel, cost, balanceBefore, balanceAfter
- Created by: Attribute upgrade endpoint
- Used for: Upgrade history, economic tracking

**league_change** - Robot moved leagues
- Payload: oldLeague, newLeague, reason (promotion/demotion)
- Created by: League promotion/demotion service
- Used for: League history, progression tracking

### User/Stable Events

**user_created** - User registered
- Payload: username, startingBalance
- Created by: Registration endpoint (when implemented)
- Used for: User history, starting balance tracking

**credit_change** - Manual credit adjustment
- Payload: amount, balance, reason
- Created by: Admin tools
- Used for: Admin audit trail

**prestige_change** - Prestige adjustment
- Payload: amount, newTotal, reason
- Created by: Admin tools or special events
- Used for: Prestige history

**passive_income** - Merchandising income
- Payload: merchandisingIncome, prestigeMultiplier
- Created by: Cycle execution (Step 4)
- Used for: Cycle snapshots, income tracking

**operating_costs** - Facility operating costs
- Payload: operatingCost, facilityCosts (breakdown)
- Created by: Cycle execution (Step 5)
- Used for: Cycle snapshots, expense tracking

**cycle_end_balance** - End-of-cycle balance snapshot
- Payload: username, stableName, balance
- Created by: Cycle execution (Step 14)
- Used for: Balance history, CSV export

### Facility Events

**facility_purchase** - Facility bought
- Payload: facilityType, cost, balanceBefore, balanceAfter
- Created by: Facility purchase endpoint
- Used for: Purchase history, economic tracking

**facility_upgrade** - Facility upgraded
- Payload: facilityType, oldLevel, newLevel, cost, balanceBefore, balanceAfter
- Created by: Facility upgrade endpoint
- Used for: Upgrade history, economic tracking

### Weapon Events

**weapon_purchase** - Weapon bought
- Payload: weaponId, weaponName, cost, balanceBefore, balanceAfter
- Created by: Weapon purchase endpoint
- Used for: Purchase history, economic tracking

**weapon_sale** - Weapon sold
- Payload: weaponId, weaponName, salePrice, balanceBefore, balanceAfter
- Created by: Weapon sale endpoint (when implemented)
- Used for: Sale history, economic tracking

### Cycle Events

**cycle_start** - Cycle began
- Payload: cycleNumber, startTime
- Created by: Cycle execution (Step 0)
- Used for: Cycle timing, execution tracking

**cycle_complete** - Cycle ended
- Payload: cycleNumber, endTime, durationMs
- Created by: Cycle execution (Step 15)
- Used for: Cycle timing, performance tracking

---

## Event Logger Service

### Core Methods

```typescript
class EventLogger {
  // Generic event logging
  async logEvent(
    cycleNumber: number,
    eventType: EventType,
    payload: any,
    context?: {
      userId?: number;
      robotId?: number;
      battleId?: number;
    }
  ): Promise<void>
  
  // Specialized helpers
  async logBattleComplete(
    cycleNumber: number,
    userId: number,
    robotId: number,
    battleId: number,
    payload: BattleCompletePayload
  ): Promise<void>
  
  async logRobotPurchase(
    cycleNumber: number,
    userId: number,
    robotId: number,
    payload: RobotPurchasePayload
  ): Promise<void>
  
  async logCycleEndBalance(
    userId: number,
    cycleNumber: number,
    payload: CycleEndBalancePayload
  ): Promise<void>
  
  // ... other specialized methods
}
```

### Usage Examples

**Battle completion (2 events per battle):**
```typescript
// Event 1: Robot 1's perspective
await eventLogger.logBattleComplete(
  cycleNumber,
  robot1.userId,
  robot1.id,
  battle.id,
  {
    result: 'loss',
    opponentId: robot2.id,
    credits: 1315,
    prestige: 3,
    fame: 13,
    streamingRevenue: 1002,
    // ... only robot1 data
  }
);

// Event 2: Robot 2's perspective
await eventLogger.logBattleComplete(
  cycleNumber,
  robot2.userId,
  robot2.id,
  battle.id,
  {
    result: 'win',
    opponentId: robot1.id,
    credits: 4383,
    prestige: 3,
    fame: 13,
    streamingRevenue: 1004,
    // ... only robot2 data
  }
);
```

**Robot purchase:**
```typescript
await eventLogger.logRobotPurchase(
  cycleNumber,
  user.id,
  robot.id,
  {
    robotName: robot.name,
    cost: 500000,
    balanceBefore: user.credits,
    balanceAfter: user.credits - 500000
  }
);
```

**End-of-cycle balance:**
```typescript
await eventLogger.logCycleEndBalance(
  user.id,
  cycleNumber,
  {
    username: user.username,
    stableName: user.stableName,
    balance: user.credits
  }
);
```

---

## Query Patterns

### Simple Queries (No Payload Parsing)

**Get all battles for a user:**
```sql
SELECT * FROM "AuditLog"
WHERE "cycleNumber" = 2
  AND "eventType" = 'battle_complete'
  AND "userId" = 60;
```

**Get all battles for a robot:**
```sql
SELECT * FROM "AuditLog"
WHERE "cycleNumber" = 2
  AND "eventType" = 'battle_complete'
  AND "robotId" = 54;
```

**Get both robots' events for a battle:**
```sql
SELECT * FROM "AuditLog"
WHERE "battleId" = 102
  AND "eventType" = 'battle_complete';
-- Returns 2 rows (one per robot)
```

**Get all robot purchases:**
```sql
SELECT * FROM "AuditLog"
WHERE "eventType" = 'robot_purchase'
ORDER BY "timestamp" DESC;
```

### Aggregation Queries

**Total credits earned by user in cycle:**
```sql
SELECT 
  "userId",
  SUM((payload->>'credits')::int) as total_credits
FROM "AuditLog"
WHERE "cycleNumber" = 2
  AND "eventType" = 'battle_complete'
GROUP BY "userId";
```

**Total streaming revenue by robot:**
```sql
SELECT 
  "robotId",
  SUM((payload->>'streamingRevenue')::int) as total_streaming
FROM "AuditLog"
WHERE "cycleNumber" = 2
  AND "eventType" = 'battle_complete'
GROUP BY "robotId";
```

**Battle count by user:**
```sql
SELECT 
  "userId",
  COUNT(*) as battle_count
FROM "AuditLog"
WHERE "cycleNumber" = 2
  AND "eventType" = 'battle_complete'
GROUP BY "userId";
```

---

## Relationship with CycleSnapshot

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│                  CYCLE EXECUTION                    │
│                   (Steps 1-12)                      │
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ Battle  │  │ Income  │  │  Costs  │            │
│  └────┬────┘  └────┬────┘  └────┬────┘            │
│       │            │            │                  │
│       ▼            ▼            ▼                  │
│  ┌────────────────────────────────────┐           │
│  │         AuditLog Table             │           │
│  │  (Source of Truth - All Events)   │           │
│  └────────────────┬───────────────────┘           │
│                   │                                │
│                   │ Step 13: Aggregate             │
│                   ▼                                │
│  ┌────────────────────────────────────┐           │
│  │      CycleSnapshot Table           │           │
│  │   (Derived - Pre-aggregated)       │           │
│  └────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
```

### Single Source of Truth

**AuditLog is the master:**
- All events written to AuditLog during cycle execution
- CycleSnapshot is 100% derived from AuditLog
- Snapshots can be reconstructed from AuditLog at any time

**CycleSnapshot aggregation:**
```typescript
async function createSnapshot(cycleNumber: number) {
  // 1. Query all events for cycle
  const auditLogs = await prisma.auditLog.findMany({
    where: { cycleNumber }
  });
  
  // 2. Aggregate battle events
  const battleEvents = auditLogs.filter(e => e.eventType === 'battle_complete');
  battleEvents.forEach(event => {
    metrics[event.userId].battleCredits += event.payload.credits;
    metrics[event.userId].streamingIncome += event.payload.streamingRevenue;
    metrics[event.userId].prestigeEarned += event.payload.prestige;
  });
  
  // 3. Aggregate income events
  const incomeEvents = auditLogs.filter(e => e.eventType === 'passive_income');
  incomeEvents.forEach(event => {
    metrics[event.userId].merchandisingIncome += event.payload.merchandisingIncome;
  });
  
  // 4. Aggregate cost events
  const costEvents = auditLogs.filter(e => e.eventType === 'operating_costs');
  costEvents.forEach(event => {
    metrics[event.userId].operatingCosts += event.payload.operatingCost;
  });
  
  // 5. Save snapshot
  await prisma.cycleSnapshot.create({
    data: {
      cycle_number: cycleNumber,
      stableMetrics: JSON.stringify(metrics)
    }
  });
}
```

**Backfill capability:**
```typescript
// Reconstruct snapshot from AuditLog
POST /api/admin/snapshots/backfill

// Deletes old snapshot and recreates from AuditLog
// Ensures consistency with source of truth
```

---

## Payload Simplification

### Before: Massive Payloads (100+ fields)

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
  // ... 80+ more fields
}
```

### After: Focused Payloads (~20 fields)

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
- ❌ Intermediate values

**Result:** 80% smaller payloads, easier to read and query

---

## Benefits

### 1. Simple Queries

**No payload parsing needed:**
- userId, robotId, battleId in columns
- Direct WHERE clauses
- Efficient indexes

### 2. Complete Audit Trail

**Per-robot history:**
- Every robot has complete event history
- Easy to track individual robot progression
- No data hidden in other robots' events

### 3. Efficient Aggregation

**CycleSnapshot creation:**
- Direct field access (no JSON parsing)
- Simple SUM/COUNT operations
- Fast query execution

### 4. Scalability

**Tag team battles:**
- 4 events per battle (one per robot)
- Same pattern as 1v1
- No special handling needed

**Future N-player battles:**
- N events per battle
- Consistent structure
- No schema changes needed

### 5. Data Consistency

**Single source of truth:**
- AuditLog contains all events
- CycleSnapshot derived from AuditLog
- Backfill ensures consistency

---

## Migration

### Schema Changes

**Added column:**
```sql
ALTER TABLE "AuditLog" ADD COLUMN "battleId" INTEGER;
```

**Added indexes:**
```sql
CREATE INDEX "AuditLog_battleId_idx" ON "AuditLog"("battleId");
CREATE INDEX "AuditLog_cycleNumber_battleId_idx" ON "AuditLog"("cycleNumber", "battleId");
```

### Code Changes

**Battle orchestrators:**
- Changed from 1 event per battle to 2 events per battle
- Simplified payloads (only that robot's data)
- Added battleId to event context

**Cycle snapshot service:**
- Simplified aggregation (no payload parsing)
- Direct field access from events
- Removed robot-to-user mapping logic

**CSV export service:**
- One row per event (event already for one robot)
- No need to split events into multiple rows

### Backward Compatibility

**Old events:**
- Have `battleId = null`
- Have large payloads with both robots
- Still readable by aggregation code

**New events:**
- Have `battleId` populated
- Have focused payloads (one robot)
- Preferred by aggregation code

**Aggregation handles both:**
```typescript
// Prefer new structure
if (event.battleId) {
  // New format: direct access
  credits = event.payload.credits;
} else {
  // Old format: parse payload
  credits = event.robotId === event.payload.robot1Id
    ? event.payload.winnerReward
    : event.payload.loserReward;
}
```

---

## Testing

### Unit Tests

**Event creation:**
- ✅ Battle complete events (2 per battle)
- ✅ Robot purchase events
- ✅ Facility events
- ✅ Cycle events

**Event queries:**
- ✅ Query by userId
- ✅ Query by robotId
- ✅ Query by battleId
- ✅ Query by eventType
- ✅ Query by cycle

### Integration Tests

**Cycle execution:**
- ✅ All events created correctly
- ✅ Correct event counts
- ✅ Payloads populated correctly
- ✅ Indexes used efficiently

**Snapshot creation:**
- ✅ Aggregates from AuditLog
- ✅ Correct totals
- ✅ Handles old and new events
- ✅ Backfill works correctly

### Data Integrity Tests

**Event consistency:**
- ✅ 2 events per 1v1 battle
- ✅ 4 events per tag team battle
- ✅ All events have userId/robotId
- ✅ Battle events have battleId

**Aggregation accuracy:**
- ✅ Snapshot totals match AuditLog
- ✅ Per-user totals correct
- ✅ Per-robot totals correct

---

## Related Documentation

### Core Documents
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Complete database schema
- [PRD_BATTLE_DATA_ARCHITECTURE.md](PRD_BATTLE_DATA_ARCHITECTURE.md) - BattleParticipant table (related)
- [PRD_CYCLE_SYSTEM.md](PRD_CYCLE_SYSTEM.md) - Cycle execution and snapshots

### Implementation Files
- `prototype/backend/src/services/eventLogger.ts` - Event logging service
- `prototype/backend/src/services/battleOrchestrator.ts` - Battle event creation
- `prototype/backend/src/services/cycleSnapshotService.ts` - Snapshot aggregation

### Migration Documents
- `AUDIT_LOG_RESTRUCTURING.md` - Restructuring completion notes
- `AUDIT_LOG_IMPROVEMENTS.md` - Additional improvements
- `AUDITLOG_CYCLESNAPSHOT_FLOW.md` - Data flow documentation

---

## Future Enhancements

### Potential Extensions

**Event versioning:**
- Add `eventVersion` field
- Support payload schema evolution
- Backward compatibility for old versions

**Event replay:**
- Reconstruct game state from events
- Debug tools
- Time-travel debugging

**Real-time event streaming:**
- WebSocket event notifications
- Live battle updates
- Real-time leaderboards

**Event analytics:**
- Event frequency analysis
- Performance metrics
- User behavior tracking

---

## Status: ✅ COMPLETE

**Implementation:** Fully implemented and tested  
**Migration:** Successfully completed  
**Documentation:** Updated  
**Status:** Production-ready

All game events now use the one-event-per-robot architecture. The system provides complete audit trails, efficient queries, and serves as the single source of truth for cycle snapshots.
