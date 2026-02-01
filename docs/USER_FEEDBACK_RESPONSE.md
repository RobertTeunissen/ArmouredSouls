# Response to User Feedback - Matchmaking Analysis

**Date**: February 1, 2026  
**Issue**: Matchmaking byes and battle readiness concerns

---

## Your Feedback

> "Your changes regarding matchmaking byes are not correct. Especially the 50% threshold is dangerous since robots might be battle ready but based on their yield threshold surrender immediately at the start of battle."

**✅ You were absolutely correct.** I've reverted the 50% threshold and implemented a proper fix.

---

## What Was Wrong

### My Initial (Incorrect) Change
- Lowered HP threshold from 75% → 50%
- Goal: Reduce byes by allowing damaged robots to fight
- **Problem**: Didn't check yield threshold

### The Danger
- Robot with 55% HP and 60% yield threshold → would surrender immediately at battle start
- Robot with 52% HP and 52% yield threshold → instant surrender
- Created pointless battles, wasted processing, gave free wins

---

## The Correct Fix

### What I Changed
```typescript
// File: matchmakingService.ts

// 1. REVERTED HP threshold to 75% (original value)
export const BATTLE_READINESS_HP_THRESHOLD = 0.75;

// 2. ADDED yield threshold check
const hpPercentageValue = hpPercentage * 100;
const yieldCheck = hpPercentageValue > robot.yieldThreshold;

if (!yieldCheck) {
  reasons.push(`HP (${Math.floor(hpPercentageValue)}%) at or below yield threshold (${robot.yieldThreshold}%)`);
}

// 3. Both checks must pass
const finalHpCheck = hpCheck && yieldCheck;
```

### Battle Readiness Now Requires
1. ✅ HP ≥ 75% (prevents one-shot robots)
2. ✅ HP > yield threshold (NEW - prevents immediate surrender)
3. ✅ Weapons equipped (based on loadout type)

### Examples
| Robot HP | Yield Threshold | Result | Reason |
|----------|-----------------|--------|--------|
| 100% | 10% | ✅ Ready | HP well above both thresholds |
| 80% | 10% | ✅ Ready | HP above both thresholds |
| 80% | 85% | ❌ Not Ready | Would surrender immediately |
| 70% | 10% | ❌ Not Ready | Below 75% HP threshold |
| 55% | 60% | ❌ Not Ready | Would surrender immediately |

---

## Complete Matchmaking Logic Documentation

> "I want to know the rules for matchmaking. Provide me the TOTAL overview for the logic of matchmaking. Tell me how it's implemented."

I've created a comprehensive 450+ line document: **`docs/MATCHMAKING_COMPLETE_LOGIC.md`**

### Key Points from Documentation

#### 1. Sequential Processing (Your Hunch)
You were right about sequential processing:
```typescript
for (const tier of LEAGUE_TIERS) {  // Bronze → Silver → Gold → Platinum → Diamond → Champion
  runMatchmakingForTier(tier, matchTime);
}
```

**However**, this is NOT causing the bye problem because:
- Each league instance is independent
- Robots can't be in multiple leagues simultaneously
- The "already scheduled" check works correctly per instance
- Same `scheduledFor` timestamp is used, but queries filter correctly

#### 2. Complete Matchmaking Flow

```
For Each League Tier (Bronze → Champion):
  For Each Instance (e.g., platinum_1):
    
    Step 1: Get all robots in instance
      - Exclude 'Bye Robot'
      - Sort by league points, then ELO
    
    Step 2: Filter for battle-ready robots
      - HP ≥ 75%
      - HP > yield threshold (NEW)
      - Weapons equipped
    
    Step 3: Filter out already-scheduled robots
      - Check scheduledMatch table
      - Exclude robots with existing matches
    
    Step 4: Pair robots using greedy algorithm
      - Score = ELO_diff + recent_opponent_penalty + same_stable_penalty
      - Best match = lowest score
      - Pair until queue exhausted
    
    Step 5: Handle odd robot
      - Create bye-match with 'Bye Robot'
```

#### 3. Why Byes Actually Happen

With auto-repair before matchmaking:

**Primary Cause: Odd Robot Counts**
- 31 robots in platinum_1 → 15 matches + 1 bye
- That one robot gets bye-match every cycle
- Over 102 cycles: 102 byes for rotating robots
- **This is unavoidable**

**Secondary Cause: High Yield Thresholds**
- Robots with yield threshold >75% need >75% HP to participate
- If robot has 80% yield threshold, needs 81%+ HP
- With typical battle damage (10-15% per win), might fall below
- Gets excluded until next auto-repair

**Not the Cause: Sequential Processing**
- Detailed analysis in documentation shows this doesn't create cross-tier issues
- Each tier/instance processes independently
- No robots get "stolen" by earlier tiers

#### 4. Your Specific Case: "Only bots from test_attr_hull_integrity in Platinum"

If all robots in Platinum are from the same account (`test_attr_hull_integrity`):

- Same-stable penalty applies: `+500 to match score`
- But they WILL still be matched with each other
- Same-stable penalty doesn't prevent matches, just deprioritizes
- So this shouldn't cause extra byes

The ~50% participation rate suggests:
1. Odd number of robots (most likely)
2. Some robots have high yield thresholds (>75%)
3. Timing: if matchmaking runs after battles instead of after auto-repair

#### 5. Match Quality Scoring

```typescript
score = ELO_difference + recent_opponent_penalty + same_stable_penalty

// ELO difference: 0-300 (ideal ±150, max ±300)
// Recent opponent: +200 if fought in last 5 battles
// Same stable: +500 if same owner
```

**System always matches robots with lowest score** (best match available)

---

## Testing & Validation

### Tests Updated
- ✅ Reverted to 75% HP threshold tests
- ✅ Added yield threshold check tests
- ✅ Test for robot at 80% HP with 80% yield (should be excluded)
- ✅ All tests passing

### Security
- ✅ Code review: No issues
- ✅ CodeQL scan: 0 alerts

---

## Summary of All Balance Changes

While fixing matchmaking, I also addressed the other balance issues you reported:

### 1. Hull Integrity Scaling
- Changed from `maxHP = hull × 10` to `maxHP = 30 + (hull × 8)`
- Starting robots: 10 HP → 38 HP (+280%)
- Max level robots: 500 HP → 430 HP (-14%)
- Reduces dominance while making starting robots viable

### 2. Armor Plating Cap
- Added `MAX_ARMOR_REDUCTION = 30`
- High armor still valuable but can't completely negate attacks
- Prevents unkillable tanks

### 3. Matchmaking (Fixed Correctly)
- Kept 75% HP threshold
- Added yield threshold check
- Prevents immediate surrenders
- Maintains battle quality

---

## Recommendations

### For Reducing Byes

1. **Balance robot counts to even numbers**
   - 32 robots → 16 matches, 0 byes
   - 30 robots → 15 matches, 0 byes
   - Better than 31 robots → 15 matches, 1 bye every cycle

2. **Run auto-repair BEFORE matchmaking**
   - Ensures all robots at 100% HP
   - Minimizes yield threshold issues
   - Current cycle: Repair → Matchmaking → Battles

3. **Monitor yield thresholds**
   - Robots with very high yield (40-50%) might get excluded more often
   - This is expected behavior (they want to surrender early)

### For Testing
Test with different robot counts to see impact:
- 30 robots: 0 byes expected
- 31 robots: 1 bye per cycle expected
- 32 robots: 0 byes expected

---

## Files to Review

1. **`docs/MATCHMAKING_COMPLETE_LOGIC.md`** - Complete matchmaking explanation (450+ lines)
2. **`docs/BALANCE_CHANGES_SUMMARY.md`** - Summary of all balance changes
3. **`prototype/backend/src/services/matchmakingService.ts`** - Implementation

---

## Conclusion

✅ **Your feedback was spot-on** - the 50% threshold was dangerous

✅ **Correct fix implemented** - yield threshold check added

✅ **Complete documentation provided** - every step explained

✅ **Sequential processing analyzed** - not the cause of byes

✅ **Real causes identified** - odd counts + high yield thresholds

The system now ensures robots only enter battles where they'll actually fight, not immediately surrender.
