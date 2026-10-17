# Design Document: Stable System

**Project**: Armoured Souls  
**Document Type**: Design Document  
**Version**: v1.6  
**Last Updated**: October 17, 2026  
**Status**: ✅ Implemented 

## Version History
- **v1.6** (October 17, 2026): Season 2 economy (#524, #525) — streaming formula v2 (additive audience, Streaming Studio +50% per level, 6× at L10); Merchandising Hub ₡25,000 per level; Repair Bay discount 6% per level for every stable (60% at L10), roster size no longer an input.

- **v1.5** (October 16, 2026): Season 2 — new Refinement Lab facility (14 facilities) takes over the refinement tier gates from the Weapons Workshop; Workshop discount 5% per level (resale 10% per level); facility categories Economy / Hangar & Armory / Training Academies / Tactical & Advanced (4-4-4-2).

- **v1.4** (October 10, 2026): Added Stable_Type (`human`, `generated`, `automaton`) for Automaton stables (Spec #55).
- **v1.3** (July 26, 2026): Training Facility discount is now roster-dependent — `max(0, 10 - Roster_Capacity)` percentage points per level, clamped to 90%. maxLevel raised 9 → 10, since the old flat formula saturated at level 9 and made level 10 worthless (Spec #46 R11).
- **v1.2** (April 16, 2026): Added Tuning Bay (facility #16) to the facility list with pool size formula, operating costs, prestige requirements, and combat integration summary. Updated facility count from 15 to 16.
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

### Stable_Type (Spec #55)

Every stable has a Stable_Type in `users.stable_type`:

| Value | Who | Rollover | Player-visible |
|---|---|---|---|
| `human` | Registered players and the `admin` account (default) | Archived and reset | — |
| `generated` | Generated_Stables: `auto_*` bots, seeded `test_user_*` (`is_generated = true`) | Deleted | "bot" chip in the season archive |
| `automaton` | Active Automaton_Stables (`automaton_{catalogueKey}`) | Archived and reset like humans, then rebuilt from the profile | Automaton_Badge after the stable name |

`is_generated = true` ⇔ `stable_type = generated`. Automaton stables use the same facilities, prices, Prestige_Gates and income as every stable, cannot log in, and never use Manual_Repair. A Draft_Automaton has no `users` row and is not a stable yet. See [PRD_AUTOMATON_STABLES.md](PRD_AUTOMATON_STABLES.md).

---

## Facility System

Players invest Credits in facility upgrades that provide stable-wide benefits. All facilities have **10 levels** (Level 0 = not purchased, Levels 1-10 = upgrades). Some facility levels require prestige thresholds to unlock.

### Complete Facility List (14 Total)
1. **Repair Bay** - Repair cost discounts
2. **Training Facility** - Attribute upgrade discounts
3. **Weapons Workshop** - Weapon purchase discounts and resale rate
4. **Refinement Lab** - Weapon refinement tier gates (Season 2)
5. **Roster Expansion** - Robot roster slots (1→10)
6. **Storage Facility** - Weapon storage capacity
7. **Booking Office** - Event subscription access
8. **Combat Training Academy** - Combat Systems attribute caps
9. **Defense Training Academy** - Defensive Systems attribute caps
10. **Mobility Training Academy** - Chassis & Mobility attribute caps
11. **AI Training Academy** - AI Processing + Team Coordination attribute caps
12. **Merchandising Hub** - Merchandising revenue (scales with prestige)
13. **Streaming Studio** - Increases streaming revenue per battle
14. **Tuning Bay** - Bonus attribute points for tactical per-battle tuning

Player-facing categories (4-4-4-2): **Economy** (Repair Bay, Training Facility, Merchandising Hub, Streaming Studio), **Hangar & Armory** (Roster Expansion, Storage Facility, Weapons Workshop, Refinement Lab), **Training Academies** (the four academies), **Tactical & Advanced** (Tuning Bay, Booking Office).

### Facility Upgrades

**1. Repair Bay** (Operating Cost: ₡1,000 at L1, +₡500/level thereafter)
- **Level 0**: No discount
- **Level 1** (₡50,000): 6% discount on repair costs
- **Level 2** (₡100,000): 12% discount on repair costs
- **Level 3** (₡150,000): 18% discount on repair costs
- **Level 4** (₡200,000, requires 1,000 prestige): 24% discount on repair costs
- **Level 5** (₡250,000): 30% discount on repair costs
- **Level 6** (₡300,000): 36% discount on repair costs
- **Level 7** (₡350,000, requires 5,000 prestige): 42% discount on repair costs
- **Level 8** (₡400,000): 48% discount on repair costs
- **Level 9** (₡450,000, requires 10,000 prestige): 54% discount on repair costs
- **Level 10** (₡500,000): 60% discount on repair costs (maximum)

**Discount Formula** (Season 2, #525): Discount % = 6 × min(Repair Bay Level, 10), the same for every stable regardless of roster size. Implemented once as `calculateRepairBayDiscountPercent(repairBayLevel)` in `app/shared/utils/repairCost.ts`.

Before Season 2 the discount was `min(90, Level × (5 + owned robots))`, which let a 10-robot stable reach 90% at Level 6. A 1-robot stable keeps exactly the old curve; larger rosters no longer get a higher rate.

**Operating Cost Formula**: ₡1,000 at Level 1 + ₡500 per extra level (₡3,000 at L5, ₡5,500 at L10).

**2. Training Facility** (Operating Cost: ₡250/day per level)

**Discount Formula** (Spec #46 R11):
```
rate_per_level = max(0, 10 - Roster_Capacity)     // percentage points
discount%      = clamp(rate_per_level × level, 0, 90)
```

`Roster_Capacity` is the `roster_expansion` facility level + 1 — the number of robot slots the stable has, not a live count of robots. It is derived from the facility level so it is monotonic and cannot be gamed by selling a robot.

**The discount now depends on roster size as well as facility level.** A concentrated stable gets far more from this facility than a wide one, putting it on the same axis as the Merchandising Hub. Worked examples:

| Facility Level | Roster_Capacity | Rate per level | Discount |
|---|---|---|---|
| 5 | 4 | 6% | 30% |
| 8 | 2 | 8% | 64% |
| 10 | 1 | 9% | **90%** (maximum) |
| 10 | 10 | 0% | 0% |

A 10-slot roster earns nothing from this facility at any level. That is intentional: a wide stable has ten robots' worth of attributes to fund and should not also get the deepest discount per upgrade.

**Level costs and prestige gates** (₡150,000 × level, ₡250/day per level). The discount column below quotes the **best case** of Roster_Capacity 1 — the Facilities page shows the player's actual figure against their own roster:

| Level | Cost | Prestige Gate | Max Discount (1 slot) | Operating Cost |
|---|---|---|---|---|
| 1 | ₡150,000 | — | 9% | ₡250/day |
| 2 | ₡300,000 | — | 18% | ₡500/day |
| 3 | ₡450,000 | — | 27% | ₡750/day |
| 4 | ₡600,000 | 1,000 | 36% | ₡1,000/day |
| 5 | ₡750,000 | — | 45% | ₡1,250/day |
| 6 | ₡900,000 | — | 54% | ₡1,500/day |
| 7 | ₡1,050,000 | 5,000 | 63% | ₡1,750/day |
| 8 | ₡1,200,000 | — | 72% | ₡2,000/day |
| 9 | ₡1,350,000 | 10,000 | 81% | ₡2,250/day |
| 10 | ₡1,500,000 | — | **90%** | ₡2,500/day |

**maxLevel is 10**, raised from 9 under Spec #46 R11. Under the old flat `min(level × 10, 90)` formula the discount saturated at level 9, so level 10 was worth literally nothing and the facility was capped at 9 to reflect that. With a roster-dependent rate, level 10 is the only way a single-robot stable reaches 90%, so the level now earns its place. Level 10 carries no prestige gate.

**Operating Cost Formula**: Operating Cost = Level × ₡250/day

**Strategic Value**:
- A single-robot stable should take this facility to level 10 — it is the deepest upgrade discount in the game
- Every roster expansion permanently reduces the rate by 1 percentage point per level, so widening the roster and maxing this facility pull against each other
- At Roster_Capacity 10 the facility is inert; do not buy it for a maximally wide stable

**3. Weapons Workshop** (Operating Cost: ₡100/day per level)
- **Level 0**: No discount, no resale
- **Levels 1–10** (₡75,000 → ₡750,000, `PRESTIGE_GATES_10`): 5% discount per level on weapon purchases (50% at L10), **10% resale rate per level** (100% at L10, full credit recovery)

**Dual Purpose**: Workshop level rewards the player on both ends of every weapon transaction.
- **Discount Formula**: Discount % = Weapons Workshop Level × 5 (applies to purchases; Season 2, was × 10)
- **Resale Rate Formula**: Resale Rate % = Weapons Workshop Level × 10 (applies to sales)

The Workshop does not gate refinement since Season 2; see the Refinement Lab below.

Resale value is computed as `pricePaid × resaleRate(workshopLevel)`, where `pricePaid` is the actual credits the player paid at purchase time (after Workshop discount). This anchors resale to historical reality and prevents a free-weapon arbitrage exploit at L10. Equipped weapons cannot be sold — players must unequip first. See [PRD_WEAPON_ECONOMY.md → Version 1.5](PRD_WEAPON_ECONOMY.md) for the full design.

**For complete weapon details, see [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**

**3a. Refinement Lab** (Operating Cost: ₡100/day per level; Season 2)
- **Levels 1–10** (₡75,000 → ₡750,000, `PRESTIGE_GATES_10`, mirroring the Workshop)
- Gates the weapon refinement tiers: Hone L1, Augment L3, Sharpen L5, Forge L8 (`REQUIRED_REFINEMENT_LAB_LEVELS` in `app/shared/utils/weaponRefinement.ts`). Levels 9–10 add no tier.
- Existing stables received a Lab at their Workshop level through the one-off migration `20261016120000_grant_refinement_lab`. See [PRD_WEAPON_ECONOMY.md → Version 1.9](PRD_WEAPON_ECONOMY.md).

**4. Roster Expansion** (Operating Cost: ₡500/day per robot slot beyond first)
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

**5. Booking Office** (Operating Cost: None - generates prestige instead)
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

**6. Combat Training Academy** (Operating Cost: ₡250/day per level)
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

**7. Defense Training Academy** (Operating Cost: ₡250/day per level)
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

**8. Mobility Training Academy** (Operating Cost: ₡250/day per level)
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

**9. AI Training Academy** (Operating Cost: ₡250/day per level)
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

**10. Merchandising Hub** (Operating Cost: ₡200/day per level)
- **Level 0**: No merchandising income
- **Level 1** (₡150,000): Unlock Merchandising (₡25,000/day base, scales with prestige per robot slot)
- **Level 2** (₡300,000): Improve Merchandising (₡50,000/day base)
- **Level 3** (₡450,000): Improve Merchandising (₡75,000/day base)
- **Level 4** (₡600,000, requires 3,000 prestige): Improve Merchandising (₡100,000/day base)
- **Level 5** (₡750,000): Improve Merchandising (₡125,000/day base)
- **Level 6** (₡900,000): Improve Merchandising (₡150,000/day base)
- **Level 7** (₡1,050,000, requires 7,500 prestige): Improve Merchandising (₡175,000/day base)
- **Level 8** (₡1,200,000): Improve Merchandising (₡200,000/day base)
- **Level 9** (₡1,350,000, requires 15,000 prestige): Improve Merchandising (₡225,000/day base)
- **Level 10** (₡1,500,000): Master Merchandising (₡250,000/day base)

**Operating Cost Formula**: Operating Cost = Level × ₡200/day

**Merchandising Income Formula** (base ₡25,000 per level since Season 2, #524; was ₡10,000):
```
roster_capacity = roster_expansion_level + 1
merchandising_income = round((level × ₡25,000) × (1 + (prestige / roster_capacity) / 10,000))
```

**Break-Even Analysis**:
- Level 1: ~6 cycles with 100 prestige on 1 slot (₡150K investment, ₡25,050/day net income)
- Passive income - works with any strategy
- Scales linearly with level and prestige

**Note**: Streaming revenue is awarded per battle. See Streaming Studio facility.

**11. Streaming Studio** (Operating Cost: ₡100/day per level)
- **Level 0**: No streaming revenue bonus (base 1.0× multiplier; base streaming is still paid)
- **Level 1** (₡100,000): +50% streaming revenue per battle (1.5× multiplier, ₡100/day operating cost)
- **Level 2** (₡200,000): 2× streaming revenue per battle (₡200/day operating cost)
- **Level 3** (₡300,000): 2.5× streaming revenue per battle (₡300/day operating cost)
- **Level 4** (₡400,000, requires 1,000 prestige): 3× streaming revenue per battle (₡400/day operating cost)
- **Level 5** (₡500,000, requires 2,500 prestige): 3.5× streaming revenue per battle (₡500/day operating cost)
- **Level 6** (₡600,000, requires 5,000 prestige): 4× streaming revenue per battle (₡600/day operating cost)
- **Level 7** (₡700,000, requires 10,000 prestige): 4.5× streaming revenue per battle (₡700/day operating cost)
- **Level 8** (₡800,000, requires 15,000 prestige): 5× streaming revenue per battle (₡800/day operating cost)
- **Level 9** (₡900,000, requires 25,000 prestige): 5.5× streaming revenue per battle (₡900/day operating cost)
- **Level 10** (₡1,000,000, requires 50,000 prestige): 6× streaming revenue per battle, maximum (₡1,000/day operating cost)

**Operating Cost Formula**: Operating Cost = Level × ₡100/day

**Streaming Revenue Formula** (Season 2, #524; formula version '2'):
```
streaming_revenue = floor(floor(1000 × audience_multiplier × studio_multiplier) / team_size)

Where:
  audience_multiplier = 1 + (robot_total_battles / 2000) + (robot_fame / 10000)
  studio_multiplier = 1 + (streaming_studio_level × 0.5)
  team_size = 1 for solo modes, 2 for Tag Team and 2v2, 3 for 3v3
```

No term is capped. Before Season 2 the terms multiplied (`1000 × (1 + battles/1000) × (1 + fame/5000) × (1 + level)`). The single implementation is `computeStreamingRevenue()` in `app/backend/src/services/economy/streamingRevenueService.ts`; see [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md#4-streaming-revenue-per-battle).

**Break-Even Analysis** (Level 1, new robots, +₡500 per battle, ₡100/day operating cost):
- 5 battles/day: ~42 cycles (₡100K investment)
- 3.6 battles/day: ~59 cycles
- 2.2 battles/day: ~100 cycles
- Payback shortens as robots gain battles and Fame

**Examples** (solo matches):
- New robot (0 battles, 0 fame) with Level 0 Studio: ₡1,000 per battle
- New robot (0 battles, 0 fame) with Level 1 Studio: ₡1,500 per battle
- Veteran robot (100 battles, 500 fame) with Level 1 Studio: ₡1,650 per battle
- Veteran robot (1000 battles, 5000 fame) with Level 1 Studio: ₡3,000 per battle
- Veteran robot (1000 battles, 5000 fame) with Level 10 Studio: ₡12,000 per battle
- Veteran robot (552 battles, 10,492 fame) with Level 9 Studio: ₡12,788 per battle (v1 paid ₡48,087)

**Key Features**:
- Streaming revenue awarded after every fought battle in every mode
- Both winner and loser receive streaming revenue
- No revenue for bye matches
- Studio multiplier applies to all robots in the stable
- In team matches each robot earns its own award (own battles and Fame), divided by its team size
- Each level adds 50% to the multiplier (L1 = 1.5×, L2 = 2×, L10 = 6×)

**12. Tuning Bay** (Operating Cost: ₡300/day per level)
- **Level 0**: 10 free tuning points per robot (no facility required)
- **Level 1** (₡200,000): 20 tuning points per robot (₡300/day operating cost)
- **Level 2** (₡400,000): 30 tuning points per robot (₡600/day operating cost)
- **Level 3** (₡600,000, requires 1,000 prestige): 40 tuning points per robot (₡900/day operating cost)
- **Level 4** (₡800,000): 50 tuning points per robot (₡1,200/day operating cost)
- **Level 5** (₡1,000,000, requires 3,000 prestige): 60 tuning points per robot (₡1,500/day operating cost)
- **Level 6** (₡1,200,000): 70 tuning points per robot (₡1,800/day operating cost)
- **Level 7** (₡1,400,000, requires 5,000 prestige): 80 tuning points per robot (₡2,100/day operating cost)
- **Level 8** (₡1,600,000): 90 tuning points per robot (₡2,400/day operating cost)
- **Level 9** (₡1,800,000, requires 10,000 prestige): 100 tuning points per robot (₡2,700/day operating cost)
- **Level 10** (₡2,000,000, requires 15,000 prestige): 110 tuning points per robot — maximum (₡3,000/day operating cost)

**Pool Size Formula**: Pool Size = (Level + 1) × 10

**Per-Attribute Cap**: base + tuningBonus ≤ academyCap + 5. The "+5" overclock window lets the engineering team push 5 points beyond academy-rated specs. Higher academy investment = more room for tuning.

**Operating Cost Formula**: Operating Cost = Level × ₡300/day

**Combat Integration**: Tuning bonuses are added as a third additive term in the effective stat formula: `(base + weaponBonus + tuningBonus) × loadoutMultiplier`. Allocations persist until changed — no decay, no per-battle reset.

For the full system specification, see [TUNING_BAY_SYSTEM.md](TUNING_BAY_SYSTEM.md).

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
- Formula: `merchandising_income = base_merchandising × (1 + (prestige / roster_capacity) / 10000)`, base ₡25,000 per Merchandising Hub level

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
merchandising_income = (level × ₡25,000) × (1 + (prestige / roster_capacity) / 10000)

Example (1 robot slot):
- Merchandising Hub Level 4: ₡100,000/day base (4 × ₡25,000)
- Prestige 15,000
- Merchandising = ₡100,000 × (1 + 15000/10000) = ₡100,000 × 2.5 = ₡250,000/day
```

**Streaming Revenue** (from every fought battle; the Streaming Studio multiplies it):
```
streaming_revenue = floor(floor(1000 × audience_multiplier × studio_multiplier) / team_size)

Where:
  audience_multiplier = 1 + (robot_total_battles / 2000) + (robot_fame / 10000)
  studio_multiplier = 1 + (streaming_studio_level × 0.5)

// Each level adds 50%: L1 = 1.5×, L2 = 2×, L10 = 6×
// Awarded per battle (not daily passive income)
// Both winner and loser receive streaming revenue
// No revenue for bye matches
// robot_battles is the all-modes count: league 1v1 + tournaments + tag team
//   + 2v2/3v3 League (robots.total_battles) + KotH + Grand Melee (standings.total_matches)

Example:
- Robot with 500 battles, 2500 fame, solo match
- Streaming Studio Level 3
- audience_multiplier = 1 + 500/2000 + 2500/10000 = 1.5
- studio_multiplier = 1 + (3 × 0.5) = 2.5
- Streaming = ₡1,000 × 1.5 × 2.5 = ₡3,750 per battle
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
  Roster Expansion (4 robots): ₡1,500
  Combat Academy (Lvl 3):  ₡1,600
  Defense Academy (Lvl 2): ₡1,200
  Mobility Academy (Lvl 2): ₡1,200
  AI Academy (Lvl 1):      ₡1,000
  Merchandising Hub (Lvl 5): ₡3,500
  Streaming Studio (Lvl 5): ₡500
  ─────────────────────────────────
  Total Operating Costs:   ₡20,500

REPAIRS:
  Robot "Thunder":         ₡8,500
  Robot "Blitz":           ₡12,000
  ─────────────────────────────────
  Total Repair Costs:      ₡20,500

═══════════════════════════════════════
NET INCOME:                ₡65,500
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
3. Save for Repair Bay Level 1 (₡50K) - 6% repair discount for any roster size
4. Consider Streaming Studio Level 1 (₡100K) - +50% per-battle streaming revenue (1.5× multiplier)
5. Focus on battles to earn Credits and prestige
6. Remaining: ~₡750K for additional upgrades or second robot

**Viable Alternative**: 
- Build 2 robots (₡1M) with cheap weapons (₡200K total)
- Leaves ₡800K for initial upgrades and facility
- Riskier but allows testing different builds

**Streaming Studio Early Investment**:
- **Low Cost**: Level 1 costs only ₡100K with ₡100/day operating cost
- **ROI**: +50% on all streaming revenue from battles (1.5× multiplier)
- **Scales with Activity**: More valuable if you battle frequently
- **Example**: 10 battles/day at ₡1,000 base = ₡5,000 extra per day (₡15K total vs ₡10K total)
- **Recommendation**: Invest early if you plan to battle frequently; otherwise prioritize Repair Bay

**Repair Bay ROI**:
- The rate is the same for every stable: 6% per level (Season 2, #525)
- The saving in Credits grows with repair volume, so more robots or more battles shorten the payback; the percentage does not change
- Level 1 costs ₡1,000/day to operate, so it pays off once it saves more than that each day

### Mid Game (₡5M+ total earned)
1. Upgrade key facilities (Repair Bay, Training Facility to Level 3-4)
2. Expand robot roster to 3-4 robots
3. Unlock Merchandising Hub for passive income (merchandising)
4. Upgrade Streaming Studio to Level 3-5 for a 2.5×-3.5× streaming multiplier
5. Specialize robots for different strategies
6. Invest in better weapons (₡300K-₡400K range)
7. Participate in Silver/Gold tournaments

**Repair Bay Strategy**:
- Repair Bay Level 3 gives 18% for any roster size; roster size does not change the rate
- Combined with manual repairs (50% off the discounted quote), repair costs become much more manageable

**Streaming Studio Mid-Game Value**:
- Level 3-5 provides a 2.5×-3.5× multiplier on streaming revenue
- With veteran robots (500+ battles, 2500+ fame), streaming revenue becomes significant
- Example: Robot with 500 battles, 2500 fame, Level 5 Studio earns ₡5,250 per battle
- Multiple active robots multiply the benefit across all battles

### Late Game (₡20M+ total earned)
1. Max out critical facilities (Repair Bay, all 4 Training Academies)
2. Upgrade Streaming Studio to Level 10 for a 6× streaming revenue multiplier
3. Build specialized arena teams
4. Invest in prestige-locked content (high-tier tournaments)
5. Compete in high-tier tournaments (Diamond/Champion)
6. Build legendary custom weapons
7. Optimize daily income streams (Merchandising Hub Level 10, Streaming Studio Level 10)

**Repair Bay at the top end**:
- **Repair Bay Level 10**: 60% discount for any roster size; every level up to 10 adds 6 percentage points, so no level is wasted

**Streaming Studio Late-Game Impact**:
- Level 10 provides a 6× multiplier on base streaming revenue
- Veteran robots (5000+ battles, 25000+ fame) with Level 10 Studio earn ₡36,000 per battle (audience 1 + 2.5 + 2.5 = 6, × 6 Studio)
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
