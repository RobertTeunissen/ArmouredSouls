# Weapons & Loadout System - Comprehensive Guide

**Project**: Armoured Souls  
**Document Type**: Comprehensive Reference  
**Version**: v3.0  
**Date**: February 10, 2026  
**Status**: ✅ Implemented  

**⭐ PRIMARY WEAPON REFERENCE**: [SEED_DATA_SPECIFICATION.md](../prd_core/SEED_DATA_SPECIFICATION.md)  
**⭐ PRICING FORMULA**: [PRD_WEAPON_ECONOMY_OVERHAUL.md](../PRD_WEAPON_ECONOMY_OVERHAUL.md)

**This Document**: Complete consolidated guide integrating all weapon and loadout system documentation. Includes full user stories, functional requirements, technical design, UI/UX specifications, testing requirements, and implementation details.

**Revision History:**
- v3.0 (Feb 10, 2026): Full consolidation - integrated all content from PRD_WEAPON_LOADOUT.md and WEAPONS_AND_LOADOUT.md
- v2.1 (Feb 10, 2026): Updated to reference authoritative sources, incorporated economy overhaul, updated starting budget to ₡3M
- v2.0 (Feb 10, 2026): Initial consolidated guide
- v1.2 (Feb 5, 2026): Two-handed weapon rebalancing
- v1.1 (Feb 5, 2026): Combat rebalancing
- v1.0 (Jan 29, 2026): Initial implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Background & Context](#background--context)
3. [Goals & Objectives](#goals--objectives)
4. [User Stories](#user-stories)
5. [Functional Requirements](#functional-requirements)
6. [System Overview](#system-overview)
7. [Ownership & Inventory](#ownership--inventory)
8. [Loadout System](#loadout-system)
9. [Weapon Types & Properties](#weapon-types--properties)
10. [Weapon Catalog Overview](#weapon-catalog-overview)
11. [Weapon Economy & Pricing](#weapon-economy--pricing)
12. [Weapon Crafting System](#weapon-crafting-system)
13. [UI/UX Specifications](#uiux-specifications)
14. [Technical Design](#technical-design)
15. [Implementation Status](#implementation-status)
16. [Testing Requirements](#testing-requirements)
17. [Dependencies & Risks](#dependencies--risks)
18. [Success Criteria & KPIs](#success-criteria--kpis)
19. [Appendices](#appendices)

---

## Executive Summary

The Weapon & Loadout System enables players to purchase weapons, manage inventory, equip weapons to robots, and configure tactical loadouts. The system supports 4 distinct loadout types with **23 implemented weapons** across 4 categories.

**Key Features:**
- ✅ 23 weapons across 4 categories (Energy, Ballistic, Melee, Shield)
- ✅ Weapon purchase from shop with Workshop discounts (5-50%)
- ✅ Stable-level weapon inventory with storage capacity management
- ✅ 4 loadout configurations with strategic bonuses/penalties
- ✅ DPS-inclusive pricing formula for balanced economy
- ✅ Real-time stat calculations with weapon and loadout bonuses

**Current Economy (Option C - Feb 8, 2026):**
- Starting Budget: **₡3,000,000** (increased from ₡2M)
- Attribute Upgrade Costs: +50% (level × 1,500)
- Facility Costs: -50% reduction
- Weapon Costs: +25% increase

**Success Criteria:**
- Players can purchase, equip, and unequip weapons without errors
- Loadout restrictions properly enforced
- Stat displays show accurate bonuses
- 90%+ of weapon transactions complete without confusion

---

## Background & Context

### Current State

**What Exists:**
- ✅ Complete database schema (Weapon, WeaponInventory, Robot models with all fields)
- ✅ Comprehensive design documentation (WEAPONS_AND_LOADOUT.md, ROBOT_ATTRIBUTES.md)
- ✅ 23 weapons defined with complete specifications across 4 categories
- ✅ Backend API: GET /api/weapons (list all weapons)
- ✅ Backend API: POST /api/weapon-inventory/purchase (purchase weapon)
- ✅ Backend API: GET /api/weapon-inventory (get user's weapon inventory)
- ✅ Frontend: WeaponShopPage (displays and allows purchasing weapons)
- ✅ Weapon Workshop discount system (5% per level, up to 50%)
- ✅ Weapon equipping/unequipping functionality (backend + frontend)
- ✅ Loadout type selection and validation
- ✅ Weapon slot management (main weapon vs offhand weapon)
- ✅ Real-time stat calculation showing weapon bonuses
- ✅ Loadout configuration UI on robot detail page
- ✅ Weapon compatibility validation (loadout type restrictions)
- ✅ Visual feedback for equipped weapons
- ✅ Inventory management via Weapon Shop ("Only Owned Weapons" filter)
- ✅ Unequip functionality (remove weapon from robot)
- ✅ Storage capacity enforcement

### Design References

- **⭐ [SEED_DATA_SPECIFICATION.md](../prd_core/SEED_DATA_SPECIFICATION.md)** - Complete weapon catalog (23 weapons)
- **⭐ [PRD_WEAPON_ECONOMY_OVERHAUL.md](../PRD_WEAPON_ECONOMY_OVERHAUL.md)** - Pricing formula and economy design
- **[PRD_ROBOT_ATTRIBUTES.md](../prd_core/PRD_ROBOT_ATTRIBUTES.md)** - Robot attributes and loadout bonuses
- **[DATABASE_SCHEMA.md](../prd_core/DATABASE_SCHEMA.md)** - Database structure
- **[COMBAT_FORMULAS.md](../prd_core/COMBAT_FORMULAS.md)** - Combat calculations
- **[STABLE_SYSTEM.md](../STABLE_SYSTEM.md)** - Stable management and facilities
- **[OPTION_C_IMPLEMENTATION.md](../OPTION_C_IMPLEMENTATION.md)** - Economy rebalancing (Feb 8, 2026)

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

### Non-Goals (Out of Scope)

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

**US-5: View Weapon Inventory** *(Functionality moved to Weapon Shop)*
```
As a player
I want to view all weapons I own in one place
So that I can see what I have and which robots are using them

Acceptance Criteria:
- ✅ IMPLEMENTED in Weapon Shop via "Only Owned Weapons" filter
- I see all weapons I've purchased, organized by category
- Each weapon shows: name, type, equipped status, and which robot is using it
- I can click on a weapon to see full details and equip options
- I can filter by weapon type or equipped status
- I can see my current storage capacity usage (e.g., "28/35 weapons")

Note: Originally planned as separate page, but integrated into Weapon Shop for better UX.
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
- **two_handed**: +10% Combat Power (v1.2: reduced from +25%), +20% Critical Systems, -10% Evasion Thrusters, 1.10× damage multiplier (v1.2: reduced from 1.25×)
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

**Weapon Inventory Page (deprecated - integrated into Weapon Shop):**

Originally planned as separate page, but integrated into Weapon Shop for better UX via "Only Owned Weapons" filter.

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

## System Overview

### Core Principles

**Weapon Ownership Model:**
- Weapons are owned at the **stable level** (not robot-specific)
- Players purchase weapons using **Credits (₡)** from stable resources
- Each purchase creates a separate inventory item
- Players can own **multiple copies** of the same weapon
- Weapons can be **equipped** to robots or remain **available** in storage

**Weapon States:**
- **Available**: In storage, ready to equip
- **Equipped**: Assigned to a specific robot (main or offhand slot)
- **Restriction**: A weapon cannot be equipped to multiple robots simultaneously

**Storage Management:**
- **Default Capacity**: 5 weapons (Storage Facility Level 0)
- **Expansion**: +5 weapons per Storage Facility level
- **Formula**: Storage Capacity = 5 + (Storage Facility Level × 5)
- **Maximum**: 55 weapons (Storage Facility Level 10)
- **Definition**: Total weapons owned (both equipped AND unequipped)

### Related Documentation

- **⭐ [SEED_DATA_SPECIFICATION.md](../prd_core/SEED_DATA_SPECIFICATION.md)** - Complete weapon catalog (23 weapons)
- **⭐ [PRD_WEAPON_ECONOMY_OVERHAUL.md](../PRD_WEAPON_ECONOMY_OVERHAUL.md)** - Pricing formula and economy design
- **[PRD_ROBOT_ATTRIBUTES.md](../prd_core/PRD_ROBOT_ATTRIBUTES.md)** - Robot attributes and combat mechanics
- **[STABLE_SYSTEM.md](../STABLE_SYSTEM.md)** - Stable management and facilities
- **[DATABASE_SCHEMA.md](../prd_core/DATABASE_SCHEMA.md)** - Database structure
- **[COMBAT_FORMULAS.md](../prd_core/COMBAT_FORMULAS.md)** - Combat calculations
- **[OPTION_C_IMPLEMENTATION.md](../OPTION_C_IMPLEMENTATION.md)** - Economy rebalancing (Feb 8, 2026)

---

## Ownership & Inventory

### Purchase Process

**Navigation:**
- Weapon Shop accessible via main navigation menu
- Browse all 23 available weapons from catalog
- Check storage capacity before purchase
- Purchase using Credits (₡)

**Purchase Steps:**
1. **Browse**: View weapon catalog with stats and prices
2. **Check Storage**: Ensure capacity available (displayed in UI)
3. **Purchase**: Spend Credits to add weapon to inventory
4. **Equip**: Assign weapon to robot from robot detail page

### Inventory Management

**How It Works:**
1. Purchase weapons from Weapon Shop
2. Weapons stored in stable-level inventory
3. Assign weapons to robots via robot detail page
4. Configure loadout type per robot
5. View equipped status in Weapon Shop ("Only Owned Weapons" filter)

**Equipment Rules:**
- Weapons can only be equipped to one robot at a time
- To use same weapon on multiple robots, purchase multiple copies
- Robots can unequip weapons to free them for other robots
- Loadout type determines available slots
- Compatible weapons shown when equipping


---

## Loadout System

Robots are bipedal humanoids with two arms. Loadout determines how weapons/shields are equipped and provides strategic bonuses/penalties.

### Why Percentage-Based Bonuses?

Loadouts use **percentage-based bonuses** rather than flat bonuses for critical reasons:

1. **Power Scaling**: Percentages scale proportionally with robot level
2. **Meaningful Choices**: Remain strategically significant throughout progression
3. **Multiplicative Progression**: Creates interesting build variety
4. **Balance Maintenance**: Easier to balance once, applies fairly at all levels

### Loadout Configurations

#### 1. Weapon + Shield
- **Equipment**: One weapon + Shield weapon (offhand)
- **Bonuses**: +20% Shield Capacity, +15% Armor Plating, +10% Counter Protocols
- **Penalties**: -15% Attack Speed (shield weight)
- **Best For**: Tank builds, defensive strategies

#### 2. Two-Handed Weapon
- **Equipment**: One two-handed weapon (both hands)
- **Bonuses**: +10% Combat Power, +20% Critical Systems, 2.5× crit multiplier, 1.10× damage multiplier
- **Penalties**: -10% Evasion Thrusters (less mobility)
- **Best For**: Glass cannon builds, high burst damage

#### 3. Dual-Wield (Two Weapons)
- **Equipment**: Two one-handed weapons
- **Bonuses**: +30% Attack Speed, +15% Weapon Control
- **Penalties**: -20% Penetration, -10% Combat Power
- **Best For**: Speed builds, sustained DPS

#### 4. Single Weapon (No Shield)
- **Equipment**: One weapon, other hand free
- **Bonuses**: +10% Gyro Stabilizers, +5% Servo Motors
- **Penalties**: None
- **Best For**: Balanced builds, flexible strategies

### Weapon Compatibility Rules

**One-Handed Weapons (not shields):**
- Can be equipped in main hand OR offhand
- Compatible with: Single, Weapon+Shield (main only), Dual-Wield (both slots)
- NOT compatible with: Two-Handed loadout
- Can own multiple copies and equip same weapon to both slots (Dual-Wield)

**Two-Handed Weapons:**
- Require Two-Handed loadout
- Occupy both weapon slots
- NOT compatible with: Single, Weapon+Shield, Dual-Wield

**Shield Weapons:**
- Can ONLY be equipped in offhand slot
- Require Weapon+Shield loadout
- Main weapon must also be equipped (configuration incomplete without main)
- NOT compatible with: Single, Two-Handed, Dual-Wield


---

## Weapon Catalog Overview

**⭐ AUTHORITATIVE SOURCE**: [SEED_DATA_SPECIFICATION.md](../prd_core/SEED_DATA_SPECIFICATION.md)

The game features **23 implemented weapons** across 4 categories. For complete specifications, damage values, cooldowns, attribute bonuses, and exact pricing, refer to SEED_DATA_SPECIFICATION.md.

### Weapon Categories

**Energy Weapons (7 total):**
- Damage Type: Energy (+20% vs energy shields)
- Characteristics: Precise, consistent damage
- Examples: Laser Pistol, Laser Rifle, Plasma Rifle, Plasma Cannon, Ion Beam

**Ballistic Weapons (8 total):**
- Damage Type: Kinetic (standard vs armor)
- Characteristics: Variable damage, high penetration
- Examples: Machine Pistol, Machine Gun, Assault Rifle, Burst Rifle, Shotgun, Grenade Launcher, Sniper Rifle, Railgun

**Melee Weapons (7 total):**
- Damage Type: Impact (benefits from Hydraulic Systems)
- Characteristics: High burst damage, positioning-dependent
- Examples: Practice Sword, Combat Knife, Energy Blade, Plasma Blade, Power Sword, Battle Axe, Heavy Hammer

**Shield Weapons (3 total):**
- Damage Type: N/A (defensive equipment)
- Characteristics: Provides defensive bonuses, enables counters
- Examples: Light Shield, Combat Shield, Reactive Shield

### Price Tiers

**Budget Tier (₡62K-₡150K)** - 8 weapons:
- Practice Sword, Machine Pistol, Laser Pistol, Combat Knife
- Light Shield, Combat Shield, Reactive Shield, Machine Gun

**Mid Tier (₡175K-₡250K)** - 5 weapons:
- Burst Rifle, Assault Rifle, Energy Blade, Laser Rifle, Plasma Blade

**Premium Tier (₡275K-₡400K)** - 5 weapons:
- Plasma Rifle, Power Sword, Shotgun, Grenade Launcher, Sniper Rifle

**Elite Tier (₡375K+)** - 5 weapons:
- Battle Axe, Plasma Cannon, Heavy Hammer, Railgun, Ion Beam

### Loadout Coverage

**Single Loadout** (15 one-handed weapons):
- All one-handed weapons can be used in single loadout

**Weapon + Shield** (15 one-handed + 3 shields):
- All one-handed weapons + Light Shield, Combat Shield, Reactive Shield

**Two-Handed** (8 weapons):
- Shotgun, Grenade Launcher, Sniper Rifle, Battle Axe
- Plasma Cannon, Heavy Hammer, Railgun, Ion Beam

**Dual-Wield** (15 one-handed weapons):
- All one-handed weapons (same as single loadout)

### DPS Rankings (Top 5)

1. **Power Sword**: 6.67 DPS (₡350K) - One-handed
2. **Ion Beam**: 6.0 DPS (₡538K) - Two-handed (Highest DPS in game)
3. **Heavy Hammer**: 5.8 DPS (₡450K) - Two-handed
4. **Battle Axe**: 5.75 DPS (₡388K) - Two-handed
5. **Plasma Rifle**: 5.67 DPS (₡275K) - One-handed

See [SEED_DATA_SPECIFICATION.md](../prd_core/SEED_DATA_SPECIFICATION.md) for complete weapon specifications.


---

## Weapon Economy & Pricing

**⭐ AUTHORITATIVE SOURCE**: [PRD_WEAPON_ECONOMY_OVERHAUL.md](../PRD_WEAPON_ECONOMY_OVERHAUL.md)

### Current Economy (Option C - Feb 8, 2026)

**Starting Budget**: **₡3,000,000** (increased from ₡2M)

**Economic Changes:**
- Attribute Upgrade Costs: +50% (now level × 1,500)
- Facility Costs: -50% reduction
- Weapon Costs: +25% increase
- See [OPTION_C_IMPLEMENTATION.md](../OPTION_C_IMPLEMENTATION.md) for details

### Pricing Formula

All weapons use a **DPS-inclusive pricing formula** that factors in:
- **Base Cost**: ₡50,000 (Practice Sword baseline)
- **Attribute Bonuses**: Exponential scaling (₡500 × bonus²)
- **DPS Premium**: Higher damage/faster attacks cost more
- **Hand Multiplier**: 1.0× (one-handed), 1.6× (two-handed), 0.9× (shield)

**Complete Formula:**
```
Total Cost = (Base Cost + Attribute Cost + DPS Cost) × Hand Multiplier

Where:
- Base Cost = ₡50,000
- Attribute Cost = Σ(500 × bonus²) for all bonuses
- DPS Cost = ₡50,000 × (DPS Ratio - 1.0) × 2.67
- DPS Ratio = (weapon DPS) / (baseline DPS of 2.67)
- Hand Multiplier = 1.0, 1.6, or 0.9
```

**Key Insight**: Specialized weapons (high single attribute) cost MORE than balanced weapons due to exponential scaling.

See [PRD_WEAPON_ECONOMY_OVERHAUL.md](../PRD_WEAPON_ECONOMY_OVERHAUL.md) for complete formula details and examples.

### Weapons Workshop Discounts

The **Weapons Workshop** facility provides purchase discounts:

**Discount Formula**: Discount % = Weapons Workshop Level × 5

| Level | Discount | Special Unlock |
|-------|----------|----------------|
| 0 | 0% | - |
| 1-2 | 5-10% | - |
| 3 | 15% | Weapon modifications |
| 4-5 | 20-25% | - |
| 6 | 30% | Custom weapon design |
| 7-9 | 35-45% | - |
| 10 | 50% | Legendary weapon crafting |

**Operating Cost**: ₡1,000/day at Level 1, +₡500/day per level

**Example Cost Calculation:**
- Plasma Cannon base cost: ₡400,000
- With Workshop Level 5 (25% discount): ₡300,000
- With Workshop Level 10 (50% discount): ₡200,000

### Investment Strategy (₡3M Starting Budget)

**Early Game** (₡62K-₡150K range):
- Practice Sword (₡62.5K) - baseline weapon
- Combat Shield (₡100K) - defensive option
- Machine Gun (₡150K) - solid one-handed
- **Strategy**: Focus on robot attribute upgrades first
- **Budget**: ₡300K-₡500K for initial weapons

**Mid Game** (₡175K-₡275K range):
- Laser Rifle (₡244K) - precision energy
- Plasma Blade (₡269K) - fast melee
- Plasma Rifle (₡275K) - high damage
- **Strategy**: Upgrade Weapons Workshop for discounts
- **Budget**: ₡500K-₡800K for quality weapons

**Late Game** (₡375K-₡538K range):
- Battle Axe (₡388K) - melee powerhouse
- Plasma Cannon (₡400K) - energy elite
- Heavy Hammer (₡450K) - maximum impact
- Railgun (₡488K) - ultra penetration
- Ion Beam (₡538K) - highest DPS
- **Strategy**: Craft custom legendary weapons
- **Budget**: ₡1M+ for elite arsenal

### Strategic Options with ₡3M Budget

**Strategy 1: Power Rush (Single Robot)**
- 1 maxed robot (₡1.6M) + elite weapon (₡400K) + facilities (₡500K) + buffer (₡500K)

**Strategy 2: Balanced Growth**
- 1 robot (₡500K) + moderate upgrades (₡600K) + facilities (₡1M) + weapons (₡400K) + buffer (₡500K)

**Strategy 3: Multi-Robot**
- 3 robots (₡1.5M) + basic upgrades (₡900K) + facilities (₡300K) + weapons (₡300K)


---

## Weapon Crafting System

**Design Costs:**
- Base weapon template: ₡500,000
- Stat customization: ₡50,000 per attribute point
- Special properties: ₡200,000 per property

**Requirements:**
- Unlock **Weapons Workshop Level 3** (see [STABLE_SYSTEM.md](../STABLE_SYSTEM.md#3-weapons-workshop))
- Have 10+ battles with similar weapon types
- Minimum 5,000 prestige

**Customization Options:**
- Choose base damage (within range)
- Choose cooldown (within range)
- Allocate bonus attribute points (limited budget)
- Select one special property from list

**Workshop Benefits:**
The **Weapons Workshop** facility (see [STABLE_SYSTEM.md](../STABLE_SYSTEM.md#3-weapons-workshop)) provides:
- **Weapon Purchase Discounts**: 5% to 50% (Levels 1-10)
- **Operating Cost**: ₡1,000/day at Level 1, +₡500/day per level
- **Level 3**: Unlock weapon modifications
- **Level 6**: Unlock custom weapon design
- **Level 10**: Unlock legendary weapon crafting

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
4. `StatComparison.tsx`: Component showing base vs effective stats

**Modified Components:**
1. `RobotDetailPage.tsx`: Add loadout and weapon sections
2. `Navigation.tsx`: ~~Add link to Weapon Inventory page~~ (Removed - functionality integrated into Weapon Shop)

### Stat Calculation Implementation

**Location**: `/prototype/backend/src/utils/robotCalculations.ts`

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

### Database Schema Reference

**Weapon Model:**
- id, name, description, weaponType, handsRequired, damageType
- baseDamage, cooldown, cost
- 23 attribute bonus fields (one per robot attribute)

**WeaponInventory Model:**
- id, userId, weaponId
- Relationships: User (many-to-one), Weapon (many-to-one)

**Robot Model:**
- mainWeaponId, offhandWeaponId, loadoutType
- currentHP, maxHP, currentShield, maxShield
- 23 base attribute fields

**Key Relationships:**
- User → WeaponInventory (one-to-many)
- WeaponInventory → Weapon (many-to-one)
- Robot → WeaponInventory (many-to-one for main)
- Robot → WeaponInventory (many-to-one for offhand)

### Utility Files

**Backend: /utils/robotCalculations.ts**
- calculateEffectiveStats(robot)
- calculateMaxHP(hullIntegrity, weaponBonuses, loadoutBonus)
- calculateMaxShield(shieldCapacity, weaponBonuses, loadoutBonus)

**Backend: /utils/weaponValidation.ts**
- isWeaponCompatibleWithLoadout(weapon, loadoutType)
- canEquipToSlot(weapon, slot, loadoutType)
- Shield restriction validation

**Frontend: /utils/robotStats.ts**
- calculateAttributeBonus(baseValue, weaponBonus, loadoutBonus)
- getAttributeDisplay(attributeName, value)
- calculateEffectiveStats(robot)

---

## Implementation Status

### What's Implemented ✅

**Backend:**
- ✅ Complete database schema (Weapon, WeaponInventory, Robot models)
- ✅ 23 weapons seeded in database
- ✅ GET /api/weapons (list all weapons)
- ✅ POST /api/weapon-inventory/purchase (purchase weapon)
- ✅ GET /api/weapon-inventory (get user's inventory)
- ✅ PUT /api/robots/:id/equip-main-weapon
- ✅ PUT /api/robots/:id/equip-offhand-weapon
- ✅ DELETE /api/robots/:id/unequip-main-weapon
- ✅ DELETE /api/robots/:id/unequip-offhand-weapon
- ✅ PUT /api/robots/:id/loadout-type
- ✅ Storage capacity enforcement
- ✅ Weapon Workshop discount system
- ✅ Stat calculation utilities
- ✅ Weapon validation logic
- ✅ DPS-inclusive pricing formula

**Frontend:**
- ✅ WeaponShopPage (displays and allows purchasing)
- ✅ "Only Owned Weapons" filter in shop
- ✅ LoadoutSelector component
- ✅ WeaponSlot component
- ✅ WeaponSelectionModal component
- ✅ Stat display with breakdowns
- ✅ Storage capacity display
- ✅ Duplicate purchase warnings

### User Stories Coverage

| Story | Status | Implementation |
|-------|--------|----------------|
| US-1: Equip Main Weapon | ✅ Complete | Backend API + Frontend UI |
| US-2: Equip Offhand Weapon | ✅ Complete | Backend API + Frontend UI |
| US-3: Unequip Weapon | ✅ Complete | Backend API + Frontend UI |
| US-4: Change Loadout Type | ✅ Complete | Backend API + Frontend UI |
| US-5: View Weapon Inventory | ✅ Complete | Integrated into Weapon Shop |
| US-6: View Effective Stats | ✅ Complete | Stat display with breakdowns |
| US-7: Storage Capacity | ✅ Complete | Backend enforcement + UI display |

### Future Enhancements

**Weapon Crafting System** (Workshop Level 6+):
- Custom weapon design
- Stat customization within ranges
- Special property selection
- Requires prestige and battle experience

**Weapon Modifications** (Workshop Level 3+):
- Upgrade existing weapons
- Add attribute bonuses
- Modify damage/cooldown
- Costs credits and materials

**Legendary Weapons** (Workshop Level 10):
- Unique weapons with special abilities
- Requires high prestige (10,000+)
- Expensive crafting costs
- Limited availability

**Additional Features:**
- Advanced range mechanics (short/medium/long)
- Special weapon properties in combat
- Expanded weapon catalog
- Weapon trading/marketplace


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

### End-to-End Tests

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

## Dependencies & Risks

### Dependencies

**Technical:**
- Database schema already in place (Weapon, WeaponInventory, Robot models)
- Weapon seed data exists (23 weapons defined)
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

## Technical Reference

### API Endpoints

#### Equipment Endpoints

**Equip Main Weapon**
```
PUT /api/robots/:robotId/equip-main-weapon
Body: { weaponInventoryId: number }
Response: { robot: Robot, message: string }
Errors: 404 (not found), 400 (validation), 500 (server)
```

**Equip Offhand Weapon**
```
PUT /api/robots/:robotId/equip-offhand-weapon
Body: { weaponInventoryId: number }
Response: { robot: Robot, message: string }
Errors: 400 (loadout doesn't support offhand), 404, 500
```

**Unequip Weapons**
```
DELETE /api/robots/:robotId/unequip-main-weapon
DELETE /api/robots/:robotId/unequip-offhand-weapon
Response: { robot: Robot, message: string }
```

**Change Loadout Type**
```
PUT /api/robots/:robotId/loadout-type
Body: { loadoutType: "single" | "weapon_shield" | "two_handed" | "dual_wield" }
Response: { robot: Robot, message: string }
Errors: 400 (invalid type or incompatible weapons)
```

### Validation Rules

**Weapon Ownership:**
- Weapon must belong to the user attempting to equip it

**Single Equipment:**
- A weapon can only be equipped to one robot at a time

**Loadout Compatibility:**
- **single**: One-handed weapon in main, nothing in offhand
- **weapon_shield**: One-handed in main, shield in offhand
- **two_handed**: Two-handed weapon in main, nothing in offhand
- **dual_wield**: One-handed in main, one-handed in offhand

**Weapon Type Restrictions:**
- Shield weapons can ONLY go in offhand with weapon_shield loadout
- Main weapon must be equipped when offhand shield is equipped

**Storage Capacity:**
- Total weapons owned ≤ 5 + (Storage Facility Level × 5)
- Applies to purchases, not equipment changes

### Stat Calculation

**Effective Stats Formula:**
```
effective_stat = (base_stat + main_weapon_bonus + offhand_weapon_bonus) × (1 + loadout_bonus_percent / 100)
```

**Max HP Calculation:**
```
maxHP = effective_hull_integrity × 10
```

**Max Shield Calculation:**
```
maxShield = effective_shield_capacity × 2
```

**Loadout Bonuses:**
- weapon_shield: +20% Shield Capacity, +15% Armor Plating, +10% Counter Protocols, -15% Attack Speed
- two_handed: +10% Combat Power, +20% Critical Systems, -10% Evasion Thrusters, 1.10× damage multiplier
- dual_wield: +30% Attack Speed, +15% Weapon Control, -20% Penetration, -10% Combat Power
- single: +10% Gyro Stabilizers, +5% Servo Motors

### Database Schema

**Weapon Model:**
- id, name, description, weaponType, handsRequired, damageType
- baseDamage, cooldown, cost
- 23 attribute bonus fields (one per robot attribute)

**WeaponInventory Model:**
- id, userId, weaponId
- Relationships: User (many-to-one), Weapon (many-to-one)

**Robot Model:**
- mainWeaponId, offhandWeaponId, loadoutType
- currentHP, maxHP, currentShield, maxShield
- 23 base attribute fields

**Key Relationships:**
- User → WeaponInventory (one-to-many)
- WeaponInventory → Weapon (many-to-one)
- Robot → WeaponInventory (many-to-one for main)
- Robot → WeaponInventory (many-to-one for offhand)

### Frontend Components

**LoadoutSelector.tsx:**
- Radio button group for 4 loadout types
- Display bonuses (green) and penalties (red)
- Call API to change loadout
- Show validation errors

**WeaponSlot.tsx:**
- Display empty slot or equipped weapon
- Show weapon stats and bonuses
- "Equip", "Change", "Unequip" buttons
- Disabled state based on loadout type

**WeaponSelectionModal.tsx:**
- List available weapons from inventory
- Filter by compatibility
- Show weapon details
- Show if weapon equipped to another robot

**StatComparison.tsx:**
- Display base, weapon bonuses, loadout modifier, effective value
- Color code: green for positive, red for negative
- Expandable/collapsible detail view

### Utility Files

**Backend: /utils/robotCalculations.ts**
- calculateEffectiveStats(robot)
- calculateMaxHP(hullIntegrity, weaponBonuses, loadoutBonus)
- calculateMaxShield(shieldCapacity, weaponBonuses, loadoutBonus)

**Backend: /utils/weaponValidation.ts**
- isWeaponCompatibleWithLoadout(weapon, loadoutType)
- canEquipToSlot(weapon, slot, loadoutType)
- Shield restriction validation

**Frontend: /utils/robotStats.ts**
- calculateAttributeBonus(baseValue, weaponBonus, loadoutBonus)
- getAttributeDisplay(attributeName, value)
- calculateEffectiveStats(robot)


---

## Testing & Validation

### Unit Tests

**Backend:**
- ✅ Stat calculation functions (all formulas)
- ✅ Validation functions (loadout compatibility)
- ✅ Weapon equipping logic
- ✅ Loadout bonus calculations
- ✅ Pricing formula calculations

**Frontend:**
- ✅ Component rendering
- ✅ Stat display calculations
- ✅ Modal interactions

### Integration Tests

**API Tests:**
- ✅ Equip weapon: successful case
- ✅ Equip weapon: already equipped to another robot
- ✅ Equip weapon: incompatible with loadout type
- ✅ Unequip weapon: successful case
- ✅ Change loadout: successful case
- ✅ Change loadout: incompatible weapons equipped
- ✅ Storage capacity: purchase blocked when full
- ✅ Storage capacity: purchase allowed when space available

### Success Metrics

**Engagement:**
- % of players who equip at least 1 weapon (target: 90%+)
- % of robots with at least 1 weapon equipped (target: 90%+)
- Average number of loadout changes per robot (target: 3+)
- % of players who try all 4 loadout types (target: 40%+)

**Quality:**
- Weapon equipping error rate (target: <5%)
- Average time to equip first weapon (target: <2 minutes)
- Support tickets related to weapon system (target: <10% of total)

**Technical:**
- API response time for weapon operations (target: <200ms p95)
- Stat calculation accuracy (target: 100%)
- Zero critical bugs in production after 1 week

---

## Quick Reference Tables

### Loadout Compatibility Matrix

| Weapon Type | Hands | Compatible Loadouts | Notes |
|-------------|-------|---------------------|-------|
| One-handed weapons (15) | One | Single, Weapon+Shield, Dual-Wield | Can equip in main or offhand |
| Two-handed weapons (8) | Two | Two-Handed only | Occupies both slots |
| Shield weapons (3) | Shield | Weapon+Shield (offhand only) | Requires main weapon equipped |

### Weapon Pricing by Tier

**Budget Tier (₡62K-₡150K):** 8 weapons  
**Mid Tier (₡175K-₡250K):** 5 weapons  
**Premium Tier (₡275K-₡400K):** 5 weapons  
**Elite Tier (₡375K+):** 5 weapons

See [SEED_DATA_SPECIFICATION.md](../prd_core/SEED_DATA_SPECIFICATION.md) for complete pricing.

### Storage Capacity by Facility Level

| Level | Capacity | Formula |
|-------|----------|---------|
| 0 | 5 weapons | Base |
| 1 | 10 weapons | 5 + (1 × 5) |
| 5 | 30 weapons | 5 + (5 × 5) |
| 10 | 55 weapons | 5 + (10 × 5) |

---

## Conclusion

The Weapons & Loadout System provides a comprehensive, balanced, and strategic equipment system for Armoured Souls. With 23 implemented weapons, 4 distinct loadout types, and a robust DPS-inclusive pricing formula, players have meaningful choices that affect combat performance.

**Key Achievements:**
- ✅ Complete weapon lifecycle (purchase → equip → battle → unequip)
- ✅ Strategic loadout system with trade-offs
- ✅ Balanced economy with transparent pricing formula
- ✅ Robust validation and error handling
- ✅ Intuitive UI with clear feedback
- ✅ Comprehensive testing coverage

**Primary References:**
- **⭐ [SEED_DATA_SPECIFICATION.md](../prd_core/SEED_DATA_SPECIFICATION.md)** - Complete weapon catalog (23 weapons)
- **⭐ [PRD_WEAPON_ECONOMY_OVERHAUL.md](../PRD_WEAPON_ECONOMY_OVERHAUL.md)** - Pricing formula and economy design
- **[OPTION_C_IMPLEMENTATION.md](../OPTION_C_IMPLEMENTATION.md)** - Current economy (₡3M starting budget)

**Future Roadmap:**
- Weapon crafting and modifications
- Legendary weapons
- Advanced range mechanics
- Expanded weapon catalog
- Special weapon abilities


---

## Appendices

### A. Loadout Type Reference

| Loadout Type | Main Slot | Offhand Slot | Bonuses | Penalties |
|--------------|-----------|--------------|---------|-----------|
| Single | 1H weapon | Empty | +10% Gyro, +5% Servo | None |
| Weapon+Shield | 1H weapon | Shield | +20% Shield Cap, +15% Armor, +10% Counter | -15% Attack Speed |
| Two-Handed | 2H weapon | Empty | +10% Combat Power, +20% Crit, 1.10× damage, 2.5× crit multiplier | -10% Evasion |
| Dual-Wield | 1H weapon | 1H weapon | +30% Attack Speed, +15% Weapon Control | -20% Penetration, -10% Combat Power |

### B. Weapon Compatibility Matrix

| Weapon Type | Hands Required | Compatible Loadouts | Notes |
|-------------|----------------|---------------------|-------|
| One-handed weapons (15) | One | Single, Weapon+Shield, Dual-Wield | Can equip in main or offhand |
| Two-handed weapons (8) | Two | Two-Handed only | Occupies both slots |
| Shield weapons (3) | Shield | Weapon+Shield (offhand only) | Requires main weapon equipped |

**Compatibility Rules:**
- One-handed weapons: Can be used in multiple loadouts and slots. Players can own 2 copies of the same weapon and equip both for Dual-Wield
- Shield weapons: Offhand only, must have main weapon equipped
- Two-handed weapons: Exclusive to Two-Handed loadout

### C. Example Stat Calculations

**Example 1: Robot with Laser Rifle, Single Loadout**
```
Base Combat Power: 10
Laser Rifle Bonus: +2
Single Loadout Bonus: 0%
Effective Combat Power: 12

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
Machine Gun 1 Bonus: +5
Machine Gun 2 Bonus: +5
Dual-Wield Loadout: +30%
Effective Attack Speed: (18 + 5 + 5) * 1.30 = 36.4 → 36

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
| WPN006 | "Storage capacity full. Upgrade Storage Facility to purchase more weapons." | Total weapons owned ≥ storage capacity |
| WPN007 | "Shield weapons can only be equipped in offhand slot with Weapon+Shield loadout." | Attempted to equip shield in main slot or wrong loadout |
| WPN008 | "Main weapon must be equipped before equipping a shield." | Attempted to equip shield without main weapon |

### E. Implementation Phases

**Phase 1: Backend API & Core Logic** (✅ Complete)
- Created `/utils/robotCalculations.ts` with stat calculation functions
- Created `/utils/weaponValidation.ts` with validation logic
- Implemented all weapon equipment endpoints
- Added storage capacity enforcement
- Wrote unit tests for stat calculations
- Wrote integration tests for weapon equipping API

**Phase 2: Frontend Weapon Equipment UI** (✅ Complete)
- Created `LoadoutSelector` component
- Created `WeaponSlot` component
- Created `WeaponSelectionModal` component
- Enhanced `RobotDetailPage` with loadout and weapon sections
- Implemented weapon filtering based on loadout type
- Implemented stat display showing base + weapon + loadout + effective
- Added real-time stat updates
- Display remaining weapon storage capacity
- Added duplicate weapon purchase confirmation dialog
- Added loading states and error handling

**Phase 3: Weapon Inventory Management** (✅ Complete - Integrated into Weapon Shop)
- Originally planned as separate page
- Integrated into Weapon Shop via "Only Owned Weapons" filter
- Provides better UX by keeping all weapon browsing in one place

**Phase 4: Polish & Edge Cases** (✅ Complete)
- Added confirmation dialogs for destructive actions
- Added tooltips explaining loadout bonuses
- Added weapon icons/illustrations
- Improved mobile responsive layout
- Performance optimization for stat calculations

---

**Document Version**: v3.0  
**Last Reviewed**: February 10, 2026  
**Status**: Complete - All content from PRD_WEAPON_LOADOUT.md and WEAPONS_AND_LOADOUT.md has been integrated
