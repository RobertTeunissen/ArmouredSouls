# Weapon Balance Analysis — Range Band Performance

**Date**: August 2026 (Season 0, ~75 cycles)  
**Data source**: Local development database (auto-generated bots only)  
**Sample size**: 105,147 battles across 9 battle types  
**Bot population**: 5,800 robots (3,050 at stat tier 1, 1,850 at tier 5, 900 at tier 10)  
**Weapon distribution**: Roughly even across range bands (melee 1,460 / short 1,421 / mid 1,493 / long 1,426 equipped as main)

## Context

Player feedback claimed melee weapons are overpowered and long-range weapons underperform. This analysis uses battle outcome data to validate or debunk that perception.

All bots are auto-generated with uniform stats within their tier (all 1s, all 5s, or all 10s across all 23 attributes). This eliminates player skill and build optimisation as variables — differences in win rate are purely weapon-driven.

---

## 1. Head-to-Head Win Rates (Same Stat Tier, League 1v1)

The cleanest signal. Both robots have identical attributes; only the weapon differs.

| Attacker ↓ \ Defender → | Melee | Short | Mid | Long |
|---|---|---|---|---|
| **Melee** | 56.5% | 66.9% | 83.3% | 86.1% |
| **Short** | 22.4% | 52.1% | 63.9% | 76.9% |
| **Mid** | 13.7% | 45.0% | 53.4% | 81.4% |
| **Long** | 10.8% | 30.8% | 24.3% | 54.4% |

**Finding**: Strict "closer beats further" hierarchy. Melee beats long-range 86% of the time at equal stats. Long-range only wins mirror matches.

---

## 2. Win Rates by Battle Type and Range Band

### Win-rate modes (higher = better)

| Mode | Melee | Short | Mid | Long |
|---|---|---|---|---|
| **League 1v1** | 53.5% | 48.7% | 48.9% | 44.4% |
| **Tournament 1v1** | 61.1% | 50.4% | 46.7% | 36.6% |
| **Tag Team** | 55.8% | 50.9% | 47.7% | 44.2% |
| **League 2v2** | 52.9% | 49.9% | 48.9% | 49.7% |
| **League 3v3** | 50.9% | 49.4% | 50.1% | 51.1% |

### Placement modes (lower = better)

| Mode | Melee | Short | Mid | Long |
|---|---|---|---|---|
| **KotH** (avg placement, 6 players) | 3.99 | 3.43 | 3.03 | 3.24 |
| **Grand Melee** (avg placement, 20 players) | 10.19 | 9.71 | 9.60 | 9.59 |

### Observations

- **1v1 and tag team**: Melee dominates, long range suffers. Tournament 1v1 amplifies the gap (61% vs 37%).
- **Team modes (2v2/3v3)**: Much flatter distribution. Long range ties or edges melee in 3v3.
- **KotH**: Mid range is best (3.03 avg placement), melee is worst (3.99).
- **Grand Melee**: Long and mid essentially tied for best, melee worst.

---

## 3. Stat Tier Amplification

| Stat Tier | Melee WR | Short WR | Mid WR | Long WR | Gap (Melee − Long) |
|---|---|---|---|---|---|
| 1 (all 1s) | 47.7% | 43.5% | 42.0% | 35.8% | +11.9pp |
| 5 (all 5s) | 50.1% | 49.4% | 50.1% | 48.0% | +2.1pp |
| 10 (all 10s) | 73.9% | 66.4% | 64.7% | 62.0% | +11.9pp |

At tier 5 the game is relatively balanced. At tiers 1 and 10, melee pulls ahead significantly due to the hydraulicSystems multiplicative bonus.

---

## 4. Individual Weapon Performance (League 1v1, all tiers)

### Top performers

| Weapon | Range | Type | DPS | Win Rate |
|---|---|---|---|---|
| Power Sword | melee | melee | 3.50 | 79.9% |
| Assault Rifle | short | ballistic | 3.33 | 68.8% |
| Plasma Rifle | short | energy | 3.17 | 68.6% |
| Disruptor Cannon | mid | energy | 3.33 | 66.4% |
| Pulse Accelerator | short | energy | 2.63 | 65.1% |
| Thermal Lance | melee | energy | 2.63 | 63.6% |
| Sniper Rifle | long | ballistic | 2.83 | 62.7% |
| Gauss Pistol | long | ballistic | 3.33 | 61.2% |

### Bottom performers

| Weapon | Range | Type | DPS | Win Rate |
|---|---|---|---|---|
| Beam Pistol | long | energy | 2.25 | 30.8% |
| Training Beam | long | energy | 2.00 | 35.8% |
| Laser Pistol | short | energy | 2.00 | 39.9% |
| Bolt Carbine | mid | ballistic | 2.25 | 38.6% |
| Training Rifle | mid | ballistic | 2.00 | 41.2% |

### Outlier: Power Sword

79% win rate — 11 percentage points above the next best weapon. Stats: 10.5 base damage, 3s cooldown (3.50 DPS), +3 combat power bonus, +7 hydraulic systems bonus. The hydraulic bonus stacks multiplicatively with the attribute at high tiers.

---

## 5. DPS Distribution by Range Band

| Range Band | Weapons | Avg DPS | Min DPS | Max DPS | Avg Cost |
|---|---|---|---|---|---|
| Long | 9 | 2.83 | 2.00 | 4.00 | 291,889 |
| Melee | 11 | 2.78 | 2.00 | 4.00 | 245,091 |
| Mid | 9 | 2.74 | 2.00 | 4.00 | 239,444 |
| Short | 12 | 2.64 | 2.00 | 4.00 | 207,417 |

DPS is roughly equal across bands. Long range actually has the highest average DPS — the problem is not raw damage output but the range penalty system preventing that damage from landing at optimal multiplier.

---

## 6. Combat Statistics by Range Band (League 1v1)

| Range | Avg Damage Dealt | Avg Final HP | Destroyed % | Yielded % |
|---|---|---|---|---|
| Melee | 95 | 29 | 15.5% | 31.0% |
| Mid | 92 | 26 | 16.6% | 34.5% |
| Short | 90 | 24 | 15.3% | 36.0% |
| Long | 81 | 25 | 18.8% | 36.8% |

Melee bots deal more damage, end with more HP, get destroyed less often, and yield less often. Long-range bots get destroyed most often (18.8%) — they lose before the battle ends naturally.

---

## 7. Loadout Type Impact (League + Tournament 1v1)

| Loadout | Melee WR | Short WR | Mid WR | Long WR |
|---|---|---|---|---|
| Dual Wield | 61.1% | 51.5% | 53.4% | 46.9% |
| Weapon + Shield | 57.4% | 48.7% | 48.7% | 44.6% |
| Two-Handed | 51.9% | 50.8% | 45.6% | 41.1% |
| Single | 51.4% | 46.9% | 48.4% | 44.1% |

Dual wield amplifies melee advantage further. Two-handed long-range is the weakest combination (41.1%).

---

## 8. Root Cause Analysis

### Why melee dominates in 1v1

1. **Range penalty asymmetry**: Ranged weapons fire at 0.75× or 0.5× while the melee bot closes distance. Once in melee range (0–2 units), the melee weapon gets 1.1× optimal while ranged weapons eat a 25–50% penalty. The ranged bot never recovers.

2. **Competitive base DPS**: Melee isn't trading damage for range — it has the second-highest average DPS across all bands.

3. **hydraulicSystems scaling**: Melee gets +2% damage per hydraulicSystems point (max 2.0×). At stat tier 10, this is a massive multiplicative bonus unique to melee.

4. **No effective kiting**: In 1v1, one small arena, one target. Melee will always close the gap. In multi-robot modes (KotH, Grand Melee), melee chases one target while being shot by 4+ others, which is why it underperforms there.

5. **Power Sword outlier**: One weapon alone drags melee's aggregate win rate up significantly.

### Why long range suffers in 1v1

1. Starting positions may not give enough initial range advantage.
2. Once distance closes, long-range weapons take 50% penalty (two bands from optimal) and cannot recover.
3. Low-tier long-range weapons (Training Beam 36% WR, Beam Pistol 31% WR) are near-unusable, dragging the aggregate down. High-tier long-range weapons (Gauss Pistol 61%, Sniper Rifle 63%) actually compete.

---

## 9. Conclusion

**Player feedback is confirmed for 1v1, tournaments, and tag team** — the most-played modes. Melee has a structural advantage in any format where it can close distance to a single target.

**Player feedback is wrong for KotH and Grand Melee** — ranged dominates in multi-robot arenas where melee bots get focused while chasing.

**Team modes (2v2/3v3) are reasonably balanced** with less than 3pp spread between best and worst range bands.

---

## 10. Potential Balance Levers (Not Currently Planned)

If rebalancing becomes necessary in a future season:

1. **Reduce range penalty severity**: 0.5× at two bands away → 0.6× or 0.65×
2. **Kiting window**: Brief damage or speed bonus for ranged weapons when an enemy enters their optimal band from further away
3. **Power Sword nerf**: Reduce hydraulic bonus from 7 to 4–5, or increase cooldown to 3.5s
4. **Buff bottom-tier long-range weapons**: Training Beam and Beam Pistol need higher base damage or faster cooldown
5. **Starting distance**: If 1v1 starts at mid–long range (10–14 units), long weapons get more optimal shots before melee arrives
6. **Cap hydraulicSystems melee bonus**: Reduce from 2%/point → 1.5%/point or cap at 1.5× instead of 2.0×

**Current decision (August 2026)**: No changes. The imbalance is mode-specific and the multi-robot modes naturally counterbalance it. Revisit if player retention data shows 1v1 engagement dropping.
