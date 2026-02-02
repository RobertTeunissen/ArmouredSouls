# My Robots Page v1.7 Fixes - Visual Mockup

**Version**: 1.7  
**Date**: February 2, 2026  
**Status**: Implemented (Pending Live Testing)

---

## Executive Summary

This document provides visual mockups and detailed explanations of the v1.7 fixes for the My Robots page, specifically addressing:
1. **Roster Expansion capacity not updating** after facility upgrades
2. **Repair All button accessibility** and user feedback

---

## Fix #1: Roster Expansion Capacity Updates Dynamically

### Problem Before Fix

**User Journey**:
1. Visit `/robots` → Shows "My Robots (0/1)"
2. Create first robot → Shows "My Robots (1/1)", Create button disabled ✅
3. Navigate to `/facilities`, upgrade Roster Expansion to Level 1
4. Navigate back to `/robots` → **Still shows "My Robots (1/1)"** ❌ 
5. Create button still disabled ❌

**Why it failed**: Facilities were only fetched on initial component mount, not when navigating back to the page.

### Solution Implemented

**Code Change**: Added `location` dependency to useEffect + window focus handler
- Facilities refetch when navigating to the page
- Also refetch when window regains focus (safety mechanism)

### Visual Mockup - After Fix

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏠 Navigation Bar                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  My Robots (1/2)              🔧 Repair All     + Create New Robot│
│  ^^^^^^^^^^                   [Disabled]         [Enabled ✅]     │
│  Now shows Level 1                                               │
│  capacity correctly!                                             │
│                                                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │ 🤖 Battle Master                            │                │
│  │ ELO: 1620 │ Silver │ LP: 45                 │                │
│  │ ──────────────────────────────────────      │ HP: 100%       │
│  │ ██████████████████████████████████████      │ Shield: 100%   │
│  │ 23W-12L-3D (65.7%)                          │                │
│  │ 100% │ Battle Ready                         │                │
│  │ Main: Plasma Rifle                          │                │
│  │                            [View Details >] │                │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Test Scenarios

#### Scenario 1: Roster Expansion Level 0 (Default)
```
My Robots (0/1)
- 0 robots created
- Capacity: 1 (level 0 + 1)
- Create button: ENABLED ✅
```

#### Scenario 2: First Robot Created
```
My Robots (1/1)
- 1 robot created
- Capacity: 1 (level 0 + 1)
- Create button: DISABLED ✅ (at capacity)
- Tooltip: "Robot limit reached (1). Upgrade Roster Expansion facility..."
```

#### Scenario 3: After Upgrading to Level 1
```
My Robots (1/2)  ✅ FIXED!
- 1 robot created
- Capacity: 2 (level 1 + 1)
- Create button: ENABLED ✅ (room for 1 more)
- User can now create second robot
```

#### Scenario 4: After Upgrading to Level 2
```
My Robots (1/3)  ✅ FIXED!
- 1 robot created
- Capacity: 3 (level 2 + 1)
- Create button: ENABLED ✅ (room for 2 more)
```

#### Scenario 5: Multiple Robots, High Level
```
My Robots (10/11)  ✅ FIXED!
- 10 robots created
- Capacity: 11 (level 10 + 1)
- Create button: ENABLED ✅ (room for 1 more)
```

### Capacity Formula

```
maxRobots = rosterLevel + 1

Examples:
- Level 0: 1 robot (free)
- Level 1: 2 robots
- Level 2: 3 robots
- Level 5: 6 robots
- Level 10: 11 robots
- Level 20: 21 robots
```

---

## Fix #2: Repair All Button - Debug Logging & Investigation

### Problem Reported

**User Report**: "Repair All button still not accessible, even with 1 robot in the stable."

**Current Behavior**: Button visible but disabled (grayed out)

### Investigation Results

**Button Logic** (All correct):
```typescript
// Button shows when: robots.length > 0 ✅
// Button enabled when: needsRepair === true ✅
// needsRepair = discountedCost > 0 ✅
// discountedCost calculated from robot.repairCost field ✅
```

**Expected Behavior**:
- New robots: `repairCost = 0` → Button disabled ✅ CORRECT
- Damaged robots: `repairCost > 0` → Button enabled ✅ CORRECT

### Debug Logging Added

**Console Output** (when page loads):
```javascript
Fetched robots: {
  count: 1,
  robots: [
    {
      id: 123,
      name: "Battle Master",
      currentHP: 1000,
      maxHP: 1000,
      repairCost: 0  // <-- NEW robots have 0 repair cost
    }
  ]
}

Repair cost calculation: {
  robotCount: 1,
  robotsWithRepairCost: 0,  // <-- No robots need repair
  totalBaseCost: 0,
  discount: 0,
  discountedCost: 0,
  repairBayLevel: 0
}
```

### Visual States

#### State 1: No Repairs Needed (New Robot)
```
┌─────────────────────────────────────────────────────────────────┐
│  My Robots (1/1)      🔧 Repair All     + Create New Robot      │
│                       [──────────]       [─────────────]         │
│                       DISABLED ✅         DISABLED ✅             │
│                       (gray, no cost)    (at capacity)           │
│                                                                  │
│  Robot: Battle Master                                           │
│  HP: 100% │ Shield: 100%                                        │
│  Status: Battle Ready ✅                                        │
└─────────────────────────────────────────────────────────────────┘

User Experience:
- Repair button is gray/disabled
- No cost displayed
- Hover shows: "No repairs needed"
- This is CORRECT behavior! ✅
```

#### State 2: Repairs Needed (Damaged Robot)
```
┌─────────────────────────────────────────────────────────────────┐
│  My Robots (1/1)      🔧 Repair All: ₡15,000 (25% off)          │
│                       [═══════════════════════]                  │
│                       ENABLED ✅ (orange button)                 │
│                       Click to repair all robots                 │
│                                                                  │
│  Robot: Battle Master                                           │
│  HP: 60% (600/1000) │ Shield: 100%                              │
│  Status: Damaged (Low HP) ⚠️                                    │
└─────────────────────────────────────────────────────────────────┘

Console Output:
Repair cost calculation: {
  robotCount: 1,
  robotsWithRepairCost: 1,  // <-- 1 robot needs repair
  totalBaseCost: 20000,     // <-- 400 HP × 50 credits/HP
  discount: 25,             // <-- 25% off (Repair Bay Level 5)
  discountedCost: 15000,    // <-- Final cost
  repairBayLevel: 5
}

User Experience:
- Repair button is orange and clickable ✅
- Shows cost with discount
- Hover shows full details
- Click opens confirmation dialog
- This is CORRECT behavior! ✅
```

#### State 3: Multiple Robots, Mixed States
```
┌─────────────────────────────────────────────────────────────────┐
│  My Robots (3/5)      🔧 Repair All: ₡45,000 (25% off)          │
│                       [═══════════════════════]                  │
│                       ENABLED ✅ (orange button)                 │
│                                                                  │
│  Robot 1: Battle Master - HP: 100% - Battle Ready ✅            │
│  Robot 2: Iron Fist - HP: 60% - Damaged (Low HP) ⚠️            │
│  Robot 3: Thunder Bolt - HP: 30% - Critical (Low HP) 🔴         │
└─────────────────────────────────────────────────────────────────┘

Calculation:
- Robot 1: repairCost = 0 (full HP)
- Robot 2: repairCost = 20,000 (40% damaged)
- Robot 3: repairCost = 35,000 (70% damaged)
- Total: 55,000 base → 41,250 after 25% discount

User Experience:
- Button shows total cost for ALL damaged robots
- Clicking repairs ALL robots at once
- Disabled robots skip repair (no cost)
```

### Why Button Might Appear "Not Accessible"

**Possible Scenarios**:

1. **User has only NEW robots** (never been in battle):
   - `repairCost = 0` for all robots
   - Button correctly disabled
   - User might expect it to be enabled anyway
   - **Solution**: This is correct behavior ✅

2. **Damage system not setting repairCost**:
   - Robots take damage in battles
   - But `repairCost` field not updated
   - Button stays disabled even when HP < 100%
   - **Solution**: Need to check battle system (Phase 2 work)

3. **User doesn't understand why it's disabled**:
   - Button is gray with no explanation
   - User doesn't know repairs aren't needed
   - **Solution**: Debug logging helps, but UI could be clearer

### Improved Button Text (Future Enhancement)

```typescript
// Current: "🔧 Repair All" or "🔧 Repair All: ₡15,000 (25% off)"
// Better: Always show status

{needsRepair ? (
  <button>🔧 Repair All: ₡{cost} ({discount}% off)</button>
) : (
  <button disabled>🔧 Repair All (No Repairs Needed)</button>
)}
```

---

## Testing Instructions

### Manual Testing Steps

**Test 1: Roster Expansion Fix**
1. Start backend and frontend servers
2. Login with test account
3. Visit `/robots` → Note capacity display (e.g., "0/1")
4. Create a robot → Capacity should update (e.g., "1/1")
5. Navigate to `/facilities`
6. Upgrade Roster Expansion to Level 1
7. Navigate back to `/robots`
8. **VERIFY**: Capacity now shows "1/2" ✅
9. Create button should be enabled ✅

**Test 2: Roster Expansion Multiple Levels**
1. Continue from Test 1
2. Navigate to `/facilities`
3. Upgrade Roster Expansion to Level 2
4. Navigate back to `/robots`
5. **VERIFY**: Capacity now shows "1/3" ✅

**Test 3: Repair All with New Robot**
1. Create a new robot (full HP)
2. Visit `/robots`
3. **VERIFY**: Repair All button visible but disabled (gray) ✅
4. **VERIFY**: Hover shows "No repairs needed" ✅
5. Open browser console
6. **VERIFY**: See log: `robotsWithRepairCost: 0` ✅

**Test 4: Repair All with Damaged Robot**
1. Damage a robot (via admin endpoint or battle)
2. Visit `/robots`
3. **VERIFY**: Repair All button visible and enabled (orange) ✅
4. **VERIFY**: Button shows cost (e.g., "₡15,000 (25% off)") ✅
5. Open browser console
6. **VERIFY**: See log: `robotsWithRepairCost: 1` ✅
7. **VERIFY**: See log: `totalBaseCost > 0` ✅
8. Click Repair All button
9. **VERIFY**: Confirmation dialog appears ✅
10. Confirm repair
11. **VERIFY**: Robots HP restored to 100% ✅
12. **VERIFY**: Credits deducted ✅
13. **VERIFY**: Button becomes disabled again ✅

### Console Debug Output

**When page loads, you should see**:
```
Fetched robots: { count: X, robots: [...] }
Repair cost calculation: { robotCount: X, robotsWithRepairCost: Y, ... }
```

**Example outputs**:

**New robot (no repairs needed)**:
```
Fetched robots: {
  count: 1,
  robots: [{ id: 1, name: "Bot1", currentHP: 1000, maxHP: 1000, repairCost: 0 }]
}
Repair cost calculation: {
  robotCount: 1,
  robotsWithRepairCost: 0,
  totalBaseCost: 0,
  discount: 0,
  discountedCost: 0,
  repairBayLevel: 0
}
```

**Damaged robot (repairs needed)**:
```
Fetched robots: {
  count: 1,
  robots: [{ id: 1, name: "Bot1", currentHP: 600, maxHP: 1000, repairCost: 20000 }]
}
Repair cost calculation: {
  robotCount: 1,
  robotsWithRepairCost: 1,
  totalBaseCost: 20000,
  discount: 25,
  discountedCost: 15000,
  repairBayLevel: 5
}
```

---

## Screenshot Checklist

### Before & After Screenshots Needed

**Screenshot 1: Roster Expansion Level 0**
- Show: "My Robots (0/1)"
- Show: Create button enabled
- Caption: "Initial state with no robots"

**Screenshot 2: First Robot Created**
- Show: "My Robots (1/1)"
- Show: Create button disabled
- Caption: "At capacity with Roster Expansion Level 0"

**Screenshot 3: After Upgrading to Level 1**
- Show: "My Robots (1/2)"  ← **KEY SCREENSHOT**
- Show: Create button enabled
- Caption: "Capacity updated after upgrade to Level 1"

**Screenshot 4: Repair All Disabled (No Repairs)**
- Show: Gray Repair All button
- Show: Robot with 100% HP
- Show: Browser console with debug log
- Caption: "Button disabled when no repairs needed"

**Screenshot 5: Repair All Enabled (Repairs Needed)**
- Show: Orange Repair All button with cost
- Show: Robot with <100% HP
- Show: Browser console with debug log
- Caption: "Button enabled when repairs needed"

**Screenshot 6: After Repair**
- Show: Gray Repair All button again
- Show: Robot with 100% HP restored
- Show: Credits deducted
- Caption: "After successful repair"

---

## Success Criteria

### Fix #1: Roster Expansion
- [x] Code updated to refetch facilities on navigation
- [x] Added location dependency to useEffect
- [x] Added window focus handler for safety
- [ ] Live test: Upgrade facility and verify capacity updates
- [ ] Screenshot: Capacity shows correct value after upgrade

### Fix #2: Repair All Button
- [x] Code already correct (no changes needed)
- [x] Added debug logging to investigate user reports
- [ ] Live test: Verify button enabled with damaged robots
- [ ] Live test: Verify button disabled with healthy robots
- [ ] Screenshot: Button in both enabled and disabled states

---

## Related Documentation

- **PRD**: PRD_MY_ROBOTS_LIST_PAGE.md (v1.7 pending)
- **Changes**: MY_ROBOTS_PAGE_V1_7_CHANGES.md (to be created)
- **Backend**: /prototype/backend/src/routes/robots.ts (repair-all endpoint)
- **Frontend**: /prototype/frontend/src/pages/RobotsPage.tsx (updated)

---

## Notes for Reviewer

1. **Roster Expansion fix is implemented** and should work correctly
2. **Repair All button logic is already correct** - user report may be due to:
   - Testing with new robots (repairCost = 0 is expected)
   - Damage system not setting repairCost field (Phase 2 work)
3. **Debug logging added** to help diagnose any issues
4. **Screenshots required** to prove fixes work in live environment
5. **Live testing required** to verify both fixes

---

**End of Document**
