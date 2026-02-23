# Product Requirements Document: League Instance Rebalancing System

**Last Updated**: February 22, 2026  
**Status**: ✅ IMPLEMENTED  
**Owner**: Robert Teunissen  
**Epic**: League Instance Management  
**Version**: 1.1

## Implementation Status

**✅ FULLY IMPLEMENTED** (February 21, 2026)

This PRD describes the league instance rebalancing system as currently implemented. The system is simple and effective:

**What's Implemented:**
- ✅ Conditional rebalancing (only when instance >100 robots)
- ✅ LP+ELO-based sorting with round-robin distribution
- ✅ Even redistribution across instances with mixed skill levels
- ✅ Natural balancing through even placement during promotion/demotion
- ✅ Applied to both 1v1 and tag team leagues

**What's NOT Implemented (Proposed Features):**
- ❌ Instance consolidation for underpopulated instances (<20 robots)
- ❌ Rebalancing history tracking (RebalancingHistory model)
- ❌ Instance change tracking (InstanceChange, previousLeagueId fields)
- ❌ Time restrictions (24-hour minimum between rebalancing)
- ❌ Combined LP+ELO scoring with weights (uses simple LP desc, ELO desc sort)

**Implementation Files:**
- `prototype/backend/src/services/leagueInstanceService.ts` (1v1 instance management)
- `prototype/backend/src/services/tagTeamLeagueInstanceService.ts` (tag team instance management)
- `prototype/backend/src/services/leagueRebalancingService.ts` (calls rebalancing)
- `prototype/backend/src/services/tagTeamLeagueRebalancingService.ts` (calls rebalancing)

**The Simple Rules:**
1. Instances rebalance when >100 robots or big imbalance
2. Robots sorted by LP (then ELO)
3. Redistributed evenly
4. LP and ELO stay the same

## Version History
- v1.1 - Documentation corrections (February 22, 2026) - Simplified to match actual implementation
- v1.0 - Initial Draft (February 10, 2026)

---

## Document Status

**Implementation Status**: ✅ **FULLY IMPLEMENTED** (February 21, 2026)

This PRD defines the league instance rebalancing system that maintains balanced populations across league instances. All features described in this document are currently active in the codebase.

**What This PRD Covers**:
- Instance population monitoring
- Rebalancing triggers and thresholds
- Robot redistribution algorithms
- LP+ELO-based sorting for splits
- Both 1v1 and 2v2 league support

**Related Documentation**:
- PRD_MATCHMAKING.md - Core matchmaking system
- PRD_LEAGUE_PROMOTION.md - Promotion/demotion mechanics
- DATABASE_SCHEMA.md - Database structure

---

## Executive Summary

The League Instance Rebalancing System maintains balanced populations across league instances by redistributing robots when instances become overcrowded (>100 robots). The system uses a simple trigger: rebalancing only occurs when any instance exceeds MAX_ROBOTS_PER_INSTANCE (100 robots).

**Core Mechanics**:
- **Trigger**: Rebalancing occurs when any instance exceeds 100 robots
- **Method**: Sort robots by LP+ELO, then distribute ROUND-ROBIN to maintain competitive balance in each instance
- **Target**: Balanced instances (calculated based on total robots / 100)
- **Frequency**: After each promotion/demotion cycle (if needed)
- **Preservation**: LP and ELO maintained during redistribution
- **Natural Balance**: Promotion/demotion placement fills instances evenly, minimizing rebalancing needs

**Simple Rules**:
1. Instances rebalance only when any instance exceeds 100 robots
2. Robots sorted by performance (LP + ELO), then distributed round-robin
3. Each instance maintains competitive balance with mixed skill levels
4. Your LP and ELO stay the same
5. Promotions/demotions naturally keep instances balanced by filling evenly

---

## Background & Context

### Current State

**What Exists**:
- ✅ League instance system (max 100 robots per instance)
- ✅ Instance creation logic (bronze_1, bronze_2, etc.)
- ✅ Automatic instance rebalancing (when instance >100 robots)
- ✅ Robot placement in instances with most free spots (natural balancing)
- ✅ Round-robin distribution to maintain competitive balance in each instance

**Future Enhancements** (not yet implemented):
- ❌ Instance consolidation (merging underpopulated instances <20 robots)
- ❌ Rebalancing history tracking (RebalancingHistory model)
- ❌ Instance change tracking (InstanceChange model)
- ❌ UI notifications for instance changes
- ❌ Time-based rebalancing restrictions (24-hour minimum)

### Why This Matters

Instance rebalancing is **critical for competitive integrity** because:
- Prevents overcrowding (>100 robots = poor matchmaking)
- Maintains fair competition within instances
- Enables scalable league system
- Provides predictable competitive environment
- Natural balancing through even placement reduces rebalancing frequency

**Problem Without Rebalancing**: 
- Instance populations would grow beyond 100 robots
- Matchmaking quality degrades with overcrowding
- Promotion/demotion percentages become skewed

**Natural Balancing**:
- Promoted/demoted robots placed in instance with most free spots
- This keeps instances naturally balanced
- Rebalancing only needed when growth exceeds 100 robots per instance

---

## Goals & Objectives

### Primary Goals

1. **Balanced Populations**: Maintain reasonable instance sizes (target: <100 robots)
2. **Fair Redistribution**: Use LP+ELO sorting to preserve competitive groupings
3. **Minimal Disruption**: Rebalance only when necessary (instance >100 robots)
4. **Transparent Process**: Players understand why rebalancing occurs
5. **Scalable System**: Support growth from 100 to 10,000+ robots

### Success Metrics

- Instance population: Most instances between 50-100 robots (no hard enforcement)
- Rebalancing frequency: Only when needed (instance >100 robots)
- Competitive balance: ELO variance within instances reasonable
- Matchmaking quality: Sufficient opponents for fair matches

### Non-Goals (Out of Scope)

- ❌ Manual instance selection by players
- ❌ Cross-tier rebalancing (each tier independent)
- ❌ Real-time rebalancing (only after promotion/demotion cycles)
- ❌ Instance merging based on player preference
- ❌ Regional or geographic instance grouping

---

## User Stories

### Epic: Instance Population Management

**US-1: Automatic Rebalancing When Overcrowded**
- **As the** game system
- **I need to** automatically rebalance instances when they exceed 100 robots
- **So that** matchmaking quality remains high and competition stays fair

**Acceptance Criteria:**
- Rebalancing triggers when any instance >100 robots
- Robots sorted by LP+ELO combined score
- Split into balanced groups (target: 75 robots per instance)
- All robots in tier rebalanced together (not just overcrowded instance)
- Rebalancing occurs after promotion/demotion cycle completes
- History record created for each rebalancing event

**US-2: Maintain Balanced Instance Populations**
- **As the** game system
- **I need to** automatically rebalance instances when they exceed 100 robots
- **So that** matchmaking quality remains high and competition stays fair

**Acceptance Criteria:**
- Rebalancing triggers when any instance >100 robots
- Robots sorted by LP (primary) and ELO (secondary)
- Distributed ROUND-ROBIN across instances to maintain competitive balance
- Each instance receives a mix of high, medium, and low LP robots
- All robots in tier rebalanced together
- Rebalancing occurs after promotion/demotion cycle completes
- LP and ELO preserved during rebalancing
- Natural balancing through even placement minimizes rebalancing frequency

**US-3: Understand Instance Changes**
- **As a** player
- **I want to** know when my robot's instance changes
- **So that** I understand my new competitive environment

**Acceptance Criteria:**
- Notification when robot moved to different instance
- Explanation of why rebalancing occurred
- New instance standings displayed
- Comparison of old vs new instance (population, avg ELO)
- Reassurance that LP and ELO preserved
- Link to view new instance standings

### Epic: Competitive Balance

**US-4: Maintain Competitive Groupings**
- **As a** competitive system
- **I need to** preserve balanced competition during rebalancing
- **So that** each instance maintains fair and engaging matches

**Acceptance Criteria:**
- Robots sorted by LP+ELO before redistribution
- Round-robin distribution ensures each instance gets mixed skill levels
- Each instance has similar LP distribution (e.g., all instances have 0-50 LP range)
- Top performers distributed evenly across instances
- Bottom performers distributed evenly across instances
- Middle-tier robots distributed evenly across instances

**US-5: Prevent Frequent Rebalancing**
- **As a** player
- **I want** stable instance membership
- **So that** I can build familiarity with opponents

**Acceptance Criteria:**
- Rebalancing only when instance >100 robots
- Not triggered by small population fluctuations (<20 robot difference)
- Minimum 24 hours between rebalancing events
- Predictable timing (after promotion/demotion cycles)
- Clear communication of rebalancing schedule

---

## Technical Requirements

### Database Schema Changes

**Note**: The current implementation does NOT include the following proposed schema changes. These are future enhancements:

#### Proposed Updates to Robot Model (NOT YET IMPLEMENTED)

```prisma
model Robot {
  // ... existing fields ...
  
  leagueId             String   @default("bronze_1") @db.VarChar(30)
  
  // PROPOSED NEW FIELDS (not yet implemented)
  previousLeagueId     String?  @db.VarChar(30)  // Track instance changes
  instanceChangedAt    DateTime?
  totalInstanceChanges Int      @default(0)
  
  @@index([currentLeague, leagueId])
}
```

#### Proposed Model: RebalancingHistory (NOT YET IMPLEMENTED)

```prisma
model RebalancingHistory {
  id                Int      @id @default(autoincrement())
  tier              String   @db.VarChar(20)
  triggerReason     String   @db.VarChar(50)  // "overcrowded", "consolidation", "manual"
  instancesBefore   Json                      // Array of {leagueId, count}
  instancesAfter    Json                      // Array of {leagueId, count}
  robotsMoved       Int
  totalRobots       Int
  executionTime     Int                       // Milliseconds
  createdAt         DateTime @default(now())
  
  @@index([tier, createdAt])
  @@index([createdAt])
}
```

#### Proposed Model: InstanceChange (NOT YET IMPLEMENTED)

```prisma
model InstanceChange {
  id              Int      @id @default(autoincrement())
  robotId         Int
  fromInstance    String   @db.VarChar(30)
  toInstance      String   @db.VarChar(30)
  reason          String   @db.VarChar(50)  // "rebalancing", "promotion", "demotion"
  leaguePoints    Int
  elo             Int
  rebalancingId   Int?                      // Links to RebalancingHistory
  createdAt       DateTime @default(now())
  
  robot           Robot    @relation(fields: [robotId], references: [id])
  
  @@index([robotId, createdAt])
  @@index([rebalancingId])
}
```

### Configuration Constants

**File**: `src/services/leagueInstanceService.ts`

```typescript
// Maximum robots per league instance
export const MAX_ROBOTS_PER_INSTANCE = 100;

// Note: REBALANCE_THRESHOLD constant exists but is not currently used in trigger logic
// Rebalancing triggers only when an instance exceeds MAX_ROBOTS_PER_INSTANCE
// The deviation-based rebalancing was simplified to reduce unnecessary redistributions
export const REBALANCE_THRESHOLD = 20; // Historical constant, not actively used

export const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
```

**File**: `src/services/leagueRebalancingService.ts`

```typescript
// Promotion/Demotion thresholds
const MIN_LEAGUE_POINTS_FOR_PROMOTION = 25; // Must have 25+ league points for promotion
const PROMOTION_PERCENTAGE = 0.10; // Top 10%
const DEMOTION_PERCENTAGE = 0.10; // Bottom 10%
const MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING = 5; // Must be in current league for 5+ cycles
const MIN_ROBOTS_FOR_REBALANCING = 10;
```

---

## Rebalancing Algorithms

### Distribution Strategy: Round-Robin

**Why Round-Robin?**

The rebalancing system uses round-robin distribution to maintain competitive balance within each instance. This ensures that all instances have a similar distribution of skill levels.

**When Does Rebalancing Happen?**

Rebalancing ONLY triggers when an instance exceeds 100 robots. The system naturally maintains balance because:
- Promoted/demoted robots are placed in the instance with the most free spots
- This keeps instances evenly filled without manual rebalancing
- When an instance hits >100, all instances are typically near 100
- Rebalancing then splits them evenly with round-robin distribution

**Example with 100 robots across 4 instances:**

Sequential distribution (WRONG):
- bronze_1: Robots 1-25 (highest LP: 50-44)
- bronze_2: Robots 26-50 (medium-high LP: 43-35)
- bronze_3: Robots 51-75 (medium-low LP: 34-20)
- bronze_4: Robots 76-100 (lowest LP: 19-0)

Round-robin distribution (CORRECT):
- bronze_1: Robots 1, 5, 9, 13... (LP range: 50-2, mixed)
- bronze_2: Robots 2, 6, 10, 14... (LP range: 49-1, mixed)
- bronze_3: Robots 3, 7, 11, 15... (LP range: 48-3, mixed)
- bronze_4: Robots 4, 8, 12, 16... (LP range: 47-0, mixed)

**Result**: All instances have similar LP distributions, maintaining fair competition in each instance.

### Main Rebalancing Orchestrator

```typescript
async function rebalanceAllLeagues(): Promise<RebalancingSummary> {
  console.log('Starting league rebalancing...');

  const fullSummary = {
    totalRobots: 0,
    totalPromoted: 0,
    totalDemoted: 0,
    tierSummaries: [],
    errors: [],
  };

  // Get total robot count
  fullSummary.totalRobots = await prisma.robot.count({
    where: { NOT: { name: 'Bye Robot' } },
  });

  // Track which robots have already been processed
  const processedRobotIds = new Set<number>();

  // Process each tier (bottom to top)
  for (const tier of LEAGUE_TIERS) {
    try {
      const summary = await rebalanceTier(tier, processedRobotIds);
      fullSummary.tierSummaries.push(summary);
      fullSummary.totalPromoted += summary.promoted;
      fullSummary.totalDemoted += summary.demoted;
    } catch (error) {
      fullSummary.errors.push(`${tier}: ${error.message}`);
    }
  }

  // Rebalance instances for each tier (ONLY if instance exceeds 100 robots)
  console.log('Checking instances for rebalancing...');
  for (const tier of LEAGUE_TIERS) {
    try {
      const instances = await getInstancesForTier(tier);
      const needsRebalancing = instances.some(inst => inst.currentRobots > MAX_ROBOTS_PER_INSTANCE);
      
      if (needsRebalancing) {
        console.log(`${tier}: Instance exceeds ${MAX_ROBOTS_PER_INSTANCE} robots, rebalancing...`);
        await rebalanceInstances(tier);
      } else {
        console.log(`${tier}: All instances under ${MAX_ROBOTS_PER_INSTANCE} robots, skipping`);
      }
    } catch (error) {
      console.error(`Error checking ${tier} instances:`, error);
    }
  }

  console.log('League rebalancing complete!');
  console.log(`  Total promoted: ${fullSummary.totalPromoted}`);
  console.log(`  Total demoted: ${fullSummary.totalDemoted}`);

  return fullSummary;
}
```

### Rebalance Single Tier (Process Promotions/Demotions Per Instance)

```typescript
async function rebalanceTier(tier: LeagueTier, excludeRobotIds: Set<number>): Promise<RebalancingSummary> {
  console.log(`Processing ${tier.toUpperCase()} league...`);

  // Count total robots in tier
  const totalInTier = await prisma.robot.count({
    where: {
      currentLeague: tier,
      NOT: { name: 'Bye Robot' },
    },
  });

  const summary = {
    tier,
    robotsInTier: totalInTier,
    promoted: 0,
    demoted: 0,
    eligibleRobots: 0,
  };

  // Get all instances for this tier
  const instances = await getInstancesForTier(tier);
  
  console.log(`${tier}: ${totalInTier} total robots across ${instances.length} instances`);

  // Process each instance separately
  for (const instance of instances) {
    console.log(`Processing ${instance.leagueId}...`);
    
    // Count eligible robots in this instance
    const eligibleInInstance = await prisma.robot.count({
      where: {
        leagueId: instance.leagueId,
        cyclesInCurrentLeague: { gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING },
        NOT: [
          { name: 'Bye Robot' },
          { id: { in: Array.from(excludeRobotIds) } },
        ],
      },
    });
    
    summary.eligibleRobots += eligibleInInstance;

    // Skip if too few robots in this instance
    if (eligibleInInstance < MIN_ROBOTS_FOR_REBALANCING) {
      console.log(`${instance.leagueId}: Skipping (${eligibleInInstance} eligible, need ${MIN_ROBOTS_FOR_REBALANCING})`);
      continue;
    }

    // Determine promotions for this instance
    const toPromote = await determinePromotions(instance.leagueId, excludeRobotIds);
    
    // Determine demotions for this instance
    const toDemote = await determineDemotions(instance.leagueId, excludeRobotIds);

    // Execute promotions
    for (const robot of toPromote) {
      try {
        await promoteRobot(robot);
        excludeRobotIds.add(robot.id);
        summary.promoted++;
      } catch (error) {
        console.error(`Error promoting robot ${robot.id}:`, error);
      }
    }

    // Execute demotions
    for (const robot of toDemote) {
      try {
        await demoteRobot(robot);
        excludeRobotIds.add(robot.id);
        summary.demoted++;
      } catch (error) {
        console.error(`Error demoting robot ${robot.id}:`, error);
      }
    }
  }

  console.log(`${tier}: Promoted ${summary.promoted}, Demoted ${summary.demoted} across ${instances.length} instances`);

  return summary;
}
```

### Rebalance Tier (Split Overcrowded Instances)

```typescript
async function rebalanceTier(tier: string): Promise<void> {
  const stats = await getLeagueInstanceStats(tier);

  // Only rebalance if needed (instance >100 robots)
  if (!stats.needsRebalancing) {
    console.log(`${tier} instances balanced, no action needed`);
    return;
  }

  console.log(`Rebalancing ${tier} instances...`);
  console.log(`  Total robots: ${stats.totalRobots}`);
  console.log(`  Instances: ${stats.instances.length}`);

  // Step 1: Get all robots in this tier, sorted by LP+ELO
  const allRobots = await prisma.robot.findMany({
    where: {
      currentLeague: tier,
    },
    orderBy: [
      { leaguePoints: 'desc' },
      { elo: 'desc' },
    ],
  });

  // Step 2: Calculate target instance count
  const targetInstanceCount = Math.ceil(stats.totalRobots / MAX_ROBOTS_PER_INSTANCE);

  console.log(`  Target instances: ${targetInstanceCount}`);

  // Step 3: Redistribute robots ROUND-ROBIN to maintain competitive balance
  // This ensures each instance has a mix of high, medium, and low LP robots
  const updates: Promise<any>[] = [];
  
  for (let i = 0; i < allRobots.length; i++) {
    const robot = allRobots[i];
    // Round-robin distribution: robot 0→instance 1, robot 1→instance 2, ..., robot N→instance 1, ...
    const targetInstanceNumber = (i % targetInstanceCount) + 1;
    const targetLeagueId = `${tier}_${targetInstanceNumber}`;

    if (robot.leagueId !== targetLeagueId) {
      updates.push(
        prisma.robot.update({
          where: { id: robot.id },
          data: { leagueId: targetLeagueId },
        })
      );
    }
  }

  await Promise.all(updates);
  console.log(`Rebalanced ${updates.length} robots across ${targetInstanceCount} instances`);
}
```

---

## User Experience Design

### Rebalancing Notification

```
┌─────────────────────────────────────────────────────────────┐
│  📊 INSTANCE REBALANCING                                    │
│                                                             │
│  Your robot THUNDER BOLT has been moved to a new instance  │
│  to maintain balanced competition.                          │
│                                                             │
│  Previous Instance: Bronze 1                                │
│  New Instance: Bronze 2                                     │
│                                                             │
│  What Changed:                                              │
│  • Your League Points: 32 LP (UNCHANGED)                    │
│  • Your ELO: 1510 (UNCHANGED)                               │
│  • Your Rank: #1 → #3 (in new instance)                    │
│                                                             │
│  Why This Happened:                                         │
│  Bronze 1 exceeded 100 robots, so all Bronze robots were   │
│  redistributed across 2 balanced instances based on         │
│  performance (LP + ELO).                                    │
│                                                             │
│  New Instance Stats:                                        │
│  • Total Robots: 76                                         │
│  • Average ELO: 1485                                        │
│  • Average LP: 28                                           │
│                                                             │
│  [View New Instance Standings] [Dismiss]                    │
└─────────────────────────────────────────────────────────────┘
```

### Dashboard - Rebalancing Alert

```
┌─────────────────────────────────────────────────────────────┐
│  NOTIFICATIONS                                              │
├─────────────────────────────────────────────────────────────┤
│  📊 Instance Rebalancing Occurred                           │
│     2 of your robots moved to new instances                 │
│     • Thunder Bolt: Bronze 1 → Bronze 2                     │
│     • Steel Destroyer: Silver 3 → Silver 2                  │
│     [View Details]                                          │
│                                                             │
│  ⚠️ Upcoming Match in 4 hours                               │
│     Thunder Bolt vs Iron Crusher                            │
│     [View Match]                                            │
└─────────────────────────────────────────────────────────────┘
```

### League Standings - Instance Selector

```
┌───────────────────────────────────────────────────────────────────┐
│  BRONZE LEAGUE                                                    │
│  [Instance 1 ▼] [Instance 2] [Instance 3]                         │
├───────────────────────────────────────────────────────────────────┤
│  Instance 1 - 78 robots (Avg ELO: 1420, Avg LP: 24)              │
│                                                                    │
│  Rank  Robot Name        Owner    ELO   LP   Cycles  W-L   Status │
│  ──────────────────────────────────────────────────────────────── │
│  🟢 1   Iron Crusher     player3  1580  35   10      15-2  ✅     │
│  🟢 2   Battle Master    player5  1550  32   9       14-3  ✅     │
│  ...                                                               │
│                                                                    │
│  Last Rebalanced: 2 days ago (Feb 8, 2026)                        │
│  Next Rebalancing: When instance exceeds 100 robots               │
└───────────────────────────────────────────────────────────────────┘
```

### Admin Dashboard - Rebalancing Controls

```
┌───────────────────────────────────────────────────────────────────┐
│  ADMIN - INSTANCE REBALANCING                                     │
├───────────────────────────────────────────────────────────────────┤
│  CURRENT STATUS                                                   │
│                                                                    │
│  Tier      Instances  Total Robots  Status                        │
│  ──────────────────────────────────────────────────────────────── │
│  Bronze    3          215           ✅ Balanced (72/71/72)        │
│  Silver    2          145           ⚠️ Imbalanced (95/50)         │
│  Gold      2          98            ✅ Balanced (49/49)            │
│  Platinum  1          45            ✅ Balanced                    │
│  Diamond   1          18            ⚠️ Underpopulated             │
│  Champion  1          8             ✅ Balanced                    │
│                                                                    │
│  ACTIONS                                                          │
│  [Check Rebalancing Needed]                                       │
│  [Rebalance All Tiers]                                            │
│  [Rebalance Specific Tier ▼]                                      │
│  [View Rebalancing History]                                       │
│                                                                    │
│  LAST REBALANCING                                                 │
│  • Tier: Silver                                                   │
│  • Date: February 8, 2026 10:30 AM                                │
│  • Reason: Overcrowded (instance exceeded 100)                    │
│  • Robots Moved: 45                                               │
│  • Execution Time: 1.2s                                           │
│  [View Details]                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Rebalancing History Page

```
┌───────────────────────────────────────────────────────────────────┐
│  REBALANCING HISTORY                                              │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  📊 Silver League Rebalancing              February 8, 2026       │
│     Reason: Overcrowded (instance exceeded 100 robots)            │
│     Robots Moved: 45 of 145 total                                 │
│     Execution Time: 1.2 seconds                                   │
│                                                                    │
│     Before:                                                       │
│     • silver_1: 105 robots (avg ELO 1520, avg LP 26)              │
│     • silver_2: 40 robots (avg ELO 1480, avg LP 22)               │
│                                                                    │
│     After:                                                        │
│     • silver_1: 73 robots (avg ELO 1515, avg LP 25)               │
│     • silver_2: 72 robots (avg ELO 1485, avg LP 23)               │
│                                                                    │
│     [View Affected Robots]                                        │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

**Note**: The consolidation example above is a proposed future feature, not currently implemented.

---

## Edge Cases & Considerations

### Population Edge Cases

**Case 1: All Instances Overcrowded**
- **Scenario**: All 3 bronze instances at 105 robots each (315 total)
- **Behavior**: Rebalance into 4 instances (~79 robots each)
- **Rationale**: Ceil(315 / 100) = 4 instances needed

**Case 2: Single Robot Over Threshold**
- **Scenario**: Instance has 101 robots (just 1 over threshold)
- **Behavior**: Rebalancing still triggers
- **Rationale**: Strict enforcement prevents gradual drift
- **Alternative**: Could add buffer (e.g., trigger at 105)

**Case 3: Rapid Growth**
- **Scenario**: Instance grows from 95 to 110 in one cycle
- **Behavior**: Rebalancing triggered immediately after cycle
- **Rationale**: Prevents prolonged overcrowding

**Case 4: Uneven Instance Populations**
- **Scenario**: bronze_1 (95 robots), bronze_2 (45 robots)
- **Behavior**: No rebalancing (neither >100)
- **Rationale**: Natural placement keeps instances balanced; only rebalance when >100
- **Note**: Imbalances are acceptable and naturally corrected through even placement

### Sorting Edge Cases

**Case 5: Identical Combined Scores**
- **Scenario**: Multiple robots with same LP+ELO score
- **Behavior**: Use robot ID as tiebreaker (deterministic)
- **Rationale**: Ensures consistent, reproducible results

**Case 6: Extreme ELO Variance**
- **Scenario**: Instance has robots from 1000 to 2000 ELO
- **Behavior**: Sort by LP+ELO, distribute round-robin
- **Rationale**: Maintains competitive balance with mixed skill levels in each instance

**Case 7: New Robots During Rebalancing**
- **Scenario**: Robot created while rebalancing in progress
- **Behavior**: Placed in instance with most free spots after rebalancing
- **Rationale**: Rebalancing is atomic operation

### Timing Edge Cases

**Case 8: Rebalancing During Matchmaking**
- **Scenario**: Rebalancing triggered while matchmaking running
- **Behavior**: Matchmaking completes first, then rebalancing
- **Rationale**: Prevents mid-matchmaking instance changes
- **Implementation**: Lock mechanism or sequential processing

**Case 9: Multiple Rebalancing Triggers**
- **Scenario**: Two tiers need rebalancing simultaneously
- **Behavior**: Process sequentially (Bronze → Champion order)
- **Rationale**: Prevents database conflicts

**Case 10: Rebalancing Immediately After Promotion**
- **Scenario**: Promotion creates overcrowding, triggers rebalancing
- **Behavior**: Expected and correct behavior
- **Rationale**: Promotions naturally cause population shifts

### 2v2 Team Edge Cases

**Case 11: Team Split Across Instances**
- **Scenario**: Robot A moved to bronze_1, Robot B moved to bronze_2
- **Behavior**: Team dissolved (cannot span instances)
- **Rationale**: Teams must be in same instance for matchmaking
- **Mitigation**: Try to keep teams together during rebalancing

**Case 12: Team Rebalancing**
- **Scenario**: 2v2 team instance exceeds 100 teams
- **Behavior**: Rebalance teams (not individual robots)
- **Rationale**: Teams are the competitive unit in 2v2

---

## API Endpoints

### Public Endpoints

**GET /api/leagues/:tier/instances**
```http
GET /api/leagues/bronze/instances
Authorization: Bearer <user-jwt>

Response:
{
  "tier": "bronze",
  "instances": [
    {
      "leagueId": "bronze_1",
      "instanceNumber": 1,
      "currentRobots": 78,
      "maxRobots": 100,
      "avgElo": 1420,
      "avgLP": 24,
      "isFull": false,
      "lastRebalanced": "2026-02-08T10:30:00Z"
    },
    {
      "leagueId": "bronze_2",
      "instanceNumber": 2,
      "currentRobots": 71,
      "maxRobots": 100,
      "avgElo": 1405,
      "avgLP": 22,
      "isFull": false,
      "lastRebalanced": "2026-02-08T10:30:00Z"
    }
  ],
  "totalRobots": 149,
  "needsRebalancing": false
}
```

**GET /api/robots/:id/instance-history**
```http
GET /api/robots/123/instance-history
Authorization: Bearer <user-jwt>

Response:
{
  "robotId": 123,
  "robotName": "Thunder Bolt",
  "currentInstance": "bronze_2",
  "totalInstanceChanges": 2,
  "history": [
    {
      "id": 789,
      "fromInstance": "bronze_1",
      "toInstance": "bronze_2",
      "reason": "rebalancing",
      "leaguePoints": 32,
      "elo": 1510,
      "createdAt": "2026-02-08T10:30:00Z"
    },
    {
      "id": 456,
      "fromInstance": "bronze_1",
      "toInstance": "bronze_1",
      "reason": "promotion",
      "leaguePoints": 28,
      "elo": 1480,
      "createdAt": "2026-01-15T08:00:00Z"
    }
  ]
}
```

### Admin Endpoints

**POST /api/admin/leagues/check-rebalancing**
```http
POST /api/admin/leagues/check-rebalancing
Authorization: Bearer <admin-jwt>

Response:
{
  "needsRebalancing": true,
  "tiers": [
    {
      "tier": "silver",
      "reason": "overcrowded",
      "instances": [
        {
          "leagueId": "silver_1",
          "count": 105,
          "status": "overcrowded"
        },
        {
          "leagueId": "silver_2",
          "count": 40,
          "status": "ok"
        }
      ]
    },
    {
      "tier": "diamond",
      "reason": "underpopulated",
      "instances": [
        {
          "leagueId": "diamond_1",
          "count": 18,
          "status": "underpopulated"
        }
      ]
    }
  ]
}
```

**POST /api/admin/leagues/rebalance**
```http
POST /api/admin/leagues/rebalance
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "tier": "silver",  // Optional, omit to rebalance all tiers
  "force": false     // Optional, bypass time restrictions
}

Response:
{
  "success": true,
  "tiersRebalanced": 1,
  "totalRobotsMoved": 45,
  "details": [
    {
      "tier": "silver",
      "reason": "overcrowded",
      "robotsMoved": 45,
      "totalRobots": 145,
      "instancesBefore": 2,
      "instancesAfter": 2,
      "executionTime": 1200,
      "historyId": 789
    }
  ]
}
```

**GET /api/admin/leagues/rebalancing-history**
```http
GET /api/admin/leagues/rebalancing-history?tier=silver&limit=10
Authorization: Bearer <admin-jwt>

Response:
{
  "history": [
    {
      "id": 789,
      "tier": "silver",
      "triggerReason": "overcrowded",
      "instancesBefore": [
        { "leagueId": "silver_1", "count": 105 },
        { "leagueId": "silver_2", "count": 40 }
      ],
      "instancesAfter": [
        { "leagueId": "silver_1", "count": 73 },
        { "leagueId": "silver_2", "count": 72 }
      ],
      "robotsMoved": 45,
      "totalRobots": 145,
      "executionTime": 1200,
      "createdAt": "2026-02-08T10:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "perPage": 10
}
```

---

## Testing & Validation

### Test Scenarios

**Scenario 1: Overcrowded Instance**
- Setup: bronze_1 with 105 robots
- Expected: Rebalance into 2 instances (~52-53 each)
- Verify: All robots reassigned, LP+ELO preserved, history created

**Scenario 2: Multiple Overcrowded Instances**
- Setup: bronze_1 (110), bronze_2 (105), bronze_3 (95)
- Expected: Rebalance into 5 instances (~62 each)
- Verify: Balanced distribution, competitive groupings maintained

**Scenario 3: Balanced Instances**
- Setup: bronze_1 (78 robots), bronze_2 (71 robots)
- Expected: No rebalancing triggered
- Verify: No robots moved, instances remain stable

**Scenario 4: LP+ELO Sorting**
- Setup: 100 robots with varying LP (0-50) and ELO (1000-2000)
- Expected: Sorted by LP+ELO, then distributed round-robin across instances
- Verify: Each instance has similar LP distribution (mixed high/medium/low)

**Scenario 5: No Rebalancing Needed**
- Setup: All instances between 50-100 robots
- Expected: No rebalancing triggered
- Verify: No robots moved, no history created

**Scenario 6: Rapid Successive Rebalancing**
- Setup: Trigger rebalancing twice within 24 hours
- Expected: Second rebalancing blocked
- Verify: Error message, minimum time enforced

**Scenario 7: 2v2 Team Rebalancing**
- Setup: 2v2 instance with 105 teams
- Expected: Teams rebalanced (not individual robots)
- Verify: Teams stay together, distributed evenly

**Scenario 8: Rebalancing During Matchmaking**
- Setup: Start matchmaking, trigger rebalancing mid-process
- Expected: Matchmaking completes first, then rebalancing
- Verify: No mid-matchmaking instance changes

### Performance Benchmarks

| Operation | Target | Notes |
|-----------|--------|-------|
| Check rebalancing needed (1 tier) | <200ms | Query + calculation |
| Rebalance tier (100 robots) | <2s | Sort + redistribute + DB updates |
| Rebalance all tiers (500 robots) | <10s | Sequential processing |
| Get instance stats | <100ms | Aggregation query |

### Monitoring Metrics

**Key Metrics**:
- Instance population distribution (histogram)
- Rebalancing frequency per tier
- Average robots moved per rebalancing
- Execution time per rebalancing
- Time since last rebalancing per tier
- ELO variance within instances

**Alerts**:
- Instance >110 robots (critical overcrowding)
- Instance <10 robots (critical underpopulation)
- Rebalancing execution time >5s (performance issue)
- Rebalancing frequency >1 per day (instability)

---

## Implementation Plan

### Phase 1: Core Rebalancing (Week 1)

**Tasks**:
- [x] Add rebalancing fields to Robot model
- [x] Implement `checkRebalancingNeeded()` (via getLeagueInstanceStats)
- [x] Implement `rebalanceTier()` with LP+ELO sorting
- [x] Unit tests for rebalancing logic

**Note**: RebalancingHistory and InstanceChange models are future enhancements.

### Phase 2: Integration (Week 2)

**Tasks**:
- [ ] Integrate rebalancing into daily cycle
- [ ] Add rebalancing after promotion/demotion
- [ ] Implement locking mechanism for concurrent operations
- [ ] Add rebalancing history tracking
- [ ] Integration tests

### Phase 2: Tag Team Support ✅ COMPLETE

**Tasks**:
- [x] Implement tag team rebalancing (tagTeamLeagueRebalancingService.ts)
- [x] Same logic as 1v1 (instance-based, LP+ELO sorting)
- [x] Integration tests for tag teams

### Phase 3: API & UI (Future Enhancement)

**Tasks**:
- [ ] Implement public API endpoints
- [ ] Implement admin API endpoints
- [ ] Create admin dashboard UI
- [ ] Create rebalancing notification component
- [ ] Add instance selector to league standings

### Phase 4: Advanced Features (Future Enhancement)

**Tasks**:
- [ ] Instance consolidation for <20 robots
- [ ] Rebalancing history tracking (RebalancingHistory model)
- [ ] Instance change tracking (InstanceChange model)
- [ ] Performance monitoring and metrics

---

## Success Criteria

### Functional Requirements ✅ COMPLETE

- [x] Rebalancing triggers when instance >100 robots
- [x] Robots sorted by LP (primary) and ELO (secondary)
- [x] Instances balanced based on total robots / 100
- [x] LP and ELO preserved during rebalancing
- [x] Tag team rebalancing working

**Future Enhancements**:
- [ ] History tracking
- [ ] Instance consolidation for <20 robots

### Quality Requirements ✅ COMPLETE

- [x] Unit test coverage for rebalancing logic
- [x] Integration test coverage for rebalancing scenarios
- [x] No data loss during rebalancing

**Future Enhancements**:
- [ ] Performance monitoring and metrics
- [ ] Instance population targets (90% between 50-100 robots)

### User Experience Requirements (Future Enhancement)

- [ ] Players notified of instance changes
- [ ] Clear explanation of why rebalancing occurred
- [ ] Instance history accessible
- [ ] Admin tools functional and intuitive

---

## Future Enhancements

### Short-Term (3 Months)

1. **Predictive Rebalancing**: Anticipate overcrowding before it happens
2. **Smart Consolidation**: Merge instances based on activity patterns
3. **Instance Preferences**: Allow players to request specific instances
4. **Rebalancing Notifications**: Email/push notifications for instance changes

### Medium-Term (6 Months)

5. **Regional Instances**: Geographic-based instance grouping
6. **Skill-Based Instances**: Separate instances for different skill levels
7. **Instance Tournaments**: Cross-instance competitions
8. **Dynamic Thresholds**: Adjust rebalancing triggers based on tier

### Long-Term (12+ Months)

9. **Machine Learning**: Optimize instance sizes based on engagement data
10. **Player-Driven Instances**: Allow stables to create private instances
11. **Instance Seasons**: Periodic resets with rewards
12. **Cross-Instance Matchmaking**: Allow matches between instances

---

## Conclusion

The League Instance Rebalancing System maintains balanced competitive environments by automatically redistributing robots when instances become overcrowded or imbalanced.

**Key Features**:
- ✅ Automatic rebalancing when instance >100 robots
- ✅ LP+ELO sorting with round-robin distribution for balanced competition
- ✅ Each instance maintains similar LP distribution (mixed skill levels)
- ✅ Natural balancing through even placement reduces rebalancing frequency
- ✅ Tag team support

**Future Enhancements**:
- Instance consolidation for underpopulated instances (<20 robots)
- History tracking and analytics
- Player notifications and UI components
- ✅ Even redistribution across instances
- ✅ Minimal disruption to players

**Future Enhancements**:
- Instance consolidation for underpopulated instances (<20 robots)
- History tracking (RebalancingHistory model)
- Instance change notifications

**Next Steps**:
1. Review and approve PRD
2. Begin Phase 1 implementation
3. Coordinate with PRD_LEAGUE_PROMOTION.md for promotion/demotion integration
4. Update PRD_MATCHMAKING.md with instance-aware matchmaking

---

**Document End**
