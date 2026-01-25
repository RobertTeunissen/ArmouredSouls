# Robot Attributes System

**Last Updated**: January 25, 2026  
**Status**: Revised - Robot-Themed with Team Dynamics

## Overview

Armoured Souls uses a comprehensive attribute system with **23 core attributes** organized into 5 logical categories. All attributes are robot-themed (referencing mechanical parts and systems) and have specific effects in combat formulas. The system supports both solo (1v1) and team (arena) battles.

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

--> Also define other robot attributes outside of the core attributes. This has impact on the data that needs to be captured. Things like: current HP / damage taken / costs to fully repair / current fame / current leage / name of the robot. Be as thorough as possible. 
--> Start a new document on Stable level and start capturing the same requirements. A Stable is on user level, so current credits are tracked there, but used to upgrade an individual robots. Are there upgrades / things to be bought on Stable level? Do some suggestions. Also think about fame on stable level (or prestige?).


### 🔴 Weapons Systems (6)

**Primary offensive capabilities and weapon operation**

1. **Firepower** - Raw damage output from weapon systems
2. **Targeting Computer** - Hit chance and target acquisition accuracy
3. **Critical Circuits** - Chance to deal critical damage (overclocked systems)
4. **Armor Piercing** - Penetrates enemy plating and shields
5. **Weapon Stability** - Weapon handling and recoil management
6. **Firing Rate** - Speed between attacks (reload/recharge time)

--> The attribute naming is now geared towards ranged weapons while we also have melee weapons defined below. We need more neutral names for this to reflect it. 
--> Think of a way to incorporate the different types of weapons in our system so that different attributes influence the effectiveness of melee vs ranged weapons and update this in the battle system. 
--> For now all robots will be bipeds (humanoid) and have two legs to move around (thematically) and two arms to hold items. I want an upgrade that enables robots to be more effective with one weapon + shield, two handed weapons (and either ranged or melee) or two weapons (in ranged and/or melee). This also needs to be reflected in the battle system.  

### 🔵 Defensive Systems (5)

**Armor, shields, and damage mitigation**

7. **Armor Plating** - Physical damage reduction from attacks
8. **Shield Generator** - Energy shield effectiveness and capacity
9. **Evasion Thrusters** - Chance to dodge incoming attacks
10. **Damage Dampeners** - Reduces critical hit damage taken
11. **Counter Protocols** - Chance to strike back when hit

--> What is the impact of having a setting where the user can set whether a robots first instinct is to go more on the offense or more on the defense (+ countering abilities)? This is not an attribute but a setting, but it does affect the battle system.

### 🟢 Chassis & Mobility (5)

**Core mechanical structure and movement capabilities**

12. **Hull Integrity** - Maximum health points (structural HP)
13. **Servo Motors** - Movement speed and turn order
14. **Gyro Stabilizers** - Balance, dodging ability, and reaction time
15. **Hydraulic Power** - Melee damage and physical strength
16. **Power Core** - Sustained combat performance (stamina/energy reserves)

--> Instead of a turn order, how much more difficult is it to implement a system where a robot can place an attack every x seconds? And what it is adaptive, so a weapon is ready for an attack, but it waits for the right opportunity to strike (because of it's mobility and ai processing capabilities?). Explore this and incorporate if feasible.

### 🟡 AI Processing (4)

**Autonomous intelligence and combat decision-making**

17. **Combat Algorithms** - Battle strategy and decision quality
18. **Threat Analysis** - Target priority and positioning
19. **Adaptive AI** - Learns and responds to opponent tactics
20. **Logic Cores** - Performance under pressure (low HP situations)

--> We talked about a setting where the user can define when his robot will yield (as a % of HP). This should be because the repair costs will increase (dramatically) when a robot is totalled. This gives the players are risk appetite. It also ties into the attribute you coined "Logic Cores". Work out how this interacts. 

### 🟣 Team Coordination (3)

**Attributes for multi-robot arena battles (minimal impact in 1v1)**

21. **Sync Protocols** - Coordination with allied robots
22. **Support Systems** - Ability to assist/buff teammates
23. **Formation Tactics** - Positioning within team formations

---

## Attribute Interactions

### Combat Formulas (1v1 Battles)

**Hit Chance:**
```
base_hit_chance = 70%
hit_chance = base_hit_chance + (attacker.targeting_computer / 2) - (defender.evasion_thrusters / 3)
hit_chance = clamp(hit_chance, 10%, 95%)
```

**Critical Hit Chance:**
```
base_crit_chance = 5%
crit_chance = base_crit_chance + (attacker.critical_circuits / 8) + (attacker.targeting_computer / 25)
crit_chance = clamp(crit_chance, 0%, 50%)
```

--> Are these tracked seperately from the hit? What if there is a critical hit but the hit is a miss? How does this work? 
--> What is the impact of a critical hit? 

**Miss Chance:**
```
miss_chance = 100% - hit_chance
```

**Damage Calculation:**
```
// Base damage from firepower and weapon
base_damage = attacker.firepower + weapon.base_damage

// Weapon handling modifier
weapon_modifier = 1 + (attacker.weapon_stability / 100)
modified_damage = base_damage * weapon_modifier

// Melee bonus (for melee weapons only)
if weapon.type == 'melee':
    modified_damage += attacker.hydraulic_power * 0.5

--> If Hydraulic Power is for melee weapons only, is Firepower for ranged weapons only? Both these stats should also have other purposes otherwise players will not invest in them (ie. neglect them if they go the melee / ranged route).
--> Think about the type of damage that can be inflicted. Ranged might be armor piercing, but melee might have other benefits?

// Armor and shield defense
armor_reduction = defender.armor_plating * (1 - attacker.armor_piercing / 100)
shield_reduction = defender.shield_generator * 0.8
total_defense = armor_reduction + shield_reduction

--> Is there a way / weapon to impact shield_reduction? Do we need to track shield? Do you first damage the shield and then HP? Or do you deal damage when you break through the shield and is it still up?

// Final damage calculation
final_damage = max(1, modified_damage - total_defense)

// Critical hit multiplier
if critical_hit:
    crit_multiplier = 2.0 - (defender.damage_dampeners / 100)
    final_damage *= crit_multiplier

--> Can is the critical hit multiplier affected by the type of weapons (two handed has a higher multiplier?)

// Counter attack (if defender survives and roll succeeds)
counter_chance = defender.counter_protocols / 100
if random() < counter_chance:
    trigger_counter_attack()
```

**Turn Order (Initiative):**
```
initiative = robot.servo_motors + (robot.gyro_stabilizers / 2) + random(0, 10)
// Faster robots attack first
```

--> What if we abandon a turn system? How much more difficult are the calculations? (see comments above)

**Attack Speed (Attacks per Turn):**
```
base_attacks = 1
bonus_attacks = floor(attacker.firing_rate / 30)
total_attacks = base_attacks + bonus_attacks
// At firing_rate 30+, robot gets 2 attacks per turn
// At firing_rate 60+, robot gets 3 attacks per turn
```

--> What if we calculate "one possible attack per x seconds"

**Performance Under Pressure:**
```
// When HP < 30%, Logic Cores affect performance
if current_hp < (max_hp * 0.3):
    accuracy_penalty = max(0, 20 - logic_cores)
    damage_penalty = max(0, 15 - logic_cores)
    // Higher Logic Cores = less penalty when damaged
```

**Health Regeneration (Sustained Combat):**
```
// Power Core provides passive HP regeneration per turn
regen_per_turn = power_core * 0.2
// Helps in longer battles
```

--> Regenerate HP or shield? How does this work?

**Combat Decision Quality:**
```
// Combat Algorithms affect target selection and ability usage
decision_quality = combat_algorithms / 10
// Better decisions = optimal ability timing, better target priority
```

--> How does this impact the attack? I don't see this in the to hit formula.

**Tactical Positioning:**
```
// Threat Analysis improves positioning bonus
positioning_bonus = threat_analysis / 20
// Applied to accuracy and evasion when in advantageous position
```

--> How does this impact the attack? I don't see this in the to hit formula.

**Adaptation:**
```
// Adaptive AI learns opponent patterns
after_turn_3:
    learning_bonus = adaptive_ai / 15
    // Increases hit chance and reduces damage taken as battle progresses
```

--> How does this impact the attack? I don't see this in the to hit formula.

### Team Battle Formulas (Arena/Multi-Robot)

**Team Coordination Bonus:**
```
// When 2+ allied robots are adjacent
coordination_multiplier = 1 + (average_sync_protocols / 50)
damage_output *= coordination_multiplier
```

--> Change to "when allied robots". 2v2 should be possible.

**Support Buff:**
```
// Support Systems can buff adjacent allies
buff_amount = support_systems * 0.3
// Applied to ally's armor or damage for 1 turn
```

**Formation Bonus:**
```
// Formation Tactics improve when robots maintain formation
if in_formation:
    defense_bonus = formation_tactics / 10
    accuracy_bonus = formation_tactics / 15
```

**Team Synergy:**
```
// Average of all team members' Sync Protocols
team_synergy = average(all_robots.sync_protocols)
all_robots.accuracy += team_synergy / 20
all_robots.armor_plating += team_synergy / 25
```

---

## Weapon System

Weapons are purchased items that enhance robot attributes and provide damage bonuses.

### Weapon Attributes

Each weapon has:
1. **Base Damage** - Raw damage value
2. **Cost** - Credits to purchase
3. **Attribute Bonuses** - Enhances specific robot attributes
4. **Weapon Type** - Category (Energy, Ballistic, Melee, Explosive)

--> Update weapon types based on the comments above about melee vs ranged and the use of arms. Also incorporate shields.

### Sample Weapons (Updated with New Attributes)

--> We should define how the system works. The samples are to explain. It's good to have samples in the system from the start, but the players will be able to design their own weapons (and upgrade them maybe?)

#### Energy Weapons

**Laser Rifle** (₡150,000)
- Base Damage: +20
- Attribute Bonuses:
  - Targeting Computer: +3
  - Weapon Stability: +4
  - Firing Rate: +2
 
--> How does the cost calculation work?
--> Define the amount of HP a robot has based on his attributes

**Plasma Cannon** (₡300,000)
- Base Damage: +35
- Attribute Bonuses:
  - Firepower: +5
  - Critical Circuits: +4
  - Power Core: -3 (energy drain penalty)

**Ion Beam** (₡400,000)
- Base Damage: +25
- Attribute Bonuses:
  - Armor Piercing: +6
  - Shield Generator: +4
  - Firing Rate: +5

#### Ballistic Weapons

**Machine Gun** (₡100,000)
- Base Damage: +15
- Attribute Bonuses:
  - Firepower: +2
  - Firing Rate: +8
  - Weapon Stability: +3

**Railgun** (₡350,000)
- Base Damage: +40
- Attribute Bonuses:
  - Armor Piercing: +10
  - Targeting Computer: +5
  - Firing Rate: -3 (slow reload penalty)

**Shotgun** (₡120,000)
- Base Damage: +30
- Attribute Bonuses:
  - Firepower: +4
  - Critical Circuits: +5
  - Targeting Computer: -3 (close range penalty)

#### Melee Weapons

**Power Sword** (₡180,000)
- Base Damage: +28
- Attribute Bonuses:
  - Hydraulic Power: +6
  - Counter Protocols: +5
  - Gyro Stabilizers: +3

**Hammer** (₡200,000)
- Base Damage: +35
- Attribute Bonuses:
  - Hydraulic Power: +8
  - Firepower: +6
  - Servo Motors: -2 (weight penalty)

#### Explosive Weapons

**Rocket Launcher** (₡320,000)
- Base Damage: +45
- Attribute Bonuses:
  - Firepower: +7
  - Critical Circuits: +6
  - Firing Rate: -4 (slow reload)

**Grenade Launcher** (₡250,000)
- Base Damage: +32
- Attribute Bonuses:
  - Firepower: +5
  - Threat Analysis: +4
  - Firing Rate: -2

---

## Strategy Implications

### Build Archetypes

**Tank Build:**
- High: Hull Integrity, Armor Plating, Shield Generator, Damage Dampeners
- Low: Servo Motors, Firing Rate
- Weapon: Heavy weapons with raw firepower
- Strategy: Absorb damage while dealing consistent hits

**Glass Cannon:**
- High: Firepower, Critical Circuits, Armor Piercing
- Low: Hull Integrity, Armor Plating
- Weapon: High-damage plasma or explosive weapons
- Strategy: Eliminate opponent before taking damage

**Speed Demon:**
- High: Servo Motors, Gyro Stabilizers, Evasion Thrusters, Firing Rate
- Low: Armor Plating, Hull Integrity
- Weapon: Fast-firing weapons like Machine Gun
- Strategy: Multiple attacks per turn, dodge enemy fire

**Counter Striker:**
- High: Counter Protocols, Armor Plating, Logic Cores
- Moderate: All combat stats
- Weapon: Melee weapons for counter damage
- Strategy: Punish opponent's attacks with counters

**Tactical AI:**
- High: Combat Algorithms, Threat Analysis, Adaptive AI
- Moderate: All combat stats
- Weapon: Versatile weapons
- Strategy: Optimal decision-making wins battles

**Team Coordinator (Arena):**
- High: Sync Protocols, Support Systems, Formation Tactics
- Moderate: Combat and defensive stats
- Weapon: Support-oriented weapons
- Strategy: Enable team synergy and coordinate attacks

---

## Progression System

### Upgrade Paths

Players can specialize or generalize:

**Specialist Strategy:**
- Focus 80% of Credits on 5-7 key attributes
- Creates strong advantage in specific scenarios
- Vulnerable to counter-strategies

**Generalist Strategy:**
- Distribute Credits evenly across 15-18 attributes
- No major weaknesses
- No exceptional strengths

**Hybrid Strategy:**
- 60% on core 8-10 attributes, 40% on supporting attributes
- Balanced with slight specialization
- Recommended for new players

### Upgrade Cost Examples

Starting from all attributes at 1 with ₡1,000,000:

**Budget Allocation Example (Single Robot):**
- Robot Frame: ₡500,000
- Basic Weapon: ₡150,000
- Remaining for upgrades: ₡350,000

**Sample Upgrade Plan (Speed Demon):**
- Servo Motors 1→15: ₡120,000
- Firing Rate 1→15: ₡120,000
- Gyro Stabilizers 1→10: ₡55,000
- Evasion Thrusters 1→8: ₡36,000
- Machine Gun: ₡100,000
- **Total**: ₡931,000 (within budget)

---

## Battle Economy

### Repair Costs

**Formula:**
```
total_attributes = sum(all_23_attributes)
base_repair_cost = total_attributes × 100
damage_multiplier = (max_hp - current_hp) / max_hp
final_repair_cost = base_repair_cost × damage_multiplier
```

**Example:**
- Robot with total attributes = 230 (average 10 per attribute)
- Max HP = 100, Current HP = 30 (70% damage)
- Base repair = 230 × 100 = ₡23,000
- Final repair = 23,000 × 0.70 = ₡16,100

### Battle Rewards

**Formula:**
```
base_reward = 50,000 Credits
league_multiplier = 1.0 + (league_tier × 0.2)
elo_difference_bonus = (opponent_elo - your_elo) × 10
win_multiplier = winner ? 1.0 : 0.4

total_reward = (base_reward × league_multiplier + elo_difference_bonus) × win_multiplier
```

**Examples:**

**Normal League, Equal ELO, Win:**
- Base: ₡50,000 × 1.0 = ₡50,000
- ELO bonus: 0
- Win: ₡50,000 × 1.0 = **₡50,000**

**Normal League, Equal ELO, Loss:**
- Base: ₡50,000 × 1.0 = ₡50,000
- ELO bonus: 0
- Loss: ₡50,000 × 0.4 = **₡20,000**

**Higher League (Tier 2), Beat Higher ELO (+50), Win:**
- Base: ₡50,000 × 1.4 = ₡70,000
- ELO bonus: 50 × 10 = ₡500
- Win: (70,000 + 500) × 1.0 = **₡70,500**

### Economy Balance

- Average repair cost (50% damage): ~₡11,000 - ₡16,000
- Win reward (normal league): ₡50,000
- Loss reward (normal league): ₡20,000
- **Net profit per win**: ~₡34,000 - ₡39,000
- **Net profit per loss**: ~₡4,000 - ₡9,000 (covers repairs 90% of time)

---

## ELO System

**Standard ELO Implementation:**
- Starting ELO: 1200
- K-factor: 32 (high volatility for new players)
- Formula: Standard chess ELO

```
expected_score = 1 / (1 + 10^((opponent_elo - your_elo) / 400))
new_elo = old_elo + K × (actual_score - expected_score)
```

**Fame System:**
- Win: +10 fame × ELO multiplier
- Loss: +3 fame × ELO multiplier
- ELO multiplier: `1 + max(0, (opponent_elo - your_elo) / 1000)`

---

## Attribute Purpose Summary

Every attribute has a clear mechanical purpose:

**Weapons Systems:**
1. Firepower → Base damage calculation
2. Targeting Computer → Hit chance, crit chance
3. Critical Circuits → Crit chance
4. Armor Piercing → Bypasses enemy armor
5. Weapon Stability → Damage multiplier
6. Firing Rate → Attacks per turn

**Defensive Systems:**
7. Armor Plating → Physical damage reduction
8. Shield Generator → Energy damage reduction
9. Evasion Thrusters → Dodge chance
10. Damage Dampeners → Crit damage reduction
11. Counter Protocols → Counter-attack chance

**Chassis & Mobility:**
12. Hull Integrity → Maximum HP
13. Servo Motors → Initiative, speed
14. Gyro Stabilizers → Initiative, dodge
15. Hydraulic Power → Melee damage bonus
16. Power Core → HP regeneration per turn

**AI Processing:**
17. Combat Algorithms → Decision quality
18. Threat Analysis → Positioning bonus
19. Adaptive AI → Learning bonus (turn 3+)
20. Logic Cores → Low HP performance

**Team Coordination:**
21. Sync Protocols → Team damage multiplier
22. Support Systems → Ally buffs
23. Formation Tactics → Formation bonuses

--> Update this section based on comments.

---

## Implementation Notes

### Database Changes Needed

1. **Robot Model**: Update from 25 to 23 attributes with new names
2. **Weapon Model**: Update bonus fields to match new attribute names
3. **User Model**: Already has currency (₡1,000,000) and ELO
4. **Battle Model**: Already has reward/cost tracking

### Seed Data Updates

1. Update 11 weapons with new attribute bonus names
2. Keep starting balance at ₡1,000,000
3. Keep robot frame cost at ₡500,000

### Formula Implementation

1. Implement all combat formulas in battle simulator
2. Add team battle formulas (for future arena mode)
3. Add attribute bonus calculations for weapons
4. Create repair cost calculator
5. Implement reward calculator with ELO integration
6. Add ELO ranking system

--> Update based on comments.

---

## Future Enhancements (Post-Phase 1)

- **Skill Trees**: Unlock special abilities at certain attribute levels
- **Synergy Bonuses**: Combinations of high attributes unlock bonuses
- **Attribute Caps**: Soft/hard caps at certain levels
- **Diminishing Returns**: Higher levels cost exponentially more
- **Attribute Respec**: Allow resetting attributes for a fee
- **Hidden Attributes**: Consistency, clutch performance, etc.
- **Conditional Bonuses**: Attributes that activate in specific scenarios
- **Team Formations**: Predefined formations that enhance team bonuses

--> Update this based on comments.

---

**This revised system provides:**
- ✅ 23 robot-themed attributes (flexible, not strict 25)
- ✅ Clear mechanical grouping (5 categories)
- ✅ Robot part names (servos, hydraulics, plating, circuits, etc.)
- ✅ AI-focused category (AI Processing, not "Mental")
- ✅ Team coordination attributes for arena battles
- ✅ ALL attributes have formula effects
- ✅ Multiple viable build archetypes
- ✅ Strategic weapon choice matters
- ✅ Supports both 1v1 and team gameplay
