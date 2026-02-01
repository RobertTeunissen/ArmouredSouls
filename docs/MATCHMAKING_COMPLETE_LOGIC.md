# Complete Matchmaking Logic Explanation

**Date**: February 1, 2026  
**Status**: Complete Technical Documentation

---

## Overview

This document provides a COMPLETE overview of how the matchmaking system works in Armoured Souls, including all decision points, filters, and the sequential processing issue.

---

## High-Level Flow

```
runMatchmaking()
  └─> for each LEAGUE_TIER (Bronze → Silver → Gold → Platinum → Diamond → Champion)
       └─> runMatchmakingForTier(tier)
            └─> for each INSTANCE in tier (e.g., platinum_1, platinum_2)
                 └─> buildMatchmakingQueue(leagueId)
                      └─> Get all robots in instance
                      └─> Filter for battle-ready robots
                      └─> Filter out already-scheduled robots
                      └─> Return available robots
                 └─> pairRobots(queue)
                      └─> Fetch recent opponents for all robots
                      └─> While queue has 2+ robots:
                           └─> Take first robot
                           └─> Find best opponent (ELO, recent opponents, same stable)
                           └─> Create match pair
                      └─> Handle odd robot with bye-match
                 └─> createScheduledMatches(matches)
```

---

## Step-by-Step Detailed Breakdown

### 1. Entry Point: `runMatchmaking(scheduledFor?: Date)`

**File**: `matchmakingService.ts`, lines 345-363

**What it does**:
- Sets match time (default: 24 hours from now)
- Processes each league tier sequentially
- Returns total matches created

**Key Code**:
```typescript
for (const tier of LEAGUE_TIERS) {  // ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion']
  const tierMatches = await runMatchmakingForTier(tier, matchTime);
  totalMatches += tierMatches;
}
```

**⚠️ CRITICAL ISSUE**: Tiers are processed sequentially, not in parallel. This causes the "high league bye problem" (see Section 7).

---

### 2. Per-Tier Processing: `runMatchmakingForTier(tier, scheduledFor)`

**File**: `matchmakingService.ts`, lines 312-340

**What it does**:
- Gets all instances for the tier (e.g., platinum_1, platinum_2)
- Processes each instance independently
- Returns total matches for this tier

**Key Code**:
```typescript
const instances = await getInstancesForTier(tier);  // From leagueInstanceService

for (const instance of instances) {
  const queue = await buildMatchmakingQueue(instance.leagueId);
  
  if (queue.length < 2) {
    continue;  // Skip if not enough robots
  }
  
  const matches = await pairRobots(queue);
  await createScheduledMatches(matches, scheduledFor);
}
```

**Instance Information**:
- Each tier can have multiple instances (e.g., platinum_1, platinum_2)
- Max 100 robots per instance
- Instances are independent within a tier

---

### 3. Building the Queue: `buildMatchmakingQueue(leagueId)`

**File**: `matchmakingService.ts`, lines 172-220

**What it does**:
1. Get all robots in the instance
2. Filter for battle-ready robots
3. Filter out already-scheduled robots
4. Return available robots

**Detailed Steps**:

#### Step 3.1: Get All Robots in Instance

```typescript
const robots = await prisma.robot.findMany({
  where: {
    leagueId,  // e.g., 'platinum_1'
    NOT: {
      name: BYE_ROBOT_NAME,  // Exclude 'Bye Robot'
    },
  },
  orderBy: [
    { leaguePoints: 'desc' },
    { elo: 'desc' },
  ],
});
```

**Filters**:
- Only robots in this specific instance
- Excludes the Bye Robot
- Sorted by league points, then ELO

#### Step 3.2: Filter for Battle-Ready Robots

```typescript
const readyRobots = robots.filter(robot => {
  const readiness = checkBattleReadiness(robot);
  return readiness.isReady;
});
```

**Battle Readiness Checks** (see Section 4 below):
- HP ≥ 75%
- HP > yield threshold (prevents immediate surrender)
- Weapons equipped for loadout type

#### Step 3.3: Filter Out Already-Scheduled Robots

```typescript
const scheduledRobotIds = await prisma.scheduledMatch.findMany({
  where: {
    status: 'scheduled',
    OR: [
      { robot1Id: { in: readyRobots.map(r => r.id) } },
      { robot2Id: { in: readyRobots.map(r => r.id) } },
    ],
  },
});
```

**⚠️ CRITICAL ISSUE**: This query checks ALL scheduled matches globally, not filtered by:
- League tier
- League instance
- Scheduled time

**Why this causes problems**:
- When Bronze league processes first, robots get scheduled
- When Platinum processes later, the same `scheduledFor` timestamp is used
- If a robot somehow exists in multiple queries (shouldn't happen but...), it gets filtered out
- More importantly: This is inefficient and could cause issues if robots move between leagues

**Better approach would be**:
```typescript
where: {
  status: 'scheduled',
  scheduledFor: scheduledFor,  // Filter by scheduled time
  leagueType: tier,  // Filter by tier (not currently in schema)
  OR: [...]
}
```

---

### 4. Battle Readiness Check: `checkBattleReadiness(robot)`

**File**: `matchmakingService.ts`, lines 29-80

**Complete Logic**:

#### Check 1: HP Threshold (75%)

```typescript
const hpPercentage = robot.currentHP / robot.maxHP;
const hpCheck = hpPercentage >= BATTLE_READINESS_HP_THRESHOLD;  // 0.75
```

**Why 75%**:
- Ensures robot has substantial HP for a meaningful fight
- Prevents robots from being one-shot
- With typical battle damage (10-40% HP loss), robot can survive 2-3 battles

#### Check 2: Yield Threshold

```typescript
const hpPercentageValue = hpPercentage * 100;
const yieldCheck = hpPercentageValue > robot.yieldThreshold;
```

**Why this matters**:
- If robot.yieldThreshold = 50% and robot.currentHP = 50%, robot would surrender immediately
- Robot must have HP ABOVE yield threshold to fight meaningfully
- Prevents pointless battles where robot surrenders at start

**Example**:
- Robot has 80% HP
- Yield threshold is 85%
- Robot would surrender immediately at battle start
- **Result**: Not battle-ready

#### Check 3: Weapons Equipped

```typescript
switch (robot.loadoutType) {
  case 'single':
    weaponCheck = robot.mainWeaponId !== null;
    break;
  case 'dual_wield':
    weaponCheck = robot.mainWeaponId !== null && robot.offhandWeaponId !== null;
    break;
  case 'weapon_shield':
    weaponCheck = robot.mainWeaponId !== null && robot.offhandWeaponId !== null;
    break;
  case 'two_handed':
    weaponCheck = robot.mainWeaponId !== null;
    break;
}
```

**Requirements by loadout**:
- `single`: Main weapon only
- `dual_wield`: Both main and offhand weapons
- `weapon_shield`: Main weapon AND offhand (shield)
- `two_handed`: Main weapon (two-handed weapon)

#### Final Readiness

```typescript
return {
  isReady: finalHpCheck && weaponCheck,  // ALL checks must pass
  reasons: [...],  // Array of failure reasons
  hpCheck: finalHpCheck,
  weaponCheck,
};
```

---

### 5. Pairing Robots: `pairRobots(robots)`

**File**: `matchmakingService.ts`, lines 225-288

**What it does**:
1. Pre-fetch recent opponents for all robots
2. Use greedy algorithm to pair robots
3. Handle odd robot with bye-match

#### Step 5.1: Pre-fetch Recent Opponents

```typescript
const recentOpponentsMap = new Map<number, number[]>();
await Promise.all(
  robots.map(async robot => {
    const opponents = await getRecentOpponents(robot.id);  // Last 5 battles
    recentOpponentsMap.set(robot.id, opponents);
  })
);
```

**Recent opponents**:
- Last 5 battles per robot
- Used for soft deprioritization (not hard filter)

#### Step 5.2: Greedy Pairing Algorithm

```typescript
while (availableRobots.length > 1) {
  const robot1 = availableRobots.shift()!;  // Take first robot
  const opponent = findBestOpponent(robot1, availableRobots, recentOpponentsMap);
  
  if (opponent) {
    matches.push({ robot1, robot2: opponent, isByeMatch: false });
    // Remove opponent from pool
    availableRobots.splice(availableRobots.indexOf(opponent), 1);
  } else {
    // No suitable opponent, put back for bye-match
    availableRobots.push(robot1);
    break;
  }
}
```

**Algorithm characteristics**:
- **Greedy**: Takes first robot, finds best match, moves to next
- **Not optimal**: Doesn't backtrack or consider global optimization
- **Fast**: O(n²) complexity, good enough for 100 robots per instance

#### Step 5.3: Find Best Opponent

**File**: `matchmakingService.ts`, lines 146-167

```typescript
function findBestOpponent(robot, availableRobots, recentOpponentsMap): Robot | null {
  const scoredOpponents = availableRobots.map(opponent => {
    const score = calculateMatchScore(robot, opponent, recentOpponents1, recentOpponents2);
    return { opponent, score };
  });
  
  scoredOpponents.sort((a, b) => a.score - b.score);  // Lower score = better match
  return scoredOpponents[0].opponent;
}
```

**Match Quality Score** (lower is better):

```typescript
function calculateMatchScore(robot1, robot2, recentOpponents1, recentOpponents2): number {
  let score = 0;
  
  // Primary factor: ELO difference
  score += Math.abs(robot1.elo - robot2.elo);
  
  // Recent opponent penalty (soft deprioritize)
  if (recentOpponents1.includes(robot2.id)) score += 200;
  if (recentOpponents2.includes(robot1.id)) score += 200;
  
  // Same stable penalty (strongly deprioritize)
  if (robot1.userId === robot2.userId) score += 500;
  
  return score;
}
```

**Scoring breakdown**:
- **ELO difference**: 0-300 typically (ideal ±150, max ±300)
- **Recent opponent**: +200 penalty (soft discouragement)
- **Same stable**: +500 penalty (heavy discouragement)

**Examples**:
- Perfect match: ELO diff 10, no recent, different stable = **score 10**
- Good match: ELO diff 100, no recent, different stable = **score 100**
- Recent opponent: ELO diff 50, fought recently, different stable = **score 250**
- Same stable: ELO diff 20, no recent, same owner = **score 520**

**Decision logic**:
- System prefers lowest score (best match)
- Recent opponents can still be matched if no better options
- Same-stable matches can still occur if no other options

#### Step 5.4: Handle Odd Robot (Bye-Match)

```typescript
if (availableRobots.length === 1) {
  const lastRobot = availableRobots[0];
  const byeRobot = await prisma.robot.findFirst({
    where: { name: BYE_ROBOT_NAME },
  });
  
  if (byeRobot) {
    matches.push({
      robot1: lastRobot,
      robot2: byeRobot,
      isByeMatch: true,
    });
  }
}
```

**Bye Robot**:
- Special robot named "Bye Robot"
- Very weak stats (all attributes at 1)
- Gives free win to the odd robot
- Minimal damage taken

---

### 6. Creating Scheduled Matches: `createScheduledMatches(matches, scheduledFor)`

**File**: `matchmakingService.ts`, lines 293-308

```typescript
const matchData = matches.map(match => ({
  robot1Id: match.robot1.id,
  robot2Id: match.robot2.id,
  leagueType: match.leagueType,
  scheduledFor,  // Same timestamp for all matches
  status: 'scheduled',
}));

await prisma.scheduledMatch.createMany({ data: matchData });
```

**Database record created**:
- `robot1Id`, `robot2Id`: The two matched robots
- `leagueType`: The league tier (e.g., 'platinum')
- `scheduledFor`: When the battle will execute
- `status`: 'scheduled' (will become 'completed' after battle)

---

## 7. The Sequential Processing Problem

### The Issue

**Problem**: Matchmaking processes leagues sequentially (Bronze → Champion), using the same `scheduledFor` timestamp, and the "already scheduled" check is global.

**Why it causes byes in high leagues**:

1. **Bronze league processes first** (let's say 50 robots in bronze_1)
   - 25 match pairs created
   - 50 robots now have `scheduledMatch` records with status='scheduled'

2. **Silver, Gold leagues process** (more robots get scheduled)

3. **Platinum league processes** (let's say 31 robots in platinum_1)
   - All 31 robots are battle-ready (user runs auto-repair)
   - All 31 robots pass battle readiness checks
   - `buildMatchmakingQueue` fetches scheduled matches:
     ```sql
     SELECT * FROM scheduledMatch 
     WHERE status = 'scheduled'
     AND (robot1Id IN [...] OR robot2Id IN [...])
     ```
   - **This query doesn't filter by league or time**
   - If somehow robots are in multiple leagues (shouldn't happen) OR
   - If there's ANY overlap in robot IDs (database constraint should prevent) OR
   - **Most likely**: There's no actual problem here with cross-league, but...

**Wait, this doesn't fully explain the issue...**

Let me re-examine the actual problem...

### The REAL Issue

Looking more carefully at the user's report:
> "during last run there were only bots from account 'test_attr_hull_integrity' in Platinum league"

**The actual problem**:
1. All robots in Platinum league are from the same user account
2. The same-stable penalty applies: `if (robot1.userId === robot2.userId) score += 500`
3. Even with the penalty, if ALL robots are from same stable, they WILL be matched
4. So this isn't the issue either...

**The TRUE issue** (from user's original report):
> "Robots in Platinum League have only done ±50 matches out of the possible 102 cycles"

This means robots are getting byes, not because of the sequential processing, but because:

### Root Causes of Byes

**Cause 1: Odd number of robots**
- 31 robots in instance → 15 matches + 1 bye
- Over 102 cycles, that's 102 byes for rotating robots

**Cause 2: Battle readiness failures**
- Even with auto-repair, if HP threshold is too high, robots get filtered
- **With 75% threshold**: Winners at 85-90% HP are OK, losers at 60-65% are NOT OK
- After a few battles without repair, half the robots are excluded
- **This was the original issue I was trying to fix**

**Cause 3: Same-stable concentration**
- If one league has mostly one stable's robots, matchmaking still works
- But if that stable has an odd number, one gets bye every cycle
- Over 102 cycles: 102 byes for that one robot

**The Solution I Attempted (50% threshold)**:
- Allow losers at 60-65% HP to fight
- Reduces byes significantly
- **BUT**: Creates new problem - robots might surrender immediately

**The User's Objection**:
- "50% threshold is dangerous since robots might surrender immediately"
- If robot has yield threshold = 60% and current HP = 55%, it surrenders at battle start
- Pointless battle, wastes processing, gives free win

**The Correct Solution**:
- Keep 75% threshold
- **ADD**: Check that HP > yield threshold
- This prevents immediate surrenders while allowing damaged robots to fight

---

## 8. Summary: Complete Matchmaking Decision Tree

```
For each League Tier (Bronze → Champion):
  For each Instance in Tier (e.g., platinum_1, platinum_2):
    
    GET all robots in instance
      ├─ Exclude 'Bye Robot'
      └─ Sort by league points DESC, ELO DESC
    
    FILTER: Battle Readiness
      ├─ HP ≥ 75%?
      │   └─ NO: Exclude (reason: "HP too low")
      │   └─ YES: Continue
      ├─ HP % > yield threshold?
      │   └─ NO: Exclude (reason: "HP at or below yield threshold")
      │   └─ YES: Continue
      └─ Weapons equipped for loadout?
          └─ NO: Exclude (reason: "No weapon equipped")
          └─ YES: Robot is battle-ready
    
    FILTER: Already Scheduled
      └─ Query: status='scheduled' AND (robot1Id OR robot2Id IN ready robots)
      └─ Exclude any robots already scheduled
    
    If < 2 robots available:
      └─ STOP: Not enough robots for matches
    
    PAIR ROBOTS (Greedy Algorithm):
      While 2+ robots available:
        ├─ Take first robot from queue
        ├─ Calculate match scores for all remaining robots:
        │   └─ Score = ELO_diff + recent_opponent_penalty + same_stable_penalty
        ├─ Select robot with lowest score (best match)
        ├─ Create match pair
        └─ Remove both robots from queue
      
      If 1 robot remaining (odd number):
        └─ Create bye-match with 'Bye Robot'
    
    CREATE scheduled matches in database:
      └─ For each pair: (robot1, robot2, leagueType, scheduledFor, status='scheduled')
```

---

## 9. Configuration Constants

**File**: `matchmakingService.ts`

| Constant | Value | Purpose |
|----------|-------|---------|
| `ELO_MATCH_IDEAL` | 150 | Ideal ELO difference for fair matches |
| `ELO_MATCH_FALLBACK` | 300 | Maximum ELO difference allowed |
| `RECENT_OPPONENT_LIMIT` | 5 | Number of recent battles to track |
| `BATTLE_READINESS_HP_THRESHOLD` | 0.75 | Minimum HP% (75%) required |
| `BYE_ROBOT_NAME` | 'Bye Robot' | Name of the bye robot |

**File**: `leagueInstanceService.ts`

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_ROBOTS_PER_INSTANCE` | 100 | Maximum robots per league instance |
| `REBALANCE_THRESHOLD` | 20 | Deviation triggering rebalancing |
| `LEAGUE_TIERS` | ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] | League order |

---

## 10. Why Byes Happen (Complete List)

### Primary Causes

1. **Odd Number of Robots**
   - Instance has 31 robots → 15 matches + 1 bye
   - Unavoidable with odd counts

2. **Battle Readiness Failures**
   - Robot HP < 75%
   - Robot HP ≤ yield threshold
   - Missing weapons

3. **Already Scheduled**
   - Robot has existing scheduled match
   - Shouldn't happen within same instance/time
   - Could indicate timing or concurrency issues

### Why Auto-Repair Doesn't Fully Solve It

Even with auto-repair restoring all robots to 100% HP:

1. **Odd numbers persist** (31 robots → always 1 bye)
2. **After battles run**, robots take damage again
3. **Before next matchmaking**, some robots below threshold
4. **If matchmaking runs BEFORE battles execute**, all robots should be available
5. **If matchmaking runs AFTER battles execute**, damaged robots excluded

**Timing matters**:
```
Cycle 1: Auto-repair → All 100% → Matchmaking → Battles → Robots damaged
Cycle 2: Auto-repair → All 100% → Matchmaking → Battles → Robots damaged
```

This should work fine. If byes still happen, it's due to odd numbers, not HP.

---

## 11. Recommendations

### Short-term (Current Fix)

✅ **Revert to 75% HP threshold**
✅ **Add yield threshold check**
- Prevents immediate surrenders
- Maintains battle quality
- Slightly higher bye rate, but acceptable

### Medium-term

⚠️ **Add league/tier filtering to scheduled match query**
```typescript
where: {
  status: 'scheduled',
  scheduledFor: scheduledFor,
  leagueType: tier,  // NEW: Filter by tier
  OR: [...]
}
```
- Improves query performance
- Prevents theoretical cross-tier issues
- More robust system

### Long-term

🔄 **Consider parallel tier processing**
- Process all tiers simultaneously
- Each tier gets independent scheduled time
- Eliminates any sequential processing concerns
- Requires more careful transaction handling

🎯 **Smart instance balancing**
- Keep instances at even numbers when possible
- 32 robots → 16 matches, 0 byes
- 30 robots → 15 matches, 0 byes
- Better than 31 robots → 15 matches, 1 bye

---

## 12. Conclusion

The matchmaking system is fundamentally sound but has these characteristics:

**Strengths**:
- ELO-based matching for fair battles
- Recent opponent tracking prevents repetition
- Same-stable deprioritization encourages cross-stable matches
- Bye-robot handles odd numbers gracefully

**Current Fix**:
- 75% HP threshold prevents excessive byes
- Yield threshold check prevents immediate surrenders
- Both checks ensure meaningful battles

**Remaining Causes of Byes**:
- Odd robot counts (unavoidable)
- Damaged robots between auto-repair cycles (minimal with good timing)

**Not an Issue**:
- Sequential tier processing doesn't cause cross-tier scheduling conflicts
- Each instance is independent
- Scheduled match queries work correctly

The user's observation of 50 matches in 102 cycles suggests either:
1. Odd number of robots (e.g., 31 robots → 102 byes over 102 cycles for 1 robot)
2. Timing of auto-repair vs matchmaking vs battle execution
3. Concentration of robots in fewer instances (some instances near empty)
