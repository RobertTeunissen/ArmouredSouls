# Design Document: Cycle-Based Audit Logging and Analytics System

## Overview

The Cycle-Based Audit Logging and Analytics System uses **pure event sourcing** to store all game events in a single, flexible audit log. This approach provides maximum flexibility for analytics while maintaining a clean, scalable architecture.

### Architecture Decision: Pure Event Sourcing

**Why Event Sourcing:**
- Single source of truth for all game events
- Flexible schema (JSONB) allows easy addition of new event types
- Natural fit for time-series analytics and historical queries
- Scales well with proper indexing (tested for 250K events/day)
- Easier to debug - complete audit trail of everything that happened

**Migration Strategy:**
Since we're in prototype phase with no live data, we'll:
1. Replace Battle table with event-based storage
2. Store all events (battles, repairs, income, facilities) in AuditLog
3. Use materialized views for fast operational queries
4. Build analytics layer on top of event log

### Phased Implementation for Early Testing

**Phase 1: Core Event Infrastructure + Basic Analytics** (Week 1)
- Create AuditLog table and event logger
- Migrate battle events to event log
- Create simple analytics API (last 10 cycles summary)
- **Frontend deliverable**: Display last 10 cycles income/expenses

**Phase 2: Cycle Snapshots + Comparisons** (Week 2)
- Add CycleSnapshot table for aggregated metrics
- Implement historical comparisons (yesterday vs week ago)
- **Frontend deliverable**: Comparison charts showing income trends

**Phase 3: Robot Analytics + ELO Graphs** (Week 3)
- Implement robot performance queries
- Add ELO progression time-series
- **Frontend deliverable**: Robot performance dashboard with ELO graph

**Phase 4: Facility ROI + Recommendations** (Week 4)
- Implement facility investment tracking
- Add ROI calculator and recommendations
- **Frontend deliverable**: Facility investment advisor

### Key Design Principles

1. **Event-First**: Everything is an event (battles, repairs, income, purchases)
2. **Immutable Log**: Events are never updated or deleted
3. **Snapshots for Speed**: Pre-aggregate common queries in CycleSnapshot
4. **Materialized Views**: Use PostgreSQL materialized views for operational queries
5. **Incremental Migration**: Start with battles, add other events progressively

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Cycle Execution Layer                       │
│  (admin.ts, battleOrchestrator, repairService, etc.)       │
└────────────────────┬────────────────────────────────────────┘
                     │ All Events
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Event Logger                               │
│  - Captures ALL events (battles, repairs, income, etc.)     │
│  - Validates event schemas                                   │
│  - Assigns sequence numbers                                  │
└────────────────────┬────────────────────────────────────────┘
                     │ Structured Events
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Event Store (AuditLog)                    │
│  - Single table for all events                              │
│  - JSONB payload for flexibility                            │
│  - Indexed by cycle, user, robot, event type               │
│  - Immutable (append-only)                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─────────────────────────────────────────┐
                     │                                         │
                     ▼                                         ▼
┌────────────────────────────────────┐  ┌────────────────────────────────┐
│   Materialized Views               │  │   Cycle Snapshots              │
│  - Recent battles (last 30 days)   │  │  - Pre-aggregated metrics      │
│  - Current robot stats             │  │  - Per-cycle summaries         │
│  - Live leaderboards               │  │  - Fast historical queries     │
│  - Refreshed every cycle           │  │  - Created at cycle end        │
└────────────────────┬───────────────┘  └────────────────┬───────────────┘
                     │                                    │
                     └────────────────┬───────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Analytics Engine                           │
│  - Queries event log + snapshots + materialized views       │
│  - Computes trends, comparisons, ROI                        │
│  - Caches frequently accessed data                          │
└────────────────────┬────────────────────────────────────────┘
                     │ REST API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Endpoints                           │
│  - GET /api/analytics/stable/:userId/summary                │
│  - GET /api/analytics/robot/:robotId/performance            │
│  - GET /api/analytics/facility/:userId/roi                  │
│  - GET /api/analytics/comparison                            │
│  - GET /api/analytics/trends                                │
└─────────────────────────────────────────────────────────────┘
```

### Event Flow

1. **Event Generation**: All cycle operations emit events (battle, repair, income, etc.)
2. **Event Logging**: EventLogger validates and stores events in AuditLog
3. **Snapshot Creation**: At cycle end, aggregate events into CycleSnapshot
4. **View Refresh**: Materialized views refreshed for operational queries
5. **Analytics Queries**: Query event log + snapshots for historical analysis
6. **API Response**: Return formatted data to frontend


## Components and Interfaces

### 1. Gap Event Logger

**Responsibility**: Capture ONLY events not already stored in existing tables

**Interface**:
```typescript
interface GapEventLogger {
  // Facility transactions (NOT in existing tables)
  logFacilityTransaction(
    userId: number,
    facilityType: string,
    oldLevel: number,
    newLevel: number,
    cost: number,
    cycleNumber: number
  ): Promise<void>;
  
  // Passive income (calculated but not stored)
  logPassiveIncome(
    userId: number,
    merchandising: number,
    streaming: number,
    facilityLevel: number,
    cycleNumber: number
  ): Promise<void>;
  
  // Operating costs (calculated but not stored)
  logOperatingCosts(
    userId: number,
    costs: Array<{ facilityType: string; level: number; cost: number }>,
    totalCost: number,
    cycleNumber: number
  ): Promise<void>;
  
  // Cycle execution timing (NOT in existing tables)
  logCycleStart(cycleNumber: number, triggerType: 'manual' | 'scheduled'): Promise<void>;
  logCycleStepComplete(cycleNumber: number, stepName: string, duration: number): Promise<void>;
  logCycleComplete(cycleNumber: number, totalDuration: number): Promise<void>;
  
  // Weapon transactions (WeaponInventory only has purchasedAt, not sale or cost)
  logWeaponPurchase(userId: number, weaponId: number, cost: number, cycleNumber: number): Promise<void>;
  logWeaponSale(userId: number, weaponId: number, salePrice: number, cycleNumber: number): Promise<void>;
  
  // Attribute upgrades (Robot table doesn't track historical changes)
  logAttributeUpgrade(
    robotId: number,
    attributeName: string,
    oldValue: number,
    newValue: number,
    cost: number,
    cycleNumber: number
  ): Promise<void>;
  
  // Calculation metadata for debugging (formulas, inputs, outputs)
  logCalculation(
    cycleNumber: number,
    calculationType: string,
    formula: string,
    inputs: Record<string, any>,
    output: any
  ): Promise<void>;
}
```

**Note**: Battle-related events (ELO, damage, rewards, fame) are NOT logged here - they're already in the Battle table!

### 2. Cycle Snapshot Service

**Responsibility**: Aggregate existing data per cycle for efficient historical queries

**Interface**:
```typescript
interface CycleSnapshotService {
  createSnapshot(cycleNumber: number): Promise<CycleSnapshot>;
  getSnapshot(cycleNumber: number): Promise<CycleSnapshot | null>;
  getSnapshotRange(startCycle: number, endCycle: number): Promise<CycleSnapshot[]>;
}

interface CycleSnapshot {
  cycleNumber: number;
  triggerType: 'manual' | 'scheduled';
  startTime: Date;
  endTime: Date;
  duration: number;
  
  // Aggregated from Battle table (per user)
  stableMetrics: {
    userId: number;
    battlesParticipated: number;
    totalCreditsEarned: number; // Sum of winnerReward + loserReward from battles
    totalPrestigeEarned: number; // Sum of robot1PrestigeAwarded + robot2PrestigeAwarded
    totalRepairCosts: number; // Sum of robot1RepairCost + robot2RepairCost
    // Passive income from AuditLog (gap events)
    merchandisingIncome: number;
    streamingIncome: number;
    operatingCosts: number;
    netProfit: number; // credits + passive - repairs - operating
  }[];
  
  // Aggregated from Battle table (per robot)
  robotMetrics: {
    robotId: number;
    battlesParticipated: number;
    wins: number; // Count where winnerId = robotId
    losses: number; // Count where winnerId != robotId and winnerId != null
    draws: number; // Count where winnerId = null
    damageDealt: number; // Sum of robot1DamageDealt or robot2DamageDealt
    damageReceived: number; // Sum of opponent's damage
    creditsEarned: number; // Sum of rewards
    eloChange: number; // Sum of (eloAfter - eloBefore)
    fameChange: number; // Sum of fameAwarded
  }[];
  
  // From AuditLog (gap events)
  stepDurations: {
    stepName: string;
    duration: number;
  }[];
}
```

**Key Point**: This service QUERIES existing tables (Battle, Robot, User) and aggregates them per cycle. It doesn't duplicate data - it creates a summary view.

### 3. Analytics Engine

**Responsibility**: Query existing tables + snapshots + gap events to compute analytics

**Interface**:
```typescript
interface AnalyticsEngine {
  // Stable analytics (queries Battle table + AuditLog for passive income/costs)
  getStableIncomeSummary(userId: number, cycleRange: [number, number]): Promise<StableIncomeSummary>;
  getStableComparison(userId: number, currentCycle: number, comparisonCycle: number): Promise<StableComparison>;
  
  // Robot analytics (queries Battle table primarily)
  getRobotPerformanceSummary(robotId: number, cycleRange: [number, number]): Promise<RobotPerformanceSummary>;
  getELOProgression(robotId: number, cycleRange: [number, number]): Promise<ELOProgressionData>;
  
  // Facility analytics (queries Facility table + AuditLog for transactions/income)
  getFacilityROI(userId: number, facilityType: string): Promise<FacilityROI>;
  getFacilityRecommendations(userId: number, lastNCycles: number): Promise<FacilityRecommendation[]>;
  
  // Trend analysis (queries CycleSnapshot for efficiency)
  getTrendData(userId: number, metric: string, cycleRange: [number, number]): Promise<TrendData>;
  
  // Cycle performance (queries AuditLog for step durations)
  getCyclePerformanceMetrics(cycleRange: [number, number]): Promise<CyclePerformanceMetrics>;
}
```

**Key Point**: Analytics Engine queries existing tables first, then supplements with gap events from AuditLog. No redundant data storage.

### 4. Query Service

**Responsibility**: Retrieve data from existing tables + gap events

**Interface**:
```typescript
interface QueryService {
  // Query existing Battle table with cycle context
  getBattlesByCycle(cycleNumber: number): Promise<Battle[]>;
  getBattlesByRobot(robotId: number, cycleRange: [number, number]): Promise<Battle[]>;
  
  // Query gap events from AuditLog
  queryGapEvents(filters: EventFilters): Promise<AuditLogEntry[]>;
  
  // Validate data integrity across existing tables
  validateDataIntegrity(cycleNumber: number): Promise<IntegrityReport>;
}

interface EventFilters {
  cycleRange?: [number, number];
  userId?: number;
  eventType?: string[]; // Only gap event types
  limit?: number;
  offset?: number;
}

interface AuditLogEntry {
  id: number;
  cycleNumber: number;
  eventType: string; // Only gap events: facility_transaction, passive_income, operating_costs, etc.
  eventTimestamp: Date;
  userId: number | null;
  robotId: number | null;
  payload: Record<string, any>;
  metadata?: {
    formula?: string;
    inputs?: Record<string, any>;
    output?: any;
  };
}
```

**Key Point**: QueryService primarily queries existing tables (Battle, Robot, User, Facility). AuditLog is only for gap events.


## Data Models

### AuditLog Table (All Events)

Single table storing ALL game events with flexible JSONB payload.

```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  cycle_number INTEGER NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  sequence_number INTEGER NOT NULL, -- Unique within cycle for ordering
  
  -- References (nullable for system-wide events)
  user_id INTEGER,
  robot_id INTEGER,
  
  -- Flexible event data
  payload JSONB NOT NULL,
  
  -- Optional calculation metadata for debugging
  metadata JSONB,
  
  -- Unique constraint on sequence within cycle
  CONSTRAINT audit_logs_cycle_sequence UNIQUE (cycle_number, sequence_number)
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_logs_cycle ON audit_logs(cycle_number);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_robot ON audit_logs(robot_id) WHERE robot_id IS NOT NULL;
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(event_timestamp);
CREATE INDEX idx_audit_logs_payload_gin ON audit_logs USING GIN(payload jsonb_path_ops);

-- Composite indexes for common queries
CREATE INDEX idx_audit_logs_cycle_user ON audit_logs(cycle_number, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_cycle_robot ON audit_logs(cycle_number, robot_id) WHERE robot_id IS NOT NULL;
CREATE INDEX idx_audit_logs_cycle_type ON audit_logs(cycle_number, event_type);
```

### CycleSnapshot Table

Pre-aggregated metrics for fast historical queries.

```sql
CREATE TABLE cycle_snapshots (
  id SERIAL PRIMARY KEY,
  cycle_number INTEGER NOT NULL UNIQUE,
  trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('manual', 'scheduled')),
  
  -- Timing
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  duration_ms INTEGER NOT NULL,
  
  -- Aggregated data (computed from audit_logs)
  stable_metrics JSONB NOT NULL,
  robot_metrics JSONB NOT NULL,
  step_durations JSONB NOT NULL,
  
  -- Summary statistics (for quick filtering)
  total_battles INTEGER NOT NULL DEFAULT 0,
  total_credits_transacted BIGINT NOT NULL DEFAULT 0,
  total_prestige_awarded INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cycle_snapshots_cycle ON cycle_snapshots(cycle_number);
CREATE INDEX idx_cycle_snapshots_start_time ON cycle_snapshots(start_time);
```

### Materialized Views for Operational Queries

```sql
-- Recent battles (last 30 days) for live leaderboards
CREATE MATERIALIZED VIEW recent_battles AS
SELECT 
  al.id,
  al.cycle_number,
  al.event_timestamp,
  al.payload->>'robot1Id' AS robot1_id,
  al.payload->>'robot2Id' AS robot2_id,
  al.payload->>'winnerId' AS winner_id,
  (al.payload->>'robot1ELOAfter')::integer AS robot1_elo_after,
  (al.payload->>'robot2ELOAfter')::integer AS robot2_elo_after
FROM audit_logs al
WHERE al.event_type = 'battle_complete'
  AND al.event_timestamp >= NOW() - INTERVAL '30 days';

CREATE INDEX idx_recent_battles_robot1 ON recent_battles(robot1_id);
CREATE INDEX idx_recent_battles_robot2 ON recent_battles(robot2_id);

-- Current robot stats (aggregated from events)
CREATE MATERIALIZED VIEW current_robot_stats AS
SELECT 
  robot_id,
  MAX(cycle_number) as last_cycle,
  COUNT(*) FILTER (WHERE event_type = 'battle_complete') as total_battles,
  COUNT(*) FILTER (WHERE event_type = 'battle_complete' AND payload->>'winnerId' = robot_id::text) as wins,
  SUM((payload->>'creditsEarned')::integer) as total_credits_earned,
  SUM((payload->>'fameAwarded')::integer) as total_fame_earned
FROM audit_logs
WHERE robot_id IS NOT NULL
GROUP BY robot_id;

CREATE INDEX idx_current_robot_stats_robot ON current_robot_stats(robot_id);

-- Refresh materialized views after each cycle
-- Called automatically at cycle end
```

### Event Type Enumeration

All event types stored in the audit log:

```typescript
enum EventType {
  // Battle events (replaces Battle table)
  BATTLE_COMPLETE = 'battle_complete',
  
  // Robot events
  ROBOT_REPAIR = 'robot_repair',
  ROBOT_ATTRIBUTE_UPGRADE = 'attribute_upgrade',
  ROBOT_LEAGUE_CHANGE = 'league_change',
  
  // Stable/User events
  CREDIT_CHANGE = 'credit_change',
  PRESTIGE_CHANGE = 'prestige_change',
  PASSIVE_INCOME = 'passive_income',
  OPERATING_COSTS = 'operating_costs',
  
  // Facility events
  FACILITY_PURCHASE = 'facility_purchase',
  FACILITY_UPGRADE = 'facility_upgrade',
  
  // Weapon events
  WEAPON_PURCHASE = 'weapon_purchase',
  WEAPON_SALE = 'weapon_sale',
  
  // Tournament events
  TOURNAMENT_MATCH = 'tournament_match',
  TOURNAMENT_COMPLETE = 'tournament_complete',
  
  // Tag team events
  TAG_TEAM_BATTLE = 'tag_team_battle',
  
  // Cycle execution events
  CYCLE_START = 'cycle_start',
  CYCLE_STEP_COMPLETE = 'cycle_step_complete',
  CYCLE_COMPLETE = 'cycle_complete',
}
```

### Event Payload Schemas

Each event type has a defined payload schema:

```typescript
// Battle Complete Event (replaces Battle table row)
interface BattleCompletePayload {
  battleId: number; // For reference
  robot1Id: number;
  robot2Id: number;
  winnerId: number | null;
  
  // ELO
  robot1ELOBefore: number;
  robot1ELOAfter: number;
  robot2ELOBefore: number;
  robot2ELOAfter: number;
  eloChange: number;
  
  // Damage
  robot1DamageDealt: number;
  robot2DamageDealt: number;
  robot1FinalHP: number;
  robot2FinalHP: number;
  robot1FinalShield: number;
  robot2FinalShield: number;
  
  // Rewards
  winnerReward: number;
  loserReward: number;
  robot1PrestigeAwarded: number;
  robot2PrestigeAwarded: number;
  robot1FameAwarded: number;
  robot2FameAwarded: number;
  
  // Costs
  robot1RepairCost: number;
  robot2RepairCost: number;
  
  // Battle details
  durationSeconds: number;
  battleType: string;
  leagueType: string;
  robot1Yielded: boolean;
  robot2Yielded: boolean;
  robot1Destroyed: boolean;
  robot2Destroyed: boolean;
  
  // Tag team (if applicable)
  team1ActiveRobotId?: number;
  team1ReserveRobotId?: number;
  team2ActiveRobotId?: number;
  team2ReserveRobotId?: number;
}

// Credit Change Event
interface CreditChangePayload {
  amount: number;
  newBalance: number;
  source: 'battle' | 'passive_income' | 'facility_purchase' | 'repair' | 'weapon_purchase' | 'other';
  referenceEventId?: number; // Link to battle_complete or other event
}

// Passive Income Event
interface PassiveIncomePayload {
  merchandising: number;
  streaming: number;
  totalIncome: number;
  facilityLevel: number;
  prestige: number;
  totalBattles: number;
  totalFame: number;
}

// Facility Transaction Event
interface FacilityTransactionPayload {
  facilityType: string;
  oldLevel: number;
  newLevel: number;
  cost: number;
  action: 'purchase' | 'upgrade';
}

// Cycle Step Complete Event
interface CycleStepPayload {
  stepName: string;
  stepNumber: number;
  duration: number;
  summary: Record<string, any>; // Step-specific summary data
}
```

### Migration from Battle Table

Since we're in prototype phase, we'll:
1. Create new audit_logs table
2. Migrate existing Battle data to events (one-time script)
3. Update cycle execution to log events instead of creating Battle rows
4. Drop Battle table once migration is verified

**Migration Script** (pseudocode):
```typescript
async function migrateBattlesToEvents() {
  const battles = await prisma.battle.findMany({ orderBy: { createdAt: 'asc' } });
  
  for (const battle of battles) {
    await prisma.auditLog.create({
      data: {
        cycleNumber: estimateCycleNumber(battle.createdAt),
        eventType: 'battle_complete',
        eventTimestamp: battle.createdAt,
        sequenceNumber: await getNextSequenceNumber(),
        userId: battle.userId,
        robotId: battle.robot1Id,
        payload: {
          battleId: battle.id,
          robot1Id: battle.robot1Id,
          robot2Id: battle.robot2Id,
          winnerId: battle.winnerId,
          // ... all other battle fields
        }
      }
    });
  }
  
  console.log(`Migrated ${battles.length} battles to events`);
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Event Logging Completeness

*For any* cycle execution, all events that occur during the cycle (battles, repairs, facility transactions, league changes) should have corresponding audit log entries with complete payload data.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 13.1, 13.2, 14.1, 14.2, 14.3**

### Property 2: Event Metadata Consistency

*For any* logged event, the audit log entry should contain a timestamp, cycle number, and sequence number, where sequence numbers are unique and monotonically increasing within each cycle.

**Validates: Requirements 9.3, 15.1, 15.2, 15.3**

### Property 3: Credit Change Audit Trail

*For any* user, the sum of all credit change events in the audit log for a given cycle should equal the difference between the user's starting and ending balance for that cycle.

**Validates: Requirements 9.4**

### Property 4: Cycle Snapshot Consistency

*For any* completed cycle, the cycle snapshot's aggregated metrics should match the sum of individual event values from the audit log for that cycle.

**Validates: Requirements 10.1, 10.5**

### Property 5: Event Queryability

*For any* combination of filters (cycle range, user ID, robot ID, event type, date range), the query service should return all matching audit log entries in the specified order.

**Validates: Requirements 9.2, 9.5**

### Property 6: Metric Progression Continuity

*For any* robot and any cumulative metric (ELO, fame, damage dealt, damage received, wins, losses, credits earned), the metric values in consecutive events should form a continuous chain where cumulative metrics increase monotonically and ELO values form a continuous chain where each event's "before" value equals the previous event's "after" value.

**Validates: Requirements 7.2, 7.3**

### Property 7: Facility ROI Calculation Accuracy

*For any* facility, the calculated ROI should equal (total income + total discounts - total operating costs - purchase cost) / purchase cost, where all values are aggregated from audit log events since purchase.

**Validates: Requirements 5.5, 8.2**

### Property 8: Historical Comparison Correctness

*For any* comparison request between two cycles, the Analytics Engine should retrieve data from exactly those two cycles and compute deltas as (current - comparison) and percentages as ((current - comparison) / comparison) × 100.

**Validates: Requirements 6.1, 6.3**

### Property 9: Time-Series Data Completeness

*For any* metric and cycle range, the trend data should include data points for all cycles in the range where the metric changed, with no gaps or duplicates.

**Validates: Requirements 7.1, 7.3, 12.5**

### Property 10: Batch Query Atomicity

*For any* batch comparison request with multiple metrics, either all metrics should be successfully computed and returned, or the entire request should fail with an error indicating which metrics failed.

**Validates: Requirements 6.5**

### Property 11: Cycle Trigger Type Recording

*For any* cycle execution, the cycle metadata should indicate whether the cycle was triggered manually or by schedule, and this should be reflected in both the cycle start event and the cycle snapshot.

**Validates: Requirements 11.1, 11.2**

### Property 12: Backward Compatibility

*For any* audit log entry created before a system update, the entry should remain queryable and its payload should be interpretable by the updated system.

**Validates: Requirements 11.5**

### Property 13: API Response Completeness

*For any* analytics API request (stable summary, robot performance, facility ROI, comparison, trend), the response should include all required fields as specified in the API contract, with no null values for mandatory fields.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**

### Property 14: Calculation Metadata Recording

*For any* economic calculation (repair cost, facility income, battle rewards), the audit log should include metadata with the formula used, input values, and output value.

**Validates: Requirements 9.1**

### Property 15: Cycle Step Duration Recording

*For any* cycle execution, each of the 8 cycle steps should have a corresponding step completion event with duration, and the sum of step durations should approximately equal the total cycle duration (within 5% tolerance for overhead).

**Validates: Requirements 15.2, 15.3**

### Property 16: Performance Degradation Detection

*For any* cycle step, if the average duration over the last 10 cycles exceeds 150% of the average duration over the previous 100 cycles, the Analytics Engine should flag it as a performance degradation.

**Validates: Requirements 15.4**

### Property 17: Insufficient Data Handling

*For any* comparison request where the requested historical cycle does not exist, the Analytics Engine should return a response indicating which specific comparisons are unavailable rather than failing entirely.

**Validates: Requirements 6.4**

### Property 18: Tag Team Event Correlation

*For any* tag team battle, the audit log should contain events for both the active and reserve robots, and the sum of individual robot damage should equal the team's total damage.

**Validates: Requirements 4.1, 4.4**

### Property 19: Stance-to-Win-Rate Correlation

*For any* battle stance (offensive, defensive, balanced), the Analytics Engine should compute win rate as (wins with stance) / (total battles with stance), aggregated across all robots and cycles.

**Validates: Requirements 13.3**

### Property 20: Weapon Efficiency Calculation

*For any* weapon, the efficiency metric should be calculated as (total damage dealt with weapon) / (purchase cost), where damage and cost are aggregated from audit log events.

**Validates: Requirements 14.4**

### Property 21: Yield HP Savings Calculation

*For any* robot that yields in battle, the HP saved should be calculated as (current HP at yield) - (expected HP if fought to destruction), where expected HP is estimated from damage rate before yield.

**Validates: Requirements 13.4**

### Property 22: Investment Recommendation Ranking

*For any* facility recommendation request, facilities should be ranked by ROI (highest first), and only facilities with positive projected ROI should be recommended.

**Validates: Requirements 8.3, 8.5**

### Property 23: Robot Performance Identification

*For any* robot performance analysis over N cycles, the top earners should be robots with highest total credits earned, highest ELO gainers should be robots with highest ELO delta, and loss leaders should be robots with highest net losses (expenses - income).

**Validates: Requirements 8.4**

### Property 24: Data Retention Integrity

*For any* archival operation that moves old audit logs to archive storage, all events should remain queryable through the same API, and data integrity checks should pass for archived data.

**Validates: Requirements 10.4**

### Property 25: Bulk Cycle Progress Reporting

*For any* bulk cycle execution of N cycles, progress indicators should be emitted after each cycle completion, and the estimated completion time should be calculated as (average cycle duration) × (remaining cycles).

**Validates: Requirements 15.5**


## Error Handling

### Event Logging Failures

**Strategy**: Fail-fast with transaction rollback

- If event logging fails during cycle execution, the entire cycle step should be rolled back
- Critical events (credit changes, ELO updates) must be logged successfully or the operation fails
- Non-critical events (analytics metadata) can be logged asynchronously with retry logic

**Implementation**:
```typescript
async function logCriticalEvent(event: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: event });
  } catch (error) {
    console.error('[AuditLog] Critical event logging failed:', error);
    throw new Error('Failed to log critical event - operation aborted');
  }
}

async function logNonCriticalEvent(event: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: event });
  } catch (error) {
    console.error('[AuditLog] Non-critical event logging failed:', error);
    // Queue for retry, don't fail the operation
    await queueEventForRetry(event);
  }
}
```

### Query Failures

**Strategy**: Graceful degradation with partial results

- If a query filter is invalid, return an error describing the invalid filter
- If a query times out, return partial results with a warning
- If a cycle snapshot is missing, fall back to computing from raw events

**Implementation**:
```typescript
async function queryEventsWithFallback(filters: EventFilters): Promise<QueryResult> {
  try {
    // Try snapshot-based query first (fast)
    return await queryFromSnapshots(filters);
  } catch (error) {
    console.warn('[Analytics] Snapshot query failed, falling back to raw events');
    // Fall back to raw event query (slower but always works)
    return await queryFromRawEvents(filters);
  }
}
```

### Data Integrity Violations

**Strategy**: Alert and quarantine

- If credit sum mismatch detected, flag the cycle for manual review
- If sequence number gap detected, log warning and continue
- If event schema validation fails, quarantine the event and alert admins

**Implementation**:
```typescript
async function validateCycleIntegrity(cycleNumber: number): Promise<IntegrityReport> {
  const issues: string[] = [];
  
  // Check credit sum consistency
  const creditMismatch = await checkCreditConsistency(cycleNumber);
  if (creditMismatch) {
    issues.push(`Credit sum mismatch in cycle ${cycleNumber}`);
    await flagCycleForReview(cycleNumber, 'credit_mismatch');
  }
  
  // Check sequence number continuity
  const sequenceGaps = await checkSequenceNumbers(cycleNumber);
  if (sequenceGaps.length > 0) {
    issues.push(`Sequence gaps detected: ${sequenceGaps.join(', ')}`);
  }
  
  return {
    cycleNumber,
    isValid: issues.length === 0,
    issues,
    timestamp: new Date(),
  };
}
```

### Missing Historical Data

**Strategy**: Explicit unavailability indication

- If requested cycle doesn't exist, return error with available cycle range
- If comparison cycle is missing, return partial comparison with unavailable fields marked
- If trend data has gaps, interpolate or mark gaps explicitly in response

**Implementation**:
```typescript
async function getComparison(
  userId: number,
  currentCycle: number,
  comparisonCycle: number
): Promise<ComparisonResult> {
  const current = await getCycleSnapshot(currentCycle);
  const comparison = await getCycleSnapshot(comparisonCycle);
  
  if (!current) {
    throw new Error(`Current cycle ${currentCycle} not found`);
  }
  
  if (!comparison) {
    return {
      current: current.metrics,
      comparison: null,
      unavailable: true,
      message: `Comparison cycle ${comparisonCycle} not found`,
    };
  }
  
  return {
    current: current.metrics,
    comparison: comparison.metrics,
    delta: computeDelta(current.metrics, comparison.metrics),
    percentChange: computePercentChange(current.metrics, comparison.metrics),
  };
}
```

## Testing Strategy

### Dual Testing Approach

The system will use both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

### Unit Testing Focus

Unit tests should focus on:
- Specific event logging scenarios (e.g., logging a battle with known values)
- Edge cases (e.g., empty cycle, missing data, invalid filters)
- Error conditions (e.g., database failures, invalid payloads)
- Integration points (e.g., event logger → database, analytics engine → query service)

### Property-Based Testing Configuration

- **Library**: fast-check (TypeScript/JavaScript property-based testing library)
- **Minimum iterations**: 100 per property test
- **Test tagging**: Each property test must reference its design document property

**Example Property Test**:
```typescript
import fc from 'fast-check';

// Feature: cycle-audit-logging-system, Property 3: Credit Change Audit Trail
test('credit changes sum to balance delta', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 1000 }), // userId
      fc.integer({ min: 1, max: 100 }), // cycleNumber
      fc.array(fc.integer({ min: -10000, max: 10000 })), // credit changes
      async (userId, cycleNumber, creditChanges) => {
        // Setup: Create user with starting balance
        const startBalance = 100000;
        await createTestUser(userId, startBalance);
        
        // Execute: Log credit changes
        for (const change of creditChanges) {
          await eventLogger.logCreditChange(userId, change, 'test', null, cycleNumber);
        }
        
        // Verify: Sum of changes equals balance delta
        const events = await queryService.queryEvents({
          userId,
          cycleRange: [cycleNumber, cycleNumber],
          eventType: ['credit_change'],
        });
        
        const sumOfChanges = events.reduce((sum, e) => sum + e.payload.amount, 0);
        const expectedBalance = startBalance + sumOfChanges;
        const actualBalance = await getUserBalance(userId);
        
        expect(actualBalance).toBe(expectedBalance);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

Integration tests should verify:
- End-to-end cycle execution with event logging
- Analytics API endpoints with real database queries
- Snapshot creation and querying
- Data integrity validation across multiple cycles

### Performance Testing

Performance tests should verify:
- Query response times < 1 second for typical queries
- Snapshot creation time < 5 seconds per cycle
- Bulk cycle execution with logging overhead < 10% of baseline


## Implementation Strategy

### Phase 1: Core Event Logging Infrastructure

1. **Database Schema**: Create AuditLog and CycleSnapshot tables with indexes
2. **Event Logger Service**: Implement EventLogger interface with all event types
3. **Integration Points**: Add event logging calls to existing cycle execution code
4. **Basic Querying**: Implement QueryService for retrieving audit logs

**Success Criteria**:
- All cycle events are logged to database
- Events can be queried by cycle, user, robot, and event type
- No performance degradation in cycle execution (< 5% overhead)

### Phase 2: Cycle Snapshots and Analytics

1. **Snapshot Service**: Implement CycleSnapshotService to create aggregated snapshots
2. **Analytics Engine**: Implement core analytics functions (income summary, performance summary)
3. **Comparison Service**: Implement historical comparison logic
4. **Data Integrity**: Implement validation functions to ensure audit trail consistency

**Success Criteria**:
- Cycle snapshots created automatically at cycle completion
- Analytics queries use snapshots for performance
- Historical comparisons work for any two cycles
- Data integrity checks pass for all cycles

### Phase 3: Advanced Analytics and API

1. **Trend Analysis**: Implement time-series analysis for ELO, income, performance
2. **ROI Calculator**: Implement facility investment analysis
3. **Recommendation Engine**: Implement facility purchase recommendations
4. **REST API**: Create analytics endpoints for frontend consumption

**Success Criteria**:
- ELO progression graphs available for all robots
- Facility ROI calculations accurate and performant
- Recommendations based on historical data
- API endpoints return data in < 1 second

### Phase 4: Monitoring and Optimization

1. **Cycle Performance Monitoring**: Track cycle step durations and identify bottlenecks
2. **Data Archival**: Implement archival strategy for old audit logs
3. **Query Optimization**: Add additional indexes based on query patterns
4. **Dashboard**: Create admin dashboard for system health monitoring

**Success Criteria**:
- Cycle performance degradation detected automatically
- Old data archived without losing queryability
- All queries maintain sub-second response times
- Admin dashboard shows system health metrics

### Integration with Existing Code

The audit logging system integrates with existing cycle execution code by:
1. Adding minimal gap event logging for data NOT in existing tables
2. Creating cycle snapshots that aggregate existing table data
3. Querying existing tables for analytics

**Example: Battle Orchestrator (NO NEW LOGGING NEEDED)**
```typescript
// In battleOrchestrator.ts
async function executeBattle(match: ScheduledMatch): Promise<Battle> {
  // Existing battle logic - NO CHANGES
  const battle = await runBattleSimulation(match);
  
  // Battle table already stores:
  // - ELO changes (before/after/delta)
  // - Damage dealt/received
  // - Rewards (winner/loser)
  // - Fame awarded
  // - Prestige awarded
  // - Repair costs
  
  // NO NEW LOGGING NEEDED - data is already in Battle table!
  
  return battle;
}
```

**Example: Repair Service (NO NEW LOGGING NEEDED)**
```typescript
// In repairService.ts
async function repairAllRobots(deductCosts: boolean): Promise<RepairSummary> {
  // Existing repair logic - NO CHANGES
  const robots = await getRobotsNeedingRepair();
  
  for (const robot of robots) {
    const repairCost = calculateRepairCost(robot);
    
    // Perform repair
    await updateRobotHP(robot.id, robot.maxHP);
    
    // Deduct costs
    if (deductCosts) {
      await deductCredits(robot.userId, repairCost);
    }
  }
  
  // NO NEW LOGGING NEEDED - repair costs are already in Battle.robot1RepairCost/robot2RepairCost
  
  return summary;
}
```

**Example: Facility Purchase (NEW LOGGING NEEDED - Gap Event)**
```typescript
// In facility routes/service
async function upgradeFacility(userId: number, facilityType: string): Promise<Facility> {
  const cycleNumber = await getCurrentCycleNumber();
  const facility = await getFacility(userId, facilityType);
  const oldLevel = facility.level;
  const newLevel = oldLevel + 1;
  const cost = getFacilityUpgradeCost(facilityType, newLevel);
  
  // Update facility (existing logic)
  const updated = await prisma.facility.update({
    where: { id: facility.id },
    data: { level: newLevel }
  });
  
  // Deduct cost (existing logic)
  await deductCredits(userId, cost);
  
  // NEW: Log gap event (facility transaction not in existing tables)
  await gapEventLogger.logFacilityTransaction(
    userId,
    facilityType,
    oldLevel,
    newLevel,
    cost,
    cycleNumber
  );
  
  return updated;
}
```

**Example: Passive Income Calculation (NEW LOGGING NEEDED - Gap Event)**
```typescript
// In cycle execution (new function to add)
async function calculateAndLogPassiveIncome(cycleNumber: number): Promise<void> {
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    // Calculate income (existing functions)
    const passiveIncome = await calculateDailyPassiveIncome(user.id);
    
    // Award income (existing logic)
    await prisma.user.update({
      where: { id: user.id },
      data: { currency: { increment: passiveIncome.total } }
    });
    
    // NEW: Log gap event (passive income calculation not stored anywhere)
    await gapEventLogger.logPassiveIncome(
      user.id,
      passiveIncome.merchandising,
      passiveIncome.streaming,
      incomeGeneratorLevel,
      cycleNumber
    );
  }
}
```

**Example: Cycle Execution with Snapshots**
```typescript
// In admin.ts bulk cycles endpoint
async function executeCycle(cycleNumber: number): Promise<CycleResult> {
  const startTime = Date.now();
  
  // NEW: Log cycle start (gap event)
  await gapEventLogger.logCycleStart(cycleNumber, 'manual');
  
  // Step 1: Repair (existing logic, no new logging)
  const stepStart = Date.now();
  const repairSummary = await repairAllRobots(true);
  await gapEventLogger.logCycleStepComplete(
    cycleNumber,
    'repair_pre_tournament',
    Date.now() - stepStart
  );
  
  // Step 2: Battles (existing logic, no new logging - Battle table has everything)
  const battleSummary = await executeScheduledBattles(new Date());
  
  // Step 3: Calculate and log passive income (NEW - gap event)
  await calculateAndLogPassiveIncome(cycleNumber);
  
  // Step 4: Calculate and log operating costs (NEW - gap event)
  await calculateAndLogOperatingCosts(cycleNumber);
  
  // ... other steps
  
  // NEW: Log cycle complete (gap event)
  const totalDuration = Date.now() - startTime;
  await gapEventLogger.logCycleComplete(cycleNumber, totalDuration);
  
  // NEW: Create cycle snapshot (aggregates existing Battle/Robot/User data + gap events)
  await cycleSnapshotService.createSnapshot(cycleNumber);
  
  return result;
}
```

### Migration Strategy

1. **Add tables**: Run migration to create AuditLog and CycleSnapshot tables
2. **Deploy logging**: Deploy event logging code (no breaking changes)
3. **Backfill**: Optionally backfill recent cycles from existing Battle/Robot data
4. **Enable analytics**: Deploy analytics API endpoints
5. **Frontend integration**: Update frontend to consume analytics endpoints

### Performance Considerations

- **Event logging overhead**: Batch insert events at end of each cycle step (< 100ms)
- **Snapshot creation**: Run asynchronously after cycle completion (< 5 seconds)
- **Query optimization**: Use cycle snapshots for aggregated queries (< 1 second)
- **Index strategy**: Create indexes on frequently queried fields (cycle_number, user_id, robot_id)
- **Archival**: Move audit logs older than 180 days to archive table (maintains queryability)

### Security Considerations

- **Access control**: Analytics endpoints require authentication
- **Data privacy**: User-specific data only accessible to that user or admins
- **Audit trail immutability**: Audit logs are append-only (no updates or deletes)
- **SQL injection prevention**: Use parameterized queries for all database operations
- **Rate limiting**: Apply rate limits to analytics API endpoints (100 requests/minute per user)

