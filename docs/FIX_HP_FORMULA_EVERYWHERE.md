# Fix: HP Formula Not Applied Everywhere

**Date**: February 1, 2026  
**Issue**: HP formula change was only partially implemented  
**Status**: ✅ FIXED

---

## Problem

The HP formula was changed from `Hull Integrity × 10` to `30 + (Hull Integrity × 8)` to improve game balance, but the change was only applied in the `calculateMaxHP()` function. Several critical places still used the old formula:

### Issues Found

1. **Robot Creation (Backend)**
   - `robots.ts` line 165 still used: `maxHP = hullIntegrity * 10`
   - New robots were created with wrong HP values
   - Hull=1 robots had 10 HP instead of 38 HP

2. **Formula Display (Frontend)**
   - `RobotDetailPage.tsx` showed: "Max HP = Hull Integrity × 10"
   - Players saw incorrect formula in the UI
   - Caused confusion about actual HP calculations

3. **Existing Robots**
   - All robots created before the fix had incorrect HP values
   - Hull=10 bots had 100 HP instead of 110 HP
   - Hull=8 bot had 38 HP instead of 94 HP

### User Report

> "Now I can rerun my matches, it looks like HullIntegrity Bots still have 100 HP, while under the new rules above they should have 110 HP. Other bots still have 10 HP. Your fix which should apply 30 + (Hull Integrity * 8) is not in effect when running battles."

> "A robot with Hull Integrity 8 shows 38 / 38 HP with text 'Max HP = Hull Integrity × 10'. Should have 30 + 8 × 8 = 94 HP, not 38 HP."

---

## Root Causes

### 1. Robot Creation Not Updated

**File**: `prototype/backend/src/routes/robots.ts` (line 162-166)

```typescript
// OLD CODE (WRONG)
// Initialize HP and Shield based on formulas: maxHP = hullIntegrity × 10
const hullIntegrity = 1; // Default level
const maxHP = hullIntegrity * 10; // ❌ Used old formula
```

This meant:
- New robots were created with 10 HP (hull=1)
- Should have been 38 HP (30 + 1×8)

### 2. UI Still Showed Old Formula

**File**: `prototype/frontend/src/pages/RobotDetailPage.tsx` (line 558)

```tsx
{/* OLD TEXT (WRONG) */}
<div className="text-xs text-gray-500 mt-1">
  Max HP = Hull Integrity × 10  {/* ❌ Wrong formula */}
</div>
```

This confused users who saw the old formula but robots had different HP values.

### 3. No Way to Fix Existing Robots

No admin endpoint existed to recalculate HP for robots that were already created with the wrong formula.

---

## Solution Applied

### Fix 1: Update Robot Creation

**File**: `prototype/backend/src/routes/robots.ts`

```typescript
// NEW CODE (CORRECT)
// Initialize HP and Shield based on NEW formulas: 
// maxHP = 30 + (hullIntegrity × 8), maxShield = shieldCapacity × 2
const hullIntegrity = 1; // Default level

// Calculate initial HP using the new formula
// For hull=1: 30 + (1 × 8) = 38 HP
const maxHP = 30 + (hullIntegrity * 8); // ✅ Uses new formula
```

**Result**:
- New robots now created with correct HP
- Hull=1: 38 HP (was 10 HP)
- Formula matches `calculateMaxHP()` function

### Fix 2: Update Formula Display

**File**: `prototype/frontend/src/pages/RobotDetailPage.tsx`

```tsx
{/* NEW TEXT (CORRECT) */}
<div className="text-xs text-gray-500 mt-1">
  Max HP = 30 + (Hull Integrity × 8)  {/* ✅ Correct formula */}
</div>
```

**Result**:
- Players now see the correct formula
- UI matches actual calculation
- No more confusion

### Fix 3: Add HP Recalculation Endpoint

**File**: `prototype/backend/src/routes/admin.ts`

**New Endpoint**: `POST /api/admin/recalculate-hp`

```typescript
/**
 * POST /api/admin/recalculate-hp
 * Recalculate HP for all robots using the new formula: 30 + (hullIntegrity × 8)
 */
router.post('/recalculate-hp', authenticateToken, requireAdmin, async (req, res) => {
  // Get all robots with weapons
  const robots = await prisma.robot.findMany({ include: { ... } });

  for (const robot of robots) {
    const oldMaxHP = robot.maxHP;
    
    // Calculate new maxHP using the formula
    const newMaxHP = calculateMaxHP(robot);
    
    // Calculate currentHP proportionally
    const hpPercentage = robot.maxHP > 0 ? robot.currentHP / robot.maxHP : 1;
    const newCurrentHP = Math.round(newMaxHP * hpPercentage);

    // Update robot
    await prisma.robot.update({
      where: { id: robot.id },
      data: {
        maxHP: newMaxHP,
        currentHP: Math.min(newCurrentHP, newMaxHP),
      },
    });
  }

  return { success: true, robotsUpdated: robots.length, updates: [...] };
});
```

**Features**:
- Recalculates maxHP for ALL robots using `calculateMaxHP()`
- Maintains HP percentage (if robot had 80% HP, keeps it at 80%)
- Returns detailed report showing old/new values for each robot
- Fixes all existing robots at once

---

## How to Use

### For New Robots

New robots will automatically be created with correct HP:
```bash
POST /api/robots
{
  "name": "New Bot"
}

# Result: Robot created with 38 HP (hull=1)
```

### For Existing Robots

Run the recalculation endpoint (admin only):
```bash
POST /api/admin/recalculate-hp
Authorization: Bearer <admin-token>

# Response:
{
  "success": true,
  "robotsUpdated": 330,
  "updates": [
    {
      "robotId": 1,
      "robotName": "HullBot 1",
      "hullIntegrity": 10,
      "oldMaxHP": 100,
      "newMaxHP": 110,
      "change": +10
    },
    {
      "robotId": 2,
      "robotName": "TestBot",
      "hullIntegrity": 8,
      "oldMaxHP": 80,
      "newMaxHP": 94,
      "change": +14
    },
    // ... more robots
  ]
}
```

---

## Expected HP Values

### New Formula: `30 + (Hull Integrity × 8)`

| Hull Integrity | Old HP (×10) | New HP (30 + hull×8) | Change |
|----------------|--------------|----------------------|--------|
| 1              | 10           | 38                   | +28 (+280%) |
| 5              | 50           | 70                   | +20 (+40%) |
| 8              | 80           | 94                   | +14 (+17.5%) |
| 10             | 100          | 110                  | +10 (+10%) |
| 20             | 200          | 190                  | -10 (-5%) |
| 30             | 300          | 270                  | -30 (-10%) |
| 40             | 400          | 350                  | -50 (-12.5%) |
| 50             | 500          | 430                  | -70 (-14%) |

### Key Points

1. **Low-level robots benefit**: Hull 1-10 get MORE HP
   - Makes starting robots more viable
   - Reduces dominance gap

2. **Mid-level roughly same**: Hull 15-20 see minimal change

3. **High-level robots nerfed**: Hull 30-50 get LESS HP
   - Reduces Hull Integrity dominance at high levels
   - Encourages diverse builds

---

## Documentation Updates

Updated all references to the old formula:

1. **DATABASE_SCHEMA.md**
   - Line 111: Changed comment from "Max HP (×10 formula)" to "Max HP (30 + hull × 8 formula)"
   - Lines 129-130: Updated HP calculation comments
   - Line 199: Updated formula in examples

2. **FIXES_ROBOT_DETAIL_PAGE_PART2.md**
   - Line 35: Updated helper text reference
   - Line 205: Updated testing checklist

3. **BALANCE_CHANGES_SUMMARY.md**
   - Already had correct documentation (this is where the change was documented originally)

---

## Testing Verification

### Test 1: New Robot Creation
```bash
# Create a new robot
POST /api/robots
{ "name": "Test Bot" }

# Verify HP
GET /api/robots/:id

# Expected: maxHP = 38 (30 + 1×8), not 10
✅ PASS
```

### Test 2: Formula Display
```bash
# Open robot detail page in browser
# Check helper text under HP display

# Expected: "Max HP = 30 + (Hull Integrity × 8)"
✅ PASS
```

### Test 3: HP Recalculation
```bash
# Before: Hull=10 bot has 100 HP
# Run recalculation
POST /api/admin/recalculate-hp

# After: Hull=10 bot has 110 HP
✅ PASS
```

### Test 4: Proportional HP
```bash
# Robot at 50% HP (50/100)
# Run recalculation
POST /api/admin/recalculate-hp

# After: Robot at 50% HP (55/110)
✅ PASS (maintains percentage)
```

---

## Files Modified

1. ✅ `prototype/backend/src/routes/robots.ts`
   - Fixed robot creation to use new formula
   - Line 165: Changed from `hullIntegrity * 10` to `30 + (hullIntegrity * 8)`

2. ✅ `prototype/frontend/src/pages/RobotDetailPage.tsx`
   - Updated formula display
   - Line 558: Changed text to show new formula

3. ✅ `prototype/backend/src/routes/admin.ts`
   - Added `/api/admin/recalculate-hp` endpoint
   - Fixes all existing robots

4. ✅ `docs/DATABASE_SCHEMA.md`
   - Updated all formula references

5. ✅ `docs/FIXES_ROBOT_DETAIL_PAGE_PART2.md`
   - Updated documentation and testing checklists

---

## Impact

### Before Fix
- ❌ New robots created with wrong HP (10 instead of 38)
- ❌ UI showed wrong formula
- ❌ Existing robots had incorrect HP values
- ❌ Hull Integrity scaling didn't match design

### After Fix
- ✅ New robots created with correct HP (38 for hull=1)
- ✅ UI shows correct formula
- ✅ Admin can fix existing robots with one endpoint call
- ✅ HP scaling matches balance design

---

## Related Issues

This fix is part of the broader balance changes:
- Hull Integrity scaling adjustment (this fix)
- Armor Plating cap (MAX_ARMOR_REDUCTION = 30)
- Matchmaking battle readiness (75% HP + yield threshold)
- Draws display in league standings

All documented in `docs/BALANCE_CHANGES_SUMMARY.md`

---

## Conclusion

The HP formula is now correctly applied everywhere:
1. ✅ Robot creation uses new formula
2. ✅ UI displays new formula
3. ✅ Existing robots can be fixed with admin endpoint
4. ✅ Documentation updated throughout

**The HP calculation issue is fully resolved!**
