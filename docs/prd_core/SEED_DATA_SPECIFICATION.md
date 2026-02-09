# Seed Data Specification

**Project**: Armoured Souls  
**Document Type**: Technical Specification  
**Last Updated**: February 9, 2026  
**Status**: Current Implementation  
**Version**: v1.2

---

## Document Purpose

This document specifies the complete seed data loaded into the database during initialization. Seed data provides:
- Initial weapon catalog (23 weapons)
- Test user accounts for development and testing
- Test robots for matchmaking and balance testing
- System metadata initialization

**Related Documentation:**
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Database schema structure
- **[WEAPONS_AND_LOADOUT.md](../WEAPONS_AND_LOADOUT.md)** - Weapon system design (v1.2)
- **[PRD_WEAPON_ECONOMY_OVERHAUL.md](../PRD_WEAPON_ECONOMY_OVERHAUL.md)** - Weapon pricing formula

---

## Version History

- **v1.0** (Jan 27, 2026): Initial seed with 11 weapons
- **v1.1** (Feb 5, 2026): Updated weapon damage values for combat rebalancing
- **v1.2** (Feb 5, 2026): Added 12 additional weapons, updated two-handed weapon pricing

---

## Weapon Catalog (23 Weapons)

All weapons use DPS-inclusive pricing formula. Prices reflect v1.2 rebalancing with reduced two-handed weapon costs.

### Starter/Practice Weapons (1)

**1. Practice Sword** (₡62,500)
- Type: Melee, One-handed
- Base Damage: 8, Cooldown: 3s, DPS: 2.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: None (baseline weapon)
- Description: Basic training weapon establishing baseline cost

### Budget Tier (₡62K-₡150K) - 7 Weapons

**2. Machine Pistol** (₡94,000)
- Type: Ballistic, One-handed
- Base Damage: 6, Cooldown: 2s, DPS: 3.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +3, Weapon Control +2
- Description: Rapid-fire sidearm with quick attacks

**3. Laser Pistol** (₡94,000)
- Type: Energy, One-handed
- Base Damage: 8, Cooldown: 3s, DPS: 2.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +3, Combat Power +2
- Description: Precise energy sidearm with good accuracy

**4. Combat Knife** (₡113,000)
- Type: Melee, One-handed
- Base Damage: 6, Cooldown: 2s, DPS: 3.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +3, Gyro Stabilizers +1
- Description: Fast melee weapon for close combat

**5. Light Shield** (₡62,500)
- Type: Shield
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +3, Shield Capacity +2
- Description: Basic defensive shield for protection

**6. Combat Shield** (₡100,000)
- Type: Shield
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +6, Counter Protocols +3, Evasion Thrusters -2, Shield Capacity +5
- Description: Heavy-duty shield with counter capabilities

**7. Reactive Shield** (₡113,000)
- Type: Shield
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Shield Capacity +7, Counter Protocols +6, Power Core +4, Servo Motors -2
- Description: Advanced shield with energy-reactive plating

**8. Machine Gun** (₡150,000)
- Type: Ballistic, One-handed
- Base Damage: 7, Cooldown: 2s, DPS: 3.5
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +3, Attack Speed +5, Weapon Control +2
- Description: Sustained fire support weapon

### Mid Tier (₡175K-₡250K) - 5 Weapons

**9. Burst Rifle** (₡181,000)
- Type: Ballistic, One-handed
- Base Damage: 11, Cooldown: 3s, DPS: 3.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +4, Targeting Systems +3, Critical Systems +3
- Description: 3-round burst fire weapon with controlled recoil

**10. Assault Rifle** (₡188,000)
- Type: Ballistic, One-handed
- Base Damage: 13, Cooldown: 3s, DPS: 4.33
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +4, Targeting Systems +4, Weapon Control +3, Attack Speed +2
- Description: Versatile military-grade firearm

**11. Energy Blade** (₡238,000)
- Type: Melee, One-handed
- Base Damage: 13, Cooldown: 3s, DPS: 4.33
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +5, Hydraulic Systems +4, Weapon Control +3
- Description: Energy-infused blade for swift strikes

**12. Laser Rifle** (₡244,000)
- Type: Energy, One-handed
- Base Damage: 15, Cooldown: 3s, DPS: 5.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +5, Weapon Control +4, Attack Speed +3, Combat Power +2
- Description: Precision energy rifle with excellent accuracy

**13. Plasma Blade** (₡269,000)
- Type: Melee, One-handed
- Base Damage: 14, Cooldown: 3s, DPS: 4.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Hydraulic Systems +5, Attack Speed +4, Critical Systems +3, Gyro Stabilizers +2
- Description: Energy-enhanced melee blade with rapid strikes

### Premium Tier (₡275K-₡400K) - 5 Weapons

**14. Plasma Rifle** (₡275,000)
- Type: Energy, One-handed
- Base Damage: 17, Cooldown: 3s, DPS: 5.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +6, Targeting Systems +4, Weapon Control +3, Power Core -2
- Description: Advanced energy weapon with high damage output

**15. Power Sword** (₡350,000)
- Type: Melee, One-handed
- Base Damage: 20, Cooldown: 3s, DPS: 6.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Hydraulic Systems +7, Counter Protocols +5, Gyro Stabilizers +4, Combat Power +3
- Description: High-tech melee weapon with superior handling

**16. Shotgun** (₡269,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 18, Cooldown: 4s, DPS: 4.5
- Loadout: Two-Handed only
- Bonuses: Combat Power +4, Critical Systems +3, Targeting Systems -2
- Description: Close-range devastation with wide spread

**17. Grenade Launcher** (₡294,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 21, Cooldown: 5s, DPS: 4.2
- Loadout: Two-Handed only
- Bonuses: Combat Power +6, Penetration +5, Critical Systems +4, Targeting Systems -3
- Description: Explosive area damage with arc trajectory

**18. Sniper Rifle** (₡369,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 29, Cooldown: 6s, DPS: 4.83
- Loadout: Two-Handed only
- Bonuses: Targeting Systems +8, Penetration +6, Critical Systems +5, Attack Speed -3
- Description: Long-range precision weapon with high damage

### Elite Tier (₡375K+) - 5 Weapons

**19. Battle Axe** (₡388,000) - Two-handed
- Type: Melee, Two-handed
- Base Damage: 23, Cooldown: 4s, DPS: 5.75
- Loadout: Two-Handed only
- Bonuses: Hydraulic Systems +6, Combat Power +4, Critical Systems +3, Servo Motors -2
- Description: Brutal melee weapon with devastating power

**20. Plasma Cannon** (₡400,000) - Two-handed
- Type: Energy, Two-handed
- Base Damage: 27, Cooldown: 5s, DPS: 5.4
- Loadout: Two-Handed only
- Bonuses: Combat Power +7, Critical Systems +6, Penetration +4, Power Core -3
- Description: Heavy plasma weapon with devastating firepower

**21. Heavy Hammer** (₡450,000) - Two-handed
- Type: Melee, Two-handed
- Base Damage: 29, Cooldown: 5s, DPS: 5.8
- Loadout: Two-Handed only
- Bonuses: Hydraulic Systems +8, Combat Power +7, Critical Systems +4, Servo Motors -3
- Description: Massive impact weapon for maximum damage

**22. Railgun** (₡488,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 33, Cooldown: 6s, DPS: 5.5
- Loadout: Two-Handed only
- Bonuses: Penetration +12, Targeting Systems +7, Combat Power +5, Attack Speed -4
- Description: Ultra-high velocity kinetic weapon with extreme penetration

**23. Ion Beam** (₡538,000) - Two-handed (Highest DPS)
- Type: Energy, Two-handed
- Base Damage: 24, Cooldown: 4s, DPS: 6.0
- Loadout: Two-Handed only
- Bonuses: Penetration +10, Shield Capacity +8, Attack Speed +5, Targeting Systems +4
- Description: Focused energy beam with shield disruption

### Weapon Summary by Loadout Type

**Single Loadout** (15 weapons):
- Practice Sword, Machine Pistol, Laser Pistol, Combat Knife, Machine Gun
- Burst Rifle, Assault Rifle, Energy Blade, Laser Rifle, Plasma Blade
- Plasma Rifle, Power Sword
- (All one-handed weapons can be used in single loadout)

**Weapon + Shield** (15 one-handed + 3 shields):
- All one-handed weapons above
- Light Shield, Combat Shield, Reactive Shield

**Two-Handed** (8 weapons):
- Shotgun, Grenade Launcher, Sniper Rifle, Battle Axe
- Plasma Cannon, Heavy Hammer, Railgun, Ion Beam

**Dual-Wield** (15 weapons):
- All one-handed weapons (same as single loadout)

---

## User Accounts

### Admin Account (1)

**Username**: admin  
**Password**: admin123  
**Role**: admin  
**Currency**: ₡10,000,000  
**Prestige**: 50,000

### Player Accounts (5)

Manual testing accounts with full starting resources:

- **player1** / password123 - ₡2,000,000
- **player2** / password123 - ₡2,000,000
- **player3** / password123 - ₡2,000,000
- **player4** / password123 - ₡2,000,000
- **player5** / password123 - ₡2,000,000

### Test User Accounts (100)

**Username Format**: test_user_001 to test_user_100  
**Password**: testpass123  
**Currency**: ₡100,000 each  
**Purpose**: Matchmaking and league testing

**Each test user has:**
- 1 robot with Practice Sword equipped
- Robot name: Generated from prefix + suffix combinations (e.g., "Iron Gladiator", "Steel Warrior")
- All attributes at 1.00
- HP: 55 (50 + 1.00 × 5)
- Shield: 2 (1.00 × 2)
- ELO: 1200
- League: Bronze (bronze_1)
- Loadout: Single
- Stance: Balanced

### Attribute-Focused Test Users (23)

**Username Format**: test_attr_<attribute_name>  
**Password**: testpass123  
**Currency**: ₡500,000 each  
**Purpose**: Attribute balance testing

**One user per attribute:**
- test_attr_combat_power
- test_attr_targeting_systems
- test_attr_critical_systems
- test_attr_penetration
- test_attr_weapon_control
- test_attr_attack_speed
- test_attr_armor_plating
- test_attr_shield_capacity
- test_attr_evasion_thrusters
- test_attr_damage_dampeners
- test_attr_counter_protocols
- test_attr_hull_integrity
- test_attr_servo_motors
- test_attr_gyro_stabilizers
- test_attr_hydraulic_systems
- test_attr_power_core
- test_attr_combat_algorithms
- test_attr_threat_analysis
- test_attr_adaptive_ai
- test_attr_logic_cores
- test_attr_sync_protocols
- test_attr_support_systems
- test_attr_formation_tactics

**Each user has:**
- Roster Expansion facility at level 9 (enables 10 robots)
- 10 robots with focused attribute at 10.0, all others at 1.0
- Robot names: "<Attribute> Bot 1" through "<Attribute> Bot 10"
- All robots equipped with Practice Sword
- Loadout: Single
- Stance: Balanced
- HP varies based on Hull Integrity value
- Shield varies based on Shield Capacity value

### Loadout Test Users (14)

**Username Format**: loadout_<weapon>_<type>  
**Password**: testpass123  
**Currency**: ₡1,000,000 each  
**Purpose**: Weapon economy and loadout balance testing

**Single Loadout (4 users):**
- loadout_machine_pistol_single
- loadout_laser_pistol_single
- loadout_combat_knife_single
- loadout_machine_gun_single

**Weapon + Shield (4 users):**
- loadout_machine_pistol_shield
- loadout_laser_pistol_shield
- loadout_combat_knife_shield
- loadout_machine_gun_shield

**Dual-Wield (4 users):**
- loadout_machine_pistol_dual
- loadout_laser_pistol_dual
- loadout_combat_knife_dual
- loadout_machine_gun_dual

**Two-Handed (2 users):**
- loadout_shotgun_two_handed
- loadout_assault_rifle_two_handed

**Each user has:**
- Roster Expansion facility at level 9 (enables 10 robots)
- 10 robots with ALL 23 attributes at 5.00
- HP: 75 (50 + 5.00 × 5)
- Shield: 10 (5.00 × 2)
- ELO: 1200
- League: Bronze (bronze_1)
- Stance: Balanced
- Appropriate weapons equipped for loadout type

### Special User: Bye-Robot

**Username**: bye_robot_user  
**Password**: testpass123  
**Currency**: ₡0  
**Prestige**: 0  
**Purpose**: Matchmaking placeholder for odd-number leagues

**Bye-Robot:**
- Name: "Bye Robot"
- All attributes at 1.00
- HP: 55, Shield: 2
- ELO: 1000 (fixed)
- League: Bronze (bronze_bye - special league ID)
- Equipped with Practice Sword
- Yield Threshold: 0 (never yields)
- Used when league has odd number of robots for matchmaking

---

## System Metadata

### Cycle Metadata

**Table**: CycleMetadata  
**ID**: 1 (singleton)  
**Initial Values**:
- totalCycles: 0
- lastCycleAt: null
- Purpose: Tracks global cycle state for admin operations

---

## Robot Attribute Defaults

All test robots start with these default attribute values:

```typescript
{
  combatPower: 1.0,
  targetingSystems: 1.0,
  criticalSystems: 1.0,
  penetration: 1.0,
  weaponControl: 1.0,
  attackSpeed: 1.0,
  armorPlating: 1.0,
  shieldCapacity: 1.0,
  evasionThrusters: 1.0,
  damageDampeners: 1.0,
  counterProtocols: 1.0,
  hullIntegrity: 1.0,
  servoMotors: 1.0,
  gyroStabilizers: 1.0,
  hydraulicSystems: 1.0,
  powerCore: 1.0,
  combatAlgorithms: 1.0,
  threatAnalysis: 1.0,
  adaptiveAI: 1.0,
  logicCores: 1.0,
  syncProtocols: 1.0,
  supportSystems: 1.0,
  formationTactics: 1.0,
}
```

---

## HP and Shield Calculations

**HP Formula**: `maxHP = 50 + (hullIntegrity × 5)`

Examples:
- Hull Integrity 1.00: HP = 50 + 5 = 55
- Hull Integrity 5.00: HP = 50 + 25 = 75
- Hull Integrity 10.00: HP = 50 + 50 = 100

**Shield Formula**: `maxShield = shieldCapacity × 2`

Examples:
- Shield Capacity 1.00: Shield = 2
- Shield Capacity 5.00: Shield = 10
- Shield Capacity 10.00: Shield = 20

---

## Total Seed Data Summary

**Users**: 144 total
- 1 admin
- 5 player accounts
- 100 test users
- 23 attribute-focused users
- 14 loadout test users
- 1 bye-robot user

**Robots**: 471 total
- 100 basic test robots (1 per test user)
- 230 attribute-focused robots (10 per attribute user)
- 140 loadout test robots (10 per loadout user)
- 1 bye-robot

**Weapons**: 23 in catalog

**Weapon Inventory Entries**: 471 (one Practice Sword per robot initially)

**Facilities**: Created on-demand (Roster Expansion for attribute and loadout users)

---

## Seed Script Location

**File**: `prototype/backend/prisma/seed.ts`

**Run Command**:
```bash
cd prototype/backend
npx prisma db seed
```

**Prerequisites**:
- PostgreSQL database running
- DATABASE_URL environment variable set
- Prisma client generated

---

## See Also

- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Complete database schema
- **[WEAPONS_AND_LOADOUT.md](../WEAPONS_AND_LOADOUT.md)** - Weapon system design
- **[PRD_WEAPON_ECONOMY_OVERHAUL.md](../PRD_WEAPON_ECONOMY_OVERHAUL.md)** - Weapon pricing methodology
- **[ROBOT_ATTRIBUTES.md](../ROBOT_ATTRIBUTES.md)** - Robot attribute system
