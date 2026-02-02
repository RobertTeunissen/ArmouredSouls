# Product Requirements Document: Working Weapon Loadout System

**Last Updated**: January 29, 2026  
**Status**: Implementation Ready  
**Owner**: Robert Teunissen  
**Epic**: Weapon & Loadout System Implementation

---

## Executive Summary

This PRD defines the requirements for implementing a fully functional weapon loadout system for Armoured Souls Phase 1 prototype. The system will enable players to purchase weapons, manage their weapon inventory, equip weapons to robots, configure loadout types (single, weapon+shield, two-handed, dual-wield), and see the tactical impact of their choices reflected in combat statistics.

**Success Criteria**: Players can purchase weapons from the shop, equip them to robots through an intuitive interface, switch between loadout configurations, and see accurate stat calculations reflecting weapon bonuses and loadout modifiers.

---

## Background & Context

### Current State

**What Exists:**
- ✅ Complete database schema (Weapon, WeaponInventory, Robot models with all fields)
- ✅ Comprehensive design documentation (WEAPONS_AND_LOADOUT.md, ROBOT_ATTRIBUTES.md)
- ✅ 11 weapons defined with complete specifications across 4 categories
- ✅ Backend API: GET /api/weapons (list all weapons)
- ✅ Backend API: POST /api/weapon-inventory/purchase (purchase weapon)
- ✅ Backend API: GET /api/weapon-inventory (get user's weapon inventory)
- ✅ Frontend: WeaponShopPage (displays and allows purchasing weapons)
- ✅ Weapon Workshop discount system (5% per level, up to 50%)

**What's Missing:**
- ❌ Weapon equipping/unequipping functionality (backend + frontend)
- ❌ Loadout type selection and validation
- ❌ Weapon slot management (main weapon vs offhand weapon)
- ❌ Real-time stat calculation showing weapon bonuses
- ❌ Loadout configuration UI on robot detail page
- ❌ Weapon compatibility validation (loadout type restrictions)
- ❌ Visual feedback for equipped weapons
- ❌ Inventory management page (view all weapons, see which robots use them)
- ❌ Unequip functionality (remove weapon from robot)

### Design References

- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**: Complete weapon system specification
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)**: Robot attributes and loadout bonuses
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)**: Database structure

---

## Goals & Objectives

### Primary Goals

1. **Enable Complete Weapon Lifecycle**: Purchase → Equip → Configure → View Stats → Battle → Unequip
2. **Implement 4 Loadout Types**: Single, Weapon+Shield, Two-Handed, Dual-Wield with proper validation
3. **Accurate Stat Calculations**: Weapon bonuses + loadout modifiers displayed in real-time
4. **Intuitive UX**: Clear visual feedback for weapon status and equipment options

### Success Metrics

- Players can successfully equip and unequip weapons without errors
- Loadout type restrictions are properly enforced (e.g., two-handed weapons can't be dual-wielded)
- Stat displays show correct bonuses from weapons and loadouts
- 90%+ of weapon transactions complete without user confusion or bugs

### Non-Goals (Out of Scope for This PRD)

- ❌ Battle simulation engine (separate epic)
- ❌ Weapon crafting system (future phase)
- ❌ Weapon modifications/upgrades (future phase)
- ❌ Advanced weapon properties (damage type effectiveness, special abilities)

**Note**: Storage capacity enforcement was originally listed as out of scope but has been moved into Phase 1 based on product owner decision.

---

## User Stories

### Epic: Weapon Equipment Management

**US-1: Equip Weapon to Robot (Main Slot)**
```
As a player
I want to equip a weapon from my inventory to my robot's main weapon slot
So that my robot can use that weapon in battle and gain its attribute bonuses

Acceptance Criteria:
- I can view my available weapons when on the robot detail page
- I can see which weapons are already equipped to other robots
- I can select a weapon and assign it to the main weapon slot
- The weapon is removed from the "available" list after equipping
- The robot's stats update immediately to show weapon bonuses
- The weapon is marked as "equipped to [Robot Name]" in my inventory
```

**US-2: Equip Offhand Weapon/Shield**
```
As a player
I want to equip a second weapon or shield to my robot's offhand slot
So that I can use dual-wield or weapon+shield loadout configurations

Acceptance Criteria:
- I can equip an offhand weapon if my loadout type allows it
- Shield-type weapons can only be equipped in offhand slot with "weapon_shield" loadout
- Dual-wield loadout allows two one-handed weapons
- System prevents invalid combinations (e.g., two-handed weapon with offhand)
- Stats update to reflect both weapons' bonuses
```

**US-3: Unequip Weapon from Robot**
```
As a player
I want to unequip a weapon from my robot
So that I can use that weapon on a different robot or change my loadout

Acceptance Criteria:
- I can unequip the main weapon, freeing it for other robots
- I can unequip the offhand weapon independently
- The weapon returns to "available" status in my inventory
- Robot stats update immediately to remove weapon bonuses
- No confirmation required (reversible action)
```

**US-4: Change Robot Loadout Type**
```
As a player
I want to change my robot's loadout type (single, weapon+shield, two-handed, dual-wield)
So that I can experiment with different tactical approaches

Acceptance Criteria:
- I can select loadout type from a dropdown/radio button on robot detail page
- System validates that current equipped weapons are compatible with new loadout
- If weapons are incompatible, I see a warning and must unequip them first
- Loadout bonuses/penalties are displayed clearly for each option
- Stats update immediately when loadout type changes
```

**US-5: View Weapon Inventory**
```
As a player
I want to view all weapons I own in one place
So that I can see what I have and which robots are using them

Acceptance Criteria:
- I can navigate to a Weapon Inventory page
- I see all weapons I've purchased, organized by category
- Each weapon shows: name, type, equipped status, and which robot is using it
- I can click on a weapon to see full details and equip options
- I can filter by weapon type or equipped status
- I can see my current storage capacity usage (e.g., "28/35 weapons")
```

**US-6: View Effective Stats with Loadout**
```
As a player
I want to see my robot's effective combat stats including weapon and loadout bonuses
So that I understand my robot's actual combat capabilities

Acceptance Criteria:
- Robot detail page shows base attributes, weapon bonuses, and loadout modifiers separately
- Final "effective" stats are clearly displayed (base + weapon + loadout)
- Positive bonuses shown in green, negative in red
- Tooltip or expandable section explains stat calculation
- Stats update in real-time when weapons or loadout changes
```

**US-7: Storage Capacity Management**
```
As a player
I want to see my weapon storage capacity and be prevented from exceeding it
So that I can manage my weapon inventory and know when to upgrade storage

Acceptance Criteria:
- Weapon shop displays remaining storage capacity (e.g., "5 slots remaining")
- Purchase button is disabled when storage is full
- Clear error message when attempting to purchase with full storage
- Weapon inventory page shows total capacity and current usage
- If purchasing duplicate weapon, show confirmation dialog with storage info
```

---

## Functional Requirements

### FR-1: Weapon Equipment API

**Backend Endpoints Required:**

```
PUT /api/robots/:robotId/equip-main-weapon
Body: { weaponInventoryId: number }
- Validates weapon belongs to user
- Validates weapon is not equipped to another robot
- Validates weapon is compatible with robot's loadout type
- Updates robot.mainWeaponId
- Recalculates and updates robot stats (maxHP, maxShield)
- Returns updated robot with weapon details

PUT /api/robots/:robotId/equip-offhand-weapon
Body: { weaponInventoryId: number }
- Same validations as main weapon
- Additional validation: loadout type supports offhand (weapon_shield, dual_wield)
- Updates robot.offhandWeaponId
- Recalculates stats
- Returns updated robot

DELETE /api/robots/:robotId/unequip-main-weapon
- Sets robot.mainWeaponId to null
- Recalculates stats
- Returns updated robot

DELETE /api/robots/:robotId/unequip-offhand-weapon
- Sets robot.offhandWeaponId to null
- Recalculates stats
- Returns updated robot

PUT /api/robots/:robotId/loadout-type
Body: { loadoutType: "single" | "weapon_shield" | "two_handed" | "dual_wield" }
- Validates loadout type is valid
- Checks weapon compatibility with new loadout
- If incompatible weapons equipped, returns error with details
- Updates robot.loadoutType
- Recalculates stats with new loadout bonuses
- Returns updated robot
```

**Validation Rules:**

1. **Weapon Ownership**: Weapon must belong to the user attempting to equip it
2. **Single Equipment**: A weapon can only be equipped to one robot at a time
3. **Loadout Compatibility**:
   - "single": Any one-handed weapon in main slot, nothing in offhand
   - "weapon_shield": One-handed weapon in main, shield-type weapon in offhand
   - "two_handed": Two-handed weapon in main slot, nothing in offhand
   - "dual_wield": One-handed weapon in main, one-handed weapon in offhand
4. **Weapon Type Restrictions**: 
   - Shield-type weapons can ONLY go in offhand slot with weapon_shield loadout
   - Main weapon must be equipped when an offhand shield is equipped (configuration cannot be incomplete)
5. **Storage Capacity**: 
   - Check total weapons owned (equipped + unequipped) against storage limit
   - Storage capacity = 5 + (Storage Facility Level × 5)
   - Maximum capacity: 55 weapons (Storage Facility Level 10)
   - This validation applies to weapon purchases, not equipment changes

### FR-2: Stat Calculation System

**Robot Effective Stats Formula:**
```
effective_stat = base_stat + main_weapon_bonus + offhand_weapon_bonus + loadout_bonus
```

**Loadout Bonuses (from ROBOT_ATTRIBUTES.md):**

- **weapon_shield**: +20% Shield Capacity, +15% Armor Plating, +10% Counter Protocols, -15% Attack Speed
- **two_handed**: +25% Combat Power, +20% Critical Systems, -10% Evasion Thrusters
- **dual_wield**: +30% Attack Speed, +15% Weapon Control, -20% Penetration, -10% Combat Power
- **single**: +10% Gyro Stabilizers, +5% Servo Motors

**Implementation Notes:**
- Percentage bonuses are multiplicative: `final = base * (1 + bonus_percent / 100)`
- Weapon attribute bonuses are flat additions
- Stats must be recalculated whenever weapons or loadout changes
- maxHP and maxShield must be recalculated based on effective Hull Integrity and Shield Capacity

### FR-3: Frontend Weapon Equipment UI

**Robot Detail Page Enhancements:**

1. **Loadout Configuration Section** (new section above attributes)
   - Dropdown to select loadout type with descriptions
   - Display current loadout bonuses/penalties
   - Warning message if equipped weapons are incompatible

2. **Weapon Slots Section** (new section)
   - **Main Weapon Slot**: 
     - Shows currently equipped weapon (name, icon, bonuses) or "Empty"
     - "Change Weapon" button opens weapon selection modal
     - "Unequip" button if weapon is equipped
   - **Offhand Weapon Slot**:
     - Only visible if loadout supports offhand (weapon_shield, dual_wield)
     - Same UI as main weapon slot
     - "Equip Shield" button for weapon_shield loadout
     - "Equip Offhand Weapon" button for dual_wield loadout

3. **Weapon Selection Modal**:
   - List of available weapons from user's inventory
   - Filter by compatible weapons (based on loadout type and slot)
   - Show weapon details: name, type, damage, bonuses
   - Show if weapon is equipped to another robot (grayed out with "Equipped to [Name]")
   - "Equip" button for each compatible weapon
   - "Cancel" button to close without changes

4. **Stats Display Enhancement**:
   - Add "With Equipment" column next to base stats
   - Show: `Base | Weapon Bonus | Loadout Bonus | Effective`
   - Color code bonuses (green for positive, red for negative)

**Weapon Inventory Page (new page):**

1. **Layout**: Table or card grid showing all owned weapons
2. **Columns/Fields**:
   - Weapon Name
   - Type (Energy/Ballistic/Melee/Shield)
   - Damage
   - Status (Available / Equipped to [Robot Name])
   - Actions (View Details, Equip)
3. **Filters**: 
   - By weapon type
   - By status (Available / Equipped / All)
4. **Actions**:
   - Click weapon to see full details modal
   - "Equip to Robot" button opens robot selection modal

### FR-4: Data Model Constraints

**Database Constraints (already in schema):**
- Robot.mainWeaponId → foreign key to WeaponInventory
- Robot.offhandWeaponId → foreign key to WeaponInventory
- Robot.loadoutType → enum values validated

**Business Logic Constraints:**
- Weapons cannot be equipped to multiple robots (enforced at API level)
- Loadout type changes must be validated against equipped weapons
- Stat calculations must be deterministic and consistent

---

## Technical Design

### API Endpoints Specification

#### 1. Equip Main Weapon
```typescript
PUT /api/robots/:robotId/equip-main-weapon
Request: { weaponInventoryId: number }
Response: {
  robot: Robot (with updated stats and weapon details),
  message: string
}
Errors:
- 404: Robot not found or doesn't belong to user
- 404: Weapon not found in user's inventory
- 400: Weapon already equipped to another robot
- 400: Weapon incompatible with robot's loadout type
- 500: Server error
```

#### 2. Equip Offhand Weapon
```typescript
PUT /api/robots/:robotId/equip-offhand-weapon
Request: { weaponInventoryId: number }
Response: {
  robot: Robot (with updated stats and weapon details),
  message: string
}
Errors:
- 400: Loadout type doesn't support offhand weapon
- (same as equip main weapon)
```

#### 3. Unequip Weapons
```typescript
DELETE /api/robots/:robotId/unequip-main-weapon
DELETE /api/robots/:robotId/unequip-offhand-weapon
Response: {
  robot: Robot (with updated stats),
  message: string
}
```

#### 4. Change Loadout Type
```typescript
PUT /api/robots/:robotId/loadout-type
Request: { loadoutType: string }
Response: {
  robot: Robot (with updated loadout and stats),
  message: string
}
Errors:
- 400: Invalid loadout type
- 400: Equipped weapons incompatible with new loadout (includes details)
```

### Frontend Components

**New Components:**
1. `LoadoutSelector.tsx`: Dropdown/radio for selecting loadout type
2. `WeaponSlot.tsx`: Reusable component for weapon slot display
3. `WeaponSelectionModal.tsx`: Modal for selecting weapon to equip
4. `WeaponInventoryPage.tsx`: Full page for viewing weapon inventory
5. `StatComparison.tsx`: Component showing base vs effective stats

**Modified Components:**
1. `RobotDetailPage.tsx`: Add loadout and weapon sections
2. `Navigation.tsx`: Add link to Weapon Inventory page

### Stat Calculation Implementation

**Location**: `/prototype/backend/src/utils/robotCalculations.ts` (new file)

```typescript
interface Robot {
  // base attributes
  combatPower: number;
  // ... all 23 attributes
  loadoutType: string;
  mainWeapon?: WeaponInventory;
  offhandWeapon?: WeaponInventory;
}

function calculateEffectiveStats(robot: Robot): EffectiveStats {
  // 1. Start with base attributes
  // 2. Add weapon bonuses (main + offhand)
  // 3. Apply loadout percentage modifiers
  // 4. Return effective stats object
}

function calculateMaxHP(hullIntegrity: number, weaponBonuses: number, loadoutBonus: number): number {
  const effective = hullIntegrity + weaponBonuses;
  return Math.floor(effective * (1 + loadoutBonus / 100) * 10);
}

function calculateMaxShield(shieldCapacity: number, weaponBonuses: number, loadoutBonus: number): number {
  const effective = shieldCapacity + weaponBonuses;
  return Math.floor(effective * (1 + loadoutBonus / 100) * 2);
}
```

---

## UI/UX Specifications

### Loadout Type Selector

**Visual Design:**
- Radio button group with 4 options
- Each option shows:
  - Name (e.g., "Weapon + Shield")
  - Icon/illustration
  - Key bonuses in green (e.g., "+20% Shield Capacity")
  - Key penalties in red (e.g., "-15% Attack Speed")
- Selected loadout highlighted with border
- Disabled options grayed out if incompatible with current weapons

**Interaction:**
- Click to select loadout type
- Confirmation modal if change would unequip weapons
- Immediate stat update on successful change

### Weapon Slot Display

**Empty Slot:**
```
┌────────────────────────────────────┐
│ 🔲 Main Weapon Slot (Empty)       │
│                                    │
│ [Equip Weapon]                     │
└────────────────────────────────────┘
```

**Equipped Slot:**
```
┌────────────────────────────────────┐
│ ⚔️  Laser Rifle (Energy)           │
│ Damage: 20  |  Cooldown: 3s       │
│ Bonuses: +3 Targeting, +4 Control  │
│                                    │
│ [Change]  [Unequip]                │
└────────────────────────────────────┘
```

### Weapon Selection Modal

**Layout:**
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
├──────────────────────────────────────┤
│  ✓ Power Sword                       │
│    Melee | Damage: 28                │
│    [Equip]                           │
└──────────────────────────────────────┘
```

### Stat Display Enhancement

**Current Stats Section (Enhanced):**
```
Combat Power
  Base:     10
  Weapons:  +5  (Laser Rifle)
  Loadout:  +25% (Two-Handed)
  ─────────────
  Effective: 18

Shield Capacity  
  Base:     15
  Weapons:  +4  (Laser Rifle)
  Loadout:  +20% (Weapon+Shield)
  ─────────────
  Effective: 22
```

---

## Testing Requirements

### Unit Tests

**Backend:**
- Stat calculation functions (calculateEffectiveStats, calculateMaxHP, etc.)
- Validation functions (isWeaponCompatibleWithLoadout, etc.)
- Weapon equipping logic (equip, unequip, change loadout)

**Frontend:**
- Component rendering (weapon slots, loadout selector)
- Stat display calculations
- Modal interactions

### Integration Tests

**API Tests:**
- Equip weapon: successful case
- Equip weapon: weapon already equipped to another robot
- Equip weapon: incompatible with loadout type
- Unequip weapon: successful case
- Change loadout: successful case
- Change loadout: incompatible weapons equipped

**End-to-End Tests:**
1. User purchases weapon from shop
2. User navigates to robot detail page
3. User selects loadout type
4. User equips weapon to main slot
5. User equips offhand weapon (if applicable)
6. Stats update correctly
7. User changes loadout type
8. User unequips weapon
9. Weapon shows as available in inventory

### Manual Testing Scenarios

**Scenario 1: First-Time Weapon Equipping**
- Purchase a Laser Rifle from weapon shop
- Go to robot detail page
- Change loadout to "single"
- Equip Laser Rifle to main slot
- Verify stats show weapon bonuses
- Verify weapon shows as "equipped to [Robot Name]" in inventory

**Scenario 2: Dual-Wield Configuration**
- Purchase two Machine Guns
- Change robot loadout to "dual_wield"
- Equip first Machine Gun to main slot
- Equip second Machine Gun to offhand slot
- Verify both weapons' bonuses are applied
- Verify dual-wield loadout bonuses are applied

**Scenario 3: Weapon Swapping Between Robots**
- Have Robot A with Laser Rifle equipped
- Go to Robot B detail page
- Try to equip the same Laser Rifle
- Verify error message appears
- Unequip Laser Rifle from Robot A
- Return to Robot B and equip Laser Rifle
- Verify successful

**Scenario 4: Loadout Type Validation**
- Equip a two-handed weapon (Plasma Cannon)
- Try to change loadout to "dual_wield"
- Verify error message about incompatible weapon
- Unequip Plasma Cannon
- Change to "dual_wield" successfully
- Verify loadout bonuses update

---

## Implementation Phases

### Phase 1: Backend API & Core Logic (3-5 days)
**Priority: MUST HAVE**

Tasks:
- [ ] Create `prototype/frontend/src/utils/robotStats.ts` utility file (currently missing but imported)
- [ ] Create `/utils/robotCalculations.ts` with stat calculation functions
- [ ] Create `/utils/weaponValidation.ts` with validation logic
- [ ] Verify and fix Weapon Workshop discount formula in backend (should be `level × 5`)
- [ ] Implement storage capacity enforcement in weapon purchase API
- [ ] Add storage capacity calculation: `5 + (Storage Facility Level × 5)`
- [ ] Implement `PUT /api/robots/:id/equip-main-weapon` endpoint
- [ ] Implement `PUT /api/robots/:id/equip-offhand-weapon` endpoint
- [ ] Implement `DELETE /api/robots/:id/unequip-main-weapon` endpoint
- [ ] Implement `DELETE /api/robots/:id/unequip-offhand-weapon` endpoint
- [ ] Implement `PUT /api/robots/:id/loadout-type` endpoint
- [ ] Add shield restriction validation (offhand only, requires main weapon)
- [ ] Add HP/Shield initialization in robot creation API
- [ ] Write unit tests for stat calculations
- [ ] Write integration tests for weapon equipping API

Acceptance Criteria:
- All API endpoints functional and tested
- Storage capacity enforcement prevents purchases beyond limit
- Stat calculations accurate per ROBOT_ATTRIBUTES.md formulas
- Validation rules enforced correctly (shields, loadout compatibility)
- Robot HP/Shield properly initialized on creation
- API returns proper error messages for invalid operations

### Phase 2: Frontend Weapon Equipment UI (3-5 days)
**Priority: MUST HAVE**

Tasks:
- [ ] Create `LoadoutSelector` component
- [ ] Create `WeaponSlot` component
- [ ] Create `WeaponSelectionModal` component
- [ ] Enhance `RobotDetailPage` with loadout and weapon sections
- [ ] Implement weapon filtering based on selected loadout type
- [ ] Implement stat display showing base + weapon + loadout + effective
- [ ] Add real-time stat updates when weapons/loadout changes
- [ ] Display remaining weapon storage capacity in WeaponShopPage
- [ ] Add duplicate weapon purchase confirmation dialog
- [ ] Add loading states and error handling
- [ ] Write component tests

Acceptance Criteria:
- Users can select loadout type via intuitive UI
- Weapon selection modal shows only compatible weapons for selected loadout
- Users can equip/unequip weapons to main and offhand slots
- Stats display correctly with breakdowns
- Storage capacity is visible to users
- Users are warned when buying duplicate weapons
- Error messages are clear and actionable
- UI is responsive and works on mobile

### Phase 3: Weapon Inventory Management (2-3 days)
**Priority: SHOULD HAVE**

Tasks:
- [ ] Create `WeaponInventoryPage` component
- [ ] Implement weapon filtering by type and status
- [ ] Add weapon detail modal from inventory
- [ ] Add "Equip to Robot" functionality from inventory page
- [ ] Add navigation link to Weapon Inventory page
- [ ] Visual indicators for equipped vs available weapons

Acceptance Criteria:
- Users can view all owned weapons in one place
- Filtering works correctly
- Users can see which robots are using which weapons
- Users can initiate equipping from inventory page

### Phase 4: Polish & Edge Cases (1-2 days)
**Priority: NICE TO HAVE**

Tasks:
- [ ] Add confirmation dialogs for destructive actions
- [ ] Add tooltips explaining loadout bonuses
- [ ] Add animations for stat changes
- [ ] Add weapon icons/illustrations
- [ ] Improve mobile responsive layout
- [ ] Add keyboard shortcuts for power users
- [ ] Performance optimization for stat calculations

Acceptance Criteria:
- Smooth user experience with minimal friction
- Visually appealing UI
- Edge cases handled gracefully

---

## Dependencies & Risks

### Dependencies

**Technical:**
- Database schema already in place (Weapon, WeaponInventory, Robot models)
- Weapon seed data exists (11 weapons defined)
- Backend infrastructure (Express, Prisma) operational
- Frontend infrastructure (React, Tailwind) operational

**Documentation:**
- WEAPONS_AND_LOADOUT.md (complete)
- ROBOT_ATTRIBUTES.md (complete)
- DATABASE_SCHEMA.md (complete)

### Risks & Mitigation

**Risk 1: Stat Calculation Complexity**
- **Impact**: High (incorrect stats break game balance)
- **Probability**: Medium
- **Mitigation**: 
  - Write comprehensive unit tests for all formulas
  - Cross-reference with ROBOT_ATTRIBUTES.md documentation
  - Manual testing with spreadsheet verification
  - Code review focused on math accuracy

**Risk 2: UI/UX Confusion**
- **Impact**: Medium (users don't understand loadout system)
- **Probability**: Medium
- **Mitigation**:
  - Clear in-app tooltips and help text
  - Preview stats before applying changes
  - Confirmation dialogs for major changes
  - User testing with small group before full release

**Risk 3: Race Conditions (Weapon Equipping)**
- **Impact**: Low (rare but can cause data inconsistency)
- **Probability**: Low
- **Mitigation**:
  - Use database transactions for all equipment changes
  - Add optimistic locking if needed
  - Implement proper error handling and rollback

**Risk 4: Performance (Stat Recalculation)**
- **Impact**: Low (stats must recalculate on every change)
- **Probability**: Low
- **Mitigation**:
  - Cache calculated stats on robot model
  - Use database triggers if needed
  - Optimize calculation functions
  - Lazy load weapon details on robot list pages

---

## Success Criteria & KPIs

### MVP Success Criteria (Must Meet All)

1. ✅ **Functional Completeness**: All Phase 1 & 2 features working without critical bugs
2. ✅ **Data Integrity**: No weapon can be equipped to multiple robots simultaneously
3. ✅ **Stat Accuracy**: Effective stats match manual calculations within 1% margin
4. ✅ **Loadout Validation**: Incompatible weapon+loadout combinations are prevented
5. ✅ **User Feedback**: Clear error messages for all invalid operations

### KPIs to Monitor

**Engagement Metrics:**
- % of players who purchase at least 1 weapon (target: 80%+)
- % of robots with at least 1 weapon equipped (target: 90%+)
- Average number of loadout changes per robot (target: 3+)
- % of players who try all 4 loadout types (target: 40%+)

**Quality Metrics:**
- Weapon equipping error rate (target: <5%)
- Average time to equip first weapon (target: <2 minutes)
- Support tickets related to weapon system (target: <10% of total)

**Technical Metrics:**
- API response time for weapon operations (target: <200ms p95)
- Stat calculation accuracy (target: 100%)
- Zero critical bugs in production after 1 week

---

## Open Questions & Decisions Needed

### Questions for Product Owner

1. **Storage Capacity Enforcement**: Should we enforce the 10-weapon storage limit in Phase 1, or defer to later phase?
   - **Recommendation**: Defer to Phase 3 (Weapon Inventory Management)

2. **Weapon Deletion**: Should users be able to sell/delete weapons from inventory?
   - **Recommendation**: Not in MVP, add in future phase

3. **Default Loadout**: What should be the default loadout for newly created robots?
   - **Recommendation**: "single" (simplest, most flexible)

4. **Weapon Equipping from Shop**: Should users be able to equip a weapon immediately after purchase?
   - **Recommendation**: No, keep purchase and equipment as separate flows for clarity

5. **Multiple Copies Warning**: Should we warn users when purchasing multiple copies of the same weapon?
   - **Recommendation**: Yes, show a confirmation dialog

### Technical Decisions Needed

1. **Stat Calculation Caching**: Should effective stats be stored in DB or calculated on-demand?
   - **Recommendation**: Calculate on-demand initially, add caching if performance issues arise

2. **Transaction Boundaries**: Which operations need to be wrapped in database transactions?
   - **Recommendation**: All equipment changes (equip, unequip, loadout change)

3. **Frontend State Management**: Use React Context or introduce Redux for weapon state?
   - **Recommendation**: Stick with React hooks + Context for now (simpler)

---

## Appendix

### A. Loadout Type Reference

| Loadout Type | Main Slot | Offhand Slot | Bonuses | Penalties |
|--------------|-----------|--------------|---------|-----------|
| Single | 1H weapon | Empty | +10% Gyro, +5% Servo | None |
| Weapon+Shield | 1H weapon | Shield | +20% Shield Cap, +15% Armor, +10% Counter | -15% Attack Speed |
| Two-Handed | 2H weapon | Empty | +25% Combat Power, +20% Crit, Crit multiplier 2.5x | -10% Evasion |
| Dual-Wield | 1H weapon | 1H weapon | +30% Attack Speed, +15% Weapon Control | -20% Penetration, -10% Combat Power |

### B. Weapon Compatibility Matrix

| Weapon Type | Hands Required | Compatible Loadouts | Notes |
|-------------|----------------|---------------------|-------|
| Laser Rifle | One | Single, Weapon+Shield, Dual-Wield | Can equip in main or offhand |
| Machine Gun | One | Single, Weapon+Shield, Dual-Wield | Can equip in main or offhand |
| Power Sword | One | Single, Weapon+Shield, Dual-Wield | Can equip in main or offhand |
| Plasma Blade | One | Single, Weapon+Shield, Dual-Wield | Can equip in main or offhand |
| Combat Shield | Shield | Weapon+Shield (offhand only) | Requires main weapon equipped |
| Energy Barrier | Shield | Weapon+Shield (offhand only) | Requires main weapon equipped |
| Plasma Cannon | Two | Two-Handed | Occupies both slots |
| Ion Beam | Two | Two-Handed | Occupies both slots |
| Railgun | Two | Two-Handed | Occupies both slots |
| Shotgun | Two | Two-Handed | Occupies both slots |
| Hammer | Two | Two-Handed | Occupies both slots |

**Compatibility Rules:**
- One-handed weapons: Can be used in multiple loadouts and slots. Players can own 2 copies of the same weapon and equip both for Dual-Wield
- Shield weapons: Offhand only, must have main weapon equipped
- Two-handed weapons: Exclusive to Two-Handed loadout

### C. Example Stat Calculations

**Example 1: Robot with Laser Rifle, Single Loadout**
```
Base Combat Power: 10
Laser Rifle Bonus: 0
Single Loadout Bonus: 0%
Effective Combat Power: 10

Base Gyro Stabilizers: 15
Laser Rifle Bonus: 0
Single Loadout Bonus: +10%
Effective Gyro: 15 * 1.10 = 16.5 → 16 (rounded down)
```

**Example 2: Robot with Combat Shield + Power Sword, Weapon+Shield Loadout**
```
Base Shield Capacity: 20
Combat Shield Bonus: +5
Power Sword Bonus: 0
Weapon+Shield Loadout: +20%
Effective Shield Capacity: (20 + 5) * 1.20 = 30

Max Shield HP: 30 * 2 = 60
```

**Example 3: Robot with Dual Machine Guns, Dual-Wield Loadout**
```
Base Attack Speed: 18
Machine Gun 1 Bonus: +6
Machine Gun 2 Bonus: +6
Dual-Wield Loadout: +30%
Effective Attack Speed: (18 + 6 + 6) * 1.30 = 39

Base Penetration: 10
Machine Gun 1 Bonus: 0
Machine Gun 2 Bonus: 0
Dual-Wield Loadout: -20%
Effective Penetration: 10 * 0.80 = 8
```

### D. Error Messages Reference

| Error Code | User Message | Technical Details |
|------------|--------------|-------------------|
| WPN001 | "This weapon is already equipped to another robot. Unequip it first." | Weapon.robotsMain or robotsOffhand is not empty |
| WPN002 | "This weapon is not compatible with your current loadout type." | Weapon hands ≠ loadout requirements |
| WPN003 | "Cannot change loadout: equipped weapons are not compatible with the new loadout type." | Validation failed on loadout change |
| WPN004 | "This loadout type does not support offhand weapons." | Attempted offhand equip with 'single' or 'two_handed' |
| WPN005 | "You don't own this weapon." | WeaponInventory.userId ≠ current user |

---

## Addendum: Questions & Clarifications for Implementation

### Prerequisites (Before Starting Implementation)

**Issue 1: Weapon Seed Data Missing**
- **Status**: ✅ RESOLVED
- **Issue**: The 11 weapons defined in WEAPONS_AND_LOADOUT.md may not be seeded in the database
- **Resolution**: The 11 initial weapons (including Practice Sword) are confirmed to be loaded into the database in the current version
- **Action**: No action required - weapons are already seeded
- **Priority**: COMPLETE

**Issue 2: Weapon Workshop Discount Formula Discrepancy**
- **Status**: ✅ DECISION MADE
- **Current**: `level * 5` (gives 5%, 10%, 15%... up to 50% at level 10)
- **Decision**: Use simple formula: **Discount % = Weapons Workshop Level × 5**
- **Action**: 
  1. ✅ Documentation updated in WEAPONS_AND_LOADOUT.md and STABLE_SYSTEM.md
  2. ⚠️ Verify backend implementation in `prototype/backend/src/routes/weaponInventory.ts` matches this formula
  3. ⚠️ Update frontend display in WeaponShopPage.tsx if needed
- **Priority**: HIGH - Both application and documentation now reflect this simple formula

**Issue 3: robotStats Utility Existence**
- **Status**: ✅ CONFIRMED MISSING
- **Issue**: `RobotDetailPage.tsx` imports `../utils/robotStats` but file doesn't exist in repo
- **Decision**: File is needed and must be created as part of Phase 1 implementation
- **Action**: Add requirement to create `prototype/frontend/src/utils/robotStats.ts` in Phase 1
- **Priority**: HIGH - Required for Phase 2 frontend work

### Implementation Clarifications

**Question 1: Loadout Type Selection UI**
- **Status**: ✅ PARTIALLY IMPLEMENTED
- **Context**: Database supports loadout types but UI implementation unclear
- **Answer**: A selector is currently present in the UI, but it doesn't load the weapons (which are confirmed to be in the database)
- **Action Required**: Based on the loadout selected, the correct set of available weapons needs to be presented
- **Priority**: HIGH - Include in Phase 2 (Frontend) as specified in PRD

**Question 2: Storage Capacity Enforcement**
- **Status**: ✅ DECISION MADE - ENFORCE IN MVP
- **Context**: Docs specify weapon storage capacity with expansion via Storage Facility
- **Decision**: 
  - Default capacity: **5 weapons** (without Storage Facility)
  - Add 5 weapon slots per Storage Facility level
  - Formula: **Storage Capacity = 5 + (Storage Facility Level × 5)**
  - Level 10 maximum: **55 weapons**
  - **Storage Definition**: Total weapons owned by the stable (both equipped AND unequipped)
- **Rationale**: This simplifies the system by ensuring there's never a problem where a player wants to swap weapons and there's no space in storage
- **Action**: 
  1. ✅ Documentation updated in WEAPONS_AND_LOADOUT.md and STABLE_SYSTEM.md
  2. ⚠️ Move storage capacity enforcement to **Phase 1 (Backend API)** - was previously deferred
  3. Add storage capacity check to weapon purchase API
  4. Display remaining weapon slots in UI (Phase 2)
- **Priority**: HIGH - Must be implemented in Phase 1

**Question 3: "Any" Loadout Type**
- **Status**: ✅ DECISION MADE
- **Context**: Weapon schema has loadoutType field, docs show specific loadouts
- **Decision**: Yes, weapons should support flexible loadout compatibility:
  - Weapons can be equipped in **main hand AND off hand** (if the stable owns 2 copies with the same name/ID)
  - One-handed weapons (not two-handed, not shields) can be equipped:
    - Single weapon loadout (main slot)
    - Both slots for dual-wield loadout
    - Main hand for weapon + shield loadout
    - NOT in two-handed loadout
- **Action**: Implement loadout compatibility validation that allows one-handed weapons in multiple slots
- **Priority**: MEDIUM - Part of Phase 1 validation logic

**Question 4: Shield Equipment Restriction**
- **Status**: ✅ DECISION MADE
- **Context**: Shields should only go in offhand with weapon_shield loadout
- **Decision**: 
  - Shields can **only** be selected as off-hand weapon
  - A primary weapon also needs to be equipped, otherwise configuration is not complete (not fully equipped)
  - Block shields from main weapon slot at API level
- **Action**: 
  1. Add validation to prevent shield equipment in main weapon slot
  2. Add validation to ensure main weapon is equipped when offhand shield is equipped
  3. Display appropriate error messages in UI
- **Priority**: HIGH - Part of Phase 1 validation logic

**Question 5: HP/Shield Initialization**
- **Status**: ✅ DECISION MADE
- **Context**: Robots have currentHP/currentShield fields
- **Decision**: 
  - **On robot creation**: `currentHP = maxHP`, `currentShield = maxShield`
  - **After battle**: `currentShield = maxShield` (shields regenerate)
  - **currentHP persistence**: Remains at battle-damaged value until repaired
  - **After repair**: `currentHP = maxHP` (once credits have been spent)
- **Action**: 
  1. Add initialization logic in robot creation API
  2. Add post-battle logic for shield reset
  3. Add repair logic to restore HP to max
- **Priority**: MEDIUM - Part of Phase 1 robot management

**Question 6: Multiple Weapon Purchase Warning**
- **Status**: ✅ APPROVED
- **Context**: Users can buy multiple copies of same weapon
- **Decision**: Yes, this is a nice UX feature. Also display how many weapon spaces are left in storage.
- **Action**: 
  1. Add confirmation dialog when purchasing a weapon the user already owns
  2. Display remaining storage capacity in weapon shop UI
  3. Display storage capacity in weapon inventory UI
- **Priority**: MEDIUM - Add in Phase 2 (Frontend UI) alongside other purchase flow enhancements 

### Database Schema Verification

✅ **Verified**: All 23 robot attributes have corresponding bonus fields in Weapon model  
✅ **Verified**: Robot.mainWeaponId and Robot.offhandWeaponId foreign keys exist  
✅ **Verified**: Robot.loadoutType field exists with proper default  
✅ **Verified**: WeaponInventory table properly links users, weapons, and robots

---

**Document Version**: 1.0  
**Last Reviewed**: January 29, 2026  
**Next Review**: After Phase 1 completion
