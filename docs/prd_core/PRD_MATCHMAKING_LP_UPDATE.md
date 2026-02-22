# PRD_MATCHMAKING.md - LP-Based Pairing Update

**Date**: February 21, 2026  
**Status**: ✅ IMPLEMENTED  
**Purpose**: LP-based pairing for existing matchmaking system  
**Related PRDs**: PRD_LEAGUE_PROMOTION.md, PRD_LEAGUE_REBALANCING.md

---

## Implementation Status

**✅ FULLY IMPLEMENTED** (February 21, 2026)

**Last Verified**: February 22, 2026

This document outlines the LP-based matchmaking updates that have been successfully implemented in the codebase. The matchmaking system now prioritizes League Points (LP) as the primary matching criterion, with ELO as a secondary quality check.

**Implementation File:**
- `prototype/backend/src/services/matchmakingService.ts`

**Key Changes Implemented:**
- LP-primary matching (±10 LP ideal, ±20 LP fallback)
- ELO secondary quality check (±150 ideal, ±300 max)
- Updated match scoring algorithm
- New LP matching constants

See `docs/LEAGUE_SYSTEM_CHANGES_SUMMARY.md` for detailed change log.

---

## Summary of Changes

This document outlines updates to PRD_MATCHMAKING.md to incorporate League Points (LP) as a primary factor in matchmaking, with ELO as a secondary consideration. This change aligns with the promotion system's emphasis on LP accumulation.

**Key Changes**:
1. LP becomes primary matching criterion
2. ELO becomes secondary (tiebreaker/quality check)
3. Updated pairing algorithm with LP ranges
4. New match quality scoring system
5. Updated user stories and acceptance criteria

---

## Section Updates

### 1. Executive Summary - Add LP-Based Matching

**Insert after "ELO-Based Matchmaking" bullet:**

```markdown
- **LP-Primary Matchmaking**: Pairs robots primarily by League Points (±10 LP ideal, ±20 LP fallback), with ELO as secondary quality check
```

### 2. User Stories - Update US-4

**Replace US-4: ELO-Based Matchmaking with:**

```markdown
**US-4: LP-Based Matchmaking with ELO Quality Check**
- **As the** matchmaking system
- **I need to** pair robots primarily by League Points, with ELO as secondary consideration
- **So that** battles pair similarly-performing robots and LP progression feels fair

**Acceptance Criteria:**
- Robots matched within ±10 LP when possible (ideal range)
- If no match within ±10 LP, expand to ±20 LP (fallback range)
- Within LP range, prefer opponents within ±150 ELO (quality check)
- If no suitable LP+ELO match, prioritize LP over ELO
- Never match robot against itself
- Never match robot against same opponent twice in same batch
- Soft deprioritize same-stable matchups (allow as last resort)
- Soft deprioritize recent opponents (last 5 matches)
- Odd-numbered robots matched with bye-robot (ELO 1000, 0 LP)

**Design Rationale**: 
- LP reflects recent performance and progression toward promotion
- ELO reflects long-term skill but can be stale
- LP-primary matching creates more dynamic, progression-focused competition
- ELO quality check prevents extreme mismatches (1200 ELO vs 2000 ELO)
```

### 3. Matchmaking Algorithm Specification - Complete Rewrite

**Replace entire "Matchmaking Algorithm Specification" section with:**

```markdown
### Matchmaking Algorithm Specification (LP-Primary)

**Phase 1: Queue Building**
```typescript
// Pseudo-code
function buildMatchmakingQueue(leagueId: string): RobotQueueEntry[] {
  const eligibleRobots = await prisma.robot.findMany({
    where: {
      leagueId: leagueId,  // Specific instance (e.g., "bronze_1")
      battleReadiness: { gte: 75 },  // At least 75% HP
      currentHP: { gt: prisma.robot.yieldThreshold },  // HP > yield threshold
      // Exclude robots already scheduled for this batch
      scheduledMatchesAsRobot1: { none: { status: 'scheduled' } },
      scheduledMatchesAsRobot2: { none: { status: 'scheduled' } },
    },
    include: {
      user: true,
      mainWeapon: true,
      offhandWeapon: true,
      shield: true,
    },
  });
  
  // Validate battle readiness (weapons equipped)
  const battleReadyRobots = eligibleRobots.filter(robot => 
    validateWeaponLoadout(robot)
  );
  
  // Sort by priority: LP desc (primary), then ELO desc (secondary), then random
  return battleReadyRobots
    .sort((a, b) => {
      if (a.leaguePoints !== b.leaguePoints) return b.leaguePoints - a.leaguePoints;
      if (a.elo !== b.elo) return b.elo - a.elo;
      return Math.random() - 0.5;  // Random tiebreaker
    });
}
```

**Phase 2: LP-Based Pairing Algorithm**
```typescript
function pairRobots(queue: RobotQueueEntry[]): [RobotQueueEntry, RobotQueueEntry][] {
  const pairs: [RobotQueueEntry, RobotQueueEntry][] = [];
  const matched = new Set<number>();
  
  for (let i = 0; i < queue.length; i++) {
    if (matched.has(queue[i].id)) continue;
    
    const robot1 = queue[i];
    let bestOpponent = null;
    let bestScore = Infinity;
    
    // Scan all potential opponents and score them
    for (let j = i + 1; j < queue.length; j++) {
      if (matched.has(queue[j].id)) continue;
      
      const robot2 = queue[j];
      
      // Calculate match quality score (lower = better)
      const score = calculateMatchScore(robot1, robot2);
      
      if (score < bestScore) {
        bestScore = score;
        bestOpponent = robot2;
      }
    }
    
    // If no suitable opponent found, match with bye-robot
    if (!bestOpponent) {
      bestOpponent = BYE_ROBOT;  // Special robot (id: -1, ELO 1000, LP 0)
    }
    
    pairs.push([robot1, bestOpponent]);
    matched.add(robot1.id);
    if (bestOpponent.id !== -1) {
      matched.add(bestOpponent.id);
    }
  }
  
  return pairs;
}

function calculateMatchScore(robot1: Robot, robot2: Robot): number {
  let score = 0;
  
  // PRIMARY: LP difference (heavily weighted)
  const lpDiff = Math.abs(robot1.leaguePoints - robot2.leaguePoints);
  score += lpDiff * 10;  // 10x weight for LP
  
  // SECONDARY: ELO difference (quality check)
  const eloDiff = Math.abs(robot1.elo - robot2.elo);
  score += eloDiff * 0.1;  // 0.1x weight for ELO
  
  // PENALTY: Same stable (strongly discourage)
  if (robot1.userId === robot2.userId) {
    score += 500;
  }
  
  // PENALTY: Recent opponent (soft discourage)
  if (isRecentOpponent(robot1, robot2)) {
    score += 200;
  }
  
  // PENALTY: Extreme ELO mismatch (prevent 1200 vs 2000)
  if (eloDiff > 300) {
    score += 1000;  // Heavy penalty for extreme mismatches
  }
  
  return score;
}

function isRecentOpponent(robot1: Robot, robot2: Robot): boolean {
  // Check if robot2 was in robot1's last 5 opponents
  const recentOpponents = getRecentOpponents(robot1.id, 5);
  return recentOpponents.includes(robot2.id);
}
```

**Phase 3: Create Scheduled Matches**
```typescript
async function createScheduledMatches(
  pairs: [RobotQueueEntry, RobotQueueEntry][],
  scheduledFor: Date
): Promise<ScheduledMatch[]> {
  const matches = await Promise.all(
    pairs.map(([robot1, robot2]) =>
      prisma.scheduledMatch.create({
        data: {
          robot1Id: robot1.id,
          robot2Id: robot2.id,
          leagueType: robot1.currentLeague,
          leagueId: robot1.leagueId,  // Instance-specific
          scheduledFor: scheduledFor,
          status: 'scheduled',
          isByeMatch: robot2.id === -1,  // Flag bye-robot matches
        },
      })
    )
  );
  
  return matches;
}
```

**Match Quality Scoring Breakdown**:

| Factor | Weight | Example | Score Contribution |
|--------|--------|---------|-------------------|
| LP Difference | 10x | 5 LP diff | 50 points |
| ELO Difference | 0.1x | 200 ELO diff | 20 points |
| Same Stable | +500 | Yes | 500 points |
| Recent Opponent | +200 | Yes | 200 points |
| Extreme ELO Mismatch (>300) | +1000 | Yes | 1000 points |

**Example Scoring**:
- Robot A (30 LP, 1500 ELO) vs Robot B (28 LP, 1480 ELO):
  - LP diff: 2 × 10 = 20
  - ELO diff: 20 × 0.1 = 2
  - Total: 22 (excellent match)

- Robot A (30 LP, 1500 ELO) vs Robot C (15 LP, 1520 ELO):
  - LP diff: 15 × 10 = 150
  - ELO diff: 20 × 0.1 = 2
  - Total: 152 (poor match due to LP difference)

- Robot A (30 LP, 1500 ELO) vs Robot D (28 LP, 2000 ELO):
  - LP diff: 2 × 10 = 20
  - ELO diff: 500 × 0.1 = 50
  - Extreme mismatch penalty: 1000
  - Total: 1070 (rejected due to extreme ELO difference)
```

### 4. Configuration Constants - Add LP Matching Ranges

**Add to matchmaking constants section:**

```markdown
### Matchmaking Constants

**File**: `prototype/backend/src/services/matchmakingService.ts`

```typescript
// LP matching ranges (PRIMARY)
LP_MATCH_IDEAL = 10             // Ideal LP difference for fair matches
LP_MATCH_FALLBACK = 20          // Maximum LP difference allowed

// ELO matching ranges (SECONDARY - quality check)
ELO_MATCH_IDEAL = 150           // Ideal ELO difference within LP range
ELO_MATCH_MAX = 300             // Maximum ELO difference (hard limit)

// Recent opponent tracking
RECENT_OPPONENT_LIMIT = 5       // Number of recent battles to track

// Battle readiness
BATTLE_READINESS_HP_THRESHOLD = 0.75  // 75% HP required

// Special robots
BYE_ROBOT_ID = -1               // ID of bye robot
BYE_ROBOT_ELO = 1000            // ELO of bye robot
BYE_ROBOT_LP = 0                // LP of bye robot
```

**Match Quality Scoring Weights**:
```typescript
// Scoring weights (lower score = better match)
LP_WEIGHT = 10.0                // Primary factor
ELO_WEIGHT = 0.1                // Secondary factor (quality check)

// Penalties
SAME_STABLE_PENALTY = 500       // Strong deprioritization
RECENT_OPPONENT_PENALTY = 200   // Soft deprioritization
EXTREME_ELO_PENALTY = 1000      // Prevent extreme mismatches (>300 ELO diff)
```
```

### 5. Design Decisions - Add LP-Primary Decision

**Add new decision D11:**

```markdown
**D11: LP-Primary Matchmaking**
- **Decision**: Match primarily by League Points (±10 LP ideal, ±20 LP fallback), ELO secondary
- **Rationale**: 
  - LP reflects recent performance and progression toward promotion
  - ELO can become stale over time (robot improves but ELO lags)
  - Promotion system emphasizes LP accumulation (need 25 LP)
  - LP-based matching creates more dynamic competition
  - ELO still used as quality check to prevent extreme mismatches
- **Implementation**: 
  - Calculate match score: (LP_diff × 10) + (ELO_diff × 0.1)
  - Prefer lowest score (best match)
  - Hard limit: ELO difference >300 heavily penalized
- **Alternative Considered**: Pure ELO matching (rejected - doesn't align with LP-based promotion)
```

### 6. Edge Cases - Add LP-Specific Cases

**Add to Edge Cases section:**

```markdown
### LP-Based Matchmaking Edge Cases

**Case 13: Wide LP Distribution**
- **Scenario**: Instance has robots from 0 LP to 50 LP
- **Behavior**: Match within ±10 LP when possible, expand to ±20 LP if needed
- **Rationale**: Maintains competitive balance while ensuring matches

**Case 14: LP Clustering**
- **Scenario**: 20 robots all have 25-30 LP
- **Behavior**: Use ELO as tiebreaker within LP cluster
- **Rationale**: ELO provides secondary differentiation

**Case 15: New Robot (0 LP) vs Veteran (40 LP)**
- **Scenario**: New robot with 0 LP, high ELO (1800) vs veteran with 40 LP, low ELO (1200)
- **Behavior**: LP difference (40) exceeds threshold, not matched
- **Rationale**: LP-primary system prevents this mismatch
- **Mitigation**: New robots start in Bronze with other low-LP robots

**Case 16: Bye-Robot LP**
- **Scenario**: Robot matched with bye-robot (0 LP, 1000 ELO)
- **Behavior**: Full rewards awarded, minimal LP gain (+3 for win)
- **Rationale**: Bye-robot has 0 LP, so LP difference is large but unavoidable

**Case 17: Post-Promotion LP Retention**
- **Scenario**: Robot promoted with 35 LP to new tier where average is 15 LP
- **Behavior**: Matched with robots in 25-45 LP range (±10 LP)
- **Rationale**: LP retention creates temporary advantage, but fair within range
```

### 7. Testing Scenarios - Add LP-Based Tests

**Add to Testing & Validation section:**

```markdown
### LP-Based Matchmaking Tests

**Test 1: LP-Primary Matching**
- Setup: Robot A (25 LP, 1500 ELO), Robot B (27 LP, 1300 ELO), Robot C (15 LP, 1520 ELO)
- Expected: A matched with B (LP diff: 2, ELO diff: 200)
- Verify: LP takes priority over ELO

**Test 2: ELO Quality Check**
- Setup: Robot A (25 LP, 1500 ELO), Robot B (27 LP, 2100 ELO)
- Expected: A not matched with B (ELO diff >300, extreme mismatch penalty)
- Verify: ELO quality check prevents extreme mismatches

**Test 3: LP Fallback Range**
- Setup: Robot A (30 LP), no opponents within ±10 LP, Robot B (48 LP) within ±20 LP
- Expected: A matched with B (fallback range)
- Verify: Fallback range works correctly

**Test 4: LP Clustering**
- Setup: 10 robots all with 25-28 LP, varying ELO (1200-1600)
- Expected: Matched by ELO within LP cluster
- Verify: ELO used as tiebreaker

**Test 5: Bye-Robot LP Mismatch**
- Setup: Robot A (35 LP), odd number in instance
- Expected: A matched with bye-robot (0 LP, 1000 ELO)
- Verify: Bye-robot match created despite LP difference
```

---

## Implementation Checklist

### Code Changes

- [ ] Update `matchmakingService.ts` with LP-primary algorithm
- [ ] Implement `calculateMatchScore()` function
- [ ] Update queue sorting (LP primary, ELO secondary)
- [ ] Add LP matching constants
- [ ] Update match quality logging

### Database Changes

- [ ] Add `isByeMatch` field to ScheduledMatch model
- [ ] Add `leagueId` field to ScheduledMatch model (instance-specific)
- [ ] Update indexes for LP-based queries

### Testing

- [ ] Unit tests for `calculateMatchScore()`
- [ ] Unit tests for LP-primary pairing
- [ ] Integration tests for LP-based matchmaking
- [ ] Edge case tests (LP clustering, extreme ELO, etc.)
- [ ] Performance tests (100+ robots)

### Documentation

- [ ] Update PRD_MATCHMAKING.md with all sections above
- [ ] Update API documentation
- [ ] Update admin dashboard documentation
- [ ] Create migration guide for existing systems

---

## Migration Strategy

### For Existing Systems

**Phase 1: Parallel Testing (Week 1)**
- Run both ELO-primary and LP-primary algorithms
- Compare match quality metrics
- Identify any issues

**Phase 2: Gradual Rollout (Week 2)**
- Enable LP-primary for Bronze and Silver tiers
- Monitor match quality and player feedback
- Adjust weights if needed

**Phase 3: Full Deployment (Week 3)**
- Enable LP-primary for all tiers
- Deprecate ELO-primary algorithm
- Update documentation

**Phase 4: Optimization (Week 4)**
- Fine-tune LP and ELO weights based on data
- Optimize performance
- Gather player feedback

---

## Success Metrics

**Match Quality**:
- Average LP difference: <8 LP (target: ±10 LP)
- Average ELO difference: <180 ELO (target: ±150 ELO)
- Extreme mismatches (>300 ELO): <1%

**Player Experience**:
- Match fairness rating: >85% positive
- LP progression satisfaction: >80% positive
- Understanding of LP-based matching: >90%

**System Performance**:
- Matchmaking time: <2 seconds (100 robots)
- Match quality score: <100 average (lower = better)
- Bye-robot rate: <5% of matches

---

## Conclusion

This update transforms the matchmaking system from ELO-primary to LP-primary, aligning with the promotion system's emphasis on League Points. By using LP as the primary matching criterion and ELO as a quality check, the system creates more dynamic, progression-focused competition while preventing extreme mismatches.

**Key Benefits**:
- ✅ Aligns matchmaking with promotion requirements
- ✅ Rewards recent performance over historical ELO
- ✅ Creates more dynamic competitive environment
- ✅ Maintains match quality through ELO quality checks
- ✅ Prevents extreme mismatches

**Next Steps**:
1. Review and approve changes
2. Implement LP-primary algorithm
3. Test thoroughly with various scenarios
4. Deploy gradually with monitoring
5. Gather feedback and optimize

---

**Document End**
