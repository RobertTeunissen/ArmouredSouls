# Implementation Plan

## Task 1: Database Schema Migration

- [x] 1.1 Create Prisma migration to change `Weapon.baseDamage` from `Int` to `Float` and `Weapon.cooldown` from `Int` to `Float`
  - Create migration file: `app/backend/prisma/migrations/YYYYMMDD_weapon_dps_rebalance/migration.sql`
  - SQL: `ALTER TABLE "Weapon" ALTER COLUMN "base_damage" TYPE DOUBLE PRECISION;`
  - SQL: `ALTER TABLE "Weapon" ALTER COLUMN "cooldown" TYPE DOUBLE PRECISION;`
  - Update `app/backend/prisma/schema.prisma`: change `baseDamage Int @map("base_damage")` to `baseDamage Float @map("base_damage")`
  - Update `app/backend/prisma/schema.prisma`: change `cooldown Int` to `cooldown Float`
  - Run `npx prisma generate` to regenerate the client
  - Verify: `npx prisma validate` passes
  - _Requirements: R1.1, R1.2, R1.3, R1.4_

## Task 2: Update Seed Data

- [x] 2.1 Update `WEAPON_DEFINITIONS` in `app/backend/prisma/seed.ts` with new baseDamage and cooldown values
  - Update all 41 non-shield weapons per the design table:
    - Machine Pistol: 5 → 4.5
    - Combat Knife: 5 → 4.5
    - Bolt Carbine: 5 → 4.5
    - Beam Pistol: 5 → 4.5
    - Machine Gun: 5 → 4.5
    - Burst Rifle: 8 → 7
    - Flux Repeater: 9 → 7.5
    - Photon Marksman: 9 → 7.5
    - Energy Blade: 10 → 8
    - Plasma Blade: 11 → 8.5
    - Plasma Rifle: 13 → 9.5
    - Gauss Pistol: 14 → 10
    - Assault Rifle: 14 → 10
    - Disruptor Cannon: 14 → 10
    - Power Sword: 15 → 10.5
    - Vibro Mace: 18 → 8, cooldown 3 → 2 (fast brawler)
    - Volt Sabre: 18 → 12 (cooldown stays 3)
    - Nova Caster: 18 → 14, cooldown 3 → 3.5 (moderate burst)
    - Particle Lance: 18 → 16, cooldown 3 → 4 (heavy burst)
    - Shock Maul: 8 → 7
    - Mortar System: 10 → 9
    - Siege Cannon: 10 → 9
    - Laser Rifle: 9 → 7.5
    - Pulse Accelerator: 13 → 10.5
    - Thermal Lance: 13 → 10.5
    - Shotgun: 14 → 11
    - Grenade Launcher: 16 → 13
    - Sniper Rifle: 22 → 17
    - Battle Axe: 17 → 12.5
    - Plasma Cannon: 20 → 15
    - Heavy Hammer: 22 → 16
    - Arc Projector: 18 → 13
    - Railgun: 25 → 18.5
    - Ion Beam: 18 → 13
  - Leave unchanged: Practice Sword (6), Practice Blaster (6), Laser Pistol (6), Training Rifle (6), Training Beam (6), War Club (6), Scatter Cannon (6), all 6 shields
  - Verify no cost values are changed
  - Verify no attribute bonus values are changed
  - _Requirements: R2.1, R2.2, R2.3, R2.4, R2.5, R2.6, R3.1_

- [x] 2.2 Run seed to update existing weapon records
  - Execute: `cd app/backend && npx prisma db seed`
  - Verify weapons are updated in DB: `SELECT name, "base_damage" FROM "Weapon" WHERE name = 'Volt Sabre'` should return 12.0
  - Verify prices unchanged: `SELECT name, cost FROM "Weapon" WHERE name = 'Volt Sabre'` should return 425000
  - _Requirements: R3.2_

## Task 3: Combat System Verification

- [x] 3.1 Verify combat simulator handles Float baseDamage correctly
  - Review `app/backend/src/services/battle/combatSimulator.ts` — confirm `weaponBaseDamage` parameter is used in arithmetic without integer assumptions
  - Run existing combat-related tests: `cd app/backend && npx jest --testPathPattern="battle|combat" --no-coverage`
  - If any tests have hardcoded damage expectations based on old baseDamage values, update the fixtures
  - _Requirements: R4.1_

- [x] 3.2 Verify practice arena handles Float baseDamage correctly
  - Run existing practice arena tests: `cd app/backend && npx jest --testPathPattern="practice" --no-coverage`
  - If any tests have hardcoded damage expectations, update fixtures
  - _Requirements: R4.2_

- [x] 3.3 Run batch practice arena battles to verify duration
  - Use the practice arena batch endpoint to run 10 battles between two bots with attributes at 15-20
  - Verify average duration is in the 40-55s range
  - Verify no battles hit the 120s draw limit unexpectedly
  - _Requirements: R4.3_

## Task 4: Frontend Display

- [x] 4.1 Update weapon damage display formatting
  - Find all frontend locations that display `baseDamage` (weapon shop, weapon details, battle stats, robot detail page)
  - Add formatting logic: if `Number.isInteger(value)` display as integer, otherwise display with one decimal place
  - Verify: "12" not "12.0", "10.5" as "10.5", "4.5" as "4.5"
  - Search pattern: `baseDamage` in `app/frontend/src/`
  - _Requirements: R5.1, R5.2_

- [x] 4.2 Verify practice arena What-If system
  - Confirm the What-If weapon override in practice arena still works with Float baseDamage values
  - No code change expected — just verification
  - _Requirements: R5.3_

## Task 5: Documentation Updates

- [x] 5.1 Update `docs/game-systems/PRD_WEAPON_ECONOMY.md`
  - Add a "Version 1.4 Updates" section documenting:
    - DPS Cost Multiplier changed from 3.0 to 6.0
    - baseDamage compression: all weapons reduced proportionally, cheap weapons barely change, expensive weapons compress ~33%
    - Rationale: reduce DPS dominance, make attributes competitive with weapon investment
    - New formula: `DPS Cost = ₡50,000 × (DPS/2.0 - 1.0) × 6.0`
    - Price impact: ±1% (effectively unchanged)
  - Update the "Complete Pricing Formula" section to show M=6.0
  - _Requirements: R6.1, R7.1, R7.2, R7.3_

- [x] 5.2 Update `docs/architecture/COMBAT_FORMULAS.md`
  - Add a note in the "Damage Calculation" section explaining that baseDamage values were compressed in the DPS rebalance
  - Reference the analysis document for full details
  - Note that the formula itself is unchanged — only the input values (baseDamage) changed
  - _Requirements: R6.2_

- [x] 5.3 Finalize `docs/analysis/WEAPON_DPS_REBALANCE.md`
  - Add the ₡3M starting budget analysis section (6 strategies compared)
  - Add the loadout comparison section (DW vs 2H vs Single vs Shield at equal budget)
  - Add the "big five" weapon identity observation
  - Ensure the document captures the full discussion context from the design session
  - _Requirements: R6.3_

- [x] 5.4 Create changelog entry
  - Add entry to the changelog system (via admin or direct DB insert depending on current workflow)
  - Title: "Combat Rebalance v2 — Attributes Matter"
  - Content: Explain that weapon damage was compressed so that attribute investment is now a competitive strategy. All loadout types (dual wield, two-handed, weapon+shield, single) are now viable. Battles last slightly longer, giving defensive builds time to shine. Weapon prices unchanged.
  - _Requirements: R6.4_

## Task 6: Test Suite Verification

- [x] 6.1 Run full backend test suite
  - Execute: `cd app/backend && npm test -- --silent`
  - Fix any failures caused by hardcoded baseDamage expectations in test fixtures
  - All tests must pass
  - _Requirements: R4.1, R4.2_

- [x] 6.2 Run price verification script
  - Write and run a script that for each weapon:
    - Calculates expected price using formula: `(50000 + AttrCost + 50000 × (DPS/2.0 - 1.0) × 6.0) × HandMult`
    - Compares to actual DB price
    - Asserts deviation is ≤ 5%
  - All 47 weapons must pass
  - _Requirements: R2.4, R7.2_

## Task 7: Final Verification

- [x] 7.1 Run all verification criteria from requirements
  - Query top weapons: confirm baseDamage values of 16, 14, 12, 8 for the big four 1H (differentiated)
  - Query big five: confirm Vibro Mace (8/2s), Volt Sabre (12/3s), Nova Caster (14/3.5s), Particle Lance (16/4s) — four distinct profiles
  - Query DPS spread: confirm max/min ratio ≤ 2.1 for 1H weapons
  - Query prices: confirm unchanged from current values
  - Run practice arena batch: verify duration 40-55s average
  - Run `npx prisma validate`: passes
  - Run `npm test -- --silent`: all pass
  - Check frontend weapon shop display: no artifacts for Float damage and cooldown values
  - _Requirements: R1.1, R1.2, R1.3, R1.4, R2.1, R2.2, R2.3, R2.4, R2.5, R2.6, R3.1, R3.2, R4.1, R4.2, R4.3, R5.1, R5.2, R5.3, R6.1, R6.2, R6.3, R6.4, R7.1, R7.2, R7.3_
