# Robot Attributes System

**Last Updated**: January 25, 2026  
**Status**: Revised - Complete Combat System with Loadouts and Time-Based Mechanics

## Overview

Armoured Souls uses a comprehensive attribute system with **23 core attributes** plus additional robot state tracking. All attributes are robot-themed and have specific effects in combat. The system supports weapon-type specialization (melee vs ranged), loadout configurations (shield, two-handed, dual-wield), battle stances, and can operate with either turn-based or real-time combat.

---

## Currency System

**Currency Name**: **Credits** (₡)

- **Starting Balance**: ₡1,000,000
- **Robot Frame Cost**: ₡500,000 (bare metal, all attributes at 1)
- **Upgrade Formula**: `(current_level + 1) × 1,000` Credits
  - Level 1→2: ₡2,000
  - Level 2→3: ₡3,000
  - Level 49→50: ₡50,000

---

## Core Attributes (23 Total)

All robots start with each attribute at level 1. Players spend Credits to upgrade attributes.

### 🔴 Combat Systems (6)

**Offensive and defensive combat capabilities (weapon-neutral)**

1. **Combat Power** - Base damage multiplier for all weapon types (replaces "Firepower")
2. **Targeting Systems** - Hit chance and precision for all attacks (replaces "Targeting Computer")
3. **Critical Systems** - Chance to deal critical damage with any weapon (replaces "Critical Circuits")
4. **Penetration** - Bypasses armor and shields for all attack types (replaces "Armor Piercing")
5. **Weapon Control** - Handling and effectiveness with equipped weapons (replaces "Weapon Stability")
6. **Attack Speed** - Time between attacks for all weapon types (replaces "Firing Rate")

--> Old names are not relevant. Make sure they are updated to the current names everywhere. In all documentation, in all files. 

**Design Notes:**
- All attributes weapon-neutral - apply to both melee and ranged
- "Combat Power" affects base damage regardless of weapon type
- "Targeting Systems" helps both ranged accuracy and melee precision
- Specialization comes from weapon choice and loadout, not attributes

### 🔵 Defensive Systems (5)

**Armor, shields, and damage mitigation**

7. **Armor Plating** - Physical damage reduction from all sources
8. **Shield Capacity** - Energy shield HP pool (separate from robot HP)
9. **Evasion Thrusters** - Chance to dodge incoming attacks
10. **Damage Dampeners** - Reduces critical hit damage taken
11. **Counter Protocols** - Chance to strike back when hit (works with stance setting)

### 🟢 Chassis & Mobility (5)

**Core mechanical structure and movement capabilities**

12. **Hull Integrity** - Maximum health points (structural HP)
13. **Servo Motors** - Movement speed and positioning
14. **Gyro Stabilizers** - Balance, dodging ability, and reaction time
15. **Hydraulic Systems** - Physical force for melee impact and carry capacity
16. **Power Core** - Energy generation for shields and sustained combat

### 🟡 AI Processing (4)

**Autonomous intelligence and combat decision-making**

17. **Combat Algorithms** - Battle strategy and decision quality
18. **Threat Analysis** - Target priority and positioning
19. **Adaptive AI** - Learns opponent patterns and adapts tactics
20. **Logic Cores** - Performance under pressure and yield threshold management

### 🟣 Team Coordination (3)

**Attributes for multi-robot arena battles (2v2, 3v3, etc.)**

21. **Sync Protocols** - Coordination with allied robots
22. **Support Systems** - Ability to assist/buff teammates
23. **Formation Tactics** - Positioning within team formations

---

## Robot State Attributes

These are tracked per robot but not upgraded directly:

### Combat State
- **Current HP**: Health remaining (max determined by Hull Integrity)
- **Current Shield**: Shield HP remaining (max determined by Shield Capacity)
- **Damage Taken**: Total damage in current/last battle
- **Status Effects**: Stunned, slowed, buffed, etc.

--> We haven't defined anything for status effects yet. Stunning / slowing / buffs have not been defined. Remove here and put it on an ideas list on ROADMAP.md 

### Robot Identity
- **Name**: Player-chosen robot name (max 50 characters)
- **Frame ID**: Robot chassis/appearance identifier
- **Paint Job**: Cosmetic customization (unlocked via prestige)

### Performance Tracking
- **ELO Rating**: Individual robot skill rating (starting 1200)
- **Total Battles**: Lifetime battle count
- **Wins**: Victory count
- **Losses**: Defeat count
- **Win Rate**: Calculated from wins/losses
- **Damage Dealt**: Total lifetime damage 
- **Damage Taken**: Total lifetime damage received 
- **Kills**: Opponents reduced to 0 HP (total loss)
- **Assists**: Team battle assists

--> Do we need to capture match history / results on a robot level?

### Economic State
- **Repair Cost**: Current cost to fully repair (based on damage + attribute total)
- **Battle Readiness**: Percentage (100% = full HP, 0% = critically damaged)
- **Yield Threshold**: Player-set HP % where robot surrenders (default 10%)
- **Total Repairs Paid**: Lifetime repair costs

### League & Fame
- **Current League**: Bronze/Silver/Gold/Platinum/Diamond/Champion
- **League Points**: Points in current league (for promotion/demotion)
- **Fame**: Individual robot reputation (earned from victories)
- **Titles**: Earned achievements (e.g., "Champion", "Undefeated")

--> While the names of the leagues are fine for now, we need to capture an ID as well since in the future there might be multiple Bronze leagues

---

## Loadout System

Robots are bipedal humanoids with two arms. Loadout determines how weapons/shields are equipped.

### Loadout Configurations

**1. Weapon + Shield**
- **Equipment**: One weapon (left or right hand) + Shield (other hand)
- **Bonuses**:
  - +20% to Shield Capacity
  - +15% to Armor Plating
  - +10% to Counter Protocols (shield can block and counter)
- **Penalties**:
  - -15% to Attack Speed (shield weight)
  - Cannot use two-handed weapons
- **Best For**: Tank builds, defensive strategies

--> I'm not sure about the percentages. This sounds exploitable. Why not a +x to certain attributes? Explain your theory to me why this would be better. Don't just take everything I say for granted but bring arguments.

**2. Two-Handed Weapon**
- **Equipment**: One two-handed weapon (both hands)
- **Bonuses**:
  - +25% to Combat Power
  - +20% to Critical Systems
  - +1.5x critical damage multiplier (instead of 2.0x)
- **Penalties**:
  - -10% to Evasion Thrusters (less mobility)
  - No shield available
- **Best For**: Glass cannon builds, high burst damage

--> Same here, explain your reasoning

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

--> Same here, explain your reasoning

**4. Single Weapon (No Shield)**
- **Equipment**: One weapon (left or right hand), other hand free
- **Bonuses**:
  - +10% to all attributes (balanced stance)
  - +15% to Gyro Stabilizers
  - No penalties
- **Penalties**:
  - No specific bonuses like other loadouts
- **Best For**: Balanced builds, flexible strategies

--> Same here, explain your reasoning

### Loadout Implementation

- Players choose loadout before battle (saved in robot configuration)
- Loadout can be changed between battles (not during)
- Some weapons are locked to specific loadouts:
  - "Two-handed" tag: Requires Two-Handed loadout
  - "Shield-compatible": Works with Weapon + Shield
  - "Dual-wield": Works with Dual-Wield (need 2 copies)
 
--> This is available from the start, robots can be upgraded to be specialised in a category.

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
  - Less likely to yield early
 
--> Again, why percentages?
--> When to yield is programmed by the user, based on a percentage of HP left. Not part of the stances, but seperate.
--> Both the (current) stance and the yield percentage are changeable, but not upgradeable robot attributes. This should be reflected in the database design.

**2. Defensive Stance**
- **Behavior**: Prioritize survival, cautious positioning
- **Effects**:
  - +15% to Armor Plating
  - +15% to Counter Protocols
  - +20% to shield regeneration (if equipped)
  - -10% to Combat Power
  - -10% to Attack Speed
  - Robot focuses on blocking and countering
  - More likely to yield when HP low
 
--> Again, why percentages?

**3. Balanced Stance**
- **Behavior**: Adaptive based on situation
- **Effects**:
  - No stat modifiers
  - Robot uses Combat Algorithms to decide when to attack/defend
  - Yield based on exact threshold setting
 
### Stance & AI Interaction

- **Combat Algorithms** determines how well the robot executes its stance
- **Threat Analysis** helps identify best attack/defense opportunities
- **Adaptive AI** adjusts stance effectiveness based on opponent behavior
- **Logic Cores** manages stance under low HP conditions

--> How does this impact the battle? I need this to be reflected in the formula's then.

---

## Yield Threshold System

Players set a **Yield Threshold** (% of max HP) where their robot surrenders.

### How It Works

**Yield Threshold Setting:**
- Range: 0% to 50%
- Default: 10%
- Configurable per robot before each battle

--> There might be cases when a robot is on 12% of his HP and then gets hit by a massive blow which reduces it to 0 HP (or below), resulting in a total loss / kill / lost match. 

**Yield Behavior:**
- When robot HP drops below threshold, robot attempts to surrender
- Surrender is not instant - opponent can land one more attack
- If surrendered successfully:
  - Battle ends (opponent wins)
  - Reduced repair costs (see below)
- If robot is destroyed (0% HP) before yielding:
  - Full repair costs apply

**Logic Cores Integration:**
- **High Logic Cores** (30+): Robot makes smarter yield decisions
  - May fight longer if winning
  - Yields earlier if hopelessly outmatched
  - Factors in shield status, opponent HP
- **Low Logic Cores** (<15): Robot follows threshold rigidly
  - Always yields at exact threshold
  - No adaptive decision-making
 
--> How is this relfected in the formula's? I'd rather see a linear approach, not a threshold for 30+ or 15+. 

### Repair Cost Scaling

**Formula:**
```
base_repair = (sum_of_all_23_attributes × 100)
damage_multiplier = current_damage_percentage

if robot_destroyed (HP = 0):
    critical_multiplier = 2.5
    final_repair = base_repair × damage_multiplier × critical_multiplier
elif robot_yielded (HP > 0):
    final_repair = base_repair × damage_multiplier
else:
    final_repair = base_repair × damage_multiplier
```

**Example:**
- Robot with 230 total attribute points (avg 10 each)
- Base repair = 230 × 100 = ₡23,000

**Scenario 1: Destroyed (0% HP)**
- Damage = 100%
- Critical multiplier = 2.5x
- Final cost = ₡23,000 × 1.0 × 2.5 = **₡57,500**

**Scenario 2: Yielded at 15% HP**
- Damage = 85%
- No critical multiplier
- Final cost = ₡23,000 × 0.85 = **₡19,550**

**Scenario 3: Victory at 40% HP**
- Damage = 60%
- No critical multiplier
- Final cost = ₡23,000 × 0.60 = **₡13,800**

--> Set the critical multiplier for 100% damage at 2x, >90% damage at 1.5x
--> Change name as to repair_cost_multiplier or something similar as a critical can also refer to damage dealt.

**Strategic Implications:**
- **Aggressive players**: Set low threshold (5-10%), risk high repair costs
- **Conservative players**: Set high threshold (30-40%), pay less but lose more
- **Balanced players**: Adjust based on robot build and opponent

---

## Combat System: Time-Based vs Turn-Based

The system is designed to support both modes. **Recommended: Time-Based** for more dynamic gameplay.

--> No. We're not going to do both. Only Time-Based. Remove sections about turn-based. Make sure ALL you read through all docs and change anything that refers to turn based.

### Time-Based Combat (Recommended)

**Attack Timing:**
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

**Advantages:**
- More dynamic and engaging
- Rewards positioning and timing
- Better utilizes AI attributes
- Allows for simultaneous team actions
- More realistic combat flow

**Implementation Complexity:**
- Medium (requires game clock and event scheduling)
- Need to handle simultaneous attacks
- Animation/visual feedback more complex

--> When attacks seem to be simulateous, use an attribute to determine who goes first (e.g. Gyro Stabilizers for reaction time)

### Turn-Based Combat (Simpler Alternative)

**Initiative Order:**
```
initiative = servo_motors + (gyro_stabilizers / 2) + random(0, 10)
// Robots attack in initiative order each turn
```

**Attacks Per Turn:**
```
base_attacks = 1
bonus_attacks = floor(attack_speed / 30)
total_attacks = base_attacks + bonus_attacks
```

**Advantages:**
- Simpler to implement
- Easier to understand
- Clear action sequence
- Better for initial prototype

**Disadvantages:**
- Less dynamic
- Harder to show positioning/timing benefits
- Team battles feel less fluid

### Recommendation

**Phase 1 Prototype**: Start with turn-based for simplicity
**Phase 2+**: Migrate to time-based for better gameplay

--> No, remove turn based. Changing the flow makes things more complex.

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

hit_chance = base_hit_chance + targeting_bonus + stance_bonus - evasion_penalty - gyro_penalty
hit_chance = clamp(hit_chance, 10%, 95%)
```

--> I want some randomness in here. Start with -10/+10% random number for each attack. Keep min and max hit chances the same.

### Critical Hit Mechanics

**Critical rolls happen AFTER hit is confirmed:**
```
// Step 1: Check if attack hits
if random() > hit_chance:
    return MISS

// Step 2: Check for critical (only if hit confirmed)
base_crit = 5%
crit_chance = base_crit + (attacker.critical_systems / 8) + (attacker.targeting_systems / 25)

// Loadout bonuses
if loadout == TWO_HANDED:
    crit_chance += 10%

crit_chance = clamp(crit_chance, 0%, 50%)

is_critical = random() < crit_chance
```

--> I want some randomness in here. Start with -10/+10% random number for each attack. Keep min and max crit chances the same.

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
    
    // Melee also benefits from close positioning
    if close_range:
        base_damage *= 1.15

// Ranged weapons benefit from positioning
if weapon.type in ['ballistic', 'energy', 'explosive']:
    if optimal_range:
        base_damage *= 1.10
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
    // Shields take damage first
    shield_damage = modified_damage * 0.7  // Shields absorb 70% effectiveness
    
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
    // No shield, damage goes to HP
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

**Shield Capacity:**
```
max_shield = shield_capacity_attribute * 2

// Loadout bonus
if loadout == WEAPON_AND_SHIELD:
    max_shield *= 1.20

// Power Core provides shield regeneration
shield_regen_per_second = power_core * 0.15

// Defensive stance bonus
if stance == DEFENSIVE:
    shield_regen_per_second *= 1.20
```

**Shield vs HP:**
- Shields are a separate HP pool
- Shields regenerate during battle (HP does not)
- Shield damage doesn't affect repair costs
- When shields break, there's no penalty except vulnerability
- Energy weapons may be more effective vs shields (future enhancement)

--> Explain how shields vs HP work. Shield depleted first, then HP? Or both? What about penetration?

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
if random() < counter_chance:
    // Counter attack at 70% normal damage
    execute_counter_attack(damage = normal_damage * 0.7)
```

### HP Regeneration

**Power Core Regeneration:**
```
// Regenerates HP, not shields (shields have own regen)
hp_regen_per_second = power_core * 0.15

// Only regenerates if not at critical HP
if current_hp > (max_hp * 0.20):
    current_hp += hp_regen_per_second
    current_hp = min(current_hp, max_hp)
```

--> Power Core regenerated both the shields as well as the HP? We decided not to let HP regenerate (does not sounds like something a robot would do)

### AI Decision Quality

**Combat Algorithms:**
```
decision_quality = combat_algorithms / 10

// Affects:
// - Target selection in multi-target scenarios
// - Ability timing
// - When to use special attacks
// - Resource management (energy/shields)

if decision_quality >= 5:
    // Good decisions - prioritize low HP targets
    // Use abilities at optimal times
elif decision_quality >= 3:
    // Average decisions - sometimes suboptimal
elif decision_quality < 3:
    // Poor decisions - often attacks wrong target
```

**Threat Analysis:**
```
positioning_bonus = threat_analysis / 20

// Applies to:
hit_chance += positioning_bonus
damage *= (1 + positioning_bonus / 100)
evasion += positioning_bonus

// Robot positions optimally based on this stat
```

**Adaptive AI:**
```
// After turn 3 (or 5 seconds in time-based)
learning_bonus = adaptive_ai / 15

// Applies to:
hit_chance += learning_bonus
damage_reduction += learning_bonus / 2
critical_chance += learning_bonus / 3

// Robot "learns" opponent patterns
```

**Logic Cores (Low HP Performance):**
```
if current_hp < (max_hp * 0.30):
    // Base penalties when damaged
    base_accuracy_penalty = 20
    base_damage_penalty = 15
    
    // Logic Cores reduce penalties
    accuracy_penalty = max(0, base_accuracy_penalty - logic_cores)
    damage_penalty = max(0, base_damage_penalty - logic_cores)
    
    hit_chance -= accuracy_penalty
    damage *= (1 - damage_penalty / 100)
    
// Also affects yield decisions (see Yield Threshold section)
```

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
duration = 5 seconds (or 2 turns)

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
- **Damage Type**: Energy (more effective vs shields)
- **Range**: Medium-Long
- **Characteristics**: Precise, consistent damage
- **Examples**: Laser Rifle, Plasma Cannon, Ion Beam

**Ballistic Weapons:**
- **Damage Type**: Kinetic (standard vs armor)
- **Range**: Short-Long
- **Characteristics**: Variable damage, high penetration
- **Examples**: Machine Gun, Railgun, Shotgun

**Melee Weapons:**
- **Damage Type**: Impact (benefits from hydraulic systems)
- **Range**: Close
- **Characteristics**: High burst damage, positioning-dependent
- **Examples**: Power Sword, Hammer, Plasma Blade

**Explosive Weapons:**
- **Damage Type**: Blast (area effect in team battles)
- **Range**: Medium
- **Characteristics**: High damage, slow reload, can hit multiple targets
- **Examples**: Rocket Launcher, Grenade Launcher

--> Wait. You're not introducing ranges. We've only talked about melee and ranged so far. This massively increased complexity in the battles. This should go on the ROADMAP.md as an idea and being removed here. 

### Weapon Attributes

Each weapon has:
1. **Base Damage** - Raw damage value
2. **Cooldown** - Time between attacks (for time-based) or attacks per turn
3. **Cost** - Credits to purchase
4. **Type** - Energy/Ballistic/Melee/Explosive
5. **Hands Required** - One-handed, Two-handed, or Dual-wield compatible
6. **Attribute Bonuses** - Enhances specific robot attributes
7. **Special Properties** - Unique effects

### Sample Weapons

#### Energy Weapons

**Laser Rifle** (₡150,000) - One-handed
- Base Damage: 20
- Cooldown: 3 seconds
- Attribute Bonuses:
  - Targeting Systems: +3
  - Weapon Control: +4
  - Attack Speed: +2
- Special: +15% accuracy bonus

**Plasma Cannon** (₡300,000) - Two-handed
- Base Damage: 40
- Cooldown: 5 seconds
- Attribute Bonuses:
  - Combat Power: +5
  - Critical Systems: +4
  - Power Core: -3 (energy drain)
- Special: +20% vs shields

**Ion Beam** (₡400,000) - Two-handed
- Base Damage: 30
- Cooldown: 4 seconds
- Attribute Bonuses:
  - Penetration: +8
  - Shield Capacity: +4
  - Attack Speed: +3
- Special: Disables enemy shields for 2 seconds on crit

#### Ballistic Weapons

**Machine Gun** (₡100,000) - One-handed, Dual-wield compatible
- Base Damage: 12
- Cooldown: 2 seconds
- Attribute Bonuses:
  - Combat Power: +2
  - Attack Speed: +6
  - Weapon Control: +3
- Special: Can fire burst (3 shots at 40% damage each)

**Railgun** (₡350,000) - Two-handed
- Base Damage: 50
- Cooldown: 6 seconds
- Attribute Bonuses:
  - Penetration: +12
  - Targeting Systems: +5
  - Attack Speed: -3
- Special: Ignores 50% of armor

**Shotgun** (₡120,000) - Two-handed
- Base Damage: 35
- Cooldown: 4 seconds
- Attribute Bonuses:
  - Combat Power: +4
  - Critical Systems: +5
  - Targeting Systems: -3
- Special: +30% damage at close range

#### Melee Weapons

**Power Sword** (₡180,000) - One-handed
- Base Damage: 28
- Cooldown: 3 seconds
- Attribute Bonuses:
  - Hydraulic Systems: +6
  - Counter Protocols: +5
  - Gyro Stabilizers: +3
- Special: +25% counter damage

**Hammer** (₡200,000) - Two-handed
- Base Damage: 42
- Cooldown: 5 seconds
- Attribute Bonuses:
  - Hydraulic Systems: +8
  - Combat Power: +6
  - Servo Motors: -2
- Special: 30% chance to stun for 1 second

**Plasma Blade** (₡250,000) - One-handed, Dual-wield compatible
- Base Damage: 24
- Cooldown: 2.5 seconds
- Attribute Bonuses:
  - Hydraulic Systems: +4
  - Attack Speed: +5
  - Critical Systems: +3
- Special: Burns through shields (70% effective vs shields)

#### Explosive Weapons

**Rocket Launcher** (₡320,000) - Two-handed
- Base Damage: 55
- Cooldown: 7 seconds
- Attribute Bonuses:
  - Combat Power: +7
  - Critical Systems: +6
  - Attack Speed: -4
- Special: Hits all enemies in 3m radius (team battles)

**Grenade Launcher** (₡250,000) - Two-handed
- Base Damage: 38
- Cooldown: 5 seconds
- Attribute Bonuses:
  - Combat Power: +5
  - Threat Analysis: +4
  - Attack Speed: -2
- Special: Creates smoke cloud reducing enemy accuracy

#### Shields

**Combat Shield** (₡100,000)
- Shield Bonus: +100 max shield
- Attribute Bonuses:
  - Armor Plating: +8
  - Counter Protocols: +6
  - Evasion Thrusters: -2
- Special: Can block projectiles (25% chance to negate ranged attack)

**Energy Barrier** (₡200,000)
- Shield Bonus: +150 max shield
- Attribute Bonuses:
  - Shield Capacity: +10
  - Power Core: +4
  - Servo Motors: -3
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

**Recommended Starting HP:**
- New robot (all attributes at 1): 10 HP
- After first ₡350K upgrades: ~100-150 HP
- Mid-game robot: 200-300 HP
- End-game robot: 400-600 HP

**Shield HP (separate pool):**
```
base_shield = shield_capacity * 2

Example:
- Shield Capacity 1: 2 shield HP
- Shield Capacity 20: 40 shield HP
- Shield Capacity 40: 80 shield HP
```

---

## Strategy Implications

### Build Archetypes (Updated)

**Tank Build** - Weapon + Shield loadout
- High: Hull Integrity, Armor Plating, Shield Capacity
- Medium: Counter Protocols, Hydraulic Systems
- Low: Attack Speed, Servo Motors
- Weapon: Combat Shield + Power Sword or Hammer
- Stance: Defensive
- Strategy: Absorb damage, counter attack, outlast opponent

**Glass Cannon** - Two-Handed loadout
- High: Combat Power, Critical Systems, Penetration
- Medium: Targeting Systems, Weapon Control
- Low: Hull Integrity, Armor Plating
- Weapon: Plasma Cannon or Railgun (two-handed)
- Stance: Offensive
- Strategy: Eliminate opponent before taking damage

**Speed Demon** - Dual-Wield loadout
- High: Attack Speed, Servo Motors, Gyro Stabilizers
- Medium: Weapon Control, Combat Power
- Low: Hull Integrity, Armor Plating
- Weapons: Dual Machine Guns or Dual Plasma Blades
- Stance: Offensive
- Strategy: Multiple fast attacks, overwhelm with DPS

**Counter Striker** - Weapon + Shield loadout
- High: Counter Protocols, Armor Plating, Logic Cores
- Medium: All combat stats
- Weapon: Combat Shield + Power Sword
- Stance: Defensive
- Strategy: Tank damage, punish with counters

**Melee Specialist** - Two-Handed or Single melee
- High: Hydraulic Systems, Servo Motors, Gyro Stabilizers
- Medium: Hull Integrity, Combat Power
- Weapon: Hammer (two-handed) or Power Sword (single)
- Stance: Offensive
- Strategy: Close distance quickly, devastating melee strikes

**Sniper** - Two-Handed ranged
- High: Targeting Systems, Penetration, Critical Systems
- Medium: Combat Power, Weapon Control
- Weapon: Railgun (two-handed)
- Stance: Balanced
- Strategy: High-accuracy shots, armor penetration

**Tactical AI** - Any loadout
- High: Combat Algorithms, Threat Analysis, Adaptive AI
- Moderate: All combat stats
- Weapon: Versatile weapons
- Stance: Balanced
- Strategy: Optimal decision-making, adapt to opponent

---

## Implementation Priority

**Phase 1 (Prototype):**
1. Core 23 attributes
2. Robot state tracking (HP, shield, damage)
3. Loadout system (all 4 configurations)
4. Turn-based combat with all formulas
5. Yield threshold system
6. Basic weapons (11 initial weapons)

**Phase 2 (Enhancement):**
1. Stance settings (offensive/defensive/balanced)
2. Time-based combat system
3. Shield mechanics (separate HP pool)
4. Advanced AI behaviors
5. More weapons and shields

**Phase 3 (Advanced):**
1. Weapon crafting system
2. Team battle formulas
3. Advanced positioning mechanics
4. Status effects system
5. Replay system

--> You told me all implementation things would go in the ROADMAP.md. What are they doing here? 

---

## Database Schema Implementation

### User Model Updates

Add these fields to the User model:

```typescript
model User {
  // Existing fields
  username     String   @unique
  passwordHash String
  role         String   @default("user")
  currency     Int      @default(1000000)  // Updated default
  elo          Int      @default(1200)
  fame         Int      @default(0)
  
  // NEW FIELDS for Stable System
  prestige     Int      @default(0)
  leagueTier   String   @default("bronze")
  totalBattles Int      @default(0)
  totalWins    Int      @default(0)
  highestELO   Int      @default(1200)
  
  robots       Robot[]
}
```

--> I told you that one file should be the base for all documentation regarding a topic. I don't want to see a "add these fields" comment. I want to see "these are all the fields". If it doesn't exist anywhere, put it in the most logical place. 

### Robot Model Updates

**Rename existing attributes** (weapon-neutral names):
- `firepower` → `combatPower`
- `targetingComputer` → `targetingSystems`
- `criticalCircuits` → `criticalSystems`
- `armorPiercing` → `penetration`
- `weaponStability` → `weaponControl`
- `firingRate` → `attackSpeed`
- `shieldGenerator` → `shieldCapacity`
- `hydraulicPower` → `hydraulicSystems`

--> I don't want to see old names. Only current ones. I want you to update ALL documentation referring to the old names and only use the current.

**Add new state tracking fields**:

```typescript
model Robot {
  // Existing 23 renamed attributes...
  
  // NEW: State Tracking
  currentHP       Int
  currentShield   Int
  damageTaken     Int      @default(0)
  elo             Int      @default(1200)
  totalBattles    Int      @default(0)
  wins            Int      @default(0)
  losses          Int      @default(0)
  damageDealtLifetime    Int      @default(0)
  damageTakenLifetime    Int      @default(0)
  fame            Int      @default(0)
  leaguePoints    Int      @default(0)
  yieldThreshold  Int      @default(10)  // Percentage (0-50)
  
  // NEW: Loadout Configuration
  loadout         String   @default("single")    // "weapon_shield", "two_handed", "dual_wield", "single"
  stance          String   @default("balanced")  // "offensive", "defensive", "balanced"
  
  weaponId        Int?
  shieldId        Int?     // NEW: For shield equipment
}
```

--> I told you that one file should be the base for all documentation regarding a topic. I don't want to see a "add these fields" comment. I want to see "these are all the fields". If it doesn't exist anywhere, put it in the most logical place. 


### Weapon Model Updates

**Rename attribute bonus fields** to match new attribute names:

```typescript
model Weapon {
  id              Int      @id @default(autoincrement())
  name            String
  weaponType      String   // 'energy', 'ballistic', 'melee', 'explosive'
  baseDamage      Int
  cost            Int      // Purchase cost in Credits
  
  // NEW FIELDS
  cooldown        Int      // Seconds between attacks (for time-based combat)
  handsRequired   String   // "one", "two", "dual"
  damageType      String   // Same as weaponType, clarifies damage calculation
  specialProperty String?  // Optional special effects
  
  // RENAMED Attribute Bonuses (must match Robot attributes)
  combatPowerBonus        Int      @default(0)
  targetingSystemsBonus   Int      @default(0)
  criticalSystemsBonus    Int      @default(0)
  penetrationBonus        Int      @default(0)
  weaponControlBonus      Int      @default(0)
  attackSpeedBonus        Int      @default(0)
  armorPlatingBonus       Int      @default(0)
  shieldCapacityBonus     Int      @default(0)
  evasionThrustersBonus   Int      @default(0)
  counterProtocolsBonus   Int      @default(0)
  servoMotorsBonus        Int      @default(0)
  gyroStabilizersBonus    Int      @default(0)
  hydraulicSystemsBonus   Int      @default(0)
  powerCoreBonus          Int      @default(0)
  threatAnalysisBonus     Int      @default(0)
}
```

--> I told you that one file should be the base for all documentation regarding a topic. I don't want to see a "add these fields" comment. I want to see "these are all the fields". If it doesn't exist anywhere, put it in the most logical place. 
--> If a bonus affects something in combat, I expect this is in the formula. Review and update.

### NEW: Shield Model

```typescript
model Shield {
  id              Int      @id @default(autoincrement())
  name            String
  cost            Int      // Purchase cost in Credits
  shieldBonus     Int      // Added to max shield HP
  armorBonus      Int      // Bonus to armor plating
  counterBonus    Int      // Bonus to counter protocols
  specialProperty String?  // Optional special effects
  
  robots          Robot[]
}
```

--> I assume you are referring to a weapon type Shield, not an Energy Shield. This is just a specification of a weapon, so add it in the total list.
--> shieldBonus would refer to an EnergyShield? Make sure all documentation regarding Energy Shields have the name "Energy" in it to differentiate from the weapon type "Shield".

### NEW: Facility Model (for Stable upgrades)

```typescript
model Facility {
  id           Int      @id @default(autoincrement())
  userId       Int
  facilityType String   // "repair_bay", "training", "workshop", "research", "medical"
  level        Int      @default(0)
  maxLevel     Int      @default(4)
  
  user         User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, facilityType])
}
```

--> This is something that does not belong in this file as it has nothing to do with a ROBOT_ATTRIBUTE but should go somewhere else. Place is somewhere logical.

### Battle Model Updates

Already has necessary fields:
- `battleLog` (Json)
- `winnerReward`, `loserReward` (Int?)
- `robot1RepairCost`, `robot2RepairCost` (Int?)

--> Where can I find this in the documentation? We don't have a specialised doc for the battle model. We don't have a specialised doc for the database. How can I know these fields already exist?

### Migration Notes

**Breaking Changes:**
1. All attribute names changed - requires data migration for existing robots
2. Weapon bonus field names changed - requires data migration for existing weapons
3. New required fields on Robot (currentHP, currentShield) - set to max values based on attributes
4. Users need new fields - can be added with defaults

--> There is no migration. There are no existing robots. Just update everything and remove this section.

**Migration Strategy:**
1. Create backup of database before migration
2. Update schema.prisma with new field names
3. Run Prisma migration to generate SQL
4. Write data migration script to:
   - Rename columns (Prisma handles this)
   - Set currentHP = hullIntegrity × 10
   - Set currentShield = shieldCapacity × 2
   - Initialize all new Int fields with defaults
5. Update seed data with new attribute names
6. Test on development database first

--> You know I haven't tested anything. We're working on documentation. Create comprehensive documentation.

**See also**: ROADMAP.md for implementation phases

---

**This revised system provides:**
- ✅ Weapon-neutral core attributes
- ✅ Melee vs ranged differentiation through weapons and hydraulics
- ✅ Loadout system (shield, two-handed, dual-wield)
- ✅ Stance settings (offensive/defensive/balanced)
- ✅ Time-based combat option (recommended)
- ✅ Yield threshold with repair cost scaling
- ✅ Critical hit mechanics (only on successful hits)
- ✅ Shield as separate HP pool with regeneration
- ✅ ALL attributes have clear purposes
- ✅ Complete robot state tracking
- ✅ Comprehensive weapon system
- ✅ HP calculation based on Hull Integrity
- ✅ Strategic depth with multiple viable builds
- ✅ Database schema fully specified
