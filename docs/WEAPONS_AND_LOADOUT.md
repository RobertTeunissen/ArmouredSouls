# Weapons & Loadout System

**Last Updated**: January 29, 2026  
**Status**: Design Document

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

## Initial Weapon Catalog

### Energy Weapons

**Laser Rifle** (₡150,000) - One-handed
- Base Damage: 20
- Cooldown: 3 seconds
- Attribute Bonuses:
  - targetingSystemsBonus: +3
  - weaponControlBonus: +4
  - attackSpeedBonus: +2
- Special: +15% accuracy bonus
- **Loadout Compatibility**: Single, Weapon + Shield, Dual-Wield

**Plasma Cannon** (₡300,000) - Two-handed
- Base Damage: 40
- Cooldown: 5 seconds
- Attribute Bonuses:
  - combatPowerBonus: +5
  - criticalSystemsBonus: +4
  - powerCoreBonus: -3 (energy drain)
- Special: +20% vs energy shields
- **Loadout Compatibility**: Two-Handed only

**Ion Beam** (₡400,000) - Two-handed
- Base Damage: 30
- Cooldown: 4 seconds
- Attribute Bonuses:
  - penetrationBonus: +8
  - shieldCapacityBonus: +4
  - attackSpeedBonus: +3
- Special: Disables enemy energy shields for 2 seconds on crit
- **Loadout Compatibility**: Two-Handed only

### Ballistic Weapons

**Machine Gun** (₡100,000) - One-handed, Dual-wield compatible
- Base Damage: 12
- Cooldown: 2 seconds
- Attribute Bonuses:
  - combatPowerBonus: +2
  - attackSpeedBonus: +6
  - weaponControlBonus: +3
- Special: Can fire burst (3 shots at 40% damage each)
- **Loadout Compatibility**: Single, Weapon + Shield, Dual-Wield

**Railgun** (₡350,000) - Two-handed
- Base Damage: 50
- Cooldown: 6 seconds
- Attribute Bonuses:
  - penetrationBonus: +12
  - targetingSystemsBonus: +5
  - attackSpeedBonus: -3
- Special: Ignores 50% of armor
- **Loadout Compatibility**: Two-Handed only

**Shotgun** (₡120,000) - Two-handed
- Base Damage: 35
- Cooldown: 4 seconds
- Attribute Bonuses:
  - combatPowerBonus: +4
  - criticalSystemsBonus: +5
  - targetingSystemsBonus: -3
- Special: +30% damage at close range
- **Loadout Compatibility**: Two-Handed only

### Melee Weapons

**Power Sword** (₡180,000) - One-handed
- Base Damage: 28
- Cooldown: 3 seconds
- Attribute Bonuses:
  - hydraulicSystemsBonus: +6
  - counterProtocolsBonus: +5
  - gyroStabilizersBonus: +3
- Special: +25% counter damage
- **Loadout Compatibility**: Single, Weapon + Shield, Dual-Wield

**Hammer** (₡200,000) - Two-handed
- Base Damage: 42
- Cooldown: 5 seconds
- Attribute Bonuses:
  - hydraulicSystemsBonus: +8
  - combatPowerBonus: +6
  - servoMotorsBonus: -2
- Special: High impact force
- **Loadout Compatibility**: Two-Handed only

**Plasma Blade** (₡250,000) - One-handed, Dual-wield compatible
- Base Damage: 24
- Cooldown: 2.5 seconds
- Attribute Bonuses:
  - hydraulicSystemsBonus: +4
  - attackSpeedBonus: +5
  - criticalSystemsBonus: +3
- Special: Burns through energy shields (70% effective vs shields)
- **Loadout Compatibility**: Single, Weapon + Shield, Dual-Wield

### Shield Weapons

**Combat Shield** (₡100,000) - Shield type
- Base Damage: 0 (defensive only)
- Cooldown: N/A
- Attribute Bonuses:
  - armorPlatingBonus: +8
  - counterProtocolsBonus: +6
  - evasionThrustersBonus: -2
  - shieldCapacityBonus: +5 (boosts energy shield capacity)
- Special: 25% chance to block ranged attacks
- **Loadout Compatibility**: Weapon + Shield only

**Energy Barrier** (₡200,000) - Shield type
- Base Damage: 0 (defensive only)
- Cooldown: N/A
- Attribute Bonuses:
  - shieldCapacityBonus: +10 (boosts energy shield capacity)
  - powerCoreBonus: +4
  - servoMotorsBonus: -3
- Special: Reflects 20% of energy weapon damage
- **Loadout Compatibility**: Weapon + Shield only

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
- Plasma Cannon base cost: ₡300,000
- With Weapons Workshop Level 5 (25% discount): ₡225,000
- With Weapons Workshop Level 10 (50% discount): ₡150,000

### Economy Guidelines

**Starting Budget**: ₡2,000,000 (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md))
- Can afford: 1 robot (₡500K) + good weapon (₡300K) + upgrades (₡500K) + facility (₡200K) = ₡1.5M
- Leaves ₡500K buffer for additional purchases

**Weapon Investment Strategy:**
1. **Early Game**: Buy affordable weapons (₡100K-₡150K range)
   - Machine Gun (₡100K), Laser Rifle (₡150K)
   - Focus on robot attribute upgrades first
2. **Mid Game**: Invest in specialized weapons (₡200K-₡300K)
   - Power Sword (₡180K), Plasma Cannon (₡300K)
   - Upgrade Weapons Workshop for discounts
3. **Late Game**: Purchase premium weapons (₡350K-₡400K)
   - Railgun (₡350K), Ion Beam (₡400K)
   - Craft custom legendary weapons

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
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)** - Stable management, facilities, prestige system
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Complete database structure
- **[ROADMAP.md](ROADMAP.md)** - Future enhancements and planned features

---

**This weapons & loadout system provides:**
- ✅ Clear weapon ownership model (stable-level, not robot-specific)
- ✅ Flexible inventory management (multiple copies, storage limits)
- ✅ Strategic loadout choices (4 distinct configurations with trade-offs)
- ✅ Diverse weapon catalog (10 weapons across 4 categories)
- ✅ Progression system (purchase discounts via Weapons Workshop)
- ✅ Economic balance (weapon costs scaled for game progression)
- ✅ Future extensibility (weapon crafting system ready for implementation)
