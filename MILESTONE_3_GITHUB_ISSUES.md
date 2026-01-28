# Milestone 3 GitHub Issues

This document contains detailed descriptions for 3 GitHub issues tracking remaining Milestone 3 bugs.

---

## Issue #1: Training Facility discount not displaying on Robot Detail page

### Title
`Training Facility discount not displaying on Robot Detail page`

### Labels
`bug`, `milestone-3`, `frontend`, `state-management`, `high-priority`

### Description

#### Problem
The Training Facility discount is not displaying on the Robot Detail page after upgrading the Training Facility. The page continues to show the full cost (₡2,000) even when Training Facility Level 1 is active, which should show a discounted cost of ₡1,900 (5% discount).

#### Steps to Reproduce
1. Login with player1/password123
2. Create a robot named "Iron Warrior"
3. Navigate to robot detail page and note the upgrade cost: **₡2,000**
4. Navigate to Facilities page
5. Upgrade Training Facility to Level 1 (cost ₡300,000)
6. Navigate back to the robot detail page
7. **Observe**: Upgrade cost still shows **₡2,000**
8. **Expected**: Upgrade cost should show **₡1,900** (5% discount)

#### Expected Behavior (from STABLE_SYSTEM.md lines 93-100)
- **Level 0**: No discount, cost = ₡2,000
- **Level 1**: 5% discount, cost = ₡1,900
- **Level 2**: 10% discount, cost = ₡1,800
- **Level 3**: 15% discount, cost = ₡1,700
- **Level 4**: 20% discount, cost = ₡1,600
- **Level 5**: 25% discount, cost = ₡1,500
- etc.

#### Current Behavior
The discount is calculated correctly in the code (`RobotDetailPage.tsx` line 534-536) but the state doesn't refresh when returning from the Facilities page, causing stale data to be displayed.

#### Root Cause
The `useEffect` hook with `visibilitychange` listener (lines 141-155) was added to re-fetch facility data, but it's not working as expected. The `trainingLevel` state remains at 0 even after upgrading the facility.

#### Code References
- **Frontend**: `prototype/frontend/src/pages/RobotDetailPage.tsx`
  - Line 75: `const [trainingLevel, setTrainingLevel] = useState(0);`
  - Line 197: `setTrainingLevel(trainingFacility?.level || 0);`
  - Line 534-536: Cost calculation with discount
- **Backend**: `prototype/backend/src/routes/robots.ts`
  - Line 264-271: Training Facility discount application

#### Verification Steps
After fix, verify:
1. Upgrade Training Facility to Level 1
2. Return to robot page
3. ✅ Cost shows ₡1,900 (not ₡2,000)
4. Upgrade Training Facility to Level 2
5. Return to robot page
6. ✅ Cost shows ₡1,800 (not ₡2,000 or ₡1,900)

#### Documentation References
- `docs/STABLE_SYSTEM.md` lines 93-100: Training Facility discount percentages
- `MILESTONE_3_VERIFICATION.md` lines 34-52: Test procedure for Training Facility discount

#### Commit History
- Attempted fix in c378ead: Added visibility listener (NOT WORKING)
- Attempted fix in c11692c: Fixed cap mapping (didn't address discount issue)
- Related commits: f607702, 5c63366

---

## Issue #2: Attribute cap display shows theoretical max (50) instead of current cap (10)

### Title
`Attribute cap display shows theoretical max (50) instead of current cap based on facility level`

### Labels
`bug`, `milestone-3`, `frontend`, `UI/UX`, `state-management`, `high-priority`

### Description

#### Problem
The attribute cap display on the Robot Detail page shows the theoretical maximum (50) instead of the current cap based on the actual Training Academy facility level. For example, with no Combat Training Academy (Level 0), it shows "Attribute Cap: 50" when it should show "Attribute Cap: 10".

#### Steps to Reproduce
1. Login with player1/password123
2. Create a robot named "Iron Warrior"
3. Navigate to robot detail page
4. Look at the Combat Systems section header
5. **Observe**: Shows "Attribute Cap: 50 (Upgrade Combat Training Academy to increase)"
6. **Expected**: Should show "Attribute Cap: 10" (since Combat Training Academy is at Level 0)

#### Expected Behavior (from STABLE_SYSTEM.md lines 196-245)
The attribute cap should display the **current** cap based on the academy level:

**Combat Training Academy:**
- **Level 0**: Cap 10 (NOT 50!)
- **Level 1**: Cap 15
- **Level 2**: Cap 20
- **Level 3**: Cap 25
- **Level 4**: Cap 30
- **Level 5**: Cap 35
- **Level 6**: Cap 40
- **Level 7**: Cap 42
- **Level 8**: Cap 45
- **Level 9**: Cap 48
- **Level 10**: Cap 50 (maximum)

**Defense Training Academy:**
- Same progression for Defensive Systems attributes (5 total)

**Mobility Training Academy:**
- Same progression for Chassis & Mobility attributes (5 total)

**AI Training Academy:**
- Same progression for AI Processing + Team Coordination attributes (7 total)

#### Current Behavior
The page displays "Attribute Cap: 50" which is the theoretical maximum at Level 10, not the current cap at Level 0 (which should be 10).

#### Root Cause Analysis
Two issues in `RobotDetailPage.tsx`:

1. **State not updating** (lines 200-205): The `academyLevels` state might not be populated correctly when facilities are fetched
2. **Cap calculation** (line ~524): Uses `getCapForLevel(academyLevel)` but the academy level value might be incorrect

The code was updated in commit c11692c to use the correct cap mapping function `getCapForLevel()`, but the state appears to not be set properly.

#### Code References
- **Frontend**: `prototype/frontend/src/pages/RobotDetailPage.tsx`
  - Lines 76-81: `academyLevels` state initialization
  - Lines 88-98: `getCapForLevel()` function with correct mapping
  - Lines 200-205: State setter for academy levels
  - Line 524: Cap calculation: `const attributeCap = getCapForLevel(academyLevel);`
  - Line 526: Display: Shows attributeCap value

#### Verification Steps
After fix, verify:
1. With no academies (all Level 0):
   - ✅ Combat Systems shows "Attribute Cap: 10"
   - ✅ Defensive Systems shows "Attribute Cap: 10"
   - ✅ Chassis & Mobility shows "Attribute Cap: 10"
   - ✅ AI Processing shows "Attribute Cap: 10"

2. Upgrade Combat Training Academy to Level 1:
   - ✅ Combat Systems shows "Attribute Cap: 15"
   - ✅ Other groups still show "Attribute Cap: 10"

3. Upgrade Combat Training Academy to Level 5:
   - ✅ Combat Systems shows "Attribute Cap: 35"

#### Screenshots Needed
- [ ] Before fix: Showing "Attribute Cap: 50" at Level 0
- [ ] After fix: Showing "Attribute Cap: 10" at Level 0
- [ ] After upgrade: Showing "Attribute Cap: 15" at Level 1

#### Documentation References
- `docs/STABLE_SYSTEM.md` lines 196-245: Training Academy cap progressions
- `MILESTONE_3_VERIFICATION.md` lines 54-85: Test procedures for attribute caps

#### Commit History
- Attempted fix in c11692c: Added correct `getCapForLevel()` mapping (partial fix)
- Attempted fix in c378ead: Added visibility listener (doesn't fix display issue)
- Related commits: 5c63366, f607702

#### Impact
This makes it confusing for players to understand what their current attribute caps are. They see "50" and think they can upgrade to that level, but they'll hit the cap at level 10 and get an error.

---

## Issue #3: Verify Training Academy backend enforcement is working correctly

### Title
`Verify Training Academy backend cap enforcement matches STABLE_SYSTEM.md specifications`

### Labels
`verification-needed`, `milestone-3`, `backend`, `testing`, `medium-priority`

### Description

#### Purpose
Verify that the backend Training Academy cap enforcement implemented in commit c11692c is working correctly according to STABLE_SYSTEM.md specifications.

#### Background
The backend cap enforcement was updated in commit c11692c to use the correct cap mapping:
```typescript
const getCapForLevel = (level: number): number => {
  const capMap: { [key: number]: number } = {
    0: 10, 1: 15, 2: 20, 3: 25, 4: 30,
    5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50
  };
  return capMap[level] || 10;
};
```

#### Test Cases

**Test 1: Base Cap (No Academy)**
1. Create robot
2. Try to upgrade Combat Power from 10 → 11
3. ✅ Should fail with: "Attribute cap of 10 reached. Upgrade Combat Training Academy to increase cap."

**Test 2: Level 1 Academy**
1. Upgrade Combat Training Academy to Level 1
2. Try to upgrade Combat Power from 15 → 16
3. ✅ Should fail with: "Attribute cap of 15 reached. Upgrade Combat Training Academy to increase cap."

**Test 3: All 4 Academies**
Verify each academy controls its attribute group:
- Combat Training Academy → Combat Systems (6 attributes)
- Defense Training Academy → Defensive Systems (5 attributes)
- Mobility Training Academy → Chassis & Mobility (5 attributes)
- AI Training Academy → AI Processing + Team Coordination (7 attributes)

**Test 4: Cap Progression**
Test several cap levels: 10, 15, 20, 25, 30, 35, 40, 42, 45, 48, 50

#### Code References
- **Backend**: `prototype/backend/src/routes/robots.ts`
  - Lines 312-343: Cap enforcement logic
  - Lines 298-311: `attributeToAcademy` mapping
  - Lines 300-304: `getCapForLevel()` function

#### Expected Behavior
Backend should enforce caps exactly as specified in STABLE_SYSTEM.md:
- Level 0 → Cap 10
- Level 1 → Cap 15
- Level 2 → Cap 20
- etc.

#### Documentation References
- `docs/STABLE_SYSTEM.md` lines 196-245: Training Academy specifications
- `MILESTONE_3_VERIFICATION.md`: Testing procedures

#### Success Criteria
- [ ] All attributes capped at 10 without academy
- [ ] Each academy level correctly increases cap for its attribute group
- [ ] Clear error messages when cap is reached
- [ ] All 4 academies work independently

---

## Summary

These 3 issues track the remaining Milestone 3 bugs:

1. **Issue #1** (Frontend - State): Training Facility discount not updating
2. **Issue #2** (Frontend - Display): Attribute caps showing wrong values
3. **Issue #3** (Backend - Verification): Confirm backend enforcement works

All issues reference:
- Source code with line numbers
- STABLE_SYSTEM.md documentation
- Commit history of attempted fixes
- Detailed verification steps

**Next Step**: Create these issues on GitHub and assign to developers.
