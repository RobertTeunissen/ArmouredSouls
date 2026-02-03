# Combat Formulas and Battle Mechanics

This document describes all combat formulas, weapon bonus applications, and battle mechanics for Armoured Souls.

## Table of Contents
1. [Weapon Attribute Bonuses](#weapon-attribute-bonuses)
2. [Hit Chance Calculation](#hit-chance-calculation)
3. [Critical Hit Calculation](#critical-hit-calculation)
4. [Damage Calculation](#damage-calculation)
5. [Damage Application (Shield & Armor)](#damage-application)
6. [Counter-Attack Calculation](#counter-attack-calculation)
7. [Offhand Attack Rules](#offhand-attack-rules)
8. [Weapon Bonus Design Considerations](#weapon-bonus-design-considerations)

## Weapon Attribute Bonuses

### Overview
Weapons can provide attribute bonuses (positive or negative) that enhance or penalize a robot's base attributes. These bonuses are **only applied to the hand wielding that specific weapon**.

### Available Weapon Bonuses
- **Combat Systems:**
  - `combatPowerBonus` - Increases base damage multiplier
  - `targetingSystemsBonus` - Improves hit chance and crit chance
  - `criticalSystemsBonus` - Increases critical hit chance
  - `penetrationBonus` - Reduces enemy armor effectiveness
  - `weaponControlBonus` - Increases damage multiplier
  - `attackSpeedBonus` - Reduces attack cooldown

- **Defensive Systems:**
  - `armorPlatingBonus` - Reduces incoming damage
  - `shieldCapacityBonus` - Increases max shield
  - `evasionThrustersBonus` - Makes attacks harder to land
  - `damageDampenersBonus` - Reduces critical damage multiplier
  - `counterProtocolsBonus` - Increases counter-attack chance

- **Other Systems:**
  - `hullIntegrityBonus` - Increases max HP
  - `servoMotorsBonus`, `gyroStabilizersBonus`, `hydraulicSystemsBonus`, `powerCoreBonus` - Various mobility and utility bonuses

### Application Rules

#### For Single Weapon / Weapon+Shield / Two-Handed
- Main hand weapon bonuses apply to all attacks

#### For Dual Wield
- **Main hand attack:** Only main hand weapon bonuses apply
- **Offhand attack:** Only offhand weapon bonuses apply
- Bonuses do NOT stack or apply to the opposite hand

### Formula
```
Effective Attribute = Robot Base Attribute + Weapon Bonus (for attacking hand only)
```

### Negative Bonuses
Weapons can have negative bonuses (penalties). These are handled correctly:
- Negative bonuses reduce the effective attribute
- Clamping functions ensure values stay within valid ranges
- Example: A crude weapon might have `-2 targeting_systems_bonus`

### Display
At battle start, weapon bonuses are displayed clearly:
```
Weapon Attribute Bonuses:
Main (Machine Pistol): CombatPower +1, Targeting +2, Speed +3
Offhand (Machine Pistol): CombatPower +1, Targeting +2, Speed +3
```

## Hit Chance Calculation

### Formula
```
Base Hit Chance = 70% (main hand) OR 50% (offhand)
Targeting Bonus = (Robot Targeting Systems + Weapon Bonus) / 2
Stance Bonus = 5% if offensive stance, else 0%
Evasion Penalty = Defender Evasion Thrusters / 3
Gyro Penalty = Defender Gyro Stabilizers / 5
Random Variance = Random(-10, 10)

Hit Chance = Clamp(Base + Targeting + Stance - Evasion - Gyro + Variance, 10%, 95%)
```

### Display Format
```
Hit: 70 base + 4.0 targeting + 0 stance - 1.7 evasion - 1.0 gyro + -7.9 variance = 64.4%
```

### Notes
- Offhand attacks have significantly reduced base hit chance (50% vs 70%)
- Random variance adds unpredictability to each attack
- Final hit chance is clamped between 10% and 95%

## Critical Hit Calculation

### Formula
```
Base Crit = 5%
Crit Systems Bonus = (Robot Crit Systems + Weapon Bonus) / 8
Targeting Bonus = (Robot Targeting Systems + Weapon Bonus) / 25
Loadout Bonus = 10% if two-handed, else 0%
Random Variance = Random(-10, 10)

Crit Chance = Clamp(Base + Crit Systems + Targeting + Loadout + Variance, 0%, 50%)
```

### Display Format
```
Crit: 5 base + 0.6 crit_systems + 0.3 targeting + 0 loadout + -8.8 variance = 7.1%
```

### Critical Damage Multiplier
```
Base Multiplier = 2.0 (or 2.5 for two-handed weapons)
Reduced by = Defender Damage Dampeners / 100
Minimum Multiplier = 1.2

Final Multiplier = Max(Base - Dampeners, 1.2)
```

## Damage Calculation

### Formula
```
Combat Power Multiplier = 1 + ((Robot Combat Power + Weapon Bonus) * 1.5) / 100
Loadout Multiplier = 1.25 (two-handed) OR 0.90 (dual wield) OR 1.0 (other)
Weapon Control Multiplier = 1 + (Robot Weapon Control + Weapon Bonus) / 100
Stance Multiplier = 1.15 (offensive) OR 0.90 (defensive) OR 1.0 (balanced)

Base Damage = Weapon Base Damage × Combat Power × Loadout × Weapon Control × Stance
```

### Display Format
```
Damage: 12 base × 1.10 combat_power × 0.90 loadout × 1.05 weapon_control × 1.00 stance = 12.5
```

## Damage Application

### Shield Absorption
When defender has shields:
```
Shield Absorption = Damage × 0.7 (shields absorb 70% of damage)
Penetration Multiplier = 1 + (Attacker Penetration + Weapon Bonus) / 200
Effective Shield Damage = Shield Absorption × Penetration Multiplier
Actual Shield Damage = Min(Effective Shield Damage, Current Shield)
```

### Bleed-Through Damage
If shield damage exceeds current shield:
```
Overflow = (Effective Shield Damage - Current Shield) × 0.3 (30% bleeds through)
Raw Armor Reduction = Defender Armor × (1 - (Attacker Penetration + Weapon Bonus) / 100)
Armor Reduction = Min(Raw Armor Reduction, 30) (capped at 30)
HP Damage = Max(1, Overflow - Armor Reduction) (minimum 1 damage)
```

### No Shield
When defender has no shield:
```
Raw Armor Reduction = Defender Armor × (1 - (Attacker Penetration + Weapon Bonus) / 100)
Armor Reduction = Min(Raw Armor Reduction, 30) (capped at 30)
HP Damage = Max(1, Damage - Armor Reduction) (minimum 1 damage)
```

### Display Format
```
Apply: 12.5 base × 1.00 crit = 12.5 | Shield: 1.0 absorbed | Bleed: 2.7 - 4.8 armor = 1.0 HP
```

Or without shield:
```
Apply: 12.5 base × 1.00 crit = 12.5 | No shield | 12.5 - 4.8 armor = 7.7 HP
```

## Counter-Attack Calculation

### Formula
```
Base Counter = Robot Counter Protocols / 100
Stance Multiplier = 1.15 if defensive stance, else 1.0
Shield Multiplier = 1.10 if weapon+shield loadout, else 1.0

Counter Chance = Clamp(Base × Stance × Shield × 100, 0%, 40%)
```

### Counter Damage
```
Counter Damage = Original Attack Base Damage × 0.7
```

Counter attacks use the defender's main hand weapon for damage calculation.

### Display Format
```
Counter: 5.00 counter_protocols / 100 × 1.0 × 1.0 = 5.0% (rolled 40.7, result: no counter)
```

## Offhand Attack Rules

### Base Hit Chance
- Main hand: 70% base hit chance
- **Offhand: 50% base hit chance** (20% penalty)

### Cooldown Penalty
Offhand attacks have a 40% cooldown penalty applied **before** attack speed bonuses:
```
Base Cooldown = Weapon Cooldown (or 4s default)
Offhand Base = Base Cooldown × 1.4 (40% penalty)
Final Cooldown = Offhand Base / (1 + Attack Speed / 50)

Example: 4s weapon → 5.6s offhand base → ~5.09s with 10% attack speed
```

### Weapon Bonus Application
For dual wield loadouts:
- Main hand attack uses ONLY main hand weapon bonuses
- Offhand attack uses ONLY offhand weapon bonuses
- No mixing or stacking of bonuses

### Visual Indicators
- Offhand attacks are labeled with `[OFFHAND]` in combat log
- Battle start shows offhand cooldown with "(40% penalty applied)"

## Weapon Bonus Design Considerations

### Offensive Bonuses on Defensive Weapons
**Question:** Should shields have offensive weapon bonuses like Combat Power or Targeting?

**Current Answer:** Yes, allowed but uncommon
- A shield might have small targeting bonus (represents better defensive positioning)
- Generally, shields should focus on defensive bonuses
- Offensive bonuses on shields should be small if present

### Defensive Bonuses on Offensive Weapons
**Question:** Should offensive weapons have defensive bonuses like Armor Plating?

**Current Answer:** Yes, allowed but should be balanced
- Heavy weapons might provide armor bonus (bulk provides protection)
- Light weapons might provide evasion bonus (easier to dodge)
- Should not make defensive stats too strong to avoid tank meta

### HP and Shield Affecting Attributes
**Question:** Should weapons affect max HP or max Shield?

**Current Answer:** Primarily for shields, limited for HP
- Shields (defensive weapon type) can increase max shield capacity
- Hull Integrity bonus on weapons should be rare and small
- Energy shields are more weapon-related than hull integrity

### Design Guidelines
1. **Weapon Type Alignment:** Bonuses should generally align with weapon type
   - Energy weapons: targeting, crit systems
   - Ballistic weapons: combat power, penetration
   - Melee weapons: hydraulic systems, weapon control
   - Shields: armor plating, shield capacity, counter protocols

2. **Balance Considerations:**
   - Positive and negative bonuses create weapon trade-offs
   - Highly specialized weapons have pronounced strengths/weaknesses
   - Generic weapons have small, balanced bonuses

3. **Dual Wield Balance:**
   - Each weapon contributes independently to its hand
   - Allows asymmetric loadouts (aggressive main, defensive offhand)
   - Offhand penalties balance the two-attack advantage

4. **Future Expansion:**
   - Special weapon types could have unique bonus patterns
   - Rare weapons might have extreme bonuses with drawbacks
   - Weapon quality tiers (common, rare, legendary) affect bonus magnitude

## Version History

- **2026-02-03:** Initial documentation
  - Added weapon bonus mechanics
  - Documented offhand attack rules
  - Defined formula display improvements
  - Established design considerations

