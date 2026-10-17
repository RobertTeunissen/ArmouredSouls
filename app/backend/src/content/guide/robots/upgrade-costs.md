---
title: "Attribute Upgrade Costs"
description: "Learn how attribute upgrade costs scale as your robot grows stronger, and how the Training Facility can dramatically reduce your spending."
order: 4
lastUpdated: "2026-10-17"
relatedArticles:
  - robots/attributes-overview
  - robots/training-academies
  - economy/credits-and-income
  - facilities/training-academies
---

## Overview

Upgrading your robot's attributes is the primary way to make it stronger — but it's not free. Each attribute level costs Credits, and the cost increases as the attribute gets higher. Understanding the cost curve and how to reduce it is key to managing your stable's finances effectively.

## How Upgrade Costs Scale

The formula for upgrading an attribute from level N to level N+1 is:

```
cost = (current_level + 1) × ₡1,500
```

So upgrading from level 1→2 costs ₡3,000, from level 9→10 costs ₡15,000, and from level 49→50 costs ₡75,000. The cost grows linearly — no exponential surprises, but it adds up fast when you're upgrading many attributes across multiple robots.

### Per-Level Cost Table

| From → To | Cost | Cumulative from Level 1 |
|-----------|------|------------------------|
| 1 → 2 | ₡3,000 | ₡3,000 |
| 2 → 3 | ₡4,500 | ₡7,500 |
| 3 → 4 | ₡6,000 | ₡13,500 |
| 4 → 5 | ₡7,500 | ₡21,000 |
| 5 → 6 | ₡9,000 | ₡30,000 |
| 6 → 7 | ₡10,500 | ₡40,500 |
| 7 → 8 | ₡12,000 | ₡52,500 |
| 8 → 9 | ₡13,500 | ₡66,000 |
| 9 → 10 | ₡15,000 | ₡81,000 |
| 10 → 11 | ₡16,500 | ₡97,500 |
| 19 → 20 | ₡30,000 | ₡297,000 |
| 29 → 30 | ₡45,000 | ₡672,000 |
| 39 → 40 | ₡60,000 | ₡1,197,000 |
| 49 → 50 | ₡75,000 | ₡1,911,000 |

```callout-info
Getting one attribute from 1 to 10 costs ₡81,000. Getting it from 1 to 50 costs ₡1,911,000 — about 24× more. The cost scaling is linear per level, but the cumulative total grows quadratically. This is why the Training Facility discount matters so much at higher levels.
```

## Training Facility Discount

The **Training Facility** is one of the most impactful facilities you can invest in — if your roster is small. Each level provides a discount of **0.75 × (10 − your robot slots)%** on all attribute upgrade costs, up to a maximum of 67.5% off. With 1 robot slot that is 6.75% per level, reaching 67.5% at Level 10. With 4 slots it is 4.5% per level, so Level 5 gives 22.5%. With 10 slots the facility gives nothing. The slot count is what you have bought with Roster Expansion, not how many robots you own right now.

| Training Facility Level | Discount (1 slot) | Effective Cost (1 slot) | Discount (4 slots) |
|------------------------|----------|---------------|---------------|
| Level 0 (none) | 0% | Full price | 0% |
| Level 1 | 6.75% | 93.25% of base cost | 4.5% |
| Level 2 | 13.5% | 86.5% of base cost | 9% |
| Level 3 | 20.25% | 79.75% of base cost | 13.5% |
| Level 4 | 27% | 73% of base cost | 18% |
| Level 5 | 33.75% | 66.25% of base cost | 22.5% |
| Level 6 | 40.5% | 59.5% of base cost | 27% |
| Level 7 | 47.25% | 52.75% of base cost | 31.5% |
| Level 8 | 54% | 46% of base cost | 36% |
| Level 9 | 60.75% | 39.25% of base cost | 40.5% |
| Level 10 | 67.5% | 32.5% of base cost | 45% |

Each level's price is discounted and rounded down to whole Credits separately, then the levels are added up. The planner, the Practice Arena preview and the actual purchase all use the same calculation, so the price you see is the price you pay.

```callout-info
Season 2 reduced the Training Facility discount by a quarter (Level 10 with one slot was 90%), because late attribute upgrades had become too cheap.
```

```callout-tip
The Training Facility is one of the best early investments for a small roster. Level 1 (costing ₡150,000) immediately saves you 6.75% on every attribute upgrade with one robot slot. If you're actively upgrading — and you should be — this pays for itself.
```

### When to Invest in Training Facility

The Training Facility has a daily operating cost that scales with its level (₡250 per day per level). Here's how to think about the investment (rates for a one-slot stable):

- **Level 1 (₡150,000, ₡250/day)**: Buy this early. The 6.75% discount covers its operating cost once you spend about ₡3,700 or more per day on upgrades
- **Levels 2–3**: Upgrade as your income grows. The 13.5–20.25% discount makes mid-range attribute upgrades more affordable
- **Levels 4–5**: Mid-game priority. At 27–33.75% discount, expensive upgrades cost about two thirds to three quarters of the base price. Level 4 requires 1,000 Prestige
- **Levels 6–10**: Late-game optimization. The discount reaches 40.5–67.5%, but operating costs are higher and some levels require significant Prestige thresholds

```callout-warning
Higher Training Facility levels require Prestige thresholds to unlock (Level 4 needs 1,000 Prestige, Level 7 needs 5,000, Level 9 needs 10,000; Level 10 is ungated). Plan your Prestige progression alongside your facility investments.
```

```callout-warning
Every Roster Expansion level you buy lowers this discount by 0.75 points per Training Facility level. At Training Facility Level 10, going from 1 to 4 slots takes the discount from 67.5% to 45%. Check the Facilities page before buying Roster Expansion.
```

### Discount Impact on Total Build Cost

The Training Facility discount applies to every attribute upgrade for every robot in your stable:

- **1 robot, levels 1→10 on all 23 attributes**: Without discount: 23 × ₡81,000 = ₡1,863,000. With Level 1 Training Facility (6.75% off, 1 slot): 23 × ₡75,529 = ₡1,737,167. Savings: ₡125,833.
- **Same build at Level 10 (67.5% off, 1 slot)**: 23 × ₡26,323 = ₡605,429. With 4 slots (45% off): 23 × ₡44,550 = ₡1,024,650.
- **Late game, pushing attributes to 30+**: Without the discount, high-level upgrades are painfully expensive. With a Level 7+ Training Facility on a small roster, they become manageable

## Upgrade Strategy Tips

### Early Game (Starting Budget)

With your initial ₡3,000,000, prioritize:

1. **Buy Training Facility Level 1** (₡150,000) — immediate 6.75% savings on everything (with one robot slot)
2. **All 23 attributes are active** — but you don't need to upgrade all of them equally. Focus on the ones that match your build (see [Attributes Overview](/guide/robots/attributes-overview))
3. **Get key attributes to level 10** — at ₡81,000 per attribute (₡75,529 with Training Facility Level 1 and one slot), this is the initial cap before academies and gives strong returns
4. **Prioritize 8–10 core attributes** for your build rather than spreading thin across all 23

With the 1-robot strategy (₡1,550,000 for attributes), you can get your 8–10 core attributes to level 10 with the Training Facility discount (10 × ₡75,529 = ₡755,290) and still have budget for secondary attributes. With 3 robots (₡650,000 total), you'll need to be more selective — focus on 6–8 key attributes per robot.

### Mid Game

- Upgrade Training Facility to Level 3–4 for a 20.25–27% discount (one slot; less with more slots)
- Start pushing key attributes into the 15–25 range
- Invest in [Training Academies](/guide/robots/training-academies) to unlock attribute caps beyond level 10
- Consider which attributes give the best return for your build archetype

### Late Game

- Push Training Facility toward Level 7+ for massive discounts
- Focus on maxing out your most impactful attributes (the ones that define your build)
- The cost of pushing attributes from 40 to 50 is high even with discounts — be selective about which attributes you max

```callout-info
You don't need to max every attribute. Most competitive builds focus on 8–12 key attributes at high levels, with the rest at moderate levels. The cost of going from level 40 to 50 on a single attribute (₡714,000 at full price) could fund multiple attributes from level 1 to 10 (₡81,000 each).
```

## What's Next?

- [Training Academies](/guide/robots/training-academies) — Unlock attribute levels beyond the initial cap of 10
- [Attributes Overview](/guide/robots/attributes-overview) — Decide which attributes to prioritize
- [Starting Budget](/guide/getting-started/starting-budget) — How to allocate your initial ₡3,000,000
- [Attribute Combat Influence](/guide/robots/attribute-combat-influence) — Understand which attributes matter most for your strategy
