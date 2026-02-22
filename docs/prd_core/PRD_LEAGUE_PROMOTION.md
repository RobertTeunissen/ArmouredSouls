# Product Requirements Document: League Promotion & Demotion System

**Last Updated**: February 22, 2026  
**Status**: ✅ IMPLEMENTED  
**Owner**: Robert Teunissen  
**Epic**: League Progression System  
**Version**: 1.1

## Implementation Status

**✅ FULLY IMPLEMENTED** (February 21, 2026)

This PRD describes the league promotion and demotion system as currently implemented. The core mechanics are simple and functional:

**What's Implemented:**
- ✅ Instance-based promotions/demotions (bronze_1, bronze_2, bronze_3 evaluated separately)
- ✅ LP retention across tier changes (no reset to 0)
- ✅ Minimum 5 cycles eligibility requirement (applies to BOTH promotions AND demotions)
- ✅ **Demotion protection** (automatic via 5-cycle requirement - newly promoted robots can't be demoted for 5 cycles)
- ✅ Top 10% promotion, bottom 10% demotion (per instance)
- ✅ 25 LP minimum threshold for promotion (all tiers)

**What's NOT Implemented (Proposed Features):**
- ❌ Promotion/demotion history tracking (PromotionHistory model)
- ❌ Peak league tracking (lastPromotionDate, totalPromotions, peakLeague fields)
- ❌ Team2v2 model (2v2 uses TagTeam model instead)

**Implementation Files:**
- `prototype/backend/src/services/leagueRebalancingService.ts` (1v1 leagues)
- `prototype/backend/src/services/tagTeamLeagueRebalancingService.ts` (tag team leagues)

**The Simple Rules:**
1. Keep your LP when you move tiers
2. Need 5 cycles before you can be promoted or demoted
3. Top 10% with ≥25 LP get promoted
4. Bottom 10% get demoted (but only after 5 cycles)

**Demotion Protection**: The 5-cycle requirement automatically protects newly promoted robots - when promoted, cycles reset to 0, so you get 5 cycles to adapt before demotion risk.

## Version History
- v1.1 - Documentation corrections (February 22, 2026) - Fixed algorithm descriptions to match implementation
- v1.0 - Initial Draft (February 10, 2026)

---

## Document Status

**Implementation Status**: ✅ **FULLY IMPLEMENTED** (February 21, 2026)

This PRD defines the league promotion and demotion system for Armoured Souls. All features described in this document are currently active in the codebase for both 1v1 and tag team leagues.

**What This PRD Covers**:
- Instance-based promotion/demotion mechanics
- LP (League Points) retention across tier changes
- Tier-specific LP thresholds for promotion
- Eligibility requirements and timing
- Both 1v1 and 2v2 league support

**Related Documentation**:
- PRD_MATCHMAKING.md - Core matchmaking system
- PRD_LEAGUE_REBALANCING.md - Instance rebalancing logic
- DATABASE_SCHEMA.md - Database structure

---

## Executive Summary

The League Promotion & Demotion System enables robots to progress through competitive tiers based on performance within their specific league instance. The system retains League Points (LP) across tier changes to maintain momentum.

**Core Mechanics**:
- **Promotion Requirements**: Top 10% within instance + ≥25 LP + ≥5 cycles in current tier
- **Demotion Requirements**: Bottom 10% within instance + ≥5 cycles in current tier
- **LP Retention**: League Points carry over on tier change (no reset to 0)
- **Instance Independence**: Each instance (bronze_1, bronze_2, etc.) processes promotions separately

**Simple Rules**:
1. Keep your LP when promoted or demoted
2. Need 5 cycles in tier before you can move up or down (this provides automatic demotion protection)
3. Top 10% with ≥25 LP get promoted
4. Bottom 10% get demoted (but only after 5 cycles)

---

## Background & Context

### Current State

**What Exists** (from PRD_MATCHMAKING.md):
- ✅ League system with 6 tiers (Bronze, Silver, Gold, Platinum, Diamond, Champion)
- ✅ League instance system (max 100 robots per instance)
- ✅ ELO rating system
- ✅ League Points system (+3 win, -1 loss, +1 draw)
- ✅ Instance-based promotion/demotion logic (top 10%, bottom 10%)
- ✅ Minimum 5 cycles eligibility requirement
- ✅ LP retention across tier changes (implemented)
- ✅ 25 LP minimum threshold for promotion (all tiers)

**Future Enhancements** (not yet implemented):
- ❌ Tier-specific LP thresholds (currently 25 LP for all tiers)
- ❌ Promotion/demotion history tracking (PromotionHistory model)
- ❌ UI indicators for promotion zones with LP requirements
- ❌ Demotion protection (5-cycle grace period after promotion)
- ❌ Peak league tracking (highest tier reached)

### Why This Matters

The promotion system is the **primary progression mechanism** that:
- Provides long-term goals and sense of achievement
- Creates competitive pressure and engagement
- Validates player strategy and robot configuration
- Generates memorable moments (promotion celebrations)
- Prevents stagnation in mismatched tiers

**Solution**: 
- LP retention smooths progression and maintains momentum
- 5-cycle requirement prevents yo-yo effects (can't be demoted immediately after promotion)
- Combined, these create stable tier progression

---

## Goals & Objectives

### Primary Goals

1. **Meaningful Progression**: Make tier changes feel earned and significant
2. **Stable Tiers**: Prevent rapid promotion/demotion cycles (yo-yo effect)
3. **LP Retention**: Preserve League Points across tier changes for momentum
4. **Instance Fairness**: Ensure promotions are fair within each instance
5. **Clear Requirements**: Make promotion/demotion criteria transparent and understandable

### Success Metrics

- Promotion rate: 8-12% of eligible robots per cycle (target: 10%)
- Demotion rate: 8-12% of eligible robots per cycle (target: 10%)
- Average cycles in tier before promotion: 8-15 cycles
- Yo-yo rate (promoted then demoted within 5 cycles): <5%
- Player understanding: >90% can explain promotion requirements
- LP retention satisfaction: >80% positive feedback

### Non-Goals (Out of Scope)

- ❌ Cross-instance promotions (robots stay in their instance's tier structure)
- ❌ Manual promotion requests (all promotions are automated)
- ❌ Tier skipping (e.g., Bronze→Gold directly)
- ❌ Demotion protection items/buffs
- ❌ Promotion tournaments or playoffs

---

## User Stories

### Epic: Promotion System

**US-1: Earn Promotion Through Performance**
- **As a** player with a robot in a league
- **I want to** earn promotion to the next tier by performing well consistently
- **So that** I can face stronger opponents and achieve higher status

**Acceptance Criteria:**
- Robot must be in top 10% of their specific instance (e.g., bronze_1)
- Robot must have ≥25 League Points (Bronze→Silver threshold)
- Robot must have completed ≥5 cycles in current tier
- Promotion occurs automatically after cycle completes
- League Points are retained (not reset to 0)
- Cycles counter resets to 0 in new tier (provides automatic 5-cycle demotion protection)
- Robot moves to appropriate instance in new tier
- Promotion notification displayed prominently

**US-2: Understand Promotion Requirements**
- **As a** player
- **I want to** see how close my robot is to promotion
- **So that** I can plan my strategy and know what's needed

**Acceptance Criteria:**
- League standings show promotion zone (top 10%)
- Robot detail page shows current LP and promotion threshold
- Progress bar or indicator shows LP progress toward threshold
- Tooltip explains all three requirements (rank, LP, cycles)
- Estimated cycles to promotion based on current performance
- Clear messaging when robot meets/doesn't meet each requirement

**US-3: Maintain Momentum After Promotion**
- **As a** player whose robot was just promoted
- **I want to** keep my accumulated League Points
- **So that** I have a buffer against immediate demotion in the new tier

**Acceptance Criteria:**
- LP carries over to new tier (e.g., 32 LP in Bronze → 32 LP in Silver)
- Cycles counter resets to 0 in new tier (provides 5-cycle demotion protection)
- ELO rating preserved
- Robot placed in appropriate instance in new tier
- Cannot be demoted for first 5 cycles in new tier (automatic via cycles requirement)
- UI shows current cycles count

### Epic: Demotion System

**US-4: Face Demotion Risk for Poor Performance**
- **As a** competitive system
- **I need to** demote underperforming robots to lower tiers
- **So that** leagues remain balanced and competitive

**Acceptance Criteria:**
- Robot must be in bottom 10% of their specific instance
- Robot must have completed ≥5 cycles in current tier
- Demotion occurs automatically after cycle completes
- League Points are retained (not reset to 0)
- Robot moves to appropriate instance in lower tier
- Demotion notification displayed
- Cannot demote from Bronze (lowest tier)

**US-5: Understand Demotion Risk**
- **As a** player
- **I want to** see when my robot is at risk of demotion
- **So that** I can take action (repair, reconfigure, etc.)

**Acceptance Criteria:**
- League standings show demotion zone (bottom 10%)
- Robot detail page shows demotion risk warning
- Dashboard shows demotion warnings for at-risk robots
- Warning appears when robot enters bottom 20% (early warning)
- Critical warning when robot in bottom 10%
- Suggestions for improvement (repair, upgrade weapons, etc.)

### Epic: 2v2 League Support

**US-6: Team Promotion in 2v2 Leagues**
- **As a** player with robots in 2v2 teams
- **I want** team-based promotion mechanics
- **So that** 2v2 leagues have appropriate progression

**Acceptance Criteria:**
- 2v2 teams tracked as separate entities
- Team LP calculated from match results
- Both robots in team must meet individual eligibility (≥5 cycles)
- Team must be in top 10% of 2v2 instance
- Team must have ≥25 Team LP
- Both robots promoted together to next tier
- Individual robot LP also tracked separately for 1v1 leagues

---

## Technical Requirements

### Database Schema Changes

**Note**: The current implementation does NOT include the following proposed schema changes. These are future enhancements:

#### Proposed Updates to Robot Model (NOT YET IMPLEMENTED)

```prisma
model Robot {
  // ... existing fields ...
  
  currentLeague        String   @default("bronze") @db.VarChar(20)
  leagueId             String   @default("bronze_1") @db.VarChar(30)
  leaguePoints         Int      @default(0)
  cyclesInCurrentLeague Int     @default(0)
  elo                  Int      @default(1200)
  
  // PROPOSED NEW FIELDS (not yet implemented)
  promotionHistory     PromotionHistory[]
  lastPromotionDate    DateTime?
  lastDemotionDate     DateTime?
  totalPromotions      Int      @default(0)
  totalDemotions       Int      @default(0)
  peakLeague           String?  @db.VarChar(20)  // Highest tier reached
  peakLeagueDate       DateTime?
  
  @@index([currentLeague, leagueId, leaguePoints])
  @@index([currentLeague, leagueId, elo])
}
```

#### Proposed Model: PromotionHistory (NOT YET IMPLEMENTED)

```prisma
model PromotionHistory {
  id              Int      @id @default(autoincrement())
  robotId         Int
  type            String   @db.VarChar(20)  // "promotion" or "demotion"
  fromLeague      String   @db.VarChar(20)
  toLeague        String   @db.VarChar(20)
  fromInstance    String   @db.VarChar(30)
  toInstance      String   @db.VarChar(30)
  leaguePoints    Int                       // LP at time of change
  elo             Int                       // ELO at time of change
  cyclesInTier    Int                       // Cycles spent in previous tier
  rank            Int                       // Rank in instance at time of change
  totalRobots     Int                       // Total robots in instance
  createdAt       DateTime @default(now())
  
  robot           Robot    @relation(fields: [robotId], references: [id])
  
  @@index([robotId, createdAt])
  @@index([type, createdAt])
}
```

#### Proposed Model: Team2v2 (NOT YET IMPLEMENTED - for 2v2 leagues)

```prisma
model Team2v2 {
  id              Int      @id @default(autoincrement())
  robot1Id        Int
  robot2Id        Int
  currentLeague   String   @default("bronze") @db.VarChar(20)
  leagueId        String   @default("bronze_1") @db.VarChar(30)
  teamLP          Int      @default(0)
  cyclesInLeague  Int      @default(0)
  wins            Int      @default(0)
  losses          Int      @default(0)
  draws           Int      @default(0)
  createdAt       DateTime @default(now())
  
  robot1          Robot    @relation("Team2v2Robot1", fields: [robot1Id], references: [id])
  robot2          Robot    @relation("Team2v2Robot2", fields: [robot2Id], references: [id])
  
  @@unique([robot1Id, robot2Id])
  @@index([currentLeague, leagueId, teamLP])
}
```

### Configuration Constants

**File**: `src/services/leagueRebalancingService.ts`

```typescript
// Promotion/Demotion thresholds
const MIN_LEAGUE_POINTS_FOR_PROMOTION = 25; // Must have 25+ league points for promotion
const PROMOTION_PERCENTAGE = 0.10; // Top 10%
const DEMOTION_PERCENTAGE = 0.10; // Bottom 10%
const MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING = 5; // Must be in current league for 5+ cycles
const MIN_ROBOTS_FOR_REBALANCING = 10;
```

**File**: `src/services/leagueInstanceService.ts`

```typescript
export const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type LeagueTier = typeof LEAGUE_TIERS[number];

// Maximum robots per league instance
export const MAX_ROBOTS_PER_INSTANCE = 100;

// Threshold for triggering instance rebalancing
export const REBALANCE_THRESHOLD = 20;
```

**Note**: The implementation uses a simplified configuration. The following proposed config structure is NOT implemented:

```typescript
// PROPOSED (not implemented):
export const LEAGUE_HIERARCHY = {
  bronze: { promotion: 'silver', demotion: null },
  silver: { promotion: 'gold', demotion: 'bronze' },
  gold: { promotion: 'platinum', demotion: 'silver' },
  platinum: { promotion: 'diamond', demotion: 'gold' },
  diamond: { promotion: 'champion', demotion: 'platinum' },
  champion: { promotion: null, demotion: 'diamond' },
} as const;
```
  silver: { promotion: 'gold', demotion: 'bronze' },
  gold: { promotion: 'platinum', demotion: 'silver' },
  platinum: { promotion: 'diamond', demotion: 'gold' },
  diamond: { promotion: 'champion', demotion: 'platinum' },
  champion: { promotion: null, demotion: 'diamond' },
} as const;
```

---

## Promotion & Demotion Algorithm

### Promotion Algorithm (Per Instance)

```typescript
async function processPromotions(leagueId: string): Promise<PromotionResult> {
  const currentTier = leagueId.split('_')[0];  // Extract "bronze" from "bronze_1"
  const lpThreshold = LEAGUE_CONFIG.PROMOTION_LP_THRESHOLDS[currentTier];
  
  // Step 1: Get robots in this instance with minimum LP AND minimum cycles
  const robotsWithMinPoints = await prisma.robot.findMany({
    where: {
      leagueId: leagueId,  // Specific instance (e.g., "bronze_1")
      cyclesInCurrentLeague: { gte: LEAGUE_CONFIG.MIN_CYCLES_FOR_PROMOTION },
      leaguePoints: { gte: lpThreshold },  // Must have ≥25 LP
    },
    orderBy: [
      { leaguePoints: 'desc' },
      { elo: 'desc' },
    ],
  });
  
  // Step 2: If no robots meet LP threshold, skip
  if (robotsWithMinPoints.length === 0) {
    return { promoted: 0, reason: 'No robots with sufficient LP' };
  }
  
  // Step 3: Get total eligible robots (for calculating top 10%)
  const totalEligibleRobots = await prisma.robot.count({
    where: {
      leagueId: leagueId,
      cyclesInCurrentLeague: { gte: LEAGUE_CONFIG.MIN_CYCLES_FOR_PROMOTION },
    },
  });
  
  // Step 4: Check if instance has enough robots
  if (totalEligibleRobots < LEAGUE_CONFIG.MIN_ROBOTS_FOR_REBALANCE) {
    return { promoted: 0, reason: 'Insufficient robots in instance' };
  }
  
  // Step 5: Calculate top 10% of ALL eligible robots
  const promotionCount = Math.floor(totalEligibleRobots * LEAGUE_CONFIG.PROMOTION_PERCENTAGE);
  
  if (promotionCount === 0) {
    return { promoted: 0, reason: 'Promotion count is 0' };
  }
  
  // Step 6: Take top N robots (only from those with ≥25 LP)
  const eligibleForPromotion = robotsWithMinPoints.slice(0, Math.min(promotionCount, robotsWithMinPoints.length));
  
  // Step 7: Get target tier (using helper function)
  const targetTier = getNextTierUp(currentTier);
  if (!targetTier) {
    return { promoted: 0, reason: 'Already at highest tier' };
  }
  
  // Step 8: Promote each eligible robot
  const promotedRobots = [];
  for (const robot of eligibleForPromotion) {
    // Find target instance with most free spots
    const targetInstance = await findBestInstance(targetTier);
    
    // Update robot
    const updated = await prisma.robot.update({
      where: { id: robot.id },
      data: {
        currentLeague: targetTier,
        leagueId: targetInstance,
        cyclesInCurrentLeague: 0,  // Reset cycles counter
        // leaguePoints: RETAINED (not reset)
      },
    });
    
    promotedRobots.push(updated);
  }
  
  return {
    promoted: promotedRobots.length,
    robots: promotedRobots,
    fromInstance: leagueId,
    toTier: targetTier,
  };
}
```

### Demotion Algorithm (Per Instance)

```typescript
async function processDemotions(leagueId: string): Promise<DemotionResult> {
  const currentTier = leagueId.split('_')[0];
  
  // Step 1: Get all eligible robots in this instance (with minimum cycles)
  const robots = await prisma.robot.findMany({
    where: {
      leagueId: leagueId,
      cyclesInCurrentLeague: { gte: LEAGUE_CONFIG.MIN_CYCLES_FOR_DEMOTION },
    },
    orderBy: [
      { leaguePoints: 'asc' },  // Sort ascending for bottom 10%
      { elo: 'asc' },
    ],
  });
  
  // Step 2: Check if instance has enough robots
  if (robots.length < LEAGUE_CONFIG.MIN_ROBOTS_FOR_REBALANCE) {
    return { demoted: 0, reason: 'Insufficient robots in instance' };
  }
  
  // Step 3: Calculate bottom 10%
  const demotionCount = Math.floor(robots.length * LEAGUE_CONFIG.DEMOTION_PERCENTAGE);
  
  if (demotionCount === 0) {
    return { demoted: 0, reason: 'Demotion count is 0' };
  }
  
  // Step 4: Get target tier (using helper function)
  const targetTier = getNextTierDown(currentTier);
  if (!targetTier) {
    return { demoted: 0, reason: 'Already at lowest tier' };
  }
  
  // Step 5: Select bottom 10% for demotion (first N robots since sorted ascending)
  const eligibleForDemotion = robots.slice(0, demotionCount);
  
  // Step 6: Demote each eligible robot
  const demotedRobots = [];
  for (const robot of eligibleForDemotion) {
    // Find target instance with most free spots
    const targetInstance = await findBestInstance(targetTier);
    
    // Update robot
    const updated = await prisma.robot.update({
      where: { id: robot.id },
      data: {
        currentLeague: targetTier,
        leagueId: targetInstance,
        cyclesInCurrentLeague: 0,  // Reset cycles counter
        // leaguePoints: RETAINED (not reset)
      },
    });
    
    demotedRobots.push(updated);
  }
  
  return {
    demoted: demotedRobots.length,
    robots: demotedRobots,
    fromInstance: leagueId,
    toTier: targetTier,
  };
}
    });
    
    // Create history record
    await prisma.promotionHistory.create({
      data: {
        robotId: robot.id,
        type: 'demotion',
        fromLeague: currentTier,
        toLeague: targetTier,
        fromInstance: leagueId,
        toInstance: targetInstance,
        leaguePoints: robot.leaguePoints,
        elo: robot.elo,
        cyclesInTier: robot.cyclesInCurrentLeague,
        rank: robots.indexOf(robot) + 1,
        totalRobots: robots.length,
      },
    });
    
    demotedRobots.push(updated);
  }
  
  return {
    demoted: demotedRobots.length,
    robots: demotedRobots,
    fromInstance: leagueId,
    toTier: targetTier,
  };
}
```

### Helper: Find Best Instance

```typescript
async function findBestInstance(tier: string): Promise<string> {
  // Get all instances for this tier
  const instances = await prisma.robot.groupBy({
    by: ['leagueId'],
    where: {
      currentLeague: tier,
    },
    _count: {
      id: true,
    },
  });
  
  // Find instance with most free spots
  let bestInstance = `${tier}_1`;
  let maxFreeSpots = LEAGUE_CONFIG.MAX_ROBOTS_PER_INSTANCE;
  
  for (const instance of instances) {
    const freeSpots = LEAGUE_CONFIG.MAX_ROBOTS_PER_INSTANCE - instance._count.id;
    if (freeSpots > maxFreeSpots) {
      maxFreeSpots = freeSpots;
      bestInstance = instance.leagueId;
    }
  }
  
  // If all instances full, create new one
  if (maxFreeSpots === 0) {
    const instanceNumber = instances.length + 1;
    bestInstance = `${tier}_${instanceNumber}`;
  }
  
  return bestInstance;
}
```

### Complete Rebalancing Orchestration

```typescript
async function rebalanceAllLeagues(): Promise<RebalanceResult> {
  const results = {
    totalPromoted: 0,
    totalDemoted: 0,
    byInstance: [],
  };
  
  // Get all unique league instances
  const instances = await prisma.robot.groupBy({
    by: ['leagueId'],
    _count: { id: true },
  });
  
  // Process each instance independently
  for (const instance of instances) {
    const leagueId = instance.leagueId;
    
    // Process promotions first
    const promotionResult = await processPromotions(leagueId);
    results.totalPromoted += promotionResult.promoted;
    
    // Then process demotions
    const demotionResult = await processDemotions(leagueId);
    results.totalDemoted += demotionResult.demoted;
    
    results.byInstance.push({
      leagueId,
      promoted: promotionResult.promoted,
      demoted: demotionResult.promoted,
    });
  }
  
  return results;
}
```

### Helper Functions

```typescript
/**
 * Get the next tier up for promotion
 */
function getNextTierUp(currentTier: LeagueTier): LeagueTier | null {
  const currentIndex = LEAGUE_TIERS.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === LEAGUE_TIERS.length - 1) {
    return null; // Already at top
  }
  return LEAGUE_TIERS[currentIndex + 1];
}

/**
 * Get the next tier down for demotion
 */
function getNextTierDown(currentTier: LeagueTier): LeagueTier | null {
  const currentIndex = LEAGUE_TIERS.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === 0) {
    return null; // Already at bottom
  }
  return LEAGUE_TIERS[currentIndex - 1];
}

/**
 * Find best instance for placing a robot (instance with most free spots)
 */
async function findBestInstance(tier: string): Promise<string> {
  const instances = await getInstancesForTier(tier);

  if (instances.length === 0) {
    return `${tier}_1`;
  }

  // Find instance with most free spots
  const leastFull = instances.sort((a, b) => a.currentRobots - b.currentRobots)[0];

  if (leastFull.currentRobots >= MAX_ROBOTS_PER_INSTANCE) {
    // All instances full, create new one
    const nextInstanceNumber = Math.max(...instances.map((i) => i.instanceNumber)) + 1;
    return `${tier}_${nextInstanceNumber}`;
  }

  return leastFull.leagueId;
}
```

---

## User Experience Design

### League Standings - Promotion Zone Indicators

```
┌───────────────────────────────────────────────────────────────────┐
│  BRONZE LEAGUE - Instance 1                                       │
│  Promotion Requirement: Top 10% + ≥25 LP + ≥5 Cycles              │
├───────────────────────────────────────────────────────────────────┤
│  Rank  Robot Name        Owner    ELO   LP   Cycles  W-L   Status │
│  ──────────────────────────────────────────────────────────────── │
│  🟢 1   Thunder Bolt     player5  1510  32   8       12-3  ✅ READY│
│  🟢 2   Steel Destroyer  player1  1480  28   7       10-4  ✅ READY│
│  🟢 3   Plasma Titan     player2  1450  26   6       9-5   ✅ READY│
│  🟡 4   Lightning Core   player4  1425  24   5       8-6   ⚠️ 1 LP │
│  🟡 5   Battle Master    player3  1405  22   8       7-7   ⚠️ 3 LP │
│   6   Iron Wall        player6  1380  18   4       6-8   3 cycles│
│   7   Bronze Bot       player7  1350  15   3       5-9   2 cycles│
│  ...                                                               │
│  45   Old Fighter      player8  1180   8   6       3-13          │
│  🔴 46   Rusty Warrior   player9  1150   5   7       2-14  ⚠️ RISK │
│  🔴 47   Broken Bot      player10 1120   3   8       1-15  ⚠️ RISK │
│                                                                    │
│  🟢 Promotion Zone (Top 10% + ≥25 LP + ≥5 cycles)                 │
│  🟡 Near Promotion (Top 10% but missing LP or cycles)             │
│  🔴 Demotion Zone (Bottom 10% + ≥5 cycles)                        │
└───────────────────────────────────────────────────────────────────┘
```

### Robot Detail Page - Promotion Progress

```
┌─────────────────────────────────────────────────────────────┐
│  THUNDER BOLT                                               │
│  League: Bronze (Instance 1)  |  Rank: #1 of 47            │
├─────────────────────────────────────────────────────────────┤
│  PROMOTION PROGRESS                                         │
│                                                             │
│  ✅ Rank Requirement: Top 10% (Currently #1, need ≤5)       │
│  ✅ League Points: 32 LP (Need ≥25 LP) ████████████ 128%   │
│  ✅ Cycles Played: 8 cycles (Need ≥5 cycles)                │
│                                                             │
│  🎉 ELIGIBLE FOR PROMOTION TO SILVER!                       │
│  Promotion will occur after next cycle completes.           │
│  Your 32 LP will carry over to Silver league.               │
│                                                             │
│  [View Promotion History]                                   │
└─────────────────────────────────────────────────────────────┘
```

### Robot Detail Page - Near Promotion

```
┌─────────────────────────────────────────────────────────────┐
│  LIGHTNING CORE                                             │
│  League: Bronze (Instance 1)  |  Rank: #4 of 47            │
├─────────────────────────────────────────────────────────────┤
│  PROMOTION PROGRESS                                         │
│                                                             │
│  ✅ Rank Requirement: Top 10% (Currently #4, need ≤5)       │
│  ⚠️ League Points: 24 LP (Need ≥25 LP) ███████████░ 96%    │
│  ✅ Cycles Played: 5 cycles (Need ≥5 cycles)                │
│                                                             │
│  ⚠️ ALMOST READY FOR PROMOTION!                             │
│  You need 1 more League Point to qualify.                   │
│  Win your next match to reach promotion threshold!          │
│                                                             │
│  Tip: Maintain your rank while earning that final LP.       │
└─────────────────────────────────────────────────────────────┘
```

### Promotion Notification

```
┌─────────────────────────────────────────────────────────────┐
│  🎉 PROMOTION!                                              │
│                                                             │
│  THUNDER BOLT has been promoted to SILVER LEAGUE!           │
│                                                             │
│  Previous Tier: Bronze (Instance 1)                         │
│  New Tier: Silver (Instance 2)                              │
│                                                             │
│  Final Bronze Stats:                                        │
│  • Rank: #1 of 47 robots                                    │
│  • League Points: 32 LP (RETAINED)                          │
│  • ELO: 1510 (RETAINED)                                     │
│  • Cycles in Bronze: 8                                      │
│  • Record: 12 wins, 3 losses                                │
│                                                             │
│  Silver League Benefits:                                    │
│  • Your 32 LP carries over                                  │
│  • Demotion protection for 5 cycles                         │
│  • Face stronger opponents                                  │
│  • Higher rewards per match                                 │
│                                                             │
│  [View Silver Standings] [Configure Robot]                  │
└─────────────────────────────────────────────────────────────┘
```

### Demotion Warning

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ DEMOTION RISK                                           │
│                                                             │
│  RUSTY WARRIOR is at risk of demotion!                      │
│                                                             │
│  Current Status:                                            │
│  • Rank: #46 of 47 (Bottom 10%)                             │
│  • League Points: 5 LP                                      │
│  • Cycles in Silver: 7                                      │
│  • Recent Record: 1-4 (last 5 matches)                      │
│                                                             │
│  ⚠️ If you remain in bottom 10% after next cycle,           │
│     you will be demoted to Bronze league.                   │
│                                                             │
│  Recommendations:                                           │
│  • Repair to 100% HP before next match                      │
│  • Review weapon loadout and stance                         │
│  • Check opponent ELO and adjust strategy                   │
│  • Consider upgrading key attributes                        │
│                                                             │
│  [Repair Now] [Configure Robot] [View Opponents]            │
└─────────────────────────────────────────────────────────────┘
```

### Promotion History Page

```
┌───────────────────────────────────────────────────────────────────┐
│  PROMOTION HISTORY - Thunder Bolt                                 │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  🏆 Promoted to SILVER                        February 10, 2026   │
│     From: Bronze (Instance 1) - Rank #1 of 47                     │
│     Stats: 32 LP, 1510 ELO, 8 cycles, 12-3 record                 │
│     To: Silver (Instance 2)                                       │
│                                                                    │
│  ──────────────────────────────────────────────────────────────── │
│                                                                    │
│  🏆 Promoted to BRONZE                        January 15, 2026    │
│     From: New Robot                                               │
│     Initial Placement                                             │
│                                                                    │
│  ──────────────────────────────────────────────────────────────── │
│                                                                    │
│  Career Summary:                                                  │
│  • Total Promotions: 1                                            │
│  • Total Demotions: 0                                             │
│  • Peak League: Silver (Current)                                  │
│  • Cycles to First Promotion: 8                                   │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2v2 League Promotion

### Team Promotion Requirements

For 2v2 leagues, teams (not individual robots) are promoted/demoted:

**Promotion Requirements**:
- Team must be in top 10% of 2v2 instance
- Team must have ≥25 Team LP
- Both robots must have ≥5 cycles in current tier (individual eligibility)
- Both robots must be battle-ready

**Key Differences from 1v1**:
- Team LP is separate from individual robot LP
- Both robots promoted together (cannot split team)
- Individual robot stats (ELO, individual LP) also tracked
- If one robot leaves team, team is dissolved

### 2v2 Team Promotion Algorithm

**Note**: Tag team promotions are handled by `tagTeamLeagueRebalancingService.ts` with the same logic as 1v1:
- Top 10% of teams in instance
- ≥25 team league points
- ≥5 cycles in current tier
- LP retained on promotion/demotion

---

## Edge Cases & Considerations

### LP Retention Edge Cases

**Case 1: Robot Promoted with High LP**
- **Scenario**: Robot promoted with 45 LP to new tier
- **Behavior**: Retains 45 LP in new tier
- **Rationale**: Rewards strong performance, provides buffer
- **Risk**: Robot might immediately qualify for next promotion
- **Mitigation**: 5-cycle minimum still applies

**Case 2: Robot Demoted with Low LP**
- **Scenario**: Robot demoted with 2 LP to lower tier
- **Behavior**: Retains 2 LP in lower tier
- **Rationale**: Consistent with retention policy
- **Risk**: Robot starts at disadvantage in lower tier
- **Mitigation**: Lower tier competition should be easier

**Case 3: Yo-Yo Prevention**
- **Scenario**: Robot promoted, then immediately in demotion zone
- **Behavior**: Cannot be demoted for 5 cycles (automatic via `cyclesInCurrentLeague` requirement)
- **Rationale**: Prevents frustrating rapid tier changes
- **Implementation**: `cyclesInCurrentLeague` resets to 0 on promotion, demotion requires ≥5 cycles
- **Result**: Newly promoted robots get 5 cycles to adapt before demotion risk

### Instance Management Edge Cases

**Case 4: Target Instance Full**
- **Scenario**: All instances in target tier at 100 robots
- **Behavior**: Create new instance (e.g., silver_3)
- **Implementation**: `findBestInstance()` creates new instance if needed

**Case 5: Uneven Promotions Across Instances**
- **Scenario**: bronze_1 promotes 8 robots, bronze_2 promotes 2 robots
- **Behavior**: Each instance processes independently
- **Rationale**: Maintains instance-based competition integrity
- **Note**: This is expected and fair

**Case 6: Instance Rebalancing After Promotion**
- **Scenario**: Small instance (15 robots) promotes top 10% (2 robots), leaving 13
- **Behavior**: Instance continues with 13 robots (no consolidation implemented)
- **Rationale**: Current implementation only rebalances when >100 robots or deviation >20
- **Note**: Instance consolidation for <20 robots is a future enhancement

### 2v2 Team Edge Cases

**Case 7: One Robot Meets Eligibility, Other Doesn't**
- **Scenario**: Robot A has 6 cycles, Robot B has 3 cycles
- **Behavior**: Team not eligible for promotion
- **Rationale**: Both robots must meet individual requirements
- **Mitigation**: Clear messaging in UI

**Case 8: Team Dissolved Before Promotion**
- **Scenario**: Team qualifies for promotion, but one robot leaves
- **Behavior**: Promotion cancelled, team dissolved
- **Rationale**: Cannot promote incomplete team
- **Mitigation**: Lock teams during promotion processing

**Case 9: Robot in Multiple Teams**
- **Scenario**: Robot A in Team 1 (1v1) and Team 2 (2v2)
- **Behavior**: Separate league tracking for 1v1 and 2v2
- **Rationale**: 1v1 and 2v2 are independent league systems
- **Implementation**: Tag teams use `TagTeam` model with `tagTeamLeague` and `tagTeamLeagueId` fields

### Timing Edge Cases

**Case 10: Robot Promoted Mid-Cycle**
- **Scenario**: Promotion occurs while robot has scheduled match
- **Behavior**: Complete scheduled matches before promotion
- **Rationale**: Prevents match cancellations
- **Implementation**: Rebalancing runs after battles complete

**Case 11: Multiple Promotions in One Cycle**
- **Scenario**: Robot theoretically qualifies for multiple tiers
- **Behavior**: Only promote one tier per cycle
- **Rationale**: Prevents tier skipping
- **Implementation**: Process one tier change per rebalancing cycle

---

## API Endpoints

### Public Endpoints

**GET /api/robots/:id/promotion-status**
```http
GET /api/robots/123/promotion-status
Authorization: Bearer <user-jwt>

Response:
{
  "robotId": 123,
  "robotName": "Thunder Bolt",
  "currentLeague": "bronze",
  "leagueId": "bronze_1",
  "rank": 1,
  "totalRobots": 47,
  "requirements": {
    "rankRequirement": {
      "met": true,
      "current": 1,
      "needed": 5,
      "percentage": "Top 2%"
    },
    "lpRequirement": {
      "met": true,
      "current": 32,
      "needed": 25,
      "percentage": 128
    },
    "cyclesRequirement": {
      "met": true,
      "current": 8,
      "needed": 5
    }
  },
  "eligible": true,
  "nextTier": "silver",
  "estimatedPromotionCycle": "next",
  "demotionProtection": false
}
```

**GET /api/robots/:id/promotion-history**
```http
GET /api/robots/123/promotion-history
Authorization: Bearer <user-jwt>

Response:
{
  "robotId": 123,
  "robotName": "Thunder Bolt",
  "totalPromotions": 1,
  "totalDemotions": 0,
  "peakLeague": "silver",
  "peakLeagueDate": "2026-02-10T12:00:00Z",
  "history": [
    {
      "id": 456,
      "type": "promotion",
      "fromLeague": "bronze",
      "toLeague": "silver",
      "fromInstance": "bronze_1",
      "toInstance": "silver_2",
      "leaguePoints": 32,
      "elo": 1510,
      "cyclesInTier": 8,
      "rank": 1,
      "totalRobots": 47,
      "createdAt": "2026-02-10T12:00:00Z"
    }
  ]
}
```

**GET /api/leagues/:tier/promotion-cutoffs**
```http
GET /api/leagues/bronze/promotion-cutoffs
Authorization: Bearer <user-jwt>

Response:
{
  "tier": "bronze",
  "instances": [
    {
      "leagueId": "bronze_1",
      "totalRobots": 47,
      "promotionCutoff": {
        "rank": 5,
        "minLP": 25,
        "currentLP": 26,
        "robotName": "Plasma Titan"
      },
      "demotionCutoff": {
        "rank": 43,
        "currentLP": 8,
        "robotName": "Old Fighter"
      }
    },
    {
      "leagueId": "bronze_2",
      "totalRobots": 38,
      "promotionCutoff": {
        "rank": 4,
        "minLP": 25,
        "currentLP": 28,
        "robotName": "Iron Crusher"
      },
      "demotionCutoff": {
        "rank": 35,
        "currentLP": 6,
        "robotName": "Rusty Bot"
      }
    }
  ]
}
```

### Admin Endpoints

**POST /api/admin/leagues/force-promotion**
```http
POST /api/admin/leagues/force-promotion
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "robotId": 123,
  "targetTier": "silver",
  "reason": "Manual adjustment for testing"
}

Response:
{
  "success": true,
  "robot": {
    "id": 123,
    "name": "Thunder Bolt",
    "previousLeague": "bronze",
    "newLeague": "silver",
    "lpRetained": 32
  }
}
```

**GET /api/admin/leagues/promotion-stats**
```http
GET /api/admin/leagues/promotion-stats?days=30
Authorization: Bearer <admin-jwt>

Response:
{
  "period": "30 days",
  "totalPromotions": 145,
  "totalDemotions": 132,
  "byTier": {
    "bronze": { promoted: 45, demoted: 0 },
    "silver": { promoted: 38, demoted: 42 },
    "gold": { promoted: 32, demoted: 38 },
    "platinum": { promoted: 18, demoted: 30 },
    "diamond": { promoted: 12, demoted: 22 },
    "champion": { promoted: 0, demoted: 0 }
  },
  "averageCyclesToPromotion": {
    "bronze": 8.5,
    "silver": 12.3,
    "gold": 15.7,
    "platinum": 18.2,
    "diamond": 22.4
  },
  "yoYoRate": 0.034  // 3.4% promoted then demoted within 5 cycles
}
```

---

## Testing & Validation

### Test Scenarios

**Scenario 1: Standard Promotion**
- Setup: Robot with 32 LP, rank #1 of 50, 8 cycles in bronze_1
- Expected: Promoted to silver, LP retained (32), cycles reset to 0
- Verify: PromotionHistory record created, robot in silver instance

**Scenario 2: Insufficient LP**
- Setup: Robot with 22 LP, rank #2 of 50, 8 cycles in bronze_1
- Expected: Not promoted (LP < 25)
- Verify: Robot remains in bronze_1, no history record

**Scenario 3: Insufficient Cycles**
- Setup: Robot with 30 LP, rank #1 of 50, 3 cycles in bronze_1
- Expected: Not promoted (cycles < 5)
- Verify: Robot remains in bronze_1, no history record

**Scenario 4: Demotion Protection**
- Setup: Recently promoted robot (2 cycles in silver), rank #48 of 50
- Expected: Not demoted (protection active)
- Verify: Robot remains in silver despite bottom 10% rank

**Scenario 5: LP Retention on Demotion**
- Setup: Robot with 15 LP, rank #48 of 50, 8 cycles in silver
- Expected: Demoted to bronze, LP retained (15)
- Verify: Robot in bronze instance with 15 LP

**Scenario 6: 2v2 Team Promotion**
- Setup: Team with 28 Team LP, rank #1 of 30 teams, both robots 6+ cycles
- Expected: Team promoted, both robots moved to new tier
- Verify: Team and both robots in new tier, Team LP retained

**Scenario 7: Instance Full**
- Setup: All silver instances at 100 robots, bronze robot qualifies for promotion
- Expected: New silver instance created (silver_N)
- Verify: Robot promoted to new instance

**Scenario 8: Mass Promotion**
- Setup: 10 robots qualify for promotion from bronze_1 (100 robots)
- Expected: All 10 promoted, distributed across silver instances
- Verify: Silver instances balanced, all robots promoted

### Performance Benchmarks

| Operation | Target | Notes |
|-----------|--------|-------|
| Process promotions (1 instance, 100 robots) | <500ms | Including DB updates |
| Process demotions (1 instance, 100 robots) | <500ms | Including DB updates |
| Complete rebalancing (all instances) | <5s | All tiers, all instances |
| Find best instance | <100ms | Query + calculation |
| Create promotion history | <50ms | Single record |

### Monitoring Metrics

**Key Metrics**:
- Promotion rate per tier (target: 8-12%)
- Demotion rate per tier (target: 8-12%)
- Average cycles to promotion per tier
- Yo-yo rate (promoted then demoted within 5 cycles, target: <5%)
- LP distribution per tier
- Instance population balance

**Alerts**:
- Promotion rate <5% or >15% (indicates imbalance)
- Yo-yo rate >10% (indicates tier instability)
- Instance population >110 or <5 (indicates rebalancing needed)

---

## Implementation Plan

### Phase 1: Core Promotion System ✅ COMPLETE

**Tasks**:
- [x] Implement LP retention logic
- [x] Update promotion algorithm with LP threshold checks (≥25 LP)
- [x] Update demotion algorithm with 5-cycle requirement
- [x] Add `findBestInstance()` helper (via assignLeagueInstance)
- [x] Unit tests for promotion/demotion logic

**Not Implemented** (future enhancements):
- [ ] Add promotion history fields to Robot model
- [ ] Create PromotionHistory model

### Phase 2: Tag Team Support ✅ COMPLETE

**Tasks**:
- [x] Implement tag team promotion algorithm (tagTeamLeagueRebalancingService.ts)
- [x] Same rules as 1v1 (top 10%, ≥25 LP, ≥5 cycles)
- [x] Integration tests for tag team promotions

### Phase 3: API & UI (Future Enhancement)

**Tasks**:
- [ ] Implement GET /api/robots/:id/promotion-status
- [ ] Implement GET /api/robots/:id/promotion-history
- [ ] Implement GET /api/leagues/:tier/promotion-cutoffs
- [ ] Update league standings with promotion zone indicators
- [ ] Create promotion progress component
- [ ] Create promotion/demotion notifications

---

## Success Criteria

### Functional Requirements ✅ COMPLETE

- [x] Robots promoted when meeting all three requirements (rank, LP, cycles)
- [x] LP retained across tier changes
- [x] Demotion protection active (automatic via 5-cycle requirement)
- [x] Instance-based promotion processing
- [x] Tag team promotion working correctly (same rules as 1v1)

**Future Enhancements**:
- [ ] Promotion history tracked in database (PromotionHistory model)
- [ ] API endpoints for promotion status and history
- [ ] UI components for promotion progress

### Quality Requirements ✅ COMPLETE

- [x] Unit test coverage for promotion/demotion logic
- [x] Integration test coverage for promotion scenarios
- [x] No data loss during tier changes
- [x] LP and cycles correctly maintained

**Future Enhancements**:
- [ ] Performance monitoring and metrics
- [ ] Yo-yo rate tracking (<5% target)

### User Experience Requirements (Future Enhancement)

- [ ] Players understand promotion requirements (>90% comprehension)
- [ ] Promotion progress clearly visible
- [ ] Notifications timely and informative
- [ ] Demotion warnings actionable

---

## Future Enhancements

### Short-Term (Next 3 Months)

1. **Dynamic LP Thresholds**: Adjust LP requirements based on tier difficulty
2. **Promotion Streaks**: Bonus rewards for consecutive promotions
3. **Demotion Insurance**: One-time protection item to prevent demotion
4. **Tier Milestones**: Achievements for reaching each tier

### Medium-Term (6 Months)

5. **Seasonal Resets**: Periodic league resets with prestige system
6. **Promotion Tournaments**: Special playoff matches for promotion spots
7. **Cross-Instance Exhibitions**: Preview matches against other instances
8. **Tier Rewards**: Exclusive items/cosmetics for reaching tiers

### Long-Term (12+ Months)

9. **Dynamic Tier System**: Add/remove tiers based on player population
10. **Regional Leagues**: Geographic-based league instances
11. **Team Leagues**: Stable-based team competitions
12. **Grand Championship**: Annual tournament for Champion tier robots

---

## Conclusion

The League Promotion & Demotion System provides meaningful, stable progression through competitive tiers. By retaining LP across tier changes and requiring multiple criteria for promotion, the system prevents yo-yo effects while rewarding consistent performance.

**Key Features**:
- ✅ LP retention for momentum preservation
- ✅ Instance-based competition for fairness
- ✅ Triple requirements (rank + LP + cycles) for stability
- ✅ Automatic demotion protection (via 5-cycle requirement)
- ✅ Tag team support (same rules as 1v1)

**Future Enhancements**:
- Promotion/demotion history tracking
- API endpoints and UI components
- Advanced analytics and metrics
- ✅ 2v2 team support for cooperative play

**Next Steps**:
1. Review and approve PRD
2. Begin Phase 1 implementation
3. Coordinate with PRD_LEAGUE_REBALANCING.md for instance management
4. Update PRD_MATCHMAKING.md with LP-based pairing requirements

---

## Appendices

### Appendix A: LP Threshold Recommendations

**Conservative Approach** (Slower Progression):
- Bronze → Silver: 30 LP
- Silver → Gold: 35 LP
- Gold → Platinum: 40 LP
- Platinum → Diamond: 45 LP
- Diamond → Champion: 50 LP

**Balanced Approach** (Current):
- All tiers: 25 LP

**Aggressive Approach** (Faster Progression):
- Bronze → Silver: 20 LP
- Silver → Gold: 22 LP
- Gold → Platinum: 25 LP
- Platinum → Diamond: 28 LP
- Diamond → Champion: 30 LP

**Recommendation**: Start with balanced (25 LP all tiers), adjust based on data.

### Appendix B: Promotion Rate Analysis

**Target Promotion Rate**: 10% per cycle

**Expected Cycles to Promotion** (assuming consistent top 10% performance):
- Minimum: 5 cycles (eligibility requirement)
- With 25 LP threshold: ~8-10 cycles (need to accumulate LP)
- Average: 10-12 cycles
- Maximum: Unlimited (if never reach top 10% or 25 LP)

**LP Accumulation Rate** (assuming 60% win rate):
- Wins: +3 LP × 0.6 = +1.8 LP/cycle
- Losses: -1 LP × 0.4 = -0.4 LP/cycle
- Net: +1.4 LP/cycle
- Cycles to 25 LP: ~18 cycles

**Conclusion**: 25 LP threshold significantly slows progression, requiring both rank AND sustained performance.

---

**Document End**
