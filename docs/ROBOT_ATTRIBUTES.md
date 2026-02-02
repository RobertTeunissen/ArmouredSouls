# Robot Attributes System

**Last Updated**: January 30, 2026  
**Status**: Design Document - Complete Time-Based Combat System

## Overview

Armoured Souls uses a comprehensive attribute system with **23 core attributes** that define robot combat capabilities. All attributes are robot-themed and have specific mechanical effects in combat. The system supports weapon-type specialization (melee vs ranged), loadout configurations, battle stances, and uses **time-based combat** exclusively.

**Database Schema**: See DATABASE_SCHEMA.md for authoritative field definitions and relationships.

---

## Currency System

**Currency Name**: **Credits** (₡)

- **Starting Balance**: ₡2,000,000
- **Robot Frame Cost**: ₡500,000 (bare metal, all attributes at 1)
- **Upgrade Formula**: `(current_level + 1) × 1,000` Credits
  - Level 1→2: ₡2,000
  - Level 2→3: ₡3,000
  - Level 49→50: ₡50,000

---

## Core Attributes (23 Total)

All robots start with each attribute at level 1. Players spend Credits to upgrade attributes. Each attribute ranges from 1-50.

### 🔴 Combat Systems (6)

**Offensive and defensive combat capabilities (weapon-neutral)**

1. **Combat Power** - Base damage multiplier for all weapons
2. **Targeting Systems** - Hit chance and precision for all attacks
3. **Critical Systems** - Chance to deal critical damage with any weapon
4. **Penetration** - Bypasses armor and shields for all attack types
5. **Weapon Control** - Handling and effectiveness with equipped weapons
6. **Attack Speed** - Time between attacks for all weapon types

**Design Notes:**
- All attributes are weapon-neutral - apply to all loadouts and weapon types
- Combat Power affects base damage regardless of weapons
- Targeting Systems helps both ranged accuracy and melee precision
- Specialization comes from weapon choice and loadout, not attributes

### 🔵 Defensive Systems (5)

**Armor, shields, and damage mitigation**

7. **Armor Plating** - Physical damage reduction from all sources
8. **Shield Capacity** - Maximum energy shield HP pool (separate from robot HP)
9. **Evasion Thrusters** - Chance to dodge incoming attacks
10. **Damage Dampeners** - Reduces critical hit damage taken
11. **Counter Protocols** - Chance to strike back when hit

### 🟢 Chassis & Mobility (5)

**Core mechanical structure and movement capabilities**

12. **Hull Integrity** - Maximum health points (structural HP)
13. **Servo Motors** - Movement speed and positioning
14. **Gyro Stabilizers** - Balance, dodging ability, and reaction time
15. **Hydraulic Systems** - Physical force for melee impact and carry capacity
16. **Power Core** - Energy generation for energy shield regeneration

### 🟡 AI Processing (4)

**Autonomous intelligence and combat decision-making**

17. **Combat Algorithms** - Battle strategy and decision quality
18. **Threat Analysis** - Target priority and positioning
19. **Adaptive AI** - Learns opponent patterns and adapts tactics
20. **Logic Cores** - Performance under pressure and critical decisions

### 🟣 Team Coordination (3)

**Attributes for multi-robot arena battles (2v2, 3v3, etc.)**

21. **Sync Protocols** - Coordination with allied robots
22. **Support Systems** - Ability to assist/buff teammates
23. **Formation Tactics** - Positioning within team formations

---

## Robot State Attributes

These are tracked per robot but not upgraded directly. See DATABASE_SCHEMA.md for complete field definitions.

### Combat State
- **Current HP**: Health remaining (max determined by Hull Integrity)
  - **Critical: Robot HP does NOT regenerate during or between battles**
  - Damage to HP persists until repaired with Credits
  - **Initialization**: New robots start with `currentHP = maxHP` (full health)
- **Current Shield**: Energy shield HP remaining (max determined by Shield Capacity)
  - Energy shields DO regenerate during battle (based on Power Core attribute)
  - Energy shields reset to max after battle ends
  - **Initialization**: New robots start with `currentShield = maxShield` (full shields)
- **Damage Taken**: Total damage in current/last battle

### Robot Identity
- **Name**: Player-chosen robot name (max 50 characters)
- **Frame ID**: Robot chassis/appearance identifier
- **Paint Job**: Cosmetic customization (unlocked via prestige)

### Performance Tracking
- **ELO Rating**: Individual robot skill rating (starting 1200)
- **Total Battles**: Lifetime battle count
- **Wins**: Victory count
- **Losses**: Defeat count
- **Damage Dealt Lifetime**: Total lifetime damage output
- **Damage Taken Lifetime**: Total lifetime damage received
- **Kills**: Opponents reduced to 0 HP (total loss)

### Economic State
- **Repair Cost**: Current cost to fully repair (based on damage + attribute total)
- **Battle Readiness**: Percentage (100% = full HP, 0% = critically damaged)
- **Total Repairs Paid**: Lifetime repair costs

### League & Fame
- **Current League**: Bronze/Silver/Gold/Platinum/Diamond/Champion
- **League ID**: Specific league instance (e.g., "bronze_1", "bronze_2") - supports multiple Bronze leagues
- **League Points**: Points in current league (for promotion/demotion)
- **Fame**: Individual robot reputation (earned from victories)
- **Titles**: Earned achievements (e.g., "Champion", "Undefeated")

---

## Player Configuration Settings

These are player-controlled robot settings, **NOT upgradeable attributes**. They can be changed between battles but not during battle.

### Yield Threshold
- Range: 0% to 50%
- Default: 10%
- HP percentage where robot attempts to surrender

### Loadout
- Options: "weapon_shield", "two_handed", "dual_wield", "single"
- Determines how weapons/shields are equipped
- See [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)

### Stance
- Options: "offensive", "defensive", "balanced"
- Affects combat behavior and stat modifiers
- See Battle Stance section below

**Note**: These settings are stored in the database but are NOT attributes that can be upgraded with Credits.

---

## Loadout System

Robots are bipedal humanoids with two arms. The loadout system determines how weapons and shields are equipped to robots, with four distinct configurations that provide different tactical advantages.

**For complete details on:**
- Loadout configurations and bonuses/penalties
- Weapon inventory management and storage
- Weapon ownership and equipment rules
- Complete weapon catalog with specifications
- Weapon crafting system

**See: [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**

### Loadout Bonuses Quick Reference

For quick reference, the four loadout types provide the following bonuses/penalties:

**1. Weapon + Shield** (`weapon_shield`)
- **Bonuses**: +20% Shield Capacity, +15% Armor Plating, +10% Counter Protocols
- **Penalties**: -15% Attack Speed
- **Best For**: Defensive tank builds

**2. Two-Handed** (`two_handed`)
- **Bonuses**: +25% Combat Power, +20% Critical Systems
- **Penalties**: -10% Evasion Thrusters
- **Best For**: High-damage glass cannon builds

**3. Dual-Wield** (`dual_wield`)
- **Bonuses**: +30% Attack Speed, +15% Weapon Control
- **Penalties**: -20% Penetration, -10% Combat Power
- **Best For**: Rapid-attack DPS builds

**4. Single** (`single`)
- **Bonuses**: +10% Gyro Stabilizers, +5% Servo Motors
- **Penalties**: None
- **Best For**: Balanced, flexible builds

**Note**: Percentage-based bonuses scale proportionally with robot power level, ensuring meaningful choices at all stages of progression.

---

## Battle Stance Setting

Before battle, players set their robot's stance preference (not an attribute, a setting).

### Stance Options

**1. Offensive Stance**
- **Behavior**: Prioritize attacks, aggressive positioning
- **Effects**:
  - +15% to Combat Power
  - +10% to Attack Speed
  - -10% to Counter Protocols
  - -10% to Evasion Thrusters
  - Robot seeks optimal attack opportunities

**2. Defensive Stance**
- **Behavior**: Prioritize survival, cautious positioning
- **Effects**:
  - +15% to Armor Plating
  - +15% to Counter Protocols
  - +20% to energy shield regeneration
  - -10% to Combat Power
  - -10% to Attack Speed
  - Robot focuses on blocking and countering

**3. Balanced Stance**
- **Behavior**: Adaptive based on situation
- **Effects**:
  - No stat modifiers
  - Robot uses Combat Algorithms to decide when to attack/defend

**Note**: Percentage-based bonuses follow same rationale as loadout bonuses - they scale fairly at all power levels.

### Stance & AI Interaction

AI attributes determine how effectively the robot executes its stance:

**Combat Algorithms** - Decision quality multiplier:
```
decision_quality = combat_algorithms / 10

// Affects optimal timing of attacks
optimal_attack_window = base_window * (1 + decision_quality / 10)

// High Combat Algorithms (30+): Robot makes excellent tactical decisions
// Low Combat Algorithms (<10): Robot may attack suboptimally
```

**Threat Analysis** - Positioning effectiveness:
```
positioning_bonus = threat_analysis / 20

// Applies to hit chance and damage when positioning is advantageous
effective_hit_chance += positioning_bonus
effective_damage *= (1 + positioning_bonus / 100)
```

**Adaptive AI** - Learning over time:
```
// After 5 seconds of combat
learning_bonus = adaptive_ai / 15

// Gradually improves performance against specific opponent
hit_chance += learning_bonus
damage_reduction += learning_bonus / 2
```

**Logic Cores** - Performance under pressure (see formula in Combat Formulas section)

---

## Yield Threshold System

**Yield Threshold** is a standalone setting, separate from stance. Players set the HP percentage where their robot surrenders.

### How It Works

**Yield Threshold Setting:**
- Range: 0% to 50%
- Default: 10%
- Configurable per robot before each battle

**Yield Behavior:**
- When robot HP drops below threshold, robot attempts to surrender
- Surrender is not instant - opponent can land one more attack
- **Important**: A robot at 12% HP can be hit by massive damage, reduced to 0 HP, resulting in total loss/kill
- If surrendered successfully:
  - Battle ends (opponent wins)
  - Standard repair costs apply
- If robot is destroyed (0% HP) before yielding:
  - Increased repair cost multiplier applies

**Logic Cores Integration:**

Logic Cores improves decision-making under low HP conditions and provides **positive benefits at high levels**:

```
// When HP drops below 30%
if current_hp < (max_hp * 0.30):
    // Base penalties when damaged
    base_accuracy_penalty = 20
    base_damage_penalty = 15
    
    // Logic Cores provides both penalty reduction AND bonuses at high levels
    // Formula: penalty reduction + bonus for high Logic Cores
    accuracy_adjustment = base_accuracy_penalty - (logic_cores * 0.67)
    damage_adjustment = base_damage_penalty - (logic_cores * 0.5)
    
    // Apply adjustment (negative = penalty, positive = bonus)
    hit_chance -= accuracy_adjustment
    damage *= (1 + damage_adjustment / 100)
    
    // Additional bonus at very high Logic Cores (above 30)
    if logic_cores > 30:
        // Each point above 30 provides extra composure bonus
        composure_bonus = (logic_cores - 30) * 0.5
        hit_chance += composure_bonus
        damage *= (1 + composure_bonus / 100)

// Examples:
// Logic Cores 1: -19.33% accuracy, -14.5% damage (minimal help, still heavy penalties)
// Logic Cores 15: -9.95% accuracy, -7.5% damage (moderate help)
// Logic Cores 30: +0% accuracy, +0% damage (no penalty, fully composed)
// Logic Cores 40: +5% accuracy, +5% damage (bonus from composure, performs better when damaged)
// Logic Cores 50: +10% accuracy, +10% damage (significant bonus, ice-cold under pressure)
```

**Design Rationale:** High Logic Cores robots not only avoid penalties but actually perform BETTER when damaged, representing AI that becomes hyper-focused and efficient in critical situations. This makes Logic Cores worth investing in beyond just penalty negation.

### Repair Cost Scaling

**Formula:**
```
base_repair = (sum_of_all_23_attributes × 100)
damage_percentage = current_damage / max_hp

if robot_destroyed (HP = 0):
    repair_cost_multiplier = 2.0
    final_repair = base_repair × damage_percentage × repair_cost_multiplier
elif robot_heavily_damaged (HP < 10%):
    repair_cost_multiplier = 1.5
    final_repair = base_repair × damage_percentage × repair_cost_multiplier
else:
    final_repair = base_repair × damage_percentage
```

**Medical Bay Facility Interaction:**

The **Medical Bay** facility (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md#5-medical-bay)) provides an **additional reduction** to the critical damage multiplier:

```
// Medical Bay reduces critical damage multiplier (0 HP only)
if robot_destroyed (HP = 0) AND medical_bay_level > 0:
    medical_bay_reduction = medical_bay_level × 0.1  // 10% per level
    effective_multiplier = 2.0 × (1 - medical_bay_reduction)
    
    // Examples:
    // Level 1: 2.0 × (1 - 0.1) = 1.8x multiplier (10% reduction)
    // Level 5: 2.0 × (1 - 0.5) = 1.0x multiplier (50% reduction, normal cost)
    // Level 10: 2.0 × (1 - 1.0) = 0.0x penalty eliminated

    final_repair = base_repair × damage_percentage × effective_multiplier
```

**Repair Bay Facility Interaction:**

The **Repair Bay** facility (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md#1-repair-bay)) provides a **discount** on ALL repair costs (applied after multipliers):

```
// Repair Bay provides discount on final repair cost
repair_bay_discount = repair_bay_level × 0.05  // 5% per level, max 50%
final_cost = final_repair × (1 - repair_bay_discount)
```

**Combined Example:**
- Robot with 230 total attributes: base_repair = ₡23,000
- Destroyed (0 HP, 100% damage)
- Medical Bay Level 5 (50% reduction on 2.0x multiplier)
- Repair Bay Level 5 (25% discount on all repairs)

```
Step 1: Base calculation
  final_repair = ₡23,000 × 1.0 × 1.0 = ₡23,000  // Medical Bay reduces 2.0x to 1.0x

Step 2: Apply Repair Bay discount
  final_cost = ₡23,000 × (1 - 0.25) = ₡17,250

Without facilities: ₡46,000
With both facilities: ₡17,250 (62.5% total savings)
```

**Example:**
- Robot with 230 total attribute points (avg 10 each)
- Base repair = 230 × 100 = ₡23,000

**Scenario 1: Destroyed (0% HP)**
- Damage = 100%
- Repair cost multiplier = 2.0x
- Final cost = ₡23,000 × 1.0 × 2.0 = **₡46,000**

**Scenario 2: Heavily Damaged (5% HP remaining)**
- Damage = 95%
- Repair cost multiplier = 1.5x
- Final cost = ₡23,000 × 0.95 × 1.5 = **₡32,775**

**Scenario 3: Yielded at 15% HP**
- Damage = 85%
- No repair cost multiplier
- Final cost = ₡23,000 × 0.85 = **₡19,550**

**Scenario 4: Victory at 40% HP**
- Damage = 60%
- No repair cost multiplier
- Final cost = ₡23,000 × 0.60 = **₡13,800**

**Strategic Implications:**
- **Aggressive players**: Set low threshold (5-10%), risk destruction
- **Conservative players**: Set high threshold (30-40%), pay less but lose more
- **Balanced players**: Adjust based on robot build and opponent

---

## Combat System: Time-Based

The system uses **time-based combat** exclusively for dynamic, engaging gameplay.

### Attack Timing

**Attack Cooldown:**
```
attack_cooldown_seconds = base_cooldown / (1 + attack_speed / 50)
base_cooldown = weapon.cooldown (typically 3-5 seconds)

Example:
- Weapon with 4 second cooldown
- Robot with Attack Speed 30
- Cooldown = 4 / (1 + 30/50) = 4 / 1.6 = 2.5 seconds
```

**Opportunity System:**
```
// Robot doesn't attack immediately when cooldown ready
// AI waits for optimal moment based on:

opportunity_score = base_opportunity

// Positioning bonus
if positioning_advantage:
    opportunity_score += threat_analysis / 10

// Enemy vulnerability
if enemy_recovering:
    opportunity_score += combat_algorithms / 15

// Defensive consideration (defensive stance)
if defensive_stance and taking_damage:
    opportunity_score -= 20

// Attack when opportunity score > threshold
attack_threshold = 50 + (adaptive_ai / 5)
if opportunity_score >= attack_threshold:
    execute_attack()
```

### Simultaneous Attacks

When attacks appear simultaneous (both robots attack within same frame), **Gyro Stabilizers** determines reaction time:

```
// Both robots attack in same 100ms window
reaction_time_robot1 = 100 - (robot1.gyro_stabilizers * 1.5)
reaction_time_robot2 = 100 - (robot2.gyro_stabilizers * 1.5)

if reaction_time_robot1 < reaction_time_robot2:
    resolve_robot1_attack_first()
else:
    resolve_robot2_attack_first()

// Example:
// Robot 1 Gyro: 30 → reaction time: 55ms
// Robot 2 Gyro: 20 → reaction time: 70ms
// Robot 1 attacks first
```

**Advantages of Time-Based Combat:**
- More dynamic and engaging
- Rewards positioning and timing
- Better utilizes AI attributes
- Allows for fluid team actions
- More realistic combat flow

---

## Combat Formulas

### Hit Chance

```
base_hit_chance = 70%

// Attacker bonuses
targeting_bonus = attacker.targeting_systems / 2
stance_bonus = (attacker.stance == offensive) ? 5% : 0%

// Defender penalties
evasion_penalty = defender.evasion_thrusters / 3
gyro_penalty = defender.gyro_stabilizers / 5

// Calculate base hit chance
calculated_hit = base_hit_chance + targeting_bonus + stance_bonus - evasion_penalty - gyro_penalty

// Add randomness: ±10% variance per attack
random_variance = random(-10, +10)
hit_chance = calculated_hit + random_variance

// Clamp to bounds
hit_chance = clamp(hit_chance, 10%, 95%)

// Roll for hit
is_hit = random(0, 100) < hit_chance
```

### Critical Hit Mechanics

**Critical rolls happen AFTER hit is confirmed:**

```
// Step 1: Check if attack hits
if not is_hit:
    return MISS

// Step 2: Check for critical (only if hit confirmed)
base_crit = 5%
crit_chance = base_crit + (attacker.critical_systems / 8) + (attacker.targeting_systems / 25)

// Loadout bonuses
if loadout == TWO_HANDED:
    crit_chance += 10%

// Calculate base crit chance
calculated_crit = crit_chance

// Add randomness: ±10% variance per attack
random_variance = random(-10, +10)
crit_chance = calculated_crit + random_variance

// Clamp to bounds
crit_chance = clamp(crit_chance, 0%, 50%)

// Roll for critical
is_critical = random(0, 100) < crit_chance
```

**Critical Impact:**
```
if is_critical:
    // Base multiplier
    crit_multiplier = 2.0
    
    // Loadout modifications
    if attacker.loadout == TWO_HANDED:
        crit_multiplier = 2.5
    
    // Defender resistance
    crit_multiplier -= (defender.damage_dampeners / 100)
    crit_multiplier = max(crit_multiplier, 1.2)  // Minimum 20% bonus
    
    final_damage *= crit_multiplier
```

### Damage Calculation

**Base Damage:**
```
// Weapon base damage
base_damage = weapon.base_damage

// Combat Power applies to ALL weapon types
combat_power_mult = 1 + (attacker.combat_power / 100)
base_damage *= combat_power_mult

// Loadout modifiers
if attacker.loadout == TWO_HANDED:
    base_damage *= 1.25
elif attacker.loadout == DUAL_WIELD:
    base_damage *= 0.90
```

**Weapon-Specific Bonuses:**
```
// Melee weapons benefit from hydraulic systems
if weapon.type == 'melee':
    melee_bonus = attacker.hydraulic_systems * 0.4
    base_damage += melee_bonus
```

**Weapon Control:**
```
control_mult = 1 + (attacker.weapon_control / 100)
modified_damage = base_damage * control_mult
```

**Penetration vs Defense:**
```
// Armor reduction with cap to prevent excessive damage mitigation
armor_reduction = defender.armor_plating * (1 - attacker.penetration / 150)
armor_reduction = min(armor_reduction, 30)  // Cap at 30 damage reduction

// Shield handling (separate pool)
if defender.current_shield > 0:
    // Energy shields take damage first, THEN HP
    shield_damage = modified_damage * 0.7  // Shields absorb at 70% effectiveness
    
    // Apply penetration to shields too
    shield_penetration = shield_damage * (1 + attacker.penetration / 200)
    
    damage_to_shield = min(shield_penetration, defender.current_shield)
    defender.current_shield -= damage_to_shield
    
    // Remaining damage "bleeds through" at reduced rate
    if shield_penetration > defender.current_shield:
        overflow = (shield_penetration - defender.current_shield) * 0.3
        damage_to_hp = max(1, overflow - armor_reduction)  // armor_reduction capped at 30
    else:
        damage_to_hp = 0
else:
    // No shield, damage goes directly to HP
    damage_to_hp = max(1, modified_damage - armor_reduction)  // armor_reduction capped at 30
```

**Armor Reduction Cap Rationale:**
- Without cap: High armor (50+) with low enemy penetration could reduce damage by 50+ points
- With cap: Maximum 30 damage reduction ensures attacks remain effective
- Maintains armor value while preventing defensive builds from being unkillable
- Encourages penetration builds as counterplay to high armor

**Critical Application:**
```
if is_critical:
    damage_to_hp *= crit_multiplier
```

**Final Damage:**
```
// Apply to defender
defender.current_hp -= damage_to_hp

// Track for repair costs
defender.damage_taken += damage_to_hp
```

### Shield Mechanics

**Nomenclature Clarity**:
- **Energy Shield**: The `currentShield` HP pool that robots have (powered by Shield Capacity attribute)
- **Shield Weapon**: Physical equipment type that robots can equip in the "weapon_shield" loadout

**Energy Shield System:**

```
max_shield = shield_capacity_attribute * 2

// Loadout bonus
if loadout == "weapon_shield":
    max_shield *= 1.20

// Power Core provides energy shield regeneration
shield_regen_per_second = power_core * 0.15

// Defensive stance bonus
if stance == DEFENSIVE:
    shield_regen_per_second *= 1.20
```

**Energy Shield vs HP:**
- Energy shields are a separate HP pool from robot HP
- **Damage Order**: Energy shields deplete FIRST, then HP takes damage
- Penetration affects both energy shields and HP (see Penetration vs Defense formula)
- Energy shields regenerate during battle (HP does NOT regenerate - robots don't heal)
- Energy shield damage doesn't directly affect repair costs (only HP damage does)
- When energy shields break, there's no penalty except vulnerability
- Energy weapons deal +20% damage vs energy shields (future enhancement)

### Counter Attack

**Counter Chance:**
```
base_counter = counter_protocols / 100

// Stance modifier
if stance == DEFENSIVE:
    base_counter *= 1.15

// Loadout modifier
if loadout == "weapon_shield":
    base_counter *= 1.10

counter_chance = clamp(base_counter, 0%, 40%)
```

**Counter Trigger:**
```
// After defender is hit (and survives)
if random(0, 100) < counter_chance:
    // Counter attack at 70% normal damage
    execute_counter_attack(damage = normal_damage * 0.7)
```

### Energy Shield Regeneration

**Power Core Regeneration:**
```
// Power Core regenerates ENERGY SHIELDS, not HP
// Robots do not heal HP during battle
shield_regen_per_second = power_core * 0.15

// Apply regeneration each second
defender.current_shield += shield_regen_per_second
defender.current_shield = min(defender.current_shield, max_shield)
```

**Note**: Robot HP does NOT regenerate during or between battles. Damage to HP persists until repaired with Credits.

---

## Effective Stat Calculation

**How Weapon Bonuses, Loadout Modifiers, Stance Modifiers, and Facility Bonuses Combine**

The effective value of each attribute is calculated by combining multiple modifier sources:

```
effective_attribute = (base_attribute + weapon_bonuses_total) × (1 + loadout_modifier% + stance_modifier% + facility_bonus%)
```

**Step-by-Step Calculation:**

1. **Base Attribute**: Robot's current attribute level (1-50)
2. **Weapon Bonuses**: Sum of bonuses from all equipped weapons (additive)
3. **Percentage Modifiers**: Loadout + Stance + Facility bonuses (additive with each other, then multiplicative with base)

**Example Calculation:**

```
Attribute: Combat Power
Base: 20
Main Weapon: Plasma Cannon (+5 Combat Power)
Offhand: None
Loadout: Two-Handed (+25%)
Stance: Offensive (+15%)
Facility: Offensive Coach Level 4 (+5%)

Step 1: Add weapon bonuses
  subtotal = 20 + 5 = 25

Step 2: Sum percentage modifiers
  total_modifier = 25% + 15% + 5% = 45%

Step 3: Apply multiplicative bonus
  effective_combat_power = 25 × (1 + 0.45) = 25 × 1.45 = 36.25 → 36 (rounded)
```

**Important Notes:**
- Weapon bonuses are **additive** (flat values added to base)
- Percentage modifiers are **additive with each other**, then **multiplicative with base**
- Facility bonuses (coaches) only apply when active
- Negative modifiers work the same way (e.g., -15% Attack Speed)

**Why This Design?**
- Ensures percentage bonuses remain meaningful at all power levels
- Prevents exponential scaling from stacking multiplicative bonuses
- Creates clear, predictable stat calculations
- Maintains balance across different builds and stages of progression

---

## Team Battle Formulas (2v2, 3v3, etc.)

**Team Coordination Bonus:**
```
// When 2+ allied robots are within range
avg_sync = average(all_allied_robots.sync_protocols)
coordination_mult = 1 + (avg_sync / 50)

damage_output *= coordination_mult
defense_rating *= (1 + avg_sync / 100)
```

**Support Buff:**
```
// Support Systems can buff adjacent allies
buff_amount = support_systems * 0.3
duration = 5 seconds

// Applied to ally's armor or damage
ally.armor_plating += buff_amount
// or
ally.combat_power += buff_amount
```

**Formation Bonus:**
```
// Formation Tactics improve when robots maintain formation
if in_formation:
    defense_bonus = formation_tactics / 10
    accuracy_bonus = formation_tactics / 15
    
    armor_plating += defense_bonus
    hit_chance += accuracy_bonus
```

---

## Weapon System

The complete weapon system includes weapon types, properties, attribute bonuses, and the initial catalog of 11 weapons across 4 categories (Energy, Ballistic, Melee, Shield, and Practice weapons).

**For complete details on:**
- Weapon types and properties (Energy, Ballistic, Melee, Shield)
- Weapon attributes and bonuses
- Complete weapon catalog with all specifications
- Weapon crafting system and requirements
- Weapon purchase discounts via Weapons Workshop
- Weapon inventory management and storage

**See: [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**

---

## HP Calculation

**Base HP from Hull Integrity:**
```
base_hp = 30 + (hull_integrity * 8)

Example:
- Hull Integrity 1: 38 HP (30 + 8)
- Hull Integrity 10: 110 HP (30 + 80)
- Hull Integrity 25: 230 HP (30 + 200)
- Hull Integrity 50: 430 HP (30 + 400)
```

**Formula Rationale:**
- Base HP of 30 ensures starting robots (hull=1) are viable with 38 HP instead of 10 HP
- Multiplier of 8 (down from 10) reduces scaling at high levels
- High-level robots (hull=50) now have 430 HP instead of 500 HP, reducing dominance
- Mid-level robots (hull=10-25) see modest increases of 10-20 HP

**Recommended HP Progression:**
- New robot (all attributes at 1): 38 HP (was 10 HP)
- After first ₡350K upgrades: ~110-150 HP
- Mid-game robot: 200-300 HP
- End-game robot: 400-500 HP (reduced from 600 HP cap)

**Energy Shield HP (separate pool):**
```
base_shield = shield_capacity * 2

Example:
- Shield Capacity 1: 2 energy shield HP
- Shield Capacity 20: 40 energy shield HP
- Shield Capacity 40: 80 energy shield HP
```

---

## Strategy Implications

### Build Archetypes

**Tank Build** - Weapon + Shield loadout
- High: Hull Integrity, Armor Plating, Shield Capacity
- Medium: Counter Protocols, Hydraulic Systems
- Low: Attack Speed, Servo Motors
- Equipment: Combat Shield + Power Sword or Hammer
- Stance: Defensive
- Strategy: Absorb damage, counter attack, outlast opponent

**Glass Cannon** - Two-Handed loadout
- High: Combat Power, Critical Systems, Penetration
- Medium: Targeting Systems, Weapon Control
- Low: Hull Integrity, Armor Plating
- Equipment: Plasma Cannon or Railgun (two-handed)
- Stance: Offensive
- Strategy: Eliminate opponent before taking damage

**Speed Demon** - Dual-Wield loadout
- High: Attack Speed, Servo Motors, Gyro Stabilizers
- Medium: Weapon Control, Combat Power
- Low: Hull Integrity, Armor Plating
- Equipment: Dual Machine Guns or Dual Plasma Blades
- Stance: Offensive
- Strategy: Multiple fast attacks, overwhelm with DPS

**Counter Striker** - Weapon + Shield loadout
- High: Counter Protocols, Armor Plating, Logic Cores
- Medium: All combat stats
- Equipment: Combat Shield + Power Sword
- Stance: Defensive
- Strategy: Tank damage, punish with counters

**Melee Specialist** - Two-Handed or Single melee
- High: Hydraulic Systems, Servo Motors, Gyro Stabilizers
- Medium: Hull Integrity, Combat Power
- Equipment: Hammer (two-handed) or Power Sword (single)
- Stance: Offensive
- Strategy: Close distance quickly, devastating melee strikes

**Sniper** - Two-Handed ranged
- High: Targeting Systems, Penetration, Critical Systems
- Medium: Combat Power, Weapon Control
- Equipment: Railgun (two-handed)
- Stance: Balanced
- Strategy: High-accuracy shots, armor penetration

**Tactical AI** - Any loadout
- High: Combat Algorithms, Threat Analysis, Adaptive AI
- Moderate: All combat stats
- Equipment: Versatile weapons
- Stance: Balanced
- Strategy: Optimal decision-making, adapt to opponent

---

## See Also

- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)** - Complete weapon system, loadout configurations, and weapon catalog
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Authoritative source for all database models, fields, and relationships
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)** - Facility upgrades, prestige system, and stable management
- **[PRD_BATTLE_STANCES_AND_YIELD.md](PRD_BATTLE_STANCES_AND_YIELD.md)** - Product requirements for battle stance and yield threshold implementation
- **[PRD_WEAPON_LOADOUT.md](PRD_WEAPON_LOADOUT.md)** - Product requirements for weapon loadout system implementation
- **[ROADMAP.md](ROADMAP.md)** - Implementation phases, priorities, and future enhancements

---

**This robot attribute system provides:**
- ✅ 23 weapon-neutral core attributes with clear mechanical effects
- ✅ Melee vs ranged differentiation through weapons and Hydraulic Systems
- ✅ 4 loadout configurations with percentage-based bonuses
- ✅ 3 stance settings affecting combat behavior
- ✅ Time-based combat system (turn-based removed)
- ✅ Yield threshold with repair cost scaling
- ✅ Critical hit mechanics with randomness
- ✅ Energy shields as separate HP pool (regenerating, NOT HP)
- ✅ Clear nomenclature (Energy Shield vs Shield weapon)
- ✅ Complete formula specifications with AI integration
- ✅ Strategic depth with multiple viable builds
- ✅ References DATABASE_SCHEMA.md as authoritative source
