# Automaton Stables Implementation Record

**Spec:** 55 — Automaton Stables (`.kiro/specs/done-october26/55-automaton-stables/`)  
**Branch:** `feature/spec-55-automaton-stables`  
**Recorded:** 10 Oct 2026, local machine (Apple Silicon), PostgreSQL 17 in Docker on `localhost:5432`. No check ran against ACC or PRD.

This is the R14.7 record: each Verification Criterion with its result and an output excerpt. A check is recorded as passed only if it completed successfully.

## Verification Criteria

| # | Check | Result |
|---|---|---|
| 1 | Direct balance writers and Manual_Repair in `app/backend/src/services/automaton` | passed |
| 2 | `pnpm run test:unit -- automaton`; six `*.v1.json` files | passed |
| 3 | `pnpm run test:integration -- automaton`; extraction regressions in both tiers | passed |
| 4 | `pnpm run test:heavy -- automaton` | passed |
| 5 | `lint`, `build`, `typecheck:tests`, `test:tiers:verify` | passed |
| 6 | Frontend lint, build, Vitest, Playwright; documentation grep | passed |

1. Both greps print nothing (grep exit 1, no match). `ls app/backend/src/config/automaton-strategies/*.v1.json | wc -l` prints `6`.
2. `Test Suites: 46 passed, 46 total` · `Tests: 760 passed, 760 total`.
3. Automaton integration: `Test Suites: 20 passed, 20 total` · `Tests: 156 passed, 156 total`. Extraction, unit tier: `7 passed` suites, `164 passed` tests; integration tier: `16 passed` suites, `178 passed` tests.
4. On the local heavy database `armouredsouls_heavy`: `PASS tests/integration/automatonMultiSeason.test.ts (254.787 s)` · `PASS tests/integration/automatonSeasonRollover.test.ts` · `Tests: 4 passed, 4 total`. No Turn_Step was budget-skipped.
5. All four exit 0; `Tier_Partition holds: every test file runs in exactly one tier.` (523 files).
6. Frontend lint and build exit 0. `vitest --run Automaton automatons`: `Test Files 10 passed (10)` · `Tests 88 passed (88)`. Playwright `admin-automatons.spec.ts` (320, 768, 1024 px) and `automaton-badge.spec.ts` (320, 360, 768, 1024 px): `29 passed` (admin setup, 3 admin page, 24 badge, 1 teardown). The documentation `grep -L "Automaton" …` over the 28 listed files prints nothing; `verify-steering.mjs` passes.

## Blocking suites (`testing-strategy.md`)

| Suite | Result |
|---|---|
| Backend unit tier | 355 passed, 1 skipped (pre-existing) suites; 4,917 tests |
| Backend integration tier | 141/141 suites, 1,713 tests (also green when run directly after Playwright on the same database) |
| Backend heavy tier | 26/26 suites, 249 tests, 357 s |
| Frontend Vitest | 231 files, 2,201 passed, 3 skipped |
| Playwright (full) | 137 passed, 5 self-skipped (state-dependent skips in `battle-history` and `robot-creation`), 0 failed |
| Backend/frontend lint, build, typecheck | exit 0 |

## Turn_Step durations (R7.10, design §19)

Measured by `automatonMultiSeason.test.ts` with 100 Active_Automatons (the 11 starter stables plus 89 generated entries). Hard limit 300 s; design target 180 s for opening builds and 60 s for steady-state settlement.

| Turn_Step | Charged actions | Run A | Run B | Run C |
|---|---|---|---|---|
| Season 1, Preparation 1 (opening build) | 1,275 | 63.8 s | 76.8 s | 92.2 s |
| Season 2, `season_open` (opening build) | 1,292 | 92.5 s | 98.4 s | 78.2 s |
| Other Preparation steps | 0 | 0.9–1.5 s | 1.5–1.7 s | 0.9–1.0 s |
| Settlement steps (10 per run) | 13–31 | 1.4–2.1 s | 1.8–3.0 s | 1.4–2.4 s |

Run A: `test:heavy -- automaton` before the decision 42 change. Run B: the full heavy tier after it. Run C: `test:heavy -- automaton` after it. Strategy_Comparison answered in 265–286 ms over 100,000 battles and 380,000 participants (limit 2 s). Each run raised 88 turn-start negative-balance alerts (decision 40). An earlier run during implementation measured 244 s and 260 s for the opening steps; this gate did not investigate the difference. The product owner accepted the opening-step timing for this spec (final review FR-1). The CI heavy job has not run on this branch yet.

## Changes made at the verification gate

- `tests/cycleCsvStreamingRevenue.property.test.ts` now also deletes the ledger rows its battles write at `totalCycles + 10000`. They were left behind and failed `dataIntegrityService.test.ts` (cycles 10000+) on a reused local database.
- `jest.config.integration.js` sets `workerIdleMemoryLimit: '1GB'`. With 141 suites the in-band integration tier reached the 4 GB heap limit and crashed after every suite had passed. Jest now uses one worker process and recycles it, so the tier is still serialized.
- Decision 42: every Hall of Records record that names a stable shows the Automaton_Badge (`RecordStableName`, `getRecordOwner()`).
- Decision 43: the `admin-teardown` Playwright project runs `scripts/deleteE2eAutomatons.ts` (local hosts only) after the admin specs. The admin projects now run after `chromium`, because their bulk cycles change the seeded stables that the `chromium` specs expect at seed state. Both workflows' Playwright steps pass the e2e `DATABASE_URL` to the teardown.
- `automaton-badge.spec.ts`: the league-standings wait used `.or()` without `.first()` and failed in strict mode once standings had a second page.

## Deviations from the spec

Each item names what differs from `requirements.md` / `design.md` and why. None changes a player-visible rule except where marked.

Open items for the product owner:

- **Admin text awaiting approval (R13.4, decision 41).** The builder rule messages and admin helper strings in `review/PLAYER_FACING_TEXT.md` §6.9 are in the code but not approved. Reason: they had no approved text when the admin page was built; they follow the style of §6.4b. Approve or replace before merge.
- **Opening Turn_Step above the 180 s design target in some runs (R7.10, design §19).** The gate measured 64–98 s, but an implementation run measured 244 s and 260 s (hard limit 300 s). Reason: about 130 SQL statements per charged action on the shared human purchase path. Accepted by the product owner (FR-1); the CI heavy job has not run on this branch yet.

Data model and interfaces:

- **`automaton_turns.upkeep_issues` column** (migration `20261010000000_automaton_turn_upkeep_issues`), not in design §6.1. Reason: upkeep issues needed a place on the Turn_Record (R7.8).
- **Request key separator `.` instead of `:` (design §9.3).** Reason: `buildEconomicOperationEventId` rejects `:` in a request key. Same components and determinism.
- **`updateStance` / `updateYieldThreshold` return `{ robot, stance }` / `{ robot, yieldThreshold }`** instead of the robot only. Reason: the route needs the normalised value for its message and the `stance_changed` achievement.
- **Admin strategy export returns JSON `{ fileName, definition, upgradeWarning }`** instead of the bare file. Reason: R6.14 requires the upgrade warning in the export response.
- **Error codes added beyond the design**: `AUTOMATON_PROFILE_INVALID` (stored Team_Names / Event_Order fail their shape; R11.8 reserves `invalid_parameters` for strategy targets) and `AUTOMATON_NO_PROGRESS` (an action that commits nothing fails the turn instead of looping to the 10 s budget). Both are in `docs/guides/ERROR_CODES.md`.

Behaviour details chosen where the spec was silent:

- **Saving-streak alert fires once**, on the 15th consecutive turn Saving on the same Goal, not on every later turn.
- **Draft creation does not run the R3.7 blueprint check.** Reason: a new draft has no blueprints yet and R3.7 does not list creation; activation (R2.3) and strategy assignment enforce it.
- **Draft preview is refused while the draft breaks a builder rule.** Reason: an invalid Build_Order cannot be interpreted safely.
- **Strategy startup check with the database down** checks the files and starts with a warning. Reason: refusing to boot without a DB would change today's boot behaviour; a missing version is still caught at turn time (R6.6).
- **Automaton purchases are not fed to the per-request spending-anomaly monitor** (`securityMonitor.trackSpending` needs a client request). Event-log rows are written as for human purchases.
- **Opening-build tolerance (design §14.1 left it open):** robots, facility levels and the final Saving Goal must match the approved tables exactly; credits within ₡15,000 (0.5% of ₡3,000,000), because the tables' attribute figures are estimates.

Placement and tooling:

- **ACC deploy step "Sync Automaton catalogue" runs after the seed** instead of directly after `prisma migrate deploy` (design §15.3). Reason: Catalogue_Sync validates weapon names against the seeded `weapons` table. Still after migrate (R10.6).
- **Season_Rollover persistence test (7.4) runs in the heavy tier**, not integration as VC3's prose says; VC4 runs it.
- **I1 property test lives in `src/utils/__tests__/`** beside its helper, not in `services/automaton/__tests__/`.
- **`tsconfig.json` excludes `src/**/__tests__/**` from the build.** Reason: a test helper imports `prisma/seed`, which broke `tsc`; `typecheck:tests` still checks it.
- **Workflow change.** The Playwright steps in `ci.yml` and `deploy.yml` gained `DATABASE_URL` for the e2e teardown (decision 43); no gate, timeout or job dependency changed.

Frontend:

- **Badge background (design §18 `bg-info/15`)** is an opaque 15% `info` tint over the page background. Reason: the translucent tint gives 4.01:1 / 3.45:1 and fails R12.1's 4.5:1; the opaque one gives 4.85:1. Design §18 is updated.
- **Hall of Records badge on every record that names a stable (decision 42)**, wider than the original §1 table. Player-visible; approved 10 Oct 2026. Covered by Vitest and integration tests, not Playwright, because a local e2e Automaton does not reliably top a record list.
- **Battle report at 320 px scrolls by 8 px** because of the pre-existing `ArenaCanvas` 300 px minimum (outside spec 55). The badge surfaces themselves do not overflow at any width.

Pre-existing fix included on this branch:

- **Duplicate achievement-unlock attempts (outside spec 55, product owner's request).** Concurrent achievement checks for one stable in team tournament, KotH and Grand Melee battles raced on `user_achievements_user_id_achievement_id_key` (caught, but logged as `prisma:error`). `achievementService.checkAndAward` now runs one check at a time per stable; rewards and pairing unchanged. Commit e78a68ae.

Not changed on this branch:

- **"Glass" and other names with a profane substring.** The catalogue stable-name rule reuses `validateStableName`; its substring match is fixed on `bugfix/profanity-whole-word-matching`. None of the 11 starter names is affected.
- **`calculateDiscountedUpgradeCost`** (frontend onboarding preview) differs by ₡1 from the charged cost on 926 of 5,460 pairs. Pre-existing; Automaton pricing uses the charged formula.
