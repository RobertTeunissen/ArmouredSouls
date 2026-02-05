# Weapons & Loadout System

**Last Updated**: February 5, 2026  
**Status**: Design Document - Updated for Combat Rebalancing (v1.1)

**Version History:**
- **v1.0** (Feb 2, 2026): Initial weapon catalog with DPS-inclusive pricing
- **v1.1** (Feb 5, 2026): Updated weapon damage values following combat rebalancing

**Key Changes in v1.1:**
- All weapon damage values reduced 20-33% to compensate for new damage formula
- Energy shields now absorb 100% damage (was 70%), making damage more effective
- Armor Plating uses percentage-based reduction (1.5% per point, no cap)
- See [COMBAT_FORMULAS.md](COMBAT_FORMULAS.md) and [PRD_WEAPON_ECONOMY_OVERHAUL.md](PRD_WEAPON_ECONOMY_OVERHAUL.md) v1.1 for details

## Overview

This document details the complete weapons and loadout system for Armoured Souls. It covers weapon ownership, inventory management, loadout configurations, weapon types, and the complete weapon catalog.

**Related Documentation:**
- [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Robot attributes and combat mechanics
- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) - Stable management and facilities
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database structure and relationships

---

## Ownership & Management

### Core Principles

**User/Stable Ownership:**
- A logged-in user controls a **stable** (their account)
- Users purchase weapons using available **Credits (₡)** from the stable's resources
- Purchased weapons are placed in the **stable's weapon storage** (not robot-specific)
- A user/stable may possess **multiple instances of the same weapon** (buy multiple copies)
- Each weapon purchase creates a separate inventory item

**Weapon States:**
- **Available**: Weapon is in storage, ready to be equipped
- **Equipped**: Weapon is assigned to a specific robot
- **Important**: A weapon can never be equipped to multiple robots simultaneously (each robot needs its own copy)

**Storage Management:**
- Default storage capacity: **5 weapons** (Storage Facility Level 0)
- Storage can be expanded via the **Storage Facility** upgrade (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md))
- Storage capacity formula: **5 + (Storage Facility Level × 5)**
- Maximum storage capacity: **55 weapons** (Storage Facility Level 10)
- Storage limit is per stable (not per robot)
- **Storage Definition**: Total number of weapons owned by the stable, including both **equipped and unequipped** weapons. This simplifies the system by ensuring players can always swap weapons without storage constraints.

---

## Weapon Inventory System

**Phase 1 Implementation**: Players purchase weapons from the Weapon Shop and they are added to their inventory. Each weapon purchase creates a separate inventory item, allowing owning multiple copies of the same weapon.

### How It Works

1. **Purchase**: Players buy weapons from the Weapon Shop using Credits (₡)
2. **Storage**: Weapons go into the user's inventory (stable-level, not robot-specific)
3. **Equipment**: Players assign weapons from inventory to robots via the robot detail page
4. **Loadout Types**: Robots support different loadout configurations:
   - **Single**: One main weapon slot
   - **Weapon + Shield**: Main weapon + offhand weapon (shield)
   - **Two-Handed**: One two-handed weapon (uses both slots)
   - **Dual-Wield**: Main weapon + offhand weapon (both offensive)

### Weapon Assignment

- Weapons can only be equipped to one robot at a time
- To use the same weapon on multiple robots, purchase multiple copies
- Robots can unequip weapons to free them for other robots
- Loadout type determines which slots are available
- Available weapons are shown when equipping from the robot detail page

### Storage Capacity

The **Storage Facility** (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md#7-storage-facility)) determines weapon storage capacity.

---

## Loadout System

Robots are bipedal humanoids with two arms. Loadout determines how weapons/shields are equipped and are set on robot level.

### Design Rationale: Why Percentage-Based Bonuses?

Loadouts use **percentage-based bonuses** rather than flat attribute bonuses for several critical reasons:

1. **Power Scaling**: Percentages scale proportionally with robot power level
   - A +20% bonus benefits both a level 5 robot and a level 50 robot fairly
   - Flat bonuses (+5 to attribute) become negligible at high levels
   - Example: +5 Armor Plating matters at level 10 (50% increase) but is trivial at level 50 (10% increase)

2. **Meaningful Choices at All Stages**: 
   - Early game: 20% of 10 = 2 extra Shield Capacity
   - Late game: 20% of 40 = 8 extra Shield Capacity
   - The choice remains strategically significant throughout the game

3. **Multiplicative Progression**:
   - Creates more interesting build variety
   - Encourages specialization (high Shield Capacity builds benefit more from shield loadout)
   - Prevents linear, predictable power curves

4. **Balance Maintenance**:
   - Easier to balance once, applies fairly at all levels
   - Flat bonuses would require constant rebalancing as players progress
   - Percentages maintain relative power relationships

### Loadout Configurations for Battle

**1. Weapon + Shield**
- **Equipment**: One weapon (left or right hand) + Shield weapon (other hand)
- **Bonuses**:
  - +20% to Shield Capacity
  - +15% to Armor Plating
  - +10% to Counter Protocols (shield can block and counter)
- **Penalties**:
  - -15% to Attack Speed (shield weight)
  - Cannot use two-handed weapons
- **Best For**: Tank builds, defensive strategies

**2. Two-Handed Weapon**
- **Equipment**: One two-handed weapon (both hands)
- **Bonuses**:
  - +25% to Combat Power
  - +20% to Critical Systems
  - Critical damage multiplier increased to 2.5x (from 2.0x base)
- **Penalties**:
  - -10% to Evasion Thrusters (less mobility)
  - No shield available
- **Best For**: Glass cannon builds, high burst damage

**3. Dual-Wield (Two Weapons)**
- **Equipment**: Two one-handed weapons (one in each hand)
- **Bonuses**:
  - +30% to Attack Speed
  - Can alternate attacks between weapons
  - +15% to Weapon Control
- **Penalties**:
  - -20% to Penetration (less force per strike)
  - -10% to Combat Power
  - No shield available
- **Best For**: Speed builds, sustained DPS

**4. Single Weapon (No Shield)**
- **Equipment**: One weapon (left or right hand), other hand free
- **Bonuses**:
  - +10% to Gyro Stabilizers
  - +5% to Servo Motors
  - No significant penalties
- **Penalties**:
  - No specialized bonuses like other loadouts
- **Best For**: Balanced builds, flexible strategies

### Loadout Implementation

- Players choose loadout before battle (saved in robot configuration)
- Loadout can be changed between battles (not during)
- Available from the start - robots can be upgraded to specialize in a category

**Weapon Compatibility Rules:**
- **One-handed weapons** (not shields):
  - Can be equipped in main hand OR off hand
  - Compatible with: Single, Weapon + Shield (main only), Dual-Wield (both slots)
  - NOT compatible with: Two-Handed loadout
  - Players can own multiple copies and equip the same weapon to both main and offhand slots (for Dual-Wield)
- **Two-handed weapons**:
  - Require Two-Handed loadout
  - Occupy both weapon slots
  - NOT compatible with: Single, Weapon + Shield, Dual-Wield
- **Shield weapons**:
  - Can ONLY be equipped in offhand slot
  - Require Weapon + Shield loadout
  - Main weapon must also be equipped (configuration incomplete without main weapon)
  - NOT compatible with: Single, Two-Handed, Dual-Wield

---

## Weapon Types & Properties

### Weapon Categories

**Energy Weapons:**
- **Damage Type**: Energy (more effective vs energy shields, +20%)
- **Characteristics**: Precise, consistent damage
- **Examples**: Laser Rifle, Plasma Cannon, Ion Beam

**Ballistic Weapons:**
- **Damage Type**: Kinetic (standard vs armor)
- **Characteristics**: Variable damage, high penetration
- **Examples**: Machine Gun, Railgun, Shotgun

**Melee Weapons:**
- **Damage Type**: Impact (benefits from Hydraulic Systems)
- **Characteristics**: High burst damage, positioning-dependent
- **Examples**: Power Sword, Hammer, Plasma Blade

**Shield Weapons:**
- **Damage Type**: N/A (defensive equipment)
- **Characteristics**: Provides defensive bonuses, enables counters
- **Examples**: Combat Shield, Energy Barrier
- **Note**: "Shield" refers to physical shield equipment for loadout, NOT energy shields

**Important: Energy Shield vs Shield Weapon**
- **Energy Shields**: Separate HP pool that all robots have (powered by Shield Capacity attribute)
  - Absorbs damage at 70% effectiveness (see [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md#penetration-vs-defense))
  - Regenerates during battle based on Power Core attribute
  - Resets to full after battle
- **Shield Weapons**: Physical equipment that can be equipped in offhand slot
  - Requires "Weapon + Shield" loadout configuration
  - Provides attribute bonuses (Armor Plating, Counter Protocols, Shield Capacity)
  - Enables additional defensive abilities

**Note**: Advanced range mechanics (short/medium/long range bands) are planned for future releases. See [ROADMAP.md](ROADMAP.md) for details. Currently, the system uses melee vs ranged distinction only.

### Weapon Attributes

Each weapon has:
1. **Base Damage** - Raw damage value
2. **Cooldown** - Time between attacks (seconds, for time-based combat)
3. **Cost** - Credits to purchase
4. **Weapon Type** - "energy", "ballistic", "melee", "shield"
5. **Hands Required** - "one", "two", "shield"
6. **Damage Type** - "energy", "ballistic", "melee", "explosive" (determines damage calculation)
7. **Attribute Bonuses** - Modifies specific robot attributes when equipped
8. **Special Properties** - Unique effects

**Complete weapon attribute bonus list** 
- Must match Robot attribute names in [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)):
- All bonuses default to 0 and can be positive or negative for trade-offs which impacts costs.

---

## Weapon Catalog

### Phase 1 - Implemented Weapons (11 Total)

The following weapons are currently implemented in the game database and available for purchase. All weapons are priced using the DPS-inclusive formula detailed in [PRD_WEAPON_ECONOMY_OVERHAUL.md](PRD_WEAPON_ECONOMY_OVERHAUL.md).

**Pricing Note**: Weapon costs now reflect both attribute bonuses and combat effectiveness (DPS = damage/cooldown). Special properties are not yet implemented in the combat system and have been removed from weapon definitions.

#### Energy Weapons (3)

**Laser Rifle** (₡195,000) - One-handed
- Base Damage: 15  (v1.1: reduced from 22, -32%)
- Cooldown: 3 seconds
- DPS: 5.0  (v1.1: reduced from 7.33)
- Attribute Bonuses:
  - targetingSystemsBonus: +5
  - weaponControlBonus: +4
  - attackSpeedBonus: +3
  - combatPowerBonus: +2
- Description: Precision energy rifle with excellent accuracy
- **Loadout Compatibility**: Single, Weapon + Shield, Dual-Wield

**Plasma Cannon** (₡440,000) - Two-handed
- Base Damage: 32  (v1.1: reduced from 45, -29%)
- Cooldown: 5 seconds
- DPS: 6.4  (v1.1: reduced from 9.0)
- Attribute Bonuses:
  - combatPowerBonus: +7
  - criticalSystemsBonus: +6
  - penetrationBonus: +4
  - powerCoreBonus: -3 (energy drain)
- Description: Heavy plasma weapon with devastating firepower
- **Loadout Compatibility**: Two-Handed only

**Ion Beam** (₡565,000) - Two-handed
- Base Damage: 28  (v1.1: reduced from 40, -30%)
- Cooldown: 4 seconds
- DPS: 7.0  (v1.1: reduced from 10.0) (Highest DPS in game)
- Attribute Bonuses:
  - penetrationBonus: +10
  - shieldCapacityBonus: +8
  - attackSpeedBonus: +5
  - targetingSystemsBonus: +4
- Description: Focused energy beam with shield disruption
- **Loadout Compatibility**: Two-Handed only

#### Ballistic Weapons (3)

**Machine Gun** (₡120,000) - One-handed, Dual-wield compatible
- Base Damage: 7  (v1.1: reduced from 10, -30%)
- Cooldown: 2 seconds
- DPS: 3.5  (v1.1: reduced from 5.0)
- Attribute Bonuses:
  - combatPowerBonus: +3
  - attackSpeedBonus: +5
  - weaponControlBonus: +2
- Description: Sustained fire support weapon
- **Loadout Compatibility**: Single, Weapon + Shield, Dual-Wield

**Railgun** (₡545,000) - Two-handed
- Base Damage: 39  (v1.1: reduced from 55, -29%)
- Cooldown: 6 seconds
- DPS: 6.5  (v1.1: reduced from 9.17)
- Attribute Bonuses:
  - penetrationBonus: +12
  - targetingSystemsBonus: +7
  - combatPowerBonus: +5
  - attackSpeedBonus: -4 (slow charge time)
- Description: Ultra-high velocity kinetic weapon with extreme penetration
- **Loadout Compatibility**: Two-Handed only

**Shotgun** (₡325,000) - Two-handed
- Base Damage: 22  (v1.1: reduced from 32, -31%)
- Cooldown: 4 seconds
- DPS: 5.5  (v1.1: reduced from 8.0)
- Attribute Bonuses:
  - combatPowerBonus: +4
  - criticalSystemsBonus: +3
  - targetingSystemsBonus: -2 (spread pattern)
- Description: Close-range devastation with wide spread
- **Loadout Compatibility**: Two-Handed only

#### Melee Weapons (3)

**Power Sword** (₡280,000) - One-handed
- Base Damage: 20  (v1.1: reduced from 28, -29%)
- Cooldown: 3 seconds
- DPS: 6.67  (v1.1: reduced from 9.33)
- Attribute Bonuses:
  - hydraulicSystemsBonus: +7
  - counterProtocolsBonus: +5
  - gyroStabilizersBonus: +4
  - combatPowerBonus: +3
- Description: High-tech melee weapon with superior handling
- **Loadout Compatibility**: Single, Weapon + Shield, Dual-Wield

**Hammer** (₡490,000) - Two-handed
- Base Damage: 34  (v1.1: reduced from 48, -29%)
- Cooldown: 5 seconds
- DPS: 6.8  (v1.1: reduced from 9.6)
- Attribute Bonuses:
  - hydraulicSystemsBonus: +8
  - combatPowerBonus: +7
  - criticalSystemsBonus: +4
  - servoMotorsBonus: -3 (very heavy)
- Description: Massive impact weapon for maximum damage
- **Loadout Compatibility**: Two-Handed only

**Plasma Blade** (₡215,000) - One-handed, Dual-wield compatible
- Base Damage: 14  (v1.1: reduced from 20, -30%)
- Cooldown: 3 seconds (adjusted from 2.5 for integer compatibility)
- DPS: 4.67  (v1.1: reduced from 6.67)
- Attribute Bonuses:
  - hydraulicSystemsBonus: +5
  - attackSpeedBonus: +4
  - criticalSystemsBonus: +3
  - gyroStabilizersBonus: +2
- Description: Energy-enhanced melee blade with rapid strikes
- **Loadout Compatibility**: Single, Weapon + Shield, Dual-Wield

#### Shield Weapons (1)

**Combat Shield** (₡80,000) - Shield type
- Base Damage: 0 (defensive only)
- Cooldown: N/A
- DPS: N/A (defensive equipment)
- Attribute Bonuses:
  - armorPlatingBonus: +6
  - counterProtocolsBonus: +3
  - evasionThrustersBonus: -2 (heavy)
  - shieldCapacityBonus: +5 (boosts energy shield capacity)
- Description: Heavy-duty shield with counter capabilities
- **Loadout Compatibility**: Weapon + Shield only

#### Baseline Weapon (1)

**Practice Sword** (₡50,000) - One-handed baseline weapon
- Base Damage: 8  (v1.1: reduced from 10, -20% - NEW BASELINE)
- Cooldown: 3 seconds
- DPS: 2.67  (v1.1: NEW baseline for pricing formula, was 3.33)
- Attribute Bonuses: None (all bonuses are 0)
- Description: Basic training weapon establishing baseline cost for the weapon economy
- **Loadout Compatibility**: Single, Weapon + Shield, Dual-Wield
- **Note**: This weapon serves as the baseline for the DPS-inclusive pricing formula. All other weapons are priced relative to its cost and combat effectiveness. In v1.1, damage was reduced to compensate for new combat formula.

---

### Phase 2+ - Planned Future Weapons

The following weapons are planned for future releases but not yet implemented:

**Energy Barrier** (₡200,000) - Shield type *(Planned)*
- Base Damage: 0 (defensive only)
- Cooldown: N/A
- Attribute Bonuses:
  - shieldCapacityBonus: +10 (boosts energy shield capacity)
  - powerCoreBonus: +4
  - servoMotorsBonus: -3
- Special: Reflects 20% of energy weapon damage
- **Loadout Compatibility**: Weapon + Shield only

Additional weapons will be added in future phases based on player feedback and game balance needs.

---

## Weapon Crafting System

**Design Costs:**
- Base weapon template: ₡500,000
- Stat customization: ₡50,000 per attribute point
- Special properties: ₡200,000 per property

**Requirements:**
- Unlock **Weapons Workshop Level 3** (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md#3-weapons-workshop))
- Have 10+ battles with similar weapon types
- Minimum 5,000 prestige

**Customization Options:**
- Choose base damage (within range)
- Choose cooldown (within range)
- Allocate bonus attribute points (limited budget)
- Select one special property from list

**Workshop Benefits:**
The **Weapons Workshop** facility (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md#3-weapons-workshop)) provides:
- **Weapon Purchase Discounts**: 10% to 55% (Levels 1-10)
- **Operating Cost**: ₡1,000/day at Level 1, +₡500/day per level
- **Level 3**: Unlock weapon modifications
- **Level 6**: Unlock custom weapon design
- **Level 10**: Unlock legendary weapon crafting

---

## Weapon Purchase & Economy

### Purchase Process

**UI Navigation:**
- Weapon Shop accessible via main navigation menu or stable interface
- In Phase 1 prototype: Direct "Weapon Shop" page in frontend
- Future versions: May be integrated into stable "Workshop Tab" (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md) line 454)

**Purchase Steps:**
1. **Browse Weapon Shop**: View all available weapons from catalog
2. **Check Storage**: Ensure storage capacity is available
3. **Purchase**: Spend Credits (₡) to add weapon to inventory
4. **Equip**: Assign weapon to robot from robot detail page

### Cost Optimization

**Weapons Workshop Discounts** (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md#3-weapons-workshop)):
- Level 0: No discount
- Level 1: 5% discount on weapon purchases
- Level 2: 10% discount
- Level 3: 15% discount + weapon modifications
- Level 4: 20% discount (requires 1,500 prestige)
- Level 5: 25% discount
- Level 6: 30% discount + custom weapon design
- Level 7: 35% discount (requires 5,000 prestige)
- Level 8: 40% discount
- Level 9: 45% discount (requires 10,000 prestige)
- Level 10: 50% discount + legendary weapon crafting

**Discount Formula**: Discount % = Weapons Workshop Level × 5

**Example Cost Calculation:**
- Plasma Cannon base cost: ₡440,000
- With Weapons Workshop Level 5 (25% discount): ₡330,000
- With Weapons Workshop Level 10 (50% discount): ₡220,000

### Economy Guidelines

**Starting Budget**: ₡2,000,000 (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md))
- Can afford: 1 robot (₡500K) + good weapon (₡200K-₡300K) + upgrades (₡500K) + facility (₡200K) = ₡1.4M-₡1.5M
- Leaves ₡500K-₡600K buffer for additional purchases

**Weapon Investment Strategy:**
1. **Early Game**: Buy affordable weapons (₡50K-₡120K range)
   - Practice Sword (₡50K), Combat Shield (₡80K), Machine Gun (₡120K)
   - Focus on robot attribute upgrades first
   - Dual-wield budget weapons for ₡100K-₡200K total
2. **Mid Game**: Invest in premium one-handed weapons (₡200K-₡300K)
   - Plasma Blade (₡215K), Power Sword (₡280K)
   - Or dual-wield for flexibility
   - Upgrade Weapons Workshop for discounts
3. **Late Game**: Purchase elite two-handed weapons (₡400K-₡600K)
   - Plasma Cannon (₡440K), Hammer (₡490K), Railgun (₡545K), Ion Beam (₡565K)
   - Craft custom legendary weapons
   - Consider dual-wielding premium weapons as alternative strategy

**Pricing Philosophy**: All weapons now use DPS-inclusive pricing formula that factors in both attribute bonuses and combat effectiveness (damage per second). Higher DPS and faster-attacking weapons cost proportionally more. See [PRD_WEAPON_ECONOMY_OVERHAUL.md](PRD_WEAPON_ECONOMY_OVERHAUL.md) for complete pricing methodology.

---

## Database Reference

For the complete database schema including weapon tables, see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md):

- **Weapon Model**: Weapon catalog with all attributes and bonuses
- **WeaponInventory Model**: Individual weapon instances owned by users
- **Robot Model**: References to mainWeaponId and offhandWeaponId

Key relationships:
- User → WeaponInventory (one-to-many)
- WeaponInventory → Weapon (many-to-one, catalog reference)
- Robot → WeaponInventory (many-to-one for main weapon)
- Robot → WeaponInventory (many-to-one for offhand weapon)

---

## See Also

- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)** - Robot attributes, combat formulas, stance system
- **[PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)** - ⭐ **AUTHORITATIVE** - Prestige and Fame system specification
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)** - Stable management, facilities, prestige formulas
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Complete database structure
- **[ROADMAP.md](ROADMAP.md)** - Future enhancements and planned features

---

**This weapons & loadout system provides:**
- ✅ Clear weapon ownership model (stable-level, not robot-specific)
- ✅ Flexible inventory management (multiple copies, storage limits)
- ✅ Strategic loadout choices (4 distinct configurations with trade-offs)
- ✅ Diverse weapon catalog (11 weapons across 4 categories plus Practice weapon)
- ✅ Progression system (purchase discounts via Weapons Workshop)
- ✅ Economic balance (weapon costs scaled for game progression)
- ✅ Future extensibility (weapon crafting system ready for implementation)
