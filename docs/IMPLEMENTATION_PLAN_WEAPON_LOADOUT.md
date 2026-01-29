# Implementation Plan: Weapon Loadout System

**Based on**: PRD_WEAPON_LOADOUT.md  
**Created**: January 29, 2026  
**Status**: Ready for Implementation

---

## Overview

This document provides a sequential implementation plan for the weapon loadout system. Each issue is designed to be completed in order, as later issues depend on earlier ones being completed first.

**Total Estimated Time**: 9-15 days across 10 sequential issues

---

## Dependency Chain

```
Issue 1 (Backend Utils) → Issue 2 (Storage) → Issue 3 (Equipment API) 
    ↓                                              ↓
Issue 4 (Loadout API) ────────────────────→ Issue 5 (Frontend Utils)
    ↓                                              ↓
Issue 6 (Loadout UI) ──────────────────────→ Issue 7 (Equipment UI)
    ↓                                              ↓
Issue 8 (Stat Display) ────────────────────→ Issue 9 (Inventory Page)
    ↓
Issue 10 (Polish & Testing)
```

---

## Issue 1: Backend Core Utilities and Validation

**Priority**: MUST HAVE (Foundation)  
**Estimated Time**: 1-2 days  
**Dependencies**: None

### Description

Create the core backend utilities needed for weapon and loadout management. This includes stat calculation functions, weapon validation logic, and HP/Shield initialization.

### Tasks

- [ ] Create `prototype/backend/src/utils/robotCalculations.ts`
  - Implement `calculateEffectiveStats(robot)` function
  - Implement `calculateMaxHP(hullIntegrity, weaponBonuses, loadoutBonus)` function
  - Implement `calculateMaxShield(shieldCapacity, weaponBonuses, loadoutBonus)` function
  - Implement loadout bonus calculation (weapon_shield, two_handed, dual_wield, single)
- [ ] Create `prototype/backend/src/utils/weaponValidation.ts`
  - Implement `isWeaponCompatibleWithLoadout(weapon, loadoutType)` function
  - Implement `canEquipToSlot(weapon, slot, loadoutType)` function (main/offhand validation)
  - Implement shield restriction validation (offhand only, requires main weapon)
  - Implement one-handed weapon multi-slot validation
- [ ] Update robot creation API to initialize HP/Shield
  - Set `currentHP = maxHP` on creation
  - Set `currentShield = maxShield` on creation
- [ ] Write unit tests for all utility functions
  - Test stat calculations with various weapon combinations
  - Test loadout bonus calculations
  - Test validation rules for all weapon types

### Acceptance Criteria

- ✅ All utility functions pass unit tests
- ✅ Stat calculations match formulas in ROBOT_ATTRIBUTES.md
- ✅ Weapon validation correctly enforces loadout rules
- ✅ New robots initialize with correct HP/Shield values

### Technical Notes

**Reference Documents:**
- ROBOT_ATTRIBUTES.md (for stat calculation formulas)
- WEAPONS_AND_LOADOUT.md (for weapon compatibility rules)

**Loadout Bonuses to Implement:**
- `weapon_shield`: +20% Shield Capacity, +15% Armor Plating, +10% Counter Protocols, -15% Attack Speed
- `two_handed`: +25% Combat Power, +20% Critical Systems, -10% Evasion Thrusters
- `dual_wield`: +30% Attack Speed, +15% Weapon Control, -20% Penetration, -10% Combat Power
- `single`: +10% Gyro Stabilizers, +5% Servo Motors

---

## Issue 2: Storage Capacity Enforcement

**Priority**: MUST HAVE  
**Estimated Time**: 0.5-1 day  
**Dependencies**: Issue 1 (uses validation utilities)

### Description

Implement storage capacity enforcement in the weapon purchase API. Players start with 5 weapon slots and can expand via Storage Facility upgrades.

### Tasks

- [ ] Update weapon purchase API (`POST /api/weapon-inventory/purchase`)
  - Add storage capacity check before purchase
  - Query user's Storage Facility level from database
  - Calculate capacity: `5 + (Storage Facility Level × 5)`
  - Count current weapons owned (equipped + unequipped)
  - Return error if at capacity
- [ ] Add storage capacity calculation function to utils
- [ ] Update error messages to be user-friendly
- [ ] Write integration tests for storage limits
  - Test purchase at capacity
  - Test purchase below capacity
  - Test capacity calculation with different facility levels

### Acceptance Criteria

- ✅ Purchase blocked when storage is full
- ✅ Error message clearly states storage capacity issue
- ✅ Storage calculation correct: 5 base + 5 per facility level
- ✅ Both equipped and unequipped weapons count toward limit

### Technical Notes

**Storage Capacity Formula**: `5 + (Storage Facility Level × 5)`  
**Maximum Capacity**: 55 weapons (Storage Facility Level 10)

**Error Response Example:**
```json
{
  "error": "Storage capacity full",
  "currentWeapons": 15,
  "maxCapacity": 15,
  "message": "Upgrade Storage Facility to increase capacity"
}
```

---

## Issue 3: Weapon Equipment API Endpoints

**Priority**: MUST HAVE (Core Feature)  
**Estimated Time**: 2-3 days  
**Dependencies**: Issues 1, 2

### Description

Implement backend API endpoints for equipping and unequipping weapons to/from robots. This includes main weapon, offhand weapon, and proper validation.

### Tasks

- [ ] Implement `PUT /api/robots/:robotId/equip-main-weapon`
  - Validate weapon belongs to user
  - Validate weapon not equipped to another robot
  - Validate weapon compatible with robot's loadout type
  - Validate shield weapons cannot go in main slot
  - Update robot.mainWeaponId
  - Recalculate and update robot stats (maxHP, maxShield)
  - Return updated robot with weapon details
- [ ] Implement `PUT /api/robots/:robotId/equip-offhand-weapon`
  - Same validations as main weapon
  - Additional: validate loadout supports offhand (weapon_shield, dual_wield)
  - Additional: validate shields can only go in offhand
  - Update robot.offhandWeaponId
  - Recalculate stats
- [ ] Implement `DELETE /api/robots/:robotId/unequip-main-weapon`
  - Set robot.mainWeaponId to null
  - Recalculate stats
  - Return updated robot
- [ ] Implement `DELETE /api/robots/:robotId/unequip-offhand-weapon`
  - Set robot.offhandWeaponId to null
  - Recalculate stats
  - Return updated robot
- [ ] Write integration tests for all endpoints
  - Test successful equipment
  - Test equipment conflicts (weapon already equipped)
  - Test validation failures (incompatible loadout)
  - Test stat recalculation after equipment changes

### Acceptance Criteria

- ✅ All 4 endpoints functional and tested
- ✅ Weapons cannot be equipped to multiple robots
- ✅ Shield restriction enforced (offhand only)
- ✅ Stats recalculate correctly after equipment changes
- ✅ Clear error messages for all validation failures
- ✅ Database transactions prevent data inconsistency

### Technical Notes

**Validation Chain:**
1. User owns weapon
2. Weapon not equipped elsewhere
3. Loadout type supports slot
4. Weapon type compatible with slot
5. Shield has main weapon (if applicable)

**Stat Recalculation:**
- Must recalculate maxHP and maxShield based on effective attributes
- Use functions from Issue 1 utilities

---

## Issue 4: Loadout Type Selection API

**Priority**: MUST HAVE  
**Estimated Time**: 1 day  
**Dependencies**: Issues 1, 3

### Description

Implement API endpoint for changing a robot's loadout type with proper validation of currently equipped weapons.

### Tasks

- [ ] Implement `PUT /api/robots/:robotId/loadout-type`
  - Validate loadout type is valid (single, weapon_shield, two_handed, dual_wield)
  - Check current equipped weapons compatibility with new loadout
  - If incompatible, return error with details of which weapons conflict
  - Update robot.loadoutType
  - Recalculate stats with new loadout bonuses
  - Return updated robot
- [ ] Write comprehensive validation tests
  - Test changing from single to dual_wield (should work)
  - Test changing to two_handed with dual weapons equipped (should fail)
  - Test changing to weapon_shield with no shield (should work)
  - Test stat recalculation with loadout change
- [ ] Add helpful error messages
  - List which weapons are incompatible
  - Suggest unequipping specific weapons

### Acceptance Criteria

- ✅ Loadout type changes when valid
- ✅ Incompatible weapons prevent loadout change
- ✅ Error message identifies conflicting weapons
- ✅ Stats update with new loadout bonuses
- ✅ All 4 loadout types work correctly

### Technical Notes

**Loadout Compatibility Matrix:**
- `single`: One-handed weapon in main, nothing in offhand
- `weapon_shield`: One-handed weapon in main, shield in offhand
- `two_handed`: Two-handed weapon in main, nothing in offhand
- `dual_wield`: One-handed weapon in main, one-handed weapon in offhand

---

## Issue 5: Frontend Robot Stats Utility

**Priority**: MUST HAVE (Frontend Foundation)  
**Estimated Time**: 0.5-1 day  
**Dependencies**: Issue 1 (needs to match backend logic)

### Description

Create the missing `robotStats.ts` utility file that is currently imported but doesn't exist. This handles client-side stat calculations and display formatting.

### Tasks

- [ ] Create `prototype/frontend/src/utils/robotStats.ts`
  - Implement `calculateAttributeBonus(baseValue, weaponBonus, loadoutBonus)` function
  - Implement `getAttributeDisplay(attributeName, value)` function
  - Implement `calculateEffectiveStats(robot)` function (mirror of backend)
  - Implement stat breakdown formatting for UI display
- [ ] Add TypeScript interfaces for stat calculations
- [ ] Write unit tests for frontend stat utilities
- [ ] Ensure calculations match backend exactly

### Acceptance Criteria

- ✅ File exists and compiles without errors
- ✅ Stat calculations match backend implementation
- ✅ Functions are well-typed with TypeScript
- ✅ Unit tests pass

### Technical Notes

This file is currently imported by `RobotDetailPage.tsx` but doesn't exist, causing import errors.

---

## Issue 6: Loadout Selector Component

**Priority**: MUST HAVE (First UI Component)  
**Estimated Time**: 1-2 days  
**Dependencies**: Issues 4, 5

### Description

Create the loadout selector UI component that allows players to choose between the 4 loadout types and displays associated bonuses/penalties.

### Tasks

- [ ] Create `prototype/frontend/src/components/LoadoutSelector.tsx`
  - Radio button group for 4 loadout types
  - Display name, description, and icon for each loadout
  - Show bonuses in green, penalties in red
  - Highlight currently selected loadout
  - Call API to change loadout when selection changes
  - Show validation errors if change fails
  - Add loading state during API call
- [ ] Add loadout type descriptions and tooltips
- [ ] Add visual indicators (icons) for each loadout
- [ ] Handle error cases (incompatible weapons)
- [ ] Write component tests

### Acceptance Criteria

- ✅ Users can select from 4 loadout types
- ✅ Current loadout is visually highlighted
- ✅ Bonuses and penalties are clearly displayed
- ✅ Error messages shown when loadout change fails
- ✅ Component is responsive on mobile
- ✅ Loading states prevent duplicate requests

### Technical Notes

**Loadout Descriptions:**
- **Single**: Balanced approach with mobility bonus
- **Weapon + Shield**: Defensive tank with shield regeneration
- **Two-Handed**: Glass cannon with massive damage
- **Dual-Wield**: Speed demon with rapid attacks

---

## Issue 7: Weapon Equipment UI Components

**Priority**: MUST HAVE (Core UI)  
**Estimated Time**: 2-3 days  
**Dependencies**: Issues 3, 5, 6

### Description

Create the UI components for viewing and equipping weapons on the robot detail page. This includes weapon slots and the weapon selection modal.

### Tasks

- [ ] Create `prototype/frontend/src/components/WeaponSlot.tsx`
  - Display empty slot or equipped weapon
  - Show weapon name, type, damage, bonuses
  - "Equip" button when empty
  - "Change" and "Unequip" buttons when equipped
  - Visual distinction for main vs offhand slot
  - Disabled state based on loadout type
- [ ] Create `prototype/frontend/src/components/WeaponSelectionModal.tsx`
  - List available weapons from user's inventory
  - Filter weapons by compatibility (based on loadout and slot)
  - Show weapon details (damage, cooldown, bonuses)
  - Show if weapon is equipped to another robot (grayed out)
  - "Equip" button for each compatible weapon
  - Filter controls (by weapon type, availability)
  - Search functionality
- [ ] Enhance `RobotDetailPage.tsx`
  - Add weapon equipment section above attributes
  - Integrate LoadoutSelector component
  - Add WeaponSlot components (main and offhand)
  - Handle weapon equipment/unequipment API calls
  - Update robot state after equipment changes
  - Show loading states and error messages
- [ ] Add weapon filtering logic based on loadout
  - Filter by handsRequired (one, two, shield)
  - Filter by loadout compatibility
  - Show clear messages when no compatible weapons
- [ ] Write component tests

### Acceptance Criteria

- ✅ Weapon slots display current equipment
- ✅ Modal shows only compatible weapons
- ✅ Equipped weapons show which robot is using them
- ✅ Users can equip and unequip weapons
- ✅ Error messages are clear and helpful
- ✅ UI updates immediately after equipment changes
- ✅ Components work on mobile devices

### Technical Notes

**Weapon Selection Modal Layout:**
```
┌──────────────────────────────────────┐
│  Select Weapon for Main Slot    [X] │
├──────────────────────────────────────┤
│  Filter: [All] [Energy] [Ballistic]  │
│         [Melee] [Available Only]     │
├──────────────────────────────────────┤
│  ✓ Laser Rifle                       │
│    Energy | Damage: 20               │
│    [Equip]                           │
├──────────────────────────────────────┤
│  ⚠️  Machine Gun                     │
│    Ballistic | Damage: 12            │
│    Equipped to: Striker-01           │
│    [Currently Equipped]              │
└──────────────────────────────────────┘
```

---

## Issue 8: Effective Stats Display with Loadout Bonuses

**Priority**: MUST HAVE (Critical for User Understanding)  
**Estimated Time**: 1-2 days  
**Dependencies**: Issues 5, 6, 7

### Description

Enhance the robot detail page to show effective stats with breakdowns of base attributes, weapon bonuses, and loadout modifiers.

### Tasks

- [ ] Create `prototype/frontend/src/components/StatComparison.tsx`
  - Display base attribute value
  - Display weapon bonuses (+ value from each weapon)
  - Display loadout modifier (percentage)
  - Display final effective value
  - Color code: green for positive, red for negative
  - Expandable/collapsible detail view
- [ ] Update `RobotDetailPage.tsx` stat display
  - Replace current stat display with StatComparison component
  - Show all 23 attributes with breakdowns
  - Update in real-time when weapons/loadout changes
  - Add tooltips explaining calculations
- [ ] Add stat calculation explanations
  - Tooltip showing formula
  - Example: "Base (10) + Weapon (+5) × Loadout (1.2) = 18"
- [ ] Ensure stats update immediately on any change
- [ ] Write component tests

### Acceptance Criteria

- ✅ All attributes show base + weapon + loadout + effective
- ✅ Positive bonuses shown in green, negative in red
- ✅ Stats update immediately when weapons/loadout changes
- ✅ Tooltips explain calculations clearly
- ✅ Mobile-friendly layout
- ✅ Performance is acceptable (no lag when changing equipment)

### Technical Notes

**Display Format:**
```
Combat Power
  Base:     10
  Weapons:  +5  (Laser Rifle +3, Shield +2)
  Loadout:  +25% (Two-Handed)
  ─────────────
  Effective: 18

Shield Capacity  
  Base:     15
  Weapons:  +4  (Combat Shield)
  Loadout:  +20% (Weapon+Shield)
  ─────────────
  Effective: 22
```

---

## Issue 9: Weapon Inventory Management Page

**Priority**: SHOULD HAVE  
**Estimated Time**: 2-3 days  
**Dependencies**: Issues 3, 7, 8

### Description

Create a dedicated page for viewing and managing all owned weapons. Shows which weapons are equipped to which robots and allows quick equipping from inventory.

### Tasks

- [ ] Create `prototype/frontend/src/pages/WeaponInventoryPage.tsx`
  - Display all owned weapons in grid/table layout
  - Show weapon name, type, damage, equipped status
  - Show which robot is using each weapon
  - Organize by weapon type (Energy, Ballistic, Melee, Shield)
  - Show storage capacity usage at top of page
- [ ] Add filtering controls
  - Filter by weapon type (dropdown/tabs)
  - Filter by status (Available, Equipped, All)
  - Search by weapon name
- [ ] Add weapon detail modal
  - Full weapon stats and bonuses
  - Special properties
  - Equip to robot dropdown (if available)
  - Unequip button (if equipped)
- [ ] Add navigation link
  - Update Navigation component with "Weapon Inventory" link
  - Add route in App.tsx
- [ ] Add visual indicators
  - Badge showing "Available" or "Equipped to [Robot]"
  - Color coding by weapon type
  - Storage capacity progress bar
- [ ] Write component tests

### Acceptance Criteria

- ✅ All owned weapons displayed
- ✅ Filtering works correctly
- ✅ Storage capacity clearly shown
- ✅ Users can see which robots use which weapons
- ✅ Quick equip/unequip from inventory
- ✅ Page is accessible from main navigation
- ✅ Responsive on mobile

### Technical Notes

**Page Layout:**
```
┌─────────────────────────────────────────┐
│  Weapon Inventory                       │
│  Storage: 28/35 weapons [========   ]   │
├─────────────────────────────────────────┤
│  [All] [Energy] [Ballistic] [Melee]    │
│  Status: [All ▾] Search: [_______]     │
├─────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐            │
│  │ Laser    │  │ Machine  │            │
│  │ Rifle    │  │ Gun      │            │
│  │ Available│  │ Striker-1│            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

---

## Issue 10: Storage Capacity UI & Purchase Warnings

**Priority**: SHOULD HAVE  
**Estimated Time**: 1-2 days  
**Dependencies**: Issues 2, 9

### Description

Add UI enhancements for storage capacity visibility and warnings when purchasing weapons. This improves user experience and prevents confusion.

### Tasks

- [ ] Update `WeaponShopPage.tsx`
  - Display remaining storage capacity at top of page
  - Show progress bar or counter (e.g., "5 slots remaining")
  - Disable purchase buttons when storage is full
  - Show tooltip explaining storage limits
  - Add confirmation dialog when purchasing duplicate weapons
    - Show message: "You already own this weapon. Purchase another copy?"
    - Show storage info in dialog
- [ ] Update purchase error handling
  - Intercept storage capacity errors from API
  - Display user-friendly error message
  - Suggest upgrading Storage Facility
- [ ] Add storage facility upgrade link
  - Quick link to facilities page when at capacity
- [ ] Update `WeaponInventoryPage.tsx`
  - Ensure storage capacity display is prominent
  - Add tooltip explaining capacity formula
- [ ] Write component tests
  - Test storage display updates
  - Test duplicate purchase dialog
  - Test disabled state when at capacity

### Acceptance Criteria

- ✅ Storage capacity visible in weapon shop
- ✅ Users warned when buying duplicate weapons
- ✅ Purchase disabled when storage is full
- ✅ Clear guidance on how to increase capacity
- ✅ Storage info consistent across all pages

### Technical Notes

**Storage Capacity Display Examples:**
- "5 weapon slots remaining (15/20)"
- Progress bar: `[================    ] 80% full`
- When full: "Storage at capacity. Upgrade Storage Facility to unlock more slots."

---

## Issue 11: Testing, Polish & Edge Cases

**Priority**: NICE TO HAVE (Quality Improvements)  
**Estimated Time**: 1-2 days  
**Dependencies**: All previous issues

### Description

Final polish pass to improve user experience, add visual enhancements, and handle edge cases. This issue focuses on refinement and quality improvements.

### Tasks

- [ ] Add confirmation dialogs for destructive actions
  - Confirm before unequipping weapon with other options
  - Warn if changing loadout will force unequip
- [ ] Add tooltips for loadout bonuses
  - Explain each bonus/penalty in detail
  - Show example calculations
- [ ] Add stat change animations
  - Highlight changed stats in green/red
  - Smooth transitions when stats update
- [ ] Add weapon icons/illustrations
  - Visual representation of each weapon type
  - Weapon type icons (energy, ballistic, melee, shield)
- [ ] Improve mobile responsive layout
  - Optimize weapon selection modal for mobile
  - Stack stat displays vertically on small screens
  - Improve touch targets for buttons
- [ ] Add keyboard shortcuts (optional)
  - Tab through weapon slots
  - Enter to open weapon selection modal
  - Esc to close modals
- [ ] Performance optimization
  - Memoize stat calculations
  - Debounce API calls
  - Lazy load weapon images
- [ ] End-to-end testing
  - Complete user flow: purchase → equip → change loadout → battle
  - Test all weapon types and loadout combinations
  - Test error scenarios
  - Cross-browser testing

### Acceptance Criteria

- ✅ Smooth user experience with no confusion
- ✅ Visually appealing UI with proper icons
- ✅ All edge cases handled gracefully
- ✅ No performance issues with stat recalculation
- ✅ Works across all major browsers
- ✅ Mobile experience is excellent

### Technical Notes

**Edge Cases to Test:**
- Equipping last available weapon to robot
- Changing loadout with weapons equipped
- Deleting robot with weapons equipped
- Purchasing weapon when almost at storage capacity
- Simultaneous equipment attempts (race conditions)

---

## Post-Implementation Checklist

After completing all issues, verify:

- [ ] All 7 user stories are fully functional
- [ ] Backend API endpoints all have integration tests
- [ ] Frontend components all have unit tests
- [ ] End-to-end tests cover main user flows
- [ ] Documentation updated with any implementation changes
- [ ] Code review completed
- [ ] Performance is acceptable (< 200ms for API calls)
- [ ] Security review completed (no data leaks)
- [ ] Mobile experience tested on actual devices
- [ ] Accessibility review completed (keyboard navigation, screen readers)

---

## Success Metrics

Track these KPIs after deployment:

- **Engagement**: % of players who equip at least 1 weapon (target: 90%+)
- **Quality**: Weapon equipment error rate (target: <5%)
- **Performance**: Average API response time (target: <200ms)
- **Usability**: % of loadout changes that succeed (target: 95%+)
- **Storage**: % of players who upgrade Storage Facility (target: 40%+)

---

## Notes for Developers

1. **Test as you go**: Don't wait until the end to write tests
2. **Keep it simple**: Avoid over-engineering, stick to requirements
3. **Mobile first**: Test on mobile throughout development
4. **Ask questions**: If requirements are unclear, ask in issue comments
5. **Document changes**: Update technical docs if implementation differs from design
6. **Performance matters**: Profile stat calculations if they feel slow
7. **Accessibility**: Ensure keyboard navigation and screen reader support

---

## Questions or Issues?

If you encounter problems or have questions during implementation:
1. Check the reference documentation (WEAPONS_AND_LOADOUT.md, ROBOT_ATTRIBUTES.md)
2. Review the PRD for detailed requirements
3. Comment on the GitHub issue for clarification
4. Update this implementation plan if dependencies change

---

**End of Implementation Plan**
