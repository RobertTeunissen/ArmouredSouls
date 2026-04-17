Cp# Tasks: Tuning Pool (Tactical Tuning)

## Task Group 1: Facility Configuration & Core Formulas

_Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 1.1 Add `tuning_bay` facility config to `FACILITY_TYPES` in `app/backend/src/config/facilities.ts` with: type `tuning_bay`, name "Tuning Bay", maxLevel 10, costs `[200000, 400000, 600000, 800000, 1000000, 1200000, 1400000, 1600000, 1800000, 2000000]` (standard `L1 × n` pattern), benefits array showing pool size and operating cost per level, prestige requirements `[0, 0, 1000, 0, 3000, 0, 5000, 0, 10000, 15000]`, and `implemented: true`. See design doc "Tuning Bay — Facility Specification" section for full config.
- [x] 1.2 Add `tuning_bay` operating cost case to `calculateFacilityOperatingCost()` in `app/backend/src/utils/economyCalculations.ts`: `return level * 300`.
- [x] 1.3 Create `app/backend/src/services/tuning-pool/tuningPoolConfig.ts` with pure functions: `getPoolSize(level)` returning `(level + 1) × 10` (L0=10, L10=110), `getPerAttributeMax(academyCap, baseValue)` returning `max(0, academyCap + 5 - baseValue)`, and the `ROBOT_ATTRIBUTES` constant array. Include JSDoc comments for all exports.
- [x] 1.4 Write unit tests in `app/backend/tests/unit/tuningPoolConfig.test.ts` covering: `getPoolSize` for levels 0–10 (verifying L0 returns 10, not 0) and edge cases, `getPerAttributeMax` for various academy cap and base value combinations (at cap, below cap, no academy). Include fast-check property tests for monotonicity and range constraints.

## Task Group 2: Database Schema

_Requirements: 2.1, 2.2, 2.3, 14.3_

- [x] 2.1 Add `TuningAllocation` model to `app/backend/prisma/schema.prisma` with: `id` (autoincrement PK), `robotId` (unique FK to Robot with onDelete Cascade), 23 Decimal(5,2) attribute columns defaulting to 0.00, `createdAt`, `updatedAt`, `@@index([robotId])`, and `@@map("tuning_allocations")`.
- [x] 2.2 Add the `tuningAllocation` relation field to the existing `Robot` model in the Prisma schema.
- [x] 2.3 Run `npx prisma migrate dev --name add_tuning_allocations` to generate and apply the migration.
- [x] 2.4 Run `npx prisma generate` to regenerate the Prisma client with the new model.

## Task Group 3: Tuning Pool Service

_Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.1, 7.2, 8.1, 8.3, 13.1, 13.2, 13.3, 14.1, 14.5_

- [x] 3.1 Create `app/backend/src/services/tuning-pool/tuningPoolService.ts` with: `getTuningAllocation(robotId, userId)`, `setTuningAllocation(robotId, userId, allocations)`, `getTuningBonuses(robotId)`, and `clearTuningAllocation(robotId)`. Include ownership verification, facility level lookup, pool budget validation, per-attribute max validation (academyCap + 5 - baseValue), and proportional scale-down on facility downgrade. `getTuningBonuses()` returns empty map when no allocation row exists (bots and unset robots get zero bonuses). Add JSDoc comments for all public functions.
- [x] 3.2 Create `app/backend/src/services/tuning-pool/index.ts` barrel export for the tuning-pool service module.
- [x] 3.3 Write unit tests in `app/backend/tests/unit/tuningPoolService.test.ts` covering: valid allocation, over-budget rejection, per-attribute max rejection, negative value rejection, ownership verification, proportional scale-down on facility downgrade, independent per-robot allocations, getTuningBonuses returning empty map when no allocation exists, and getTuningBonuses returning empty map for bot robots.

## Task Group 4: Combat Integration

_Requirements: 4.1, 4.2, 4.3, 4.4, 6.2_

- [x] 4.1 Modify `calculateEffectiveStats()` in `app/backend/src/utils/robotCalculations.ts` to accept an optional `tuningBonuses: TuningAttributeMap` parameter. When provided, add tuning bonuses to `(base + weaponBonus)` before applying loadout multipliers. When not provided, behaviour is unchanged (backward compatible).
- [x] 4.2 Update `calculateMaxHP()` and `calculateMaxShield()` in `robotCalculations.ts` to accept and pass through the optional `tuningBonuses` parameter.
- [x] 4.3 Update the frontend `calculateEffectiveStats()` in `app/frontend/src/utils/robotStats.ts` to accept an optional `tuningBonuses` parameter with the same formula, keeping frontend and backend stat calculations in sync.
- [x] 4.4 Update all battle orchestrator robot-loading paths to fetch tuning bonuses via `getTuningBonuses(robotId)` and pass them to `calculateEffectiveStats()`. Affected files: league orchestrator, tournament orchestrator, tag team orchestrator, KotH orchestrator.
- [x] 4.5 Write unit tests in `app/backend/tests/unit/tuningCombatIntegration.test.ts` covering: effective stats with tuning bonuses, tuning bonuses capped at academyCap + 5, maxHP/maxShield recalculation with tuning bonuses, backward compatibility (no tuning parameter = unchanged behaviour), and fast-check property test that effectiveStatWithTuning ≥ effectiveStatWithoutTuning for all attributes.

## Task Group 5: Practice Arena Integration

_Requirements: 5.1, 5.2, 5.3_

- [x] 5.1 Modify `buildOwnedRobot()` in `app/backend/src/services/practice-arena/practiceArenaService.ts` to load tuning bonuses via `getTuningBonuses(robotId)` and include them when calculating effective stats. Ensure what-if attribute overrides replace base attributes while tuning bonuses apply on top.
- [x] 5.2 Write unit test in `app/backend/tests/unit/tuningPracticeArena.test.ts` verifying: tuning bonuses are included in practice battle robot stats, and what-if overrides compose correctly with tuning bonuses.
- [x] 5.3 Update `app/frontend/src/components/practice-arena/WhatIfPanel.tsx` to display the robot's current tuning allocation as a read-only summary (e.g., "Tuning: +3 Combat Power, +5 Armor Plating") when the robot has non-zero tuning.
- [x] 5.4 Update `app/frontend/src/components/practice-arena/BattleSlotPanel.tsx` to fetch the robot's tuning allocation via GET `/api/robots/:id/tuning-allocation` when an owned robot is selected, and pass it to the WhatIfPanel for display.

## Task Group 6: API Route

_Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.1, 8.2, 8.3, 8.4, 14.2_

- [x] 6.1 Create `app/backend/src/routes/tuningAllocation.ts` with GET and PUT endpoints for `/api/robots/:id/tuning-allocation`. Include Zod schemas for request validation (only known `RobotAttribute` keys, values as numbers with ≤ 2 decimal places in range 0.00–55.00, unknown keys stripped) using `validateRequest` middleware, `authenticateToken` middleware, and ownership verification. Route handlers should be thin wrappers calling `TuningPoolService`.
- [x] 6.2 Register the tuning allocation router in the main Express app (`app/backend/src/index.ts` or route registration file).
- [x] 6.3 Write API integration tests in `app/backend/tests/integration/tuningAllocationApi.test.ts` covering: GET returns correct state (including base pool of 10 for players without facility), PUT saves and returns updated state, PUT rejects over-budget, PUT rejects per-attribute max exceeded (academyCap + 5), PUT rejects non-owner with generic 403, PUT rejects invalid attribute names, PUT rejects values with > 2 decimal places, PUT strips unknown keys.

## Task Group 7: Frontend — Tuning Tab & Stats Update

_Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2_

- [x] 7.1 Create `app/frontend/src/components/TuningPoolEditor.tsx` component with: budget bar (allocated/poolSize with teal fill), attribute sliders grouped by category (reusing `attributeCategories` and `categoryColors` from UpgradePlanner), per-attribute row showing icon, name, slider (0 to perAttributeMax), allocation value in teal, and effective preview (base → base+tuning). Include Reset All button with confirmation and Save Tuning button. Fetch state via GET `/api/robots/:id/tuning-allocation`, save via PUT.
- [x] 7.2 Add "Tuning" tab to `app/frontend/src/components/TabNavigation.tsx` and reorder tabs to: Overview | Matches | Upgrades | Tuning | Battle Config | Stats | Analytics. The Tuning tab uses a teal accent color and ⚙️ icon. Visible to robot owners only.
- [x] 7.3 Wire the TuningPoolEditor into `app/frontend/src/pages/RobotDetailPage.tsx` under the new Tuning tab, passing robot data and facility level.
- [x] 7.4 Update `app/frontend/src/components/EffectiveStatsDisplay.tsx` to include tuning bonuses in the stat breakdown. Fetch tuning allocation for the robot and show the tuning contribution in teal in the expanded attribute detail: `base + tuning + weapon + loadout + stance = effective`.
- [x] 7.5 Add upsell section at the bottom of TuningPoolEditor: if player has no Tuning Bay or is below L10, show current pool size, what next level gives, and a link to the Facilities page.
- [x] 7.6 Write component tests for TuningPoolEditor covering: renders with correct pool size, slider updates allocation, budget bar reflects changes, save button calls API, reset clears all sliders, per-attribute max enforced on sliders.

## Task Group 8: Onboarding & Facility Category

_Requirements: 11.1, 11.2, 11.3, 12.1, 12.2_

- [x] 8.1 Update the onboarding flow to auto-allocate 10 tuning points for each robot created during onboarding, distributing points proportionally into the same attributes the robot's equipped weapon boosts. Add a brief callout message: "Your engineering team has tuned your robot to complement its weapon loadout. You can adjust your tuning before every battle on the Tuning tab." Do NOT add Tuning Bay to the onboarding facility purchase options in Step2.
- [x] 8.2 Rename the "Advanced Features" facility category to "Tactical & Advanced" and add `tuning_bay` to its `facilityTypes` array in both `app/frontend/src/components/facilities/constants.ts` and `app/frontend/src/utils/facilityCategories.ts`.

## Task Group 9: Documentation Updates

_Requirements: 14.1, 14.4, 14.5, 14.6, 14.7_

- [x] 9.1 Update `app/backend/src/config/facilities.ts` inline comment from "14 facilities" to "15 facilities".
- [x] 9.2 Create `docs/game-systems/TUNING_BAY_SYSTEM.md` describing: overview, Tuning Bay facility configuration, pool size table, allocation rules (budget, per-attribute max based on academy cap + 5), combat integration formula `(base + weapon + tuning) × loadout`, launch behaviour (bots get no tuning, unset = zero), and interaction with other systems (practice arena, tag team, KotH).
- [x] 9.3 Update `docs/BACKLOG.md` item #9 to mark as specced/implemented with a reference to spec #25.
- [x] 9.4 Update `docs/analysis/GAME_LOOP_1_CORE_LOOP_EXPLORATION.md` to note that the tuning pool system has been specced as spec #25.
- [x] 9.5 Update `docs/game-systems/STABLE_SYSTEM.md` to add Tuning Bay to the facility list with operating costs and pool size table.
- [x] 9.6 Update `.kiro/steering/project-overview.md` "Key Systems" section to reflect 15 facility types (was 14).
- [x] 9.7 Create in-game guide article `app/backend/src/content/guide/facilities/tuning-bay.md` with frontmatter describing the Tuning Bay facility: what it does, pool size per level table, operating costs, and prestige requirements.
- [x] 9.8 Create in-game guide article `app/backend/src/content/guide/strategy/tactical-tuning.md` with frontmatter describing: how to allocate tuning points, strategy tips (focus vs spread, adapting for KotH vs league matchups), and how to use the Practice Arena to test allocations.
- [x] 9.9 Update `app/backend/src/content/guide/combat/battle-flow.md` to mention tuning bonuses as a third additive term in the effective stats formula alongside base attributes and weapon bonuses.
- [x] 9.10 Update `app/backend/src/content/guide/robots/attributes-overview.md` to add tuning pool allocation as a source of attribute points: base level, weapon bonuses, and tuning pool (tactical tuning via Tuning Bay).
- [x] 9.11 Update `app/backend/src/content/guide/facilities/facility-overview.md` to add Tuning Bay to the facility list with a brief description.
- [x] 9.12 Update `app/backend/src/content/guide/strategy/build-archetypes.md` to mention tuning allocation as a tactical layer that lets players adapt their archetype per-matchup.

## Task Group 10: Verification

_Requirements: All_

- [x] 10.1 Run the full backend test suite (`npm test` in `app/backend/`) and verify all existing tests still pass (no regressions).
- [x] 10.2 Run all tuning-pool-specific tests (`npx jest --testPathPattern="tuning"`) and verify they pass.
- [x] 10.3 Run the verification criteria from the requirements document: confirm facility config exists, Prisma model exists, service files exist, API route exists, combat integration exists, operating cost formula exists, frontend component exists, and facility category updated.
- [x] 10.4 Create E2E test `app/frontend/tests/e2e/tuning-bay.spec.ts` covering: navigate to robot detail page → click Tuning tab → verify budget bar shows "0 / 10 allocated" → drag a slider to allocate points → click Save → reload page → verify allocation persisted. Use the existing `test_user_001` auth state.
- [x] 10.5 Verify existing E2E tests still pass: run `npx playwright test critical-journey onboarding practice-arena` and confirm no regressions from the tab reorder or onboarding changes.
