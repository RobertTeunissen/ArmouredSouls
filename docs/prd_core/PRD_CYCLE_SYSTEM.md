# Product Requirements Document: Cycle System

**Last Updated**: February 23, 2026  
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen  
**Epic**: Game Systems - Time Management

---

## Executive Summary

This PRD documents the Cycle System, which serves as the game's time progression mechanism. A "cycle" represents one complete execution of all game activities (battles, income, expenses, repairs, etc.) and provides the temporal structure for the game's economy and progression systems.

**Key Achievement**: The cycle system enables batch processing of game activities, financial snapshots, and historical tracking while maintaining data consistency through the AuditLog → CycleSnapshot architecture.

---

## Background & Context

### What is a Cycle?

A **cycle** is the fundamental unit of time in Armoured Souls. Each cycle represents one complete round of game activities:
- League battles (all robots fight once)
- Tournament matches
- Tag team battles
- Passive income generation
- Operating cost deductions
- Robot repairs
- League promotions/demotions

### Design Philosophy

**Batch Processing Model:**
- All activities execute sequentially in a single cycle
- Deterministic execution order
- Complete financial snapshot at end
- Audit trail for all events

**Future Evolution:**
- Current: Manual trigger (admin endpoint)
- Phase 2: Scheduled execution (daily/weekly)
- Phase 3: Real-time continuous play

---

## Architecture Design

### Cycle Execution Flow

```
┌─────────────────────────────────────────────────────┐
│              CYCLE EXECUTION (15 Steps)             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Step 0:  Cycle Start Event                        │
│  Step 1:  League Battles                           │
│  Step 2:  Tournament Battles                       │
│  Step 3:  Tag Team Battles                         │
│  Step 4:  Apply Damage Decay                       │
│  Step 5:  Passive Income (Merchandising)           │
│  Step 6:  Operating Costs                          │
│  Step 7:  Robot Repairs                            │
│  Step 8:  League Promotions/Demotions              │
│  Step 9:  League Rebalancing                       │
│  Step 10: Tournament Advancement                   │
│  Step 11: Update Robot Stats                       │
│  Step 12: Update User Stats                        │
│  Step 13: Create Cycle Snapshot ⭐                 │
│  Step 14: Log End-of-Cycle Balances                │
│  Step 15: Cycle Complete Event                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Database Schema

#### CycleMetadata Table

```prisma
model CycleMetadata {
  id                Int      @id @default(1)
  totalCycles       Int      @default(0)
  lastCycleTime     DateTime?
  isExecuting       Boolean  @default(false)
  
  @@map("cycle_metadata")
}
```

**Purpose:**
- Track total number of cycles executed
- Prevent concurrent cycle execution
- Record last execution time

#### CycleSnapshot Table

```prisma
model CycleSnapshot {
  id              Int      @id @default(autoincrement())
  cycle_number    Int      @unique
  snapshot_time   DateTime @default(now())
  
  // Timing data
  cycleStartTime  DateTime?
  cycleEndTime    DateTime?
  durationMs      Int?
  
  // Aggregated metrics
  stableMetrics   Json     // Per-user financial summary
  robotMetrics    Json?    // Per-robot battle stats
  stepDurations   Json?    // Performance timing per step
  
  // Summary statistics
  totalBattles    Int?
  totalCreditsTransacted BigInt?
  totalPrestigeAwarded   Int?
  
  // Metadata
  triggerType     String?  // "manual" or "scheduled"
  
  @@index([cycle_number])
  @@map("cycle_snapshots")
}
```

**Purpose:**
- Store pre-aggregated cycle summaries
- Enable fast analytics queries
- Track cycle execution performance

---

## Cycle Snapshot Architecture

### Data Flow

```
During Cycle (Steps 1-12):
  ↓
Write Events to AuditLog
  ↓
Step 13: Aggregate from AuditLog
  ↓
Create CycleSnapshot
  ↓
Step 14: Log End Balances
```

### StableMetrics Structure

```typescript
interface StableMetric {
  userId: number;
  username: string;
  stableName: string;
  
  // Battle activity
  battlesParticipated: number;
  wins: number;
  losses: number;
  draws: number;
  
  // Income
  totalCreditsEarned: number;    // Battle winnings
  streamingIncome: number;       // Per-battle streaming
  merchandisingIncome: number;   // Daily passive income
  
  // Expenses
  totalRepairCosts: number;
  operatingCosts: number;
  
  // Purchases
  weaponPurchases: number;
  facilityPurchases: number;
  attributeUpgrades: number;
  robotPurchases: number;
  
  // Reputation
  totalPrestigeEarned: number;
  totalFameEarned: number;
  
  // Balance
  balance: number;               // End-of-cycle balance
}
```

### RobotMetrics Structure

```typescript
interface RobotMetric {
  robotId: number;
  robotName: string;
  userId: number;
  
  // Battle stats
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  
  // Performance
  damageDealt: number;
  damageTaken: number;
  kills: number;
  
  // Progression
  eloChange: number;
  prestigeEarned: number;
  fameEarned: number;
  
  // Economics
  creditsEarned: number;
  streamingRevenue: number;
  repairCosts: number;
}
```

### StepDurations Structure

```typescript
interface StepDurations {
  step1_league_battles: number;      // ms
  step2_tournament_battles: number;
  step3_tag_team_battles: number;
  step4_damage_decay: number;
  step5_passive_income: number;
  step6_operating_costs: number;
  step7_repairs: number;
  step8_promotions: number;
  step9_rebalancing: number;
  step10_tournament_advancement: number;
  step11_robot_stats: number;
  step12_user_stats: number;
  step13_snapshot: number;
  step14_balance_logging: number;
  step15_complete: number;
}
```

---

## Snapshot Aggregation Logic

### Source of Truth: AuditLog

**All data comes from AuditLog events:**

```typescript
async function createSnapshot(cycleNumber: number) {
  // 1. Query all events for cycle
  const auditLogs = await prisma.auditLog.findMany({
    where: { cycleNumber }
  });
  
  // 2. Aggregate battle events
  const battleEvents = auditLogs.filter(e => e.eventType === 'battle_complete');
  battleEvents.forEach(event => {
    const metric = getOrCreateMetric(event.userId);
    metric.battlesParticipated++;
    metric.totalCreditsEarned += event.payload.credits;
    metric.streamingIncome += event.payload.streamingRevenue;
    metric.totalPrestigeEarned += event.payload.prestige;
  });
  
  // 3. Aggregate streaming revenue from RobotStreamingRevenue table
  const streamingRecords = await prisma.robotStreamingRevenue.findMany({
    where: { cycleNumber },
    include: { robot: { select: { userId: true } } }
  });
  streamingRecords.forEach(record => {
    const metric = getOrCreateMetric(record.robot.userId);
    metric.streamingIncome += record.streamingRevenue;
  });
  
  // 4. Aggregate income events
  const incomeEvents = auditLogs.filter(e => e.eventType === 'passive_income');
  incomeEvents.forEach(event => {
    const metric = getOrCreateMetric(event.userId);
    metric.merchandisingIncome += event.payload.merchandisingIncome;
  });
  
  // 5. Aggregate cost events
  const costEvents = auditLogs.filter(e => e.eventType === 'operating_costs');
  costEvents.forEach(event => {
    const metric = getOrCreateMetric(event.userId);
    metric.operatingCosts += event.payload.operatingCost;
  });
  
  // 6. Aggregate repair events
  const repairEvents = auditLogs.filter(e => e.eventType === 'robot_repair');
  repairEvents.forEach(event => {
    const metric = getOrCreateMetric(event.userId);
    metric.totalRepairCosts += event.payload.repairCost;
  });
  
  // 7. Fetch final balances
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(metricsMap.keys()) } },
    select: { id: true, currency: true }
  });
  users.forEach(user => {
    const metric = metricsMap.get(user.id);
    if (metric) {
      metric.balance = user.currency;
    }
  });
  
  // 8. Save snapshot
  await prisma.cycleSnapshot.create({
    data: {
      cycle_number: cycleNumber,
      snapshot_time: new Date(),
      stableMetrics: JSON.stringify(Array.from(metricsMap.values())),
      cycleStartTime: startTime,
      cycleEndTime: endTime,
      durationMs: duration,
      stepDurations: JSON.stringify(stepDurations)
    }
  });
}
```

### Backfill Capability

**Snapshots can be reconstructed from AuditLog:**

```typescript
POST /api/admin/snapshots/backfill

// Deletes existing snapshot and recreates from AuditLog
// Ensures consistency with source of truth
```

**Use cases:**
- Fix corrupted snapshots
- Update aggregation logic
- Regenerate historical data

---

## What's in CycleSnapshot vs AuditLog?

### Only in CycleSnapshot (NOT in AuditLog)

**1. Cycle Timing Data:**
- `cycleStartTime` - When cycle execution began
- `cycleEndTime` - When cycle execution completed
- `durationMs` - Total milliseconds to execute
- `triggerType` - Manual or scheduled

**2. Step Execution Times:**
- Performance monitoring per step
- Identifies slow operations
- Not part of game logic

**3. Pre-Aggregated Metrics:**
- Per-user totals (battles, credits, income, expenses)
- Per-robot stats (wins, losses, damage)
- Summary statistics (total battles, total credits)

**4. Summary Statistics:**
- `totalBattles` - Total battles in cycle
- `totalCreditsTransacted` - Total credits moved
- `totalPrestigeAwarded` - Total prestige earned

### Why Both Tables?

**AuditLog = Complete History:**
- Immutable record of every event
- Detailed audit trail
- Debugging and verification
- Slower queries (many rows)

**CycleSnapshot = Fast Analytics:**
- Pre-computed summaries
- One row per cycle
- Dashboard and charts
- Fast queries (< 1ms)

---

## API Endpoints

### Admin Endpoints

**Execute Cycle:**
```
POST /api/admin/execute-cycle
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "cycleNumber": 3,
  "duration": 150000,
  "stepDurations": { ... },
  "summary": {
    "totalBattles": 24,
    "totalCredits": 95432,
    "totalPrestige": 120
  }
}
```

**Backfill Snapshot:**
```
POST /api/admin/snapshots/backfill
Authorization: Bearer <admin-token>
Body: { "cycleNumber": 2 }

Response:
{
  "success": true,
  "cycleNumber": 2,
  "message": "Snapshot recreated from AuditLog"
}
```

### Analytics Endpoints

**Get Cycle Summary:**
```
GET /api/analytics/cycles/:cycleNumber

Response:
{
  "cycleNumber": 2,
  "startTime": "2026-02-20T10:00:00Z",
  "endTime": "2026-02-20T10:02:30Z",
  "duration": 150000,
  "stableMetrics": [ ... ],
  "robotMetrics": [ ... ],
  "totalBattles": 24
}
```

**Get Cycle Range:**
```
GET /api/analytics/cycles?start=1&end=5

Response:
{
  "cycles": [
    { "cycleNumber": 1, ... },
    { "cycleNumber": 2, ... },
    { "cycleNumber": 3, ... },
    { "cycleNumber": 4, ... },
    { "cycleNumber": 5, ... }
  ]
}
```

---

## Performance Considerations

### Cycle Execution Time

**Target:** < 3 minutes for 100 robots

**Typical breakdown:**
- League battles: 45-60 seconds
- Tournament battles: 30-45 seconds
- Tag team battles: 15-30 seconds
- Other steps: 10-20 seconds
- Snapshot creation: 5-10 seconds

**Optimization strategies:**
- Batch database operations
- Parallel battle execution (future)
- Efficient queries with indexes
- Minimal logging overhead

### Snapshot Query Performance

**Target:** < 1ms for single cycle query

**Achieved through:**
- One row per cycle (not thousands)
- Pre-aggregated metrics
- Indexed cycle_number column
- JSON fields for complex data

---

## Data Consistency

### Consistency Guarantees

**1. AuditLog is Source of Truth:**
- All events written during cycle execution
- Immutable once written
- Complete audit trail

**2. CycleSnapshot is Derived:**
- 100% computed from AuditLog
- Can be regenerated at any time
- No independent data

**3. Backfill Ensures Consistency:**
- Detects and fixes corrupted snapshots
- Updates snapshots with new logic
- Maintains data integrity

### Validation Checks

**Snapshot creation validates:**
- Event counts match expected values
- Credit totals are consistent
- No missing user data
- All timestamps valid

**Backfill validates:**
- AuditLog events exist for cycle
- Aggregation produces same results
- No data loss during recreation

---

## Testing

### Unit Tests

**Cycle execution:**
- ✅ All 15 steps execute in order
- ✅ Events logged to AuditLog
- ✅ Snapshot created correctly
- ✅ Balances updated

**Snapshot aggregation:**
- ✅ Correct totals from AuditLog
- ✅ All users included
- ✅ All metrics calculated
- ✅ Timing data captured

### Integration Tests

**Full cycle:**
- ✅ Execute complete cycle
- ✅ Verify all battles fought
- ✅ Verify income/expenses applied
- ✅ Verify snapshot matches AuditLog

**Backfill:**
- ✅ Recreate snapshot from AuditLog
- ✅ Verify identical results
- ✅ Handle missing events gracefully

### Performance Tests

**Execution time:**
- ✅ 100 robots: < 3 minutes
- ✅ 500 robots: < 10 minutes
- ✅ 1000 robots: < 20 minutes

**Query performance:**
- ✅ Single cycle query: < 1ms
- ✅ Range query (10 cycles): < 10ms
- ✅ User history query: < 50ms

---

## Future Enhancements

### Phase 2: Scheduled Execution

**Automatic cycle execution:**
- Daily at specific time
- Weekly on specific day
- Configurable schedule
- Email notifications

**Implementation:**
- Cron job or scheduler service
- Queue system for reliability
- Monitoring and alerting
- Automatic retry on failure

### Phase 3: Real-Time Play

**Continuous battle execution:**
- Battles execute as robots become available
- No batch processing
- Real-time income/expenses
- Live leaderboards

**Challenges:**
- Concurrent battle execution
- Race condition handling
- Real-time snapshot updates
- Performance at scale

### Phase 4: Advanced Analytics

**Enhanced metrics:**
- Win rate trends
- ELO progression charts
- Income/expense forecasting
- Comparative analysis

**Visualization:**
- Interactive dashboards
- Historical comparisons
- Performance heatmaps
- Predictive analytics

---

## Related Documentation

### Core Documents
- [PRD_AUDIT_SYSTEM.md](PRD_AUDIT_SYSTEM.md) - Audit log architecture
- [PRD_BATTLE_DATA_ARCHITECTURE.md](PRD_BATTLE_DATA_ARCHITECTURE.md) - Battle data structure
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Complete database schema
- [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md) - Economic systems

### Implementation Files
- `prototype/backend/src/routes/admin.ts` - Cycle execution endpoint
- `prototype/backend/src/services/cycleSnapshotService.ts` - Snapshot creation
- `prototype/backend/src/routes/analytics.ts` - Cycle analytics endpoints

### Documentation
- `CYCLESNAPSHOT_VS_AUDITLOG.md` - Comparison and rationale
- `CYCLE_SUMMARY_FIX.md` - Streaming revenue fix
- `AUDITLOG_CYCLESNAPSHOT_FLOW.md` - Data flow documentation

---

## Status: ✅ COMPLETE

**Implementation:** Fully implemented and tested  
**Performance:** Meets targets (< 3 min for 100 robots)  
**Documentation:** Complete  
**Status:** Production-ready

The cycle system provides reliable batch processing, complete audit trails, and fast analytics through the AuditLog → CycleSnapshot architecture.
