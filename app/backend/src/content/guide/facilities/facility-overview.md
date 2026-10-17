---
title: "All 14 Facility Types"
description: "A complete overview of every facility in Armoured Souls — what each one does, what it costs, and why it matters for your stable."
order: 1
lastUpdated: "2026-10-17"
relatedArticles:
  - facilities/facility-progression
  - facilities/training-academies
  - facilities/investment-strategy
  - facilities/tuning-bay
  - economy/credits-and-income
---

## Overview

Your stable can house up to **14 different facilities**, each providing a unique benefit — from slashing repair bills to unlocking higher attribute caps. Every facility has up to 10 upgrade levels (except Roster Expansion, which caps at 9), and each level increases both the benefit and the daily operating cost.

Facilities are your long-term investments. Unlike one-time purchases like weapons or attribute upgrades, facilities generate ongoing value every single cycle — but they also charge ongoing operating costs. Choosing which facilities to invest in, and when, is one of the most important strategic decisions in the game.

![Facility overview grid](/images/guide/facilities/facility-overview-grid.png)

```callout-info
Facilities are grouped into four categories: Economy (4), Hangar & Armory (4), Training Academies (4), and Tactical & Advanced (2). This guide covers all 14 at a glance — see the individual articles for deep dives on level progression and ROI.
```

## Economy Facilities

These facilities reduce your operating costs or generate passive income. They tend to have the best early-game ROI.

| Facility | Purpose | Level 1 Cost | Operating Cost | Key Benefit |
|----------|---------|-------------|----------------|-------------|
| Training Facility | Attribute upgrade discounts | ₡150,000 | level × ₡250/day | Up to 67.5% — scales with level *and* shrinks as your roster grows |
| Repair Bay | Repair cost discounts | ₡50,000 | ₡1,000/day + ₡500 per extra level | 6% per level, up to 60% |
| Merchandising Hub | Passive merchandising income | ₡150,000 | level × ₡200/day | ₡25,000–₡250,000/day base income, scales with Prestige per robot slot |
| Streaming Studio | Streaming revenue multiplier | ₡100,000 | level × ₡100/day | 1.5×–6× streaming revenue per battle |

### Training Facility

The Training Facility provides a percentage discount on all attribute upgrade costs — but how much each level is worth depends on how many robot slots you have bought. Every slot takes 0.75 percentage points off the per-level rate.

**Discount formula**: Level × (10 − robot slots) × 0.75%

A single-robot stable earns 6.75% per level and reaches the 67.5% maximum at Level 10. A stable with 4 slots earns 4.5% per level, so Level 5 gives 22.5%. A stable with all 10 slots earns nothing from this facility at any level. The count uses the slots you have bought with Roster Expansion, not the robots you currently own.

| Facility Level | 1 slot | 2 slots | 4 slots | 7 slots | 10 slots |
|---|---|---|---|---|---|
| 5 | 33.75% | 30% | 22.5% | 11.25% | 0% |
| 8 | 54% | 48% | 36% | 18% | 0% |
| 10 | **67.5%** | 60% | 45% | 22.5% | 0% |

```callout-info
Season 2 reduced the Training Facility discount by a quarter: Level 10 with one slot gives 67.5% (it was 90%). Late attribute upgrades had become too cheap.
```

```callout-warning
Buying a Roster Expansion level permanently reduces this discount, by 0.75 points per Training Facility level (6.75 points at Level 9). Roster Expansion and the Training Facility pull against each other — a wide stable has more attributes to fund *and* pays more per upgrade. Decide which strategy you're playing before sinking credits into either.
```

Given that maxing all 23 attributes on a single robot costs over ₡29 million at full price, a deep discount on a concentrated roster saves enormous amounts over time.

### Repair Bay

The Repair Bay takes **6% off every repair per level**, up to **60% at Level 10**. The discount is the same for every stable, whatever the roster size: Level 3 gives 18% with one robot and 18% with ten.

It costs ₡1,000/day to run at Level 1, plus ₡500 per extra level (₡5,500/day at Level 10). The Credits it saves grow with how much you repair, so it pays off sooner for stables that take a lot of damage.

```callout-tip
Stack the Repair Bay with manual repairs: the 50% manual discount applies after the Repair Bay discount, so at Level 10 a manual repair costs 20% of the undiscounted price.
```

### Merchandising Hub

Unlocks passive daily income from merchandising. The base income is ₡25,000 per level per day (₡250,000 at Level 10), and it scales with your stable's [Prestige](/guide/prestige-fame/prestige-system) per robot slot. A concentrated roster gets the most from its Prestige.

**Income formula**: (Level × ₡25,000) × (1 + Prestige per robot slot / 10,000)

### Streaming Studio

Multiplies the streaming revenue your robots earn from every battle. Each level adds 50% — Level 1 gives 1.5×, Level 2 gives 2×, and Level 10 gives 6×. Robots earn base streaming revenue without a Studio; the Studio multiplies it for every robot in your stable. The operating cost is ₡100/day per level.

**Multiplier formula**: 1 + (Level × 0.5)

## Hangar & Armory Facilities

These facilities house your robots and weapons: robot slots, weapon storage, weapon purchasing and weapon refinement. They're essential for growth.

| Facility | Purpose | Level 1 Cost | Operating Cost | Key Benefit |
|----------|---------|-------------|----------------|-------------|
| Roster Expansion | More robot slots | ₡150,000 | ₡500/day per slot beyond first | 1→10 robot slots (9 levels max) |
| Storage Facility | More weapon storage | ₡75,000 | ₡500 + ₡250/level beyond first | 5→55 weapon slots |
| Weapons Workshop | Weapon purchase discounts and resale rate | ₡75,000 | level × ₡100/day | 5%–50% discount on purchases · 10%–100% resale rate when selling |
| Refinement Lab | Weapon refinement tiers | ₡75,000 | level × ₡100/day | Hone (L1), Augment (L3), Sharpen (L5), Forge (L8) |

### Roster Expansion

Every player starts with 1 robot slot. Each level of Roster Expansion adds one more slot, up to a maximum of 10 robots at Level 9. More robots means more battles and more streaming revenue — but also more repair costs, more operating expenses, and less Prestige per slot for merchandising and the Training Facility discount.

**Capacity formula**: 1 + Level (max 10 at Level 9)

### Storage Facility

Increases the total number of weapons your stable can own (both equipped and unequipped). You start with 5 weapon slots and gain 5 more per level, up to 55 at Level 10.

**Capacity formula**: 5 + (Level × 5)

### Weapons Workshop

The Workshop has a dual purpose: it reduces the purchase price of weapons AND determines how much credit you recover when selling weapons back.

**Purchase discount**: Level × 5%. At Level 1 you get 5% off; at Level 10 you get 50% off.

**Resale rate** (Spec #33): Level × 10%, capped at 100%. At Level 0 resale is unavailable (₡0 returned), so building Workshop Level 1 unlocks the resale system. At Level 10 you recover 100% of what you paid.

Resale value is computed against what you actually paid (after Workshop discount), not the catalog price. This means a weapon you bought at full price at L0 yields more on resale at L10 than a weapon you bought at half price at L10. At L10 you buy at half price and can sell back for the full amount you paid, which makes trading up cheap. Equipped weapons cannot be sold — unequip from your robot first.

The Workshop does not gate refinement: since Season 2 that is the [Refinement Lab](#refinement-lab)'s job.

**Sell weapons** via the **My Inventory** tab on the [Weapon Shop](/weapons?tab=inventory) page.

```callout-tip
Workshop is the cheapest meaningful facility upgrade in the game (₡75K for L1) and the only one that pays off on every weapon transaction in both directions. If you're planning to experiment with multiple weapons, build at least Level 1 first to enable resale.
```

### Refinement Lab

Unlocks the four [weapon refinement](/guide/weapons/refinement) tiers. Level 1 unlocks Hone, Level 3 Augment, Level 5 Sharpen and Level 8 Forge (all tiers). Levels 9 and 10 add no new tier. The Lab costs and gates the same as the Weapons Workshop: ₡75,000 per level up to ₡750,000 at Level 10, with the universal prestige gates, and ₡100/day per level to operate.

| Lab Level | Tiers available |
|---|---|
| 1–2 | Hone |
| 3–4 | Hone, Augment |
| 5–7 | Hone, Augment, Sharpen |
| 8–10 | All four (Forge added at L8) |

```callout-info
Season 2: the Refinement Lab took over the refinement tier gates from the Weapons Workshop. Every stable received a Lab at its Weapons Workshop level when the Lab was introduced, so no unlocked tier was lost. Granted Labs charge their operating cost like any other facility.
```

## Training Academies

Four academies control the attribute caps for each attribute category. Without academies, all attributes are capped at level 10. See the [Training Academies Guide](/guide/facilities/training-academies) for the full breakdown.

| Facility | Attribute Category | Attributes Covered | Level 1 Cost | Operating Cost |
|----------|-------------------|-------------------|-------------|----------------|
| Combat Training Academy | Combat Systems | 6 attributes | ₡100,000 | level × ₡250/day |
| Defense Training Academy | Defensive Systems | 5 attributes | ₡100,000 | level × ₡250/day |
| Mobility Training Academy | Chassis & Mobility | 5 attributes | ₡100,000 | level × ₡250/day |
| AI Training Academy | AI Processing + Team Coordination | 7 attributes | ₡100,000 | level × ₡250/day |

All four academies follow the same pricing structure: ₡100,000 per level, with the universal prestige gates at Levels 4, 5, 6, 7, 8, 9, and 10. Each level raises the attribute cap by 3–5 points, from a base cap of 10 up to a maximum of 50.

```callout-info
Training Academies are the only way to push attributes past level 10. If you want competitive robots in higher leagues, you'll need to invest in the academies that cover your build's key attributes.
```

## Tactical & Advanced Facilities

These facilities unlock special features and late-game mechanics. Some are not yet fully implemented.

| Facility | Purpose | Level 1 Cost | Operating Cost | Key Benefit |
|----------|---------|-------------|----------------|-------------|
| Tuning Bay | Per-robot tactical attribute tuning | ₡200,000 | level × ₡300/day | 10–110 bonus attribute points per robot |
| Booking Office | Event slots per robot | ₡75,000 | level × ₡150/day | +1 event slot per robot per level (3 free, up to 13) |

### Tuning Bay

The Tuning Bay provides a pool of bonus attribute points that can be freely allocated across any of a robot's 23 attributes. Every player gets 10 free tuning points per robot — the facility increases this to 20 at Level 1 and up to 110 at Level 10. Tuning points are added to base attributes alongside weapon bonuses before loadout multipliers apply: `(base + weapon + tuning) × loadout`. Allocations persist until changed — no decay, no cost to reallocate.

**Pool size formula**: (Level + 1) × 10

See the [Tuning Bay Guide](/guide/facilities/tuning-bay) for the full level table and the [Tactical Tuning Guide](/guide/strategy/tactical-tuning) for allocation strategies.

### Booking Office

Controls how many battle events each robot can be entered in at once. Every robot gets 3 event slots for free; each Booking Office level adds one more, up to 13. With nine events in the game, this is what lets a robot compete in several formats at the same time. See the [Booking Office](/guide/facilities/booking-office) article for the full breakdown.

## Operating Cost Summary

Here's what you'll pay daily for each facility at various levels:

| Facility | Level 1 | Level 5 | Level 10 |
|----------|---------|---------|----------|
| Training Facility | ₡250 | ₡1,250 | ₡2,500 |
| Weapons Workshop | ₡100 | ₡500 | ₡1,000 |
| Refinement Lab | ₡100 | ₡500 | ₡1,000 |
| Repair Bay | ₡1,000 | ₡3,000 | ₡5,500 |
| Merchandising Hub | ₡200 | ₡1,000 | ₡2,000 |
| Streaming Studio | ₡100 | ₡500 | ₡1,000 |
| Roster Expansion | ₡500 | ₡2,500 | ₡4,500 |
| Storage Facility | ₡500 | ₡1,500 | ₡2,750 |
| Combat Academy | ₡250 | ₡1,250 | ₡2,500 |
| Defense Academy | ₡250 | ₡1,250 | ₡2,500 |
| Mobility Academy | ₡250 | ₡1,250 | ₡2,500 |
| AI Academy | ₡250 | ₡1,250 | ₡2,500 |
| Tuning Bay | ₡300 | ₡1,500 | ₡3,000 |
| Booking Office | ₡0 | ₡0 | ₡0 |

```callout-warning
Facility costs add up fast. If you own 5 facilities at mid-level, you could easily be paying ₡5,000–₡15,000 per cycle in operating costs alone. Only invest in facilities that provide clear value for your current strategy and income level.
```

## What's Next?

- [Facility Progression & ROI](/guide/facilities/facility-progression) — Level-by-level costs, prestige gates, and return on investment
- [Training Academies](/guide/facilities/training-academies) — How the four academies control attribute caps
- [Investment Strategy](/guide/facilities/investment-strategy) — Recommended facility order for early, mid, and late game
