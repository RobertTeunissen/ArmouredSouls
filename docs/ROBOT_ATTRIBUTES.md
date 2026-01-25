# Robot Attributes System

**Last Updated**: January 25, 2026  
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

1. **Combat Power** - Base damage multiplier for all weapon types
2. **Targeting Systems** - Hit chance and precision for all attacks
3. **Critical Systems** - Chance to deal critical damage with any weapon
4. **Penetration** - Bypasses armor and shields for all attack types
5. **Weapon Control** - Handling and effectiveness with equipped weapons
6. **Attack Speed** - Time between attacks for all weapon types

**Design Notes:**
- All attributes are weapon-neutral - apply to both melee and ranged
- Combat Power affects base damage regardless of weapon type
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
- **Current Shield**: Energy shield HP remaining (max determined by Shield Capacity)
  - Energy shields DO regenerate during battle (powered by Power Core)
  - Energy shields reset to max after battle ends
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

These are player-controlled settings, **NOT upgradeable attributes**. They can be changed between battles but not during battle.

### Yield Threshold
- Range: 0% to 50%
- Default: 10%
- HP percentage where robot attempts to surrender

### Loadout
- Options: "weapon_shield", "two_handed", "dual_wield", "single"
- Determines how weapons/shields are equipped
- See Loadout System section below

### Stance
- Options: "offensive", "defensive", "balanced"
- Affects combat behavior and stat modifiers
- See Battle Stance section below

**Note**: These settings are stored in the database but are NOT attributes that can be upgraded with Credits.

---

## Loadout System

Robots are bipedal humanoids with two arms. Loadout determines how weapons/shields are equipped.

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

### Loadout Configurations

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
- Some weapons are locked to specific loadouts:
  - "Two-handed" tag: Requires Two-Handed loadout
  - "Shield-compatible": Works with Weapon + Shield
  - "Dual-wield compatible": Works with Dual-Wield (need 2 copies)

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

Logic Cores improves decision-making under low HP conditions using a **linear approach**:

```
// When HP drops below 30%
if current_hp < (max_hp * 0.30):
    // Base penalties when damaged
    base_accuracy_penalty = 20
    base_damage_penalty = 15
    
    // Logic Cores linearly reduces penalties
    accuracy_penalty = max(0, base_accuracy_penalty - (logic_cores * 0.67))
    damage_penalty = max(0, base_damage_penalty - (logic_cores * 0.5))
    
    hit_chance -= accuracy_penalty
    damage *= (1 - damage_penalty / 100)

// Examples:
// Logic Cores 1: -19.33% accuracy, -14.5% damage (minimal help)
// Logic Cores 15: -9.95% accuracy, -7.5% damage (moderate help)
// Logic Cores 30: +0% accuracy, +0% damage (no penalty, fully composed)
// Logic Cores 50: +0% accuracy, +0% damage (no penalty, capped at zero)
```

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
// Armor reduction
armor_reduction = defender.armor_plating * (1 - attacker.penetration / 150)

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
        damage_to_hp = max(1, overflow - armor_reduction)
    else:
        damage_to_hp = 0
else:
    // No shield, damage goes directly to HP
    damage_to_hp = max(1, modified_damage - armor_reduction)
```

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
if loadout == WEAPON_AND_SHIELD:
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
if loadout == WEAPON_AND_SHIELD:
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

### Weapon Types & Properties

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

**Note**: Advanced range mechanics (short/medium/long range bands) are planned for future releases. See ROADMAP.md for details. Currently, the system uses melee vs ranged distinction only.

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

**Complete weapon attribute bonus list** (all must match Robot attribute names in DATABASE_SCHEMA.md):
- combatPowerBonus
- targetingSystemsBonus
- criticalSystemsBonus
- penetrationBonus
- weaponControlBonus
- attackSpeedBonus
- armorPlatingBonus
- shieldCapacityBonus
- evasionThrustersBonus
- damageDampenersBonus
- counterProtocolsBonus
- hullIntegrityBonus
- servoMotorsBonus
- gyroStabilizersBonus
- hydraulicSystemsBonus
- powerCoreBonus
- combatAlgorithmsBonus
- threatAnalysisBonus
- adaptiveAIBonus
- logicCoresBonus

All bonuses default to 0 and can be positive or negative for trade-offs.

### Sample Weapons

#### Energy Weapons

**Laser Rifle** (₡150,000) - One-handed
- Base Damage: 20
- Cooldown: 3 seconds
- Attribute Bonuses:
  - targetingSystemsBonus: +3
  - weaponControlBonus: +4
  - attackSpeedBonus: +2
- Special: +15% accuracy bonus

**Plasma Cannon** (₡300,000) - Two-handed
- Base Damage: 40
- Cooldown: 5 seconds
- Attribute Bonuses:
  - combatPowerBonus: +5
  - criticalSystemsBonus: +4
  - powerCoreBonus: -3 (energy drain)
- Special: +20% vs energy shields

**Ion Beam** (₡400,000) - Two-handed
- Base Damage: 30
- Cooldown: 4 seconds
- Attribute Bonuses:
  - penetrationBonus: +8
  - shieldCapacityBonus: +4
  - attackSpeedBonus: +3
- Special: Disables enemy energy shields for 2 seconds on crit

#### Ballistic Weapons

**Machine Gun** (₡100,000) - One-handed, Dual-wield compatible
- Base Damage: 12
- Cooldown: 2 seconds
- Attribute Bonuses:
  - combatPowerBonus: +2
  - attackSpeedBonus: +6
  - weaponControlBonus: +3
- Special: Can fire burst (3 shots at 40% damage each)

**Railgun** (₡350,000) - Two-handed
- Base Damage: 50
- Cooldown: 6 seconds
- Attribute Bonuses:
  - penetrationBonus: +12
  - targetingSystemsBonus: +5
  - attackSpeedBonus: -3
- Special: Ignores 50% of armor

**Shotgun** (₡120,000) - Two-handed
- Base Damage: 35
- Cooldown: 4 seconds
- Attribute Bonuses:
  - combatPowerBonus: +4
  - criticalSystemsBonus: +5
  - targetingSystemsBonus: -3
- Special: +30% damage at close range

#### Melee Weapons

**Power Sword** (₡180,000) - One-handed
- Base Damage: 28
- Cooldown: 3 seconds
- Attribute Bonuses:
  - hydraulicSystemsBonus: +6
  - counterProtocolsBonus: +5
  - gyroStabilizersBonus: +3
- Special: +25% counter damage

**Hammer** (₡200,000) - Two-handed
- Base Damage: 42
- Cooldown: 5 seconds
- Attribute Bonuses:
  - hydraulicSystemsBonus: +8
  - combatPowerBonus: +6
  - servoMotorsBonus: -2
- Special: High impact force

**Plasma Blade** (₡250,000) - One-handed, Dual-wield compatible
- Base Damage: 24
- Cooldown: 2.5 seconds
- Attribute Bonuses:
  - hydraulicSystemsBonus: +4
  - attackSpeedBonus: +5
  - criticalSystemsBonus: +3
- Special: Burns through energy shields (70% effective vs shields)

#### Shield Weapons

**Combat Shield** (₡100,000) - Shield type
- Base Damage: 0 (defensive only)
- Cooldown: N/A
- Attribute Bonuses:
  - armorPlatingBonus: +8
  - counterProtocolsBonus: +6
  - evasionThrustersBonus: -2
  - shieldCapacityBonus: +5 (boosts energy shield capacity)
- Special: 25% chance to block ranged attacks

**Energy Barrier** (₡200,000) - Shield type
- Base Damage: 0 (defensive only)
- Cooldown: N/A
- Attribute Bonuses:
  - shieldCapacityBonus: +10 (boosts energy shield capacity)
  - powerCoreBonus: +4
  - servoMotorsBonus: -3
- Special: Reflects 20% of energy weapon damage

### Weapon Crafting System

**Design Costs:**
- Base weapon template: ₡500,000
- Stat customization: ₡50,000 per attribute point
- Special properties: ₡200,000 per property

**Requirements:**
- Unlock Weapons Workshop Level 3 (stable upgrade)
- Have 10+ battles with similar weapon types
- Minimum 5,000 prestige

**Customization Options:**
- Choose base damage (within range)
- Choose cooldown (within range)
- Allocate bonus attribute points (limited budget)
- Select one special property from list

---

## HP Calculation

**Base HP from Hull Integrity:**
```
base_hp = hull_integrity * 10

Example:
- Hull Integrity 1: 10 HP
- Hull Integrity 10: 100 HP
- Hull Integrity 25: 250 HP
- Hull Integrity 50: 500 HP
```

**Recommended HP Progression:**
- New robot (all attributes at 1): 10 HP
- After first ₡350K upgrades: ~100-150 HP
- Mid-game robot: 200-300 HP
- End-game robot: 400-600 HP

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

- **DATABASE_SCHEMA.md** - Authoritative source for all database models, fields, and relationships
- **STABLE_SYSTEM.md** - Facility upgrades, prestige system, and stable management
- **ROADMAP.md** - Implementation phases, priorities, and future enhancements

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
