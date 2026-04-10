# Design Document: Stable System

**Project**: Armoured Souls  
**Document Type**: Design Document  
**Version**: v1.0  
**Last Updated**: April 2, 2026  
**Status**: ✅ Implemented 

## Version History

- **v1.1** (April 2, 2026): Audit against codebase. Fixed operating cost formulas (Repair Bay, Training Facility). Fixed Training Facility maxLevel (9, not 10). Fixed streaming studio multiplier formula inconsistency. Removed stale User model fields (totalBattles, totalWins, highestELO — computed at query time). Updated facility count to 15 (added Streaming Studio). Updated file path references for backend service consolidation.
- **v1.0** (Jan 30, 2026): Initial draft

## Overview

A **Stable** is the player's collection and management system for their robots. Each user has one stable where they manage Credits, Prestige, facility upgrades, and their robot roster.

**Database Schema**: See DATABASE_SCHEMA.md for authoritative field definitions and relationships.

---

## Stable-Level Attributes

### Core Resources

**Credits (₡)** - Primary currency
- Starting balance: ₡3,000,000 (increased Feb 8, 2026) 
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

**Stable-Level Statistics**:
- **Championship Titles**: Tournament victories (stored on User model)
- **Win Rate**: Computed from robot data at query time
- **Total Battles / Total Wins**: Aggregated from robots at query time (not stored on User)
- **Active Robots**: Current roster size (computed)
- **Highest ELO**: Best ELO across robots (computed)

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

### Complete Facility List (15 Total)
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
14. **Merchandising Hub** - Merchandising revenue (scales with prestige)
15. **Streaming Studio** - Increases streaming revenue per battle

### Facility Upgrades

**1. Repair Bay** (Operating Cost: ₡1,000 at L1, +₡500/level thereafter)
- **Level 0**: No discount
- **Level 1** (₡50,000): 6% discount on repair costs (1 robot)
- **Level 2** (₡100,000): 12% discount on repair costs (1 robot)
- **Level 3** (₡150,000): 18% discount on repair costs (1 robot)
- **Level 4** (₡200,000, requires 1,000 prestige): 24% discount on repair costs (1 robot)
- **Level 5** (₡250,000): 30% discount on repair costs (1 robot)
- **Level 6** (₡300,000): 36% discount on repair costs (1 robot)
- **Level 7** (₡350,000, requires 5,000 prestige): 42% discount on repair costs (1 robot)
- **Level 8** (₡400,000): 48% discount on repair costs (1 robot)
- **Level 9** (₡450,000, requires 10,000 prestige): 54% discount on repair costs (1 robot)
- **Level 10** (₡500,000): 60% discount on repair costs (1 robot), automatic minor repairs

**Discount Formula**: Discount % = Repair Bay Level × (5 + Active Robot Count), capped at 90%

**Multi-Robot Discount Examples**:
- Level 1 + 4 robots: 1 × (5 + 4) = 9% discount
- Level 3 + 2 robots: 3 × (5 + 2) = 21% discount
- Level 5 + 7 robots: 5 × (5 + 7) = 60% discount
- Level 6 + 10 robots: 6 × (5 + 10) = 90% discount (capped)
- Level 10 + 10 robots: 10 × (5 + 10) = 150% → 90% discount (capped)

**⚠️ 90% Discount Cap**: Once you reach 90% discount, further Repair Bay or Roster Expansion investment provides no additional repair cost benefit. Plan your investments accordingly:
- With 10 robots: Level 6 Repair Bay reaches the 90% cap
- With 5 robots: Level 10 Repair Bay reaches the 75% discount (15 × 5 = 75%)
- Maximum benefit requires both high Repair Bay level AND large robot roster

**2. Training Facility** (Operating Cost: ₡250/day per level)
- **Level 1** (₡150,000): 10% discount on attribute upgrade costs (₡250/day operating cost)
- **Level 2** (₡300,000): 20% discount on attribute upgrade costs (₡500/day operating cost)
- **Level 3** (₡450,000): 30% discount on attribute upgrade costs (₡750/day operating cost)
- **Level 4** (₡600,000, requires 1,000 prestige): 40% discount on attribute upgrade costs (₡1,000/day operating cost)
- **Level 5** (₡750,000): 50% discount on attribute upgrade costs (₡1,250/day operating cost)
- **Level 6** (₡900,000): 60% discount on attribute upgrade costs (₡1,500/day operating cost)
- **Level 7** (₡1,050,000, requires 5,000 prestige): 70% discount on attribute upgrade costs (₡1,750/day operating cost)
- **Level 8** (₡1,200,000): 80% discount on attribute upgrade costs (₡2,000/day operating cost)
- **Level 9** (₡1,350,000, requires 10,000 prestige): 90% discount on attribute upgrade costs (₡2,250/day operating cost, maximum)

**Discount Formula**: Discount % = Training Facility Level × 10%, capped at 90%

**Operating Cost Formula**: Operating Cost = Level × ₡250/day

**Break-Even Analysis**:
- Level 1: Need ₡2,500/day in upgrades to cover operating costs (achievable in Bronze league)
- Level 2: Need ₡2,500/day in upgrades to cover operating costs (double the discount!)
- Full ROI: ~150 cycles for single-robot strategy, ~75 cycles for two-robot strategy

**Strategic Value**: 
- Early game (1 robot): Profitable from day 1 if upgrading regularly (₡2,500+/day)
- Mid game (2 robots): Highly profitable, essential for competitive progression
- Late game: Maximum 90% discount dramatically reduces upgrade costs for level 20-50 progression

**3. Weapons Workshop** (Operating Cost: ₡100/day per level)
- **Level 0**: No discount
- **Level 1** (₡75,000): 10% discount on weapon purchases
- **Level 2** (₡150,000): 20% discount on weapon purchases
- **Level 3** (₡225,000): 30% discount on weapon purchases, unlock weapon modifications
- **Level 4** (₡300,000, requires 1,500 prestige): 40% discount on weapon purchases
- **Level 5** (₡375,000): 50% discount on weapon purchases
- **Level 6** (₡450,000): 60% discount on weapon purchases, unlock custom weapon design
- **Level 7** (₡525,000, requires 5,000 prestige): 70% discount on weapon purchases
- **Level 8** (₡600,000): 80% discount on weapon purchases
- **Level 9** (₡675,000, requires 10,000 prestige): 90% discount on weapon purchases
- **Level 10** (₡750,000): 100% discount on weapon purchases (free weapons)

**Discount Formula**: Discount % = Weapons Workshop Level × 10

**For complete weapon details, see [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**

**4. Research Lab** (Operating Cost: ₡2,000/day at Level 1, +₡1,000/day per level)
- **Level 1** (₡200,000): Unlock advanced battle analytics
- **Level 2** (₡400,000): Unlock loadout presets (save 3 configurations per robot)
- **Level 3** (₡600,000): Unlock AI behavior customization
- **Level 4** (₡800,000, requires 2,000 prestige): Unlock 5 loadout presets per robot
- **Level 5** (₡1,000,000): Unlock battle simulation (test matchups without cost)
- **Level 6** (₡1,250,000): Unlock advanced statistics dashboard
- **Level 7** (₡1,500,000, requires 7,500 prestige): Unlock predictive AI (opponent analysis)
- **Level 8** (₡1,750,000): Unlock 8 loadout presets per robot
- **Level 9** (₡2,000,000, requires 15,000 prestige): Unlock experimental technology
- **Level 10** (₡2,500,000): Unlock robot cloning

**5. Medical Bay** (Operating Cost: ₡2,000/day at Level 1, +₡1,000/day per level)
- **Level 1** (₡175,000): 15% reduction on critical damage repair costs (0 HP)
- **Level 2** (₡350,000): 25% reduction on critical damage repair costs
- **Level 3** (₡525,000): 35% reduction on critical damage repair costs
- **Level 4** (₡700,000, requires 2,000 prestige): 45% reduction on critical damage repair costs
- **Level 5** (₡875,000): 55% reduction on critical damage repair costs
- **Level 6** (₡1,050,000): 65% reduction on critical damage repair costs, faster recovery protocols
- **Level 7** (₡1,250,000, requires 7,500 prestige): 75% reduction on critical damage repair costs
- **Level 8** (₡1,500,000): 85% reduction on critical damage repair costs
- **Level 9** (₡1,750,000, requires 15,000 prestige): 95% reduction on critical damage repair costs, prevent permanent damage
- **Level 10** (₡2,250,000): Eliminate critical damage penalties entirely

**6. Roster Expansion** (Operating Cost: ₡500/day per robot slot beyond first)
- **Level 0**: 1 robot slot (free, no operating cost)
- **Level 1** (₡150,000): 2 robot slots
- **Level 2** (₡300,000): 3 robot slots
- **Level 3** (₡450,000): 4 robot slots
- **Level 4** (₡600,000, requires 1,000 prestige): 5 robot slots
- **Level 5** (₡750,000): 6 robot slots
- **Level 6** (₡900,000): 7 robot slots
- **Level 7** (₡1,100,000, requires 5,000 prestige): 8 robot slots
- **Level 8** (₡1,300,000): 9 robot slots
- **Level 9** (₡1,500,000, requires 10,000 prestige): 10 robot slots (maximum)
- **Level 10**: N/A (Level 9 is maximum)

**7. Storage Facility** (Operating Cost: ₡500/day at Level 1, +₡250/day per level)
- **Level 0**: 5 weapons storage (free, base capacity)
- **Level 1** (₡75,000): 10 weapon slots (5 base + 5)
- **Level 2** (₡150,000): 15 weapons storage (5 base + 10)
- **Level 3** (₡225,000): 20 weapons storage (5 base + 15)
- **Level 4** (₡300,000): 25 weapons storage (5 base + 20)
- **Level 5** (₡375,000): 30 weapons storage (5 base + 25)
- **Level 6** (₡450,000): 35 weapons storage (5 base + 30)
- **Level 7** (₡550,000): 40 weapons storage (5 base + 35)
- **Level 8** (₡650,000): 45 weapons storage (5 base + 40)
- **Level 9** (₡750,000): 50 weapons storage (5 base + 45)
- **Level 10** (₡1,000,000): 55 weapons storage (5 base + 50, maximum)

**Formula**: Storage Capacity = 5 + (Storage Facility Level × 5)

**Storage Definition**: Storage capacity refers to the **total number of weapons owned by the stable**, including both equipped and unequipped weapons. This simplifies weapon management by ensuring there's never a situation where a player cannot swap weapons due to storage constraints.

**For weapon inventory management details, see [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**

**8. Coaching Staff** (Operating Cost: ₡3,000/day when coach active)
- **Level 0**: No coach available
- **Level 1** (₡250,000): Unlock Offensive Coach (+3% Combat Power for all robots)
- **Level 2** (₡350,000): Unlock Defensive Coach (+3% Armor Plating for all robots)
- **Level 3** (₡450,000, requires 2,000 prestige): Unlock Tactical Coach (+5% Threat Analysis for all robots)
- **Level 4** (₡600,000): Improve Offensive Coach (+5% Combat Power)
- **Level 5** (₡750,000): Improve Defensive Coach (+5% Armor Plating)
- **Level 6** (₡900,000, requires 5,000 prestige): Improve Tactical Coach (+8% Threat Analysis)
- **Level 7** (₡1,100,000): Unlock Team Coach (+5% team coordination bonuses for arena battles)
- **Level 8** (₡1,300,000): Improve Offensive Coach (+7% Combat Power)
- **Level 9** (₡1,500,000, requires 10,000 prestige): Improve Defensive Coach (+7% Armor Plating)
- **Level 10** (₡1,750,000): Master Coach (combine two coach bonuses at 75% effectiveness)

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
- **Level 1** (₡250,000, requires 1,000 prestige): Unlock Silver league tournaments
- **Level 2** (₡500,000, requires 2,500 prestige): Unlock Gold league tournaments, custom paint jobs
- **Level 3** (₡750,000, requires 5,000 prestige): Unlock Platinum tournaments, exclusive weapon skins
- **Level 4** (₡1,000,000, requires 10,000 prestige): Unlock Diamond tournaments, legendary frame designs
- **Level 5** (₡1,250,000, requires 15,000 prestige): Enhanced tournament rewards (+10%)
- **Level 6** (₡1,500,000, requires 20,000 prestige): Enhanced tournament rewards (+20%)
- **Level 7** (₡1,750,000, requires 25,000 prestige): Access to Champion tournaments, hall of fame listing
- **Level 8** (₡2,000,000, requires 35,000 prestige): Enhanced tournament rewards (+30%)
- **Level 9** (₡2,250,000, requires 45,000 prestige): Enhanced tournament rewards (+40%)
- **Level 10** (₡2,500,000, requires 50,000 prestige): Access to World Championship, custom arena design

**10. Combat Training Academy** (Operating Cost: ₡250/day per level)
- **Level 0**: Combat Systems attributes (6) capped at level 10
- **Level 1** (₡100,000): Unlock Combat Systems cap to level 15
- **Level 2** (₡200,000): Unlock Combat Systems cap to level 20
- **Level 3** (₡300,000, requires 2,000 prestige): Unlock Combat Systems cap to level 25
- **Level 4** (₡400,000): Unlock Combat Systems cap to level 30
- **Level 5** (₡500,000, requires 4,000 prestige): Unlock Combat Systems cap to level 35
- **Level 6** (₡600,000): Unlock Combat Systems cap to level 40
- **Level 7** (₡700,000, requires 7,000 prestige): Unlock Combat Systems cap to level 42
- **Level 8** (₡800,000): Unlock Combat Systems cap to level 45
- **Level 9** (₡900,000, requires 10,000 prestige): Unlock Combat Systems cap to level 48
- **Level 10** (₡1,000,000, requires 15,000 prestige): Unlock Combat Systems cap to level 50 (maximum)

**11. Defense Training Academy** (Operating Cost: ₡250/day per level)
- **Level 0**: Defensive Systems attributes (5) capped at level 10
- **Level 1** (₡100,000): Unlock Defensive Systems cap to level 15
- **Level 2** (₡200,000): Unlock Defensive Systems cap to level 20
- **Level 3** (₡300,000, requires 2,000 prestige): Unlock Defensive Systems cap to level 25
- **Level 4** (₡400,000): Unlock Defensive Systems cap to level 30
- **Level 5** (₡500,000, requires 4,000 prestige): Unlock Defensive Systems cap to level 35
- **Level 6** (₡600,000): Unlock Defensive Systems cap to level 40
- **Level 7** (₡700,000, requires 7,000 prestige): Unlock Defensive Systems cap to level 42
- **Level 8** (₡800,000): Unlock Defensive Systems cap to level 45
- **Level 9** (₡900,000, requires 10,000 prestige): Unlock Defensive Systems cap to level 48
- **Level 10** (₡1,000,000, requires 15,000 prestige): Unlock Defensive Systems cap to level 50 (maximum)

**12. Mobility Training Academy** (Operating Cost: ₡250/day per level)
- **Level 0**: Chassis & Mobility attributes (5) capped at level 10
- **Level 1** (₡100,000): Unlock Chassis & Mobility cap to level 15
- **Level 2** (₡200,000): Unlock Chassis & Mobility cap to level 20
- **Level 3** (₡300,000, requires 2,000 prestige): Unlock Chassis & Mobility cap to level 25
- **Level 4** (₡400,000): Unlock Chassis & Mobility cap to level 30
- **Level 5** (₡500,000, requires 4,000 prestige): Unlock Chassis & Mobility cap to level 35
- **Level 6** (₡600,000): Unlock Chassis & Mobility cap to level 40
- **Level 7** (₡700,000, requires 7,000 prestige): Unlock Chassis & Mobility cap to level 42
- **Level 8** (₡800,000): Unlock Chassis & Mobility cap to level 45
- **Level 9** (₡900,000, requires 10,000 prestige): Unlock Chassis & Mobility cap to level 48
- **Level 10** (₡1,000,000, requires 15,000 prestige): Unlock Chassis & Mobility cap to level 50 (maximum)

**13. AI Training Academy** (Operating Cost: ₡250/day per level)
- **Level 0**: AI Processing + Team Coordination attributes (7) capped at level 10
- **Level 1** (₡100,000): Unlock AI & Team cap to level 15
- **Level 2** (₡200,000): Unlock AI & Team cap to level 20
- **Level 3** (₡300,000, requires 2,000 prestige): Unlock AI & Team cap to level 25
- **Level 4** (₡400,000): Unlock AI & Team cap to level 30
- **Level 5** (₡500,000, requires 4,000 prestige): Unlock AI & Team cap to level 35
- **Level 6** (₡600,000): Unlock AI & Team cap to level 40
- **Level 7** (₡700,000, requires 7,000 prestige): Unlock AI & Team cap to level 42
- **Level 8** (₡800,000): Unlock AI & Team cap to level 45
- **Level 9** (₡900,000, requires 10,000 prestige): Unlock AI & Team cap to level 48
- **Level 10** (₡1,000,000, requires 15,000 prestige): Unlock AI & Team cap to level 50 (maximum)

**14. Merchandising Hub** (Operating Cost: ₡200/day per level)
- **Level 0**: No merchandising income
- **Level 1** (₡150,000): Unlock Merchandising (₡5,000/day base, scales with prestige)
- **Level 2** (₡300,000): Improve Merchandising (₡10,000/day base)
- **Level 3** (₡450,000): Improve Merchandising (₡15,000/day base)
- **Level 4** (₡600,000, requires 3,000 prestige): Improve Merchandising (₡20,000/day base)
- **Level 5** (₡750,000): Improve Merchandising (₡25,000/day base)
- **Level 6** (₡900,000): Improve Merchandising (₡30,000/day base)
- **Level 7** (₡1,050,000, requires 7,500 prestige): Improve Merchandising (₡35,000/day base)
- **Level 8** (₡1,200,000): Improve Merchandising (₡40,000/day base)
- **Level 9** (₡1,350,000, requires 15,000 prestige): Improve Merchandising (₡45,000/day base)
- **Level 10** (₡1,500,000): Master Merchandising (₡50,000/day base)

**Operating Cost Formula**: Operating Cost = Level × ₡200/day

**Merchandising Income Formula**: 
```
merchandising_income = (level × ₡5,000) × (1 + prestige / 10,000)
```

**Break-Even Analysis**:
- Level 1: ~31 cycles with 100 prestige (₡150K investment, ₡4,800/day net income)
- Passive income - works with any strategy
- Scales linearly with level and prestige

**Note**: Streaming revenue is awarded per battle. See Streaming Studio facility.

**15. Streaming Studio** (Operating Cost: ₡100/day per level)
- **Level 0**: No streaming revenue bonus (base 1.0× multiplier)
- **Level 1** (₡100,000): Double streaming revenue per battle (2.0× multiplier, ₡100/day operating cost)
- **Level 2** (₡200,000): Triple streaming revenue per battle (3.0× multiplier, ₡200/day operating cost)
- **Level 3** (₡300,000): Quadruple streaming revenue per battle (4.0× multiplier, ₡300/day operating cost)
- **Level 4** (₡400,000, requires 1,000 prestige): 5× streaming revenue per battle (₡400/day operating cost)
- **Level 5** (₡500,000, requires 2,500 prestige): 6× streaming revenue per battle (₡500/day operating cost)
- **Level 6** (₡600,000, requires 5,000 prestige): 7× streaming revenue per battle (₡600/day operating cost)
- **Level 7** (₡700,000, requires 10,000 prestige): 8× streaming revenue per battle (₡700/day operating cost)
- **Level 8** (₡800,000, requires 15,000 prestige): 9× streaming revenue per battle (₡800/day operating cost)
- **Level 9** (₡900,000, requires 25,000 prestige): 10× streaming revenue per battle (₡900/day operating cost)
- **Level 10** (₡1,000,000, requires 50,000 prestige): 11× streaming revenue per battle (₡1,000/day operating cost)

**Operating Cost Formula**: Operating Cost = Level × ₡100/day

**Streaming Revenue Formula**:
```
streaming_revenue = 1000 × battle_multiplier × fame_multiplier × studio_multiplier

Where:
  battle_multiplier = 1 + (robot_total_battles / 1000)
  fame_multiplier = 1 + (robot_fame / 5000)
  studio_multiplier = 1 + (streaming_studio_level × 1.0)
```

**Break-Even Analysis**:
- Level 1 with 3 robots (5 battles/day): ~17 cycles (₡100K investment)
- Level 1 with 2 robots (3.6 battles/day): ~25 cycles (₡100K investment)
- Level 1 with 1 robot (2.2 battles/day): ~42 cycles (₡100K investment)
- Rewards active multi-robot play
- Scales infinitely with battles and fame

**Examples**:
- New robot (0 battles, 0 fame) with Level 0 Studio: ₡1,000 per battle
- New robot (0 battles, 0 fame) with Level 1 Studio: ₡2,000 per battle (DOUBLE!)
- Veteran robot (100 battles, 500 fame) with Level 1 Studio: ₡2,420 per battle
- Veteran robot (1000 battles, 5000 fame) with Level 1 Studio: ₡4,840 per battle
- Veteran robot (1000 battles, 5000 fame) with Level 10 Studio: ₡26,620 per battle (11×!)

**Key Features**:
- Streaming revenue awarded after every battle (1v1, Tag Team, Tournament)
- Both winner and loser receive streaming revenue
- No revenue for bye matches
- Studio multiplier applies to all robots in the stable
- For Tag Team matches, uses highest battles and highest fame from each team
- Each level adds 100% to the multiplier (L1 = 2×, L2 = 3×, L3 = 4×, etc.)

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
- Each tier has a fixed base win reward (midpoint of the tier's min/max range)
- Bronze: ₡7,500 per win
- Silver: ₡15,000 per win
- Gold: ₡30,000 per win
- Platinum: ₡60,000 per win
- Diamond: ₡115,000 per win
- Champion: ₡225,000 per win

**Prestige Bonuses**:
- 1,000+ Prestige: +10% to battle winnings
- 5,000+ Prestige: +20% to battle winnings
- 10,000+ Prestige: +30% to battle winnings
- 25,000+ Prestige: +40% to battle winnings
- 50,000+ Prestige: +50% to battle winnings

**Merchandising** (from Merchandising Hub facility):
```
merchandising_income = (level × ₡5,000) × (1 + prestige / 10000)

Example:
- Merchandising Hub Level 4: ₡20,000/day base (4 × ₡5,000)
- Prestige 15,000
- Merchandising = ₡20,000 × (1 + 15000/10000) = ₡20,000 × 2.5 = ₡50,000/day
```

**Streaming Revenue** (from Streaming Studio facility):
```
streaming_revenue = 1000 × battle_multiplier × fame_multiplier × studio_multiplier

Where:
  battle_multiplier = 1 + (robot_total_battles / 1000)
  fame_multiplier = 1 + (robot_fame / 5000)
  studio_multiplier = 1 + (streaming_studio_level × 1.0)

// Each level adds 100%: L1 = 2×, L2 = 3×, L3 = 4×, etc.
// Awarded per battle (not daily passive income)
// Both winner and loser receive streaming revenue
// No revenue for bye matches
// total_battles includes all modes: 1v1 + tournament + tag team + KotH

Example:
- Robot with 500 battles, 2500 fame
- Streaming Studio Level 5
- battle_multiplier = 1 + (500/1000) = 1.5
- fame_multiplier = 1 + (2500/5000) = 1.5
- studio_multiplier = 1 + (5 × 1.0) = 6.0
- Streaming = ₡1,000 × 1.5 × 1.5 × 6.0 = ₡13,500 per battle
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

- See **[PRD_INCOME_DASHBOARD.md](PRD_INCOME_DASHBOARD.md)** for the implementation of the income system and daily financial summary

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
  Streaming (per battle):  ₡27,000 (from 8 battles)
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
  Merchandising Hub (Lvl 5): ₡3,500
  Streaming Studio (Lvl 5): ₡500
  ─────────────────────────────────
  Total Operating Costs:   ₡26,500

REPAIRS:
  Robot "Thunder":         ₡8,500
  Robot "Blitz":           ₡12,000
  ─────────────────────────────────
  Total Repair Costs:      ₡20,500

═══════════════════════════════════════
NET INCOME:                ₡59,500
CURRENT BALANCE:           ₡1,847,000
═══════════════════════════════════════
```

**Frequency**: Displayed daily (or after each battle session in MVP)

---

## Stable Management Interface

- See **[PRD_DASHBOARD_PAGE.md](PRD_DASHBOARD_PAGE.md)** for the implementation of of the stable management interface

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

### Early Game (₡3M starting budget)
1. Build 1 robot with basic weapon (₡500K + ₡150K = ₡650K)
2. Upgrade key attributes (₡300K)
3. Save for Repair Bay Level 1 (₡100K) - provides 9% discount with 4 robots
4. Consider Streaming Studio Level 1 (₡100K) - doubles per-battle streaming revenue (2× multiplier)
5. Focus on battles to earn Credits and prestige
6. Remaining: ~₡750K for additional upgrades or second robot

**Viable Alternative**: 
- Build 2 robots (₡1M) with cheap weapons (₡200K total)
- Leaves ₡800K for initial upgrades and facility
- Riskier but allows testing different builds
- **Multi-Robot Benefit**: With 2 robots, Repair Bay Level 1 provides 7% discount (1 × (5 + 2))

**Streaming Studio Early Investment**:
- **Low Cost**: Level 1 costs only ₡100K with ₡100/day operating cost
- **Immediate ROI**: Doubles all streaming revenue from battles (2× multiplier)
- **Scales with Activity**: More valuable if you battle frequently
- **Example**: 10 battles/day at ₡1,000 base = ₡1,000 extra per day (₡10K total vs ₡20K total)
- **Recommendation**: Invest early if you plan to battle frequently; otherwise prioritize Repair Bay

**Repair Bay ROI with Multiple Robots**:
- **Single Robot**: Level 1 provides 5% discount (1 × (5 + 0)) - long payback period
- **Two Robots**: Level 1 provides 7% discount (1 × (5 + 2)) - faster payback
- **Four Robots**: Level 1 provides 9% discount (1 × (5 + 4)) - significantly faster payback
- **Recommendation**: Repair Bay investment becomes more valuable as you expand your roster

### Mid Game (₡5M+ total earned)
1. Upgrade key facilities (Repair Bay, Training Facility to Level 3-4)
2. Expand robot roster to 3-4 robots
3. Unlock Merchandising Hub for passive income (merchandising)
4. Upgrade Streaming Studio to Level 3-5 for 4×-6× streaming multiplier
5. Specialize robots for different strategies
6. Invest in better weapons (₡300K-₡400K range)
7. Participate in Silver/Gold tournaments

**Multi-Robot Discount Strategy**:
- With 3-4 robots, Repair Bay Level 3 provides 24-27% discount
- Combined with Roster Expansion, repair costs become much more manageable
- Each additional robot increases the discount from all Repair Bay levels

**Streaming Studio Mid-Game Value**:
- Level 3-5 provides 4×-6× multiplier on streaming revenue
- With veteran robots (500+ battles, 2500+ fame), streaming revenue becomes significant
- Example: Robot with 500 battles, 2500 fame, Level 5 Studio earns ₡13,500 per battle
- Multiple active robots multiply the benefit across all battles

### Late Game (₡20M+ total earned)
1. Max out critical facilities (Repair Bay, Medical Bay, all 4 Training Academies)
2. Upgrade Streaming Studio to Level 10 for 11× streaming revenue multiplier
3. Build specialized arena teams
4. Invest in prestige-locked content (high-tier tournaments)
5. Compete in high-tier tournaments (Diamond/Champion)
6. Build legendary custom weapons
7. Optimize daily income streams (Merchandising Hub Level 10, Streaming Studio Level 10)

**Optimal Multi-Robot Configuration**:
- **10 robots + Repair Bay Level 6**: Reaches 90% discount cap (6 × (5 + 10) = 90%)
- **10 robots + Repair Bay Level 10**: Still 90% discount (capped) - no additional benefit
- **5 robots + Repair Bay Level 10**: 75% discount (10 × (5 + 5) = 75%)
- **Strategic Insight**: Balance Repair Bay upgrades with Roster Expansion for maximum efficiency

**Streaming Studio Late-Game Impact**:
- Level 10 provides 11× multiplier on base streaming revenue
- Veteran robots (5000+ battles, 25000+ fame) with Level 10 Studio can earn ₡66,000+ per battle
- With high prestige (50,000 required for Level 10), streaming becomes a major income source
- Multiple high-fame robots battling frequently generates substantial daily streaming income

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
- ✅ Meaningful long-term investments (15 facility types, 10 levels each)
- ✅ Progression goals (prestige milestones unlock facilities)
- ✅ Strategic choices (which facilities to upgrade first, operating cost trade-offs)
- ✅ Roster management (1-10 robot slots via facility)
- ✅ Economic depth (daily income/expense sheet, multiple revenue streams)
- ✅ Per-battle streaming revenue system (rewards active participation)
- ✅ Aspirational content (high-prestige unlocks for late game)
- ✅ Balanced starting economy (₡3M allows 1-2 robots with facilities)
