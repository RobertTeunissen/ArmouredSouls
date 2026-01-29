# GitHub Issues: Weapon Loadout System Implementation

**Instructions**: Copy each issue below and create it in GitHub. Issues should be completed in order due to dependencies.

---

## Issue #1: Backend Core Utilities and Validation

**Labels**: `backend`, `foundation`, `must-have`  
**Milestone**: Weapon Loadout System  
**Estimate**: 1-2 days

### Description

Create the core backend utilities needed for weapon and loadout management. This includes stat calculation functions, weapon validation logic, and HP/Shield initialization.

This is the foundation for all weapon equipment functionality.

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

### Acceptance Criteria

- ✅ All utility functions pass unit tests
- ✅ Stat calculations match formulas in ROBOT_ATTRIBUTES.md
- ✅ Weapon validation correctly enforces loadout rules
- ✅ New robots initialize with correct HP/Shield values

### Reference Documents

- docs/ROBOT_ATTRIBUTES.md (for stat calculation formulas)
- docs/WEAPONS_AND_LOADOUT.md (for weapon compatibility rules)

### Dependencies

None - this is the foundation issue

---

## Issue #2: Storage Capacity Enforcement

**Labels**: `backend`, `validation`, `must-have`  
**Milestone**: Weapon Loadout System  
**Estimate**: 0.5-1 day

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

### Acceptance Criteria

- ✅ Purchase blocked when storage is full
- ✅ Error message clearly states storage capacity issue
- ✅ Storage calculation correct: 5 base + 5 per facility level
- ✅ Both equipped and unequipped weapons count toward limit

### Technical Notes

**Storage Capacity Formula**: `5 + (Storage Facility Level × 5)`  
**Maximum Capacity**: 55 weapons (Storage Facility Level 10)

### Dependencies

- Issue #1 (uses validation utilities)

---

## Issue #3: Weapon Equipment API Endpoints

**Labels**: `backend`, `api`, `must-have`  
**Milestone**: Weapon Loadout System  
**Estimate**: 2-3 days

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
- [ ] Implement `DELETE /api/robots/:robotId/unequip-offhand-weapon`
  - Set robot.offhandWeaponId to null
  - Recalculate stats
- [ ] Write integration tests for all endpoints

### Acceptance Criteria

- ✅ All 4 endpoints functional and tested
- ✅ Weapons cannot be equipped to multiple robots
- ✅ Shield restriction enforced (offhand only)
- ✅ Stats recalculate correctly after equipment changes
- ✅ Clear error messages for all validation failures
- ✅ Database transactions prevent data inconsistency

### Dependencies

- Issue #1 (stat calculations)
- Issue #2 (validation)

---

## Issue #4: Loadout Type Selection API

**Labels**: `backend`, `api`, `must-have`  
**Milestone**: Weapon Loadout System  
**Estimate**: 1 day

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
- [ ] Add helpful error messages

### Acceptance Criteria

- ✅ Loadout type changes when valid
- ✅ Incompatible weapons prevent loadout change
- ✅ Error message identifies conflicting weapons
- ✅ Stats update with new loadout bonuses
- ✅ All 4 loadout types work correctly

### Dependencies

- Issue #1 (validation logic)
- Issue #3 (equipment endpoints)

---

## Issue #5: Frontend Robot Stats Utility

**Labels**: `frontend`, `utils`, `must-have`  
**Milestone**: Weapon Loadout System  
**Estimate**: 0.5-1 day

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

This file is currently imported by `RobotDetailPage.tsx` but doesn't exist.

### Dependencies

- Issue #1 (needs to match backend logic)

---

## Issue #6: Loadout Selector Component

**Labels**: `frontend`, `component`, `must-have`  
**Milestone**: Weapon Loadout System  
**Estimate**: 1-2 days

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

### Dependencies

- Issue #4 (loadout API)
- Issue #5 (frontend utils)

---

## Issue #7: Weapon Equipment UI Components

**Labels**: `frontend`, `component`, `must-have`  
**Milestone**: Weapon Loadout System  
**Estimate**: 2-3 days

### Description

Create the UI components for viewing and equipping weapons on the robot detail page. This includes weapon slots and the weapon selection modal.

### Tasks

- [ ] Create `prototype/frontend/src/components/WeaponSlot.tsx`
  - Display empty slot or equipped weapon
  - Show weapon name, type, damage, bonuses
  - "Equip" button when empty
  - "Change" and "Unequip" buttons when equipped
- [ ] Create `prototype/frontend/src/components/WeaponSelectionModal.tsx`
  - List available weapons from user's inventory
  - Filter weapons by compatibility (based on loadout and slot)
  - Show weapon details
  - Show if weapon is equipped to another robot
  - "Equip" button for each compatible weapon
- [ ] Enhance `RobotDetailPage.tsx`
  - Add weapon equipment section above attributes
  - Integrate LoadoutSelector component
  - Add WeaponSlot components (main and offhand)
  - Handle weapon equipment/unequipment API calls
  - Show loading states and error messages
- [ ] Add weapon filtering logic based on loadout
- [ ] Write component tests

### Acceptance Criteria

- ✅ Weapon slots display current equipment
- ✅ Modal shows only compatible weapons
- ✅ Equipped weapons show which robot is using them
- ✅ Users can equip and unequip weapons
- ✅ Error messages are clear and helpful
- ✅ UI updates immediately after equipment changes
- ✅ Components work on mobile devices

### Dependencies

- Issue #3 (equipment API)
- Issue #5 (frontend utils)
- Issue #6 (loadout selector)

---

## Issue #8: Effective Stats Display with Loadout Bonuses

**Labels**: `frontend`, `ui`, `must-have`  
**Milestone**: Weapon Loadout System  
**Estimate**: 1-2 days

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
- [ ] Write component tests

### Acceptance Criteria

- ✅ All attributes show base + weapon + loadout + effective
- ✅ Positive bonuses shown in green, negative in red
- ✅ Stats update immediately when weapons/loadout changes
- ✅ Tooltips explain calculations clearly
- ✅ Mobile-friendly layout

### Dependencies

- Issue #5 (frontend utils)
- Issue #6 (loadout selector)
- Issue #7 (weapon equipment)

---

## Issue #9: Weapon Inventory Management Page

**Labels**: `frontend`, `page`, `should-have`  
**Milestone**: Weapon Loadout System  
**Estimate**: 2-3 days

### Description

Create a dedicated page for viewing and managing all owned weapons. Shows which weapons are equipped to which robots and allows quick equipping from inventory.

### Tasks

- [ ] Create `prototype/frontend/src/pages/WeaponInventoryPage.tsx`
  - Display all owned weapons in grid/table layout
  - Show weapon name, type, damage, equipped status
  - Show which robot is using each weapon
  - Organize by weapon type
  - Show storage capacity usage at top of page
- [ ] Add filtering controls
  - Filter by weapon type
  - Filter by status (Available, Equipped, All)
  - Search by weapon name
- [ ] Add weapon detail modal
  - Full weapon stats and bonuses
  - Equip to robot dropdown (if available)
  - Unequip button (if equipped)
- [ ] Add navigation link
  - Update Navigation component
  - Add route in App.tsx
- [ ] Add visual indicators
- [ ] Write component tests

### Acceptance Criteria

- ✅ All owned weapons displayed
- ✅ Filtering works correctly
- ✅ Storage capacity clearly shown
- ✅ Users can see which robots use which weapons
- ✅ Quick equip/unequip from inventory
- ✅ Page is accessible from main navigation
- ✅ Responsive on mobile

### Dependencies

- Issue #3 (equipment API)
- Issue #7 (weapon components)
- Issue #8 (stat display)

---

## Issue #10: Storage Capacity UI & Purchase Warnings

**Labels**: `frontend`, `ux`, `should-have`  
**Milestone**: Weapon Loadout System  
**Estimate**: 1-2 days

### Description

Add UI enhancements for storage capacity visibility and warnings when purchasing weapons.

### Tasks

- [ ] Update `WeaponShopPage.tsx`
  - Display remaining storage capacity at top of page
  - Show progress bar or counter
  - Disable purchase buttons when storage is full
  - Show tooltip explaining storage limits
  - Add confirmation dialog when purchasing duplicate weapons
- [ ] Update purchase error handling
  - Display user-friendly error message
  - Suggest upgrading Storage Facility
- [ ] Add storage facility upgrade link
- [ ] Update `WeaponInventoryPage.tsx` storage display
- [ ] Write component tests

### Acceptance Criteria

- ✅ Storage capacity visible in weapon shop
- ✅ Users warned when buying duplicate weapons
- ✅ Purchase disabled when storage is full
- ✅ Clear guidance on how to increase capacity
- ✅ Storage info consistent across all pages

### Dependencies

- Issue #2 (storage API)
- Issue #9 (inventory page)

---

## Issue #11: Testing, Polish & Edge Cases

**Labels**: `quality`, `testing`, `nice-to-have`  
**Milestone**: Weapon Loadout System  
**Estimate**: 1-2 days

### Description

Final polish pass to improve user experience, add visual enhancements, and handle edge cases.

### Tasks

- [ ] Add confirmation dialogs for destructive actions
- [ ] Add tooltips for loadout bonuses
- [ ] Add stat change animations
- [ ] Add weapon icons/illustrations
- [ ] Improve mobile responsive layout
- [ ] Add keyboard shortcuts (optional)
- [ ] Performance optimization
  - Memoize stat calculations
  - Debounce API calls
- [ ] End-to-end testing
  - Complete user flow testing
  - Test all weapon types and loadout combinations
  - Test error scenarios
  - Cross-browser testing

### Acceptance Criteria

- ✅ Smooth user experience with no confusion
- ✅ Visually appealing UI with proper icons
- ✅ All edge cases handled gracefully
- ✅ No performance issues
- ✅ Works across all major browsers
- ✅ Mobile experience is excellent

### Dependencies

- All previous issues

---

**End of Issues List**

## Issue Creation Notes

1. Create issues in the order listed (1-11)
2. Each issue references its dependencies
3. Don't start an issue until its dependencies are complete
4. Link issues to the PRD document in the repository
5. Update issue status as work progresses
6. Close issues only after acceptance criteria are met and tested
