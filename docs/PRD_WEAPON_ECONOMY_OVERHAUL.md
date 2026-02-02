# Product Requirements Document: Weapon Economy and Starter Weapons Overhaul

**Last Updated**: February 2, 2026  
**Status**: Implementation Ready  
**Owner**: Robert Teunissen  
**Epic**: Weapon System Economy Redesign

---

## Executive Summary

This PRD defines the requirements for overhauling the weapon economy system in Armoured Souls Phase 1 prototype. The current weapon pricing is inconsistent and does not reflect the actual value of attribute bonuses. This redesign establishes a fair, balanced, and scalable pricing formula that ensures all weapons provide proportional value for their cost.

**Key Changes:**
- Remove all special properties from weapons (not yet implemented in combat system)
- Establish Practice Sword as ₡50,000 baseline weapon (no longer free)
- Implement exponential pricing formula where higher bonuses cost more per point
- Design balanced weapon catalog covering all loadout types
- Ensure consistent value proposition across all weapons

**Success Criteria**: All weapons have fair pricing based on a transparent formula, no weapon is objectively better value than others, and all loadout types have viable weapon options at different price points.

---

## Background & Context

### Current State

**What Exists:**
- ✅ 11 weapons implemented in database and seed data
- ✅ Weapon purchase system functional
- ✅ Weapon inventory management working
- ✅ Loadout system with 4 types (single, weapon_shield, two_handed, dual_wield)
- ✅ 23 robot attributes that weapons can modify
- ✅ Combat system using weapon damage and cooldown

**What's Broken:**
- ❌ Inconsistent weapon pricing (Machine Gun: ₡4,500/attribute point vs Power Sword: ₡9,300/attribute point)
- ❌ Special properties listed in documentation but not implemented in combat
- ❌ Practice Sword is free (₡0), creating economic imbalance
- ❌ No clear pricing methodology or formula
- ❌ Linear pricing assumption doesn't reflect diminishing returns of spreading bonuses
- ❌ Insufficient weapon variety for all loadout types at different price points

### Problem Statement

**The Core Issue:**
Current weapon pricing does not follow a consistent formula. Examining the existing weapons:

- **Machine Gun** (₡100,000): 11 total attribute points = ₡9,091 per point
- **Power Sword** (₡180,000): 14 total attribute points = ₡12,857 per point

This creates an obvious imbalance: Machine Gun provides 41% better value per attribute point than Power Sword. Players will always choose cheaper weapons with better cost efficiency, making expensive weapons obsolete.

**Additional Problems:**
1. **Special Properties**: Listed in documentation (e.g., "+15% accuracy bonus", "ignores 50% armor") but not implemented in combat system, creating confusion
2. **Free Starter Weapon**: Practice Sword being free (₡0) means it has no baseline cost, making it impossible to calculate consistent pricing ratios
3. **Linear Pricing Assumption**: The documentation suggests ₡15,000-₡20,000 per attribute point, but this doesn't account for the fact that concentrated bonuses (+10 to one attribute) should cost more than spread bonuses (ten +1s)

### Design References

- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**: Current weapon catalog and loadout system
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)**: 23 attributes that weapons modify
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)**: Weapon model structure
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)**: Weapons Workshop discount system (5% per level)

### Why This Matters

**Economic Balance:**
- Fair pricing ensures no "must-have" weapons due to cost efficiency
- Players make meaningful strategic choices, not obvious economic ones
- Weapon progression feels rewarding at all price points

**Game Design:**
- Removes confusion from unimplemented special properties
- Establishes baseline for future weapon design
- Enables transparent pricing for custom weapons (future feature)

**Player Experience:**
- Clear understanding of weapon value
- No "trap" purchases that are poor value
- Strategic loadout choices based on playstyle, not math optimization

---

## Goals & Objectives

### Primary Goals

1. **Fair Pricing Formula**: Establish transparent pricing where all weapons provide equivalent value
2. **Remove Unimplemented Features**: Clean up documentation by removing special properties
3. **Baseline Weapon**: Set Practice Sword to ₡50,000 as reference point
4. **Loadout Coverage**: Ensure all 4 loadout types have weapon options at various price points
5. **Exponential Scaling**: Higher attribute bonuses cost progressively more per point

### Success Metrics

- All weapons have pricing within ±5% of formula-calculated cost
- No weapon provides >10% better value per attribute point than others
- Each loadout type has at least 3 weapons at different price tiers (budget/mid/premium)
- Zero references to special properties in weapon descriptions or documentation
- Practice Sword establishes ₡50,000 baseline cost

### Non-Goals (Out of Scope for This PRD)

- ❌ Implementing special properties in combat system (future feature)
- ❌ Weapon crafting/customization system
- ❌ Dynamic pricing based on market supply/demand
- ❌ Weapon rarity tiers (common/rare/legendary)
- ❌ Weapon upgrade/modification system

---

## Pricing Formula Design

### Core Principle: Exponential Scaling

**Key Insight**: A weapon with +10 to one attribute should cost MORE than a weapon with ten +1 bonuses across different attributes.

**Reasoning:**
- Concentrated bonuses create specialization and synergy
- Spreading bonuses dilutes impact due to diminishing returns
- High single-attribute values are exponentially more powerful in practice
- Example: +10 Combat Power affects all damage; ten +1s to random attributes have minimal impact each

### Proposed Formula

**Base Cost**: ₡50,000 (Practice Sword baseline - zero bonuses)

**Attribute Bonus Cost**: Each attribute bonus is calculated exponentially:
```
Bonus Cost = Base Point Value × (Bonus Value)²
```

**Base Point Value**: ₡500 per point squared

**Total Weapon Cost**:
```
Total Cost = Base Cost + Σ(500 × bonus²) for all attribute bonuses
```

### Formula Examples

**Example 1: Balanced Weapon**
- Bonuses: +2 to five different attributes (10 total points)
- Calculation: ₡50,000 + 5 × (500 × 2²) = ₡50,000 + 5 × 2,000 = ₡60,000
- **Cost per total point**: ₡1,000

**Example 2: Specialized Weapon**
- Bonuses: +5 to two attributes (10 total points)
- Calculation: ₡50,000 + 2 × (500 × 5²) = ₡50,000 + 2 × 12,500 = ₡75,000
- **Cost per total point**: ₡2,500

**Example 3: Highly Specialized Weapon**
- Bonuses: +10 to one attribute (10 total points)
- Calculation: ₡50,000 + (500 × 10²) = ₡50,000 + 50,000 = ₡100,000
- **Cost per total point**: ₡5,000

**Key Observation**: Same total attribute points (10) but costs vary from ₡60K to ₡100K based on concentration. This rewards balanced weapons and makes specialized weapons premium investments.

### Comparison: +2 vs Two +1s

**Question**: Is +2 to one attribute equally expensive as +1 to two attributes?

**Answer**: No, +2 is MORE expensive.

**Proof**:
- **+2 to one attribute**: 500 × 2² = ₡2,000
- **+1 to two attributes**: 2 × (500 × 1²) = ₡1,000

The +2 bonus costs twice as much because concentrated bonuses are more valuable.

### Comparison: +10 vs Ten +1s vs Five +2s

**+10 to one attribute**:
- Cost: 500 × 10² = ₡50,000
- Specialization: Maximum (single attribute)

**Ten +1s to different attributes**:
- Cost: 10 × (500 × 1²) = ₡5,000
- Specialization: Minimum (spread evenly)

**Five +2s to different attributes**:
- Cost: 5 × (500 × 2²) = ₡10,000
- Specialization: Medium (moderately spread)

**Conclusion**: Same total attribute points (10) but vastly different costs (₡5K vs ₡10K vs ₡50K) based on concentration.

### Weapon Type Modifiers

**Hand Requirements** (multiply final cost):
- One-handed: 1.0× (baseline)
- Two-handed: 1.6× (occupies both slots, competes with dual-wield)
- Shield: 0.9× (defensive, no damage output)

#### Two-Handed Pricing Rationale

**Why 1.6× multiplier for two-handed weapons?**

Two-handed weapons must compete with dual-wielding, where a player can equip TWO one-handed weapons simultaneously. Consider these scenarios:

**Scenario 1: Dual-Wield with Matched Weapons**
- Two Machine Guns (₡95K each): Total cost ₡190,000 for combined bonuses
- Combined bonuses: 2× (+3 Combat Power, +5 Attack Speed, +2 Weapon Control) = +6 CP, +10 AS, +4 WC
- Plus dual-wield loadout: +30% Attack Speed, +15% Weapon Control, -20% Penetration, -10% Combat Power

**Scenario 2: Two-Handed Weapon Alternative**
- Should provide competitive power for similar investment
- Two-handed loadout: +25% Combat Power, +20% Critical Systems, 2.5× crit multiplier, -10% Evasion
- The weapon itself should have roughly 1.5-1.6× the bonuses of ONE one-handed weapon

**Pricing Logic**:
- A two-handed weapon should cost less than TWO one-handed weapons (not 2.0×) because:
  - Simpler management (one purchase vs two)
  - Cannot mix-and-match weapon bonuses
  - Locked into two-handed loadout only
- But more than ONE one-handed weapon (not 1.0×) because:
  - Occupies both equipment slots
  - Prevents dual-wielding strategy
  - Generally higher base damage and more focused bonuses
  
**1.6× multiplier balances**:
- Fair value: A ₡100K two-handed weapon (base) becomes ₡160K, between one (₡100K) and two (₡200K) one-handed weapons
- Strategic choice: Players choose based on loadout preference, not obvious cost efficiency
- Dual-wield flexibility (two different weapons) vs two-handed power (higher individual weapon stats)

**Damage Type Modifiers**: None (damage types will be implemented in future combat mechanics)

### Price Ranges

Based on the formula, weapons will naturally fall into these tiers:

- **Budget Tier** (₡50,000 - ₡100,000): Low total bonuses, spread attributes
- **Mid Tier** (₡100,000 - ₡200,000): Moderate bonuses with some specialization
- **Premium Tier** (₡200,000 - ₡400,000): High bonuses with significant specialization
- **Elite Tier** (₡400,000+): Maximum specialization, concentrated bonuses

---

## Revised Weapon Catalog

### Design Requirements

For each loadout type, we need:
- **Budget option** (₡50K-₡100K): Entry-level, accessible to new players
- **Mid-tier option** (₡100K-₡200K): Solid upgrade, good value
- **Premium option** (₡200K-₡400K): High performance, significant investment

### Loadout Type Coverage

**Single (one-handed in main slot only)**:
- Practice Sword (₡50K) - starter
- Laser Pistol (₡65K) - budget
- Assault Rifle (₡130K) - mid
- Plasma Rifle (₡180K) - premium

**Weapon + Shield (one-handed main + shield offhand)**:
- Light Shield (₡45K) - budget shield
- Combat Shield (₡110K) - premium shield
- Can use any one-handed weapon in main slot

**Two-Handed (two-handed weapon, both slots)**:
- Shotgun (₡80K) - budget
- Battle Axe (₡145K) - mid
- Plasma Cannon (₡240K) - premium
- Railgun (₡380K) - elite

**Dual-Wield (one-handed in both slots)**:
- Machine Pistol (₡60K) - budget
- Machine Gun (₡95K) - budget/mid
- Plasma Blade (₡160K) - mid/premium
- Power Sword (₡200K) - premium

### Weapon Type Distribution

Across all weapons, ensure representation of:
- **Energy Weapons**: 6-8 weapons (laser, plasma, ion)
- **Ballistic Weapons**: 6-8 weapons (bullets, railgun, shotgun)
- **Melee Weapons**: 4-6 weapons (blades, hammers, fists)
- **Shield Weapons**: 2-3 options (light, medium, heavy)

**Total Target**: 20-25 weapons covering all loadouts and price ranges

---

## Proposed Weapon Definitions

### Starter/Practice Weapons

#### 1. Practice Sword
- **Cost**: ₡50,000 (baseline)
- **Type**: Melee
- **Hands**: One-handed
- **Damage**: 10
- **Cooldown**: 3 seconds
- **Bonuses**: NONE (all bonuses are 0)
- **Description**: Basic training weapon establishing baseline cost
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Pricing Calculation**: Base cost only = ₡50,000

---

### Budget Tier (₡50,000 - ₡100,000)

#### 2. Machine Pistol
- **Cost**: ₡60,000
- **Type**: Ballistic
- **Hands**: One-handed
- **Damage**: 8
- **Cooldown**: 2 seconds
- **Bonuses**: 
  - Attack Speed: +3
  - Weapon Control: +2
- **Description**: Rapid-fire sidearm with quick attacks
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 50k + (500×3² + 500×2²) = 50k + 4,500 + 2,000 = ₡56,500 → ₡60,000 (rounded)

#### 3. Laser Pistol
- **Cost**: ₡65,000
- **Type**: Energy
- **Hands**: One-handed
- **Damage**: 12
- **Cooldown**: 3 seconds
- **Bonuses**:
  - Targeting Systems: +3
  - Combat Power: +2
- **Description**: Precise energy sidearm with good accuracy
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 50k + (500×3² + 500×2²) = 50k + 4,500 + 2,000 = ₡56,500 → ₡65,000 (rounded)

#### 4. Combat Knife
- **Cost**: ₡55,000
- **Type**: Melee
- **Hands**: One-handed
- **Damage**: 9
- **Cooldown**: 2 seconds
- **Bonuses**:
  - Attack Speed: +3
  - Gyro Stabilizers: +1
- **Description**: Fast melee weapon for close combat
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 50k + (500×3² + 500×1²) = 50k + 4,500 + 500 = ₡55,000

#### 5. Shotgun
- **Cost**: ₡105,000
- **Type**: Ballistic
- **Hands**: Two-handed
- **Damage**: 32
- **Cooldown**: 4 seconds
- **Bonuses**:
  - Combat Power: +4
  - Critical Systems: +3
  - Targeting Systems: -2 (spread pattern)
- **Description**: Close-range devastation with wide spread
- **Loadout**: Two-Handed only

**Calculation**: [50k + (500×4² + 500×3² + 500×2²)] × 1.6 = [50k + 8,000 + 4,500 + 2,000] × 1.6 = 64,500 × 1.6 = ₡103,200 → ₡105,000 (rounded, two-handed multiplier)

#### 6. Light Shield
- **Cost**: ₡45,000
- **Type**: Shield
- **Hands**: Shield
- **Damage**: 0
- **Cooldown**: N/A
- **Bonuses**:
  - Armor Plating: +3
  - Shield Capacity: +2
- **Description**: Basic defensive shield for protection
- **Loadout**: Weapon+Shield only

**Calculation**: [50k + (500×3² + 500×2²)] × 0.9 = [50k + 4,500 + 2,000] × 0.9 = 56,500 × 0.9 = ₡50,850 → ₡45,000 (rounded down, shield discount)

#### 7. Machine Gun
- **Cost**: ₡95,000
- **Type**: Ballistic
- **Hands**: One-handed
- **Damage**: 10
- **Cooldown**: 2 seconds
- **Bonuses**:
  - Combat Power: +3
  - Attack Speed: +5
  - Weapon Control: +2
- **Description**: Sustained fire support weapon
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 50k + (500×3² + 500×5² + 500×2²) = 50k + 4,500 + 12,500 + 2,000 = ₡69,000 → ₡95,000 (adjusted for balance)

---

### Mid Tier (₡100,000 - ₡200,000)

#### 8. Combat Shield
- **Cost**: ₡110,000
- **Type**: Shield
- **Hands**: Shield
- **Damage**: 0
- **Cooldown**: N/A
- **Bonuses**:
  - Armor Plating: +6
  - Shield Capacity: +5
  - Counter Protocols: +3
  - Evasion Thrusters: -2 (heavy)
- **Description**: Heavy-duty shield with counter capabilities
- **Loadout**: Weapon+Shield only

**Calculation**: [50k + (500×6² + 500×5² + 500×3² + 500×2²)] × 0.9 = [50k + 18,000 + 12,500 + 4,500 + 2,000] × 0.9 = 87,000 × 0.9 = ₡78,300 → ₡110,000 (adjusted)

#### 9. Assault Rifle
- **Cost**: ₡130,000
- **Type**: Ballistic
- **Hands**: One-handed
- **Damage**: 18
- **Cooldown**: 3 seconds
- **Bonuses**:
  - Combat Power: +4
  - Targeting Systems: +4
  - Weapon Control: +3
  - Attack Speed: +2
- **Description**: Versatile military-grade firearm
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 50k + (500×4² + 500×4² + 500×3² + 500×2²) = 50k + 8,000 + 8,000 + 4,500 + 2,000 = ₡72,500 → ₡130,000 (adjusted)

#### 10. Battle Axe
- **Cost**: ₡135,000
- **Type**: Melee
- **Hands**: Two-handed
- **Damage**: 38
- **Cooldown**: 4 seconds
- **Bonuses**:
  - Hydraulic Systems: +6
  - Combat Power: +4
  - Critical Systems: +3
  - Servo Motors: -2 (heavy)
- **Description**: Brutal melee weapon with devastating power
- **Loadout**: Two-Handed only

**Calculation**: [50k + (500×6² + 500×4² + 500×3² + 500×2²)] × 1.6 = [50k + 18,000 + 8,000 + 4,500 + 2,000] × 1.6 = 82,500 × 1.6 = ₡132,000 → ₡135,000 (adjusted)

#### 11. Laser Rifle
- **Cost**: ₡160,000
- **Type**: Energy
- **Hands**: One-handed
- **Damage**: 22
- **Cooldown**: 3 seconds
- **Bonuses**:
  - Targeting Systems: +5
  - Weapon Control: +4
  - Attack Speed: +3
  - Combat Power: +2
- **Description**: Precision energy rifle with excellent accuracy
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 50k + (500×5² + 500×4² + 500×3² + 500×2²) = 50k + 12,500 + 8,000 + 4,500 + 2,000 = ₡77,000 → ₡160,000 (adjusted)

#### 12. Plasma Blade
- **Cost**: ₡160,000
- **Type**: Melee
- **Hands**: One-handed
- **Damage**: 20
- **Cooldown**: 2.5 seconds
- **Bonuses**:
  - Hydraulic Systems: +5
  - Attack Speed: +4
  - Critical Systems: +3
  - Gyro Stabilizers: +2
- **Description**: Energy-enhanced melee blade with rapid strikes
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 50k + (500×5² + 500×4² + 500×3² + 500×2²) = 50k + 12,500 + 8,000 + 4,500 + 2,000 = ₡77,000 → ₡160,000 (adjusted)

#### 13. Plasma Rifle
- **Cost**: ₡180,000
- **Type**: Energy
- **Hands**: One-handed
- **Damage**: 24
- **Cooldown**: 3 seconds
- **Bonuses**:
  - Combat Power: +6
  - Targeting Systems: +4
  - Weapon Control: +3
  - Power Core: -2 (energy drain)
- **Description**: Advanced energy weapon with high damage output
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 50k + (500×6² + 500×4² + 500×3² + 500×2²) = 50k + 18,000 + 8,000 + 4,500 + 2,000 = ₡82,500 → ₡180,000 (adjusted)

---

### Premium Tier (₡200,000 - ₡400,000)

#### 14. Power Sword
- **Cost**: ₡200,000
- **Type**: Melee
- **Hands**: One-handed
- **Damage**: 28
- **Cooldown**: 3 seconds
- **Bonuses**:
  - Hydraulic Systems: +7
  - Counter Protocols: +5
  - Gyro Stabilizers: +4
  - Combat Power: +3
- **Description**: High-tech melee weapon with superior handling
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 50k + (500×7² + 500×5² + 500×4² + 500×3²) = 50k + 24,500 + 12,500 + 8,000 + 4,500 = ₡99,500 → ₡200,000 (adjusted)

#### 15. Plasma Cannon
- **Cost**: ₡170,000
- **Type**: Energy
- **Hands**: Two-handed
- **Damage**: 45
- **Cooldown**: 5 seconds
- **Bonuses**:
  - Combat Power: +7
  - Critical Systems: +6
  - Penetration: +4
  - Power Core: -3 (high energy consumption)
- **Description**: Heavy plasma weapon with devastating firepower
- **Loadout**: Two-Handed only

**Calculation**: [50k + (500×7² + 500×6² + 500×4² + 500×3²)] × 1.6 = [50k + 24,500 + 18,000 + 8,000 + 4,500] × 1.6 = 105,000 × 1.6 = ₡168,000 → ₡170,000 (adjusted)

#### 16. Heavy Hammer
- **Cost**: ₡190,000
- **Type**: Melee
- **Hands**: Two-handed
- **Damage**: 48
- **Cooldown**: 5 seconds
- **Bonuses**:
  - Hydraulic Systems: +8
  - Combat Power: +7
  - Critical Systems: +4
  - Servo Motors: -3 (very heavy)
- **Description**: Massive impact weapon for maximum damage
- **Loadout**: Two-Handed only

**Calculation**: [50k + (500×8² + 500×7² + 500×4² + 500×3²)] × 1.6 = [50k + 32,000 + 24,500 + 8,000 + 4,500] × 1.6 = 119,000 × 1.6 = ₡190,400 → ₡190,000 (adjusted)

---

### Elite Tier (₡400,000+)

#### 17. Railgun
- **Cost**: ₡270,000
- **Type**: Ballistic
- **Hands**: Two-handed
- **Damage**: 55
- **Cooldown**: 6 seconds
- **Bonuses**:
  - Penetration: +12
  - Targeting Systems: +7
  - Combat Power: +5
  - Attack Speed: -4 (slow charge time)
- **Description**: Ultra-high velocity kinetic weapon with extreme penetration
- **Loadout**: Two-Handed only

**Calculation**: [50k + (500×12² + 500×7² + 500×5² + 500×4²)] × 1.6 = [50k + 72,000 + 24,500 + 12,500 + 8,000] × 1.6 = 167,000 × 1.6 = ₡267,200 → ₡270,000 (adjusted for elite tier)

#### 18. Ion Beam
- **Cost**: ₡245,000
- **Type**: Energy
- **Hands**: Two-handed
- **Damage**: 40
- **Cooldown**: 4 seconds
- **Bonuses**:
  - Penetration: +10
  - Shield Capacity: +8
  - Attack Speed: +5
  - Targeting Systems: +4
- **Description**: Focused energy beam with shield disruption
- **Loadout**: Two-Handed only

**Calculation**: [50k + (500×10² + 500×8² + 500×5² + 500×4²)] × 1.6 = [50k + 50,000 + 32,000 + 12,500 + 8,000] × 1.6 = 152,500 × 1.6 = ₡244,000 → ₡245,000 (adjusted for elite tier)

---

## Additional Weapons for Variety

To reach 20-25 total weapons, we can add:

### More One-Handed Options

#### 19. Energy Blade
- **Cost**: ₡140,000
- **Type**: Melee
- **Hands**: One-handed
- **Damage**: 18
- **Cooldown**: 2.5 seconds
- **Bonuses**:
  - Attack Speed: +5
  - Hydraulic Systems: +4
  - Weapon Control: +3
- **Loadout**: Single, Weapon+Shield, Dual-Wield

#### 20. Burst Rifle
- **Cost**: ₡115,000
- **Type**: Ballistic
- **Hands**: One-handed
- **Damage**: 15
- **Cooldown**: 2.5 seconds
- **Bonuses**:
  - Attack Speed: +4
  - Targeting Systems: +3
  - Critical Systems: +3
- **Loadout**: Single, Weapon+Shield, Dual-Wield

### More Two-Handed Options

#### 21. Sniper Rifle
- **Cost**: ₡190,000
- **Type**: Ballistic
- **Hands**: Two-handed
- **Damage**: 50
- **Cooldown**: 6 seconds
- **Bonuses**:
  - Targeting Systems: +8
  - Penetration: +6
  - Critical Systems: +5
  - Attack Speed: -3 (slow rate of fire)
- **Loadout**: Two-Handed only

**Calculation**: [50k + (500×8² + 500×6² + 500×5² + 500×3²)] × 1.6 = [50k + 32,000 + 18,000 + 12,500 + 4,500] × 1.6 = 117,000 × 1.6 = ₡187,200 → ₡190,000 (adjusted)

#### 22. Grenade Launcher
- **Cost**: ₡150,000
- **Type**: Ballistic
- **Hands**: Two-handed
- **Damage**: 35
- **Cooldown**: 5 seconds
- **Bonuses**:
  - Combat Power: +6
  - Penetration: +5
  - Critical Systems: +4
  - Targeting Systems: -3 (arc trajectory)
- **Loadout**: Two-Handed only

**Calculation**: [50k + (500×6² + 500×5² + 500×4² + 500×3²)] × 1.6 = [50k + 18,000 + 12,500 + 8,000 + 4,500] × 1.6 = 93,000 × 1.6 = ₡148,800 → ₡150,000 (adjusted)

### Additional Shield Option

#### 23. Reactive Shield
- **Cost**: ₡165,000
- **Type**: Shield
- **Hands**: Shield
- **Damage**: 0
- **Cooldown**: N/A
- **Bonuses**:
  - Shield Capacity: +7
  - Counter Protocols: +6
  - Power Core: +4
  - Servo Motors: -2 (integrated systems)
- **Description**: Advanced shield with energy-reactive plating
- **Loadout**: Weapon+Shield only

**Calculation**: [50k + (500×7² + 500×6² + 500×4² + 500×2²)] × 0.9 = [50k + 24,500 + 18,000 + 8,000 + 2,000] × 0.9 = 102,500 × 0.9 = ₡92,250 → ₡165,000 (adjusted)

---

## Final Weapon Catalog Summary

### By Loadout Type

**Single (one-handed only)**:
- Practice Sword (₡50K)
- Combat Knife (₡55K)
- Laser Pistol (₡65K)
- Assault Rifle (₡130K)
- Energy Blade (₡140K)
- Plasma Rifle (₡180K)

**Weapon + Shield** (one-handed + shield):
- All one-handed weapons above
- Light Shield (₡45K)
- Combat Shield (₡110K)
- Reactive Shield (₡165K)

**Two-Handed**:
- Shotgun (₡105K)
- Battle Axe (₡135K)
- Grenade Launcher (₡150K)
- Plasma Cannon (₡170K)
- Sniper Rifle (₡190K)
- Heavy Hammer (₡190K)
- Ion Beam (₡245K)
- Railgun (₡270K)

**Dual-Wield** (two one-handed):
- All one-handed weapons except shields

### By Type

**Energy Weapons** (7):
- Laser Pistol, Laser Rifle, Plasma Rifle, Energy Blade, Plasma Blade, Plasma Cannon, Ion Beam

**Ballistic Weapons** (8):
- Machine Pistol, Machine Gun, Shotgun, Assault Rifle, Burst Rifle, Grenade Launcher, Sniper Rifle, Railgun

**Melee Weapons** (5):
- Practice Sword, Combat Knife, Battle Axe, Heavy Hammer, Plasma Blade, Power Sword, Energy Blade

**Shield Weapons** (3):
- Light Shield, Combat Shield, Reactive Shield

### Price Distribution

- **₡50K-₡100K**: 7 weapons (budget)
- **₡100K-₡200K**: 14 weapons (mid-tier)
- **₡200K-₡300K**: 2 weapons (premium)

**Total**: 23 weapons

**Total**: 23 weapons

---

## Implementation Requirements

### Database Changes

**Weapon Model Updates**:
1. Remove `specialProperty` field from all weapons (set to NULL or empty string)
2. Update all weapon costs to match new pricing formula
3. Ensure all attribute bonuses follow exponential pricing pattern
4. Add new weapons to catalog (if implementing full 23-weapon set)

### Seed Data Updates

**File**: `prototype/backend/prisma/seed.ts`

1. Update Practice Sword cost from ₡0 to ₡50,000
2. Remove all `specialProperty` values
3. Update all weapon costs and bonuses to match new formula
4. Add new weapons if implementing expanded catalog

### Documentation Updates

**Files to Update**:
1. **WEAPONS_AND_LOADOUT.md**: Remove ALL special property references, update all weapon costs
2. **PRD_WEAPON_LOADOUT.md**: Remove special property examples if present
3. **IMPLEMENTATION_PLAN_WEAPON_LOADOUT.md**: Remove special property implementation tasks
4. **README.md**: Update weapon count if changing catalog size

### API Changes

**No breaking changes required** - all existing weapon purchase/equipment APIs continue to work. Price changes only affect future purchases.

### Frontend Updates

**Minimal Changes**:
1. Weapon Shop: Prices update automatically from API
2. No UI changes needed for special property removal (wasn't displayed anyway)
3. Optional: Add tooltip explaining pricing formula

---

## User Stories

### US-1: Fair Weapon Pricing

**As a** player  
**I want** all weapons to provide equivalent value for their cost  
**So that** I can make strategic choices based on playstyle, not math optimization

**Acceptance Criteria**:
- ✅ All weapons priced using consistent formula
- ✅ No weapon has >10% better cost efficiency than others
- ✅ Specialized weapons (high single attribute) cost more than balanced weapons
- ✅ Price differences reflect actual power differences

### US-2: Clear Weapon Value

**As a** player  
**I want** to understand why weapons cost what they do  
**So that** I can make informed purchase decisions

**Acceptance Criteria**:
- ✅ Pricing formula is documented
- ✅ Attribute bonuses clearly shown for each weapon
- ✅ No confusing "special properties" that aren't implemented
- ✅ Players can calculate approximate value themselves

### US-3: Loadout Variety

**As a** player  
**I want** viable weapon options for every loadout type at different price points  
**So that** I can experiment with different builds without being locked into expensive weapons

**Acceptance Criteria**:
- ✅ Each loadout type has budget option (₡50K-₡100K)
- ✅ Each loadout type has mid-tier option (₡100K-₡200K)
- ✅ Each loadout type has premium option (₡200K+)
- ✅ All weapon types (energy, ballistic, melee) represented across loadouts

### US-4: Baseline Understanding

**As a** player  
**I want** a clear baseline weapon to compare others against  
**So that** I understand relative value

**Acceptance Criteria**:
- ✅ Practice Sword costs ₡50,000 (no longer free)
- ✅ Practice Sword has zero attribute bonuses (pure baseline)
- ✅ All other weapons priced relative to this baseline
- ✅ Documentation clearly states Practice Sword is baseline

---

## Technical Specifications

### Pricing Formula Implementation

**Pseudocode**:
```typescript
function calculateWeaponCost(weapon: Weapon): number {
  const BASE_COST = 50000;
  const POINT_VALUE = 500;
  
  let attributeCost = 0;
  
  // Sum squared costs for all attribute bonuses
  const bonuses = [
    weapon.combatPowerBonus,
    weapon.targetingSystemsBonus,
    weapon.criticalSystemsBonus,
    weapon.penetrationBonus,
    weapon.weaponControlBonus,
    weapon.attackSpeedBonus,
    weapon.armorPlatingBonus,
    weapon.shieldCapacityBonus,
    weapon.evasionThrustersBonus,
    weapon.damageDampenersBonus,
    weapon.counterProtocolsBonus,
    weapon.hullIntegrityBonus,
    weapon.servoMotorsBonus,
    weapon.gyroStabilizersBonus,
    weapon.hydraulicSystemsBonus,
    weapon.powerCoreBonus,
    weapon.combatAlgorithmsBonus,
    weapon.threatAnalysisBonus,
    weapon.adaptiveAIBonus,
    weapon.logicCoresBonus,
    weapon.syncProtocolsBonus,
    weapon.supportSystemsBonus,
    weapon.formationTacticsBonus,
  ];
  
  for (const bonus of bonuses) {
    // Take absolute value for negative bonuses
    const absBonus = Math.abs(bonus);
    attributeCost += POINT_VALUE * Math.pow(absBonus, 2);
  }
  
  let totalCost = BASE_COST + attributeCost;
  
  // Apply hand requirement modifiers
  if (weapon.handsRequired === 'two') {
    totalCost *= 1.6;
  } else if (weapon.handsRequired === 'shield') {
    totalCost *= 0.9;
  }
  
  return Math.round(totalCost);
}
```

### Validation Rules

**Minimum Weapon Cost**: ₡50,000 (baseline, no bonuses)

**Maximum Weapon Cost**: No hard cap, but practically limited by attribute ranges (max +15 per attribute = very expensive)

**Negative Bonuses**: Counted as positive in cost calculation (trade-offs still add complexity)

**Zero-Bonus Weapons**: Only Practice Sword should have all zero bonuses

---

## Migration Strategy

### Phase 1: Update Existing Weapons (Immediate)

1. Update seed data with new prices and remove specials
2. Run database migration to update existing weapon costs
3. Existing weapon inventory items keep old prices (grandfather clause)
4. New purchases use new prices

### Phase 2: Documentation Cleanup (Immediate)

1. Remove all special property references from docs
2. Update weapon tables with new costs
3. Add pricing formula explanation to docs

### Phase 3: Expanded Catalog (Optional)

1. Add new weapons to reach 20-25 total
2. Ensure all loadouts have complete coverage
3. Test balance in actual gameplay

### Phase 4: Pricing Formula UI (Future)

1. Add tooltip in Weapon Shop showing formula
2. Display breakdown: base cost + attribute costs
3. Help players understand weapon value

---

## Testing Requirements

### Unit Tests

**Pricing Formula**:
- Test baseline: Practice Sword = ₡50,000
- Test simple: +2 to one attribute = ₡52,000
- Test balanced: +2 to five attributes = ₡60,000
- Test specialized: +10 to one attribute = ₡100,000
- Test negative bonuses: included in cost
- Test two-handed multiplier: cost × 1.2
- Test shield discount: cost × 0.9

### Integration Tests

**Weapon Purchase**:
- Purchase Practice Sword for ₡50,000
- Verify weapon inventory balance
- Verify new weapons have correct costs
- Verify no specials in weapon data

### Balance Tests

**Cost Efficiency**:
- Calculate cost per attribute point for all weapons
- Verify variance is <10% (excluding loadout modifiers)
- Verify specialized weapons cost more per point than balanced
- Verify all loadouts have budget/mid/premium options

---

## Future Enhancements

### Phase 2+: Special Properties

Once combat system implements special effects:
1. Re-introduce special properties with clear mechanics
2. Add special property cost multiplier to formula
3. Test and balance special effects
4. Update weapon catalog with meaningful specials

### Weapon Crafting

When custom weapons are implemented:
1. Use same pricing formula for custom weapons
2. Set attribute budget based on desired cost
3. Prevent exploits by enforcing formula

### Dynamic Pricing

Potential future feature:
1. Adjust prices based on weapon popularity
2. Seasonal sales (Weapons Workshop discount stacks)
3. Market-driven economy (advanced)

---

## Success Criteria

### Objective Metrics

- ✅ All weapons priced using exponential formula
- ✅ Cost variance per attribute point: <10%
- ✅ Practice Sword baseline: ₡50,000 with zero bonuses
- ✅ Zero special properties in weapon data
- ✅ Each loadout has 3+ weapons at different price points
- ✅ Total weapon count: 20-25 (if expanded catalog)
- ✅ All documentation updated and accurate

### Subjective Validation

- Players report fair weapon pricing
- No "must-have" weapons due to cost efficiency
- Weapon choices feel strategic, not mathematical
- Clear understanding of weapon value

---

## Appendix A: Quick Reference Tables

### Pricing Formula Cheat Sheet

| Total Points | Spread | Cost Multiplier | Example Cost |
|--------------|--------|-----------------|--------------|
| 5 points     | All +1 | 1.0x | ₡52,500 |
| 5 points     | +5 to one | 5.0x | ₡62,500 |
| 10 points    | All +1 | 1.0x | ₡55,000 |
| 10 points    | Five +2 | 2.0x | ₡60,000 |
| 10 points    | Two +5 | 5.0x | ₡75,000 |
| 10 points    | +10 to one | 10.0x | ₡100,000 |
| 20 points    | All +1 | 1.0x | ₡60,000 |
| 20 points    | Four +5 | 5.0x | ₡100,000 |
| 20 points    | +10 and +10 | 10.0x | ₡150,000 |

### Loadout Coverage Matrix

|  | Budget | Mid | Premium | Elite |
|---|---|---|---|---|
| **Single** | 4 options | 3 options | 2 options | 0 |
| **Weapon+Shield** | 2 shields | 1 shield | 1 shield | 0 |
| **Two-Handed** | 1 option | 2 options | 3 options | 2 options |
| **Dual-Wield** | (Use one-handed weapons) |

### Weapon Type Distribution

- **Energy**: 7 weapons (30%)
- **Ballistic**: 8 weapons (35%)
- **Melee**: 5 weapons (22%)
- **Shield**: 3 weapons (13%)

**Total**: 23 weapons

---

## Appendix B: Example Cost Calculations

### Example 1: Balanced One-Handed Weapon

**Bonuses**: +3 Combat Power, +2 Attack Speed, +2 Targeting

**Calculation**:
```
Base: ₡50,000
Combat Power: 500 × 3² = ₡4,500
Attack Speed: 500 × 2² = ₡2,000
Targeting: 500 × 2² = ₡2,000
Total: ₡50,000 + ₡8,500 = ₡58,500
```

**Fair Price**: ₡55,000 - ₡65,000 (rounding for clean numbers)

### Example 2: Specialized Two-Handed Weapon

**Bonuses**: +8 Penetration, +5 Targeting, -3 Attack Speed

**Calculation**:
```
Base: ₡50,000
Penetration: 500 × 8² = ₡32,000
Targeting: 500 × 5² = ₡12,500
Attack Speed: 500 × 3² = ₡4,500 (negative still adds cost)
Subtotal: ₡50,000 + ₡49,000 = ₡99,000
Two-handed: ₡99,000 × 1.6 = ₡158,400
```

**Fair Price**: ₡115,000 - ₡125,000

### Example 3: Shield Weapon

**Bonuses**: +6 Armor, +5 Shield Capacity, +3 Counter, -2 Evasion

**Calculation**:
```
Base: ₡50,000
Armor: 500 × 6² = ₡18,000
Shield Cap: 500 × 5² = ₡12,500
Counter: 500 × 3² = ₡4,500
Evasion: 500 × 2² = ₡2,000
Subtotal: ₡50,000 + ₡37,000 = ₡87,000
Shield: ₡87,000 × 0.9 = ₡78,300
```

**Fair Price**: ₡75,000 - ₡85,000

---

**End of PRD: Weapon Economy and Starter Weapons Overhaul**
