---
title: "Credits, Income & the Finance Center"
description: "Understand Credits, earned income, investments, costs, and how the Finance Center explains each financial cycle."
order: 1
lastUpdated: "2026-09-08"
relatedArticles:
  - economy/battle-rewards
  - economy/merchandising
  - economy/streaming-revenue
  - economy/repair-costs
  - getting-started/starting-budget
---

## Overview

**Credits (₡)** are the currency used for robots, weapons, attributes, facilities, repairs, and operating costs. Every new player starts with **₡3,000,000**. After that, your stable earns Credits through battles, streaming, merchandising, and achievement rewards. Selling a weapon also returns Credits, but a sale is an investment proceed rather than earned income.

Good financial decisions start with two different questions:

- **Revenue:** How many Credits did the stable earn?
- **Net cash movement:** After sales, purchases, repairs, and operating costs, how much did the balance actually change?

The **Finance Center** at `/income` is the read-only report that answers both questions for a selected financial cycle.

```callout-info
The Finance Center introduced by Spec #54 now replaces the legacy player reports. `/finances` and `/cycle-summary` remain compatibility redirects to `/income` and its History tab.
```

Its core read-only concepts are Revenue_Growth, Full_Damage_Repair_Reference, Prestige_Milestone_Forecast, and Robot_Deployment_View; the headings below use player-facing spacing for those same concepts.

![Income sources overview](/images/guide/economy/income-sources-overview.png)

## Starting Balance

Your starting ₡3,000,000 is a one-time opening balance, not cycle income. See the [Starting Budget Guide](/guide/getting-started/starting-budget) for help planning your first purchases.

Keep enough Credits available for operating costs and repairs. A large purchase can make a profitable cycle look cash-negative even when battle and passive revenue were healthy, which is why the Finance Center separates operating results from investment purchases.

## Ways Credits Enter Your Balance

### Battle and bye income

Every scheduled mode can award Credits. Wins pay more than losses, and rewards grow with tier and team size where applicable. A bye pays only that mode’s participation floor. It does not count as a fought match and does not generate streaming revenue, Fame, or Prestige.

Prestige increases base battle Credits with a smooth multiplier, capped at 1.50×. The Finance Center reports the amount that was actually awarded at the time; it does not recalculate an old battle using your current Prestige.

See [Battle Rewards](/guide/economy/battle-rewards) for mode and tier details.

### Streaming revenue

Streaming revenue is earned **per robot, per fought battle** when the robot is eligible. It depends on that robot’s battle activity and Fame plus its stable’s Streaming Studio level. It is credited with the battle, not during daily settlement.

Streaming rewards breadth: more eligible robots fighting means more opportunities to stream. A bye never produces streaming revenue.

See [Streaming Revenue](/guide/economy/streaming-revenue) for the full calculation.

### Merchandising income

Merchandising is stable-level passive income paid at settlement through the Merchandising Hub. It scales with **Prestige per roster capacity**, not raw Prestige alone:

```text
prestige per roster capacity = stable Prestige ÷ (Roster Expansion level + 1)
```

This rewards concentrated rosters. Increasing roster capacity without increasing Prestige spreads the same Prestige across more available slots. The Finance Center explains the stored settlement amount rather than applying today’s roster or facility levels to an older cycle.

See [Merchandising](/guide/economy/merchandising) for details.

### Achievement rewards

Some achievements award Credits. These are earned Credits and appear separately from battle, streaming, and merchandising income. Prestige awarded by an achievement is progression, not money, and never enters a Credits total.

### Weapon-sale proceeds

Selling a weapon adds Credits to your balance, but it is shown as an **investment proceed**, not earned revenue. This distinction keeps Revenue Growth focused on actual earning power instead of making a cycle look stronger because equipment was sold.

## Ways Credits Leave Your Balance

### Running costs

- **Automatic repairs** prepare damaged robots for scheduled events.
- **Manual repairs** apply the manual repair discount.
- **Facility operating costs** are charged at settlement and shown by stored facility component.

An automatic repair may happen before a bye if the robot already had damage. The repair remains a separate cost; it was not caused by the bye reward.

### Investment purchases

The Finance Center itemises robot creation, facility upgrades, weapon purchases, Weapon Refinement, and attribute upgrades. These purchases reduce the balance but are not running costs.

## Financial Cycles and Periods

A financial cycle is bounded by settlement, not by a rolling 24-hour or seven-day window.

**Cycle 1 begins when the season rolls over.** It remains open through both preparation days and the first competitive day, then closes at the first competitive settlement. During preparation it is labelled:

**Cycle 1 · Preparation · Provisional**

Preparation purchases and achievement Credit rewards therefore stay together in Cycle 1; preparation midnights do not create Cycle 2 or a cycle 0.

Finance Center periods are:

- Current Cycle;
- Last Completed Cycle;
- Last Seven Completed Cycles;
- a bounded completed-cycle range; and
- Season to Date.

**Current Cycle** and **Season to Date** include activity through the shown **as of** time and can still change. Season to Date includes completed cycles plus the current partial cycle. Completed cycles are historical. If retained evidence cannot prove an amount or boundary, the report names the limitation rather than estimating it.

Times are formatted using your browser’s locale and timezone. Cycle boundaries remain controlled in UTC.

## Reading the Finance Statement

The statement separates:

- **Earned Credits:** battle/bye income, streaming, merchandising, and achievement rewards;
- **Investment proceeds:** weapon sales;
- **Running costs:** manual repairs, automatic repairs, and facility operation;
- **Investment purchases:** robots, facilities, weapons, refinements, and attributes;
- **Net cash movement:** every included addition minus every included cost; and
- **Closing/current balance:** the balance after that movement.

A completed statement checks that its opening balance plus every recorded movement equals its closing balance. Current-cycle figures are checked through the report’s **as of** time. A limitation is an explanation, not a hidden amount.

## Revenue Growth

Revenue Growth compares **earned Credits**, not total cash movement.

For two completed cycles, it compares one complete cycle with the complete cycle immediately before it. For Current Cycle, it compares partial earnings through **as of** with a complete prior cycle. That current comparison is labelled **provisional and asymmetric** because one side is still in progress.

Weapon sales and investment purchases do not enter Revenue Growth. A strong revenue result can still accompany negative net cash movement if the stable made large investments.

## Full-Damage Repair Reference

The full-damage repair reference is a theoretical scenario: what automatic and manual repair paths would cost if every active robot needed repair from full repairable damage. It shows the active robot count, Repair Bay discount context, and manual saving.

It is **not a charge**, not your robots’ current damage, and not advice to repair or upgrade anything. Actual repair spend appears separately from repairs that were really charged.

## Prestige Context and Forecast

Prestige is progression, not Credits. The Finance Center can explain its battle multiplier, merchandising effect, the next facility gate, and recent Prestige gain without adding Prestige to income.

The milestone forecast uses positive Prestige awards from the latest available completed cycles, up to seven cycles. It estimates how many completed cycles the remaining gap would take at that historical average pace. It is not a calendar date, guaranteed win rate, revenue promise, or facility recommendation. If there is no next gate, no completed history, or no positive pace, the forecast says it is unavailable.

## Robot Deployment

Robot Deployment shows five direct measures for each robot:

1. fought matches;
2. battle/bye income;
3. streaming revenue;
4. actual repair spend; and
5. direct net.

A bye can pay income but is not a fought match. Stable-wide merchandising, facility costs, and investment purchases are not divided among robots, so direct net remains based on evidence that can be attributed to that robot.

Expandable event pages include battle, bye, streaming, and repair details plus deployment exposure. The loaded page is only part of the selected period: its subtotal may differ from the full-period headline. The full-period total stays unchanged while you move between pages, and all pages together make up the itemised detail.

Finance Center is read-only. Its Robot Deployment action opens **Manage subscriptions**; repairs, facilities, and team changes stay on their existing pages.

## Daily Timing

Scheduled events run at their own UTC slots:

- automatic repairs happen before an applicable scheduled event;
- battle and tournament income is credited with the result;
- streaming is credited per eligible robot after a fought battle; and
- merchandising income and facility operating costs are recorded at settlement.

See [Daily Financial Cycle](/guide/economy/daily-financial-cycle) for the schedule and [Operating Costs & Repairs](/guide/economy/repair-costs) for repair rules.

## What’s Next?

- [Battle Rewards](/guide/economy/battle-rewards) — Mode and tier rewards plus Prestige multiplier
- [Operating Costs & Repairs](/guide/economy/repair-costs) — Actual repair charges and operating costs
- [Merchandising](/guide/economy/merchandising) — Prestige per roster capacity
- [Streaming Revenue](/guide/economy/streaming-revenue) — Per-robot, per-battle income
- [Daily Financial Cycle](/guide/economy/daily-financial-cycle) — When financial events happen
