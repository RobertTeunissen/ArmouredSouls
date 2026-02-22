# Battle Table Migration Status

## Goal
Migrate from storing per-robot battle data in Battle table columns to the BattleParticipant table.

## Current Status: DUAL-WRITE MODE ✅

Battle orchestrators are writing to BOTH:
- Old Battle table columns (for backward compatibility)
- New BattleParticipant table (the future)

## Files Still Reading from Old Battle Columns

### 1. cycleSnapshotService.ts
**Function:** `aggregateRobotMetrics()`
**Reads:** robot1/2ELOBefore, robot1/2ELOAfter, robot1/2DamageDealt, robot1/2FameAwarded
**Action needed:** Update to read from BattleParticipant table

### 2. robotPerformanceService.ts
**Multiple functions read:**
- robot1/2ELOBefore, robot1/2ELOAfter
- robot1/2DamageDealt
- robot1/2FameAwarded
**Action needed:** Update all functions to read from BattleParticipant table

### 3. records.ts (Hall of Records)
**Reads:**
- robot1/2DamageDealt (for "Most Damage in Single Battle")
- robot1/2FinalHP (for "Narrowest Victory")
**Action needed:** Update to read from BattleParticipant table

### 4. admin.ts
**Multiple admin endpoints read:**
- robot1/2FinalHP
- robot1/2DamageDealt
- robot1/2PrestigeAwarded
- robot1/2FameAwarded
**Action needed:** Update to read from BattleParticipant table

### 5. matches.ts ✅ UPDATED
**Status:** Already updated to read from BattleParticipant with fallbacks
**Action:** Remove fallbacks since we're in prototype phase

## Recommended Migration Steps

### Phase 1: Update Read Operations (CURRENT)
1. ✅ matches.ts - DONE (has fallbacks)
2. ⏳ cycleSnapshotService.ts - TODO
3. ⏳ robotPerformanceService.ts - TODO
4. ⏳ records.ts - TODO
5. ⏳ admin.ts - TODO

### Phase 2: Remove Fallbacks (After Phase 1)
- Remove fallbacks from matches.ts
- Verify all reads use BattleParticipant

### Phase 3: Remove Old Columns (Final)
Once all reads are migrated:
1. Remove dual-write from battle orchestrators
2. Create migration to drop old Battle table columns:
   - robot1ELOBefore, robot2ELOBefore
   - robot1ELOAfter, robot2ELOAfter
   - robot1DamageDealt, robot2DamageDealt
   - robot1FinalHP, robot2FinalHP
   - robot1PrestigeAwarded, robot2PrestigeAwarded
   - robot1FameAwarded, robot2FameAwarded
   - robot1Yielded, robot2Yielded
   - robot1Destroyed, robot2Destroyed

## Benefits of BattleParticipant Table

1. **Consistent structure** - Same schema for 1v1, tournament, and tag team battles
2. **Easier queries** - No need to check if robot is robot1 or robot2
3. **Better scalability** - Can support N-player battles in the future
4. **Cleaner code** - No more robot1/robot2 conditional logic
5. **Complete data** - Includes streaming revenue per participant

## Notes

- Since we're in prototype phase with frequent database resets, we don't need backward compatibility
- Can remove fallbacks immediately after updating read operations
- Keep dual-write until all reads are migrated to avoid breaking anything
