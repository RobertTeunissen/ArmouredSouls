# Compilation Errors to Fix

## Summary
The schema cleanup removed fields that code is still referencing. We need to either:
1. Add these fields back to the schema temporarily, OR
2. Fix all the code references

## Errors by Category

### 1. Battle.robot1RepairCost / robot2RepairCost (REMOVED)
**Files affected:**
- `src/routes/admin.ts` (2 errors)
- `src/routes/records.ts` (4 errors)
- `src/services/battleOrchestrator.ts` (4 errors)
- `src/services/tagTeamBattleOrchestrator.ts` (2 errors)
- `src/services/tournamentBattleOrchestrator.ts` (2 errors)
- `src/utils/economyCalculations.ts` (6 errors)

**Fix:** These fields were always 0 (deprecated). Remove all references or set to 0.

### 2. Battle.robot1FinalShield / robot2FinalShield (REMOVED)
**Files affected:**
- `src/routes/admin.ts` (2 errors)
- `src/services/battleOrchestrator.ts` (2 errors)
- `src/services/tournamentBattleOrchestrator.ts` (2 errors)

**Fix:** These fields were always 0. Remove all references or set to 0.

### 3. User.totalWins (REMOVED)
**Files affected:**
- `src/services/battleOrchestrator.ts` (1 error)
- `src/services/tournamentBattleOrchestrator.ts` (1 error)
- `src/routes/records.ts` (1 error)

**Fix:** Remove the increment operations. Stats should be aggregated from robots.

### 4. User.totalBattles (REMOVED)
**Files affected:**
- `src/routes/records.ts` (3 errors)

**Fix:** Aggregate from robots instead.

### 5. Battle.userId (REMOVED)
**Files affected:**
- `src/utils/economyCalculations.ts` (2 errors)

**Fix:** Query via robot relations instead.

### 6. Battle.leagueType (NOT NULL)
**Files affected:**
- `src/services/tournamentBattleOrchestrator.ts` (1 error - trying to set null)

**Fix:** Tournament battles should use a special value like "tournament" instead of null.

## Recommendation

**Option A: Quick Fix (Add fields back temporarily)**
- Add the removed fields back to schema as optional/deprecated
- Mark them clearly as deprecated
- This lets us test BattleParticipant without fixing all the code

**Option B: Proper Fix (Fix all code)**
- Remove all references to deprecated fields
- Update queries to use robot relations
- This is the right long-term solution but takes more time

## My Suggestion

Let's do **Option A** for now so you can test the BattleParticipant functionality. Once that's working, we can do Option B to clean up the code properly.

