# Seed Data Specification

**Project**: Armoured Souls  
**Document Type**: Technical Specification  
**Last Updated**: February 11, 2026  
**Status**: Current Implementation  
**Version**: v1.3

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
- **v1.3** (Feb 11, 2026): Added 10 player archetype test users, removed attribute-focused and loadout test users, renamed test user robots to "WimpBot", added dynamic user generation system for cycles

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

- **player1** / password123 - ₡3,000,000
- **player2** / password123 - ₡3,000,000
- **player3** / password123 - ₡3,000,000
- **player4** / password123 - ₡3,000,000
- **player5** / password123 - ₡3,000,000

### Test User Accounts (100)

**Username Format**: test_user_001 to test_user_100  
**Password**: testpass123  
**Currency**: ₡100,000 each  
**Purpose**: Matchmaking and league testing - "easily defeated mob" for tournaments

**Each test user has:**
- 1 robot with Practice Sword equipped
- Robot name: "WimpBot 1" through "WimpBot 100" (sequential numbering)
- All attributes at 1.00
- HP: 55 (50 + 1.00 × 5)
- Shield: 2 (1.00 × 2)
- ELO: 1200
- League: Bronze (bronze_1)
- Loadout: Single
- Stance: Balanced

**Purpose**: These weak robots serve as the baseline "mob" that stronger archetype robots can defeat, enabling tournament functionality and providing a consistent baseline for testing.

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
- ELO: 1200
- League: Bronze (bronze_bye - special league ID)
- Equipped with Practice Sword
- Yield Threshold: 0 (never yields)
- Used when league has odd number of robots for matchmaking

---

### Player Archetype Test Users (10)

**Purpose**: Test and validate the 10 player archetypes defined in the Player Archetypes Guide. Each user represents a specific playstyle with robots configured according to the archetype's budget allocation and strategy.

**Username Format**: archetype_<archetype_name>  
**Password**: testpass123  
**Creation Time**: All created at database seed time (cycle 0, before any battles)

**Dynamic User Generation**: When cycles are run, the system creates users following the archetype patterns. The number of users created per cycle equals the cycle number (Cycle 1 = 1 user, Cycle 2 = 2 users, Cycle 3 = 3 users, etc.). The system cycles through all archetype variations in order, ensuring all variations are represented as the population grows.

**Archetype Cycle Order** (14 variations total, cycles continuously):
1. Tank Fortress
2. Glass Cannon (Option A - Plasma Cannon)
3. Glass Cannon (Option B - Railgun)
4. Glass Cannon (Option C - Heavy Hammer)
5. Speed Demon (Option A - Dual Machine Guns)
6. Speed Demon (Option B - Dual Plasma Blades)
7. Speed Demon (Option C - Mixed Loadout)
8. Balanced Brawler
9. Facility Investor
10. Two-Robot Specialist
11. Melee Specialist
12. Ranged Sniper
13. AI Tactician
14. Prestige Rusher
... (continues cycling through all 14 variations)

**User Generation Pattern**:
- **Cycle 1**: Create 1 user → Tank Fortress
- **Cycle 2**: Create 2 users → Glass Cannon A, Glass Cannon B
- **Cycle 3**: Create 3 users → Glass Cannon C, Speed Demon A, Speed Demon B
- **Cycle 4**: Create 4 users → Speed Demon C, Balanced Brawler, Facility Investor, Two-Robot Specialist
- **Cycle 5**: Create 5 users → Melee Specialist, Ranged Sniper, AI Tactician, Prestige Rusher, Tank Fortress (cycle repeats)
- **Cycle 6**: Create 6 users → Glass Cannon A, Glass Cannon B, Glass Cannon C, Speed Demon A, Speed Demon B, Speed Demon C
- ... (continues with increasing numbers)

**Naming Convention for Dynamically Generated Users**:
- Format: `archetype_<archetype_name>_<cycle_number>`
- Example: `archetype_tank_fortress_1`, `archetype_glass_cannon_a_2`, `archetype_glass_cannon_b_2`
- Robot names: Follow the pattern with cycle number (e.g., "Fortress Prime C001", "C002 - Glass Cannon A", "C002 - Glass Cannon B")

---#### Archetype 1: Tank Fortress

**Username**: archetype_tank_fortress  
**Currency**: ₡756,000 (remaining after purchases)  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Defense Training Academy Level 1
- Combat Training Academy Level 1

**Robot**: "Fortress Prime"
- **Attributes**:
  - Hull Integrity: 15.00
  - Armor Plating: 14.00
  - Shield Capacity: 14.00
  - Counter Protocols: 12.00
  - Combat Power: 12.00
  - Damage Control: 10.00
  - Weapon Control: 10.00
  - All others: 1.00
- **HP**: 125 (50 + 15×5)
- **Shield**: 28 (14×2)
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Weapon+Shield
- **Stance**: Defensive
- **Weapons**: Power Sword (₡350,000) + Combat Shield (₡100,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡400,000 (Defense + Combat Training Academies)
- Attributes: ₡894,000
- Weapons: ₡450,000
- Reserve: ₡756,000

#### Archetype 2: Glass Cannon (3 Options)

**Option A: Glass Cannon with Plasma Cannon**

**Username**: archetype_glass_cannon_a  
**Currency**: ₡946,500  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Combat Training Academy Level 1

**Robot**: "C000 - Glass Cannon A"
- **Attributes**:
  - Combat Power: 15.00
  - Critical Systems: 15.00
  - Penetration: 14.00
  - Weapon Control: 13.00
  - Targeting Systems: 12.00
  - Hull Integrity: 10.00
  - All others: 1.00
- **HP**: 100 (50 + 10×5)
- **Shield**: 2 (1×2)
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Two-Handed
- **Stance**: Aggressive
- **Weapons**: Plasma Cannon (₡500,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡200,000
- Attributes: ₡853,500
- Weapons: ₡500,000
- Reserve: ₡946,500

**Option B: Glass Cannon with Railgun**

**Username**: archetype_glass_cannon_b  
**Currency**: ₡996,500  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Combat Training Academy Level 1

**Robot**: "C000 - Glass Cannon B"
- **Attributes**: Same as Option A
- **HP**: 100
- **Shield**: 2
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Two-Handed
- **Stance**: Aggressive
- **Weapons**: Railgun (₡450,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡200,000
- Attributes: ₡853,500
- Weapons: ₡450,000
- Reserve: ₡996,500

**Option C: Glass Cannon with Heavy Hammer**

**Username**: archetype_glass_cannon_c  
**Currency**: ₡1,046,500  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Combat Training Academy Level 1

**Robot**: "C000 - Glass Cannon C"
- **Attributes**: Same as Option A
- **HP**: 100
- **Shield**: 2
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Two-Handed
- **Stance**: Aggressive
- **Weapons**: Heavy Hammer (₡400,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡200,000
- Attributes: ₡853,500
- Weapons: ₡400,000
- Reserve: ₡1,046,500

#### Archetype 3: Speed Demon (3 Options)

**Option A: Speed Demon with Dual Machine Guns**

**Username**: archetype_speed_demon_a  
**Currency**: ₡66,500  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Mobility Training Academy Level 1
- Combat Training Academy Level 1

**Robot**: "Velocity Alpha"
- **Attributes**:
  - Attack Speed: 15.00
  - Servo Motors: 15.00
  - Weapon Control: 15.00
  - Combat Power: 15.00
  - Gyro Stabilizers: 14.00
  - Hull Integrity: 14.00
  - Reaction Time: 13.00
  - Armor Plating: 13.00
  - Evasion Systems: 12.00
  - Targeting Systems: 12.00
  - Penetration: 11.00
  - Shield Capacity: 10.00
  - All others: 1.00
- **HP**: 120 (50 + 14×5)
- **Shield**: 20 (10×2)
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Dual-Wield
- **Stance**: Aggressive
- **Weapons**: Machine Gun (₡150,000) + Machine Gun (₡150,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡400,000
- Attributes: ₡1,723,500
- Weapons: ₡300,000
- Reserve: ₡66,500

**Option B: Speed Demon with Dual Plasma Blades**

**Username**: archetype_speed_demon_b  
**Currency**: ₡0 (spent all budget)  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Mobility Training Academy Level 1
- Combat Training Academy Level 1

**Robot**: "Velocity Beta"
- **Attributes**: Same as Option A
- **HP**: 120
- **Shield**: 20
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Dual-Wield
- **Stance**: Aggressive
- **Weapons**: Plasma Blade (₡269,000) + Plasma Blade (₡269,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡400,000
- Attributes: ₡1,462,000 (reduced to afford weapons)
- Weapons: ₡538,000
- Reserve: ₡100,000

**Option C: Speed Demon with Mixed Loadout**

**Username**: archetype_speed_demon_c  
**Currency**: ₡31,000  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Mobility Training Academy Level 1
- Combat Training Academy Level 1

**Robot**: "Velocity Gamma"
- **Attributes**: Same as Option A
- **HP**: 120
- **Shield**: 20
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Dual-Wield
- **Stance**: Balanced
- **Weapons**: Machine Gun (₡150,000) + Plasma Blade (₡269,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡400,000
- Attributes: ₡1,650,000
- Weapons: ₡419,000
- Reserve: ₡31,000

#### Archetype 4: Balanced Brawler

**Username**: archetype_balanced_brawler  
**Currency**: ₡500,000  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**: None (no Training Academies)

**Robot**: "Equilibrium"
- **Attributes** (all capped at 10 without academies):
  - Combat Power: 10.00
  - Hull Integrity: 10.00
  - Attack Speed: 10.00
  - Armor Plating: 10.00
  - Weapon Control: 10.00
  - Servo Motors: 10.00
  - Damage Control: 10.00
  - All others: 1.00
- **HP**: 100 (50 + 10×5)
- **Shield**: 2 (1×2)
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Single
- **Stance**: Balanced
- **Weapons**: Power Sword (₡350,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡0
- Attributes: ₡577,500 (7 attributes at level 10)
- Weapons: ₡350,000
- Reserve: ₡1,572,500 (note: guide shows ₡500K, but calculation shows more)

**Note**: Budget allocation in guide may need revision. Using ₡500,000 reserve as specified.

#### Archetype 5: Facility Investor

**Username**: archetype_facility_investor  
**Currency**: ₡250,000  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Merchandising Hub Level 1: See [STABLE_SYSTEM.md](../STABLE_SYSTEM.md) - Generates passive income
- Repair Bay Level 1: See [STABLE_SYSTEM.md](../STABLE_SYSTEM.md)
- Training Facility Level 1: See [STABLE_SYSTEM.md](../STABLE_SYSTEM.md)

**Robot**: "Investor One"
- **Attributes** (minimal investment):
  - Combat Power: 6.00
  - Hull Integrity: 6.00
  - Attack Speed: 5.00
  - Armor Plating: 5.00
  - Weapon Control: 5.00
  - All others: 1.00
- **HP**: 80 (50 + 6×5)
- **Shield**: 2 (1×2)
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Single
- **Stance**: Defensive
- **Weapons**: Machine Gun (₡150,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡1,300,000
- Attributes: ₡600,000 (estimated)
- Weapons: ₡150,000
- Reserve: ₡250,000

#### Archetype 6: Two-Robot Specialist

**Username**: archetype_two_robot  
**Currency**: ₡200,000  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Roster Expansion Level 1 (₡300,000)

**Robot 1**: "Specialist Alpha"
- **Attributes**:
  - Combat Power: 10.00
  - Hull Integrity: 10.00
  - Attack Speed: 8.00
  - Armor Plating: 8.00
  - Weapon Control: 8.00
  - All others: 1.00
- **HP**: 100 (50 + 10×5)
- **Shield**: 2
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Single
- **Stance**: Aggressive
- **Weapons**: Plasma Rifle (₡275,000)

**Robot 2**: "Specialist Beta"
- **Attributes**: Same as Robot 1
- **HP**: 100
- **Shield**: 2
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Weapon+Shield
- **Stance**: Defensive
- **Weapons**: Power Sword (₡350,000) + Combat Shield (₡100,000)

**Tag Team**: "Specialist Team"
- **Members**: Robot 1 (Specialist Alpha - Active) + Robot 2 (Specialist Beta - Reserve)
- **League**: Bronze (bronze_1)
- **Status**: Active
- **Note**: Automatically created during seed for Two-Robot Specialist archetype

**Budget Breakdown**:
- Robots: ₡1,000,000 (2×₡500,000)
- Facilities: ₡300,000
- Attributes: ₡800,000 (split between 2 robots)
- Weapons: ₡725,000
- Reserve: ₡175,000

**Note**: Adjusted to ₡200,000 reserve as per guide. Tag team automatically created with both robots.

#### Archetype 7: Melee Specialist

**Username**: archetype_melee_specialist  
**Currency**: ₡350,000  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Combat Training Academy Level 1 (₡200,000)

**Robot**: "Brawler Prime"
- **Attributes**:
  - Combat Power: 15.00
  - Hydraulic Systems: 15.00
  - Hull Integrity: 14.00
  - Armor Plating: 13.00
  - Weapon Control: 12.00
  - Critical Systems: 12.00
  - Gyro Stabilizers: 11.00
  - Servo Motors: 10.00
  - All others: 1.00
- **HP**: 120 (50 + 14×5)
- **Shield**: 2
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Two-Handed
- **Stance**: Aggressive
- **Weapons**: Heavy Hammer (₡400,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡200,000
- Attributes: ₡1,000,000 (estimated)
- Weapons: ₡400,000
- Reserve: ₡900,000

**Note**: Adjusted to ₡350,000 reserve as per guide.

#### Archetype 8: Ranged Sniper

**Username**: archetype_ranged_sniper  
**Currency**: ₡350,000  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Combat Training Academy Level 1 (₡200,000)

**Robot**: "Longshot"
- **Attributes**:
  - Combat Power: 15.00
  - Targeting Systems: 15.00
  - Penetration: 14.00
  - Critical Systems: 13.00
  - Weapon Control: 12.00
  - Hull Integrity: 12.00
  - Armor Plating: 10.00
  - All others: 1.00
- **HP**: 110 (50 + 12×5)
- **Shield**: 2
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Two-Handed
- **Stance**: Defensive
- **Weapons**: Railgun (₡450,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡200,000
- Attributes: ₡1,000,000 (estimated)
- Weapons: ₡450,000
- Reserve: ₡850,000

**Note**: Adjusted to ₡350,000 reserve as per guide.

#### Archetype 9: AI Tactician

**Username**: archetype_ai_tactician  
**Currency**: ₡504,500  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- AI Training Academy Level 1 (₡250,000)

**Robot**: "Strategist"
- **Attributes**:
  - Combat Algorithms: 15.00
  - Threat Analysis: 15.00
  - Adaptive AI: 15.00
  - Logic Cores: 15.00
  - Combat Power: 12.00
  - Hull Integrity: 12.00
  - Attack Speed: 10.00
  - Armor Plating: 10.00
  - Weapon Control: 10.00
  - All others: 1.00
- **HP**: 110 (50 + 12×5)
- **Shield**: 2
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Single
- **Stance**: Balanced
- **Weapons**: Plasma Rifle (₡275,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡250,000
- Attributes: ₡1,495,500
- Weapons: ₡250,000
- Reserve: ₡504,500

#### Archetype 10: Prestige Rusher

**Username**: archetype_prestige_rusher  
**Currency**: ₡300,500  
**Prestige**: 0  
**Creation Cycle**: 0

**Facilities**:
- Combat Training Academy Level 1 (₡200,000)
- Defense Training Academy Level 1 (₡200,000)
- Mobility Training Academy Level 1 (₡200,000)

**Robot**: "Prestige Hunter"
- **Attributes**:
  - Combat Power: 15.00
  - Hull Integrity: 15.00
  - Attack Speed: 15.00
  - Armor Plating: 15.00
  - Weapon Control: 15.00
  - Critical Systems: 12.00
  - Penetration: 10.00
  - All others: 1.00
- **HP**: 125 (50 + 15×5)
- **Shield**: 2
- **ELO**: 1200
- **League**: Bronze (bronze_1)
- **Loadout**: Two-Handed
- **Stance**: Aggressive
- **Weapons**: Plasma Cannon (₡500,000)

**Budget Breakdown**:
- Robot: ₡500,000
- Facilities: ₡600,000
- Attributes: ₡1,099,500
- Weapons: ₡500,000
- Reserve: ₡300,500

---

## System Metadata

### Cycle Metadata

**Table**: CycleMetadata  
**ID**: 1 (singleton)  
**Initial Values**:
- totalCycles: 0
- lastCycleAt: null
- Purpose: Tracks global cycle state for admin operations

### Dynamic User Generation

**Purpose**: When cycles are run and the system needs to add new users, it should create users following the archetype patterns to maintain a diverse and balanced testing environment. The number of users created per cycle increases with each cycle.

**Generation Strategy**:
1. **Cycle N creates N users** (Cycle 1 = 1 user, Cycle 2 = 2 users, Cycle 3 = 3 users, etc.)
2. Track the current position in the archetype cycle (which variation to create next)
3. For each user to create, select the next archetype variation in the cycle order
4. Create a user with the archetype's specifications (attributes, weapons, facilities, remaining currency)
5. Increment the archetype position counter (wraps around after 17 variations)

**Archetype Cycle Order** (14 variations, repeats indefinitely):
1. Tank Fortress
2. Glass Cannon (Option A - Plasma Cannon)
3. Glass Cannon (Option B - Railgun)
4. Glass Cannon (Option C - Heavy Hammer)
5. Speed Demon (Option A - Dual Machine Guns)
6. Speed Demon (Option B - Dual Plasma Blades)
7. Speed Demon (Option C - Mixed Loadout)
8. Balanced Brawler
9. Facility Investor
10. Two-Robot Specialist
11. Melee Specialist
12. Ranged Sniper
13. AI Tactician
14. Prestige Rusher
... (continues cycling through all 14 variations)

**Naming Convention**:
- Username: `archetype_<archetype_name>_<cycle_number>`
- Robot name: Include cycle number (e.g., "Fortress Prime C001", "C002 - Glass Cannon A", "C002 - Glass Cannon B")
- Password: testpass123 (consistent with other test users)
- Currency: Set to the archetype's specified remaining amount
- Creation cycle: Set to the cycle number when created

**Example Sequence**:

**Cycle 1** (creates 1 user):
- Position 0: `archetype_tank_fortress_1` → "Fortress Prime C001"

**Cycle 2** (creates 2 users):
- Position 1: `archetype_glass_cannon_a_2` → "C002 - Glass Cannon A"
- Position 2: `archetype_glass_cannon_b_2` → "C002 - Glass Cannon B"

**Cycle 3** (creates 3 users):
- Position 3: `archetype_glass_cannon_c_3` → "C003 - Glass Cannon C"
- Position 4: `archetype_speed_demon_a_3` → "Velocity Alpha C003"
- Position 5: `archetype_speed_demon_b_3` → "Velocity Beta C003"

**Cycle 4** (creates 4 users):
- Position 6: `archetype_speed_demon_c_4` → "Velocity Gamma C004"
- Position 7: `archetype_balanced_brawler_4` → "Equilibrium C004"
- Position 8: `archetype_facility_investor_4` → "Investor One C004"
- Position 9: `archetype_two_robot_4` → "Specialist Alpha C004" + "Specialist Beta C004"

**Cycle 5** (creates 5 users):
- Position 10: `archetype_melee_specialist_5` → "Brawler Prime C005"
- Position 11: `archetype_ranged_sniper_5` → "Longshot C005"
- Position 12: `archetype_ai_tactician_5` → "Strategist C005"
- Position 13: `archetype_prestige_rusher_5` → "Prestige Hunter C005"
- Position 14 (wraps to 0): `archetype_tank_fortress_5` → "Fortress Prime C005"

**Cycle 6** (creates 6 users):
- Position 15 (wraps to 1): `archetype_glass_cannon_a_6` → "C006 - Glass Cannon A"
- Position 16 (wraps to 2): `archetype_glass_cannon_b_6` → "C006 - Glass Cannon B"
- Position 17 (wraps to 3): `archetype_glass_cannon_c_6` → "C006 - Glass Cannon C"
- Position 18 (wraps to 4): `archetype_speed_demon_a_6` → "Velocity Alpha C006"
- Position 19 (wraps to 5): `archetype_speed_demon_b_6` → "Velocity Beta C006"
- Position 20 (wraps to 6): `archetype_speed_demon_c_6` → "Velocity Gamma C006"

**Benefits**:
- **Exponential growth**: User population grows rapidly (1+2+3+4+5+6 = 21 users after 6 cycles)
- **Even distribution**: All 14 variations are represented proportionally
- **Testing diversity**: Early cycles test individual archetypes, later cycles test multiple simultaneously
- **Realistic scaling**: Simulates a growing player base with diverse strategies
- **Performance testing**: Tests system behavior with increasing user counts

**Total Users After N Cycles**: Sum of 1 to N = N × (N + 1) / 2
- After 5 cycles: 15 users
- After 10 cycles: 55 users
- After 14 cycles: 105 users (one complete cycle through all archetypes)
- After 20 cycles: 210 users
- After 50 cycles: 1,275 users

**Tag Team Creation for Two-Robot Specialist**:
- When creating a Two-Robot Specialist archetype user (either at seed time or during dynamic generation), automatically create a tag team with both robots
- Active robot: First robot (offensive build - Plasma Rifle)
- Reserve robot: Second robot (defensive build - Power Sword + Combat Shield)
- Tag team starts in same league as the robots (bronze_1)
- This ensures Two-Robot Specialist users can immediately participate in tag team matches

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

**Users**: 124 total (at initial seed)
- 1 admin
- 5 player accounts
- 100 test users (WimpBot mob)
- 1 bye-robot user
- 17 player archetype test users (10 archetypes with some having multiple options = 14 unique variations)

**Note**: Additional archetype users will be dynamically generated during cycles, cycling through the 14 archetype variations to ensure even distribution over time. Two-Robot Specialist users automatically get tag teams created.

**Robots**: 119 total (at initial seed)
- 100 WimpBot robots (1 per test user)
- 1 bye-robot
- 18 archetype robots (16 single-robot archetypes + 2 robots for Two-Robot Specialist)

**Tag Teams**: 1 total (at initial seed)
- 1 tag team for Two-Robot Specialist archetype user
- Additional tag teams created automatically during cycles for Two-Robot Specialist users

**Weapons**: 23 in catalog

**Weapon Inventory Entries**: Varies by user type

**Facilities**: Created on-demand for archetype users (various Training Academies, Merchandising Hub, Repair Bay, Roster Expansion, etc.)

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
- **[PLAYER_ARCHETYPES_GUIDE.md](../PLAYER_ARCHETYPES_GUIDE.md)** - Player archetype definitions and budget allocations
