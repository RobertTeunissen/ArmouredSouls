---
title: "Buying & Selling Weapons"
description: "How weapon purchases and resales work, the Workshop's dual role on both ends of every transaction, and the pricePaid mechanic that prevents free-weapon arbitrage."
order: 3
lastUpdated: "2026-05-22"
relatedArticles:
  - weapons/loadout-types
  - facilities/facility-overview
  - getting-started/starting-budget
---

## Overview

The [Weapon Shop](/weapons) sells 47 weapons spanning four loadout types and four range bands. Every robot needs at least one equipped weapon to be battle-ready, and most builds use 1–4 weapons total across the stable. As of May 2026, you can also **sell** weapons back from your inventory if you change your mind about a build.

The Weapons Workshop facility is the cheapest meaningful facility in the game (₡75,000 for Level 1), and it has a unique dual purpose: it reduces purchase prices AND determines your resale rate, both at the same 10%-per-level slope.

## Buying Weapons

Click any weapon card on the **Catalog** tab of the Weapon Shop to view details and purchase. The price you see is the catalog price; the Workshop discount is applied at checkout.

### Workshop Purchase Discount

The Weapons Workshop reduces purchase prices by 10% per level. Build it as one of your first facility upgrades to start saving.

| Workshop Level | Cost to Build | Purchase Discount | Example: ₡100,000 weapon |
|---------------|---------------|--------------------|--------------------------|
| 0 | — | 0% (no discount) | ₡100,000 |
| 1 | ₡75,000 | 10% | ₡90,000 |
| 5 | ~₡1,275,000 cumulative | 50% | ₡50,000 |
| 10 | ~₡4,125,000 cumulative | 100% (free) | ₡0 |

```callout-tip
Workshop Level 1 pays for itself after about 7–8 weapon purchases at ₡100K each. If you're planning to build multiple robots (each needing 1–2 weapons), Workshop is one of the highest-ROI facility investments in the early game.
```

### What You Pay Is Recorded

When you buy a weapon, the system records the **actual credits you paid** (after Workshop discount) on the inventory row. This becomes the `pricePaid` value that determines your resale price later. So:

- A weapon bought at L0 (full price) yields more on resale than a weapon bought at L1 (10% off).
- A weapon bought free at L10 yields ₡0 on resale, regardless of how high your Workshop level is when you sell.

This is intentional — it prevents an exploit where players at high Workshop levels could buy free weapons and sell them back for catalog price, generating infinite credits.

## Selling Weapons

Visit the [Weapon Shop](/weapons?tab=inventory) and switch to the **My Inventory** tab to see all your weapons.

### The My Inventory Tab

Two sections, in order:

1. **Available to Sell** — weapons not currently equipped on any robot. Each row shows the catalog price, what you paid, the computed sale price at your current Workshop level, and a Sell button.
2. **Equipped** — weapons currently equipped as main or offhand on one or more robots. The Sell button is disabled with a tooltip pointing to the equipping robot.

A summary bar at the top shows your total inventory count, sellable count, and the total credit value if you sold everything available right now.

### Workshop Resale Rate

Resale rate matches the purchase discount — 10% per Workshop level — so investing in Workshop pays off on both ends of every transaction.

| Workshop Level | Resale Rate | Example: Sold a ₡100,000 weapon |
|---------------|-------------|----------------------------------|
| 0 | 0% (resale unavailable) | ₡0 — Build Workshop L1 first |
| 1 | 10% | ₡10,000 |
| 3 | 30% | ₡30,000 |
| 5 | 50% | ₡50,000 |
| 7 | 70% | ₡70,000 |
| 10 | 100% (full credit recovery) | ₡100,000 |

```callout-info
Resale at Workshop L0 yields ₡0. The system is gated behind buying Workshop L1 (₡75K). This makes L1 a meaningful unlock instead of a marginal upgrade and gives new players a real strategic choice between their first weapon and their first Workshop level.
```

### What You Receive Is Calculated From What You Paid

```
salePrice = pricePaid × (workshopLevel × 10%)
```

Two examples:

- You bought a ₡425,000 weapon at Workshop L0 (full price), then upgraded Workshop to L10. You sell. The math: ₡425,000 × 100% = **₡425,000 returned** (full recovery).
- You bought the same weapon at Workshop L10 (free), so `pricePaid = ₡0`. You sell at L10. The math: ₡0 × 100% = **₡0 returned**. No exploit possible.

### Equipped Weapons Cannot Be Sold

A weapon currently equipped on any robot — as either a main weapon or offhand — cannot be sold. The Sell button is disabled and the row shows an "Equipped on: {robot}" link.

To sell an equipped weapon: visit the robot's detail page, unequip the weapon, then return to the Weapon Shop's My Inventory tab. The weapon will appear in the Available to Sell section.

If a weapon is equipped on multiple robots (rare corner case from offhand sharing), all equipping robots are listed and you must unequip from all of them.

### Selling Is Final

Once you confirm a sale, the weapon is permanently removed from your inventory. There's no undo. The confirmation modal shows exactly what you'll receive before you commit.

## Resale Achievements

Four economy achievements reward selling activity:

- 🟢 **Pawn Star** (Easy) — Sell your first weapon
- 🔵 **Shrewd Negotiator** (Medium) — Earn ₡500,000 lifetime from weapon resales
- 🟠 **Arms Dealer** (Hard) — Sell 10 weapons total
- 🟠 **Buy High, Sell Higher** (Hard) — Sell a weapon at Workshop Level 10

## Strategy

### When to Sell

- **Trading up to a better weapon**: Sell your starter or mid-tier weapon to recover some credit toward a premium replacement. At Workshop L5+, the 50%+ recovery makes this a viable upgrade path.
- **Cleaning up storage**: If your Storage Facility is nearly full and you have unequipped weapons sitting unused, selling them recovers the storage slot AND some credits.
- **Switching loadout types**: If you change a robot from Two-Handed to Dual-Wield, you may have a 2H weapon you no longer need. Sell it to fund the dual-wield purchases.

### When NOT to Sell

- **At Workshop L0**: You get nothing. Build Workshop L1 (₡75K) first — it's almost always worth it.
- **A weapon you might re-equip later**: There's no undo. If you're unsure, hold it. Storage capacity is cheap to expand.
- **Starter weapons granted at account creation**: They cost you nothing (`pricePaid = 0`), so they yield ₡0 on resale. Selling only frees up storage.

## What's Next?

- [Loadout Types](/guide/weapons/loadout-types) — Compare the four loadout configurations to plan which weapons you actually need
- [Facility Overview](/guide/facilities/facility-overview) — Workshop sits among 16 facilities; understand the full ROI picture
- [Starting Budget](/guide/getting-started/starting-budget) — How to spend your starting ₡3,000,000 across robots, weapons, and facilities
