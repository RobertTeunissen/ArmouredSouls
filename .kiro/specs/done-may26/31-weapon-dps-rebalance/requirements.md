# Requirements: Weapon DPS Rebalance (baseDamage Compression)

## Introduction

Weapon DPS dominates all other combat factors in Armoured Souls. The damage formula uses baseDamage as a flat multiplier that attributes scale from, making weapon tier the single most impactful variable. A robot with all attributes at 1 and a top-tier weapon decisively beats a robot with attributes at 15 and a starter weapon. Players have no reason to invest in attributes when a weapon purchase delivers 3–6× more combat value per credit spent.

This spec compresses the baseDamage spread across all 47 weapons, reducing the DPS gap between cheap and expensive weapons from 3.0× to 2.0×. The pricing formula multiplier is adjusted from 3.0 to 6.0 so that weapon prices remain within ±1% of current values. No other combat parameters change (HP, shields, cooldowns, attribute bonuses, loadout multipliers).

## Context: Weapon Economy Discussion Notes

The following observations and future directions were identified during analysis but are **out of scope** for this spec. They are recorded here to preserve context for future work.

### Observation: The "Big Five" 1H Weapons Are Identical (PARTIALLY solved by this spec)

Five 1H weapons (Vibro Mace, Volt Sabre, Nova Caster, Particle Lance, and the 2H Arc Projector) all share baseDamage 18 and cooldown 3s (6.0 DPS). This spec differentiates four of the 1H weapons by giving them different baseDamage/cooldown combinations that produce the same DPS (4.0) and same price (₡425K) but different combat profiles:

| Weapon | Range | New Dmg/CD | DPS | Identity |
|--------|-------|-----------|-----|----------|
| Vibro Mace | melee | 8 / 2s | 4.0 | Fast brawler — more attacks, more counter/crit triggers |
| Volt Sabre | short | 12 / 3s | 4.0 | Standard balanced |
| Nova Caster | mid | 14 / 3.5s | 4.0 | Moderate burst — fewer but harder hits |
| Particle Lance | long | 16 / 4s | 4.0 | Heavy burst — slow cannon, big per-hit damage |

Fast weapons benefit more from Attack Speed (more attacks to accelerate). Slow weapons benefit more from Critical Systems (bigger crit spikes) and are better against armor (fewer hits = less total armor reduction applied). This creates a genuine playstyle choice within the same tier and price point.

True matchup-dependent differentiation (energy vs ballistic vs melee) remains a future spec (#11 Weapon Special Properties).

### Observation: Dual Wield Is the Dominant Strategy

Two top-tier 1H weapons (~₡850K) produce ~2.5× the DPS of a single weapon. After this rebalance, dual wield is still the DPS leader but the gap narrows to ~1.36× over single. Combined with the glass-cannon survivability tradeoff, this creates a genuine strategic choice.

### Observation: Shields Are Undervalued in the Current Meta

The Aegis Bulwark (₡409K) provides massive defensive bonuses but fights end too quickly for them to matter. After this rebalance, longer battles (~45s vs ~34s) give defensive mechanics time to accumulate value, making shield builds competitive.

### Future Direction: Weapon Upgrades

A weapon upgrade system (leveling individual weapon instances over time) was discussed as a way to create attachment and identity. Players would invest credits into upgrading their weapon along various axes (reliability, attribute bonuses, minor damage, unique passives). This creates a "cheap weapon + heavy upgrades" path that competes with "buy expensive weapon." Parked for a future spec — depends on this rebalance being in place first.

### Future Direction: Weapon Resale

A weapon resale system (sell weapons back at Workshop-level-dependent rates, 40–75%) was discussed as a quality-of-life improvement. It reduces the penalty for experimentation but doesn't solve the core DPS dominance problem. Can be specced independently after this rebalance.

### Future Direction: Matchup-Dependent Effectiveness

Weapon type (energy/ballistic/melee) could interact differently with defensive attributes (energy bypasses armor but shields resist it, ballistic shreds shields but armor blocks it). This would create rock-paper-scissors dynamics requiring multiple weapons. Large scope — future spec.

### Starting Budget Consideration

With ₡3M starting credits, players can afford both a top weapon AND good attributes. The weapon is still the best *first* purchase, but the rebalance ensures that all four loadout types (single, dual wield, two-handed, weapon+shield) are competitive strategies at full budget. The "weapon vs attributes" tradeoff is most meaningful for mid-game players who can't afford both.

## Expected Contribution

This spec addresses Backlog #5 (Weapon Experimentation Problem — Players Never Switch Weapons) and the baseDamage dominance sub-problem identified in Backlog #6 (Game Loop Audit).

1. **DPS spread compression**: Before — 1H DPS ranges 2.0–6.0 (3.0× ratio), weapon tier dominates all other factors. After — 1H DPS ranges 2.0–4.0 (2.0× ratio), attribute investment becomes competitive with weapon investment.

2. **Loadout diversity**: Before — dual wield is ~2.5× single DPS, making it the only viable strategy. After — dual wield is ~1.36× single DPS, and tank builds (weapon+shield) achieve near-parity on effective combat power (DPS × EHP).

3. **Battle duration normalization**: Before — average 33.8s with 42.9% kill rate (too fast for defensive mechanics to matter). After — estimated ~45s average with ~30-35% kill rate (defensive attributes, counter-attacks, shield regen have time to accumulate value).

4. **Price stability**: Before — weapons priced with M=3.0 DPS cost multiplier. After — weapons priced with M=6.0, all prices within ±1% of current values. No refunds needed, no economic disruption.

5. **Schema modernization for future weapon crafting**: Before — baseDamage and cooldown are Int, limiting weapon design to whole numbers. After — both are Float, enabling precise pricing alignment and future player-crafted weapons with formula-derived stats.

### Verification Criteria

After all tasks are complete, run these checks:

1. `SELECT name, "base_damage", cooldown, cost FROM "Weapon" ORDER BY "base_damage" DESC LIMIT 5` — top 1H weapons should show baseDamage values of 16, 14, 12, 12 (differentiated), not all 18
2. `SELECT MAX("base_damage"::float / cooldown) as max_dps, MIN("base_damage"::float / cooldown) as min_dps FROM "Weapon" WHERE "hands_required" = 'one' AND "base_damage" > 0` — max_dps / min_dps should be ≤ 2.1 (was 3.0)
3. `SELECT name, cost, "base_damage", cooldown FROM "Weapon" WHERE "hands_required" = 'one' AND "base_damage" > 0 ORDER BY cost DESC LIMIT 5` — prices should be unchanged from current production values (±1%)
4. `SELECT name, "base_damage", cooldown FROM "Weapon" WHERE name IN ('Vibro Mace', 'Volt Sabre', 'Nova Caster', 'Particle Lance')` — should show four different cooldown values (2, 3, 3.5, 4) and four different baseDamage values (8, 12, 14, 16)
5. Run 100 practice arena batch battles between dual-wield top-tier vs weapon+shield top-tier at equal attributes (20) — win rate should be between 35–65% for each side (was ~80%+ for dual wield)
6. Run 100 practice arena batch battles with default bots — average duration should be 40–55s (was ~34s)
7. `npx prisma validate` passes with the updated schema (Float baseDamage and cooldown)
8. `cd app/backend && npm test -- --silent` — all existing tests pass
9. Frontend weapon shop displays baseDamage and cooldown values correctly (no display artifacts from Float)

## Requirements

### R1: Database Schema Change

**R1.1** The `Weapon.baseDamage` column SHALL be changed from `Int` to `Float` to support decimal damage values (e.g., 4.5, 7.5, 8.5, 10.5, 12.5, 18.5).

**R1.2** The `Weapon.cooldown` column SHALL be changed from `Int` to `Float` to support decimal cooldown values (e.g., 3.5s for Nova Caster).

**R1.3** A Prisma migration SHALL be created that alters both column types without data loss.

**R1.4** The Prisma client SHALL be regenerated after the schema change.

### R2: Weapon baseDamage and Cooldown Updates

**R2.1** All 41 non-shield weapons SHALL have their baseDamage values updated according to the rebalance table (see Design document for exact values).

**R2.2** The four "big five" 1H weapons SHALL have their cooldowns differentiated to create distinct combat profiles at the same DPS (4.0) and same price (₡425K):
- Vibro Mace: baseDamage 8, cooldown 2s (fast brawler)
- Volt Sabre: baseDamage 12, cooldown 3s (standard)
- Nova Caster: baseDamage 14, cooldown 3.5s (moderate burst)
- Particle Lance: baseDamage 16, cooldown 4s (heavy burst)

**R2.3** All other weapon cooldown values SHALL NOT change.

**R2.4** Attribute bonuses SHALL NOT change for any weapon.

**R2.5** Weapon costs (prices) SHALL NOT change for any weapon.

**R2.6** Shield weapons (6 total) SHALL NOT be modified in any way.

### R3: Seed Data Update

**R3.1** The `WEAPON_DEFINITIONS` array in `app/backend/prisma/seed.ts` SHALL be updated with the new baseDamage values.

**R3.2** Running the seed script SHALL update existing weapon records in the database to reflect the new baseDamage values.

### R4: Combat System Compatibility

**R4.1** The combat simulator SHALL continue to function correctly with Float baseDamage values (no rounding errors, no type mismatches).

**R4.2** The practice arena SHALL continue to function correctly with Float baseDamage values.

**R4.3** Battle duration SHALL increase by approximately 30–40% on average (from ~34s to ~45s) without exceeding the 120s time limit significantly more often than current (draw rate should stay below 5%).

### R5: Frontend Display

**R5.1** The weapon shop SHALL display baseDamage values appropriately (whole numbers without decimal, half-values with one decimal place, e.g., "12" not "12.0", but "10.5" as "10.5").

**R5.2** Battle logs and combat statistics SHALL display damage values correctly with Float baseDamage.

**R5.3** The practice arena What-If system SHALL continue to work with the new values.

### R6: Documentation Updates

**R6.1** `docs/game-systems/PRD_WEAPON_ECONOMY.md` SHALL be updated to document the new DPS Cost Multiplier (M=6.0) and the rationale for the change.

**R6.2** `docs/architecture/COMBAT_FORMULAS.md` SHALL be updated to note the baseDamage compression and its effect on damage calculations.

**R6.3** `docs/analysis/WEAPON_DPS_REBALANCE.md` SHALL be finalized with the ₡3M budget analysis and loadout comparison sections added.

**R6.4** A changelog entry SHALL be created explaining the rebalance to players.

### R7: Pricing Formula Documentation

**R7.1** The pricing formula documentation SHALL be updated to reflect M=6.0 (from M=3.0).

**R7.2** The formula SHALL remain: `Price = (₡50,000 + AttrCost + ₡50,000 × (DPS/2.0 - 1.0) × 6.0) × HandMult`

**R7.3** The baseline SHALL remain Practice Sword at 6 damage / 3s = 2.0 DPS.
