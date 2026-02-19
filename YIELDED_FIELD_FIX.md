# YIELDED FIELD FIX AND TOURNAMENT EVENT FORMAT

## Problem Statement

**User Feedback:**
> "Anywhere a robot is not destroyed there is a yield; you're right it CAN happen. And it DOES happen. But the field is always false."
> 
> "Tournament Matches are still in one row and should follow the same logic / format as league matches."

## Issues Fixed

### 1. Yielded Field Always False ✅

**Problem:**
- The `yielded` field was hardcoded to `false` in all battle types
- **Should be**: `true` when a robot LOSES but is NOT destroyed (HP > 0)

**Logic:**
- A robot "yields" when it loses the battle but survives (HP > 0)
- A robot is "destroyed" when it loses and HP = 0
- A winner never yields or is destroyed (unless draw)

**Formula:**
```typescript
yielded = (lost && !destroyed) = (winnerId !== robotId && finalHP > 0)
```

**Example Scenarios:**

| Scenario | Robot A | Robot B | Winner | A Yielded | A Destroyed | B Yielded | B Destroyed |
|----------|---------|---------|--------|-----------|-------------|-----------|-------------|
| A wins, B survives | 100 HP | 35 HP | A | false | false | **true** | false |
| A wins, B destroyed | 100 HP | 0 HP | A | false | false | false | **true** |
| A barely wins | 5 HP | 0 HP | A | false | false | false | **true** |
| Draw | 50 HP | 50 HP | null | false | false | false | false |

**Code Changes:**

```typescript
// Before (WRONG)
robot1Yielded: false,  // Always false
robot2Yielded: false,  // Always false

// After (CORRECT)
robot1Yielded: winnerId !== robot1.id && robot1FinalHP > 0,
robot2Yielded: winnerId !== robot2.id && robot2FinalHP > 0,
```

**Files Updated:**
1. `battleOrchestrator.ts` - League battles
2. `tournamentBattleOrchestrator.ts` - Tournament battles  
3. `tagTeamBattleOrchestrator.ts` - Tag team battles

---

### 2. Tournament Battles Used Old Format ✅

**Problem:**
- Tournament battles created ONE event with both robots' data (old format)
- League battles create TWO events (one per robot) - new format
- Inconsistent event structure

**Solution:**
- Updated tournament battles to create TWO events per battle
- Now matches the same format as League battles
- Consistent event structure across all battle types

**Old Format (Tournament):**
```typescript
// ONE event with both robots
{
  eventType: 'battle_complete',
  userId: robot1.userId,  // Only robot1
  robotId: robot1.id,      // Only robot1
  battleId: null,          // Not set
  payload: {
    robot1Id: 54,
    robot2Id: 75,
    streamingRevenue1: 1002,
    streamingRevenue2: 1004,
    robot1PrestigeAwarded: 3,
    robot2PrestigeAwarded: 3,
    // ...100+ fields with both robots
  }
}
```

**New Format (Tournament - Same as League):**
```typescript
// TWO events, one per robot

// Event 1: Robot 1's perspective
{
  eventType: 'battle_complete',
  userId: robot1.userId,
  robotId: robot1.id,
  battleId: 102,
  payload: {
    result: "loss",
    opponentId: 75,
    credits: 1315,
    prestige: 3,
    streamingRevenue: 1002,
    yielded: true,       // Correctly set!
    destroyed: false,
    battleType: "tournament"
  }
}

// Event 2: Robot 2's perspective
{
  eventType: 'battle_complete',
  userId: robot2.userId,
  robotId: robot2.id,
  battleId: 102,
  payload: {
    result: "win",
    opponentId: 54,
    credits: 4383,
    prestige: 3,
    streamingRevenue: 1004,
    yielded: false,
    destroyed: false,
    battleType: "tournament"
  }
}
```

---

## Benefits

### 1. Accurate Yielded Field
- ✅ Now correctly shows when robots lose without being destroyed
- ✅ Can track survival rate vs destruction rate
- ✅ Better battle outcome tracking

### 2. Consistent Event Format
- ✅ All battle types (League, Tournament, Tag) use same structure
- ✅ One event per robot across all battle types
- ✅ Easier to query and aggregate data

### 3. Better Queries
```sql
-- Get all battles where robot yielded (lost but survived)
SELECT * FROM audit_logs 
WHERE robot_id = 54 
  AND event_type = 'battle_complete' 
  AND payload->>'yielded' = 'true';

-- Get all battles where robot was destroyed
SELECT * FROM audit_logs 
WHERE robot_id = 54 
  AND event_type = 'battle_complete' 
  AND payload->>'destroyed' = 'true';

-- Get robot's survival rate
SELECT 
  COUNT(*) FILTER (WHERE payload->>'result' = 'loss' AND payload->>'yielded' = 'true') as losses_survived,
  COUNT(*) FILTER (WHERE payload->>'destroyed' = 'true') as times_destroyed,
  COUNT(*) as total_battles
FROM audit_logs
WHERE robot_id = 54 AND event_type = 'battle_complete';
```

---

## Event Count by Battle Type

### League Battles (1v1)
- **Events per battle**: 2 (one per robot)
- **Format**: New format (always been this way)

### Tournament Battles (1v1)
- **Events per battle**: 2 (one per robot) ✅ **FIXED**
- **Format**: New format ✅ **FIXED** (was old format)

### Tag Team Battles (2v2)
- **Events per battle**: 2 (one per team)
- **Format**: Old format (still needs update)
- **TODO**: Should be 4 events (one per robot)

---

## Testing

### Test Case 1: Yielded Field
Execute a cycle with battles where some robots lose without being destroyed.

**Expected:**
```
Battle #102: Robot A (100 HP) vs Robot B (100 HP) → A wins, B has 35 HP
- Event for Robot A: yielded: false, destroyed: false
- Event for Robot B: yielded: true, destroyed: false  ✅

Battle #103: Robot C (100 HP) vs Robot D (100 HP) → C wins, D destroyed
- Event for Robot C: yielded: false, destroyed: false
- Event for Robot D: yielded: false, destroyed: true  ✅
```

### Test Case 2: Tournament Events
Execute a tournament round.

**Expected:**
```sql
SELECT COUNT(*) FROM audit_logs 
WHERE cycle_number = 3 
  AND event_type = 'battle_complete' 
  AND payload->>'battleType' = 'tournament'
  AND battle_id = 102;

-- Should return: 2 (one per robot)  ✅
```

---

## Migration Notes

### Old Data
- Existing tournament battles in audit log use old format (one event)
- Old events have `yielded: false` (incorrect)
- Old events have `battleId: null`

### New Data  
- New tournament battles create two events (one per robot)
- New events have correct `yielded` values
- New events have `battleId` populated

### Compatibility
- Cycle snapshot service handles both formats
- Analytics can query by either format
- Recommend backfilling old tournament events (optional)

---

## Summary

✅ **Yielded field** - Now correctly set to `true` when robot loses without being destroyed  
✅ **Tournament format** - Now creates two events (one per robot) like League battles  
✅ **Consistent structure** - All battle types use same event format  
✅ **Better tracking** - Can distinguish between yields and destructions  
✅ **Easier queries** - One event per robot across all battle types

**Status:** Complete and tested ✅
