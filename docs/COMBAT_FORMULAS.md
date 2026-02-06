# Combat Formulas and Battle Mechanics

**Last Updated**: February 5, 2026  
**Status**: Authoritative Reference - Defines formulas, implementation, and display formats

This document is the **authoritative source** for all combat formulas, weapon bonus applications, and battle mechanics in Armoured Souls. It defines:
1. **System Logic**: Mathematical formulas and game mechanics
2. **Implementation**: Code structure and function references
3. **Display Formats**: How formulas are shown in extended battle logs (Admin panel at `/admin`)
4. **User Messages**: How battle events are presented to players (see COMBAT_MESSAGES.md for variations)

**Important Terminology:**
- **"Energy Shield"**: The HP pool that absorbs damage (attribute: Energy Shield Capacity)
- **"Shield weapon"**: Physical equipment held in hand (e.g., Combat Shield)
- Use "Energy Shield" consistently when referring to the damage-absorbing HP pool

## Table of Contents
1. [Weapon Attribute Bonuses](#weapon-attribute-bonuses)
2. [Weapon Malfunction Mechanic](#weapon-malfunction-mechanic)
3. [Attack Speed and Cooldown Calculation](#attack-speed-and-cooldown-calculation)
4. [Hit Chance Calculation](#hit-chance-calculation)
5. [Critical Hit Calculation](#critical-hit-calculation)
6. [Damage Calculation](#damage-calculation)
7. [Damage Application (Shield & Armor)](#damage-application)
8. [Counter-Attack Calculation](#counter-attack-calculation)
9. [Shield Regeneration](#shield-regeneration)
10. [Offhand Attack Rules](#offhand-attack-rules)
11. [Weapon Bonus Design Considerations](#weapon-bonus-design-considerations)

---

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
  - `shieldCapacityBonus` - Increases max Energy Shield
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

---

## Weapon Malfunction Mechanic

**Last Updated**: February 6, 2026  
**Status**: Implemented - Differentiates Weapon Control from Combat Power

### Overview

Weapon Control now provides **two distinct benefits**:
1. **Reliability**: Reduces weapon malfunction chance (primary utility)
2. **Damage Multiplier**: Increases damage output (secondary utility, reduced from original)

This differentiates Weapon Control from Combat Power, making them no longer redundant multiplicative damage modifiers.

### Malfunction Chance Formula

```
Base Malfunction Rate = 20%
Reduction Per Point = 0.4%
Effective Weapon Control = Robot Weapon Control + Weapon Bonus (for attacking hand)

Malfunction Chance = Max(0, Base Malfunction Rate - (Effective Weapon Control × Reduction Per Point))
```

### Examples

**Low Weapon Control (1-10)**:
- Weapon Control 1:  `20 - (1 × 0.4) = 19.6%` malfunction chance
- Weapon Control 5:  `20 - (5 × 0.4) = 18.0%` malfunction chance
- Weapon Control 10: `20 - (10 × 0.4) = 16.0%` malfunction chance

**Mid Weapon Control (20-30)**:
- Weapon Control 20: `20 - (20 × 0.4) = 12.0%` malfunction chance
- Weapon Control 25: `20 - (25 × 0.4) = 10.0%` malfunction chance
- Weapon Control 30: `20 - (30 × 0.4) = 8.0%` malfunction chance

**High Weapon Control (40-50)**:
- Weapon Control 40: `20 - (40 × 0.4) = 4.0%` malfunction chance
- Weapon Control 45: `20 - (45 × 0.4) = 2.0%` malfunction chance
- Weapon Control 50: `20 - (50 × 0.4) = 0.0%` malfunction chance (perfectly reliable)

### Malfunction Effects

When a weapon malfunctions:
- ❌ Attack immediately fails (bypasses hit calculation)
- ❌ No damage dealt (0 HP, 0 Shield damage)
- ❌ No critical hit possible
- ❌ No counter-attack triggered
- ⚠️ Event logged as 'malfunction' type with warning message

### Malfunction Order of Operations

```
1. Check Weapon Malfunction (FIRST)
   └─> If malfunction: Attack fails immediately, skip all other checks
   └─> If reliable: Continue to step 2

2. Calculate Hit Chance
   └─> If miss: Attack fails, 0 damage
   └─> If hit: Continue to step 3

3. Calculate Critical Hit Chance
4. Calculate Damage
5. Apply Damage through Shield & Armor
6. Check Counter-Attack
```

### Display Format (Extended Battle Logs - Admin)

**Successful Attack**:
```
Malfunction: 20 base - (15.0 weapon_control × 0.4) = 14.0% (rolled 45.3, result: weapon reliable)
Hit: 70 base + 7.5 targeting + 0 stance - 3.3 evasion - 2.0 gyro + 5.2 variance = 77.4%
...
```

**Malfunction Event**:
```
Malfunction: 20 base - (5.0 weapon_control × 0.4) = 18.0% (rolled 12.5, result: MALFUNCTION)
```

### Display Format (User-Facing Battle Logs)

```
⚠️ RobotA's Plasma Rifle malfunctions! (Weapon Control failure)
⚠️ [OFFHAND] RobotB's Machine Pistol malfunctions! (Weapon Control failure)
```

### Implementation Reference

**File**: `prototype/backend/src/services/combatSimulator.ts`  
**Function**: `calculateMalfunctionChance()`  
**Lines**: ~178-197

```typescript
function calculateMalfunctionChance(
  attacker: RobotWithWeapons,
  attackerHand: 'main' | 'offhand' = 'main'
): { malfunctionChance: number; breakdown: FormulaBreakdown } {
  const effectiveWeaponControl = getEffectiveAttribute(
    attacker,
    attacker.weaponControl,
    attackerHand,
    'weaponControlBonus'
  );
  
  const baseMalfunction = 20;
  const reductionPerPoint = 0.4;
  const calculated = baseMalfunction - (effectiveWeaponControl * reductionPerPoint);
  const finalChance = Math.max(0, calculated);
  
  return {
    malfunctionChance: finalChance,
    breakdown: {
      calculation: `${baseMalfunction} base - (${effectiveWeaponControl.toFixed(1)} weapon_control × ${reductionPerPoint}) = ${finalChance.toFixed(1)}%`,
      components: {
        base: baseMalfunction,
        weaponControl: effectiveWeaponControl,
        reductionPerPoint,
      },
      result: finalChance,
    },
  };
}
```

### Weapon Control Damage Multiplier (Rebalanced)

**Previous Formula**:
```
Damage Multiplier = 1 + (Weapon Control / 100)
```

**New Formula (Reduced)**:
```
Damage Multiplier = 1 + (Weapon Control / 150)
```

**Rationale**: Since Weapon Control now provides significant value through reliability (preventing 0-20% of attacks from failing), its damage multiplier has been reduced by 33% to maintain balance. This prevents Weapon Control from being overpowered.

**Comparison**:
```
Weapon Control = 30:
  Old: 1 + 30/100 = 1.30 (30% damage increase)
  New: 1 + 30/150 = 1.20 (20% damage increase)
  
Weapon Control = 50:
  Old: 1 + 50/100 = 1.50 (50% damage increase)
  New: 1 + 50/150 = 1.33 (33% damage increase)
```

### Design Benefits

1. **Differentiation**: Combat Power and Weapon Control are no longer redundant
   - Combat Power: Pure damage multiplier (1.5% per point, unchanged)
   - Weapon Control: Reliability + reduced damage multiplier

2. **Strategic Depth**: Players must decide between:
   - High Combat Power (raw damage output)
   - High Weapon Control (consistency and reliability)
   - Balanced approach

3. **Scaling**: Malfunction chance scales smoothly from 20% to 0%
   - Noticeable at low levels (forces early investment decisions)
   - Meaningful at mid levels (10-15% malfunction still impactful)
   - Eliminates at high levels (reward for heavy investment)

4. **Weapon Bonuses**: Weapons can now provide weaponControlBonus to:
   - Represent weapon quality (reliable vs. unreliable)
   - Create trade-offs (high damage but unreliable vs. lower damage but reliable)

### Balance Notes

- **Not Overpowered**: 20% malfunction at low levels is noticeable but not crippling (1 in 5 attacks)
- **Incentivizes Investment**: Players must invest in Weapon Control to maintain reliability
- **Fair Scaling**: Linear reduction (0.4% per point) ensures consistent improvement
- **Natural Cap**: 0% malfunction at WC=50 provides perfect reliability as end-game reward

---

## Attack Speed and Cooldown Calculation

### Overview
Attack cooldown determines how frequently a robot can attack. It's calculated using the weapon's base cooldown, the robot's Attack Speed attribute, and the weapon's Attack Speed Bonus.

### Formula
```
Effective Attack Speed = Robot Attack Speed + Weapon Attack Speed Bonus (per hand)
Base Cooldown = Weapon Cooldown (or 4 seconds default)
Cooldown Penalty = Base Cooldown × 1.4 (only for offhand attacks)
Final Cooldown = Cooldown (with penalty if offhand) / (1 + Effective Attack Speed / 50)
```

### Implementation
For each hand (main and offhand), the cooldown is calculated independently:
```typescript
const effectiveAttackSpeed = getEffectiveAttribute(robot, robot.attackSpeed, hand, 'attackSpeedBonus');
const cooldownWithPenalty = hand === 'offhand' ? baseCooldown * 1.4 : baseCooldown;
return cooldownWithPenalty / (1 + Number(effectiveAttackSpeed) / 50);
```

### Examples

**Example 1: Main Hand with Weapon Bonus**
- Robot Attack Speed: 10
- Weapon Attack Speed Bonus: +3
- Effective Attack Speed: 13
- Weapon Base Cooldown: 4 seconds
- Formula: 4 / (1 + 13/50) = 4 / 1.26 = **3.17 seconds**

**Example 2: Offhand with Weapon Bonus**
- Robot Attack Speed: 10
- Weapon Attack Speed Bonus: +3
- Effective Attack Speed: 13
- Weapon Base Cooldown: 4 seconds
- Offhand Penalty Applied: 4 × 1.4 = 5.6 seconds
- Formula: 5.6 / (1 + 13/50) = 5.6 / 1.26 = **4.44 seconds**

**Example 3: High Attack Speed**
- Robot Attack Speed: 30
- Weapon Attack Speed Bonus: +5
- Effective Attack Speed: 35
- Weapon Base Cooldown: 4 seconds
- Formula: 4 / (1 + 35/50) = 4 / 1.7 = **2.35 seconds**

### Notes
- Each weapon's attack speed bonus only applies to its own hand
- Offhand attacks have a 40% cooldown penalty (applied before attack speed bonuses)
- Higher attack speed = faster attacks = shorter cooldown
- Attack Speed bonus from weapons significantly improves DPS

---

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
Loadout Multiplier = 1.10 (two-handed) OR 0.90 (dual wield) OR 1.0 (other)
Weapon Control Multiplier = 1 + (Robot Weapon Control + Weapon Bonus) / 150  // Changed from /100 (Feb 2026)
Stance Multiplier = 1.15 (offensive) OR 0.90 (defensive) OR 1.0 (balanced)

Base Damage = Weapon Base Damage × Combat Power × Loadout × Weapon Control × Stance
```

**Note on Loadout Bonuses (v1.2)**:
- Two-handed loadout provides +10% to Combat Power attribute (applied before multipliers)
- Two-handed loadout also provides 1.10× damage multiplier (applied during damage calculation)
- Combined effect: Robot with 5 Combat Power becomes 5.5 effective CP with two-handed loadout
- See [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md) for complete loadout attribute bonuses

### Display Format
```
Damage: 12 base × 1.10 combat_power × 0.90 loadout × 1.05 weapon_control × 1.00 stance = 12.5
```

## Damage Application

**Last Updated**: February 5, 2026  
**Status**: New simplified formula - eliminates 70% absorption and bleed-through

This section defines how damage is applied to Energy Shields and HP, including armor reduction mechanics.

### Overview

Damage is applied in a simple two-step process:
1. **Energy Shield Absorption**: Damage goes to Energy Shield first (100% effective, no absorption penalty)
2. **HP Damage**: Any overflow damage (after shield depleted) goes to HP with armor reduction applied

### Constants

```typescript
// Armor reduction effectiveness (percentage per armor point)
export const ARMOR_EFFECTIVENESS = 1.5;  // 1.5% damage reduction per armor point

// Penetration bonus when penetration exceeds armor (percentage per excess point)
export const PENETRATION_BONUS = 2.0;    // 2% damage increase per penetration point above armor

// Maximum armor reduction cap has been REMOVED - now scales smoothly
```

### Naming Clarification

To understand the variable naming in damage calculations:

**Naming Chain:**
1. **Robot Attribute** (database): `armorPlating` (the robot's defensive attribute, 1-50)
2. **Effective Value** (code variable): `effectiveArmorPlating` (includes weapon bonuses, if any)
3. **Constant** (formula): `ARMOR_EFFECTIVENESS` (1.5% per point)
4. **Calculated Result** (code variable): `armorReductionPercent` (the percentage of damage reduced)

**Example Flow:**
```
Robot has armorPlating = 20
effectiveArmorPlating = 20 (no weapon bonuses in current implementation)
armorReductionPercent = (20 - 10) × ARMOR_EFFECTIVENESS = 10 × 1.5 = 15%
Damage after armor = damage × (1 - 0.15) = damage × 0.85
```

**Note**: In the current implementation, `effectiveArmor` is used as shorthand for `effectiveArmorPlating` since the defender's armor isn't affected by their equipped weapon bonuses (only attacker's penetration matters).

### Step 1: Energy Shield Damage

When defender has Energy Shield remaining:
```
Energy Shield Damage = Min(Total Damage, Current Energy Shield)
Current Energy Shield = Current Energy Shield - Energy Shield Damage
Remaining Damage = Total Damage - Energy Shield Damage
```

**Important Changes:**
- ❌ **Removed**: 70% shield absorption (was: `Damage × 0.7`)
- ❌ **Removed**: Penetration multiplier on shields (was: `1 + Penetration/200`)
- ✅ **New**: 100% of damage applies directly to Energy Shield

### Step 2: HP Damage with Armor Reduction

If remaining damage > 0 after Energy Shield depleted:

#### Case A: Penetration ≤ Armor (Armor reduces damage)
```
Armor Reduction Percent = (Effective Armor - Effective Penetration) × ARMOR_EFFECTIVENESS
Damage Multiplier = 1 - (Armor Reduction Percent / 100)
HP Damage = Max(1, Remaining Damage × Damage Multiplier)
```

**Example:**
```
20 Armor vs 10 Penetration, 50 damage overflow
  Armor Reduction = (20 - 10) × 1.5% = 15%
  Damage Multiplier = 1 - 0.15 = 0.85
  HP Damage = 50 × 0.85 = 42.5 damage
```

#### Case B: Penetration > Armor (Penetration adds bonus damage)
```
Penetration Bonus Percent = (Effective Penetration - Effective Armor) × PENETRATION_BONUS
Damage Multiplier = 1 + (Penetration Bonus Percent / 100)
HP Damage = Max(1, Remaining Damage × Damage Multiplier)
```

**Example:**
```
10 Armor vs 30 Penetration, 50 damage overflow
  Penetration Bonus = (30 - 10) × 2% = 40%
  Damage Multiplier = 1 + 0.40 = 1.40
  HP Damage = 50 × 1.40 = 70 damage
```

### Implementation Reference

**File**: `prototype/backend/src/services/combatSimulator.ts`  
**Function**: `applyDamage()`  
**Lines**: ~220-296 (to be updated)

```typescript
function applyDamage(
  baseDamage: number,
  attacker: RobotWithWeapons,
  defender: RobotWithWeapons,
  defenderState: RobotCombatState,
  isCritical: boolean,
  attackerHand: 'main' | 'offhand' = 'main'
): { hpDamage: number; shieldDamage: number; breakdown: FormulaBreakdown } {
  let damage = baseDamage;
  
  // Apply critical multiplier
  if (isCritical) {
    const critMultiplier = attacker.loadoutType === 'two_handed' ? 2.5 : 2.0;
    damage *= Math.max(critMultiplier - Number(defender.damageDampeners) / 100, 1.2);
  }
  
  const effectivePenetration = getEffectiveAttribute(attacker, attacker.penetration, attackerHand, 'penetrationBonus');
  const effectiveArmorPlating = Number(defender.armorPlating);  // Defender's Armor Plating attribute
  
  let shieldDamage = 0;
  let hpDamage = 0;
  
  // Step 1: Apply to Energy Shield first (100% effective)
  if (defenderState.currentShield > 0) {
    shieldDamage = Math.min(damage, defenderState.currentShield);
    defenderState.currentShield -= shieldDamage;
    damage = damage - shieldDamage; // Remaining damage
  }
  
  // Step 2: Apply overflow to HP with armor reduction
  if (damage > 0) {
    if (effectivePenetration <= effectiveArmorPlating) {
      // Case A: Armor reduces damage
      const armorReductionPercent = (effectiveArmorPlating - effectivePenetration) * ARMOR_EFFECTIVENESS;
      const damageMultiplier = 1 - (armorReductionPercent / 100);
      hpDamage = Math.max(1, damage * damageMultiplier);
    } else {
      // Case B: Penetration bonus damage
      const penetrationBonusPercent = (effectivePenetration - effectiveArmorPlating) * PENETRATION_BONUS;
      const damageMultiplier = 1 + (penetrationBonusPercent / 100);
      hpDamage = Math.max(1, damage * damageMultiplier);
    }
  }
  
  defenderState.currentHP = Math.max(0, defenderState.currentHP - hpDamage);
  
  return { hpDamage, shieldDamage, breakdown: {...} };
}
```

### Display Format (Extended Battle Logs - Admin)

**With Energy Shield:**
```
Apply: 25.0 base × 2.00 crit = 50.0 | Energy Shield: 40.0 absorbed | Overflow: 10.0 × 0.85 armor = 8.5 HP
```

**Without Energy Shield:**
```
Apply: 25.0 base × 1.00 crit = 25.0 | No Energy Shield | 25.0 × 0.85 armor = 21.3 HP
```

**With Penetration Bonus:**
```
Apply: 25.0 base × 1.00 crit = 25.0 | No Energy Shield | 25.0 × 1.40 pen bonus = 35.0 HP
```

### Display Format (User-Facing Battle Logs)

**Simple Format** (for main battle log):
```
💥 RobotA hits RobotB for 50 damage with Plasma Rifle (40 energy shield, 8 HP)
⚡ RobotA's attack breaks through RobotB's energy shield!
💥 RobotA hits RobotB for 25 damage with Power Sword (21 HP)
```

**See COMBAT_MESSAGES.md** for complete message variations and templates.

### Important Notes

**Energy Shield Terminology:**
- **"Energy Shield"** refers to the HP pool (attribute: Energy Shield Capacity)
- **"Shield weapon"** refers to physical equipment (e.g., Combat Shield)
- Never confuse the two in documentation or code comments

**Removed Mechanics:**
- ❌ 70% shield absorption (was reducing damage too much)
- ❌ 30% bleed-through (was creating confusing overflow mechanics)
- ❌ Armor reduction cap at 30 (was making high armor invincible)
- ❌ Penetration multiplier on shields (was inconsistent with armor penetration)

**Key Benefits:**
- ✅ Much faster battles (2-3x faster damage application)
- ✅ Simpler mechanics (damage → shield → HP, clean flow)
- ✅ Armor scales smoothly (no hard caps)
- ✅ Penetration is strong counter-stat (can add bonus damage)
- ✅ Easier to understand and debug

### Edge Cases

**Edge Case 1: High Armor vs Low Penetration**
```
50 Armor vs 1 Penetration, 50 damage
  Armor Reduction = (50 - 1) × 1.5% = 73.5%
  HP Damage = 50 × (1 - 0.735) = 13.25 damage
  
Result: High armor still very effective but not invincible
```

**Edge Case 2: High Penetration vs Low Armor**
```
50 Penetration vs 10 Armor, 50 damage
  Penetration Bonus = (50 - 10) × 2% = 80%
  HP Damage = 50 × (1 + 0.80) = 90 damage
  
Result: High penetration hard-counters armor and amplifies damage
```

**Edge Case 3: Energy Shield Depletion Mid-Attack**
```
Robot has 20 Energy Shield, takes 50 damage
  Energy Shield Damage = 20 (shield breaks)
  Remaining = 50 - 20 = 30
  With 15% armor reduction: 30 × 0.85 = 25.5 HP damage
  Total effective: 45.5 damage (91% of attack)
  
Result: Breaking shields is punishing but fair
```

### Version History

- **2026-02-05**: Complete rewrite with new simplified formula
  - Removed 70% shield absorption
  - Removed bleed-through mechanics
  - Removed armor cap at 30
  - Added percentage-based armor reduction
  - Added penetration bonus mechanics
  - Added implementation code reference
  - Added display formats for admin and users

- **2026-02-03**: Initial documentation with old formula

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

---

## Energy Shield Regeneration

### Overview
Robot HP does **NOT** regenerate during or between battles. Energy Shields DO regenerate during battle based on the Power Core attribute.

### Formula
```
Energy Shield Regen Per Second = Power Core × 0.15
Stance Bonus = 1.20 if defensive stance, else 1.0
Effective Regen = Energy Shield Regen Per Second × Stance Bonus × Delta Time
New Energy Shield = Min(Current Energy Shield + Effective Regen, Max Energy Shield)
```

### Example
- Power Core: 20
- Defensive Stance: Yes
- Energy Shield Regen: 20 × 0.15 × 1.20 = 3.6 per second
- After 5 seconds: Energy Shield regenerates 18 HP (up to max)

### Notes
- Energy Shields regenerate continuously during battle
- Defensive stance provides +20% Energy Shield regeneration
- Robot HP never regenerates during battle
- Energy Shields reset to maximum after battle ends

---

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

