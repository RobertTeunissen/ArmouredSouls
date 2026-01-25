# Design Changes Summary - Version 2

**Date**: January 25, 2026  
**Status**: Comprehensive Redesign Based on Feedback

## Overview

This document summarizes the major changes made to the robot attributes and combat system based on Robert's feedback comments in ROBOT_ATTRIBUTES.md.

---

## Major Changes

### 1. Robot State Attributes Added

**NEW: Non-Upgradeable State Tracking**
- Current HP / Max HP
- Current Shield / Max Shield
- Damage Taken (current battle)
- ELO Rating (per robot)
- Win/Loss/Win Rate
- League & Fame (per robot)
- Repair Cost (current)
- Yield Threshold setting

**Impact**: Database schema needs additional fields on Robot model

### 2. Stable System Document Created

**NEW: STABLE_SYSTEM.md**
- Stable-level resources (Credits, Prestige, League Tier)
- Facility upgrades (Repair Bay, Training Facility, Workshop, Research Lab, Medical Bay)
- Roster management (robot slots, weapon storage)
- Prestige system with milestones and unlocks
- Coach hiring system
- Economic progression strategy

**Impact**: Database needs Stable/User-level fields and new Facility tables

### 3. Weapon-Neutral Attribute Names

**RENAMED Attributes (Combat Systems category):**
- Firepower → **Combat Power** (works for all weapons)
- Targeting Computer → **Targeting Systems** (melee + ranged)
- Critical Circuits → **Critical Systems** (all weapon types)
- Armor Piercing → **Penetration** (all damage types)
- Weapon Stability → **Weapon Control** (handles all weapons)
- Firing Rate → **Attack Speed** (time between attacks)

**Rationale**: Original names were biased toward ranged weapons. New names apply equally to melee and ranged builds.

### 4. Loadout System

**NEW: 4 Loadout Configurations**
1. **Weapon + Shield**: +Defense, -Speed, tank builds
2. **Two-Handed Weapon**: +Damage, +Crit, glass cannon
3. **Dual-Wield (Two Weapons)**: +Attack Speed, DPS builds
4. **Single Weapon**: +Balanced, flexible

**Each loadout has:**
- Specific stat modifiers
- Equipment restrictions
- Strategic advantages/disadvantages

**Impact**: 
- Database needs loadout field on Robot
- Weapons need "hands required" property
- New item type: Shields

### 5. Battle Stance Settings

**NEW: Pre-Battle Stance Selection**
- **Offensive**: +Damage, +Speed, -Defense, -Counter
- **Defensive**: +Defense, +Counter, -Damage, -Speed
- **Balanced**: No modifiers, AI decides dynamically

**Impact**: Database needs stance field on Robot configuration

### 6. Yield Threshold System

**NEW: Player-Controlled Surrender**
- Player sets HP % threshold (0-50%, default 10%)
- Robot attempts yield when HP drops below
- **Destroyed (0% HP)**: 2.5x repair cost multiplier
- **Yielded (>0% HP)**: Normal repair cost
- Logic Cores attribute makes yield decisions smarter

**Impact**: 
- Database needs yieldThreshold field
- Repair cost formula updated
- Battle logic needs yield detection

### 7. Combat System Options

**NEW: Time-Based Combat (Recommended)**
- Attacks happen every X seconds (based on cooldown)
- AI waits for optimal opportunity (positioning, enemy vulnerability)
- More dynamic and engaging
- Better utilizes AI attributes

**Alternative: Turn-Based (Simpler)**
- Original turn order system
- Good for prototype, easier to implement
- Less dynamic but clearer

**Recommendation**: Start turn-based Phase 1, migrate to time-based Phase 2+

### 8. Critical Hit Mechanics Clarified

**Updated Rules:**
- Critical rolls only happen **after** hit is confirmed
- Miss + Crit roll = just a miss (crit never happens)
- Critical impact:
  - Base: 2.0x damage
  - Two-handed weapon: 2.5x damage
  - Reduced by Damage Dampeners
  - Minimum 1.2x (can't be fully negated)

### 9. Damage Type System

**NEW: Weapon Type Differentiation**
- **Energy**: More effective vs shields (+20%)
- **Ballistic**: High penetration, standard vs armor
- **Melee**: Benefits from Hydraulic Systems, close-range bonuses
- **Explosive**: Area damage (hits multiple enemies in team battles)

**Hydraulic Systems** (formerly Hydraulic Power):
- Adds 0.4× to melee damage
- Affects carry capacity
- Helps with melee positioning

**Combat Power** (formerly Firepower):
- Affects ALL weapon types now
- Base damage multiplier
- No longer ranged-only

### 10. Shield Mechanics Redesigned

**NEW: Shields as Separate HP Pool**
- Shield has own HP (Shield Capacity × 2)
- Shields take damage first (at 70% effectiveness)
- Shields regenerate during battle (HP doesn't)
- Shield damage doesn't affect repair costs
- Power Core provides shield regeneration (0.15 per level per second)
- Shields can be depleted and regenerated multiple times

**Shield vs Armor:**
- Shields: First line of defense, regenerates
- Armor: Second line, reduces HP damage
- Both can be bypassed by Penetration attribute

### 11. HP Calculation Formula

**NEW: Hull Integrity Based**
```
max_hp = hull_integrity × 10
```

**Examples:**
- Hull Integrity 1: 10 HP (starting)
- Hull Integrity 10: 100 HP (early game)
- Hull Integrity 25: 250 HP (mid game)
- Hull Integrity 50: 500 HP (end game)

### 12. All Attributes Have Purpose

**Confirmed all 23 attributes have mechanical effects:**

**Combat Systems:**
- Combat Power → Base damage multiplier (all weapons)
- Targeting Systems → Hit chance + minor crit
- Critical Systems → Crit chance
- Penetration → Bypasses armor + shields
- Weapon Control → Damage multiplier
- Attack Speed → Time between attacks

**Defensive Systems:**
- Armor Plating → Physical damage reduction
- Shield Capacity → Max shield HP
- Evasion Thrusters → Dodge chance
- Damage Dampeners → Reduces crit multiplier
- Counter Protocols → Counter-attack chance

**Chassis & Mobility:**
- Hull Integrity → Max HP (×10)
- Servo Motors → Movement speed, positioning
- Gyro Stabilizers → Dodge, reaction time, positioning
- Hydraulic Systems → Melee damage bonus
- Power Core → Shield regeneration rate

**AI Processing:**
- Combat Algorithms → Decision quality (target selection, timing)
- Threat Analysis → Positioning bonuses to hit/damage/evasion
- Adaptive AI → Learning bonuses after turn 3
- Logic Cores → Low HP performance, yield decisions

**Team Coordination:**
- Sync Protocols → Team damage/defense multipliers
- Support Systems → Buff amount for allies
- Formation Tactics → Formation bonuses

### 13. Weapon System Expanded

**NEW Weapon Properties:**
- **Cooldown**: Time between attacks (time-based combat)
- **Hands Required**: One-handed, Two-handed, Dual-wield compatible
- **Special Properties**: Unique effects per weapon

**NEW Weapons Added:**
- Plasma Blade (one-handed melee, dual-wield)
- Combat Shield (equipment)
- Energy Barrier (equipment)

**Weapon Crafting System:**
- Unlockable at Workshop Level 3
- Requires prestige + Credits
- Customize stats and properties
- Player-designed weapons

---

## Database Schema Changes Needed

### User/Stable Model
```typescript
// Add to User model:
prestige: Int @default(0)
leagueTier: String @default("bronze")
totalBattles: Int @default(0)
totalWins: Int @default(0)
highestELO: Int @default(1200)
```

### Robot Model
```typescript
// Add state fields:
currentHP: Int
currentShield: Int
damageTaken: Int @default(0)
elo: Int @default(1200)
totalBattles: Int @default(0)
wins: Int @default(0)
losses: Int @default(0)
damageDealtLifetime: Int @default(0)
damageTakenLifetime: Int @default(0)
fame: Int @default(0)
leaguePoints: Int @default(0)
yieldThreshold: Int @default(10)

// Add loadout and stance:
loadout: String @default("single")  // "weapon_shield", "two_handed", "dual_wield", "single"
stance: String @default("balanced")  // "offensive", "defensive", "balanced"

// Rename attributes to match new names:
combatPower (was firepower)
targetingSystems (was targetingComputer)
criticalSystems (was criticalCircuits)
penetration (was armorPiercing)
weaponControl (was weaponStability)
attackSpeed (was firingRate)
shieldCapacity (was shieldGenerator)
evasionThrusters (same)
hydraulicSystems (was hydraulicPower)
```

### Weapon Model
```typescript
// Add new fields:
cooldown: Int  // seconds for time-based combat
handsRequired: String  // "one", "two", "dual"
specialProperty: String?
damageType: String  // "energy", "ballistic", "melee", "explosive"
```

### NEW: Shield Model
```typescript
model Shield {
  id: Int
  name: String
  cost: Int
  shieldBonus: Int  // Added to max shield
  armorBonus: Int
  counterBonus: Int
  specialProperty: String?
}
```

### NEW: Facility Model (for stable upgrades)
```typescript
model Facility {
  id: Int
  userId: Int
  facilityType: String  // "repair_bay", "training", "workshop", "research", "medical"
  level: Int @default(0)
  maxLevel: Int @default(4)
}
```

---

## Implementation Priority

**Immediate (Phase 1):**
1. Update attribute names in schema
2. Add robot state fields
3. Implement loadout system
4. Add yield threshold
5. Update combat formulas

**Soon (Phase 1.5):**
1. Add stance system
2. Add shield as separate HP pool
3. Update repair cost formula
4. Add HP calculation formula

**Later (Phase 2):**
1. Implement stable system
2. Add facility upgrades
3. Add prestige tracking
4. Implement time-based combat
5. Add weapon crafting

---

## Breaking Changes

**Attribute Names Changed:**
- All seed data must be updated
- Weapon bonus fields must be renamed
- Any existing UI/code references must be updated

**New Required Fields:**
- Robots need loadout, stance, yieldThreshold
- Weapons need cooldown, handsRequired, damageType
- Users need prestige, leagueTier

**Formula Changes:**
- Repair cost formula now includes destruction multiplier
- HP calculation now based on Hull Integrity × 10
- Shield is separate from HP
- Critical hits only on successful hits

---

## Questions Resolved

All 25+ comments in ROBOT_ATTRIBUTES.md have been addressed:

✅ Robot state attributes defined  
✅ Stable system document created  
✅ Weapon-neutral attribute names  
✅ Melee vs ranged differentiation  
✅ Loadout system (shield, two-handed, dual-wield)  
✅ Stance settings (offensive/defensive/balanced)  
✅ Time-based combat explored (recommended)  
✅ Yield threshold system with Logic Cores  
✅ Critical hit mechanics clarified  
✅ Damage types defined  
✅ Shield mechanics redesigned  
✅ Hydraulic Systems purpose clarified  
✅ HP calculation formula defined  
✅ All attributes have mechanical effects  
✅ Team coordination for 2v2+ battles  
✅ Weapon system expanded with special properties  
✅ Weapon crafting system designed  

---

This represents a comprehensive evolution of the combat system while maintaining the core 23-attribute structure and economic balance.
