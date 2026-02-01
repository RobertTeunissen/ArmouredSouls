# Fix: Duplicate MAX_ARMOR_REDUCTION Declaration

**Date**: February 1, 2026  
**Issue**: Backend fails to start due to duplicate symbol declaration  
**Status**: ✅ FIXED

---

## Problem

When trying to start the backend with `npm run dev`, the following error occurred:

```
Error: Transform failed with 1 error:
/Users/robertteunissen/Downloads/ArmouredSouls/prototype/backend/src/services/combatSimulator.ts:183:6: 
ERROR: The symbol "MAX_ARMOR_REDUCTION" has already been declared
```

---

## Root Cause

During the implementation of the armor plating balance fix, `MAX_ARMOR_REDUCTION` was declared twice in `combatSimulator.ts`:

1. **Line 69** (correct): `export const MAX_ARMOR_REDUCTION = 30;`
   - This was the intended exported constant for testing and reusability
   
2. **Line 183** (duplicate): `const MAX_ARMOR_REDUCTION = 30;`
   - This was an accidental duplicate local declaration

The duplicate declaration at line 183 caused the esbuild/TypeScript compiler to fail.

---

## Solution

**Removed the duplicate declaration** at line 183 and improved the documentation.

### Changes Made

**File**: `prototype/backend/src/services/combatSimulator.ts`

**Before** (lines 182-187):
```typescript
// Maximum armor reduction cap (prevents armor from being too overpowered)
const MAX_ARMOR_REDUCTION = 30;

/**
 * Apply damage through shields and armor
 */
function applyDamage(
```

**After** (lines 182-186):
```typescript
/**
 * Apply damage through shields and armor
 * Uses MAX_ARMOR_REDUCTION constant to cap armor effectiveness
 */
function applyDamage(
```

### What Was Kept

The **exported constant at line 69** remains as the single source of truth:
```typescript
// Maximum armor reduction cap (prevents armor from being too overpowered)
// Exported for testing and reusability
export const MAX_ARMOR_REDUCTION = 30;
```

This constant is correctly used in two places:
- **Line 221**: Capping armor reduction for bleed-through damage after shields break
- **Line 228**: Capping armor reduction for direct HP damage when no shield

---

## Verification

### TypeScript Compilation
- ✅ No duplicate declaration error
- ✅ tsx can process the file successfully
- ✅ esbuild transformation completes without errors

### Code Correctness
- ✅ Single constant declaration (exported at line 69)
- ✅ Constant is properly used in both armor reduction calculations
- ✅ Function documentation updated to reference the constant
- ✅ No breaking changes to the combat simulation logic

---

## Impact

**Before Fix**: Backend fails to start with duplicate declaration error

**After Fix**: Backend starts successfully, armor plating reduction cap works as intended

The armor reduction cap implementation remains functional:
- Maximum armor reduction: 30 points
- Formula: `armorReduction = min(armorPlating × (1 - penetration/150), 30)`
- Prevents high armor from completely negating damage
- Maintains game balance between defensive and offensive builds

---

## How to Test

1. **Start the backend**:
   ```bash
   cd prototype/backend
   npm run dev
   ```
   Expected: Backend starts without errors ✅

2. **Run TypeScript check**:
   ```bash
   npx tsc --noEmit
   ```
   Expected: No duplicate declaration errors (only missing node_modules errors if dependencies not installed)

3. **Verify combat simulation**:
   - Run matchmaking and battles
   - Check that armor reduction is capped at 30
   - Verify robots with high armor (40-50) don't become invincible

---

## Related Changes

This fix is part of the ongoing gameplay balance improvements:
- Hull Integrity HP scaling adjustments
- Armor Plating effectiveness cap (this fix)
- Matchmaking battle readiness improvements
- Draws display in league standings

All balance changes are documented in:
- `docs/BALANCE_CHANGES_SUMMARY.md`
- `docs/MATCHMAKING_COMPLETE_LOGIC.md`

---

## Conclusion

The duplicate declaration has been removed, allowing the backend to start successfully. The armor plating balance fix remains intact and functional, capping maximum armor reduction at 30 points to prevent defensive builds from becoming unkillable while still maintaining the value of armor investment.
