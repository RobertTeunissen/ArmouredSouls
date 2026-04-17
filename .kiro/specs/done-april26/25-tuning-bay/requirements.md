# Requirements: Tuning Pool (Tactical Tuning)

## Expected Contribution

This spec delivers the highest-impact improvement to the game's Core Loop (Configure → Battle → Results → Adjust), transforming the currently thin "Adjust" step into a meaningful per-battle tactical decision. It directly addresses Backlog item #9 (Flex-Point Attribute Bucket) and the findings from the Core Loop Exploration analysis (`docs/analysis/GAME_LOOP_1_CORE_LOOP_EXPLORATION.md`).

1. **Per-battle decision depth**: Before this spec, the only regular per-battle decisions are stance (3 options) and yield threshold (0–50 slider). After, players have 23 attribute sliders with a meaningful point budget to allocate — increasing the decision space from ~150 combinations to effectively unlimited tactical configurations.

2. **New facility investment path**: Adds the 15th facility type (Tuning Bay) to the existing 14, creating a new credit sink and progression goal. Players at endgame with maxed academies gain a new reason to invest credits and manage operating costs.

3. **Combat system integration**: Tuning bonuses integrate into the existing `(base + weapon) × loadout` formula as a third additive term, adding depth without changing the combat simulator's core logic. Before: 2 additive terms. After: 3 additive terms with the same multiplicative structure.

4. **Persistent tactical configuration**: Tuning allocations persist until the player changes them — no decay, no forced re-engagement. Players who study their opponents and reallocate before tough matchups get an edge. Players who set it once and leave it still benefit. The engagement driver is voluntary (opponent changes every match) not mechanical (forced reset).

5. **Database footprint**: One new table (`tuning_allocations`) with one row per robot that has an active tuning allocation. The existing `Facility` table handles the Tuning Bay level (no schema change needed for that). At current scale (~517 robots, ~20 player-owned), only player robots get tuning rows — bots created by the cycle system don't. Robot count grows ~36/day from bot creation, but tuning allocation rows only grow with player robots. Keeping tuning data in a separate table avoids adding 23 columns to the Robot model where 95%+ of rows (bots) would be all zeros.

6. **Code footprint**: ~2 new service files, ~1 new route file, ~1 Prisma migration, ~1 new frontend component, modifications to ~6 existing files (`robotCalculations.ts`, `facilities.ts`, `economyCalculations.ts`, `EffectiveStatsDisplay.tsx`, `TabNavigation.tsx`, battle orchestrators).

### Verification Criteria

After all tasks are complete, run these checks to confirm the spec delivered:

1. `grep -r "tuning_bay" app/backend/src/config/facilities.ts` — facility config exists
2. `grep -r "TuningAllocation" app/backend/prisma/schema.prisma` — Prisma model exists
3. `grep -r "tuningPoolService\|TuningPoolService" app/backend/src/services/tuning-pool/` — service files exist
4. `grep -r "tuning-allocation" app/backend/src/routes/` — API route exists
5. `npx jest --testPathPattern="tuning" --passWithNoTests` — all tuning pool tests pass
6. `grep -r "getTuningBonuses\|tuningBonuses" app/backend/src/utils/robotCalculations.ts` — combat integration exists
7. `grep -r "tuning_bay" app/backend/src/utils/economyCalculations.ts` — operating cost formula exists
8. `grep -r "TuningPoolEditor" app/frontend/src/components/` — frontend component exists
9. `grep -r "Tactical & Advanced" app/frontend/src/components/facilities/constants.ts` — facility category updated

## Requirements

### Requirement 1: Tuning Bay Facility

The system must introduce a new facility type that increases the tuning pool size beyond the free base pool.

**Acceptance Criteria:**

- 1.1 A new facility with type `tuning_bay`, name "Tuning Bay", maxLevel 10, is added to `FACILITY_TYPES` in `config/facilities.ts` with: costs array `[200000, 400000, 600000, 800000, 1000000, 1200000, 1400000, 1600000, 1800000, 2000000]` (standard `L1 × n` pattern), benefits descriptions showing pool size and operating cost per level, prestige requirements `[0, 0, 1000, 0, 3000, 0, 5000, 0, 10000, 15000]`, and `implemented: true`.
- 1.2 `getPoolSize(level)` returns `(level + 1) × 10` for levels 0–10. Level 0 (no facility) returns 10 — every player gets a base tuning pool. Level 10 returns 110. The function is deterministic and pure.
- 1.3 `getPerAttributeMax(academyCap, baseValue)` returns `max(0, academyCap + 5 - baseValue)`. The per-attribute cap is dynamic: it depends on the robot's academy cap for that attribute category and the robot's current base value.
- 1.4 `calculateFacilityOperatingCost('tuning_bay', level)` returns `level × 300` for levels 1–10 (₡300/day at L1, ₡3,000/day at L10).

### Requirement 2: Tuning Allocation Data Model

The system must store per-robot tuning point allocations in a dedicated database table.

**Acceptance Criteria:**

- 2.1 A `TuningAllocation` Prisma model exists with: `id` (autoincrement PK), `robotId` (unique FK to Robot), 23 Decimal(5,2) columns (one per robot attribute, all defaulting to 0.00), `createdAt`, and `updatedAt`.
- 2.2 The `robotId` FK has `onDelete: Cascade` so deleting a robot automatically removes its tuning allocation.
- 2.3 The table has an index on `robotId` for efficient lookup during combat resolution.

### Requirement 3: Tuning Allocation API

The system must expose API endpoints for reading and updating a robot's tuning allocation.

**Acceptance Criteria:**

- 3.1 `GET /api/robots/:id/tuning-allocation` returns a `TuningAllocationState` object containing: `robotId`, `facilityLevel`, `poolSize`, `allocated` (sum of current allocations), `remaining` (poolSize - allocated), `perAttributeMaxes` (map of attribute → max tuning for that attribute based on academy cap + 5 - base), and `allocations` (map of attribute → value for non-zero allocations).
- 3.2 `PUT /api/robots/:id/tuning-allocation` accepts a `TuningAttributeMap` body (partial record of attribute names to numeric values), validates constraints, persists the allocation, and returns the updated `TuningAllocationState`.
- 3.3 The PUT endpoint returns HTTP 400 with error code `VALIDATION_ERROR` when the sum of all allocation values exceeds the pool size for the user's facility level (or the base pool of 10 if no facility).
- 3.4 The PUT endpoint returns HTTP 400 with error code `VALIDATION_ERROR` when any single attribute's tuning allocation would cause `base + tuning > academyCap + 5` for that attribute's category.
- 3.5 Both endpoints verify robot ownership via `verifyRobotOwnership()` before any data access or mutation, returning HTTP 403 for non-owners.
- 3.6 The PUT endpoint uses Zod schema validation via `validateRequest` middleware, accepting only valid `RobotAttribute` keys and numeric values ≥ 0.

### Requirement 4: Combat Integration

Tuning bonuses must be included in the effective stat calculation used by the combat simulator and all battle orchestrators.

**Acceptance Criteria:**

- 4.1 The effective stat formula becomes `(base + weaponBonus + tuningBonus) × loadoutMultiplier`, where `tuningBonus` is the robot's current tuning allocation for that attribute (0 if no allocation exists).
- 4.2 Tuning-boosted effective stats are capped at `academyCap + 5` per attribute. A robot at academy cap 15 with 5 tuning points has an effective base of 20 (before weapon/loadout modifiers). A robot at academy cap 15 cannot tune beyond 20 regardless of pool size.
- 4.3 When tuning bonuses affect `hullIntegrity` or `shieldCapacity`, `maxHP` and `maxShield` are recalculated using the tuning-boosted effective stats.
- 4.4 All battle orchestrators (league, tournament, tag team, KotH) include tuning bonuses when loading robots for combat, using the same integration point in `robotCalculations.ts`.

### Requirement 5: Practice Arena Integration

The Practice Arena must include tuning bonuses when loading owned robots for practice battles, and show the tuning state in the UI.

**Acceptance Criteria:**

- 5.1 When `buildOwnedRobot()` loads an owned robot for a practice battle, the robot's tuning bonuses are included in its effective stats.
- 5.2 What-if attribute overrides replace the robot's base attributes; tuning bonuses are applied on top of the overridden base values (not the original base values).
- 5.3 The WhatIfPanel displays the robot's current tuning allocation as a read-only summary when the robot has non-zero tuning.

### Requirement 6: Per-Robot Independence

Each robot must have its own independent tuning allocation that does not affect other robots.

**Acceptance Criteria:**

- 6.1 Each robot has its own tuning allocation row. Allocating points for robot A does not modify robot B's allocation or available pool.
- 6.2 In Tag Team battles, both the active and reserve robots have their own tuning allocations applied independently in combat.

### Requirement 7: Economy Integration

The Tuning Bay must integrate with the existing economy system.

**Acceptance Criteria:**

- 7.1 `calculateFacilityOperatingCost('tuning_bay', level)` returns a daily operating cost that scales with level, following the pattern of existing facilities.
- 7.2 If a player's facility level decreases (e.g., future reset mechanic) and their current tuning allocations exceed the new pool size, the system proportionally scales down all allocations to fit the new pool size on the next read.

### Requirement 8: Security

All tuning allocation endpoints must enforce server-side validation and follow existing security patterns.

**Acceptance Criteria:**

- 8.1 All constraint validation (pool budget, per-attribute max, attribute name whitelist, non-negative values) is enforced server-side. Frontend validation is for UX only and is not trusted.
- 8.2 The Zod schema for the PUT endpoint validates: only known `RobotAttribute` keys are accepted, values are numbers with at most 2 decimal places, values are in range `0.00–55.00`, and unknown keys are stripped.
- 8.3 Pool size is calculated from the player's actual facility level read from the database, never from client-provided values.
- 8.4 Ownership verification returns a generic 403 for non-owners — never reveals whether the robot exists to unauthorized users.

### Requirement 9: Frontend — Tuning Tab

The Robot Detail Page must have a dedicated Tuning tab for managing tuning point allocations.

**Acceptance Criteria:**

- 9.1 A "Tuning" tab exists on the Robot Detail Page between "Upgrades" and "Battle Config", creating the pipeline: Upgrades → Tuning → Battle Config → Stats.
- 9.2 The Tuning tab displays a budget bar showing allocated/poolSize, attribute sliders grouped by category, and per-attribute effective preview (base → base + tuning).
- 9.3 The Tuning tab uses teal (`#14b8a6`) as its accent color to distinguish it from the Upgrades tab (category colors) and Battle Config tab (blue).
- 9.4 The Tuning tab is visible to all robot owners, including those without a Tuning Bay facility (base pool of 10).
- 9.5 An upsell section at the bottom shows the current pool size and what the next Tuning Bay level would give, with a link to the Facilities page.

### Requirement 10: Frontend — Stats Tab Update

The EffectiveStatsDisplay must show tuning bonuses in the stat breakdown.

**Acceptance Criteria:**

- 10.1 The Stats tab shows the full breakdown: `base + tuning + weapon + loadout + stance = effective`.
- 10.2 The tuning contribution is displayed in teal, consistent with the Tuning tab's accent color.

### Requirement 11: Onboarding — Auto-Allocation

New players' robots must receive an automatic tuning allocation during onboarding.

**Acceptance Criteria:**

- 11.1 During onboarding, after a robot is created and a weapon is equipped, the system auto-allocates 10 tuning points proportionally into the same attributes the equipped weapon boosts.
- 11.2 A brief callout informs the player: "Your engineering team has tuned your robot to complement its weapon loadout. You can adjust your tuning before every battle on the Tuning tab."
- 11.3 The Tuning Bay facility is NOT added to the onboarding facility purchase options.

### Requirement 12: Facility Category Update

The Tuning Bay must be placed in the correct facility category.

**Acceptance Criteria:**

- 12.1 The "Advanced Features" facility category is renamed to "Tactical & Advanced" in both `components/facilities/constants.ts` and `utils/facilityCategories.ts`.
- 12.2 `tuning_bay` is added to the "Tactical & Advanced" category's `facilityTypes` array.

### Requirement 13: Launch Behaviour

The system must handle existing robots and bots correctly on launch.

**Acceptance Criteria:**

- 13.1 Existing player robots with no `TuningAllocation` row fight with zero tuning bonuses — identical to pre-launch behaviour. No data migration needed.
- 13.2 System bots (WimpBot, AverageBot, ExpertBot) never receive tuning allocations and fight with zero tuning bonuses.
- 13.3 A robot with no tuning allocation (or all zeros) fights at exactly its current power level — no penalty for not engaging with the system.

### Requirement 14: Documentation and Code Organization

New code must follow project conventions and be properly documented.

**Acceptance Criteria:**

- 14.1 The `TuningPoolService` is located at `services/tuning-pool/tuningPoolService.ts` following the project's domain-based service organization.
- 14.2 The API route is located at `routes/tuningAllocation.ts` with Zod validation schemas.
- 14.3 A Prisma migration creates the `tuning_allocations` table with all required columns and constraints.
- 14.4 The `config/facilities.ts` file is updated with the Tuning Bay facility configuration.
- 14.5 JSDoc comments document all public functions in the new service modules.
- 14.6 In-game guide articles are created/updated for the Tuning Bay facility and tactical tuning strategy.
- 14.7 Game system documentation (`TUNING_BAY_SYSTEM.md`, `STABLE_SYSTEM.md`) is created/updated.
