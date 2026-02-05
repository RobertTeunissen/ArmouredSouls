# Product Requirements Document: Weapon Economy and Starter Weapons Overhaul

**Version**: 1.1  
**Last Updated**: February 5, 2026  
**Status**: Implemented with Balance Adjustments  
**Owner**: Robert Teunissen  
**Epic**: Weapon System Economy Redesign

**Change Log:**
- **v1.0** (Feb 2, 2026): Initial pricing formula and weapon catalog
- **v1.1** (Feb 5, 2026): Updated for combat rebalancing - reduced weapon damage values

---

## Executive Summary

This PRD defines the requirements for the weapon economy system in Armoured Souls Phase 1 prototype. **Version 1.1 updates the weapon damage values following the February 2026 combat rebalancing** that simplified damage application formulas and adjusted battle duration targets.

**Key Changes in v1.1:**
- **Practice Sword baseline**: 10 → 8 damage (20% reduction, new baseline)
- **All other weapons**: 25-33% damage reduction to compensate for new damage formula
- **Pricing formula**: Remains unchanged (DPS-based with attribute bonuses)
- **Weapon economy**: Prices slightly reduced (15-20%) due to lower DPS values

**Context**: The combat system was rebalanced to eliminate 70% shield absorption and 30% bleed-through mechanics, resulting in 2-3x faster damage application. Weapon damage was reduced proportionally to maintain target battle duration of 40-60 seconds.

**Success Criteria**: All weapons have fair pricing based on transparent formula, maintain value proposition relative to each other, and support faster battle times without economy disruption.

---

## Version 1.1 Updates

### What Changed in Combat System

**Old Damage Application:**
- Energy shields absorbed 70% of damage
- 30% bleed-through when shields depleted
- Armor reduction capped at 30
- Effective damage to HP: ~20-30% of base weapon damage

**New Damage Application** (Feb 5, 2026):
- Energy shields absorb 100% of damage (no reduction)
- Overflow damage goes directly to HP with armor % reduction
- Armor reduction: `(armorPlating - penetration) × 1.5%` (no cap)
- Effective damage to HP: ~60-80% of base weapon damage

**Impact**: Damage effectiveness increased 2-3x, requiring weapon damage reduction.

### Updated Weapon Damage Values

All weapons rebalanced with new damage values:

| Weapon | v1.0 Damage | v1.1 Damage | % Change | Notes |
|--------|-------------|-------------|----------|-------|
| Practice Sword | 10 | 8 | -20% | New baseline |
| Machine Pistol | 8 | 6 | -25% | |
| Laser Pistol | 12 | 8 | -33% | |
| Combat Knife | 9 | 6 | -33% | |
| Machine Gun | 10 | 7 | -30% | |
| Burst Rifle | 15 | 11 | -27% | |
| Assault Rifle | 18 | 13 | -28% | |
| Energy Blade | 18 | 13 | -28% | |
| Laser Rifle | 22 | 15 | -32% | |
| Plasma Blade | 20 | 14 | -30% | |
| Plasma Rifle | 24 | 17 | -29% | |
| Power Sword | 28 | 20 | -29% | |
| Shotgun | 32 | 22 | -31% | |
| Grenade Launcher | 35 | 25 | -29% | |
| Sniper Rifle | 50 | 35 | -30% | Two-handed |
| Battle Axe | 38 | 27 | -29% | Two-handed |
| Plasma Cannon | 45 | 32 | -29% | Two-handed |
| Heavy Hammer | 48 | 34 | -29% | Two-handed |
| Railgun | 55 | 39 | -29% | Two-handed |
| Ion Beam | 40 | 28 | -30% | Two-handed |

**Shields (0 damage - unchanged):**
- Light Shield
- Combat Shield  
- Reactive Shield

### Pricing Impact

**DPS Baseline Shift:**
- v1.0: Practice Sword 10 damage / 3s = 3.33 DPS baseline
- v1.1: Practice Sword 8 damage / 3s = 2.67 DPS baseline

**Price Adjustment:**
- Most weapons: 15-20% price reduction
- Practice Sword: ~54% price reduction (₡50k → ₡23k estimated)
- High-tier weapons: 18-20% price reduction

**Rationale for Price Reduction:**
- Lower DPS values reduce DPS Cost component of pricing formula
- Weapons are relatively more powerful due to armor cap removal
- Price reduction is player-friendly and improves economy

**Formula Remains Valid:**
```
Total Cost = (Base Cost + Attribute Cost + DPS Cost) × Hand Multiplier

Where DPS Cost = ₡50,000 × (DPS Ratio - 1.0) × 2.67  // Was 2.0 in v1.0
```

The DPS Cost multiplier was increased from 2.0 to 2.67 to partially offset the lower DPS ratios.

---

## Background & Context (v1.0)

**Note**: This section describes the original v1.0 design. See "Version 1.1 Updates" above for combat rebalancing changes.

### Original State (v1.0)

**What Exists:**
- ✅ 23 weapons implemented in database and seed data
- ✅ Weapon purchase system functional
- ✅ Weapon inventory management working
- ✅ Loadout system with 4 types (single, weapon_shield, two_handed, dual_wield)
- ✅ 23 robot attributes that weapons can modify
- ✅ Combat system using weapon damage and cooldown

**What Was Fixed in v1.0:**
- ✅ Established consistent pricing formula
- ✅ Set Practice Sword as ₡50,000 baseline
- ✅ Implemented exponential attribute cost scaling
- ✅ Added DPS-based pricing component
- ✅ Balanced weapon catalog across loadout types

**What Changed in v1.1:**
- ✅ Updated all weapon damage values (20-33% reduction)
- ✅ Adjusted DPS baseline from 3.33 to 2.67
- ✅ Increased DPS Cost multiplier to 2.67
- ✅ Prices reduced by 15-20% (acceptable trade-off)

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

### Core Principles

**1. Exponential Attribute Scaling**: A weapon with +10 to one attribute should cost MORE than a weapon with ten +1 bonuses across different attributes.

**Reasoning:**
- Concentrated bonuses create specialization and synergy
- Spreading bonuses dilutes impact due to diminishing returns
- High single-attribute values are exponentially more powerful in practice
- Example: +10 Combat Power affects all damage; ten +1s to random attributes have minimal impact each

**2. DPS (Damage Per Second) Matters**: Weapons with higher damage output or faster attack speed have inherently more combat value and should cost more.

**Reasoning:**
- A weapon with 20 damage and 2s cooldown (10 DPS) is objectively better than 10 damage with 3s cooldown (3.33 DPS)
- Fast weapons with low cooldown attack more frequently, dealing more damage over time
- High damage weapons deal more burst damage per hit
- DPS is the primary metric for weapon combat effectiveness

### Complete Pricing Formula

**Base Cost**: ₡50,000 (Practice Sword baseline - zero bonuses, baseline DPS)

**Component 1: Attribute Bonus Cost** (exponential scaling):
```
Attribute Cost = Σ(500 × bonus²) for all attribute bonuses
```

**Component 2: DPS Premium** (scales with combat effectiveness):
```
Baseline DPS = 10 damage / 3 seconds = 3.33 DPS (Practice Sword)
Weapon DPS = baseDamage / cooldown
DPS Ratio = Weapon DPS / Baseline DPS
DPS Cost = Base Cost × (DPS Ratio - 1.0) × 2.0

Example:
- Practice Sword: 10/3 = 3.33 DPS → Ratio 1.0 → No DPS premium
- Machine Gun: 10/2 = 5.00 DPS → Ratio 1.5 → Premium: 50k × 0.5 × 2.0 = ₡50,000
- Railgun: 55/6 = 9.17 DPS → Ratio 2.75 → Premium: 50k × 1.75 × 2.0 = ₡175,000
```

**Component 3: Hand Requirements** (multiply final cost):
```
One-handed: 1.0× (baseline)
Two-handed: 1.6× (occupies both slots, competes with dual-wield)
Shield: 0.9× (defensive, no damage output)
```

**Total Weapon Cost Formula**:
```
Total Cost = (Base Cost + Attribute Cost + DPS Cost) × Hand Multiplier

Where:
- Base Cost = ₡50,000
- Attribute Cost = Σ(500 × bonus²)
- DPS Cost = ₡50,000 × (DPS Ratio - 1.0) × 2.0
- DPS Ratio = (baseDamage / cooldown) / 3.33
- Hand Multiplier = 1.0 (one-handed), 1.6 (two-handed), or 0.9 (shield)
```

### Formula Examples

**Example 1: Practice Sword (Baseline)**
- Damage: 10, Cooldown: 3s, DPS: 3.33
- Bonuses: None (all 0)
- **Calculation**:
  - Base: ₡50,000
  - Attributes: 0
  - DPS: 50k × (1.0 - 1.0) × 2.0 = ₡0
  - Hand: 1.0×
  - **Total: ₡50,000**

**Example 2: Low DPS Weapon with Bonuses**
- Damage: 12, Cooldown: 3s, DPS: 4.0 (ratio 1.2)
- Bonuses: +3 to one attribute, +2 to another (balanced)
- **Calculation**:
  - Base: ₡50,000
  - Attributes: 500×3² + 500×2² = 4,500 + 2,000 = ₡6,500
  - DPS: 50k × (1.2 - 1.0) × 2.0 = 50k × 0.4 = ₡20,000
  - Subtotal: 50k + 6.5k + 20k = ₡76,500
  - Hand: 1.0×
  - **Total: ₡76,500 → ₡77,000 (rounded)**

**Example 3: High DPS Weapon**
- Damage: 20, Cooldown: 2s, DPS: 10.0 (ratio 3.0)
- Bonuses: +5 to one attribute, +3 to another
- **Calculation**:
  - Base: ₡50,000
  - Attributes: 500×5² + 500×3² = 12,500 + 4,500 = ₡17,000
  - DPS: 50k × (3.0 - 1.0) × 2.0 = 50k × 4.0 = ₡200,000
  - Subtotal: 50k + 17k + 200k = ₡267,000
  - Hand: 1.0×
  - **Total: ₡267,000**

**Example 4: Two-Handed High DPS Weapon**
- Damage: 45, Cooldown: 5s, DPS: 9.0 (ratio 2.7)
- Bonuses: +7 Combat Power, +6 Critical Systems
- **Calculation**:
  - Base: ₡50,000
  - Attributes: 500×7² + 500×6² = 24,500 + 18,000 = ₡42,500
  - DPS: 50k × (2.7 - 1.0) × 2.0 = 50k × 3.4 = ₡170,000
  - Subtotal: 50k + 42.5k + 170k = ₡262,500
  - Hand: 1.6× (two-handed)
  - **Total: 262.5k × 1.6 = ₡420,000**

**Key Observations**: 
- DPS has massive impact on pricing - high DPS weapons are significantly more expensive
- Attribute bonuses add moderate cost via exponential scaling
- Two-handed multiplier applies after all other calculations
- Weapons with similar DPS but different attribute distributions have different total costs

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

**Shield Weapons**: Shields have no DPS component (defensive only), so their cost is Base + Attributes × 0.9

### Price Ranges

Based on the complete formula with DPS factored in, weapons now fall into these tiers:

- **Budget Tier** (₡50,000 - ₡100,000): Low DPS, minimal bonuses
- **Mid Tier** (₡100,000 - ₡200,000): Moderate DPS, balanced bonuses
- **Premium Tier** (₡200,000 - ₡300,000): High DPS, specialized bonuses
- **Elite Tier** (₡400,000+): Very high DPS, maximum specialization

**Key Insight**: DPS now dominates pricing. Weapons with similar attribute bonuses but higher DPS cost significantly more.

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
- Laser Pistol (₡75K) - budget
- Assault Rifle (₡150K) - mid
- Plasma Rifle (₡220K) - premium

**Weapon + Shield (one-handed main + shield offhand)**:
- Light Shield (₡50K) - budget shield
- Combat Shield (₡80K) - mid shield
- Reactive Shield (₡90K) - premium shield
- Can use any one-handed weapon in main slot

**Two-Handed (two-handed weapon, both slots)**:
- Shotgun (₡325K) - high-burst specialist
- Grenade Launcher (₡325K) - area damage
- Sniper Rifle (₡425K) - precision elite
- Battle Axe (₡430K) - melee powerhouse
- Plasma Cannon (₡440K) - energy elite
- Heavy Hammer (₡490K) - maximum impact
- Railgun (₡545K) - ultra penetration
- Ion Beam (₡565K) - supreme elite

**Dual-Wield (one-handed in both slots)**:
- Machine Pistol (₡75K) - budget
- Machine Gun (₡120K) - mid
- Plasma Blade (₡215K) - premium
- Power Sword (₡280K) - elite

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

**Pricing Calculation**: 
- Base: ₡50,000
- Attributes: 0
- DPS: 10/3 = 3.33 (ratio 1.0) → DPS Cost: ₡0
- Total: ₡50,000

---

### Budget Tier (₡50,000 - ₡100,000)

#### 2. Machine Pistol
- **Cost**: ₡75,000
- **Type**: Ballistic
- **Hands**: One-handed
- **Damage**: 8
- **Cooldown**: 2 seconds
- **Bonuses**: 
  - Attack Speed: +3
  - Weapon Control: +2
- **Description**: Rapid-fire sidearm with quick attacks
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×3² + 500×2² = ₡6,500
- DPS: 8/2 = 4.0 (ratio 1.2) → DPS Cost: 50k × 0.2 × 2.0 = ₡20,000
- Total: (50k + 6.5k + 20k) × 1.0 = ₡76,500 → ₡75,000

#### 3. Laser Pistol
- **Cost**: ₡75,000
- **Type**: Energy
- **Hands**: One-handed
- **Damage**: 12
- **Cooldown**: 3 seconds
- **Bonuses**:
  - Targeting Systems: +3
  - Combat Power: +2
- **Description**: Precise energy sidearm with good accuracy
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×3² + 500×2² = ₡6,500
- DPS: 12/3 = 4.0 (ratio 1.2) → DPS Cost: 50k × 0.2 × 2.0 = ₡20,000
- Total: (50k + 6.5k + 20k) × 1.0 = ₡76,500 → ₡75,000

#### 4. Combat Knife
- **Cost**: ₡90,000
- **Type**: Melee
- **Hands**: One-handed
- **Damage**: 9
- **Cooldown**: 2 seconds
- **Bonuses**:
  - Attack Speed: +3
  - Gyro Stabilizers: +1
- **Description**: Fast melee weapon for close combat
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×3² + 500×1² = ₡5,000
- DPS: 9/2 = 4.5 (ratio 1.35) → DPS Cost: 50k × 0.35 × 2.0 = ₡35,000
- Total: (50k + 5k + 35k) × 1.0 = ₡90,000

#### 5. Shotgun
- **Cost**: ₡325,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×4² + 500×3² + 500×2² = ₡14,500
- DPS: 32/4 = 8.0 (ratio 2.4) → DPS Cost: 50k × 1.4 × 2.0 = ₡140,000
- Total: (50k + 14.5k + 140k) × 1.6 = ₡327,200 → ₡325,000

#### 6. Light Shield
- **Cost**: ₡50,000
- **Type**: Shield
- **Hands**: Shield
- **Damage**: 0 (defensive)
- **Cooldown**: N/A
- **Bonuses**:
  - Armor Plating: +3
  - Shield Capacity: +2
- **Description**: Basic defensive shield for protection
- **Loadout**: Weapon+Shield only

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×3² + 500×2² = ₡6,500
- DPS: N/A (shield, no DPS cost)
- Total: (50k + 6.5k) × 0.9 = ₡50,850 → ₡50,000

#### 7. Machine Gun
- **Cost**: ₡120,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×3² + 500×5² + 500×2² = ₡19,000
- DPS: 10/2 = 5.0 (ratio 1.5) → DPS Cost: 50k × 0.5 × 2.0 = ₡50,000
- Total: (50k + 19k + 50k) × 1.0 = ₡119,000 → ₡120,000

---

### Mid Tier (₡100,000 - ₡200,000)

#### 8. Combat Shield
- **Cost**: ₡80,000
- **Type**: Shield
- **Hands**: Shield
- **Damage**: 0 (defensive)
- **Cooldown**: N/A
- **Bonuses**:
  - Armor Plating: +6
  - Shield Capacity: +5
  - Counter Protocols: +3
  - Evasion Thrusters: -2 (heavy)
- **Description**: Heavy-duty shield with counter capabilities
- **Loadout**: Weapon+Shield only

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×6² + 500×5² + 500×3² + 500×2² = ₡37,000
- DPS: N/A (shield, no DPS cost)
- Total: (50k + 37k) × 0.9 = ₡78,300 → ₡80,000

#### 9. Assault Rifle
- **Cost**: ₡150,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×4² + 500×4² + 500×3² + 500×2² = ₡22,500
- DPS: 18/3 = 6.0 (ratio 1.8) → DPS Cost: 50k × 0.8 × 2.0 = ₡80,000
- Total: (50k + 22.5k + 80k) × 1.0 = ₡150,000

#### 10. Battle Axe
- **Cost**: ₡430,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×6² + 500×4² + 500×3² + 500×2² = ₡32,500
- DPS: 38/4 = 9.5 (ratio 2.85) → DPS Cost: 50k × 1.85 × 2.0 = ₡185,000
- Total: (50k + 32.5k + 185k) × 1.6 = ₡430,000

#### 11. Laser Rifle
- **Cost**: ₡195,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×5² + 500×4² + 500×3² + 500×2² = ₡27,000
- DPS: 22/3 = 7.33 (ratio 2.2) → DPS Cost: 50k × 1.2 × 2.0 = ₡120,000
- Total: (50k + 27k + 120k) × 1.0 = ₡195,000

#### 12. Plasma Blade
- **Cost**: ₡215,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×5² + 500×4² + 500×3² + 500×2² = ₡27,000
- DPS: 20/2.5 = 8.0 (ratio 2.4) → DPS Cost: 50k × 1.4 × 2.0 = ₡140,000
- Total: (50k + 27k + 140k) × 1.0 = ₡215,000

#### 13. Plasma Rifle
- **Cost**: ₡220,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×6² + 500×4² + 500×3² + 500×2² = ₡32,500
- DPS: 24/3 = 8.0 (ratio 2.4) → DPS Cost: 50k × 1.4 × 2.0 = ₡140,000
- Total: (50k + 32.5k + 140k) × 1.0 = ₡220,000

### Premium Tier (₡200,000 - ₡400,000)

#### 14. Power Sword
- **Cost**: ₡280,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×7² + 500×5² + 500×4² + 500×3² = ₡49,500
- DPS: 28/3 = 9.33 (ratio 2.8) → DPS Cost: 50k × 1.8 × 2.0 = ₡180,000
- Total: (50k + 49.5k + 180k) × 1.0 = ₡280,000

#### 15. Plasma Cannon
- **Cost**: ₡440,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×7² + 500×6² + 500×4² + 500×3² = ₡55,000
- DPS: 45/5 = 9.0 (ratio 2.7) → DPS Cost: 50k × 1.7 × 2.0 = ₡170,000
- Total: (50k + 55k + 170k) × 1.6 = ₡440,000

#### 16. Heavy Hammer
- **Cost**: ₡490,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×8² + 500×7² + 500×4² + 500×3² = ₡69,000
- DPS: 48/5 = 9.6 (ratio 2.88) → DPS Cost: 50k × 1.88 × 2.0 = ₡188,000
- Total: (50k + 69k + 188k) × 1.6 = ₡490,000

### Elite Tier (₡400,000+)

#### 17. Railgun
- **Cost**: ₡545,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×12² + 500×7² + 500×5² + 500×4² = ₡117,000
- DPS: 55/6 = 9.17 (ratio 2.75) → DPS Cost: 50k × 1.75 × 2.0 = ₡175,000
- Total: (50k + 117k + 175k) × 1.6 = ₡545,000

#### 18. Ion Beam
- **Cost**: ₡565,000
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
- **Cost**: ₡190,000
- **Type**: Melee
- **Hands**: One-handed
- **Damage**: 18
- **Cooldown**: 2.5 seconds
- **Bonuses**:
  - Attack Speed: +5
  - Hydraulic Systems: +4
  - Weapon Control: +3
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×5² + 500×4² + 500×3² = ₡25,000
- DPS: 18/2.5 = 7.2 (ratio 2.16) → DPS Cost: 50k × 1.16 × 2.0 = ₡116,000
- Total: (50k + 25k + 116k) × 1.0 = ₡191,000 → ₡190,000

#### 20. Burst Rifle
- **Cost**: ₡145,000
- **Type**: Ballistic
- **Hands**: One-handed
- **Damage**: 15
- **Cooldown**: 2.5 seconds
- **Bonuses**:
  - Attack Speed: +4
  - Targeting Systems: +3
  - Critical Systems: +3
- **Loadout**: Single, Weapon+Shield, Dual-Wield

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×4² + 500×3² + 500×3² = ₡17,000
- DPS: 15/2.5 = 6.0 (ratio 1.8) → DPS Cost: 50k × 0.8 × 2.0 = ₡80,000
- Total: (50k + 17k + 80k) × 1.0 = ₡147,000 → ₡145,000

### More Two-Handed Options

#### 21. Sniper Rifle
- **Cost**: ₡425,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×8² + 500×6² + 500×5² + 500×3² = ₡67,000
- DPS: 50/6 = 8.33 (ratio 2.5) → DPS Cost: 50k × 1.5 × 2.0 = ₡150,000
- Total: (50k + 67k + 150k) × 1.6 = ₡427,200 → ₡425,000

#### 22. Grenade Launcher
- **Cost**: ₡325,000
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

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×6² + 500×5² + 500×4² + 500×3² = ₡43,000
- DPS: 35/5 = 7.0 (ratio 2.1) → DPS Cost: 50k × 1.1 × 2.0 = ₡110,000
- Total: (50k + 43k + 110k) × 1.6 = ₡324,800 → ₡325,000

### Additional Shield Option

#### 23. Reactive Shield
- **Cost**: ₡90,000
- **Type**: Shield
- **Hands**: Shield
- **Damage**: 0 (defensive)
- **Cooldown**: N/A
- **Bonuses**:
  - Shield Capacity: +7
  - Counter Protocols: +6
  - Power Core: +4
  - Servo Motors: -2 (integrated systems)
- **Description**: Advanced shield with energy-reactive plating
- **Loadout**: Weapon+Shield only

**Calculation**: 
- Base: ₡50,000
- Attributes: 500×7² + 500×6² + 500×4² + 500×2² = ₡52,500
- DPS: N/A (shield, no DPS cost)
- Total: (50k + 52.5k) × 0.9 = ₡92,250 → ₡90,000

---

## Final Weapon Catalog Summary

### By Loadout Type

**Single (one-handed only)**:
- Practice Sword (₡50K)
- Machine Pistol (₡75K)
- Laser Pistol (₡75K)
- Combat Knife (₡90K)
- Burst Rifle (₡145K)
- Assault Rifle (₡150K)
- Energy Blade (₡190K)
- Laser Rifle (₡195K)
- Plasma Blade (₡215K)
- Plasma Rifle (₡220K)
- Power Sword (₡280K)

**Weapon + Shield** (one-handed + shield):
- All one-handed weapons above
- Light Shield (₡50K)
- Combat Shield (₡80K)
- Reactive Shield (₡90K)

**Two-Handed**:
- Shotgun (₡325K)
- Grenade Launcher (₡325K)
- Sniper Rifle (₡425K)
- Battle Axe (₡430K)
- Plasma Cannon (₡440K)
- Heavy Hammer (₡490K)
- Railgun (₡545K)
- Ion Beam (₡565K)

**Dual-Wield** (two one-handed):
- All one-handed weapons except shields

### By Type

**Energy Weapons** (7):
- Laser Pistol, Laser Rifle, Plasma Rifle, Energy Blade, Plasma Blade, Plasma Cannon, Ion Beam

**Ballistic Weapons** (8):
- Machine Pistol, Machine Gun, Shotgun, Assault Rifle, Burst Rifle, Grenade Launcher, Sniper Rifle, Railgun

**Melee Weapons** (7):
- Practice Sword, Combat Knife, Battle Axe, Heavy Hammer, Plasma Blade, Power Sword, Energy Blade

**Shield Weapons** (3):
- Light Shield, Combat Shield, Reactive Shield

### Price Distribution

- **₡50K-₡100K**: 6 weapons (budget tier) - Practice Sword, Light Shield, Machine Pistol, Laser Pistol, Combat Shield, Reactive Shield, Combat Knife
- **₡100K-₡200K**: 5 weapons (mid tier) - Machine Gun, Burst Rifle, Assault Rifle, Energy Blade, Laser Rifle
- **₡200K-₡300K**: 4 weapons (premium tier) - Plasma Blade, Plasma Rifle, Power Sword
- **₡300K-₡600K**: 8 weapons (elite tier) - Shotgun, Grenade Launcher, Sniper Rifle, Battle Axe, Plasma Cannon, Heavy Hammer, Railgun, Ion Beam

**Total**: 23 weapons

**Key Insight with DPS Pricing**: Two-handed weapons with high DPS now cost significantly more (₡300K-₡600K), properly reflecting their combat effectiveness. This makes dual-wielding two mid-tier one-handed weapons (2× ₡150K = ₡300K) a competitive alternative to a single elite two-handed weapon.

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
  
  // Calculate DPS cost (skip for shields)
  let dpsCost = 0;
  if (weapon.handsRequired !== 'shield') {
    const weaponDPS = weapon.baseDamage / weapon.cooldown;
    const dpsRatio = weaponDPS / BASELINE_DPS;
    dpsCost = BASE_COST * (dpsRatio - 1.0) * 2.0;
  }
  
  let subtotal = BASE_COST + attributeCost + dpsCost;
  
  // Apply hand requirement modifiers
  if (weapon.handsRequired === 'two') {
    subtotal *= 1.6;
  } else if (weapon.handsRequired === 'shield') {
    subtotal *= 0.9;
  }
  
  return Math.round(subtotal);
}
```

### Validation Rules

**Minimum Weapon Cost**: ₡50,000 (baseline, no bonuses, baseline DPS)

**Maximum Weapon Cost**: No hard cap, but practically limited by:
- Attribute ranges (max +15 per attribute)
- DPS limits (damage and cooldown constraints)
- Typical range: ₡50K-₡600K

**Negative Bonuses**: Counted as positive in cost calculation (trade-offs still add complexity)

**Zero-Bonus Weapons**: Only Practice Sword should have all zero bonuses

**Shield Weapons**: No DPS cost component, only base + attributes × 0.9

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
