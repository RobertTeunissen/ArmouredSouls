# Product Requirements Document: Economy System

**Last Updated**: February 3, 2026  
**Status**: Design Document  
**Owner**: Robert Teunissen  
**Epic**: Economy System Implementation

---

## Executive Summary

This PRD defines the complete economy system for Armoured Souls, covering all cost centers (what costs money), revenue streams (how stables earn money), and the daily financial reporting system. The economy system creates strategic depth by requiring players to balance investments, operating costs, and revenue generation while managing their stable and robot roster.

**Success Criteria**: Players understand all cost centers and revenue streams, can make informed economic decisions, and receive clear daily financial reports showing their stable's economic health.

---

## Table of Contents

1. [Background & Context](#background--context)
2. [Economy Overview](#economy-overview)
3. [Cost Centers (What Costs Money)](#cost-centers-what-costs-money)
4. [Revenue Streams (How Stables Earn Money)](#revenue-streams-how-stables-earn-money)
5. [Daily Financial System](#daily-financial-system)
6. [Economic Balance & Progression](#economic-balance--progression)
7. [Implementation Recommendations](#implementation-recommendations)
8. [Success Metrics](#success-metrics)

---

## Background & Context

### Current State

**What Exists:**
- ✅ Currency system (Credits - ₡) defined in ROBOT_ATTRIBUTES.md
- ✅ Complete facility system with costs in STABLE_SYSTEM.md
- ✅ Weapon catalog with prices in WEAPONS_AND_LOADOUT.md
- ✅ Robot attribute upgrade costs in ROBOT_ATTRIBUTES.md
- ✅ Repair cost formulas with multipliers
- ✅ Daily income/expense system conceptually designed
- ✅ Database schema for all economic tracking (DATABASE_SCHEMA.md)

**What's Missing:**
- ❌ Comprehensive economy documentation consolidating all sources
- ❌ Daily financial reporting UI implementation
- ❌ Economic dashboard showing trends and projections
- ❌ Tutorial/onboarding explaining economic systems
- ❌ Economic alerts (low funds, unprofitable operations, etc.)
- ❌ Historical tracking of financial performance

### Design References

- **[PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)**: Complete prestige and fame system specification (earning, benefits)
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)**: Facility costs, economic formulas, daily income/expense examples
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)**: Upgrade costs, repair formulas, currency definition, and fame tracking
- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**: Weapon prices and crafting costs
- **[GAME_DESIGN.md](GAME_DESIGN.md)**: Overall economic philosophy and progression
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)**: Data model for tracking resources
- **[PRD_WEAPON_ECONOMY_OVERHAUL.md](PRD_WEAPON_ECONOMY_OVERHAUL.md)**: Weapon economy, 23 starting weapons.

---

## Economy Overview

### Currency System

**Primary Currency: Credits (₡)**
- Symbol: ₡ (Costa Rican colón symbol, chosen for robotic/technical aesthetic)
- Starting balance: **₡2,000,000** per player
- Precision: Whole numbers only (no decimals)
- Range: 0 to 999,999,999,999 (database supports up to ~2 billion)

**Secondary Resource: Prestige (Stable-Level)**
- **See [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)**
- Not a spendable currency - acts as unlock threshold
- Earned through victories, achievements, milestones, tournaments
- Never decreases (only increases)
- Used to unlock facility levels and high-tier content
- Scales merchandising income
- Provides battle winnings multiplier

**Tertiary Resource: Fame (Robot-Level)**
- **See [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)**
- Individual robot reputation (separate from stable prestige)
- Earned through individual robot victories with performance bonuses
- Tracked per robot, aggregated for stable-level calculations
- Used in streaming revenue calculations (aggregate)
- Displayed for competitive rankings

### Economic Philosophy

1. **Multiple Paths to Success**: Players can focus on quality (one powerful robot), quantity (multiple robots), or specialization (weapon trading, specific tournaments, 2v2 or other team battles)
2. **Meaningful Choices**: Every purchase should have trade-offs and alternatives
3. **Sustainable Operations**: Players should be able to run profitable stables with proper management
4. **Risk/Reward Balance**: Higher risks (low yield threshold, aggressive facilities) offer higher rewards
5. **Long-Term Planning**: Facility investments pay off over time, encouraging strategic thinking

---

## Cost Centers (What Costs Money)

All costs are paid in Credits (₡). This section consolidates every way players spend money.

### 1. Robot Acquisition & Upgrades

#### Robot Frame Purchase
- **Cost**: ₡500,000 per robot (bare metal chassis)
- **Includes**: Robot with all 23 attributes at level 1
- **Starting HP**: Full health (max HP determined by Hull Integrity attribute)
- **Starting Shields**: Full shields (max determined by Shield Capacity attribute)
- **One-time cost**: No recurring fees for owning robot

**Formula**:
```
robot_purchase_cost = 500,000 Credits
```

#### Attribute Upgrades
- **Formula**: `(current_level + 1) × 1,000` Credits per level
- **Range**: Level 1 → 50
- **23 Attributes Total** (see ROBOT_ATTRIBUTES.md for complete list)

**Examples**:
- Level 1→2: ₡2,000
- Level 2→3: ₡3,000
- Level 10→11: ₡11,000
- Level 49→50: ₡50,000

**Total Cost to Max One Attribute** (1→50):
```
sum = Σ(n+1) × 1,000 for n=1 to 49
    = (2 + 3 + 4 + ... + 50) × 1,000
    = 1,274 × 1,000
    = ₡1,274,000
```

**Total Cost to Max All 23 Attributes** (all 1→50):
```
total_max_cost = 23 × 1,274,000 = ₡29,302,000
```

**Facility Discount: Training Facility**
- Provides 5% to 50% discount based on level (see section 2 below)
- Discount applies to base upgrade cost before calculation
- Formula with discount:
  ```
  discount = training_facility_level × 5  // 0% to 50%
  upgrade_cost = (current_level + 1) × 1,000 × (1 - discount/100)
  ```

**Training Facility ROI Analysis**:

*Upgrading from level 1→10 (hitting first cap) for all 23 attributes:*
- Cost per attribute (1→10): (2+3+4+5+6+7+8+9+10+11) × ₡1,000 = ₡54,000
- Total for all 23 attributes: 23 × ₡54,000 = **₡1,242,000**

*With Training Facility Level 1 (5% discount):*
- Training Facility cost: ₡300,000
- Cost per attribute (1→10) with discount: ₡54,000 × 0.95 = ₡51,300
- Total for all 23 attributes: 23 × ₡51,300 = ₡1,179,900
- **Savings**: ₡1,242,000 - ₡1,179,900 = ₡62,100
- **Net cost with facility**: ₡300,000 + ₡1,179,900 = ₡1,479,900
- **vs without facility**: ₡1,242,000

**Conclusion**: Training Facility Level 1 is NOT cost-effective for early game (1→10 upgrades). It only becomes valuable when upgrading to higher levels or when upgrading multiple robots. 
**Recommendation**: Prioritize attribute upgrades first, purchase Training Facility later when preparing for level 15+ upgrades or when managing 2+ robots.

### 2. Facility Purchases & Upgrades

**14 Facility Types**, most with **10 upgrade levels** (Level 0 = not purchased, Levels 1-10 = upgraded). Some levels require prestige thresholds (Roster Expansion is the only facility with 9 levels. 

**Purchase Costs Summary** (Level 1 costs for each facility):

| Facility | Level 1 Cost | Operating Cost/Day |
|----------|-------------|-------------------|
| 1. Repair Bay | ₡200,000 | ₡1,000 |
| 2. Training Facility | ₡300,000 | ₡1,500 |
| 3. Weapons Workshop | ₡250,000 | ₡1,000 |
| 4. Research Lab | ₡400,000 | ₡2,000 |
| 5. Medical Bay | ₡350,000 | ₡2,000 |
| 6. Roster Expansion | ₡300,000 | ₡500/slot |
| 7. Storage Facility | ₡150,000 | ₡500 |
| 8. Coaching Staff | ₡500,000 | ₡3,000 when active |
| 9. Booking Office | ₡500,000 | ₡0 (generates prestige) |
| 10. Combat Training Academy | ₡400,000 | ₡800 |
| 11. Defense Training Academy | ₡400,000 | ₡800 |
| 12. Mobility Training Academy | ₡400,000 | ₡800 |
| 13. AI Training Academy | ₡500,000 | ₡1,000 |
| 14. Income Generator | ₡800,000 | ₡1,000 |

**Total Cost to Purchase All Facilities (Level 1)**: ₡5,450,000

**Upgrade Cost Scaling**:
- Most facilities: Cost increases by ~₡200K-₡400K per level
- Higher levels (7-10) often have prestige requirements
- Total cost to max one facility: ~₡2M-₡5M (varies by facility)

**See [STABLE_SYSTEM.md](STABLE_SYSTEM.md#facility-system) for complete facility details, level costs, and benefits.**

### 3. Weapon Purchases

**Phase 1 Implemented Weapons** (11 total):

--> This is not up to date. Refer to PRD_WEAPON_ECONOMY_OVERHAUL.md for up to date information. This PRD has been implemented and has 23 weapons currently in the seed.js. 


| Weapon | Type | Cost | Hands Required |
|--------|------|------|----------------|
| Practice Sword | Melee | ₡0 (FREE) | One |
| Machine Gun | Ballistic | ₡100,000 | One |
| Combat Shield | Shield | ₡100,000 | Shield |
| Shotgun | Ballistic | ₡120,000 | Two |
| Laser Rifle | Energy | ₡150,000 | One |
| Power Sword | Melee | ₡180,000 | One |
| Hammer | Melee | ₡200,000 | Two |
| Plasma Blade | Melee | ₡250,000 | One |
| Plasma Cannon | Energy | ₡300,000 | Two |
| Railgun | Ballistic | ₡350,000 | Two |
| Ion Beam | Energy | ₡400,000 | Two |


**Weapon Pricing Methodology**:

--> This is not up to date. Refer to PRD_WEAPON_ECONOMY_OVERHAUL.md for up to date information. This PRD has been implemented.

Weapon prices are based on total attribute bonuses provided:

1. **Base Price**: ₡50,000 (starter weapon baseline)
2. **Attribute Bonus Value**: Each +1 attribute bonus = ₡15,000-₡20,000
3. **Special Property Premium**: +₡30,000-₡50,000 for unique effects
4. **Hand Requirement Modifier**: Two-handed weapons typically 1.5-2x more expensive

--> This is not up to date. Refer to PRD_WEAPON_ECONOMY_OVERHAUL.md for up to date information. This PRD has been implemented.

*Examples:*
- **Machine Gun** (₡100K): +11 attribute points × ₡9K ≈ ₡100K
- **Power Sword** (₡180K): +14 attribute points × ₡12.9K ≈ ₡180K
- **Railgun** (₡350K): +14 attribute points + high penetration special = ₡350K

--> This is not up to date. Refer to PRD_WEAPON_ECONOMY_OVERHAUL.md for up to date information. This PRD has been implemented.

**Weapons vs Academy Investment**:
- **Academy** (₡400K): Unlocks attribute cap 10→15 for 5-6 attributes in category
  - Allows +5 levels per attribute = potential +30 total attribute points across category
  - Permanent benefit, applies to all future robots
- **Premium Weapon** (₡300K): Provides immediate +15-20 attribute points
  - Immediate benefit, can be swapped between robots
  - No operating cost
 
--> This is not up to date. Refer to PRD_WEAPON_ECONOMY_OVERHAUL.md for up to date information. This PRD has been implemented.

**Strategy Comparison**:
- **Early Game**: Weapons provide faster power spike with lower upfront cost
- **Mid-Late Game**: Academies provide better long-term value for multiple robots
- **Optimal**: Mix of both - key weapons for immediate power, academies for scaling

**Dual Weapon vs Single Weapon**:
- **Dual Wield** (e.g., 2× Machine Guns = ₡200K): +22 attribute points
- **Single Two-Handed** (e.g., Railgun = ₡350K): +14 attribute points + special properties
- **Weapon + Shield** (e.g., Power Sword + Combat Shield = ₡280K): +33 attribute points (offensive + defensive)

Balance: Dual weapons provide more raw stat bonuses. Two-handed weapons provide special properties. Both strategies are viable depending on build focus. 

**Weapon Range**: ₡0 (free starter) to ₡400,000

--> This is not up to date. Refer to PRD_WEAPON_ECONOMY_OVERHAUL.md for up to date information. This PRD has been implemented.

**Weapon Ownership**:
- Weapons are purchased and placed in stable's weapon storage
- Each purchase creates separate inventory item (can own multiple copies)
- Weapon can only be equipped to one robot at a time
- To use same weapon on multiple robots, purchase multiple copies

**Storage Limits**:
- Default capacity: 5 weapons (Storage Facility Level 0)
- Maximum capacity: 55 weapons (Storage Facility Level 10)
- Storage includes both equipped and unequipped weapons

**Facility Discount: Weapons Workshop**
- Provides 5% to 50% discount based on level
- Formula:
  ```
  discount = weapons_workshop_level × 5  // 0% to 50%
  weapon_cost = base_price × (1 - discount/100)
  ```

**Examples**:
- Plasma Cannon (₡300,000) with Workshop Level 5:
  - Discount: 25%
  - Final cost: ₡300,000 × 0.75 = ₡225,000
 
--> This is not up to date. Refer to PRD_WEAPON_ECONOMY_OVERHAUL.md for up to date information. This PRD has been implemented.

### 4. Weapon Crafting (Unlockable)

**Requirements**:
- Weapons Workshop Level 3+ (unlocks weapon modifications)
- Weapons Workshop Level 6+ (unlocks custom weapon design)
- Weapons Workshop Level 10 (unlocks legendary weapon crafting)
- 10+ battles with similar weapon types
- Minimum 5,000 prestige

**Crafting Costs** (Aligned with catalog weapon pricing):
- Base weapon template: ₡50,000
- Attribute bonus allocation: ₡15,000-₡20,000 per +1 attribute point
- Maximum attribute point budget: 20 points for Level 6, 25 points for Level 10
- Special properties: **Future feature** (not yet implemented in battle system)

**Example Custom Weapon** (Workshop Level 6):
- Base template: ₡50,000
- +15 attribute points: 15 × ₡17,000 = ₡255,000
- **Total**: ₡305,000 (comparable to Plasma Cannon at ₡300,000)

**Example Legendary Weapon** (Workshop Level 10):
- Base template: ₡50,000
- +25 attribute points: 25 × ₡17,000 = ₡425,000
- **Total**: ₡475,000 (premium tier, beyond catalog weapons)

**Note**: Custom weapons use the same pricing formula as catalog weapons. The 11 catalog weapons serve as reference examples that could be crafted using this system. Special properties (e.g., "ignores armor", "shield drain") will be added in future phases when implemented in the battle system. 

### 5. Repair Costs

**Base Formula**:
```
base_repair = (sum_of_all_23_attributes × 100)
damage_percentage = damage_taken / max_hp

// Apply multiplier based on condition
if robot_destroyed (HP = 0):
    multiplier = 2.0
elif robot_heavily_damaged (HP < 10%):
    multiplier = 1.5
else:
    multiplier = 1.0

repair_cost_before_discounts = base_repair × damage_percentage × multiplier
```

**Facility Discounts**:

1. **Repair Bay** (all repairs):
   - Discount: 5% to 50% (Level 1-10)
   - Formula: `discount = repair_bay_level × 5%`

2. **Medical Bay** (critical damage only, HP = 0):
   - Reduces critical damage multiplier (2.0x) by 10%-100%
   - Formula: `effective_multiplier = 2.0 × (1 - medical_bay_level × 0.1)`
   - Level 10: Eliminates critical damage penalty entirely

**Repair Bay ROI Analysis**:
- Average robot (230 total attributes): Base repair cost = ₡23,000
- Average damage per battle: 40-60% HP (₡9,200-₡13,800 repair cost)
- **Repair Bay Level 1** (₡200K, 5% discount):
  - Saves ₡460-₡690 per battle
  - Payback: 290-435 battles
  - At 7 battles/week: **41-62 weeks** to break even
- **Repair Bay Level 5** (₡1M total, 25% discount):
  - Saves ₡2,300-₡3,450 per battle
  - Incremental cost from Level 1: ₡800K
  - Payback for incremental investment: 232-348 battles (**33-50 weeks**)

**Conclusion**: Repair Bay provides long-term value but requires sustained play to recoup investment. Most beneficial for players with multiple robots or those planning long-term engagement.

**Final Repair Cost Formula**:
```
// Step 1: Calculate base repair with multiplier
base_repair = sum_of_attributes × 100
repair_before_discounts = base_repair × damage_percentage × condition_multiplier

// Step 2: Apply Medical Bay if critical damage
if HP = 0 AND medical_bay_level > 0:
    medical_reduction = medical_bay_level × 0.1
    effective_multiplier = 2.0 × (1 - medical_reduction)
    repair_before_discounts = base_repair × damage_percentage × effective_multiplier

// Step 3: Apply Repair Bay discount
repair_bay_discount = repair_bay_level × 0.05
final_repair_cost = repair_before_discounts × (1 - repair_bay_discount)
```

**Example**:
- Robot with 230 total attributes (sum of all 23)
- Started battle with 100 HP
- Took 100 damage during battle (reduced to 0 HP = destroyed)
- Repair Bay Level 5, Medical Bay Level 3

```
base_repair = 230 × 100 = ₡23,000
damage_percentage = 100/100 = 1.0  // 100% damage (complete destruction)

// Critical damage multiplier with Medical Bay
medical_reduction = 3 × 0.1 = 0.3
effective_multiplier = 2.0 × (1 - 0.3) = 1.4

repair_before_discount = 23,000 × 1.0 × 1.4 = ₡32,200

// Repair Bay discount
repair_bay_discount = 5 × 0.05 = 0.25
final_repair_cost = 32,200 × (1 - 0.25) = ₡24,150
```

**Repair Timing**:
- Repairs must be paid between battles to restore robot to full HP
- Robot cannot participate in next battle until repaired
- HP does NOT regenerate automatically (must pay repair cost)
- Energy shields regenerate automatically between battles (no cost)

### 6. Operating Costs (Daily Recurring)

**Facility Operating Costs**:
Each facility has daily operating cost that scales with level.

**Formula** (varies by facility):
```
// Most facilities:
operating_cost = base_cost + (additional_cost × level)

// Examples:
Repair Bay: ₡1,000 + (₡500 × level)
Training Facility: ₡1,500 + (₡750 × level)
Research Lab: ₡2,000 + (₡1,000 × level)
```

**Special Cases**:
- **Roster Expansion**: ₡500/day per robot slot beyond first (first slot is free)

--> But still ₡500/day per level of Roster Expansion.

- **Coaching Staff**: ₡3,000/day when coach is active (only if Coaching Staff facility purchased)
- **Booking Office**: ₡0/day (generates prestige instead)

**Typical Daily Operating Costs by Game Stage**:
- **Early Game** (1 robot, 1-2 facilities): ₡2,500-₡5,000/day
- **Mid Game** (3-4 robots, 4-6 facilities): ₡15,000-₡25,000/day
- **Late Game** (6-10 robots, 10+ facilities): ₡40,000-₡60,000/day

**Note**: Early game players should prioritize attribute upgrades over multiple facilities. With only 1 robot, Storage Facility and Roster Expansion provide no benefit. **Recommended early facilities**: Repair Bay (long-term savings) and optionally one Academy (if pushing past level 10 cap). 

### 7. Coach Switching Cost

- **One-time cost**: ₡100,000 to switch active coach
- Only applies if Coaching Staff facility is purchased
- Coach daily operating cost: ₡3,000/day while active

### 8. Total Startup Costs

**Minimum Viable Stable** (₡1,500,000):
- 1 Robot: ₡500,000
- 1 Good weapon (e.g., Laser Rifle): ₡150,000
- Repair Bay Level 1: ₡200,000
- Basic attribute upgrades (50 levels): ~₡150,000
- Buffer for repairs and operations: ₡500,000

**Balanced Startup** (₡2,000,000 - recommended):
- 1 Robot: ₡500,000
- 1 Premium weapon (e.g., Plasma Cannon): ₡300,000
- Repair Bay Level 1: ₡200,000
- Training Facility Level 1: ₡300,000
- Moderate attribute upgrades (100 levels): ~₡350,000
- Buffer: ₡350,000

**Aggressive Startup** (₡2,000,000 - risky):
- 2 Robots: ₡1,000,000
- 2 Basic weapons (e.g., Machine Guns): ₡200,000
- Repair Bay Level 1: ₡200,000
- Minimal upgrades (50 levels split): ~₡150,000
- Buffer: ₡450,000

**Note on Buffers**: Players typically minimize buffers to maximize robot power. The game should include:
1. **Low balance warnings** (when balance < ₡100K)
2. **Bankruptcy protection** (prevent entering battles without repair funds)
3. **Credit loans** or **emergency funding** options for players who overextend

**Design Assumption**: Most players will maintain ₡5K-₡10K buffer minimum, not the recommended ₡500K.

--> Come up with alternate startup costs. Players will not keep a buffer. 

---

## Revenue Streams (How Stables Earn Money)

All revenue is earned in Credits (₡). This section consolidates every way players earn money.

### 1. Battle Winnings

**Victory Rewards by League**:

| League | Win Reward Range | Fame per Win | Prestige per Win |
|--------|-----------------|-------------|------------------|
| Bronze | ₡5,000 - ₡10,000 | +5 | +5 |
| Silver | ₡10,000 - ₡20,000 | +10 | +10 |
| Gold | ₡20,000 - ₡40,000 | +20 | +20 |
| Platinum | ₡40,000 - ₡80,000 | +30 | +30 |
| Diamond | ₡80,000 - ₡150,000 | +50 | +50 |
| Champion | ₡150,000 - ₡300,000 | +75 | +75 |

**Fame vs Prestige**:
- **Fame**: Robot-level reputation (individual robot stat)
- **Prestige**: Stable-level reputation (account-wide stat)
- Both earned from victories but tracked separately
- Fame used for robot rankings; Prestige unlocks stable content

**Battle Reward Formula**:
```
// Base reward determined by league tier
base_reward = league_base + (ELO_difference_bonus)

// ELO difference bonus
if opponent_ELO > your_ELO:
    ELO_bonus = (opponent_ELO - your_ELO) / 20  // Upset bonus
else:
    ELO_bonus = 0

// Final reward (before prestige multiplier)
battle_reward = min(base_reward + ELO_bonus, league_max)

// Example: Bronze league (₡5K-₡10K range)
// Your ELO: 1150, Opponent ELO: 1250
// base = ₡5,000
// ELO_bonus = (1250-1150)/20 = ₡5,000
// battle_reward = min(₡10,000, ₡10,000) = ₡10,000 (max for Bronze)
```

**Loss Economics**:
- Losses provide **₡0** Credits
- However, system designed for **90% win-rate breakeven** (without facilities)
- At 50% win rate: 3.5 wins/week × ₡7,500 avg = ₡26,250/week income
- Average repair cost: 1 robot × 7 battles × ₡9K = ₡63,000/week
- **Gap**: ₡36,750/week shortfall
- **Design solution**: Adjust base rewards OR reduce repair costs

**Revised Repair Cost Balance**:
To achieve 90% breakeven at 50% win rate:
- Target weekly income (3.5 wins): ₡26,250
- Target weekly costs (7 repairs): ₡23,625 (90% coverage)
- **Required**: Avg repair cost ≤ ₡3,375/battle (vs current ₡9K)
- **Options**:
  1. Reduce base repair formula: (attributes × 50) instead of (attributes × 100)
  2. Increase battle rewards: Bronze ₡10K-₡20K (doubled)
  3. Add "participation rewards": ₡2K-₡3K per battle (win or lose)
 
--> Participation awards is more rewarding for players. Revise the system and add participation awards for the losing robot. Since they lose they will probably have higher repair costs as well. 

### 2. Prestige Bonuses (Battle Multiplier)

> **For complete prestige earning mechanics**, see [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)

Higher stable prestige increases battle winnings:

| Prestige Threshold | Battle Winnings Bonus |
|-------------------|---------------------|
| 5,000+ | +5% |
| 10,000+ | +10% |
| 25,000+ | +15% |
| 50,000+ | +20% |

**Bonus Application**: Prestige bonus multiplies the base battle reward **AFTER** ELO calculation, extending beyond the league reward range.

**Prestige Accumulation Timeline**:
- Starting prestige: 0
- Bronze wins (+5 prestige each): 1,000 wins needed for 5,000 prestige threshold
- Average player (50% win rate, 7 battles/week): 3.5 wins/week = ~285 weeks (5.5 years)
- **More realistic**: Mix of leagues + achievements + tournaments
  - Bronze: 100 wins = +500 prestige
  - Silver: 100 wins = +1,000 prestige  
  - Gold: 50 wins = +1,000 prestige
  - Achievements: ~1,000 prestige
  - Tournaments: ~500 prestige
  - **Total to 5,000**: ~6-12 months of regular play

**"Win More" Concern**: 
- Yes, prestige rewards successful players with better rewards
- Counterbalance: ELO matchmaking ensures ~50% win rate long-term
- Benefit: Rewards player loyalty and continued engagement
- Alternative: Prestige could reduce operating costs instead of increasing income

**Formula**:
```
prestige_multiplier = 1.0

if prestige >= 50000:
    prestige_multiplier = 1.20
elif prestige >= 25000:
    prestige_multiplier = 1.15
elif prestige >= 10000:
    prestige_multiplier = 1.10
elif prestige >= 5000:
    prestige_multiplier = 1.05

final_battle_reward = base_reward × prestige_multiplier
```

**Example**:
- Bronze league win: ₡7,500 base (midpoint of ₡5K-₡10K range)
- Prestige: 12,000
- Multiplier: +10%
- Final reward: ₡7,500 × 1.10 = ₡8,250
- **Note**: Base reward midpoint is determined by ELO matchup. Closer matches → higher base (closer to ₡10K). Mismatched opponents → lower base (closer to ₡5K).

### 3. Merchandising Income (Income Generator Facility)

> **For complete prestige earning and benefits**, see [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)

**Requirements**:
- Income Generator Level 1+ (unlocks merchandising)

**Base Income by Level**:
- Level 1: ₡5,000/day
- Level 2: ₡8,000/day
- Level 4: ₡12,000/day
- Level 6: ₡18,000/day
- Level 8: ₡25,000/day
- Level 10: ₡35,000/day

**Scaling Formula**:
```
base_merchandising = income_generator_base_rate  // Based on level
prestige_multiplier = 1 + (stable_prestige / 10000)

merchandising_income = base_merchandising × prestige_multiplier
```

**Design Rationale**: Merchandising scales with **stable prestige** (not individual robot fame) because it represents the stable's overall brand value and reputation. Higher prestige stables can charge more for merchandise and attract more fans.

**Examples**:
*Early Game (Low Prestige):*
- Income Generator Level 1: ₡5,000/day base
- Stable prestige: 1,000
- Prestige multiplier: 1 + (1000/10000) = 1.1
- Daily income: ₡5,000 × 1.1 = ₡5,500/day
- Operating cost: ₡1,000/day
- **Net**: ₡4,500/day

*Mid Game (Moderate Prestige):*
- Income Generator Level 4: ₡12,000/day base
- Stable prestige: 15,000
- Prestige multiplier: 1 + (15000/10000) = 2.5
- Daily income: ₡12,000 × 2.5 = ₡30,000/day
- Operating cost: ₡3,000/day
- **Net**: ₡27,000/day

*Late Game (High Prestige):*
- Income Generator Level 10: ₡35,000/day base
- Stable prestige: 50,000
- Prestige multiplier: 1 + (50000/10000) = 6.0
- Daily income: ₡35,000 × 6.0 = ₡210,000/day
- Operating cost: ₡5,500/day
- **Net**: ₡204,500/day

**Operating Cost**: ₡1,000/day at Level 1, +₡500/day per level

**Design Note**: Prestige-based scaling rewards long-term player engagement and success across all robots in the stable.

### 4. Streaming Revenue (Income Generator Facility)

> **For complete fame earning and benefits**, see [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)

**Requirements**:
- Income Generator Level 3+ (unlocks streaming)

**Base Income by Level**:
- Level 3: ₡3,000/day
- Level 5: ₡6,000/day
- Level 7: ₡10,000/day
- Level 9: ₡15,000/day
- Level 10: ₡22,000/day

**Scaling Formula**:
```
base_streaming = income_generator_streaming_rate  // Based on level
battle_multiplier = 1 + (total_battles / 1000)  // Aggregate across ALL robots
fame_multiplier = 1 + (total_fame / 5000)  // Sum of ALL robot fame values

streaming_income = base_streaming × battle_multiplier × fame_multiplier
```

**Design Rationale**: Streaming scales with **aggregate battle count and total fame** across all robots because viewers watch the entire stable's content. More robots = more battles = more content = higher streaming revenue.

**Examples**:
*Single Robot (early game):*
- Income Generator Level 3: ₡3,000/day base
- Total battles (1 robot): 250
- Total fame (1 robot): 1,250
- Battle multiplier: 1 + (250/1000) = 1.25
- Fame multiplier: 1 + (1250/5000) = 1.25
- Daily income: ₡3,000 × 1.25 × 1.25 = ₡4,688/day

*Three Robots (mid game):*
- Income Generator Level 5: ₡6,000/day base
- Total battles: Robot 1 (500) + Robot 2 (300) + Robot 3 (100) = 900
- Total fame: Robot 1 (5,000) + Robot 2 (3,000) + Robot 3 (1,000) = 9,000
- Battle multiplier: 1 + (900/1000) = 1.9
- Fame multiplier: 1 + (9000/5000) = 2.8
- Daily income: ₡6,000 × 1.9 × 2.8 = ₡31,920/day

*Large Stable (late game):*
- Income Generator Level 10: ₡22,000/day base
- Total battles across 6 robots: 3,500
- Total fame across 6 robots: 25,000
- Battle multiplier: 1 + (3500/1000) = 4.5
- Fame multiplier: 1 + (25000/5000) = 6.0
- Daily income: ₡22,000 × 4.5 × 6.0 = ₡594,000/day

**Design Note**: Aggregate scaling strongly rewards multi-robot strategies and encourages building a roster of active, famous robots. Streaming income grows exponentially with stable size and activity. 

### 5. Tournament Winnings

**Status**: Tournament system not yet fully defined. Specifications below are preliminary and subject to change during tournament feature implementation.

**Tournament Types and Rewards** (preliminary):

| Tournament Type | Credits Prize | Prestige Bonus |
|----------------|--------------|----------------|
| Local | ₡50,000 - ₡100,000 | +100 |
| Regional | ₡150,000 - ₡300,000 | +250 |
| National | ₡400,000 - ₡800,000 | +500 |
| International | ₡1,000,000 - ₡2,000,000 | +1,000 |
| World Championship | ₡3,000,000 - ₡5,000,000 | +2,500 |

**Tournament Access**:
- Unlocked via Booking Office facility levels
- Higher levels provide access to higher-tier tournaments
- Booking Office also provides tournament reward bonuses (+10% to +40% at high levels)

### 6. Achievement Rewards

**Status**: Achievement system not yet fully defined. Specifications below are preliminary examples and subject to change during achievement feature implementation.

**Milestone Examples** (preliminary):
- First robot to ELO 1500: ₡50,000 + 50 prestige
- First robot to ELO 1800: ₡100,000 + 100 prestige
- First robot to ELO 2000: ₡200,000 + 200 prestige
- 100 total wins: ₡75,000 + 50 prestige
- 500 total wins: ₡300,000 + 250 prestige
- 1,000 total wins: ₡750,000 + 500 prestige

**Design Note**: Achievement rewards are one-time bonuses that encourage progression and provide economic boosts at key milestones.

---

## Prestige & Fame System

This section consolidates the complete prestige and fame earning mechanics. For detailed implementation, see [STABLE_SYSTEM.md](STABLE_SYSTEM.md#prestige-system).

--> No [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md) provides complete prestige and fame system specification (earning, benefits)

### Fame (Robot-Level Reputation)

**Definition**: Individual robot reputation earned from victories and performance.

**Earning Fame**:
- Win in Bronze league: +5 fame
- Win in Silver league: +10 fame
- Win in Gold league: +20 fame
- Win in Platinum league: +30 fame
- Win in Diamond league: +50 fame
- Win in Champion league: +75 fame

**Fame Uses**:
- Contributes to streaming revenue (aggregate across all robots)
- Displayed on robot profile for competitive rankings
- Used in matchmaking considerations
- Trophy/leaderboard display

**Note**: Fame is tracked per robot and aggregated for stable-level calculations (e.g., streaming revenue).

### Prestige (Stable-Level Reputation)

**Definition**: Account-wide reputation representing overall stable success and history. Prestige is **never spent** - only checked as unlock threshold.

**Earning Prestige - Battle Performance** (per win):
- Win in Bronze league: +5 prestige
- Win in Silver league: +10 prestige
- Win in Gold league: +20 prestige
- Win in Platinum league: +30 prestige
- Win in Diamond league: +50 prestige
- Win in Champion league: +75 prestige

**Earning Prestige - Tournament Performance**:
- Local tournament win: +100 prestige
- Regional tournament win: +250 prestige
- National tournament win: +500 prestige
- International tournament win: +1,000 prestige
- World Championship win: +2,500 prestige

**Earning Prestige - Milestones**:
- First robot to ELO 1500: +50 prestige
- First robot to ELO 1800: +100 prestige
- First robot to ELO 2000: +200 prestige
- 100 total wins (across all robots): +50 prestige
- 500 total wins: +250 prestige
- 1,000 total wins: +500 prestige

### Prestige Benefits

**1. Facility Level Unlocks**:
Prestige unlocks higher facility levels (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md) for complete list). Examples:
- Repair Bay Level 4: Requires 1,000 prestige
- Repair Bay Level 7: Requires 5,000 prestige
- Repair Bay Level 9: Requires 10,000 prestige
- Research Lab Level 9: Requires 15,000 prestige
- Booking Office Level 7: Requires 25,000 prestige

**2. Income Multipliers**:
- **Battle Winnings**: +5% to +20% (see Prestige Bonuses section above)
- **Merchandising**: Scales with prestige (see Merchandising Income section above)

**3. Content Access**:
- Tournament access via Booking Office facility
- Exclusive cosmetic options at high prestige levels
- Special challenges and events

### Prestige Accumulation Timeline

**Realistic Path to Key Thresholds**:

**5,000 Prestige** (~6-12 months):
- Bronze/Silver: 100 wins = +500-1,000 prestige
- Gold: 50 wins = +1,000 prestige
- Achievements: First milestones = +500-1,000 prestige
- Tournaments: 5-10 local/regional = +500-2,500 prestige

**10,000 Prestige** (~12-18 months):
- Continued league wins in Gold/Platinum
- Multiple tournament victories
- Major win milestones (500 total wins)
- High ELO achievements

**25,000 Prestige** (~2-3 years):
- Advanced league performance (Platinum/Diamond)
- National/International tournaments
- 1,000+ total wins
- Multiple high-ELO robots

**50,000 Prestige** (~3-5 years):
- Champion league performance
- World Championship participation
- Complete stable mastery

### 7. Potential Future Revenue Streams

**Not Yet Implemented** (for future phases):
- **Trading Commission**: Earn ₡ from weapon/robot sales on marketplace
- **Sponsorship Deals**: High-prestige stables attract sponsors for daily income
- **Arena Attendance**: Popular robots earn gate revenue from spectators
- **Championship Bonuses**: End-of-season rewards based on league placement
- **Daily Login Bonuses**: Small Credits bonus for consecutive daily logins

---

## Daily Financial System

### Daily Report Structure

Players receive a **daily financial report** showing all income and expenses. This can be presented:
1. **After each battle session** (MVP implementation)
2. **Once per real-world day** (when daily cycles are implemented)
3. **On-demand via Dashboard** (accessible anytime)

### Report Format

```
═══════════════════════════════════════
         DAILY STABLE REPORT
         [Date: February 2, 2026]
═══════════════════════════════════════

REVENUE STREAMS:
  Battle Winnings:         ₡45,000
  Prestige Bonus (10%):    ₡4,500
  Merchandising:           ₡30,000
  Streaming:               ₡27,000
  ─────────────────────────────────
  Total Revenue:           ₡106,500

OPERATING COSTS:
  Repair Bay (Lvl 5):      ₡3,500
  Training Facility (Lvl 4): ₡4,500
  Weapons Workshop (Lvl 3): ₡2,000
  Research Lab (Lvl 2):    ₡3,000
  Medical Bay (Lvl 2):     ₡3,000
  Roster Expansion (4):    ₡1,500
  Coaching Staff (active): ₡3,000
  Combat Academy (Lvl 3):  ₡1,600
  Defense Academy (Lvl 2): ₡1,200
  Mobility Academy (Lvl 2): ₡1,200
  AI Academy (Lvl 1):      ₡1,000
  Income Generator (Lvl 5): ₡3,500
  ─────────────────────────────────
  Total Operating Costs:   ₡29,000

REPAIRS:
  Robot "Thunder":         ₡8,500
  Robot "Blitz":           ₡12,000
  ─────────────────────────────────
  Total Repair Costs:      ₡20,500

═══════════════════════════════════════
NET INCOME:                ₡57,000
CURRENT BALANCE:           ₡1,904,000
═══════════════════════════════════════

Financial Health: Excellent ✅
Daily profit margin: 54%
Days until bankruptcy (if income stops): 67 days
```

**Per-Robot Revenue/Expense Tracking** (Advanced):

For multi-robot stables, the financial report should support per-robot breakdown:

```
═══════════════════════════════════════
    PER-ROBOT FINANCIAL BREAKDOWN
═══════════════════════════════════════

ROBOT "THUNDER":
  Battle Winnings:         ₡25,000
  Merchandising (fame 5K): ₡8,000
  Streaming (500 battles): ₡12,000
  ─────────────────────────────────
  Robot Revenue:           ₡45,000
  
  Repair Costs:            ₡8,500
  Allocated Facilities*:   ₡5,800
  ─────────────────────────────────
  Robot Net:               ₡30,700 ✅
  
ROBOT "BLITZ":
  Battle Winnings:         ₡20,000
  Merchandising (fame 3K): ₡6,400
  Streaming (300 battles): ₡7,040
  ─────────────────────────────────
  Robot Revenue:           ₡33,440
  
  Repair Costs:            ₡12,000
  Allocated Facilities*:   ₡5,800
  ─────────────────────────────────
  Robot Net:               ₡15,640 ✅
  
*Facilities costs split evenly across robots
═══════════════════════════════════════
```

**User Spending Breakdown** (Separate Section):

Track voluntary spending (investments vs operating costs):

```
WEEKLY SPENDING SUMMARY:
  Attribute Upgrades:      ₡45,000
  New Weapons Purchased:   ₡180,000
  Facility Upgrades:       ₡400,000
  New Robot Created:       ₡0
  ─────────────────────────────────
  Total Investments:       ₡625,000
```

This helps players understand where they're allocating resources for growth vs maintenance costs.

### Financial Health Indicators

**Status Levels**:
- **Excellent** (✅): Net positive income, balance > ₡1M
- **Good** (✅): Net positive income, balance ₡500K-₡1M
- **Stable** (⚠️): Break-even or slight profit, balance ₡100K-₡500K
- **Warning** (⚠️): Net negative income, balance ₡50K-₡100K
- **Critical** (❌): Heavy losses, balance < ₡50K

**Metrics to Display**:
1. **Net Income**: Total revenue - total costs
2. **Profit Margin**: (Net income / Total revenue) × 100%
3. **Days to Bankruptcy**: Current balance / daily costs (if income stops)
4. **Revenue Breakdown**: Percentage of income from each source
5. **Cost Breakdown**: Percentage of expenses by category

### Economic Alerts

**Alert Types**:
1. **Low Balance Warning**: Balance < ₡100,000
2. **Negative Cash Flow**: Daily costs exceed daily income
3. **Unprofitable Facilities**: Operating costs > benefits (e.g., coach cost exceeds value)
4. **High Repair Costs**: Repairs exceed 50% of daily income
5. **Investment Opportunities**: Can afford beneficial facility upgrades

**Example Alert**:
```
⚠️ ECONOMIC ALERT: Low Balance Warning
Current balance: ₡85,000
Estimated daily costs: ₡29,000
You have approximately 3 days of operating costs remaining.

Recommendations:
- Win more battles to increase income
- Consider disabling expensive coach (₡3,000/day)
- Repair only critical robots
- Upgrade Income Generator for passive income
```

### Dashboard Presentation

**Stable Dashboard** should include:
1. **Current Balance** (large, prominent display)
2. **Daily Income Summary** (collapsed by default, expandable)
3. **Net Income Trend** (7-day or 30-day chart)
4. **Financial Health Status** (icon + label)
5. **Quick Actions**: "View Full Report", "Economic Projections"

**Economic Dashboard Page** (separate page):
1. **Detailed Financial Report** (current day)
2. **Historical Data** (charts showing income/expense trends)
3. **Revenue Stream Analysis** (pie chart of income sources)
4. **Cost Center Analysis** (pie chart of expense categories)
5. **Projections** (estimated income/costs for next 7/30 days)
6. **Break-Even Analysis** (what income is needed to cover costs)
7. **Investment ROI Calculator** (facility upgrade payoff time)

---

## Economic Balance & Progression

### Early Game Economics (Days 1-30)

**Starting Budget**: ₡2,000,000

**Recommended Spending**:
- 1 Robot: ₡500,000
- 1 Good weapon: ₡150,000-₡300,000
- Repair Bay Level 1: ₡200,000
- Training Facility Level 1: ₡300,000 (optional but recommended)
- Attribute upgrades: ₡300,000-₡500,000
- Reserve for operations: ₡500,000

**Income Sources**:
- Bronze/Silver league battles: ₡5,000-₡15,000 per win
- **Battle frequency**: 1 battle per robot per day (7 battles/week)
- Expected wins at 50% win rate: 3.5 wins/week
- Weekly income: 3.5 × ₡8,000 avg = **₡28,000/week** (₡4,000/day)

**Operating Costs**:
- Repair Bay Level 1: ₡1,000/day
- Repairs (7 battles at avg ₡3,500): ₡24,500/week (₡3,500/day)
- **Daily total**: ~₡4,500/day

**Net Result**: Slight profit with 50% win rate (~₡3,500/week surplus)

**Balance Verification** (50% win rate profitability):
- Daily income: ₡4,000 (from 0.5 wins/day)
- Daily costs: ₡4,500 (₡1K facility + ₡3.5K repairs)
- **Shortfall**: -₡500/day (-₡3,500/week)
- **Coverage**: 89% (close to target 90%)

**Note**: Values assume revised repair cost formula (attributes × 50) or participation rewards. With current formula (attributes × 100), early game is not sustainable at 50% win rate without reducing repair costs or increasing battle rewards. 

### Mid Game Economics (Days 30-120)

**Typical Balance**: ₡3M-₡8M accumulated

**Investment Strategy**:
- Expand to 3-4 robots: ₡1,500,000-₡2,000,000
- Upgrade key facilities to Level 3-5: ₡2,000,000-₡4,000,000
- Purchase premium weapons: ₡800,000-₡1,500,000
- Unlock Income Generator: ₡800,000 (provides passive income)

**Income Sources**:
- Gold/Platinum league battles: ₡20,000-₡60,000 per win
- Merchandising income: ₡10,000-₡25,000/day
- Streaming income: ₡5,000-₡15,000/day
- Tournament winnings: ₡50,000-₡300,000 (occasional)
- **Total**: ₡40,000-₡80,000/day

**Operating Costs**:
- Facilities: ₡15,000-₡25,000/day
- Repairs: ₡10,000-₡30,000 per battle
- Daily total: ~₡20,000-₡40,000/day

**Net Result**: Profitable operations, can save for major upgrades

### Late Game Economics (Days 120+)

**Typical Balance**: ₡10M-₡50M accumulated

**Investment Strategy**:
- Max out critical facilities: ₡10,000,000-₡20,000,000
- 6-10 robot roster: ₡3,000,000-₡5,000,000
- Premium weapon collection: ₡3,000,000-₡5,000,000
- Custom weapon crafting: ₡1,000,000-₡3,000,000 per weapon
- Prestige-locked content: Access to highest tournaments

**Income Sources**:
- Diamond/Champion league battles: ₡80,000-₡250,000 per win
- High-prestige multiplier: +15-20% on all winnings
- Merchandising income: ₡40,000-₡80,000/day
- Streaming income: ₡30,000-₡60,000/day
- Tournament winnings: ₡500,000-₡2,000,000 (weekly)
- **Total**: ₡150,000-₡400,000/day

**Operating Costs**:
- Facilities: ₡40,000-₡60,000/day
- Repairs: ₡20,000-₡50,000 per battle
- Daily total: ~₡50,000-₡80,000/day

**Net Result**: Highly profitable, focus on optimization and prestige

### Facility Investment ROI

**Payback Period Examples** (Revised with correct battle frequency):

1. **Repair Bay Level 1** (₡200,000):
   - Saves ~5% on repairs (₡175 per battle with ₡3,500 avg repair)
   - **Battle frequency**: 7 battles/week per robot
   - Payback: 1,143 battles ÷ 7 = **163 weeks** (3.1 years)
   - **Multi-robot benefit**: With 3 robots, 21 battles/week → **54 weeks** (1 year)
   - **Conclusion**: Better value with multiple robots or as long-term investment
  
2. **Training Facility Level 1** (₡300,000):
   - Saves 5% on upgrades (varies: ₡2K-₡50K saved depending on level)
   - Example: Upgrading 1→10 saves ₡2,700 per attribute (₡54K × 5%)
   - For 23 attributes (1→10): Saves ₡62,100
   - **Payback**: Would need to upgrade ~5 robots from 1→10
   - **Best for**: Players planning multiple robots or high-level upgrades (15-50)
   - **Early game**: Not cost-effective (as calculated in section 1)
   
3. **Income Generator Level 1** (₡800,000):
   - **Merchandising**: ₡5,000/day base - ₡1,000 operating cost = ₡4,000 net/day
   - Scales with prestige: At 10K prestige → ₡5,000 × 2.0 = ₡10,000/day (₡9,000 net)
   - **Base payback**: 200 days (with no prestige scaling)
   - **Realistic payback** (moderate prestige): 89-100 days
   - **With high prestige** (50K): 40-50 days
   - **Streaming** (Level 3+): Additional ₡3,000-₡6,000/day base (scales with battles/fame)
   - **Combined assessment**: Strong mid-game investment, scales well with prestige
   - **Recommendation**: Purchase when prestige reaches 5,000-10,000 range
   
4. **Weapons Workshop Level 1** (₡250,000):
   - Saves 5% on weapons (₡5K-₡20K per weapon)
   - Average weapon cost: ₡200K → saves ₡10K per purchase
   - Payback: **25 weapon purchases**
   - **Multi-robot context**: 3 robots × 2 weapons = 6 weapons minimum
   - With loadout changes/testing: 10-15 weapons over time
   - **Payback timeline**: **2-3 years** for typical player
   - **Conclusion**: Low priority unless frequently experimenting with weapons or running 4+ robots

**General Rule**: 
- **Discount facilities** require high usage frequency or multiple robots to justify
- **Income facilities** scale with stable prestige and robot activity (battles/fame aggregates)
- **Academy facilities** provide immediate benefit (cap unlock) beyond long-term savings

**Early Game Priority**:
1. **Repair Bay** - Only if planning 2+ robots soon
2. **One Academy** - Only if stuck at level 10 cap in key attributes
3. **Skip Income Generator** - Requires prestige to be effective
4. **Focus on robot power first** - Attributes and weapons

---

## Implementation Recommendations

### Phase 1: Core Economic Tracking 

**Priority**: High  

1. **Backend Implementation**:
   - Track all costs and revenue in database
   - Calculate daily operating costs based on facilities
   - Generate daily financial report data structure
   - Store historical financial data (daily snapshots)

2. **API Endpoints**:
   ```
   GET /api/stable/:userId/finances/daily - Get today's financial report
   GET /api/stable/:userId/finances/history - Get historical data
   GET /api/stable/:userId/finances/summary - Get quick summary
   ```

3. **Frontend Components**:
   - `FinancialReport` component (daily report display)
   - `FinancialHealthBadge` component (status indicator)
   - Integrate into Stable Dashboard

4. **User Education**:
   - Tooltip on each revenue/cost line item
   - Link to documentation for complex formulas
   - "What is this?" helper text

### Phase 2: Economic Dashboard 

**Priority**: Medium  

1. **Analytics & Visualization**:
   - Historical trend charts (Chart.js or Recharts)
   - Revenue stream breakdown (pie charts)
   - Cost center breakdown (pie charts)
   - Net income trend line (7-day, 30-day, all-time)

2. **Projections & Forecasting**:
   - Calculate future income based on current stats
   - Project facility upgrade payoff times
   - "What-if" scenarios (e.g., "If I buy this facility...")

3. **Alerts & Notifications**:
   - Low balance warnings
   - Negative cash flow alerts
   - Investment opportunity notifications

### Phase 3: Advanced Features 

**Priority**: Low  

1. **Budget Planning**:
   - Set budgets for repairs, upgrades, weapons
   - Track spending against budget
   - Alerts when exceeding budget

2. **Financial Goals**:
   - Set savings targets (e.g., "Save ₡5M for facility")
   - Track progress toward goal
   - Recommend actions to reach goal faster

3. **Economic Leaderboards**:
   - Richest stables
   - Most profitable stables
   - Highest daily income

4. **Trading System** (major feature):
   - Buy/sell robots and weapons between players
   - Marketplace with dynamic pricing
   - Commission fees on transactions

---

## Success Metrics

### Player Understanding (Qualitative)

**Goal**: 90% of players understand basic economy

**Metrics**:
- % of players who view daily financial report
- % of players who make facility purchases
- Player survey: "Do you understand where your money comes from/goes?"
- Tutorial completion rate for economy section

### Economic Health (Quantitative)

**Goal**: Majority of active players maintain positive cash flow

**Metrics**:
- % of players with positive net income (target: >70%)
- % of players with balance > ₡100,000 (target: >80%)
- Average balance by activity level (daily/weekly/monthly players)
- % of players who go bankrupt (target: <5%)

### Engagement Metrics

**Goal**: Economy drives strategic decision-making

**Metrics**:
- Facility upgrade rate (target: 1-2 upgrades per week per player)
- Average number of facilities owned (target: 4-6 by day 30)
- Weapon purchase rate (target: 1-2 per week)
- Repair decision patterns (Do players use yield threshold strategically?)

### Balance Metrics

**Goal**: All revenue streams contribute meaningfully

**Metrics**:
- Revenue breakdown: Battle winnings vs passive income (target: 60/40 split)
- % of players using Income Generator (target: >60% by day 60)
- Average daily income by game stage (early/mid/late)
- Facility ROI analysis (which facilities are most popular?)

---

## Appendices

### Appendix A: Complete Cost Formula Summary

```javascript
// Robot purchase
robot_cost = 500000;

// Attribute upgrade
upgrade_cost = (current_level + 1) * 1000 * (1 - training_facility_discount);

// Weapon purchase
weapon_cost = base_price * (1 - weapons_workshop_discount);

// Facility purchase
facility_cost = [defined per facility level];

// Repair cost
base_repair = sum_of_attributes * 100;
damage_pct = damage_taken / max_hp;
condition_multiplier = (hp === 0) ? 2.0 : (hp < max_hp * 0.1) ? 1.5 : 1.0;

// Apply Medical Bay to critical multiplier
if (hp === 0 && medical_bay_level > 0) {
    medical_reduction = medical_bay_level * 0.1;
    condition_multiplier = 2.0 * (1 - medical_reduction);
}

repair_before_discount = base_repair * damage_pct * condition_multiplier;

// Apply Repair Bay discount
repair_bay_discount = repair_bay_level * 0.05;
final_repair = repair_before_discount * (1 - repair_bay_discount);

// Daily operating costs
daily_operating = sum_of_facility_operating_costs;
```

### Appendix B: Complete Revenue Formula Summary

```javascript
// Battle winnings
base_reward = [defined by league tier, 5000-300000];
prestige_multiplier = (prestige >= 50000) ? 1.20 : 
                      (prestige >= 25000) ? 1.15 :
                      (prestige >= 10000) ? 1.10 :
                      (prestige >= 5000) ? 1.05 : 1.0;
battle_reward = base_reward * prestige_multiplier;

// Merchandising income
base_merchandising = [defined by Income Generator level];
prestige_mult = 1 + (prestige / 10000);
merchandising_daily = base_merchandising * prestige_mult;

// Streaming income
base_streaming = [defined by Income Generator level];
battle_mult = 1 + (total_battles / 1000);
fame_mult = 1 + (total_fame / 5000);
streaming_daily = base_streaming * battle_mult * fame_mult;

// Total daily revenue
total_revenue = battle_winnings + merchandising_daily + streaming_daily + achievements;
```

### Appendix C: Glossary

- **Credits (₡)**: Primary currency, used for all purchases
- **Prestige**: Secondary resource, unlocks content, never spent
- **Stable**: Player's account/collection of robots
- **Facility**: Upgradeable building providing benefits
- **Operating Cost**: Daily recurring cost to maintain facilities
- **Net Income**: Total revenue minus total costs
- **Profit Margin**: Percentage of revenue that is profit
- **ROI (Return on Investment)**: Time to recoup facility purchase cost
- **Yield Threshold**: HP% where robot surrenders (affects repair costs)
- **Critical Damage**: Robot destroyed (HP = 0), 2x repair multiplier

---

## See Also

- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)** - Complete facility system, prestige, daily income examples
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)** - Attribute upgrade costs, repair formulas
- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)** - Weapon catalog with prices
- **[GAME_DESIGN.md](GAME_DESIGN.md)** - Overall game design philosophy
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Data model for economic tracking
- **[PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)**: Complete prestige and fame system specification (earning, benefits)

---

**This economy system provides:**
- ✅ Clear cost structure for all player actions
- ✅ Multiple revenue streams (active and passive)
- ✅ Daily financial reporting for transparency
- ✅ Strategic depth through facility investments
- ✅ Risk/reward balance (yield thresholds, aggressive expansion)
- ✅ Long-term progression goals (facility maxing, prestige unlocks)
- ✅ Economic sustainability (players can operate profitably)
- ✅ Meaningful choices (which facilities to prioritize)
