# Fix: HP Not Updating When Hull Integrity Upgraded

**Date**: February 1, 2026  
**Issue**: HP and Shield not recalculated after attribute upgrade  
**Status**: ✅ FIXED

---

## Problem

When upgrading Hull Integrity or Shield Capacity:
1. ✅ maxHP/maxShield increased correctly
2. ❌ currentHP/currentShield stayed at old value
3. ❌ Robot became not battle-ready
4. ❌ Required admin repair to fix HP values

### User Report

> "I've reloaded everything. New robots now correctly show 38 HP in /robots/332. However, when I upgrade Hull Integrity, the number stays 38, even when hitting refresh."

> "However, it appears the upgrade only adds to the MAXIMUM HP, so the bot is not battle ready. When I repair all bots as admin, the correct HP show."

### Example Issue

**Robot with Hull Integrity 1 (38 HP at 100%)**:
1. Upgrade Hull Integrity from 1 to 8
2. Expected: 94/94 HP (100%, battle-ready)
3. **Actual**: 38/94 HP (40%, NOT battle-ready)

The robot's maxHP increased from 38 to 94, but currentHP stayed at 38, making the robot appear damaged and unable to fight.

---

## Root Cause

The attribute upgrade endpoint (`PUT /api/robots/:id/upgrade`) in `robots.ts`:
- Updated the attribute value correctly
- **Did NOT recalculate maxHP** when `hullIntegrity` was upgraded
- **Did NOT recalculate maxShield** when `shieldCapacity` was upgraded
- **Did NOT update currentHP/currentShield** to match new maximums

### Code Before Fix (lines 373-401)

```typescript
const result = await prisma.$transaction(async (tx) => {
  // Deduct currency
  const updatedUser = await tx.user.update({
    where: { id: userId },
    data: { currency: user.currency - upgradeCost },
  });

  // Upgrade attribute
  const updatedRobot = await tx.robot.update({
    where: { id: robotId },
    data: {
      [attribute]: Math.floor(currentLevel) + 1,
    },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  return { user: updatedUser, robot: updatedRobot };
  // ❌ No HP/Shield recalculation!
});
```

**Problem**: The robot's `hullIntegrity` field increased, but `maxHP` and `currentHP` in the database were never updated.

### Why It Worked for Weapon Equip

The weapon equip endpoints (lines 486-497) **did** recalculate HP/Shield:

```typescript
// Weapon equip code (CORRECT IMPLEMENTATION)
const maxHP = calculateMaxHP(updatedRobot);
const maxShield = calculateMaxShield(updatedRobot);

const finalRobot = await prisma.robot.update({
  where: { id: robotId },
  data: {
    maxHP,
    maxShield,
    currentHP: Math.min(updatedRobot.currentHP, maxHP),
    currentShield: Math.min(updatedRobot.currentShield, maxShield),
  },
});
```

This pattern needed to be applied to attribute upgrades as well.

---

## Solution

Added HP/Shield recalculation to the attribute upgrade transaction.

### Code After Fix (lines 400-439)

```typescript
const result = await prisma.$transaction(async (tx) => {
  // Deduct currency
  const updatedUser = await tx.user.update({
    where: { id: userId },
    data: { currency: user.currency - upgradeCost },
  });

  // Upgrade attribute
  const updatedRobot = await tx.robot.update({
    where: { id: robotId },
    data: {
      [attribute]: Math.floor(currentLevel) + 1,
    },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  // ✅ NEW: Recalculate HP/Shield if needed
  if (attribute === 'hullIntegrity' || attribute === 'shieldCapacity') {
    const maxHP = calculateMaxHP(updatedRobot);
    const maxShield = calculateMaxShield(updatedRobot);

    // Calculate current HP/Shield proportionally to maintain same percentage
    const hpPercentage = robot.maxHP > 0 ? robot.currentHP / robot.maxHP : 1;
    const shieldPercentage = robot.maxShield > 0 ? robot.currentShield / robot.maxShield : 1;

    const newCurrentHP = Math.round(maxHP * hpPercentage);
    const newCurrentShield = Math.round(maxShield * shieldPercentage);

    // Update robot with new HP/Shield values
    const finalRobot = await tx.robot.update({
      where: { id: robotId },
      data: {
        maxHP,
        maxShield,
        currentHP: Math.min(newCurrentHP, maxHP),
        currentShield: Math.min(newCurrentShield, maxShield),
      },
      include: {
        mainWeapon: { include: { weapon: true } },
        offhandWeapon: { include: { weapon: true } },
      },
    });

    return { user: updatedUser, robot: finalRobot };
  }

  return { user: updatedUser, robot: updatedRobot };
});
```

### Key Features

1. **Conditional Check**: Only recalculates if `hullIntegrity` or `shieldCapacity` was upgraded
2. **Proportional Update**: Maintains HP/Shield percentage (if robot had 100% HP, stays at 100%)
3. **Uses Formula Functions**: Calls `calculateMaxHP()` and `calculateMaxShield()` for consistency
4. **Transaction Safety**: All updates happen in same transaction
5. **No Breaking Changes**: Other attribute upgrades work exactly as before

---

## Expected Behavior After Fix

### Scenario 1: Robot at 100% HP Upgrades Hull Integrity

**Initial State**:
- Hull Integrity: 1
- maxHP: 38
- currentHP: 38 (100%)
- Battle-ready: ✅ Yes

**After Upgrade to Hull=8**:
- Hull Integrity: 8 ✅
- maxHP: 94 ✅ (30 + 8×8)
- currentHP: 94 ✅ (100% maintained)
- Battle-ready: ✅ Yes

**Result**: Robot stays at 100% HP and remains battle-ready!

---

### Scenario 2: Robot at 50% HP Upgrades Hull Integrity

**Initial State**:
- Hull Integrity: 1
- maxHP: 38
- currentHP: 19 (50%)
- Battle-ready: ❌ No (below 75%)

**After Upgrade to Hull=8**:
- Hull Integrity: 8 ✅
- maxHP: 94 ✅
- currentHP: 47 ✅ (50% maintained)
- Battle-ready: ❌ No (still below 75%)

**Result**: HP percentage is preserved, robot stays at 50% health.

---

### Scenario 3: Robot Upgrades Shield Capacity

**Initial State**:
- Shield Capacity: 1
- maxShield: 2
- currentShield: 2 (100%)

**After Upgrade to Shield=5**:
- Shield Capacity: 5 ✅
- maxShield: 10 ✅ (5×2)
- currentShield: 10 ✅ (100% maintained)

**Result**: Shield scales correctly!

---

### Scenario 4: Robot Upgrades Other Attributes

**Initial State**:
- Combat Power: 1
- HP: 38/38

**After Upgrade to Combat Power=5**:
- Combat Power: 5 ✅
- maxHP: 38 (unchanged) ✅
- currentHP: 38 (unchanged) ✅

**Result**: HP/Shield not affected by non-defensive attribute upgrades.

---

## Why Proportional Update?

### Option 1: Set to 100% (NOT CHOSEN)

```typescript
// Always set to 100%
currentHP: maxHP,
currentShield: maxShield,
```

**Problems**:
- ❌ Gives damaged robots free full heal
- ❌ Allows exploiting upgrades for free repairs
- ❌ Unfair advantage in battles

### Option 2: Keep Old Value (BROKEN - OLD BEHAVIOR)

```typescript
// Keep same absolute value
currentHP: robot.currentHP,
currentShield: robot.currentShield,
```

**Problems**:
- ❌ Robot becomes less battle-ready after upgrade
- ❌ 38/38 (100%) → 38/94 (40%)
- ❌ Makes defensive upgrades punishing

### Option 3: Proportional (CORRECT - OUR FIX) ✅

```typescript
// Maintain percentage
const hpPercentage = robot.currentHP / robot.maxHP;
const newCurrentHP = Math.round(maxHP * hpPercentage);
currentHP: Math.min(newCurrentHP, maxHP),
```

**Benefits**:
- ✅ Fair to all players
- ✅ Maintains battle state
- ✅ No exploitation
- ✅ Intuitive behavior

---

## Testing

### Manual Test Steps

1. **Create New Robot**
   ```bash
   POST /api/robots
   { "name": "Test Bot" }
   ```
   Expected: 38/38 HP (hull=1)

2. **Upgrade Hull Integrity**
   ```bash
   PUT /api/robots/:id/upgrade
   { "attribute": "hullIntegrity" }
   ```
   Expected: 46/46 HP (hull=2: 30 + 2×8)

3. **Verify Without Refresh**
   ```bash
   GET /api/robots/:id
   ```
   Expected: Robot shows updated HP immediately

4. **Check Battle Readiness**
   - Robot should still be battle-ready (100% HP)
   - Should not require repair

### Test Cases

| Initial State | Upgrade | Expected Result |
|--------------|---------|-----------------|
| Hull=1, 38/38 HP (100%) | Hull→8 | 94/94 HP (100%) ✅ |
| Hull=1, 19/38 HP (50%) | Hull→8 | 47/94 HP (50%) ✅ |
| Hull=1, 0/38 HP (0%) | Hull→8 | 0/94 HP (0%) ✅ |
| Shield=1, 2/2 (100%) | Shield→5 | 10/10 (100%) ✅ |
| Power=1, 38/38 HP | Power→5 | 38/38 HP ✅ |

---

## Impact

### Before Fix

**Problems**:
- ❌ Upgrading Hull Integrity made robots not battle-ready
- ❌ Players thought upgrades were broken
- ❌ Required admin repair to fix HP
- ❌ Confusing and frustrating UX
- ❌ Defensive upgrades were punishing

**Player Experience**:
> "I upgraded my robot's hull but now it can't fight! What's wrong?"

### After Fix

**Benefits**:
- ✅ Upgrading Hull Integrity maintains battle readiness
- ✅ HP/Shield scale correctly with attributes
- ✅ No admin intervention needed
- ✅ Clear and intuitive behavior
- ✅ Defensive upgrades are rewarding

**Player Experience**:
> "I upgraded my robot's hull and it got stronger! Perfect!"

---

## Related Issues

This fix is part of the ongoing HP formula improvements:

1. ✅ **HP Formula Applied Everywhere** (`FIX_HP_FORMULA_EVERYWHERE.md`)
   - Robot creation uses new formula
   - UI displays correct formula
   - Admin endpoint to fix existing robots

2. ✅ **HP Updates on Upgrade** (this fix)
   - HP/Shield recalculated when attributes upgrade
   - Proportional update maintains percentage
   - Consistent with weapon equip behavior

All part of ensuring HP formula `30 + (hullIntegrity × 8)` works correctly throughout the game.

---

## Files Modified

**Code**: 1 file
- `prototype/backend/src/routes/robots.ts` (lines 400-439)
  - Added HP/Shield recalculation to attribute upgrade transaction

**Documentation**: 1 file
- `docs/FIX_HP_UPGRADE_ATTRIBUTE.md` (this file)

---

## Conclusion

**The HP update issue is fully resolved!**

When players upgrade Hull Integrity or Shield Capacity:
- ✅ maxHP/maxShield increases correctly
- ✅ currentHP/currentShield increases proportionally
- ✅ Battle readiness is maintained
- ✅ No admin repair needed
- ✅ Fair and intuitive behavior

Players can now safely upgrade defensive attributes without worrying about their robots becoming temporarily disabled! 🎉
