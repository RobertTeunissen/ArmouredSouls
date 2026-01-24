# Robot Attributes System

**Last Updated**: January 24, 2026  
**Status**: Design Complete - Ready for Implementation

## Overview

Armoured Souls uses a comprehensive attribute system inspired by Football Manager's depth and RPG combat mechanics. Robots have 25 core attributes organized into logical categories that enable diverse strategies and meaningful customization.

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

## Core Attributes (25 Total)

All robots start with each attribute at level 1. Players spend Credits to upgrade attributes.

### 🔴 Combat Attributes (8)

**Primary offensive and defensive capabilities in battle**

1. **Attack Power** - Raw damage output for weapons
2. **Accuracy** - Hit chance for attacks (reduces miss rate)
3. **Critical Strike** - Chance to deal critical damage
4. **Defense Rating** - Damage reduction from incoming attacks
5. **Evasion** - Chance to completely avoid attacks
6. **Counter Attack** - Chance to strike back when hit
7. **Armor Penetration** - Bypasses enemy defense rating
8. **Damage Resistance** - Reduces critical hit damage taken

### 🔵 Technical Attributes (6)

**Weapon handling and specialized combat systems**

9. **Weapon Handling** - Effectiveness with equipped weapons
10. **Energy Efficiency** - Reduces energy cost for special attacks
11. **Targeting Systems** - Improves accuracy and crit chance
12. **Heat Management** - Prevents overheating during sustained combat
13. **Shield Operations** - Effectiveness of defensive systems
14. **Reload Speed** - Recovery time between weapon uses

### 🟢 Physical Attributes (6)

**Core mechanical and structural capabilities**

15. **Hull Integrity** - Maximum health points (HP)
16. **Speed** - Movement rate and turn order
17. **Agility** - Dodging and reaction time
18. **Strength** - Melee damage and carry capacity
19. **Stamina** - Sustained performance over long battles
20. **Structural Stability** - Resistance to knockback and stagger

### 🟡 Mental Attributes (5)

**AI, strategy, and tactical decision-making**

21. **Tactical Awareness** - Positioning and target selection
22. **Composure** - Performance under pressure (low HP)
23. **Adaptability** - Responds to opponent's strategy
24. **Aggression** - Risk-taking vs defensive behavior
25. **Combat Intelligence** - Overall battle decision quality

---

## Attribute Interactions

### Combat Formulas

**Hit Chance:**
```
base_hit_chance = 75%
hit_chance = base_hit_chance + (attacker.accuracy / 2) - (defender.evasion / 2)
hit_chance = clamp(hit_chance, 10%, 95%)
```

**Critical Hit Chance:**
```
base_crit_chance = 5%
crit_chance = base_crit_chance + (attacker.critical_strike / 10) + (attacker.targeting_systems / 20)
crit_chance = clamp(crit_chance, 0%, 50%)
```

**Miss Chance:**
```
miss_chance = 100% - hit_chance
```

**Damage Calculation:**
```
base_damage = attacker.attack_power + weapon.damage_bonus
modified_damage = base_damage * (1 + attacker.weapon_handling / 100)
armor_reduction = defender.defense_rating * (1 - attacker.armor_penetration / 100)
final_damage = max(1, modified_damage - armor_reduction)

if critical_hit:
    crit_multiplier = 2.0 - (defender.damage_resistance / 100)
    final_damage *= crit_multiplier
```

**Turn Order:**
```
initiative = robot.speed + robot.agility / 2 + random(0, 10)
```

---

## Weapon System

Weapons are purchased items that enhance robot attributes and provide damage bonuses.

### Weapon Attributes

Each weapon has:
1. **Base Damage** - Raw damage value
2. **Energy Cost** - Credits cost to purchase
3. **Attribute Bonuses** - Enhances specific robot attributes
4. **Weapon Type** - Category (Energy, Ballistic, Melee, Explosive)

### Sample Weapons

#### Energy Weapons

**Laser Rifle** (₡150,000)
- Base Damage: +20
- Attribute Bonuses:
  - Accuracy: +3
  - Energy Efficiency: +5
  - Targeting Systems: +2

**Plasma Cannon** (₡300,000)
- Base Damage: +35
- Attribute Bonuses:
  - Attack Power: +5
  - Heat Management: -3 (penalty)
  - Critical Strike: +4

**Ion Beam** (₡400,000)
- Base Damage: +25
- Attribute Bonuses:
  - Energy Efficiency: +8
  - Armor Penetration: +6
  - Reload Speed: +4

#### Ballistic Weapons

**Machine Gun** (₡100,000)
- Base Damage: +15
- Attribute Bonuses:
  - Attack Power: +2
  - Reload Speed: +6
  - Weapon Handling: +3

**Railgun** (₡350,000)
- Base Damage: +40
- Attribute Bonuses:
  - Armor Penetration: +10
  - Accuracy: +5
  - Reload Speed: -2 (penalty)

**Shotgun** (₡120,000)
- Base Damage: +30
- Attribute Bonuses:
  - Attack Power: +4
  - Accuracy: -3 (penalty, close range weapon)
  - Critical Strike: +5

#### Melee Weapons

**Power Sword** (₡180,000)
- Base Damage: +28
- Attribute Bonuses:
  - Strength: +6
  - Counter Attack: +5
  - Agility: +3

**Hammer** (₡200,000)
- Base Damage: +35
- Attribute Bonuses:
  - Strength: +8
  - Attack Power: +6
  - Speed: -2 (penalty)

#### Explosive Weapons

**Rocket Launcher** (₡320,000)
- Base Damage: +45
- Attribute Bonuses:
  - Attack Power: +7
  - Critical Strike: +6
  - Reload Speed: -4 (penalty)

**Grenade Launcher** (₡250,000)
- Base Damage: +32
- Attribute Bonuses:
  - Attack Power: +5
  - Tactical Awareness: +4
  - Reload Speed: -2 (penalty)

---

## Strategy Implications

### Build Archetypes

**Tank Build:**
- High: Hull Integrity, Defense Rating, Structural Stability
- Low: Speed, Agility
- Weapon: Heavy armor-penetrating weapons
- Strategy: Absorb damage while dealing consistent hits

**Glass Cannon:**
- High: Attack Power, Critical Strike, Accuracy
- Low: Hull Integrity, Defense Rating
- Weapon: High-damage plasma or explosive weapons
- Strategy: Eliminate opponent before taking damage

**Evasion Specialist:**
- High: Evasion, Agility, Speed
- Low: Defense Rating, Hull Integrity
- Weapon: Fast-firing weapons
- Strategy: Avoid hits through dodging

**Balanced Fighter:**
- Medium: All combat attributes
- Moderate: Physical attributes
- Weapon: Versatile weapons like Laser Rifle
- Strategy: Adapt to opponent's weaknesses

**Tactical Genius:**
- High: Tactical Awareness, Combat Intelligence, Adaptability
- Moderate: All combat stats
- Weapon: Weapons that complement strategy
- Strategy: Optimal decision-making wins battles

---

## Progression System

### Upgrade Paths

Players can specialize or generalize:

**Specialist Strategy:**
- Focus 80% of Credits on 5-6 key attributes
- Creates strong advantage in specific scenarios
- Vulnerable to counter-strategies

**Generalist Strategy:**
- Distribute Credits evenly across 15-20 attributes
- No major weaknesses
- No exceptional strengths

**Hybrid Strategy:**
- 60% on core 8 attributes, 40% on supporting attributes
- Balanced with slight specialization
- Recommended for new players

### Upgrade Cost Examples

Starting from all attributes at 1 with ₡1,000,000:

**Budget Allocation Example (Single Robot):**
- Robot Frame: ₡500,000
- Basic Weapon: ₡150,000
- Remaining for upgrades: ₡350,000

**Sample Upgrade Plan (Glass Cannon):**
- Attack Power 1→20: ₡210,000
- Critical Strike 1→15: ₡120,000
- Accuracy 1→10: ₡55,000
- **Total**: ₡385,000 (over budget, need cheaper weapon or fewer upgrades)

**Adjusted Plan:**
- Attack Power 1→15: ₡120,000
- Critical Strike 1→12: ₡78,000
- Accuracy 1→10: ₡55,000
- Weapon Handling 1→8: ₡36,000
- Machine Gun: ₡100,000
- **Total**: ₡889,000 (within budget)

---

## Battle Economy

### Repair Costs

**Formula:**
```
total_attributes = sum(all_25_attributes)
base_repair_cost = total_attributes × 100
damage_multiplier = (max_hp - current_hp) / max_hp
final_repair_cost = base_repair_cost × damage_multiplier
```

**Example:**
- Robot with total attributes = 250
- Max HP = 100, Current HP = 30 (70% damage)
- Base repair = 250 × 100 = ₡25,000
- Final repair = 25,000 × 0.70 = ₡17,500

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

- Average repair cost (50% damage): ~₡12,000 - ₡20,000
- Win reward (normal league): ₡50,000
- Loss reward (normal league): ₡20,000
- **Net profit per win**: ~₡30,000 - ₡38,000
- **Net profit per loss**: ~₡0 - ₡8,000 (covers repairs 90% of time)

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

## Implementation Notes

### Database Changes Needed

1. **Robot Model**: Expand from 4 attributes to 25
2. **Weapon Model**: New table with weapon stats and bonuses
3. **User Model**: Update starting currency to 1,000,000
4. **Battle Model**: Store attribute snapshots for replay accuracy

### Seed Data Updates

1. Create 15-20 sample weapons across all types
2. Update component costs
3. Adjust user starting balance
4. Update robot creation cost

### Formula Implementation

1. Implement combat formulas in battle simulator
2. Add attribute bonus calculations for weapons
3. Create repair cost calculator
4. Implement reward calculator with ELO integration
5. Add ELO ranking system

---

## Future Enhancements (Post-Phase 1)

- **Skill Trees**: Unlock special abilities at certain attribute levels
- **Synergy Bonuses**: Combinations of high attributes unlock bonuses
- **Attribute Caps**: Soft/hard caps at certain levels
- **Diminishing Returns**: Higher levels cost exponentially more
- **Attribute Respec**: Allow resetting attributes for a fee
- **Hidden Attributes**: Consistency, clutch performance, etc.
- **Conditional Bonuses**: Attributes that activate in specific scenarios

---

**This system provides:**
- ✅ 25 attributes for strategic depth
- ✅ Logical grouping (Combat, Technical, Physical, Mental)
- ✅ Clear upgrade costs and progression
- ✅ Weapons that enhance robot strategies
- ✅ Balanced economy (repairs vs rewards)
- ✅ ELO-based matchmaking and fame
- ✅ Multiple viable build archetypes
- ✅ Strategic weapon choice matters
