# Stable System

**Last Updated**: January 30, 2026  
**Status**: Design Document

> **📋 For Prestige and Fame System Details**: See **[PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)** - the authoritative document for prestige earning, fame mechanics, and reputation benefits. This document provides prestige formulas and facility unlock requirements but PRD_PRESTIGE_AND_FAME.md is the official specification.

## Overview

A **Stable** is the player's collection and management system for their robots. Each user has one stable where they manage Credits, Prestige, facility upgrades, and their robot roster.

**Database Schema**: See DATABASE_SCHEMA.md for authoritative field definitions and relationships.

---

## Stable-Level Attributes

### Core Resources

**Credits (₡)** - Primary currency
- Starting balance: ₡2,000,000 (increased to accommodate facility system)
- Used for: Robot purchases, upgrades, weapons, repairs, facility upgrades
- Earned from: Battles, tournaments, achievements, daily income streams

**Prestige** - Stable reputation and ranking
- Starting prestige: 0
- Separate from individual robot fame
- Represents overall stable success and history
- **Never spent** - Used only to unlock content
- Unlocks: Facility levels, tournaments, exclusive equipment, cosmetic options
- Earned from: Tournament wins, high rankings, achievements, robot milestones

### Stable Statistics

Statistics are captured at both stable-level and robot-level for comprehensive tracking:

**Stable-Level Statistics** (Aggregated from all robots):
- **Total Battles**: Lifetime battle count across all robots
- **Total Wins**: Victory count across all robots
- **Win Rate**: Overall stable win percentage (calculated: totalWins / totalBattles × 100)
- **Championship Titles**: Tournament victories
- **Active Robots**: Current roster size
- **Highest ELO**: Best ELO achieved by any robot in the stable

**Robot-Level Statistics** (Individual robot performance):
- See ROBOT_ATTRIBUTES.md for complete list
- Individual robot ELO, battles, wins, losses
- Damage dealt/taken lifetime
- Fame, league tier, league points
- Kills, titles

**Aggregation Strategy**:
- Stable statistics are aggregates (sums/averages) of robot statistics
- Individual robot stats drive rankings and matchmaking
- Stable stats used for prestige calculations and leaderboards
- Both levels tracked for complete performance picture

---

## Facility System

Players invest Credits in facility upgrades that provide stable-wide benefits. All facilities have **10 levels** (Level 0 = not purchased, Levels 1-10 = upgrades). Some facility levels require prestige thresholds to unlock.

### Complete Facility List (14 Total)

1. **Repair Bay** - Repair cost discounts
2. **Training Facility** - Attribute upgrade discounts
3. **Weapons Workshop** - Weapon purchase discounts, crafting
4. **Research Lab** - Analytics, loadout presets
5. **Medical Bay** - Critical damage cost reduction
6. **Roster Expansion** - Robot roster slots (1→10)
7. **Storage Facility** - Weapon storage capacity
8. **Coaching Staff** - Hire coaches for stable-wide bonuses
9. **Booking Office** - Tournament and prestige event access
10. **Combat Training Academy** - Combat Systems attribute caps
11. **Defense Training Academy** - Defensive Systems attribute caps
12. **Mobility Training Academy** - Chassis & Mobility attribute caps
13. **AI Training Academy** - AI Processing + Team Coordination attribute caps
14. **Income Generator** - Additional revenue streams

### Facility Upgrades

**1. Repair Bay** (Operating Cost: ₡1,000/day at Level 1, +₡500/day per level)
- **Level 0**: No discount
- **Level 1** (₡200,000): 5% discount on repair costs
- **Level 2** (₡400,000): 10% discount on repair costs
- **Level 3** (₡600,000): 15% discount on repair costs
- **Level 4** (₡800,000, requires 1,000 prestige): 20% discount on repair costs
- **Level 5** (₡1,000,000): 25% discount on repair costs
- **Level 6** (₡1,200,000): 30% discount on repair costs
- **Level 7** (₡1,500,000, requires 5,000 prestige): 35% discount on repair costs
- **Level 8** (₡2,000,000): 40% discount on repair costs
- **Level 9** (₡2,500,000, requires 10,000 prestige): 45% discount on repair costs
- **Level 10** (₡3,000,000): 50% discount on repair costs, automatic minor repairs

**Discount Formula**: Discount % = Repair Bay Level × 5

**2. Training Facility** (Operating Cost: ₡1,500/day at Level 1, +₡750/day per level)
- **Level 1** (₡300,000): 5% discount on attribute upgrade costs
- **Level 2** (₡600,000): 10% discount on attribute upgrade costs
- **Level 3** (₡900,000): 15% discount on attribute upgrade costs
- **Level 4** (₡1,200,000, requires 1,000 prestige): 20% discount on attribute upgrade costs
- **Level 5** (₡1,500,000): 25% discount on attribute upgrade costs
- **Level 6** (₡1,800,000): 30% discount on attribute upgrade costs
- **Level 7** (₡2,200,000, requires 5,000 prestige): 35% discount on attribute upgrade costs
- **Level 8** (₡2,800,000): 40% discount on attribute upgrade costs
- **Level 9** (₡3,500,000, requires 10,000 prestige): 45% discount on attribute upgrade costs
- **Level 10** (₡4,500,000): 50% discount on attribute upgrade costs, unlock special training programs

**3. Weapons Workshop** (Operating Cost: ₡1,000/day at Level 1, +₡500/day per level)
- **Level 0**: No discount
- **Level 1** (₡250,000): 5% discount on weapon purchases
- **Level 2** (₡500,000): 10% discount on weapon purchases
- **Level 3** (₡750,000): 15% discount on weapon purchases, unlock weapon modifications
- **Level 4** (₡1,000,000, requires 1,500 prestige): 20% discount on weapon purchases
- **Level 5** (₡1,300,000): 25% discount on weapon purchases
- **Level 6** (₡1,600,000): 30% discount on weapon purchases, unlock custom weapon design
- **Level 7** (₡2,000,000, requires 5,000 prestige): 35% discount on weapon purchases
- **Level 8** (₡2,500,000): 40% discount on weapon purchases
- **Level 9** (₡3,000,000, requires 10,000 prestige): 45% discount on weapon purchases
- **Level 10** (₡4,000,000): 50% discount on weapon purchases, unlock legendary weapon crafting

**Discount Formula**: Discount % = Weapons Workshop Level × 5

**For complete weapon details, see [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**

**4. Research Lab** (Operating Cost: ₡2,000/day at Level 1, +₡1,000/day per level)
- **Level 1** (₡400,000): Unlock advanced battle analytics
- **Level 2** (₡800,000): Unlock loadout presets (save 3 configurations per robot)
- **Level 3** (₡1,200,000): Unlock AI behavior customization
- **Level 4** (₡1,600,000, requires 2,000 prestige): Unlock 5 loadout presets per robot
- **Level 5** (₡2,000,000): Unlock battle simulation (test matchups without cost)
- **Level 6** (₡2,500,000): Unlock advanced statistics dashboard
- **Level 7** (₡3,000,000, requires 7,500 prestige): Unlock predictive AI (opponent analysis)
- **Level 8** (₡3,500,000): Unlock 8 loadout presets per robot
- **Level 9** (₡4,000,000, requires 15,000 prestige): Unlock experimental technology
- **Level 10** (₡5,000,000): Unlock robot cloning

**5. Medical Bay** (Operating Cost: ₡2,000/day at Level 1, +₡1,000/day per level)
- **Level 1** (₡350,000): 15% reduction on critical damage repair costs (0 HP)
- **Level 2** (₡700,000): 25% reduction on critical damage repair costs
- **Level 3** (₡1,050,000): 35% reduction on critical damage repair costs
- **Level 4** (₡1,400,000, requires 2,000 prestige): 45% reduction on critical damage repair costs
- **Level 5** (₡1,750,000): 55% reduction on critical damage repair costs
- **Level 6** (₡2,100,000): 65% reduction on critical damage repair costs, faster recovery protocols
- **Level 7** (₡2,500,000, requires 7,500 prestige): 75% reduction on critical damage repair costs
- **Level 8** (₡3,000,000): 85% reduction on critical damage repair costs
- **Level 9** (₡3,500,000, requires 15,000 prestige): 95% reduction on critical damage repair costs, prevent permanent damage
- **Level 10** (₡4,500,000): Eliminate critical damage penalties entirely

**6. Roster Expansion** (Operating Cost: ₡500/day per robot slot beyond first)
- **Level 0**: 1 robot slot (free, no operating cost)
- **Level 1** (₡300,000): 2 robot slots
- **Level 2** (₡600,000): 3 robot slots
- **Level 3** (₡900,000): 4 robot slots
- **Level 4** (₡1,200,000, requires 1,000 prestige): 5 robot slots
- **Level 5** (₡1,500,000): 6 robot slots
- **Level 6** (₡1,800,000): 7 robot slots
- **Level 7** (₡2,200,000, requires 5,000 prestige): 8 robot slots
- **Level 8** (₡2,600,000): 9 robot slots
- **Level 9** (₡3,000,000, requires 10,000 prestige): 10 robot slots (maximum)
- **Level 10**: N/A (Level 9 is maximum)

**7. Storage Facility** (Operating Cost: ₡500/day at Level 1, +₡250/day per level)
- **Level 0**: 5 weapons storage (free, base capacity)
- **Level 1** (₡150,000): 10 weapon slots (5 base + 5)
- **Level 2** (₡300,000): 15 weapons storage (5 base + 10)
- **Level 3** (₡450,000): 20 weapons storage (5 base + 15)
- **Level 4** (₡600,000): 25 weapons storage (5 base + 20)
- **Level 5** (₡750,000): 30 weapons storage (5 base + 25)
- **Level 6** (₡900,000): 35 weapons storage (5 base + 30)
- **Level 7** (₡1,100,000): 40 weapons storage (5 base + 35)
- **Level 8** (₡1,300,000): 45 weapons storage (5 base + 40)
- **Level 9** (₡1,500,000): 50 weapons storage (5 base + 45)
- **Level 10** (₡2,000,000): 55 weapons storage (5 base + 50, maximum)

**Formula**: Storage Capacity = 5 + (Storage Facility Level × 5)

**Storage Definition**: Storage capacity refers to the **total number of weapons owned by the stable**, including both equipped and unequipped weapons. This simplifies weapon management by ensuring there's never a situation where a player cannot swap weapons due to storage constraints.

**For weapon inventory management details, see [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**

**8. Coaching Staff** (Operating Cost: ₡3,000/day when coach active)
- **Level 0**: No coach available
- **Level 1** (₡500,000): Unlock Offensive Coach (+3% Combat Power for all robots)
- **Level 2** (₡700,000): Unlock Defensive Coach (+3% Armor Plating for all robots)
- **Level 3** (₡900,000, requires 2,000 prestige): Unlock Tactical Coach (+5% Threat Analysis for all robots)
- **Level 4** (₡1,200,000): Improve Offensive Coach (+5% Combat Power)
- **Level 5** (₡1,500,000): Improve Defensive Coach (+5% Armor Plating)
- **Level 6** (₡1,800,000, requires 5,000 prestige): Improve Tactical Coach (+8% Threat Analysis)
- **Level 7** (₡2,200,000): Unlock Team Coach (+5% team coordination bonuses for arena battles)
- **Level 8** (₡2,600,000): Improve Offensive Coach (+7% Combat Power)
- **Level 9** (₡3,000,000, requires 10,000 prestige): Improve Defensive Coach (+7% Armor Plating)
- **Level 10** (₡3,500,000): Master Coach (combine two coach bonuses at 75% effectiveness)

**Note**: Only one coach can be active at a time. Switching coaches costs ₡100,000.

**Bonus Stacking**: Coaching Staff bonuses are **additive** with Loadout and Stance percentage modifiers. See [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md#effective-stat-calculation) for the complete formula:
```
effective_attribute = (base + weapon_bonuses) × (1 + loadout% + stance% + coach%)

Example:
  Combat Power base: 20
  Weapon bonuses: +5
  Two-Handed loadout: +25%
  Offensive stance: +15%
  Offensive Coach (Level 8): +7%
  
  effective = (20 + 5) × (1 + 0.25 + 0.15 + 0.07)
           = 25 × 1.47
           = 36.75 → 37 (rounded)
```

**9. Booking Office** (Operating Cost: None - generates prestige instead)
- **Level 0**: Bronze league access only
- **Level 1** (₡500,000, requires 1,000 prestige): Unlock Silver league tournaments
- **Level 2** (₡1,000,000, requires 2,500 prestige): Unlock Gold league tournaments, custom paint jobs
- **Level 3** (₡1,500,000, requires 5,000 prestige): Unlock Platinum tournaments, exclusive weapon skins
- **Level 4** (₡2,000,000, requires 10,000 prestige): Unlock Diamond tournaments, legendary frame designs
- **Level 5** (₡2,500,000, requires 15,000 prestige): Enhanced tournament rewards (+10%)
- **Level 6** (₡3,000,000, requires 20,000 prestige): Enhanced tournament rewards (+20%)
- **Level 7** (₡3,500,000, requires 25,000 prestige): Access to Champion tournaments, hall of fame listing
- **Level 8** (₡4,000,000, requires 35,000 prestige): Enhanced tournament rewards (+30%)
- **Level 9** (₡4,500,000, requires 45,000 prestige): Enhanced tournament rewards (+40%)
- **Level 10** (₡5,000,000, requires 50,000 prestige): Access to World Championship, custom arena design

**10. Combat Training Academy** (Operating Cost: ₡800/day at Level 1, +₡400/day per level)
- **Level 0**: Combat Systems attributes (6) capped at level 10
- **Level 1** (₡400,000): Unlock Combat Systems cap to level 15
- **Level 2** (₡600,000): Unlock Combat Systems cap to level 20
- **Level 3** (₡800,000, requires 2,000 prestige): Unlock Combat Systems cap to level 25
- **Level 4** (₡1,000,000): Unlock Combat Systems cap to level 30
- **Level 5** (₡1,200,000, requires 4,000 prestige): Unlock Combat Systems cap to level 35
- **Level 6** (₡1,400,000): Unlock Combat Systems cap to level 40
- **Level 7** (₡1,600,000, requires 7,000 prestige): Unlock Combat Systems cap to level 42
- **Level 8** (₡1,800,000): Unlock Combat Systems cap to level 45
- **Level 9** (₡2,000,000, requires 10,000 prestige): Unlock Combat Systems cap to level 48
- **Level 10** (₡2,500,000, requires 15,000 prestige): Unlock Combat Systems cap to level 50 (maximum)

**11. Defense Training Academy** (Operating Cost: ₡800/day at Level 1, +₡400/day per level)
- **Level 0**: Defensive Systems attributes (5) capped at level 10
- **Level 1** (₡400,000): Unlock Defensive Systems cap to level 15
- **Level 2** (₡600,000): Unlock Defensive Systems cap to level 20
- **Level 3** (₡800,000, requires 2,000 prestige): Unlock Defensive Systems cap to level 25
- **Level 4** (₡1,000,000): Unlock Defensive Systems cap to level 30
- **Level 5** (₡1,200,000, requires 4,000 prestige): Unlock Defensive Systems cap to level 35
- **Level 6** (₡1,400,000): Unlock Defensive Systems cap to level 40
- **Level 7** (₡1,600,000, requires 7,000 prestige): Unlock Defensive Systems cap to level 42
- **Level 8** (₡1,800,000): Unlock Defensive Systems cap to level 45
- **Level 9** (₡2,000,000, requires 10,000 prestige): Unlock Defensive Systems cap to level 48
- **Level 10** (₡2,500,000, requires 15,000 prestige): Unlock Defensive Systems cap to level 50 (maximum)

**12. Mobility Training Academy** (Operating Cost: ₡800/day at Level 1, +₡400/day per level)
- **Level 0**: Chassis & Mobility attributes (5) capped at level 10
- **Level 1** (₡400,000): Unlock Chassis & Mobility cap to level 15
- **Level 2** (₡600,000): Unlock Chassis & Mobility cap to level 20
- **Level 3** (₡800,000, requires 2,000 prestige): Unlock Chassis & Mobility cap to level 25
- **Level 4** (₡1,000,000): Unlock Chassis & Mobility cap to level 30
- **Level 5** (₡1,200,000, requires 4,000 prestige): Unlock Chassis & Mobility cap to level 35
- **Level 6** (₡1,400,000): Unlock Chassis & Mobility cap to level 40
- **Level 7** (₡1,600,000, requires 7,000 prestige): Unlock Chassis & Mobility cap to level 42
- **Level 8** (₡1,800,000): Unlock Chassis & Mobility cap to level 45
- **Level 9** (₡2,000,000, requires 10,000 prestige): Unlock Chassis & Mobility cap to level 48
- **Level 10** (₡2,500,000, requires 15,000 prestige): Unlock Chassis & Mobility cap to level 50 (maximum)

**13. AI Training Academy** (Operating Cost: ₡1,000/day at Level 1, +₡500/day per level)
- **Level 0**: AI Processing + Team Coordination attributes (7) capped at level 10
- **Level 1** (₡500,000): Unlock AI & Team cap to level 15
- **Level 2** (₡750,000): Unlock AI & Team cap to level 20
- **Level 3** (₡1,000,000, requires 2,000 prestige): Unlock AI & Team cap to level 25
- **Level 4** (₡1,250,000): Unlock AI & Team cap to level 30
- **Level 5** (₡1,500,000, requires 4,000 prestige): Unlock AI & Team cap to level 35
- **Level 6** (₡1,750,000): Unlock AI & Team cap to level 40
- **Level 7** (₡2,000,000, requires 7,000 prestige): Unlock AI & Team cap to level 42
- **Level 8** (₡2,250,000): Unlock AI & Team cap to level 45
- **Level 9** (₡2,500,000, requires 10,000 prestige): Unlock AI & Team cap to level 48
- **Level 10** (₡3,000,000, requires 15,000 prestige): Unlock AI & Team cap to level 50 (maximum)

**14. Income Generator** (Operating Cost: ₡1,000/day at Level 1, +₡500/day per level)
- **Level 0**: No additional income streams
- **Level 1** (₡800,000): Unlock Merchandising (₡5,000/day base, scales with prestige)
- **Level 2** (₡1,200,000): Improve Merchandising (₡8,000/day base)
- **Level 3** (₡1,600,000): Unlock Streaming Revenue (₡3,000/day base, scales with total battles and fame)
- **Level 4** (₡2,000,000, requires 3,000 prestige): Improve Merchandising (₡12,000/day base)
- **Level 5** (₡2,400,000): Improve Streaming Revenue (₡6,000/day base)
- **Level 6** (₡2,800,000): Improve Merchandising (₡18,000/day base)
- **Level 7** (₡3,200,000, requires 7,500 prestige): Improve Streaming Revenue (₡10,000/day base)
- **Level 8** (₡3,600,000): Improve Merchandising (₡25,000/day base)
- **Level 9** (₡4,000,000, requires 15,000 prestige): Improve Streaming Revenue (₡15,000/day base)
- **Level 10** (₡5,000,000): Master Income (₡35,000/day base for merchandising, ₡22,000/day for streaming)

---

## Prestige System

> **📋 See [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md) for the authoritative specification**, including implementation status, fame system details, and complete earning mechanics.

### Earning Prestige

**Battle Performance** (per win):
- Win in Bronze league: +5 prestige
- Win in Silver league: +10 prestige
- Win in Gold league: +20 prestige
- Win in Platinum league: +30 prestige
- Win in Diamond league: +50 prestige
- Win in Champion league: +75 prestige

**Tournament Performance**:
- Local tournament win: +100 prestige
- Regional tournament win: +250 prestige
- National tournament win: +500 prestige
- International tournament win: +1,000 prestige
- World Championship win: +2,500 prestige

**Milestones**:
- First robot to ELO 1500: +50 prestige
- First robot to ELO 1800: +100 prestige
- First robot to ELO 2000: +200 prestige
- 100 total wins: +50 prestige
- 500 total wins: +250 prestige
- 1,000 total wins: +500 prestige

### Prestige Benefits

**Facility Unlocks**:
- Prestige unlocks higher facility levels (see facility descriptions above)
- Prestige is never spent - only checked as threshold
- Example: Booking Office Level 7 requires 25,000 prestige to unlock

**Income Multipliers**:
- Higher prestige increases merchandising revenue (see Daily Income/Expense System below)
- Formula: `merchandising_income = base_merchandising × (1 + prestige / 10000)`

---

## Daily Income/Expense System

The game presents players with a **daily income/expense sheet** showing all revenue streams and operating costs.

### Revenue Streams

**Battle Winnings**:
- Win rewards vary by league tier
- Bronze: ₡5,000 - ₡10,000 per win
- Silver: ₡10,000 - ₡20,000 per win
- Gold: ₡20,000 - ₡40,000 per win
- Platinum: ₡40,000 - ₡80,000 per win
- Diamond: ₡80,000 - ₡150,000 per win
- Champion: ₡150,000 - ₡300,000 per win

**Prestige Bonuses**:
- 5,000+ Prestige: +5% to battle winnings
- 10,000+ Prestige: +10% to battle winnings
- 25,000+ Prestige: +15% to battle winnings
- 50,000+ Prestige: +20% to battle winnings

**Merchandising** (from Income Generator facility):
```
merchandising_income = base_merchandising × (1 + prestige / 10000)

Example:
- Income Generator Level 4: ₡12,000/day base
- Prestige 15,000
- Merchandising = ₡12,000 × (1 + 15000/10000) = ₡12,000 × 2.5 = ₡30,000/day
```

**Streaming Revenue** (from Income Generator facility):
```
streaming_income = base_streaming × (1 + (total_battles / 1000)) × (1 + (total_fame / 5000))

// total_battles = aggregate of all robot battles in stable
// total_fame = sum of fame values from all robots in stable

Example:
- Income Generator Level 5: ₡6,000/day base
- Total battles: 500 (across all robots)
- Total fame: 10,000 (sum of all robot fame values)
- Streaming = ₡6,000 × (1 + 0.5) × (1 + 2.0) = ₡6,000 × 1.5 × 3.0 = ₡27,000/day
```

### Operating Costs

**Facility Operating Costs**:
- Each facility has daily operating cost (see facility descriptions)
- Costs increase with facility level
- Total daily operating cost = sum of all active facility costs

**Repair Costs**:
- Robots damaged in battle require repairs
- Repair costs based on damage taken and attribute total (see ROBOT_ATTRIBUTES.md)
- Not a daily cost - only after battles

**Coach Costs**:
- Active coach costs ₡3,000/day (if Coaching Staff facility upgraded)
- Switching coaches costs ₡100,000 one-time

### Daily Summary Presentation

**Daily Report Format**:
```
═══════════════════════════════════════
         DAILY STABLE REPORT
         [Date]
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
  Roster Expansion (4 robots): ₡1,500
  Coaching Staff (active): ₡3,000
  Combat Academy (Lvl 3):  ₡1,600
  Defense Academy (Lvl 2): ₡1,200
  Mobility Academy (Lvl 2): ₡1,200
  AI Academy (Lvl 1):      ₡1,000
  Income Generator (Lvl 5): ₡3,500
  ─────────────────────────────────
  Total Operating Costs:   ₡26,000

REPAIRS:
  Robot "Thunder":         ₡8,500
  Robot "Blitz":           ₡12,000
  ─────────────────────────────────
  Total Repair Costs:      ₡20,500

═══════════════════════════════════════
NET INCOME:                ₡60,000
CURRENT BALANCE:           ₡1,847,000
═══════════════════════════════════════
```

**Frequency**: Displayed daily (or after each battle session in MVP)

---

## Stable Management Interface

### Dashboard View
- Total Credits
- Current Prestige & Prestige Rank
- Active Robots (with HP status, ELO)
- Recent Battle Results
- Facility Upgrade Status (per facility)
- Daily Income/Expense Summary

### Robots Tab
- List all robots with:
  - Name, thumbnail
  - Current HP / Max HP
  - ELO rating
  - League tier (note: leagues are per robot, not per stable)
  - Win/Loss record
  - Battle readiness status
  - Quick repair button
  - Equip/modify button
  - Upgrade button

### Facilities Tab
- View all facility upgrades
- Purchase/upgrade facilities
- View bonuses and benefits
- View daily operating costs
- Manage coaches (if Coaching Staff unlocked)

### Workshop Tab
- View owned weapons
- Purchase new weapons
- Design custom weapons (if unlocked)
- Modify weapons (if unlocked)

**For complete weapon system details, see [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**

### Statistics Tab
- Overall stable statistics (aggregated)
- Individual robot statistics
- Battle history
- Achievement progress
- Prestige milestones

---

## Progression Strategy

### Early Game (₡2M starting budget)
1. Build 1 robot with basic weapon (₡500K + ₡150K = ₡650K)
2. Upgrade key attributes (₡300K)
3. Save for Repair Bay Level 1 (₡200K) - reduces long-term costs
4. Focus on battles to earn Credits and prestige
5. Remaining: ~₡850K for additional upgrades or second robot

**Viable Alternative**: 
- Build 2 robots (₡1M) with cheap weapons (₡200K total)
- Leaves ₡800K for initial upgrades and facility
- Riskier but allows testing different builds

### Mid Game (₡5M+ total earned)
1. Upgrade key facilities (Repair Bay, Training Facility to Level 3-4)
2. Expand robot roster to 3-4 robots
3. Unlock Income Generator for passive income
4. Specialize robots for different strategies
5. Invest in better weapons (₡300K-₡400K range)
6. Participate in Silver/Gold tournaments

### Late Game (₡20M+ total earned)
1. Max out critical facilities (Repair Bay, Medical Bay, all 4 Training Academies)
2. Build specialized arena teams
3. Invest in prestige-locked content (high-tier tournaments)
4. Compete in high-tier tournaments (Diamond/Champion)
5. Build legendary custom weapons
6. Optimize daily income streams (Income Generator Level 10)

---

## Economic Balance

**Starting Phase**:
- ₡2,000,000 starting Credits (increased from ₡1M)
- Can afford: 1 robot (₡500K) + good weapon (₡300K) + upgrades (₡500K) + facility (₡200K) = ₡1.5M, leaving ₡500K buffer
- Or: 2 robots (₡1M) + basic weapons (₡200K each) + minimal upgrades (₡400K) + facility (₡200K) = ₡2M exactly

**Facility Investment Payoff** (estimated):
- Repair Bay Level 1: Pays for itself after ~40 battles (₡200K / ₡5K avg savings per battle)
- Training Facility Level 1: Pays for itself after upgrading ~600 attribute levels (₡300K / ₡500 avg savings)
- Income Generator Level 1: Pays for itself after ~27 days (₡800K / (₡5K/day - ₡1K/day operating))
- Weapons Workshop Level 1: Pays for itself after buying ~8 weapons (₡250K / ₡30K avg savings per weapon)

**Prestige Unlocks**:
- Encourage long-term play
- Provide goals beyond Credits
- Create aspirational content (World Championship at 50,000 prestige)
- Reward consistent performance

**Operating Costs**:
- Scale with facility levels (~₡20K-₡40K/day for mid-game stable)
- Balanced by income streams (₡30K-₡60K/day from battles + passive income)
- Creates strategic decisions (which facilities to upgrade vs operating cost burden)

---

## See Also

- **[PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)** - ⭐ **AUTHORITATIVE** - Product requirements, implementation status, and complete prestige/fame system specification
- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)** - Complete weapon system, loadout configurations, and weapon catalog
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Authoritative source for User and Facility models
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)** - Robot attribute system and combat mechanics
- **[PRD_BATTLE_STANCES_AND_YIELD.md](PRD_BATTLE_STANCES_AND_YIELD.md)** - Product requirements for battle stance and yield threshold implementation
- **[PRD_WEAPON_LOADOUT.md](PRD_WEAPON_LOADOUT.md)** - Product requirements for weapon loadout system implementation
- **[ROADMAP.md](ROADMAP.md)** - Implementation phases and future enhancements

---

**This stable system provides:**
- ✅ Clear resource management (Credits, Prestige)
- ✅ Meaningful long-term investments (14 facility types, 10 levels each)
- ✅ Progression goals (prestige milestones unlock facilities)
- ✅ Strategic choices (which facilities to upgrade first, operating cost trade-offs)
- ✅ Roster management (1-10 robot slots via facility)
- ✅ Economic depth (daily income/expense sheet, multiple revenue streams)
- ✅ Aspirational content (high-prestige unlocks for late game)
- ✅ Balanced starting economy (₡2M allows 1-2 robots with facilities)
