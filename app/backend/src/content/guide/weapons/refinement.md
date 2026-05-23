---
title: "Weapon Refinement"
description: "Make a weapon yours. Permanent per-instance upgrades across four tiers, gated by Workshop level — the way you build a Mastercrafted Volt Sabre or a Legendary Practice Sword."
order: 4
lastUpdated: "2026-05-23"
relatedArticles:
  - weapons/buying-and-selling
  - weapons/loadout-types
  - facilities/facility-overview
---

## Overview

Refinement turns a generic weapon into **your weapon**. Every catalog weapon is the same out of the box, but once you start refining, two `Volt Sabre`s in different stables can end up shaped completely differently — different attribute boosts, different cooldowns, different damage. After enough refinement, your weapon earns a rank prefix (`Refined` → `Crafted` → `Mastercrafted` → `Legendary`) that announces its identity wherever it appears: in your inventory, on your robot, in battle reports.

Refinement also gives the [Weapons Workshop](/guide/facilities/facility-overview) a third purpose. After v1.5 it already governed purchase discounts and resale rates; now Workshop level also gates which refinement tiers you can apply. Every level beyond L1 unlocks something useful: L3 lets you Augment, L5 lets you Sharpen, L8 lets you Forge.

## The Four Tiers

Each refinement consumes one of five slots on the weapon. You have full control over what goes in each slot — within the limits the system enforces.

| Tier | What it does | Magnitude | Workshop Level |
|---|---|---|---|
| **Hone** | Boost an attribute the weapon already grants | You pick +1 to +5 | L1 |
| **Augment** | Add a new attribute the weapon didn't grant | You pick +1 to +5 | L3 |
| **Sharpen** | Reduce base cooldown by 0.25s | Fixed | L5 |
| **Forge** | Increase base damage by 1.0 | Fixed | L8 |

```callout-tip
Hone and Augment let you spend more for a bigger one-slot upgrade. A +5 Hone in one slot frees the other four slots for different work — but it costs ₡250K, vs. ₡10K for a +1.
```

## The 5-Slot System

Every weapon has exactly **5 refinement slots**. Once a slot is filled, it stays filled — refinement is permanent. The slot bar appears on every owned weapon (even unrefined ones) so you can see what you've done and what's still possible.

### Rank Prefixes

The number of filled slots determines the weapon's rank prefix, shown next to the catalog name everywhere the weapon is displayed:

| Filled Slots | Rank Prefix |
|---|---|
| 0 | (none — just the catalog name) |
| 1–2 | **Refined** |
| 3 | **Crafted** |
| 4 | **Mastercrafted** |
| 5 | **Legendary** |

A `Mastercrafted Volt Sabre` named "Old Faithful" looks the same in your inventory, on your robot's loadout, and in every battle report — your refined weapon has a presence that a stock weapon doesn't.

### Per-Tier Caps

Sharpen and Forge are individually capped at **2 of the 5 slots**. This protects the [DPS Rebalance](/guide/combat/battle-flow) — a 5× Sharpen on a 3-second weapon would re-create the dominance problem the rebalance fixed. Hone and Augment have no per-tier cap beyond the global 5.

### Per-Attribute Stack Cap

The combined boost on any single attribute (catalog bonus + all your Hone/Augment refinements) cannot exceed **+10**. This means:

- A weapon with `+5 Combat Power` from the catalog can take +5 more via Hone (one +5, or split across multiple slots).
- A weapon with no Combat Power bonus can take up to +10 via Augment+Hone.
- You can't push any attribute past the catalog's natural maximum.

## Costs

Refinement is one of the highest-impact ways to spend late-game credits. The Workshop **purchase discount does not apply** to refinement — the published prices are what you pay.

### Hone (₡10,000 × magnitude²)

| Magnitude | Cost |
|---|---|
| +1 | ₡10,000 |
| +2 | ₡40,000 |
| +3 | ₡90,000 |
| +4 | ₡160,000 |
| +5 | ₡250,000 |

### Augment (₡20,000 × magnitude²)

| Magnitude | Cost |
|---|---|
| +1 | ₡20,000 |
| +2 | ₡80,000 |
| +3 | ₡180,000 |
| +4 | ₡320,000 |
| +5 | ₡500,000 |

Augment is twice as expensive as Hone at every magnitude — adding a brand-new capability is a bigger deal than deepening one the weapon already has.

### Sharpen and Forge

| | 1st instance | 2nd instance |
|---|---|---|
| **Sharpen** | ₡300,000 | ₡900,000 |
| **Forge** | ₡400,000 | ₡1,200,000 |

The second instance triples the cost of the first — these are the powerful tiers, and the system makes you commit hard credits to them.

## Refinement and Resale

Every refinement increments your weapon's **`pricePaid`** by the refinement cost. So if you refine a `Volt Sabre` you bought for ₡100K with three refinements totalling ₡500K, the weapon's `pricePaid` is now ₡600K.

When you later sell the weapon, the resale formula `pricePaid × resaleRate(workshopLevel)` (see [Buying & Selling Weapons](/guide/weapons/buying-and-selling)) recovers a fraction of all of it — including refinement spend.

| Workshop Level | Resale Rate | Recovery on the example above |
|---|---|---|
| L1 | 10% | ₡60,000 |
| L5 | 50% | ₡300,000 |
| L10 | 100% | ₡600,000 |

This means refinement spend is not a complete sunk cost — at high Workshop levels, you can recover most or all of it on resale. But because Workshop L10 requires 10,000 prestige (and a lot of credits to build the facility), full recovery is genuinely earned, not free.

```callout-warning
Refinement is permanent and non-transferable. You cannot move refinements from one weapon to another, and you cannot undo a refinement on the same weapon. If you no longer want a refined weapon, sell it.
```

## Custom Names

Once a weapon is yours, give it a name. The custom name appears in italic below the weapon name on the inventory row, on the robot's equipped slot, and in battle reports. Set or clear it from the My Inventory tab — click the "Set name…" link below any weapon.

The name is yours, but it's also visible to other players (in battle reports, future leaderboards). Keep it appropriate — the system enforces a 50-character limit and a basic character allowlist (letters, numbers, spaces, and a few common punctuation marks).

## Two Example Builds

### Identity Practice Sword (sentimental player)

A maxed-out starter weapon. Practice Sword starts at 6 damage / 3.0s cooldown with no attribute bonuses.

| Slot | Refinement | Cost |
|---|---|---|
| 1 | Augment +5 Combat Power | ₡500,000 |
| 2 | Hone +5 Combat Power (catalog 0 + augment +5 + hone +5 = +10, exactly at cap) | ₡250,000 |
| 3 | Augment +5 Attack Speed | ₡500,000 |
| 4 | Augment +5 Critical Systems | ₡500,000 |
| 5 | Forge +1.0 base damage | ₡400,000 |
| **Total** | | **₡2,150,000** |

Result: a Legendary Practice Sword with 7 base damage, 3.0s cooldown, +10 Combat Power, +5 Attack Speed, +5 Critical Systems. Won't beat a stock Volt Sabre on raw DPS, but it carries you through situations where the +10 Combat Power and +5 Critical Systems compound into reliable, high-margin victories. And it's *your* weapon — the one you've been using since cycle 5.

### DPS Volt Sabre (whale build)

Maxing the damage levers. Volt Sabre starts at 12 damage / 3.0s cooldown with +5 Combat Power and +3 Attack Speed.

| Slot | Refinement | Cost |
|---|---|---|
| 1 | Sharpen (1st) — cooldown 3.0s → 2.75s | ₡300,000 |
| 2 | Sharpen (2nd) — cooldown 2.75s → 2.5s | ₡900,000 |
| 3 | Forge (1st) — base damage 12 → 13 | ₡400,000 |
| 4 | Forge (2nd) — base damage 13 → 14 | ₡1,200,000 |
| 5 | Hone +5 Combat Power | ₡250,000 |
| **Total** | | **₡3,050,000** |

Result: a Legendary Volt Sabre with 14 base damage, 2.5s cooldown, +10 Combat Power, +3 Attack Speed. About 40% more DPS than the stock catalog version. At Workshop L10 the entire ₡3.05M is recoverable on resale — at lower Workshop levels, less so.

## How to Refine

1. Visit the [Weapon Shop](/weapons?tab=inventory) and switch to the **My Inventory** tab.
2. Click **Refine** on any weapon. The Refine button is enabled even on equipped weapons — refinement takes effect on the robot's next battle.
3. Pick a tier (locked tiers show their unlock requirement).
4. For Hone or Augment, pick a target attribute and magnitude. For Sharpen or Forge, magnitude is fixed.
5. Review the projected stat change and the cost. The cost is **permanent** — confirm only if you're sure.
6. Confirm. Refinement is final. Your weapon is now Refined (or Crafted, Mastercrafted, Legendary, depending on slot count).

The slot bar updates immediately. The rank prefix appears on the weapon name. Your robot will fight with the refined stats next battle.

```callout-warning
Once you confirm, you can't undo. The only way to "remove" a refinement is to sell the weapon — which deletes the inventory row and all its refinements. Plan your spend.
```
