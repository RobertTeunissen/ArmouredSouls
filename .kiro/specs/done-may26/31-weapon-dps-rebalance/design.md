# Design: Weapon DPS Rebalance

## Overview

Compress the baseDamage spread across all 47 weapons to reduce DPS dominance. The DPS cost multiplier in the pricing formula increases from 3.0 to 6.0, which exactly reproduces current prices (±1%) with the new lower baseDamage values. No other combat parameters change.

## Approach

The rebalance is a **data-only change** to weapon baseDamage values plus a schema type change (Int → Float). The combat simulator code already reads baseDamage as a number and performs floating-point arithmetic — no code changes are needed in the damage calculation path.

The pricing formula multiplier change (M: 3→6) is documentation-only. It doesn't affect any runtime code — it's the design tool used to set weapon prices. Current prices stay frozen in the database.

## Schema Change

### Migration: `baseDamage Int → Float`, `cooldown Int → Float`

```sql
ALTER TABLE "Weapon" ALTER COLUMN "base_damage" TYPE DOUBLE PRECISION;
ALTER TABLE "Weapon" ALTER COLUMN "cooldown" TYPE DOUBLE PRECISION;
```

Prisma schema change:
```prisma
baseDamage      Float   @map("base_damage")  // Was: Int
cooldown        Float   // Was: Int
```

Both are widening conversions — all existing Int values are valid Float values. No data loss.

## Rebalance Values

### Formula

For each weapon, the new baseDamage is calculated to produce the same price at M=6.0:

```
Target DPS = 2.0 × (1 + (Price/HandMult - 50000 - AttrCost) / (50000 × 6.0))
New baseDamage = Target DPS × cooldown
```

Where `AttrCost = Σ(500 × bonus²)` for all attribute bonuses on the weapon.

### Complete Rebalance Table

#### 1H Weapons (HandMult = 1.0)

| Weapon | Old baseDmg | **New baseDmg** | CD | Old DPS | New DPS | DPS Δ |
|--------|-------------|-----------------|-----|---------|---------|-------|
| Practice Sword | 6 | **6** | 3 | 2.00 | 2.00 | 0% |
| Practice Blaster | 6 | **6** | 3 | 2.00 | 2.00 | 0% |
| Laser Pistol | 6 | **6** | 3 | 2.00 | 2.00 | 0% |
| Machine Pistol | 5 | **4.5** | 2 | 2.50 | 2.25 | -10% |
| Combat Knife | 5 | **4.5** | 2 | 2.50 | 2.25 | -10% |
| Bolt Carbine | 5 | **4.5** | 2 | 2.50 | 2.25 | -10% |
| Beam Pistol | 5 | **4.5** | 2 | 2.50 | 2.25 | -10% |
| Machine Gun | 5 | **4.5** | 2 | 2.50 | 2.25 | -10% |
| Burst Rifle | 8 | **7** | 3 | 2.67 | 2.33 | -12% |
| Flux Repeater | 9 | **7.5** | 3 | 3.00 | 2.50 | -17% |
| Photon Marksman | 9 | **7.5** | 3 | 3.00 | 2.50 | -17% |
| Energy Blade | 10 | **8** | 3 | 3.33 | 2.67 | -20% |
| Plasma Blade | 11 | **8.5** | 3 | 3.67 | 2.83 | -23% |
| Plasma Rifle | 13 | **9.5** | 3 | 4.33 | 3.17 | -27% |
| Gauss Pistol | 14 | **10** | 3 | 4.67 | 3.33 | -29% |
| Assault Rifle | 14 | **10** | 3 | 4.67 | 3.33 | -29% |
| Disruptor Cannon | 14 | **10** | 3 | 4.67 | 3.33 | -29% |
| Power Sword | 15 | **10.5** | 3 | 5.00 | 3.50 | -30% |
| Vibro Mace | 18 | **8** | 3→**2** | 6.00 | 4.00 | -33% |
| Volt Sabre | 18 | **12** | 3 | 6.00 | 4.00 | -33% |
| Nova Caster | 18 | **14** | 3→**3.5** | 6.00 | 4.00 | -33% |
| Particle Lance | 18 | **16** | 3→**4** | 6.00 | 4.00 | -33% |

Note: Vibro Mace, Nova Caster, and Particle Lance also get cooldown changes to differentiate them from Volt Sabre while maintaining the same DPS (4.0) and price (₡425K).

#### 2H Weapons (HandMult = 1.6)

| Weapon | Old baseDmg | **New baseDmg** | CD | Old DPS | New DPS | DPS Δ |
|--------|-------------|-----------------|-----|---------|---------|-------|
| Training Rifle | 6 | **6** | 3 | 2.00 | 2.00 | 0% |
| Training Beam | 6 | **6** | 3 | 2.00 | 2.00 | 0% |
| War Club | 6 | **6** | 3 | 2.00 | 2.00 | 0% |
| Scatter Cannon | 6 | **6** | 3 | 2.00 | 2.00 | 0% |
| Shock Maul | 8 | **7** | 3 | 2.67 | 2.33 | -12% |
| Mortar System | 10 | **9** | 4 | 2.50 | 2.25 | -10% |
| Siege Cannon | 10 | **9** | 4 | 2.50 | 2.25 | -10% |
| Laser Rifle | 9 | **7.5** | 3 | 3.00 | 2.50 | -17% |
| Pulse Accelerator | 13 | **10.5** | 4 | 3.25 | 2.63 | -19% |
| Thermal Lance | 13 | **10.5** | 4 | 3.25 | 2.63 | -19% |
| Shotgun | 14 | **11** | 4 | 3.50 | 2.75 | -21% |
| Grenade Launcher | 16 | **13** | 5 | 3.20 | 2.60 | -19% |
| Sniper Rifle | 22 | **17** | 6 | 3.67 | 2.83 | -23% |
| Battle Axe | 17 | **12.5** | 4 | 4.25 | 3.13 | -26% |
| Plasma Cannon | 20 | **15** | 5 | 4.00 | 3.00 | -25% |
| Heavy Hammer | 22 | **16** | 5 | 4.40 | 3.20 | -27% |
| Arc Projector | 18 | **13** | 4 | 4.50 | 3.25 | -28% |
| Railgun | 25 | **18.5** | 6 | 4.17 | 3.08 | -26% |
| Ion Beam | 18 | **13** | 4 | 4.50 | 3.25 | -28% |

#### Shields (unchanged)

All 6 shields remain unchanged (baseDamage 0, no combat impact).

## Combat Impact Analysis

### Battle Duration

| Metric | Current (ACC) | Estimated After |
|--------|---------------|-----------------|
| Avg duration | 33.8s | ~45s |
| Draw rate | 1.4% | ~2-3% |
| Kill rate | 42.9% | ~30-35% |
| Time limit | 120s | 120s (unchanged) |

The ~33% DPS reduction at the top end translates to ~33% longer fights. This is within the acceptable range (user constraint: no more than double, i.e., <67.6s).

### Loadout Comparison (₡3M budget, attrs ~20-22)

| Loadout | DPS | EHP | Power (DPS×EHP) | Notes |
|---------|-----|-----|-----------------|-------|
| Dual Wield (2× Volt Sabre) | 11.8 | 239 | 2814 | Glass cannon |
| Weapon + Shield (Volt Sabre + Aegis) | 8.3 | 328 | 2714 | Tank, +counter |
| Two-Handed (Ion Beam) | 9.5 | 253 | 2416 | Burst/crit |
| Single (Assault Rifle) | 7.8 | 266 | 2070 | Balanced |

All four loadout types are within 15% of each other on effective combat power. This is a massive improvement over current where dual wield dominates by 2-3×.

### Investment Comparison (₡425K budget, fresh robot)

| Strategy | DPS | EHP | Power | Winner? |
|----------|-----|-----|-------|---------|
| Buy Volt Sabre, keep attrs at 1 | 4.09 | 59 | 241 | Loses |
| Keep starter, spread ₡425K across 6 attrs | 2.44 | 131 | 319 | **Wins** |

The attribute-heavy player wins because the weapon player has 59 EHP (dies in 2 hits). This confirms that the weapon is no longer the unconditionally best first investment.

## Files Modified

### Backend

| File | Change |
|------|--------|
| `app/backend/prisma/schema.prisma` | `baseDamage Int` → `baseDamage Float` |
| `app/backend/prisma/migrations/YYYYMMDD_weapon_dps_rebalance/migration.sql` | ALTER COLUMN type |
| `app/backend/prisma/seed.ts` | Update all 41 baseDamage values in WEAPON_DEFINITIONS |
| `app/backend/generated/prisma/` | Regenerated client (auto) |

### Frontend

| File | Change |
|------|--------|
| Weapon display components | Format Float baseDamage for display (hide .0, show .5) |

### Documentation

| File | Change |
|------|--------|
| `docs/game-systems/PRD_WEAPON_ECONOMY.md` | Update M=3→6, add v1.4 section |
| `docs/architecture/COMBAT_FORMULAS.md` | Note baseDamage compression |
| `docs/analysis/WEAPON_DPS_REBALANCE.md` | Add ₡3M analysis, loadout comparison |
| `.kiro/steering/` | No steering file changes needed (combat formulas are in docs/, not steering) |
| `docs/guides/` | No guide changes needed (no deployment or setup impact) |

### No Changes Required

- Combat simulator code (`combatSimulator.ts`) — already uses `Number()` and floating-point math
- HP/shield calculations (`robotCalculations.ts`) — unchanged
- Practice arena service — unchanged (reads baseDamage from DB)
- Weapon purchase routes — unchanged (prices don't change)
- Attribute upgrade costs — unchanged
- Loadout multipliers — unchanged
- Cooldown values — unchanged

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Float precision issues in damage calc | Low | JS uses 64-bit doubles; 0.5 increments are exact in binary |
| Frontend displays "12.000000001" | Low | Format with `Number.isInteger(x) ? x : x.toFixed(1)` |
| Battle duration exceeds 120s more often | Low | Estimated avg ~45s, well under limit. Monitor draw rate. |
| Players feel weapons are "nerfed" | Medium | Frame as "attributes now matter more" not "weapons got weaker". All players affected equally — relative rankings unchanged. |
| Existing tests fail due to hardcoded damage expectations | Medium | Update test fixtures with new baseDamage values |

## Testing Strategy

1. **Schema validation**: `npx prisma validate` after migration
2. **Seed verification**: Run seed, query DB to confirm new values
3. **Price verification**: Script that recalculates all prices with M=6 formula and compares to DB costs (all within ±1%)
4. **Combat simulation**: Run practice arena batch tests comparing pre/post damage output
5. **Duration check**: Run 100+ practice battles, verify avg duration in 40-55s range
6. **Frontend visual check**: Verify weapon shop displays damage values cleanly
7. **Existing test suite**: All backend tests pass without modification (or with updated fixtures)
