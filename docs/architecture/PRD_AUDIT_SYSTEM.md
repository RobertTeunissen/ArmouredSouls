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

## Financial Ledger and Paired Audit Events (Spec #53)

`User.currency` is the authoritative Credits balance. The post-cutover `Credit_Mutation_Service` owns every current-economy increment or decrement. It updates `User.currency`, creates one `FinancialLedger` accounting/reporting row, and creates one paired `AuditLog` row with `eventType` `financial_transaction` inside one atomic transaction. The pair shares a non-null `financialEventId`; the audit row is evidence for operations, security, and reconciliation, not a second credit mutation. Required financial writes fail closed and allocate `sequenceNumber` through `withAuditSequence`.

The final `Transaction_Taxonomy` contains exactly `battle_income`, `streaming_revenue`, `repair_cost`, `facility_upgrade`, `weapon_purchase`, `weapon_sale`, `weapon_refinement`, `robot_creation`, `attribute_upgrade`, `achievement_reward`, `passive_income`, and `operating_costs`. New writers do not emit `subscription_cost`, `prestige_award`, or `settlement_adjustment`. Each financial pair carries the exact signed amount, resulting `balanceAfter`, user/stable identity, optional robot identity, source description, event identity, and typed `Financial_Breakdown`. The breakdown stores formula/version, source identity, typed inputs, modifiers, discounts or bonuses, operation order, precision, and rounding so reports never recalculate historical amounts from mutable state.

The ledger and audit rows have distinct purposes:

| Record | Purpose | Canonical facts |
|---|---|---|
| `FinancialLedger` / `financial_ledger` | Accounting and reporting | `transactionType`, signed `amount`, `balanceAfter`, stable/robot scope, event identity, typed metadata/breakdown |
| `AuditLog` / `audit_logs` with `eventType` `financial_transaction` | Immutable operational, security, and reconciliation trail | The same financial facts, `financialEventId`, cycle/timestamp, sequence, source context |

One `Credit_Mutation` therefore means one `User.currency` delta, one ledger row, and one paired financial audit row. A retry with the same immutable facts returns the original result; reuse of the identity with a different amount, user, robot, type, source, or breakdown fails without changing the balance. Pre-cutover rows may lack pairing fields and remain `Legacy_Record` history.

### Battle row fan-out

All nine scheduled modes use the shared battle financial path after reward calculation. A fought battle writes one `battle_income` pair per receiving stable after aggregation and one `streaming_revenue` pair per eligible participating robot. Positive stable-level prestige is a separate `prestige_change` record. Existing per-participant `battle_complete` rows and `BattleParticipant` fields remain compatibility/display records, not additional financial mutations.

For two robots from two stables in a fought 1v1 with both robots eligible for streaming, the result is two `battle_income` ledger rows, two `streaming_revenue` ledger rows, and four paired `financial_transaction` audit rows. A 2v2 whose two robots belong to one stable produces one aggregated `battle_income` pair and two streaming pairs. The count is per stable for battle income and per eligible robot for streaming, never one battle debit per participant.

A `Bye_Event` is resolved before absent-side loading or simulation. It writes only the existing participation-floor `battle_income` pair: no streaming, fame, prestige, draw, repair spend, or simulated combat result. A scheduled byed robot may still receive separate pre-battle `Automatic_Repair` under the normal event scope. That `repair_cost` event is not part of the bye reward and must not be attributed to the bye.

### Repair and prestige boundaries

`Manual_Repair`, `Automatic_Repair`, and charged admin maintenance use `repair_cost` with mandatory `repairType` `manual` or `automatic`. Each repaired robot has one financial pair and one `robot_repair` domain `AuditLog` row. The domain row carries `creditsCharged`, `repairType`, `manualRepairDiscount`, and, for manual events, `creditsBeforeManualDiscount`; a batch quotes, discounts, and rounds per robot before summing. Repair spend is read from these subtype-bearing `robot_repair` rows, not from a `battle_complete` payload, `robots.repairQuoteCredits`, or a net ledger aggregation that loses subtype.

`Prestige_Service` writes positive stable-level awards as `prestige_change` rows with a unique `sourceEventId`, `eventTimestamp`, `cycleNumber`, source `battle` or `achievement`, exact aggregate award, optional mode/battle/achievement identity, typed award facts, and resulting `User.prestige`. Prestige has no credit `amount`, no credit `balanceAfter`, and no `FinancialLedger` row. Bye outcomes, zero awards, account resets, and season rollovers do not create positive prestige awards.

### Settlement, administration, and lifecycle

`Settlement_Service` is the sole mutating settlement path for the scheduler, admin bulk cycle, and supported daily-finance trigger. For each applicable stable and cycle it writes exactly one `passive_income` pair and one `operating_costs` pair, including zero-valued components with unchanged `balanceAfter`. Existing domain `passive_income`, `operating_costs`, snapshot, and response records remain compatible while the paired financial rows become the post-cutover accounting source. `/api/admin/audit-log` can query `financial_transaction`; `/api/admin/audit-log/repairs` remains focused on `robot_repair`; `/api/admin/economy/overview`, `/api/admin/daily-finances/process`, and `/api/admin/cycles/bulk` retain their existing response contracts while delegating internally.

Booking Office subscribe/unsubscribe operations are free and create only their existing subscription/domain records. Account creation, reset, season rollover, and explicit balance purge are `Opening_Balance_Boundary` operations, not financial income, expense, settlement, or adjustment events.

### Forward-only cutover and canonical sources

The new contract becomes authoritative at the selected `Cutover_Cycle` in `ACC` only after schema/client generation, writer migration, `Coverage_Manifest` checks, blocking test tiers, and required capture activation pass. Surviving pre-cutover ledger and audit rows remain unchanged and outside the completeness claim. No historical prestige, repair, battle, or settlement reconstruction is permitted; no one-off script or old payload fallback may manufacture a missing post-cutover event.

The canonical-source map is:

| Question | Canonical source |
|---|---|
| Post-cutover Credits amount, balance, taxonomy, or pair | Paired `FinancialLedger` and `AuditLog` `financial_transaction` rows by `financialEventId` |
| Repair spend and manual/automatic subtype | `AuditLog` `robot_repair` rows with `creditsCharged` and `repairType` |
| Prestige growth and award history | `AuditLog` `prestige_change` rows by `sourceEventId` |
| Subscription state/change | Booking Office records and existing subscription audit records |
| Reset, rollover, and archive history | Existing lifecycle and archive records |

## Event Types

### Battle Events

**battle_complete** - Battle finished (2 events per 1v1 battle, 4 events per tag team battle, 5-6 events per KotH battle)
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
- **Created by**: Battle orchestrators (`leagueBattleOrchestrator.ts`, `tournamentBattleOrchestrator.ts`, `tagTeamBattleOrchestrator.ts`, `kothBattleOrchestrator.ts`) via shared `logBattleAuditEvent()` in `battlePostCombat.ts`
- **Used for**: Cycle snapshots, battle history, analytics, streaming revenue aggregation
- **Post-cutover financial boundary**: `credits`, `prestige`, and `streamingRevenue` remain display/context fields; canonical credit and prestige records are `financial_transaction` and `prestige_change`, not this payload.- **Rationale**: Separate events per robot enable efficient per-robot and per-user queries without parsing complex payloads

### Robot Events

**robot_purchase** - Robot bought
- Payload: robotName, cost, balanceBefore, balanceAfter
- Created by: Robot creation endpoint
- Used for: Purchase history, economic tracking

**robot_repair** - Robot repaired
- Payload: `creditsCharged`, `repairType` (`manual` or `automatic`), `manualRepairDiscount`, `damageRepaired`, and manual-only `creditsBeforeManualDiscount` (the Repair_Quote before the manual discount)
- Created by: Repair service
- Used for: Canonical repair-spend reporting, maintenance costs, cycle snapshots, and admin repair logs
- Not a financial pair by itself: the matching `repair_cost`/`financial_transaction` pair is the accounting record for post-cutover currency.

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

**Current-economy credit mutations** — There is no standalone post-cutover `credit_change` currency event. An authorized mutation must use `Credit_Mutation_Service` and one of the twelve permitted `transactionType` values; account establishment, reset, rollover, and explicit purge remain `Opening_Balance_Boundary` lifecycle records.

**prestige_change** - Stable-level prestige award
- Payload: `sourceEventId`, `eventTimestamp`, `cycleNumber`, stable/user identity, exact amount, source (`battle` or `achievement`), optional mode/battle/achievement identity, typed award breakdown, and resulting `User.prestige`
- Created by: `Prestige_Service` for positive battle or achievement awards
- Used for: Current-season prestige history and `Prestige_Growth_Series`
- Retry rule: identical `sourceEventId` returns the original result; conflicting reuse fails without changing prestige
- Not a credit event: no `FinancialLedger` row and no credit `amount`/`balanceAfter`

**financial_transaction** - Paired financial mutation record
- Payload: `financialEventId`, `transactionType`, signed `amount`, `balanceAfter`, stable/user identity, optional robot identity, source description, and typed `Financial_Breakdown`
- Created by: `Credit_Mutation_Service`, atomically with the matching `FinancialLedger` row and `User.currency` update
- Used for: Accounting reconciliation, security investigation, and generic admin audit visibility
- Pair rule: one `financial_transaction` row per `FinancialLedger` row; the audit row is not a second currency mutation

**passive_income** - Merchandising income
- Payload: merchandisingIncome, prestigeMultiplier
- Created by: Cycle execution (Step 4)
- Used for: Cycle snapshots, income tracking, and compatibility with the settlement domain event

**operating_costs** - Facility operating costs
- Payload: operatingCost, facilityCosts (breakdown)
- Created by: Cycle execution (Step 5)
- Used for: Cycle snapshots, expense tracking, and compatibility with the settlement domain event

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
    balanceBefore: user.currency,
    balanceAfter: user.currency - 500000
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
    balance: user.currency
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

**Post-cutover financial totals:** Aggregate only reconciled `FinancialLedger` rows paired to `AuditLog` `financial_transaction` rows by `financialEventId`, filtered by `transactionType`. Use `battle_income` for battle credit and `streaming_revenue` for streaming. Do not sum `battle_complete` payload fields.

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

### Canonical and derived records

AuditLog domain events feed compatibility snapshots. Canonical sources are question-specific: paired `FinancialLedger`/`financial_transaction` records answer post-cutover Credits questions; `robot_repair` answers repair spend; `prestige_change` answers prestige. `CycleSnapshot` is a derived compatibility projection and may be regenerated from retained domain events, but regeneration must never create pairs, repair identities, or reconstruct pre-cutover financial history.

**Compatibility snapshot aggregation:**

Snapshot aggregation may retain combat/display metrics from `battle_complete` and domain compatibility fields from settlement events. It must not derive Credits, streaming revenue, repair spend, or prestige from those payloads. Financial and prestige figures remain query-specific canonical records rather than snapshot inputs.
```

**Snapshot backfill capability (not financial reconstruction):**
```typescript
// Rebuild a derived snapshot from surviving AuditLog domain events.
POST /api/admin/snapshots/backfill

// Deletes old snapshots and recreates the derived summary from retained events.
// It does not create FinancialLedger pairs, repair missing financialEventId values,
// or reconstruct pre-cutover financial history.
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
- `app/backend/src/services/common/eventLogger.ts` — Event logging service
- `app/backend/src/services/league/leagueBattleOrchestrator.ts` — Battle event creation (via shared `battlePostCombat.ts` helpers)
- `app/backend/src/services/cycle/cycleSnapshotService.ts` — Snapshot aggregation

### Related PRDs
- [PRD_CYCLE_SYSTEM.md](PRD_CYCLE_SYSTEM.md) — Cycle execution and snapshot architecture
- [PRD_BATTLE_DATA_ARCHITECTURE.md](PRD_BATTLE_DATA_ARCHITECTURE.md) — Battle data structure
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Complete database schema

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
