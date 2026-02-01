# Fix: Seed Data Uses New HP Formula

**Date**: February 1, 2026  
**Issue**: Seed data still created robots with old HP formula  
**Status**: ✅ FIXED

---

## Problem

The seed file (`prisma/seed.ts`) was creating robots with the old HP formula even though the application code had been updated to use the new formula.

### User Report

> "It looks like this works when creating new robots, but the robots in the seed still get created with either 100 or 10 HP"

### Impact

- New robots created via API: ✅ Correct (38 HP for hull=1)
- Robots created via seed: ❌ Wrong (10 HP for hull=1)
- HullIntegrity test bots: ❌ Wrong (100 HP for hull=10, should be 110 HP)

This meant test data didn't match production behavior, causing confusion and incorrect balance testing.

---

## Root Cause

The seed file had **4 locations** using the old formula `hullIntegrity × 10`:

### Location 1: Regular Test Users (line 407-409)
```typescript
// OLD CODE
// Combat state (HP formula: hullIntegrity × 10 = 1.00 × 10 = 10)
currentHP: 10,
maxHP: 10,
```

**Problem**: 100 test users created with 10 HP instead of 38 HP

### Location 2: Attribute-Focused Bots (line 517-519)
```typescript
// OLD CODE
// HP formula: hullIntegrity × 10
const hullIntegrityValue = robotAttributes.hullIntegrity;
const maxHP = Math.floor(hullIntegrityValue * 10);
```

**Problem**: 
- HullIntegrity bots (hull=10): 100 HP instead of 110 HP
- Other attribute bots (hull=1): 10 HP instead of 38 HP

### Location 3: Bye Robot (line 608-609)
```typescript
// OLD CODE
// Combat state
currentHP: 10,
maxHP: 10,
```

**Problem**: Bye Robot created with 10 HP instead of 38 HP

### Location 4: Console Documentation (line 675)
```typescript
// OLD CODE
console.log('📝 HP Formula: maxHP = hullIntegrity × 10');
```

**Problem**: Documentation showed wrong formula

---

## Solution

Updated all 4 locations to use the new formula: `30 + (hullIntegrity × 8)`

### Fix 1: Regular Test Users
```typescript
// NEW CODE
// Combat state (NEW HP formula: 30 + (hullIntegrity × 8) = 30 + (1.00 × 8) = 38)
currentHP: 38,
maxHP: 38,
```

### Fix 2: Attribute-Focused Bots
```typescript
// NEW CODE
// NEW HP formula: 30 + (hullIntegrity × 8)
const hullIntegrityValue = robotAttributes.hullIntegrity;
const maxHP = Math.floor(30 + (hullIntegrityValue * 8));
```

### Fix 3: Bye Robot
```typescript
// NEW CODE
// Combat state (NEW HP formula: 30 + (hullIntegrity × 8) = 30 + (1.00 × 8) = 38)
currentHP: 38,
maxHP: 38,
```

### Fix 4: Console Documentation
```typescript
// NEW CODE
console.log('📝 HP Formula: maxHP = 30 + (hullIntegrity × 8)');
```

---

## Expected Results After Fix

### Test Data Breakdown

The seed creates **341 robots** total:

1. **100 Regular Test Users** (`test_user_001` to `test_user_100`)
   - Hull Integrity: 1
   - Old HP: 10
   - **New HP: 38** ✅

2. **230 Attribute-Focused Bots** (10 bots per attribute, 23 attributes)
   - 220 bots with hull=1: Old 10 HP → **New 38 HP** ✅
   - 10 HullIntegrity bots with hull=10: Old 100 HP → **New 110 HP** ✅

3. **10 Specialized Test Users** (`test_attr_*` accounts)
   - Hull Integrity: 1
   - Old HP: 10
   - **New HP: 38** ✅

4. **1 Bye Robot**
   - Hull Integrity: 1
   - Old HP: 10
   - **New HP: 38** ✅

### HP Value Summary

| Hull Level | Old Formula (×10) | New Formula (30 + hull×8) | Change |
|------------|-------------------|---------------------------|--------|
| 1 (most)   | 10                | 38                        | +280% |
| 10 (HI)    | 100               | 110                       | +10%  |

---

## Testing

### How to Test

1. **Reset Database**:
   ```bash
   cd prototype/backend
   npx prisma migrate reset --force
   ```

2. **Run Seed**:
   ```bash
   npx prisma db seed
   ```

3. **Verify HP Values**:
   ```bash
   # Check a regular test user
   psql armouredsouls -c "SELECT name, hullIntegrity, maxHP FROM robots WHERE name LIKE 'test_user_%' LIMIT 1;"
   # Expected: hullIntegrity=1, maxHP=38
   
   # Check HullIntegrity bot
   psql armouredsouls -c "SELECT name, hullIntegrity, maxHP FROM robots WHERE name LIKE 'HullIntegrity Bot%' LIMIT 1;"
   # Expected: hullIntegrity=10, maxHP=110
   
   # Check Bye Robot
   psql armouredsouls -c "SELECT name, hullIntegrity, maxHP FROM robots WHERE name = 'Bye Robot';"
   # Expected: hullIntegrity=1, maxHP=38
   ```

### Expected Console Output

When seed runs, you should see:
```
📝 HP Formula: maxHP = 30 + (hullIntegrity × 8)
🛡️  Shield Formula: maxShield = shieldCapacity × 2
```

Not the old:
```
📝 HP Formula: maxHP = hullIntegrity × 10  ❌ WRONG
```

---

## Impact

### Before Fix

**Issues**:
- ❌ Test data had wrong HP values
- ❌ Seed didn't match API behavior
- ❌ Balance testing inaccurate
- ❌ HullIntegrity bots still dominated (100 HP vs should be 110 HP)
- ❌ Starting bots too weak (10 HP)

**Example**: HullIntegrity bot in seed vs API-created robot
- Seed: 100 HP (wrong)
- API: 110 HP (correct)
- Difference: 10 HP gap causing confusion

### After Fix

**Benefits**:
- ✅ All robots use consistent formula
- ✅ Seed matches API behavior
- ✅ Accurate balance testing
- ✅ Starting bots viable (38 HP)
- ✅ Correct HullIntegrity scaling (110 HP)

**Example**: Now both match
- Seed: 110 HP ✅
- API: 110 HP ✅
- Difference: None

---

## Related Fixes

This completes the HP formula implementation across the entire codebase:

1. ✅ **Formula Defined**: `calculateMaxHP()` in `robotCalculations.ts`
2. ✅ **Robot Creation**: `robots.ts` uses new formula
3. ✅ **Attribute Upgrades**: Recalculates HP when hull upgraded
4. ✅ **UI Display**: Shows correct formula text
5. ✅ **Admin Endpoint**: Can fix existing robots
6. ✅ **Seed Data**: Creates robots with correct HP (this fix)
7. ✅ **Documentation**: All docs updated

All documented in:
- `FIX_HP_FORMULA_EVERYWHERE.md` - Robot creation fix
- `FIX_HP_UPGRADE_ATTRIBUTE.md` - Attribute upgrade fix
- `FIX_SEED_HP_FORMULA.md` - This document

---

## Files Modified

**Seed File**: 1 file
- `prototype/backend/prisma/seed.ts` (4 locations updated)

**Documentation**: 1 file
- `docs/FIX_SEED_HP_FORMULA.md` (this file)

---

## Verification Checklist

After running seed, verify:

- [ ] Regular test users have 38 HP (not 10 HP)
- [ ] HullIntegrity bots have 110 HP (not 100 HP)
- [ ] Other attribute bots have 38 HP (not 10 HP)
- [ ] Bye Robot has 38 HP (not 10 HP)
- [ ] Console shows new formula documentation
- [ ] No robots with 10 HP exist (except if manually damaged)
- [ ] No robots with 100 HP exist (unless hull=17 or hull=18)

---

## Conclusion

**The seed data now uses the correct HP formula!**

All robots created by the seed will have HP calculated using:
```
maxHP = 30 + (hullIntegrity × 8)
```

This matches:
- API robot creation ✅
- Attribute upgrade calculations ✅
- UI display ✅
- Documentation ✅
- Admin recalculation endpoint ✅

**The HP formula is now fully consistent across the entire application!** 🎉
