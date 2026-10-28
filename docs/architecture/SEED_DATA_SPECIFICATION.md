# Seed Data Specification

**Project**: Armoured Souls  
**Document Type**: Technical Specification  
**Last Updated**: October 27, 2026 (WimpBot test users development-only)  
**Status**: Current Implementation  
**Version**: v1.7

---

## Document Purpose

This document specifies the complete seed data loaded into the database during initialization. Seed data provides:
- Initial weapon catalog (47 weapons)
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
- **v1.4** (Mar 21, 2026): Weapon damage reduction (~25%), shield capacity formula doubled (×2 → ×4), weapon pricing updated with M=3.0 baseline DPS=2.0
- **v1.5** (Mar 21, 2026): Weapon roster expansion from 26 to 47 weapons — added 21 new weapons filling all empty grid slots, reclassified Laser Rifle (now 2H Short Mid) and Assault Rifle (now 1H Short Premium), acknowledged Battle Axe tier correction to Luxury, added `rangeBand` field to all weapons, simplified range classification logic
- **v1.6** (Mar 26, 2026): Replaced archetype-based user generation with tiered stable system (WimpBot/AverageBot/ExpertBot), removed player1-5 accounts, updated admin to ₡3M/prestige 0, expanded WimpBot population to 200 users with new naming format
- **v1.7** (Oct 27, 2026): The 200 WimpBot test users (`test_user_001`–`200`) are seeded in development mode only; acceptance seeds just the admin. Removed the team-tournament seeding step: it needed teams owned by `test_user_` stables, which the seed never created, so it always skipped.

---

## Weapon Catalog (47 Weapons)

All weapons use the DPS-inclusive pricing formula. Prices are the Season 2 values from `calculateWeaponPrice` (`app/shared/utils/weaponPricing.ts`): `(50,000 + 50,000 × (DPS/2.0 − 1) × 6.0 + 500 × (Σ bonus)²) × hand` (one 1.0, two 1.5, shield 1.3, shields no DPS part), rounded to ₡1,000; starters a flat ₡50,000. See [PRD_WEAPON_ECONOMY.md](../game-systems/PRD_WEAPON_ECONOMY.md) v1.8.

### Starter/Practice Weapons (4)

**1. Practice Sword** (₡50,000)
- Type: Melee, One-handed
- Range: Melee
- Base Damage: 6, Cooldown: 3s, DPS: 2.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: None (baseline weapon)
- Description: Basic training weapon establishing baseline cost

**2. Practice Blaster** (₡50,000)
- Type: Ballistic, One-handed
- Range: Short
- Base Damage: 6, Cooldown: 3s, DPS: 2.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: None (baseline weapon)
- Description: Basic training sidearm establishing short-range baseline

**3. Training Rifle** (₡50,000)
- Type: Ballistic, Two-handed
- Range: Mid
- Base Damage: 6, Cooldown: 3s, DPS: 2.0
- Loadout: Two-Handed
- Bonuses: None (baseline weapon)
- Description: Standard-issue drill rifle establishing mid-range baseline

**4. Training Beam** (₡50,000)
- Type: Energy, Two-handed
- Range: Long
- Base Damage: 6, Cooldown: 3s, DPS: 2.0
- Loadout: Two-Handed
- Bonuses: None (baseline weapon)
- Description: Basic long-range energy trainer establishing long-range baseline

### Budget Tier (₡62K-₡150K) - 7 Weapons

**5. Machine Pistol** (₡100,000)
- Type: Ballistic, One-handed
- Base Damage: 5, Cooldown: 2s, DPS: 2.5
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +3, Weapon Control +2
- Description: Rapid-fire sidearm with quick attacks

**6. Laser Pistol** (₡63,000)
- Type: Energy, One-handed
- Base Damage: 6, Cooldown: 3s, DPS: 2.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +3, Combat Power +2
- Description: Precise energy sidearm with good accuracy

**7. Combat Knife** (₡96,000)
- Type: Melee, One-handed
- Base Damage: 5, Cooldown: 2s, DPS: 2.5
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +3, Gyro Stabilizers +1
- Description: Fast melee weapon for close combat

**8. Light Shield** (₡81,000)
- Type: Shield
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +3, Shield Capacity +2
- Description: Basic defensive shield for protection

**9. Combat Shield** (₡159,000)
- Type: Shield
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +6, Counter Protocols +3, Evasion Thrusters -2, Shield Capacity +5
- Description: Heavy-duty shield with counter capabilities

**10. Reactive Shield** (₡211,000)
- Type: Shield
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Shield Capacity +7, Counter Protocols +6, Power Core +4, Evasion Thrusters -2
- Description: Advanced shield with energy-reactive plating

**11. Machine Gun** (₡138,000)
- Type: Ballistic, One-handed
- Base Damage: 5, Cooldown: 2s, DPS: 2.5
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +3, Attack Speed +5, Weapon Control +2
- Description: Sustained fire support weapon

### Mid Tier (₡175K-₡250K) - 5 Weapons

**12. Burst Rifle** (₡150,000)
- Type: Ballistic, One-handed
- Base Damage: 8, Cooldown: 3s, DPS: 2.7
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +4, Targeting Systems +3, Critical Systems +3
- Description: 3-round burst fire weapon with controlled recoil

**13. Assault Rifle** (₡412,000) *(Reclassified: 1H Short Mid → 1H Short Premium)*
- Type: Ballistic, One-handed
- Range: Short
- Base Damage: 14, Cooldown: 3s, DPS: 4.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +6, Targeting Systems +5, Weapon Control +4, Attack Speed +3
- Description: Elite military-grade firearm with enhanced targeting

**14. Energy Blade** (₡222,000)
- Type: Melee, One-handed
- Base Damage: 10, Cooldown: 3s, DPS: 3.3
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +5, Combat Power +4, Weapon Control +3
- Description: Energy-infused blade for swift strikes

**15. Laser Rifle** (₡335,000) *(Reclassified: 1H Short Mid → 2H Short Mid)*
- Type: Energy, Two-handed
- Range: Short
- Base Damage: 9, Cooldown: 3s, DPS: 3.0
- Loadout: Two-Handed only
- Bonuses: Targeting Systems +5, Weapon Control +4, Attack Speed +3, Combat Power +2
- Description: Heavy precision energy rifle reconfigured for two-handed operation

**16. Plasma Blade** (₡273,000)
- Type: Melee, One-handed
- Base Damage: 11, Cooldown: 3s, DPS: 3.7
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +5, Attack Speed +4, Critical Systems +3, Gyro Stabilizers +2
- Description: Energy-enhanced melee blade with rapid strikes

### Premium Tier (₡275K-₡400K) - 5 Weapons

**17. Plasma Rifle** (₡286,000)
- Type: Energy, One-handed
- Base Damage: 13, Cooldown: 3s, DPS: 4.3
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +6, Targeting Systems +4, Weapon Control +3, Power Core -2
- Description: Advanced energy weapon with high damage output

**18. Power Sword** (₡456,000)
- Type: Melee, One-handed
- Base Damage: 15, Cooldown: 3s, DPS: 5.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Penetration +7, Critical Systems +5, Weapon Control +4, Combat Power +3
- Description: High-tech melee weapon with superior handling

**19. Shotgun** (₡263,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 14, Cooldown: 4s, DPS: 3.5
- Loadout: Two-Handed only
- Bonuses: Combat Power +4, Critical Systems +3, Targeting Systems -2
- Description: Close-range devastation with wide spread

**20. Grenade Launcher** (₡318,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 16, Cooldown: 5s, DPS: 3.2
- Loadout: Two-Handed only
- Bonuses: Combat Power +6, Penetration +5, Critical Systems +4, Targeting Systems -3
- Description: Explosive area damage with arc trajectory

**21. Sniper Rifle** (₡455,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 22, Cooldown: 6s, DPS: 3.7
- Loadout: Two-Handed only
- Bonuses: Targeting Systems +8, Penetration +6, Critical Systems +5, Attack Speed -3
- Description: Long-range precision weapon with high damage

### Elite Tier (₡375K+) - 5 Weapons

**22. Battle Axe** (₡419,000) - Two-handed
- Type: Melee, Two-handed
- Base Damage: 17, Cooldown: 4s, DPS: 4.3
- Loadout: Two-Handed only
- Bonuses: Penetration +6, Combat Power +4, Critical Systems +3, Attack Speed -2
- Description: Brutal melee weapon with devastating power

**23. Plasma Cannon** (₡447,000) - Two-handed
- Type: Energy, Two-handed
- Base Damage: 20, Cooldown: 5s, DPS: 4.0
- Loadout: Two-Handed only
- Bonuses: Combat Power +7, Critical Systems +6, Penetration +4, Power Core -3
- Description: Heavy plasma weapon with devastating firepower

**24. Heavy Hammer** (₡537,000) - Two-handed
- Type: Melee, Two-handed
- Base Damage: 22, Cooldown: 5s, DPS: 4.4
- Loadout: Two-Handed only
- Bonuses: Penetration +8, Combat Power +7, Critical Systems +4, Attack Speed -3
- Description: Massive impact weapon for maximum damage

**25. Railgun** (₡619,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 25, Cooldown: 6s, DPS: 4.2
- Loadout: Two-Handed only
- Bonuses: Penetration +12, Targeting Systems +7, Combat Power +5, Attack Speed -4
- Description: Ultra-high velocity kinetic weapon with extreme penetration

**26. Ion Beam** (₡903,000) - Two-handed (Highest DPS)
- Type: Energy, Two-handed
- Range: Long
- Base Damage: 18, Cooldown: 4s, DPS: 4.5
- Loadout: Two-Handed only
- Bonuses: Penetration +10, Combat Power +8, Attack Speed +5, Targeting Systems +4
- Description: Focused energy beam with shield disruption

### New Weapons — Roster Expansion v1.5 (21 Weapons)

**27. Vibro Mace** (₡688,000)
- Type: Melee, One-handed
- Range: Melee
- Base Damage: 18, Cooldown: 3s, DPS: 6.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Hydraulic Systems +8, Combat Power +6, Counter Protocols +5, Gyro Stabilizers +4, Attack Speed +3
- Description: Vibration-enhanced mace that shatters armor plating on impact

**28. War Club** (₡82,000) - Two-handed
- Type: Melee, Two-handed
- Range: Melee
- Base Damage: 6, Cooldown: 3s, DPS: 2.0
- Loadout: Two-Handed only
- Bonuses: Hydraulic Systems +2, Combat Power +1
- Description: Crude but effective bludgeon for budget-conscious brawlers

**29. Shock Maul** (₡211,000) - Two-handed
- Type: Energy, Two-handed
- Range: Melee
- Base Damage: 8, Cooldown: 3s, DPS: 2.67
- Loadout: Two-Handed only
- Bonuses: Hydraulic Systems +4, Combat Power +3, Power Core +2
- Description: Electrified maul that channels energy through hydraulic strikes

**30. Thermal Lance** (₡306,000) - Two-handed
- Type: Energy, Two-handed
- Range: Melee
- Base Damage: 13, Cooldown: 4s, DPS: 3.25
- Loadout: Two-Handed only
- Bonuses: Hydraulic Systems +5, Combat Power +4, Critical Systems +4, Power Core -2
- Description: Superheated polearm that melts through armor at close range

**31. Volt Sabre** (₡550,000)
- Type: Energy, One-handed
- Range: Short
- Base Damage: 18, Cooldown: 3s, DPS: 6.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +8, Targeting Systems +6, Weapon Control +5, Attack Speed +4, Power Core -3
- Description: Arc-charged blade pistol delivering devastating short-range energy bursts

**32. Scatter Cannon** (₡82,000) - Two-handed
- Type: Ballistic, Two-handed
- Range: Short
- Base Damage: 6, Cooldown: 3s, DPS: 2.0
- Loadout: Two-Handed only
- Bonuses: Combat Power +2, Weapon Control +1
- Description: Wide-bore scatter weapon effective at close quarters

**33. Pulse Accelerator** (₡291,000) - Two-handed
- Type: Energy, Two-handed
- Range: Short
- Base Damage: 13, Cooldown: 4s, DPS: 3.25
- Loadout: Two-Handed only
- Bonuses: Combat Power +5, Targeting Systems +4, Weapon Control +3, Attack Speed -2
- Description: Charged-particle accelerator delivering focused energy pulses at short range

**34. Arc Projector** (₡627,000) - Two-handed
- Type: Energy, Two-handed
- Range: Short
- Base Damage: 18, Cooldown: 4s, DPS: 4.5
- Loadout: Two-Handed only
- Bonuses: Combat Power +7, Targeting Systems +6, Critical Systems +5, Penetration +4, Attack Speed -3
- Description: Devastating arc-lightning projector that chains energy across short distances

**35. Bolt Carbine** (₡96,000)
- Type: Ballistic, One-handed
- Range: Mid
- Base Damage: 5, Cooldown: 2s, DPS: 2.5
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +3, Weapon Control +1
- Description: Compact carbine optimized for mid-range engagements

**36. Flux Repeater** (₡186,000)
- Type: Energy, One-handed
- Range: Mid
- Base Damage: 9, Cooldown: 3s, DPS: 3.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +5, Combat Power +3, Weapon Control +3
- Description: Rapid-cycling energy repeater with excellent mid-range accuracy

**37. Disruptor Cannon** (₡412,000)
- Type: Energy, One-handed
- Range: Mid
- Base Damage: 14, Cooldown: 3s, DPS: 4.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +6, Targeting Systems +5, Weapon Control +4, Penetration +3
- Description: Heavy energy disruptor that destabilizes enemy systems at mid-range

**38. Nova Caster** (₡550,000)
- Type: Energy, One-handed
- Range: Mid
- Base Damage: 18, Cooldown: 3s, DPS: 6.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +8, Targeting Systems +6, Penetration +5, Weapon Control +4, Power Core -3
- Description: Miniaturized nova reactor unleashing devastating mid-range energy blasts

**39. Mortar System** (₡150,000) - Two-handed
- Type: Ballistic, Two-handed
- Range: Mid
- Base Damage: 10, Cooldown: 4s, DPS: 2.5
- Loadout: Two-Handed only
- Bonuses: Combat Power +4, Penetration +3, Targeting Systems -2
- Description: Indirect-fire ballistic system for area suppression at mid-range

**40. Beam Pistol** (₡96,000)
- Type: Energy, One-handed
- Range: Long
- Base Damage: 5, Cooldown: 2s, DPS: 2.5
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +3, Penetration +1
- Description: Compact long-range energy sidearm with focused beam optics

**41. Photon Marksman** (₡186,000)
- Type: Energy, One-handed
- Range: Long
- Base Damage: 9, Cooldown: 3s, DPS: 3.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +5, Penetration +3, Combat Power +3
- Description: Precision photon emitter for accurate long-range fire from a one-handed platform

**42. Gauss Pistol** (₡335,000)
- Type: Ballistic, One-handed
- Range: Long
- Base Damage: 14, Cooldown: 3s, DPS: 4.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +6, Penetration +5, Combat Power +4, Attack Speed -2
- Description: Magnetically accelerated sidearm delivering extreme long-range kinetic rounds

**43. Particle Lance** (₡550,000)
- Type: Energy, One-handed
- Range: Long
- Base Damage: 18, Cooldown: 3s, DPS: 6.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +8, Penetration +6, Combat Power +5, Critical Systems +4, Attack Speed -3
- Description: Focused particle beam weapon capable of precision strikes at extreme range

**44. Siege Cannon** (₡150,000) - Two-handed
- Type: Ballistic, Two-handed
- Range: Long
- Base Damage: 10, Cooldown: 4s, DPS: 2.5
- Loadout: Two-Handed only
- Bonuses: Targeting Systems +4, Penetration +3, Combat Power -2
- Description: Heavy long-range bombardment cannon for sustained siege operations

**45. Barrier Shield** (₡253,000)
- Type: Shield
- Range: Melee
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +8, Shield Capacity +7, Counter Protocols +5, Evasion Thrusters -3
- Description: Reinforced energy barrier providing solid mid-tier protection

**46. Fortress Shield** (₡380,000)
- Type: Shield
- Range: Melee
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +11, Shield Capacity +10, Counter Protocols +8, Evasion Thrusters -4, Servo Motors -3 (Season 2, #521: was +15 / +14 / +10)
- Description: Heavy fortress-class shield with layered defensive systems

**47. Aegis Bulwark** (₡690,000)
- Type: Shield
- Range: Melee
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +11, Shield Capacity +11, Counter Protocols +10, Power Core +8, Evasion Thrusters -5, Servo Motors -4 (Season 2, #521: was +15 / +15 / +14 / +11)
- Description: Ultimate defensive platform with multi-layered reactive shielding

### Weapon Summary by Loadout Type

**Single Loadout** (22 weapons):
- Practice Sword, Practice Blaster, Machine Pistol, Laser Pistol, Combat Knife, Machine Gun
- Burst Rifle, Assault Rifle, Energy Blade, Plasma Blade
- Plasma Rifle, Power Sword, Vibro Mace, Volt Sabre
- Bolt Carbine, Flux Repeater, Beam Pistol, Photon Marksman, Gauss Pistol
- Disruptor Cannon, Nova Caster, Particle Lance
- (All one-handed weapons can be used in single loadout)

**Weapon + Shield** (22 one-handed + 6 shields):
- All one-handed weapons above
- Light Shield, Combat Shield, Reactive Shield, Barrier Shield, Fortress Shield, Aegis Bulwark

**Two-Handed** (19 weapons):
- Training Rifle, Training Beam, Laser Rifle
- War Club, Shock Maul, Thermal Lance
- Scatter Cannon, Pulse Accelerator, Arc Projector
- Mortar System, Siege Cannon
- Shotgun, Grenade Launcher, Sniper Rifle, Battle Axe
- Plasma Cannon, Heavy Hammer, Railgun, Ion Beam

**Dual-Wield** (22 weapons):
- All one-handed weapons (same as single loadout)

---

## User Accounts

### Admin Account (1)

**Username**: admin  
**Password**: See `prisma/seed.ts`  
**Role**: admin  
**Currency**: ₡3,000,000  
**Prestige**: 0  
**Stable Name**: Auto-generated unique name (e.g., "Swift Thunder")

### WimpBot Test User Accounts (200, development mode only)

**Seeded in**: development mode only (local databases and the CI E2E database). Acceptance mode no longer seeds them: the Automaton_Stables fill ACC's leagues. The copies already on ACC are Generated_Stables, so the next Season_Rollover deletes them, and no later deploy re-creates them.  
**Username Format**: test_user_001 to test_user_200  
**Password**: See `prisma/seed.ts`  
**Currency**: ₡100,000 each  
**Stable Name**: Auto-generated unique name per user  
**Purpose**: `test_user_001` is the E2E player login (Playwright `auth.setup.ts`); all 200 are the opponents in E2E and local bulk cycles, which run without user generation.

**Weapon Distribution** (50 users per weapon type):
- Users 001-050: Practice Sword (melee, one-handed) → loadout: single
- Users 051-100: Practice Blaster (ballistic, one-handed) → loadout: single
- Users 101-150: Training Rifle (ballistic, two-handed) → loadout: two_handed
- Users 151-200: Training Beam (energy, two-handed) → loadout: two_handed

**Robot Naming Format**: `WimpBot {LoadoutTitle} {WeaponCodename} {Number}`

**Loadout Titles**:
- single → "Lone"
- weapon_shield → "Guardian"
- dual_wield → "Twin"
- two_handed → "Heavy"

**Example Robot Names**:
- "WimpBot Lone Blade 1" (Practice Sword user)
- "WimpBot Lone Blaster 51" (Practice Blaster user)
- "WimpBot Heavy Rifle 101" (Training Rifle user)
- "WimpBot Heavy Beam 151" (Training Beam user)

**Robot Specifications**:
- All attributes at 1.00
- HP: 55 (50 + 1.00 × 5)
- Shield: 4 (1.00 × 4)
- ELO: 1200
- League: Bronze (distributed across bronze_1 through bronze_10)
- Stance: Balanced
- Yield Threshold: 10

**League Distribution**: Users are distributed evenly across 10 bronze league instances (bronze_1 through bronze_10), with 20 users per instance.

### Special User: Bye-Robot

**Username**: bye_robot_user  
**Password**: See `prisma/seed.ts`  
**Currency**: ₡0  
**Prestige**: 0  
**Purpose**: Matchmaking placeholder for odd-number leagues

**Bye-Robot:**
- Name: "Bye Robot"
- All attributes at 1.00
- HP: 55, Shield: 4
- ELO: 1000 (lower than standard to ensure losses)
- League: Bronze (bronze_bye - special league ID)
- Equipped with Practice Sword
- Yield Threshold: 0 (never yields)
- Used when league has odd number of robots for matchmaking

---

## Dynamic User Generation (Tiered Stable System)

When cycles are run, the system creates new users following a tiered stable system. The number of stables created per cycle equals the cycle number (Cycle 1 = 1 stable, Cycle 2 = 2 stables, etc.).

### Tier Distribution

Users are distributed across three tiers using the `distributeTiers(n)` function:
- **WimpBot**: Lowest tier, 3 robots per stable, budget weapons
- **AverageBot**: Middle tier, 2 robots per stable, mid-tier weapons
- **ExpertBot**: Highest tier, 1 robot per stable, premium weapons

Distribution formula: Integer division by 3 with remainder allocated WimpBot-first, then AverageBot, then ExpertBot.

**Examples**:
- Cycle 1 (1 stable): 1 WimpBot, 0 AverageBot, 0 ExpertBot
- Cycle 3 (3 stables): 1 WimpBot, 1 AverageBot, 1 ExpertBot
- Cycle 10 (10 stables): 4 WimpBot, 3 AverageBot, 3 ExpertBot

### Tier Specifications

#### WimpBot Tier
- **Robots per stable**: 3
- **Attribute level**: 1.00 (all attributes)
- **Weapon price tier**: Budget (₡50K-₡150K)
- **Tag team**: Yes (first 2 robots)
- **HP**: 55, Shield: 4

#### AverageBot Tier
- **Robots per stable**: 2
- **Attribute level**: 5.00 (all attributes)
- **Weapon price tier**: Mid (₡150K-₡300K)
- **Tag team**: Yes (both robots)
- **HP**: 75, Shield: 20

#### ExpertBot Tier
- **Robots per stable**: 1
- **Attribute level**: 10.00 (all attributes)
- **Weapon price tier**: Premium (₡300K+)
- **Tag team**: No (single robot)
- **HP**: 100, Shield: 40

### Robot Configuration

Each robot is configured with:
- **Loadout Type**: Random (25% each: single, weapon_shield, dual_wield, two_handed)
- **Range Band**: Random (25% each: melee, short, mid, long)
- **Stance**: Random (33% each: balanced, offensive, defensive)
- **Yield Threshold**: Random integer 0-20
- **League**: Bronze (assigned via `assignLeagueInstance('bronze')`)

### Robot Naming Convention

Format: `{Tier} {LoadoutTitle} {WeaponCodename} {Number}`

**Examples**:
- "WimpBot Lone Blade 1"
- "AverageBot Guardian Rifle 5"
- "ExpertBot Heavy Cannon 3"

### Username Format

Format: `auto_{tier}_{sequential_number}`

**Examples**:
- `auto_wimpbot_1`, `auto_wimpbot_2`, ...
- `auto_averagebot_1`, `auto_averagebot_2`, ...
- `auto_expertbot_1`, `auto_expertbot_2`, ...

### Weapon Selection

Weapons are selected using a 3-level fallback chain:
1. **Primary**: Match loadout + range + price tier
2. **Fallback 1**: Match loadout + price tier (any range)
3. **Fallback 2**: Any weapon in price tier

Shields are selected for weapon_shield loadouts from the appropriate price tier.

### Growth Projections

**Total Stables After N Cycles**: Sum of 1 to N = N × (N + 1) / 2
- After 5 cycles: 15 stables
- After 10 cycles: 55 stables
- After 20 cycles: 210 stables
- After 50 cycles: 1,275 stables

**Total Robots After N Cycles** (varies by tier distribution):
- WimpBot stables contribute 3 robots each
- AverageBot stables contribute 2 robots each
- ExpertBot stables contribute 1 robot each

**Tag Teams Created**: One per WimpBot stable (3 robots, first 2 form team) and one per AverageBot stable (2 robots form team). ExpertBot stables have no tag teams.

---

## Robot Attribute Defaults

All seed robots (WimpBot population) start with these default attribute values:

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

Dynamically generated robots use tier-specific attribute levels:
- WimpBot: All attributes at 1.0
- AverageBot: All attributes at 5.0
- ExpertBot: All attributes at 10.0

---

## HP and Shield Calculations

**HP Formula**: `maxHP = 50 + (hullIntegrity × 5)`

Examples:
- Hull Integrity 1.00: HP = 50 + 5 = 55
- Hull Integrity 5.00: HP = 50 + 25 = 75
- Hull Integrity 10.00: HP = 50 + 50 = 100

**Shield Formula**: `maxShield = shieldCapacity × 4`

Examples:
- Shield Capacity 1.00: Shield = 4
- Shield Capacity 5.00: Shield = 20
- Shield Capacity 10.00: Shield = 40

---

## Total Seed Data Summary

**Users** (at initial seed):
- Development mode: 202. That is 1 admin (₡3,000,000, prestige 0), 200 WimpBot test users (₡100,000 each) and 1 bye-robot user.
- Acceptance mode: 2. That is 1 admin and 1 bye-robot user. The league population comes from the Automaton_Catalogue (Catalogue_Sync after the seed) and from cycle user generation.

**Production mode**: Only bye-robot user is seeded (weapons and cycle metadata are always seeded).

**Robots** (at initial seed): development mode 201 (200 WimpBot robots, 1 per test user across 4 practice weapons, plus the bye-robot). Acceptance mode: the bye-robot only.

**Tag Teams**: 0 at initial seed (created dynamically during cycles for WimpBot and AverageBot stables)

**Weapons**: 47 in catalog

**Weapon Inventory Entries**: one per seeded WimpBot robot (development mode)

**Facilities**: None at initial seed (created on-demand by users)

---

## Seed Script Location

**File**: `app/backend/prisma/seed.ts`

**Run Command**:
```bash
cd app/backend
pnpm exec prisma db seed
```

**Prerequisites**:
- PostgreSQL database running
- DATABASE_URL environment variable set
- Prisma client generated

---

## Automaton Catalogue and Strategy Files (Spec #55)

Automaton stables and strategies are repository data, but **not** seed data: `prisma db seed` never creates Automaton_Profiles and never reads these files. They reach a database through Catalogue_Sync (catalogue) or are loaded at server start (strategies). Operator procedures: `docs/guides/AUTOMATON_OPERATIONS_GUIDE.md`.

### Automaton_Catalogue

**Location**: `app/backend/prisma/automaton-catalogue/{catalogueKey}.json`, one Catalogue_Entry per file. The folder holds the Starter_Stables of spec 55 (decision 32) plus the Expansion_Stables of spec 57 and of the October 2026 Automaton Package (`docs/implementation_notes/AUTOMATON_CATALOGUE_500.md`). The entry count is whatever the folder holds (`ls app/backend/prisma/automaton-catalogue/*.json | wc -l`); no document or test states it.

**Format** (`schemaVersion` 1, validated by `catalogueEntrySchema` in `services/automaton/automatonCatalogueService.ts`; strict, unknown keys rejected):

```json
{
  "schemaVersion": 1,
  "catalogueKey": "robocop-precinct",
  "stableName": "Old Detroit Precinct",
  "franchise": "RoboCop",
  "backstory": "…",
  "strategy": { "key": "paragon", "version": 1, "targetOverrides": {} },
  "teamNames": { "twoVsTwo": ["…"], "threeVsThree": [] },
  "eventOrder": ["league_1v1", "tournament_1v1", "koth", "grand_melee", "league_2v2", "tag_team", "tournament_2v2", "league_3v3", "tournament_3v3"],
  "blueprints": [
    {
      "slot": 1, "robotName": "RoboCop", "loadoutType": "single", "stance": "balanced",
      "yieldThreshold": 15, "buildFocus": "deadeye",
      "weaponPath": [{ "main": "…" }, { "main": "…" }],
      "refinementPlan": [{ "tier": "sharpen", "hand": "main", "magnitude": 1 }]
    }
  ]
}
```

Rules enforced by the schema (the admin create and update endpoints reuse them):
- `targetOverrides` (Goal position → Goal_Target) merge over the strategy defaults and must fit the strategy bounds. Robots Goal_Targets may not exceed the buildable blueprints (slots 1…k without a gap) → `AUTOMATON_BLUEPRINTS_TOO_FEW`.
- `teamNames` must have exactly the counts the Team_Rule needs; each name 3–32 characters, `safeName`, distinct within the entry.
- `eventOrder` lists all 9 subscribable event types once.
- Weapon names must exist in `WEAPON_DEFINITIONS` (CI) and the `weapons` table (sync); weapons must fit the loadout.
- Every blueprint has a `refinementPlan` with at least one step on each non-shield weapon of the final stage, at most 5 per weapon, checked cumulatively with the shared refinement validators.
- There is **no image field**.
- **Cross-stable uniqueness** (spec 57): Catalogue_Key, stable name (case-insensitive), robot name (exact) and team name (exact) are unique across all entries in the folder, enforced by `catalogueSchema.test.ts` (`crossEntryDuplicates`, which names both entries of a repeat).

### Repository_Images

**Location**: `app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp`, 512 × 512 px square WebP, found by convention and served as `/assets/automatons/{catalogueKey}/{slot}.webp`. `catalogueImages.test.ts` fails on a file that is not a 512 × 512 WebP named for an existing Catalogue_Key and Blueprint_Slot; missing images are allowed (the robot shows the generic frame).

### Catalogue_Sync (separate from `prisma db seed`)

```bash
cd app/backend
pnpm run automaton:sync            # writes
pnpm run automaton:sync --dry-run  # reports what it would add and fill
```

- Validates every file first; any invalid file → exit 1, nothing written.
- **Insert-only**: a new Catalogue_Key becomes a Draft_Automaton; an existing key is never updated from its file. A stable name already taken is a conflict: the entry is skipped and an alert raised.
- **Fill-only image exception**: for an existing profile, a blueprint with `imageUrl` null gets its Repository_Image when the file exists, and in the same transaction the live robot built from it gets it if it has none. A set image (admin upload or repository) is never replaced or deleted.
- Idempotent; the summary (`added`, `present`, `filled`, `conflicts`) is stored in `automaton_program_settings.last_sync_summary`.
- Runs on every ACC deploy after `prisma migrate deploy` and `prisma db seed` (it validates weapon names against the seeded `weapons` table). See `docs/guides/operations/DEPLOYMENT.md`.

### Strategy_Definition_Files

**Location**: `app/backend/src/config/automaton-strategies/{key}.v{version}.json`; six strategies (`swarm`, `paragon`, `duo`, `trio`, `tycoon`, `generalist`), each at versions 1 and 2. `pnpm run build` copies the directory into `dist/config/automaton-strategies/`.

Every Catalogue_Entry pins the latest version of its strategy; `pnpm run automaton:catalogue-upgrade` moves entries (and their position-keyed `targetOverrides`) to a new version.

Goal types: `robots`, `facility` (with `facilityType`), `attributes`, `weapons`, `refine`, `economy` (target = longest payback in cycles, 0–50, 0 = off; see `PRD_AUTOMATON_STABLES.md` "Economy Goal").

**Format** (`schemaVersion` 1, validated by `strategyDefinitionSchema` plus the builder rules):

```json
{
  "schemaVersion": 1,
  "key": "swarm",
  "version": 1,
  "displayName": "Swarm",
  "description": "Goes wide. …",
  "buildOrder": [
    { "position": 1, "goal": { "type": "robots" }, "defaultTarget": 3, "bounds": { "min": 1, "max": 3 } },
    { "position": 2, "goal": { "type": "facility", "facilityType": "booking_office" }, "defaultTarget": 1, "bounds": { "min": 0, "max": 6 } },
    { "position": 25, "goal": { "type": "attributes" }, "defaultTarget": "max", "bounds": { "min": "max", "max": "max" } }
  ]
}
```

- Loaded into the Strategy_Registry **at server start**, never seeded into the database. An invalid file, or a missing file that a profile is pinned to, stops the server with a clear error.
- Goal ids are derived (`{key}.v{version}.{position:02}.{type}[.{facilityType}]`), so they are stable within a version.
- New files arrive through `pnpm run automaton:unpack` and a pull request; a file still used by a profile must never be deleted.

---

## See Also

- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Complete database schema
- **[WEAPONS_AND_LOADOUT.md](../WEAPONS_AND_LOADOUT.md)** - Weapon system design
- **[PRD_WEAPON_ECONOMY_OVERHAUL.md](../PRD_WEAPON_ECONOMY_OVERHAUL.md)** - Weapon pricing methodology
- **[ROBOT_ATTRIBUTES.md](../ROBOT_ATTRIBUTES.md)** - Robot attribute system
- **[PLAYER_ARCHETYPES_GUIDE.md](../PLAYER_ARCHETYPES_GUIDE.md)** - Player archetype definitions (strategy guide, not seed data)
