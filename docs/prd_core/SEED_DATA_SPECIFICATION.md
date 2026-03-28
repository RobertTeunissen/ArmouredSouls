# Seed Data Specification

**Project**: Armoured Souls  
**Document Type**: Technical Specification  
**Last Updated**: March 21, 2026  
**Status**: Current Implementation  
**Version**: v1.5

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

---

## Weapon Catalog (47 Weapons)

All weapons use DPS-inclusive pricing formula. Prices reflect v1.4 rebalancing: ~25% weapon damage reduction (baseline DPS 2.67 → 2.0), pricing formula M=3.0 with baseline DPS=2.0.

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

**5. Machine Pistol** (₡94,000)
- Type: Ballistic, One-handed
- Base Damage: 5, Cooldown: 2s, DPS: 2.5
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +3, Weapon Control +2
- Description: Rapid-fire sidearm with quick attacks

**6. Laser Pistol** (₡57,000)
- Type: Energy, One-handed
- Base Damage: 6, Cooldown: 3s, DPS: 2.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +3, Combat Power +2
- Description: Precise energy sidearm with good accuracy

**7. Combat Knife** (₡93,000)
- Type: Melee, One-handed
- Base Damage: 5, Cooldown: 2s, DPS: 2.5
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +3, Gyro Stabilizers +1
- Description: Fast melee weapon for close combat

**8. Light Shield** (₡51,000)
- Type: Shield
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +3, Shield Capacity +2
- Description: Basic defensive shield for protection

**9. Combat Shield** (₡78,000)
- Type: Shield
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +6, Counter Protocols +3, Evasion Thrusters -2, Shield Capacity +5
- Description: Heavy-duty shield with counter capabilities

**10. Reactive Shield** (₡92,000)
- Type: Shield
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Shield Capacity +7, Counter Protocols +6, Power Core +4, Evasion Thrusters -2
- Description: Advanced shield with energy-reactive plating

**11. Machine Gun** (₡107,000)
- Type: Ballistic, One-handed
- Base Damage: 5, Cooldown: 2s, DPS: 2.5
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +3, Attack Speed +5, Weapon Control +2
- Description: Sustained fire support weapon

### Mid Tier (₡175K-₡250K) - 5 Weapons

**12. Burst Rifle** (₡117,000)
- Type: Ballistic, One-handed
- Base Damage: 8, Cooldown: 3s, DPS: 2.7
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +4, Targeting Systems +3, Critical Systems +3
- Description: 3-round burst fire weapon with controlled recoil

**13. Assault Rifle** (₡293,000) *(Reclassified: 1H Short Mid → 1H Short Premium)*
- Type: Ballistic, One-handed
- Range: Short
- Base Damage: 14, Cooldown: 3s, DPS: 4.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +6, Targeting Systems +5, Weapon Control +4, Attack Speed +3
- Description: Elite military-grade firearm with enhanced targeting

**14. Energy Blade** (₡175,000)
- Type: Melee, One-handed
- Base Damage: 10, Cooldown: 3s, DPS: 3.3
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Attack Speed +5, Combat Power +4, Weapon Control +3
- Description: Energy-infused blade for swift strikes

**15. Laser Rifle** (₡243,000) *(Reclassified: 1H Short Mid → 2H Short Mid)*
- Type: Energy, Two-handed
- Range: Short
- Base Damage: 9, Cooldown: 3s, DPS: 3.0
- Loadout: Two-Handed only
- Bonuses: Targeting Systems +5, Weapon Control +4, Attack Speed +3, Combat Power +2
- Description: Heavy precision energy rifle reconfigured for two-handed operation

**16. Plasma Blade** (₡202,000)
- Type: Melee, One-handed
- Base Damage: 11, Cooldown: 3s, DPS: 3.7
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +5, Attack Speed +4, Critical Systems +3, Gyro Stabilizers +2
- Description: Energy-enhanced melee blade with rapid strikes

### Premium Tier (₡275K-₡400K) - 5 Weapons

**17. Plasma Rifle** (₡258,000)
- Type: Energy, One-handed
- Base Damage: 13, Cooldown: 3s, DPS: 4.3
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +6, Targeting Systems +4, Weapon Control +3, Power Core -2
- Description: Advanced energy weapon with high damage output

**18. Power Sword** (₡325,000)
- Type: Melee, One-handed
- Base Damage: 15, Cooldown: 3s, DPS: 5.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Penetration +7, Critical Systems +5, Weapon Control +4, Combat Power +3
- Description: High-tech melee weapon with superior handling

**19. Shotgun** (₡283,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 14, Cooldown: 4s, DPS: 3.5
- Loadout: Two-Handed only
- Bonuses: Combat Power +4, Critical Systems +3, Targeting Systems -2
- Description: Close-range devastation with wide spread

**20. Grenade Launcher** (₡293,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 16, Cooldown: 5s, DPS: 3.2
- Loadout: Two-Handed only
- Bonuses: Combat Power +6, Penetration +5, Critical Systems +4, Targeting Systems -3
- Description: Explosive area damage with arc trajectory

**21. Sniper Rifle** (₡387,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 22, Cooldown: 6s, DPS: 3.7
- Loadout: Two-Handed only
- Bonuses: Targeting Systems +8, Penetration +6, Critical Systems +5, Attack Speed -3
- Description: Long-range precision weapon with high damage

### Elite Tier (₡375K+) - 5 Weapons

**22. Battle Axe** (₡402,000) - Two-handed
- Type: Melee, Two-handed
- Base Damage: 17, Cooldown: 4s, DPS: 4.3
- Loadout: Two-Handed only
- Bonuses: Penetration +6, Combat Power +4, Critical Systems +3, Attack Speed -2
- Description: Brutal melee weapon with devastating power

**23. Plasma Cannon** (₡408,000) - Two-handed
- Type: Energy, Two-handed
- Base Damage: 20, Cooldown: 5s, DPS: 4.0
- Loadout: Two-Handed only
- Bonuses: Combat Power +7, Critical Systems +6, Penetration +4, Power Core -3
- Description: Heavy plasma weapon with devastating firepower

**24. Heavy Hammer** (₡478,000) - Two-handed
- Type: Melee, Two-handed
- Base Damage: 22, Cooldown: 5s, DPS: 4.4
- Loadout: Two-Handed only
- Bonuses: Penetration +8, Combat Power +7, Critical Systems +4, Attack Speed -3
- Description: Massive impact weapon for maximum damage

**25. Railgun** (₡527,000) - Two-handed
- Type: Ballistic, Two-handed
- Base Damage: 25, Cooldown: 6s, DPS: 4.2
- Loadout: Two-Handed only
- Bonuses: Penetration +12, Targeting Systems +7, Combat Power +5, Attack Speed -4
- Description: Ultra-high velocity kinetic weapon with extreme penetration

**26. Ion Beam** (₡544,000) - Two-handed (Highest DPS)
- Type: Energy, Two-handed
- Range: Long
- Base Damage: 18, Cooldown: 4s, DPS: 4.5
- Loadout: Two-Handed only
- Bonuses: Penetration +10, Combat Power +8, Attack Speed +5, Targeting Systems +4
- Description: Focused energy beam with shield disruption

### New Weapons — Roster Expansion v1.5 (21 Weapons)

**27. Vibro Mace** (₡425,000)
- Type: Melee, One-handed
- Range: Melee
- Base Damage: 18, Cooldown: 3s, DPS: 6.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Hydraulic Systems +8, Combat Power +6, Counter Protocols +5, Gyro Stabilizers +4, Attack Speed +3
- Description: Vibration-enhanced mace that shatters armor plating on impact

**28. War Club** (₡84,000) - Two-handed
- Type: Melee, Two-handed
- Range: Melee
- Base Damage: 6, Cooldown: 3s, DPS: 2.0
- Loadout: Two-Handed only
- Bonuses: Hydraulic Systems +2, Combat Power +1
- Description: Crude but effective bludgeon for budget-conscious brawlers

**29. Shock Maul** (₡183,000) - Two-handed
- Type: Energy, Two-handed
- Range: Melee
- Base Damage: 8, Cooldown: 3s, DPS: 2.67
- Loadout: Two-Handed only
- Bonuses: Hydraulic Systems +4, Combat Power +3, Power Core +2
- Description: Electrified maul that channels energy through hydraulic strikes

**30. Thermal Lance** (₡279,000) - Two-handed
- Type: Energy, Two-handed
- Range: Melee
- Base Damage: 13, Cooldown: 4s, DPS: 3.25
- Loadout: Two-Handed only
- Bonuses: Hydraulic Systems +5, Combat Power +4, Critical Systems +4, Power Core -2
- Description: Superheated polearm that melts through armor at close range

**31. Volt Sabre** (₡425,000)
- Type: Energy, One-handed
- Range: Short
- Base Damage: 18, Cooldown: 3s, DPS: 6.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +8, Targeting Systems +6, Weapon Control +5, Attack Speed +4, Power Core -3
- Description: Arc-charged blade pistol delivering devastating short-range energy bursts

**32. Scatter Cannon** (₡84,000) - Two-handed
- Type: Ballistic, Two-handed
- Range: Short
- Base Damage: 6, Cooldown: 3s, DPS: 2.0
- Loadout: Two-Handed only
- Bonuses: Combat Power +2, Weapon Control +1
- Description: Wide-bore scatter weapon effective at close quarters

**33. Pulse Accelerator** (₡273,000) - Two-handed
- Type: Energy, Two-handed
- Range: Short
- Base Damage: 13, Cooldown: 4s, DPS: 3.25
- Loadout: Two-Handed only
- Bonuses: Combat Power +5, Targeting Systems +4, Weapon Control +3, Attack Speed -2
- Description: Charged-particle accelerator delivering focused energy pulses at short range

**34. Arc Projector** (₡488,000) - Two-handed
- Type: Energy, Two-handed
- Range: Short
- Base Damage: 18, Cooldown: 4s, DPS: 4.5
- Loadout: Two-Handed only
- Bonuses: Combat Power +7, Targeting Systems +6, Critical Systems +5, Penetration +4, Attack Speed -3
- Description: Devastating arc-lightning projector that chains energy across short distances

**35. Bolt Carbine** (₡93,000)
- Type: Ballistic, One-handed
- Range: Mid
- Base Damage: 5, Cooldown: 2s, DPS: 2.5
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +3, Weapon Control +1
- Description: Compact carbine optimized for mid-range engagements

**36. Flux Repeater** (₡147,000)
- Type: Energy, One-handed
- Range: Mid
- Base Damage: 9, Cooldown: 3s, DPS: 3.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +5, Combat Power +3, Weapon Control +3
- Description: Rapid-cycling energy repeater with excellent mid-range accuracy

**37. Disruptor Cannon** (₡293,000)
- Type: Energy, One-handed
- Range: Mid
- Base Damage: 14, Cooldown: 3s, DPS: 4.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +6, Targeting Systems +5, Weapon Control +4, Penetration +3
- Description: Heavy energy disruptor that destabilizes enemy systems at mid-range

**38. Nova Caster** (₡425,000)
- Type: Energy, One-handed
- Range: Mid
- Base Damage: 18, Cooldown: 3s, DPS: 6.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Combat Power +8, Targeting Systems +6, Penetration +5, Weapon Control +4, Power Core -3
- Description: Miniaturized nova reactor unleashing devastating mid-range energy blasts

**39. Mortar System** (₡163,000) - Two-handed
- Type: Ballistic, Two-handed
- Range: Mid
- Base Damage: 10, Cooldown: 4s, DPS: 2.5
- Loadout: Two-Handed only
- Bonuses: Combat Power +4, Penetration +3, Targeting Systems -2
- Description: Indirect-fire ballistic system for area suppression at mid-range

**40. Beam Pistol** (₡93,000)
- Type: Energy, One-handed
- Range: Long
- Base Damage: 5, Cooldown: 2s, DPS: 2.5
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +3, Penetration +1
- Description: Compact long-range energy sidearm with focused beam optics

**41. Photon Marksman** (₡147,000)
- Type: Energy, One-handed
- Range: Long
- Base Damage: 9, Cooldown: 3s, DPS: 3.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +5, Penetration +3, Combat Power +3
- Description: Precision photon emitter for accurate long-range fire from a one-handed platform

**42. Gauss Pistol** (₡291,000)
- Type: Ballistic, One-handed
- Range: Long
- Base Damage: 14, Cooldown: 3s, DPS: 4.67
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +6, Penetration +5, Combat Power +4, Attack Speed -2
- Description: Magnetically accelerated sidearm delivering extreme long-range kinetic rounds

**43. Particle Lance** (₡425,000)
- Type: Energy, One-handed
- Range: Long
- Base Damage: 18, Cooldown: 3s, DPS: 6.0
- Loadout: Single, Weapon+Shield, Dual-Wield
- Bonuses: Targeting Systems +8, Penetration +6, Combat Power +5, Critical Systems +4, Attack Speed -3
- Description: Focused particle beam weapon capable of precision strikes at extreme range

**44. Siege Cannon** (₡163,000) - Two-handed
- Type: Ballistic, Two-handed
- Range: Long
- Base Damage: 10, Cooldown: 4s, DPS: 2.5
- Loadout: Two-Handed only
- Bonuses: Targeting Systems +4, Penetration +3, Combat Power -2
- Description: Heavy long-range bombardment cannon for sustained siege operations

**45. Barrier Shield** (₡111,000)
- Type: Shield
- Range: Melee
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +8, Shield Capacity +7, Counter Protocols +5, Evasion Thrusters -3
- Description: Reinforced energy barrier providing solid mid-tier protection

**46. Fortress Shield** (₡291,000)
- Type: Shield
- Range: Melee
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +15, Shield Capacity +14, Counter Protocols +10, Evasion Thrusters -4, Servo Motors -3
- Description: Heavy fortress-class shield with layered defensive systems

**47. Aegis Bulwark** (₡409,000)
- Type: Shield
- Range: Melee
- Base Damage: 0, Cooldown: N/A, DPS: N/A
- Loadout: Weapon+Shield only
- Bonuses: Armor Plating +15, Shield Capacity +15, Counter Protocols +14, Power Core +11, Evasion Thrusters -5, Servo Motors -4
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
**Password**: admin123  
**Role**: admin  
**Currency**: ₡3,000,000  
**Prestige**: 0  
**Stable Name**: Auto-generated unique name (e.g., "Swift Thunder")

### WimpBot Test User Accounts (200)

**Username Format**: test_user_001 to test_user_200  
**Password**: testpass123  
**Currency**: ₡100,000 each  
**Stable Name**: Auto-generated unique name per user  
**Purpose**: Matchmaking and league testing - baseline "mob" for tournaments and testing

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
**Password**: testpass123  
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

**Users**: 202 total (at initial seed in dev/acceptance mode)
- 1 admin (₡3,000,000, prestige 0)
- 200 WimpBot test users (₡100,000 each)
- 1 bye-robot user

**Production mode**: Only bye-robot user is seeded (weapons and cycle metadata are always seeded).

**Robots**: 201 total (at initial seed)
- 200 WimpBot robots (1 per test user, distributed across 4 practice weapons)
- 1 bye-robot

**Tag Teams**: 0 at initial seed (created dynamically during cycles for WimpBot and AverageBot stables)

**Weapons**: 47 in catalog

**Weapon Inventory Entries**: 201 (one per robot)

**Facilities**: None at initial seed (created on-demand by users)

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
- **[PLAYER_ARCHETYPES_GUIDE.md](../PLAYER_ARCHETYPES_GUIDE.md)** - Player archetype definitions (strategy guide, not seed data)
