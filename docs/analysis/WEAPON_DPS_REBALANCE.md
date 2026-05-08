# Weapon DPS Rebalance — baseDamage Compression

**Status**: Approved for implementation  
**Date**: May 2026  
**Problem**: Backlog #5 — Weapon DPS dominates all other combat factors  
**Solution**: Compress baseDamage spread, increase DPS cost multiplier to maintain prices

---

## Problem Statement

The damage formula uses baseDamage as a flat multiplier that everything else scales from:

```
Damage = baseDamage × (1 + CP×1.5/100) × (1 + WC/150) × loadout × stance
```

Because attributes are percentage modifiers on top of baseDamage, weapon tier is the single most impactful combat variable. A robot with all attributes at 1 and a top weapon (₡425K) beats a robot with attributes at 15 and a starter weapon. The weapon is always the best investment.

**Current DPS spread (1H):** 2.0 – 6.0 (3.0× ratio)  
**Current DPS spread (2H):** 2.0 – 4.5 (2.25× ratio)

The five top-tier 1H weapons (Vibro Mace, Volt Sabre, Nova Caster, Particle Lance + Arc Projector 2H) all have identical DPS (6.0 for 1H), making their attribute bonuses irrelevant as a differentiator.

---

## Solution

Compress baseDamage values across all weapons. Increase the DPS cost multiplier in the pricing formula from 3.0 to 6.0 so that prices remain within ±1% of current values.

**New DPS spread (1H):** 2.0 – 4.0 (2.0× ratio)  
**New DPS spread (2H):** 2.0 – 3.25 (1.63× ratio)

### Key Properties

- **No price changes** — max deviation ±1%
- **No cooldown changes** — weapon identity (fast vs slow) preserved
- **No attribute bonus changes** — existing differentiation becomes more relevant
- **No HP/shield changes** — battles get ~33% longer (33.8s → ~45s avg), well within 120s limit
- **Progressive compression** — cheap weapons barely change (-10%), expensive weapons compress most (-33%)
- **Schema change required** — `baseDamage: Int → Float` (to support 0.5 increments)

---

## Pricing Formula

```
Price = (₡50,000 + AttrCost + DPSCost) × HandMult

Where:
  AttrCost = Σ(500 × bonus²) for all attribute bonuses (positive and negative)
  DPSCost  = ₡50,000 × (DPS / 2.0 - 1.0) × 6.0    ← M changed from 3.0 to 6.0
  DPS      = baseDamage / cooldown
  HandMult = 1.0 (one-handed) | 1.6 (two-handed) | 0.9 (shield)
  Baseline = Practice Sword: 6 dmg / 3s = 2.0 DPS
```

---

## Complete Weapon Changes

### 1H Weapons (HandMult = 1.0)

| Weapon | Old Dmg | New Dmg | CD | Old DPS | New DPS | DPS Δ | Price Δ |
|--------|---------|---------|-----|---------|---------|-------|---------|
| Practice Sword | 6 | 6 | 3s | 2.00 | 2.00 | 0% | 0% |
| Practice Blaster | 6 | 6 | 3s | 2.00 | 2.00 | 0% | 0% |
| Laser Pistol | 6 | 6 | 3s | 2.00 | 2.00 | 0% | 0% |
| Machine Pistol | 5 | 4.5 | 2s | 2.50 | 2.25 | -10% | 0% |
| Combat Knife | 5 | 4.5 | 2s | 2.50 | 2.25 | -10% | 0% |
| Bolt Carbine | 5 | 4.5 | 2s | 2.50 | 2.25 | -10% | 0% |
| Beam Pistol | 5 | 4.5 | 2s | 2.50 | 2.25 | -10% | 0% |
| Machine Gun | 5 | 4.5 | 2s | 2.50 | 2.25 | -10% | 0% |
| Burst Rifle | 8 | 7 | 3s | 2.67 | 2.33 | -12% | 0% |
| Flux Repeater | 9 | 7.5 | 3s | 3.00 | 2.50 | -17% | 0% |
| Photon Marksman | 9 | 7.5 | 3s | 3.00 | 2.50 | -17% | 0% |
| Energy Blade | 10 | 8 | 3s | 3.33 | 2.67 | -20% | 0% |
| Plasma Blade | 11 | 8.5 | 3s | 3.67 | 2.83 | -23% | 0% |
| Plasma Rifle | 13 | 9.5 | 3s | 4.33 | 3.17 | -27% | 0% |
| Gauss Pistol | 14 | 10 | 3s | 4.67 | 3.33 | -29% | 0% |
| Assault Rifle | 14 | 10 | 3s | 4.67 | 3.33 | -29% | 0% |
| Disruptor Cannon | 14 | 10 | 3s | 4.67 | 3.33 | -29% | 0% |
| Power Sword | 15 | 10.5 | 3s | 5.00 | 3.50 | -30% | 0% |
| Vibro Mace | 18 | 8 | 2s | 6.00 | 4.00 | -33% | 0% |
| Volt Sabre | 18 | 12 | 3s | 6.00 | 4.00 | -33% | 0% |
| Nova Caster | 18 | 14 | 3.5s | 6.00 | 4.00 | -33% | 0% |
| Particle Lance | 18 | 16 | 4s | 6.00 | 4.00 | -33% | 0% |

### 2H Weapons (HandMult = 1.6)

| Weapon | Old Dmg | New Dmg | CD | Old DPS | New DPS | DPS Δ | Price Δ |
|--------|---------|---------|-----|---------|---------|-------|---------|
| Training Rifle | 6 | 6 | 3s | 2.00 | 2.00 | 0% | 0% |
| Training Beam | 6 | 6 | 3s | 2.00 | 2.00 | 0% | 0% |
| War Club | 6 | 6 | 3s | 2.00 | 2.00 | 0% | 0% |
| Scatter Cannon | 6 | 6 | 3s | 2.00 | 2.00 | 0% | 0% |
| Shock Maul | 8 | 7 | 3s | 2.67 | 2.33 | -12% | 0% |
| Mortar System | 10 | 9 | 4s | 2.50 | 2.25 | -10% | 0% |
| Siege Cannon | 10 | 9 | 4s | 2.50 | 2.25 | -10% | 0% |
| Laser Rifle | 9 | 7.5 | 3s | 3.00 | 2.50 | -17% | 0% |
| Pulse Accelerator | 13 | 10.5 | 4s | 3.25 | 2.63 | -19% | 0% |
| Thermal Lance | 13 | 10.5 | 4s | 3.25 | 2.63 | -19% | 0% |
| Shotgun | 14 | 11 | 4s | 3.50 | 2.75 | -21% | 0% |
| Grenade Launcher | 16 | 13 | 5s | 3.20 | 2.60 | -19% | 0% |
| Sniper Rifle | 22 | 17 | 6s | 3.67 | 2.83 | -23% | 0% |
| Battle Axe | 17 | 12.5 | 4s | 4.25 | 3.13 | -26% | 0% |
| Plasma Cannon | 20 | 15 | 5s | 4.00 | 3.00 | -25% | 0% |
| Heavy Hammer | 22 | 16 | 5s | 4.40 | 3.20 | -27% | 0% |
| Arc Projector | 18 | 13 | 4s | 4.50 | 3.25 | -28% | 0% |
| Railgun | 25 | 18.5 | 6s | 4.17 | 3.08 | -26% | 0% |
| Ion Beam | 18 | 13 | 4s | 4.50 | 3.25 | -28% | 0% |

### Shields (unchanged)

| Weapon | Price | Notes |
|--------|-------|-------|
| Light Shield | ₡51K | No combat changes |
| Combat Shield | ₡78K | No combat changes |
| Reactive Shield | ₡92K | No combat changes |
| Barrier Shield | ₡111K | No combat changes |
| Fortress Shield | ₡291K | No combat changes |
| Aegis Bulwark | ₡409K | No combat changes |

---

## Impact Analysis

### Battle Duration

| Metric | Current | After Rebalance |
|--------|---------|-----------------|
| Avg duration | 33.8s | ~45s (estimated) |
| Draw rate | 1.4% | ~2-3% (estimated) |
| Kill rate | 42.9% | ~30-35% (estimated) |
| Time limit | 120s | 120s (unchanged) |

Longer battles mean defensive mechanics (counter-attacks, shield regen, evasion, adaptation) have more time to accumulate value.

### Investment Comparison (₡425K budget)

| Strategy | DPS | EHP | Effective Power (DPS×EHP) |
|----------|-----|-----|---------------------------|
| Buy Volt Sabre, keep attrs at 1 | 4.09 | 59 | 241 |
| Keep starter, spread across 6 attrs | 2.44 | 131 | 319 |
| Keep starter, focus CP+WC to 16 | 2.74 | 59 | 162 |

The weapon-only player has higher DPS but dies in 2 hits. The attribute player survives long enough to win through sustained damage. **Neither strategy dominates — the optimal path is a mix of weapon + attributes.**

### Loadout Comparison (post-rebalance, attrs at 20)

| Loadout | DPS | Investment | Survivability |
|---------|-----|-----------|---------------|
| Single (Volt Sabre) | 7.6 | ₡425K | Baseline |
| Dual Wield (2× Volt Sabre) | 10.3 | ₡850K | Low |
| Two-Handed (Ion Beam) | ~7.4 | ₡544K | Baseline + burst |
| Weapon + Shield (Volt Sabre + Aegis) | 7.2 | ₡834K | High |

Dual wield is 1.36× single DPS (down from ~2.5× currently). Shield builds become viable because fights last long enough for defensive value to accumulate.

### Obsidion vs Ultron (real player matchup)

| Metric | Current | After Rebalance |
|--------|---------|-----------------|
| Obsidion DPS (dual offensive) | 22.6 | 15.0 |
| Ultron DPS (tank defensive) | 12.3 | 8.2 |
| Time for Obsidion to kill Ultron | 13.3s | 19.9s |
| Time for Ultron to kill Obsidion | 12.2s | 18.2s |
| Winner | Obsidion | **Ultron** |

The tank build becomes viable. Defensive investment pays off.

---

## Full Budget Analysis (₡3M Starting Credits)

Players start with ₡3,000,000. At this budget, the weapon-vs-attributes tradeoff is less stark because players can afford both. The key question becomes: which *loadout type* is best?

### Strategy Comparison (₡3M budget, spreading remainder across 6 attrs)

| Strategy | Weapon Cost | Attrs Achieved | DPS | EHP | Power (DPS×EHP) |
|----------|-------------|----------------|-----|-----|-----------------|
| DW Volt Sabre ×2 | ₡850K | ~21-22 all | 11.8 | 239 | 2814 |
| Volt Sabre + Aegis (tank) | ₡834K | ~21-22 all | 8.3 | 328 | 2714 |
| 2H Ion Beam (crit) | ₡544K | ~23 all | 9.5 | 253 | 2416 |
| Single Assault Rifle | ₡293K | ~24 all | 7.8 | 266 | 2070 |
| Single Burst Rifle (budget) | ₡117K | ~25 all | 5.6 | 271 | 1522 |
| Starter only (pure attrs) | ₡0 | ~26 all | 4.9 | 275 | 1346 |

### Key Findings

1. **All four loadout types are competitive** — DW (2814), Tank (2714), and 2H (2416) are within 15% of each other. This is the target game state.

2. **The tank build nearly matches the glass cannon** — Power 2714 vs 2814 (4% gap). Plus the tank has +15 armor, +14 counter protocols, and 37% more EHP. In practice with hit variance and counter-attacks, this is likely 50/50.

3. **Budget weapon strategies are clearly inferior at ₡3M** — With ₡3M you can afford both a top weapon AND good attributes. The extra 2-3 attribute levels from skipping the weapon don't compensate.

4. **The weapon is still the right first buy at ₡3M** — but the *type* of weapon setup (DW vs shield vs 2H) is now a genuine strategic choice rather than "always dual wield."

### Where the Weapon-vs-Attributes Tradeoff Matters

The tradeoff is most meaningful for **mid-game players** who have ₡200K-₡500K to spend. At that budget:
- Buying a Volt Sabre (₡425K) leaves nothing for attributes
- Buying an Assault Rifle (₡293K) leaves ₡130K for attributes
- Buying a Burst Rifle (₡117K) leaves ₡300K+ for attributes

The ₡425K analysis showed that spreading credits across attributes produces higher effective combat power (319) than dumping into a single weapon (241) — because the weapon player has 59 EHP and dies in 2 hits.

## Loadout Type Comparison (Post-Rebalance)

### How 2H Compares to 1H

| Factor | 1H Single | 2H |
|--------|-----------|-----|
| Loadout damage mult | 1.0× | 1.10× |
| CP bonus from loadout | — | +10% |
| Crit chance bonus | — | +10% base |
| Crit multiplier | 2.0× | 2.5× |
| Effective DPS boost from crits | ~10% | ~25% |
| Can dual wield | Yes | No |
| Can pair with shield | Yes | No |

After rebalance, top 2H (Ion Beam: 13 dmg, 4s CD, DPS 3.25) with loadout bonuses and crit averages to ~9.5 effective DPS. Top 1H single (Volt Sabre: 12 dmg, 3s CD, DPS 4.0) achieves ~7.6 effective DPS. **2H is actually higher DPS than single 1H** when accounting for crit burst. The tradeoff is flexibility — 1H can go dual wield or add a shield later.

### How Dual Wield Compares

| Factor | Single 1H | Dual Wield |
|--------|-----------|------------|
| Loadout damage mult | 1.0× | 0.90× |
| Offhand attacks | No | Yes (50% hit, 1.4× CD penalty) |
| AS bonus from loadout | — | +30% |
| WC bonus from loadout | — | +15% |
| Penetration penalty | — | -20% |
| CP penalty | — | -10% |
| Effective DPS multiplier vs single | 1.0× | ~1.36× |
| Cost | 1 weapon | 2 weapons |

Dual wield is still the DPS king but at 1.36× (not 2.5×). It costs double and sacrifices penetration and CP. Against heavily armored targets, the penetration penalty hurts.

### How Weapon+Shield Compares

| Factor | Single 1H | Weapon + Shield |
|--------|-----------|-----------------|
| Loadout damage mult | 1.0× | 1.0× |
| AS penalty from loadout | — | -15% |
| Shield capacity bonus | — | +20% |
| Armor bonus | — | +15% |
| Counter chance bonus | — | +10% |
| Shield attribute bonuses | — | +15 armor, +15 shield, +14 counter (Aegis) |
| DPS vs single | 1.0× | ~0.95× (slight AS penalty) |
| EHP vs single | 1.0× | ~1.4× |

The shield build trades ~5% DPS for ~40% more survivability. In a 45-second fight, that extra EHP means surviving 2-3 more hits, which means 2-3 more counter-attacks triggered, which means 20-30 extra damage dealt. The shield build wins through attrition.

## Big Five 1H Weapon Differentiation

The four luxury 1H weapons (₡425K each) previously shared identical stats (18 dmg / 3s CD). After the rebalance, they maintain the same DPS (4.0) and same price but have distinct combat profiles:

| Weapon | baseDamage | Cooldown | DPS | Identity |
|--------|-----------|----------|-----|----------|
| Vibro Mace | 8 | 2s | 4.0 | Fast brawler — more attacks per fight, more counter/crit triggers |
| Volt Sabre | 12 | 3s | 4.0 | Standard balanced — the reference weapon |
| Nova Caster | 14 | 3.5s | 4.0 | Moderate burst — fewer but harder hits |
| Particle Lance | 16 | 4s | 4.0 | Heavy burst — slow cannon, big per-hit damage |

### Why This Matters

- **Fast weapons** (Vibro Mace) benefit more from Attack Speed (more attacks to accelerate) and trigger more counter-attacks and critical hits per fight
- **Slow weapons** (Particle Lance) benefit more from Critical Systems (bigger crit spikes) and are better against armor (fewer hits = less total armor reduction applied)
- This creates a genuine playstyle choice within the same tier and price point

### Price Verification

All four weapons have the same attribute bonuses and the same DPS (4.0), so the pricing formula produces the same price (₡425K) regardless of the damage/cooldown split.

## Implementation Checklist

### Database Migration
- [ ] Change `Weapon.baseDamage` from `Int` to `Float` (or `Decimal`)

### Seed Data Update
- [ ] Update all 41 weapon baseDamage values in `app/backend/prisma/seed.ts`
- [ ] Run seed to update existing weapon records

### Documentation Update
- [ ] Update `docs/game-systems/PRD_WEAPON_ECONOMY.md` — DPS Cost Multiplier M: 3.0 → 6.0
- [ ] Update `docs/architecture/COMBAT_FORMULAS.md` — note baseDamage compression
- [ ] Add changelog entry explaining the rebalance

### Verification
- [ ] Run practice arena batch tests comparing old vs new damage output
- [ ] Verify battle duration stays within 35-60s average
- [ ] Verify draw rate stays below 5%
- [ ] Check that no weapon's calculated price deviates >5% from DB price

### Player Communication
- [ ] Changelog entry: "Combat Rebalance — Weapons are still important, but your robot's training now matters just as much. Attribute investment is now a competitive strategy alongside weapon upgrades."

---

## Design Decisions

**Why M=6.0?** It's the exact multiplier that reproduces current prices (±1%) with the compressed baseDamage values. No price changes needed, no refunds, no economic disruption.

**Why not touch cooldowns?** Cooldown defines weapon identity (fast vs slow). Changing it would alter how Attack Speed interacts with each weapon. baseDamage-only changes are simpler and preserve feel.

**Why not touch HP/shields?** Longer battles are a feature, not a bug. They give defensive mechanics time to work, making tank builds viable. Current 33.8s → ~45s is well within the 120s limit.

**Why not touch attribute bonuses?** They're already well-differentiated across weapons. The problem was that baseDamage drowned them out. With compressed DPS spread, the existing bonuses become the primary differentiator between same-tier weapons.

**Why Float instead of keeping Int?** Several weapons need 0.5 increments (4.5, 7.5, 8.5, 9.5, 10.5, 12.5, 18.5) to hit exact price targets. Using Int would force rounding that creates ±5-10% price deviations.
