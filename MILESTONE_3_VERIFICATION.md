# Milestone 3 Verification Guide

## Overview

This document provides step-by-step verification that all Milestone 3 requirements are met according to STABLE_SYSTEM.md and ROBOT_ATTRIBUTES.md.

## Fixes Applied in Commit c11692c

### 1. Training Academy Caps Fixed

**Previous Implementation (WRONG)**:
- Base cap: 50
- Formula: `50 + (level × 5)`
- Level 0: Cap 50, Level 1: Cap 55, Level 2: Cap 60

**Correct Implementation (from STABLE_SYSTEM.md lines 196-245)**:
- Base cap: 10
- Cap mapping: `{0:10, 1:15, 2:20, 3:25, 4:30, 5:35, 6:40, 7:42, 8:45, 9:48, 10:50}`
- Level 0: Cap 10, Level 1: Cap 15, Level 2: Cap 20

**Files Changed**:
- `prototype/backend/src/routes/robots.ts` - Added `getCapForLevel()` function
- `prototype/frontend/src/pages/RobotDetailPage.tsx` - Added `getCapForLevel()` function

## Verification Steps

### Test 1: Verify Base Cap is 10 (No Academy)

**Steps**:
1. Login as player1 / password123
2. Create a robot named "Test Bot"
3. View robot detail page
4. Note that all attribute groups show "Attribute Cap: 10"
5. Try upgrading Combat Power from 1 → 10 (should work)
6. Try upgrading Combat Power from 10 → 11 (should fail)

**Expected Results**:
- ✅ Attributes can be upgraded 1 → 10
- ✅ Upgrading past 10 shows error: "Attribute cap of 10 reached. Upgrade Combat Training Academy to increase cap"
- ✅ Display shows "Attribute Cap: 10" for all groups

**Backend Code** (robots.ts lines ~312-340):
```typescript
const getCapForLevel = (level: number): number => {
  const capMap: { [key: number]: number } = {
    0: 10, 1: 15, 2: 20, 3: 25, 4: 30,
    5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50
  };
  return capMap[level] || 10;
};

const academyLevel = academy?.level || 0;
let attributeCap = 10; // Base cap without any academy (Level 0)
attributeCap = getCapForLevel(academyLevel);
```

### Test 2: Verify Training Facility Discount

**Steps**:
1. On robot detail page, note upgrade cost shows ₡2,000 (for level 1→2)
2. Navigate to Facilities page
3. Upgrade Training Facility to Level 1 (costs ₡300,000)
4. Navigate back to robot detail page (or refresh)
5. Check upgrade cost

**Expected Results**:
- ✅ Before upgrade: Shows ₡2,000
- ✅ After Training Facility Level 1: Shows ₡1,900 (5% discount)
- ✅ Formula: `2000 × (1 - (1 × 5 / 100)) = 2000 × 0.95 = 1900`

**Frontend Code** (RobotDetailPage.tsx lines ~534):
```typescript
const baseCost = (currentLevel + 1) * 1000;
const discountPercent = trainingLevel * 5;
const finalCost = Math.floor(baseCost * (1 - discountPercent / 100));
```

**Note**: The visibility change listener (lines 141-155) ensures facilities are re-fetched when navigating back to the page:
```typescript
useEffect(() => {
  fetchRobotAndWeapons();

  const handleVisibilityChange = () => {
    if (!document.hidden) {
      fetchRobotAndWeapons();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [id]);
```

### Test 3: Verify Academy Cap Increases

**Steps**:
1. On robot detail page, note "Combat Systems" shows "Attribute Cap: 10"
2. Navigate to Facilities page
3. Upgrade Combat Training Academy to Level 1 (costs ₡400,000)
4. Navigate back to robot detail page (or refresh)
5. Check cap display

**Expected Results**:
- ✅ Before upgrade: Shows "Attribute Cap: 10"
- ✅ After Combat Training Academy Level 1: Shows "Attribute Cap: 15"
- ✅ Can now upgrade Combat Systems attributes from 10 → 15
- ✅ Trying to upgrade past 15 shows error: "Attribute cap of 15 reached"

**Frontend Code** (RobotDetailPage.tsx lines ~524-526):
```typescript
const academyLevel = academyLevels[academyType];
const attributeCap = getCapForLevel(academyLevel);
// Display shows: Attribute Cap: {attributeCap}
```

### Test 4: Verify All 4 Academies Work

**Combat Training Academy** → Combat Systems (6 attributes):
- Combat Power, Targeting Systems, Critical Systems
- Penetration, Weapon Control, Attack Speed

**Defense Training Academy** → Defensive Systems (5 attributes):
- Armor Plating, Shield Capacity, Evasion Thrusters
- Damage Dampeners, Counter Protocols

**Mobility Training Academy** → Chassis & Mobility (5 attributes):
- Hull Integrity, Servo Motors, Gyro Stabilizers
- Hydraulic Systems, Power Core

**AI Training Academy** → AI Processing + Team Coordination (7 attributes):
- Combat Algorithms, Threat Analysis, Adaptive AI, Logic Cores
- Sync Protocols, Support Systems, Formation Tactics

**Steps**:
1. Upgrade each academy to Level 1
2. Verify respective attribute groups show "Attribute Cap: 15"
3. Verify can upgrade attributes in those groups to 15
4. Verify other groups still capped at 10

## Cap Progression Table

From STABLE_SYSTEM.md:

| Academy Level | Cost      | Prestige | Cap |
|---------------|-----------|----------|-----|
| 0             | -         | -        | 10  |
| 1             | ₡400,000  | 0        | 15  |
| 2             | ₡600,000  | 0        | 20  |
| 3             | ₡800,000  | 2,000    | 25  |
| 4             | ₡1,000,000| 0        | 30  |
| 5             | ₡1,200,000| 4,000    | 35  |
| 6             | ₡1,400,000| 0        | 40  |
| 7             | ₡1,600,000| 7,000    | 42  |
| 8             | ₡1,800,000| 0        | 45  |
| 9             | ₡2,000,000| 10,000   | 48  |
| 10            | ₡2,500,000| 15,000   | 50  |

## Training Facility Discount Table

From STABLE_SYSTEM.md lines 93-100:

| Facility Level | Cost      | Discount | Example Cost (1→2) |
|----------------|-----------|----------|--------------------|
| 0              | -         | 0%       | ₡2,000             |
| 1              | ₡300,000  | 5%       | ₡1,900             |
| 2              | ₡600,000  | 10%      | ₡1,800             |
| 3              | ₡900,000  | 15%      | ₡1,700             |
| 4              | ₡1,200,000| 20%      | ₡1,600             |
| 5              | ₡1,500,000| 25%      | ₡1,500             |

## Success Criteria

All 3 requirements must pass:

1. **✅ Training Facility discount displays correctly**
   - At Level 0: Shows ₡2,000
   - At Level 1: Shows ₡1,900 (5% off)
   - At Level 2: Shows ₡1,800 (10% off)

2. **✅ Training Academy caps enforced correctly**
   - Without academy: Cannot upgrade past level 10
   - With Level 1 academy: Cannot upgrade past level 15
   - With Level 2 academy: Cannot upgrade past level 20
   - All 4 academies work for their respective attribute groups

3. **✅ Attribute cap displays current value**
   - Level 0: Shows "Attribute Cap: 10" (not 50)
   - Level 1: Shows "Attribute Cap: 15" (not 55)
   - Level 2: Shows "Attribute Cap: 20" (not 60)
   - Updates when switching between Facilities and Robot pages

## Code References

**Backend Enforcement**:
- File: `prototype/backend/src/routes/robots.ts`
- Lines: ~312-343 (cap calculation and enforcement)
- Function: `getCapForLevel(level: number)`

**Frontend Display**:
- File: `prototype/frontend/src/pages/RobotDetailPage.tsx`
- Lines: ~88-98 (cap function definition)
- Lines: ~524-526 (cap display calculation)
- Lines: ~141-155 (visibility listener for state refresh)

**Frontend Discount Calculation**:
- File: `prototype/frontend/src/pages/RobotDetailPage.tsx`
- Lines: ~534-536 (discount formula)
- Formula: `baseCost × (1 - (trainingLevel × 5 / 100))`

## Conclusion

All three Milestone 3 requirements are now correctly implemented according to STABLE_SYSTEM.md specifications:
- Caps start at 10 (not 50)
- Caps increase according to exact mapping (10→15→20→25→...)
- Training Facility discount applies correctly
- State refreshes when navigating between pages
