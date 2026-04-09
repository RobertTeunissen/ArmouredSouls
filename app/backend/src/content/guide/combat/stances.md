---
title: "Battle Stances"
description: "Compare Offensive, Defensive, and Balanced stances — how each modifies your robot's combat attributes and when to use them."
order: 4
lastUpdated: "2026-03-12"
relatedArticles:
  - combat/battle-flow
  - combat/yielding-and-repair-costs
  - combat/counter-attacks
  - strategy/build-archetypes
  - robots/attributes-overview
---

## Overview

Before every battle, your robot fights using one of three stances: **Offensive**, **Defensive**, or **Balanced**. Your stance choice modifies several combat attributes, shifting your robot's performance toward aggression, survivability, or a neutral middle ground.

Stances are set before battle and cannot change mid-fight. New robots default to Balanced stance. You can change your stance freely between battles with no cooldown or cost.

![Stance comparison chart](/images/guide/combat/stance-comparison-chart.png)

## Stance Comparison Table

The table below shows the actual combat modifiers applied by each stance, verified against the combat simulator:

| Combat Effect | ⚔️ Offensive | 🛡️ Defensive | ⚖️ Balanced |
|-----------|:----------:|:----------:|:---------:|
| **Damage Output** | ×1.15 (+15%) | ×0.90 (-10%) | ×1.0 |
| **Hit Chance** | +5 flat bonus | — | — |
| **Counter Protocols** | — | ×1.15 (+15%) | — |
| **Shield Regeneration** | — | ×1.20 (+20%) | — |

```callout-info
Stance modifiers are multiplied into the damage formula alongside loadout modifiers. The full damage chain is: `weapon base × combat power × loadout modifier × weapon control × stance modifier`. This means stance and loadout bonuses stack multiplicatively — an Offensive stance (×1.15) with a Two-Handed loadout (×1.10) gives you ×1.265 combined, not ×1.25. See [Loadout Types](/guide/weapons/loadout-types) for the loadout modifiers.
```

## ⚔️ Offensive Stance

Offensive stance maximizes your damage output at the cost of defensive capability.

**What you gain:**
- **+15% Damage Output** — Your attacks hit harder. This is a direct multiplier in the damage formula, applied after combat power and loadout modifiers.
- **+5 Hit Chance** — Offensive stance provides a flat accuracy bonus during the [hit chance calculation](/guide/combat/battle-flow), making your attacks more likely to land.

**What you lose:**
- Nothing is directly penalized by the combat simulator. However, you miss out on the defensive bonuses (counter protocols, shield regen) that Defensive stance provides.

**Best for:**
- Glass Cannon builds that want to end fights quickly
- Robots with high Combat Power and Targeting Systems
- Matchups where you expect to out-damage your opponent before they can wear you down
- Two-Handed loadouts that already lean into raw damage

```callout-warning
Offensive stance is a commitment. You miss out on the defensive bonuses (counter protocols, shield regen) that Defensive stance provides, and your opponent still gets counter-attack chances on your misses. Make sure your damage output justifies the trade-off.
```

## 🛡️ Defensive Stance

Defensive stance prioritizes survival and attrition, trading raw damage for staying power.

**What you gain:**
- **+15% Armor Plating** — Incoming hull damage is reduced further. Stacks with your existing armor investment.
- **+15% Counter Protocols** — Significantly higher chance to counter-attack when attacked, turning your opponent's aggression against them.
- **+20% Shield Regeneration** — Your energy shields recover faster during battle, extending their protective value. See [Counter-Attacks & Shield Regeneration](/guide/combat/counter-attacks).

**What you lose:**
- **-10% Combat Power** — Your attacks deal less damage.
- **-10% Attack Speed** — Your robot attacks less frequently, increasing the cooldown between strikes.

**Best for:**
- Tank builds with high Armor Plating and Hull Integrity
- Counter-attack focused builds with high Counter Protocols
- Robots with strong energy shields and Power Core investment
- Matchups where you expect a long fight and want to outlast your opponent
- Weapon+Shield loadouts that already benefit from defensive bonuses

```callout-tip
Defensive stance pairs exceptionally well with the Weapon+Shield loadout. The shield loadout already boosts Counter Protocols, and Defensive stance amplifies that further. Combined with +20% shield regeneration, you become very hard to take down.
```

## ⚖️ Balanced Stance

Balanced stance applies no modifiers at all. Your robot fights with its base attributes exactly as they are.

**What you gain:**
- No penalties to any attribute
- Predictable, consistent performance
- Flexibility — your build works as designed without stance-induced weaknesses

**What you lose:**
- No bonuses to any attribute
- No particular advantage in any area

**Best for:**
- Well-rounded builds that don't want to sacrifice anything
- New players still learning the system
- Robots whose attribute spread doesn't clearly favor offense or defense
- Situations where you're unsure what you'll face

```callout-info
Balanced stance is never a bad choice. It won't win you fights on its own, but it also won't create vulnerabilities that a savvy opponent can exploit. When in doubt, Balanced is safe.
```

## Choosing the Right Stance

Your stance should complement your build, not fight against it.

| Build Type | Recommended Stance | Why |
|-----------|-------------------|-----|
| Glass Cannon (high offense, low defense) | ⚔️ Offensive | Lean into your strength. End fights before your low defense matters. |
| Tank (high armor, high HP) | 🛡️ Defensive | Maximize your survivability advantage. Counter-attacks add free damage. |
| Counter Striker (high Counter Protocols) | 🛡️ Defensive | The +15% Counter Protocols bonus makes your core mechanic even stronger. |
| Speed Demon (high Attack Speed, evasion) | ⚔️ Offensive | The +10% Attack Speed stacks with your already-fast attack cycle. |
| Balanced/Hybrid | ⚖️ Balanced | Don't create weaknesses in a build designed to have none. |
| Sniper (high Targeting, Critical Systems) | ⚔️ Offensive | The Combat Power bonus amplifies your already-precise, high-damage hits. |

## Stance and the Economy

Stance choice has indirect economic consequences through the [Yielding & Repair Costs](/guide/combat/yielding-and-repair-costs) system:

- **Offensive stance** tends to end fights faster (either winning or losing quickly), which can mean less total damage taken in victories but more devastating losses.
- **Defensive stance** extends fights, which means more opportunities for shield regeneration and counter-attacks, but also more total attacks exchanged. Repair costs after a loss tend to be lower because your robot yields with more HP remaining.
- **Balanced stance** produces middle-of-the-road outcomes in both directions.

```callout-tip
If you're struggling with repair costs, try switching to Defensive stance and raising your yield threshold. You'll win fewer fights, but the ones you lose will cost much less to repair.
```

## What's Next?

- [Battle Flow](/guide/combat/battle-flow) — See exactly where stance modifiers apply in the attack sequence
- [Yielding & Repair Costs](/guide/combat/yielding-and-repair-costs) — The surrender system and how stance affects your repair bills
- [Counter-Attacks & Shield Regeneration](/guide/combat/counter-attacks) — How Defensive stance supercharges your defensive mechanics
- [Build Archetypes](/guide/strategy/build-archetypes) — Pre-built strategies with recommended stances
