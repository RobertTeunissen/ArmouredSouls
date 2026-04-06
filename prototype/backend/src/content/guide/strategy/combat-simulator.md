---
title: "Combat Simulator"
description: "Use the Combat Simulation Lab to test robot builds, compare configurations, and plan upgrades before spending credits in real battles."
order: 4
lastUpdated: "2026-04-06"
relatedArticles:
  - strategy/build-archetypes
  - strategy/budget-allocation
  - robots/attributes-overview
  - weapons/loadout-types
  - combat/stances
  - facilities/training-academies
---

## Overview

The Combat Simulation Lab lets you run practice 1v1 battles without any consequences. Your robots won't take damage, lose ELO, or spend credits. It's a sandbox for testing builds, comparing configurations, and planning your next upgrade path.

Access it from the Battle menu in the navigation bar — look for **🧪 Combat Simulator** below the divider.

## What You Can Do

### Test Against Sparring Partners

Four AI sparring partners are available at different difficulty levels:

| Sparring Partner | Attribute Level | Weapon Tier |
|-----------------|----------------|-------------|
| WimpBot | 1 | Budget |
| AverageBot | 5 | Standard |
| ExpertBot | 10 | Premium |
| UltimateBot | 15 | Luxury |

You choose the sparring partner's loadout type (Single, Weapon & Shield, Two-Handed, Dual Wield), range band (Melee, Short, Mid, Long), stance, and yield threshold. Weapons are automatically assigned based on the tier and your selections.

### Test Your Own Robots Against Each Other

Select two of your own robots to see how they match up. Useful for comparing builds within your stable.

### What-If Configuration

The What-If panel lets you simulate attribute upgrades without spending credits. Click the +/- buttons on each attribute category to raise all stats in that group by one level.

The simulator shows you:
- **Estimated upgrade cost** — what it would actually cost to make those upgrades, including your Training Facility discount
- **Academy requirements** — if your planned levels exceed your current academy cap, the simulator automatically includes the academy upgrade cost
- **Total investment** — attribute upgrades + academy upgrades combined

This helps you answer questions like "Is it worth upgrading all my Combat Systems to 15?" before committing real credits.

### Batch Simulations

Run up to 10 battles at once with the same configuration. The batch summary shows your win rate, helping you understand whether a matchup is consistently favorable or just lucky.

## How It Works

The Combat Simulator uses the exact same battle engine as real league matches. Every combat formula, damage calculation, critical hit chance, counter-attack, shield regeneration, and yield mechanic works identically. If the battle system is ever updated, the simulator automatically reflects those changes.

The only differences from real battles:
- No ELO changes
- No credit rewards or repair costs
- No league point changes
- No fame or prestige awards
- Results don't appear in your battle history

## Tips

- **Start with AverageBot** — it's a good baseline for testing whether your robot can handle mid-tier opponents
- **Use batch runs** — a single battle can be misleading due to random variance. Run 5-10 to see the real win rate
- **Compare stances** — try the same matchup with Offensive, Defensive, and Balanced to see which stance works best for your build
- **Plan upgrades efficiently** — use the What-If panel to find the cheapest attribute upgrades that make the biggest difference in battle outcomes
- **Check academy thresholds** — the simulator shows when you'd need an academy upgrade, so you can plan your facility investments alongside your attribute upgrades

## Rate Limit

To protect server performance, simulations are limited to 30 battles per 15 minutes. Each battle in a batch counts individually. The simulator is temporarily unavailable while real arena battles are being processed during the daily cycle.
