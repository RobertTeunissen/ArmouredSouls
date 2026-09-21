# Implementation Plan: Generated Stable Upgrade Strategies

## Overview

This implementation plan delivers the Generated_Stable_Maintenance_Program through profile-driven seeding, deterministic balance-funded maintenance, settlement integration, financial and repair boundaries, lifecycle handling, admin controls, UI behavior, testing, documentation, and aggregate verification.

## Tasks

## Task Group 1: Generated identity, profiles, and seed lifecycle

_Requirements: R1.1–R1.5, R2.1–R2.10_

- [ ] 1.1 Define the server-owned `Maintenance_Profile` contract and versioning rules for `Solo_Specialist`, `Pair_Team`, and `Trio_Formation`, linking each initial `Seed_Strategy` to a separately versioned `Growth_Strategy` with seed cardinality, subscriptions, opening values, allowed growth mechanisms, reserve, pacing caps, cooldown, and priority order; do not define a fixed final roster or target count.
- [ ] 1.2 Add season-owned profile assignment state or an equivalent deterministic assignment record that is valid only when `User.isGenerated = true`, stores the selected seed strategy, initial robot count, growth-strategy key and version, and active season, and is removed with generated accounts at `Season_Rollover`.
- [ ] 1.3 Implement the idempotent `Seed_Operation` preview and lifecycle-boundary execution for exact `Solo_Specialist`, `Pair_Team`, and `Trio_Formation` initial 1/2/3-robot seed forms only, including profile validation, stable/robot/team/subscription prerequisites, deterministic `(season, profile, ordinal)` identities, and opening-boundary asset initialization; keep later growth actions separate and idempotent.
- [ ] 1.4 Preserve the existing generic generated-user path for accounts without a maintained assignment and ensure no username-prefix classifier is introduced.
- [ ] 1.5 Add seed rejection tests for invalid counts, invalid profile versions, stale seasons, invalid team/subscription combinations, duplicate ordinals, and partial transaction failure.

## Task Group 2: deterministic maintenance policy, affordability, and pacing

_Requirements: R4.1–R4.8, R1.3–R1.4, R2.2–R2.3, R2.7–R2.9_

- [ ] 2.1 Implement pure profile and stable-facts validation that fails closed for human rows, stale assignments, disabled profiles, malformed robot counts, invalid `Growth_Strategy` mechanisms/triggers/eligibility/priorities/caps, invalid action targets, and inconsistent current roster facts.
- [ ] 2.2 Implement pure `Reserve_Balance`, `Spendable_Balance`, and `Pacing_Cap` calculation from post-settlement balance and documented mandatory-cost inputs; never use `robots.repairQuoteCredits` as historical spend.
- [ ] 2.3 Implement deterministic candidate enumeration for strategy-allowed robot, facility, weapon, refinement, and optional `Robot_Acquisition` actions, applying priority ordering, triggers, eligibility, cooldown checks, one-action initial pacing, fixed/percentage/action-count caps, and typed skip reasons for zero budget or ineligible candidates.
- [ ] 2.4 Implement immutable plan hashing and actual-cost verification so a changed validated cost aborts rather than overspending or partially applying an action.
- [ ] 2.5 Add unit tests for zero, exact-reserve, one-credit-over-reserve, cap, percentage-cap, unaffordable, disabled, cooldown, and large-balance cases across all three profiles; cover at least two distinct ordered growth mechanism lists, acquisition enabled and omitted, and a permitted roster growing beyond its initial seed cardinality.

## Task Group 3: settlement integration and cycle-close ordering

_Requirements: R3.1–R3.7, R6.1–R6.8_

- [ ] 3.1 Integrate maintenance into `Settlement_Service` inside the per-stable transaction after `passive_income` and `operating_costs` and before `cycle_end_balance`, reusing the existing user lock and mutable-state re-read; require the final `Competitive_Phase` settlement to complete all applicable settlement components and maintenance before `Season_Rollover` may begin.
- [ ] 3.2 Ensure all selected maintenance actions, settlement components, domain state, financial evidence, and maintenance evidence commit or roll back as one stable transaction, including the final-cycle close evidence needed by rollover.
- [ ] 3.3 Route both scheduled settlement in `cycleScheduler.ts` and admin bulk settlement in `adminCycleService.ts` through the same maintenance-aware settlement path; remove or prevent any post-close growth-action path and block rollover until the final settlement is complete.
- [ ] 3.4 Preserve `Preparation_Phase` early-return behavior so no financial components, maintenance actions, competitive cycle increments, snapshots, or close evidence are written during preparation.
- [ ] 3.5 Ensure `Serialized_Cycle_Cutover` watermark handling excludes generated accounts seeded after close from the current cycle and prevents maintenance after cycle completion or after the final close boundary.
- [ ] 3.6 Include maintenance spend in closing balance, `cycle_end_balance`, cycle snapshot metrics, totals-only settlement output, and stable-level summaries without retaining unbounded per-user results.
- [ ] 3.7 Add ordering, final-settlement-before-`Season_Rollover`, scheduled/admin race, post-watermark seed, and settlement-failure tests.

## Task Group 4: growth-action domain adapters, financial evidence, and repair boundary

_Requirements: R5.1–R5.8, R4.8_

- [ ] 4.1 Add maintenance adapters for approved attribute, facility, weapon, refinement, and `Robot_Acquisition` growth actions, delegating validation and mutation to existing domain services, including the existing robot-creation/domain validation path rather than duplicating formulas.
- [ ] 4.2 Generate deterministic `Maintenance_Identity` values containing season, cycle, stable, profile version, action ordinal, kind, and target; reject conflicting identity reuse.
- [ ] 4.3 Route every charge through `Credit_Mutation_Service` with only `attribute_upgrade`, `facility_upgrade`, `weapon_purchase`, `weapon_refinement`, or `robot_creation`, and persist the required typed financial breakdown and `Financial_Pair`.
- [ ] 4.4 Add the maintenance domain audit/record needed to explain plan, target, spend, reserve, cap, before/after balance, and skip/error outcome without creating a second balance source.
- [ ] 4.5 Enforce that maintained generated stables cannot invoke `Manual_Repair` for any growth action; preserve normal `Automatic_Repair` scheduling, subtype-bearing `robot_repair` evidence, and repair-source separation as a separate concern.
- [ ] 4.6 Add retry, unique-race, conflicting-facts, pair-failure, rollback, direct-writer, taxonomy, repair-source separation, and no-`Manual_Repair`-for-any-growth-action tests; verify no `subscription_cost`, `prestige_award`, or `settlement_adjustment` is emitted.

## Task Group 5: Season_Rollover preservation and archive behavior

_Requirements: R6.1–R6.8, R2.3–R2.4, R2.6, R2.9–R2.10_

- [ ] 5.1 Implement complete `Generated_Stable_Archive` persistence for every generated stable before removing that stable’s live account or any associated live season state; include profile identity/version, initial `Seed_Strategy` and cardinality (1/2/3), the complete resulting roster including acquired robots, opening and closing balances, robots, weapons, facilities, assignments, maintenance records/evidence, competitive records, economic records, and archive provenance, then verify the archive is durable and complete before deletion proceeds.
- [ ] 5.2 Preserve archive-failure safety: if complete archive persistence or verification fails, retain the affected live generated account and all live season-owned state, perform no partial removal and no `Human_Stable` reset for it, report a retryable rollover failure, and keep historical reporting able to source the complete archived state after successful rollover.
- [ ] 5.3 Apply the existing `Human_Stable` reset contract separately from generated archive/removal, then trigger and implement fresh post-rollover `Seed_Operation` seeding from exactly `Solo_Specialist`, `Pair_Team`, and `Trio_Formation` with approved opening currency/assets, exact 1/2/3 initial robot rosters, new account/resource IDs, new-season assignments, and new `Maintenance_Identity` values; later growth remains policy-driven and does not impose a fixed final roster, and prior-season balances, growth actions, live IDs, or live state never carry forward.
- [ ] 5.4 Add lifecycle orchestration for final-settlement completion, archive-before-removal, archive-backed historical reporting, approved new-season seeding, and idempotent rollover/seed retries so concurrent or repeated operations produce one archive, removal, human reset, and fresh seed result per applicable identity.

## Task Group 6: Admin_Maintenance_Control backend and operational observability

_Requirements: R7.1–R7.10, R5.6–R5.7_

- [ ] 6.1 Add authenticated, schema-validated admin endpoints/services for program status, seed-strategy and `Growth_Strategy` configuration, seed preview, lifecycle-boundary seed confirmation, next-settlement dry-run, and profile disable; expose active versions and allowed growth mechanism counts without permitting off-cycle growth actions.
- [ ] 6.2 Explicitly omit any `runUpgradeNow` route and reject requests that attempt to mutate generated growth actions outside the serialized settlement path, including direct `Robot_Acquisition` execution.
- [ ] 6.3 Record admin audit evidence for actor, operation, season, profile/version, assigned `Growth_Strategy` key/version, requested counts/caps, configured growth mechanism counts, preview/confirmation result, and failure reason.
- [ ] 6.4 Add generated-only settlement/admin metrics for considered/skipped counts, upgraded/growth-action counts, 1/2/3 profile variants, `Growth_Strategy` versions, growth mechanism counts, action kinds including `Robot_Acquisition`, resulting roster counts, spend, reserve blocks, invalid profiles, balance ranges, duration, and integrity alerts.
- [ ] 6.5 Ensure analytics use `User.isGenerated` for real/auto/all filtering, including regression coverage for human usernames that resemble bot prefixes and reporting of resulting roster counts.
- [ ] 6.6 Add fail-closed alerts for human selection, invalid assignment, manual repair attempt, direct balance writer, off-cycle growth action, cap/reserve violation, conflicting identity, population-count drift, and settlement performance regressions.

## Task Group 7: Admin UI and mobile behavior

_Requirements: R7.1–R7.2, R7.6, R7.8_

- [ ] 7.1 Add the admin generated-maintenance status/configuration/preview surface using existing admin layout and shared components, with clear distinction between seed-strategy configuration, versioned `Growth_Strategy` mechanisms, preview, and settlement-only growth-action execution.
- [ ] 7.2 Render profile cards/tables, `Growth_Strategy` versions and mechanism counts, and seed/preview results as desktop tabs at ≥1024px and stacked sections below 1024px, following `.kiro/steering/frontend-standards.md`’s responsive tab pattern down to 320px.
- [ ] 7.3 Add keyboard-accessible controls, visible validation/error states, no-horizontal-overflow layout, touch targets of at least 44px, resulting roster counts, and no off-cycle growth-action control.
- [ ] 7.4 Add frontend tests at 320px, 768px, and 1024px for stacked/tabbed layout, controls, no off-cycle growth action, `Growth_Strategy` and `Robot_Acquisition` metrics, resulting roster counts, and generated-only metrics.

## Task Group 8: unit and property-based test coverage

_Requirements: R8.1–R8.2, R1.1–R1.5, R2.1–R2.10, R4.1–R4.8, R5.4–R5.6_

- [ ] 8.1 Add backend unit tests for profile and `Growth_Strategy` validation, seed cardinality, distinct ordered mechanism lists, candidate ordering, budget/cap calculation, skip reasons, plan hashing, identity construction, acquisition prerequisites and `robot_creation` taxonomy, permitted roster growth beyond seed cardinality, no fixed final roster assumption, and manual-repair rejection.
- [ ] 8.2 Add fast-check property tests for reserve safety, no overdraft, cap/action limits, deterministic plans, distinct strategy ordering, acquisition enabled/omitted, valid acquisition prerequisites/taxonomy, roster growth beyond initial cardinality, human/generated separation, zero-action missing assignment, no fixed final roster assumption, and quote non-source behavior.
- [ ] 8.3 Add fast-check retry generators covering successful replay, transaction failure/retry, unique-identity race, conflicting immutable facts, acquisition prerequisites and `robot_creation`, and season/phase transitions, including archive-before-removal and fresh-seed identity isolation.
- [ ] 8.4 Ensure all new tests are assigned to exactly one mandatory backend tier and are included in `pnpm run test:tiers:verify`.

## Task Group 9: integration and heavy validation

_Requirements: R3.1–R3.7, R5.1–R5.8, R6.1–R6.8, R7.4–R7.5, R8.3–R8.4_

- [ ] 9.1 Add PostgreSQL integration coverage for settlement ordering, paired financial rows, closing-balance inclusion, atomic rollback, scheduled/admin serialization, no same-cycle post-watermark maintenance, preparation no-op, and final competitive settlement completion before `Season_Rollover`, including all permitted growth actions and `robot_creation` evidence.
- [ ] 9.2 Add integration coverage for all three exact initial seed strategies, at least two distinct ordered `Growth_Strategy` mechanism lists, enabled and omitted `Robot_Acquisition`, acquisition domain prerequisites and `robot_creation` taxonomy, automatic repair versus manual-repair rejection, generated/human analytics filters, admin preview/confirm authorization, profile disabling, and resulting roster reporting without a fixed final roster assumption.
- [ ] 9.3 Add heavy multi-cycle coverage for population counts, bounded spend/progression, no duplicate `Maintenance_Identity`, all profile and strategy variants, enabled/omitted acquisition, valid acquisition prerequisites, roster growth beyond initial 1/2/3 seed cardinality, no fixed final roster assumption, final-cycle rollover, complete archive contents before each live generated stable is removed, archive failure preservation with no human reset, archive-backed historical reporting, fresh post-rollover reseeding with new account/resource IDs and assignments, and idempotent rollover/seed retries.
- [ ] 9.4 Run backend lint, build, test typecheck, tier verification, unit, integration, and heavy gates without advisory bypasses; run frontend lint/build/unit and responsive tests for the `Admin_Maintenance_Control` UI.

## Task Group 10: Documentation_Contract updates

_Requirements: R8.5, R1.1–R1.5, R2.1–R2.10, R3.1–R3.7, R4.1–R4.8, R5.1–R5.8, R6.1–R6.8, R7.1–R7.10_

- [ ] 10.1 Update `.kiro/steering/project-overview.md` with the `Generated_Stable_Maintenance_Program`, `User.isGenerated` lifecycle boundary, separate 1/2/3 initial `Seed_Strategy` forms and versioned `Growth_Strategy` assignments, optional `Robot_Acquisition`, settlement-only growth actions, resulting-roster reporting without a fixed final roster, archive-before-removal behavior, fresh post-rollover reseeding, and operator-guide link.
- [ ] 10.2 Update `.kiro/steering/testing-strategy.md` with mandatory unit/property/integration/heavy coverage for distinct ordered growth strategies, enabled/omitted `Robot_Acquisition`, acquisition prerequisites and `robot_creation`, roster growth beyond initial cardinality without a fixed final roster, generated-stable tier placement, archive-failure preservation tests, archive-backed history tests, and fresh-reseed/idempotency tests.
- [ ] 10.3 Update `.kiro/steering/monitoring-observability.md` and `.kiro/steering/coding-standards.md` with `Maintenance_Observability`, `Growth_Strategy` version and mechanism metrics, `Robot_Acquisition` and resulting-roster reporting, fail-closed alerts, `Credit_Mutation_Service` usage, reserve/cap rules, archive/removal lifecycle alerts, and no-`Manual_Repair`/direct-currency/off-cycle-growth boundaries.
- [ ] 10.4 Update `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md` with `Financial_Pair`/`Maintenance_Identity` evidence for every permitted growth action including `Robot_Acquisition`/`robot_creation`, `Opening_Balance_Boundary` treatment, repair-source separation, and the distinction between archived historical evidence and live current-economy records.
- [ ] 10.5 Update `docs/guides/ADMIN_PANEL_GUIDE.md` with `Admin_Maintenance_Control` endpoints, seed-vs-growth configuration, `Growth_Strategy` versions and mechanism counts, preview/confirm lifecycle boundary, optional acquisition and resulting-roster reporting, generated-only filters, disable behavior, archive/reseed observability, and responsive layout.
- [ ] 10.6 Update `docs/game-systems/PRD_CYCLE_SYSTEM.md`, `docs/game-systems/PRD_SEASON_SYSTEM.md`, and `docs/game-systems/PRD_ECONOMY_SYSTEM.md` with `Maintenance_Window` ordering, preparation skip, final settlement before `Season_Rollover`, complete `Generated_Stable_Archive` persistence before live removal, archive-failure preservation/no `Human_Stable` reset for the affected account, archive-backed history, fresh post-rollover seeding from exactly the three 1/2/3-robot initial forms with new state/IDs, separate versioned growth strategies with optional `Robot_Acquisition`, resulting-roster reporting, balance-funded pacing, and no fixed final roster or recurring stipend.
- [ ] 10.7 Create `docs/guides/GENERATED_STABLE_MAINTENANCE_GUIDE.md` as the operator guide for separate seed and growth profile definitions, versioned `Growth_Strategy` mechanisms, optional `Robot_Acquisition` and its prerequisites, seed lifecycle, final-settlement-before-rollover ordering, complete archive-before-removal and archive verification, archive-failure preservation, separate `Human_Stable` reset behavior, archive-backed historical reporting including resulting rosters, fresh post-rollover reseeding with exact 1/2/3 initial rosters and new identities, settlement-only growth actions, reserve/cap tuning, no-`Manual_Repair` behavior, troubleshooting, and rollback/disable procedures.
- [ ] 10.8 Update `docs/README.md` to index the new `Generated_Stable_Maintenance_Program` operator guide and its seed/growth separation, acquisition, roster, and lifecycle documentation.
- [ ] 10.9 Update `docs/architecture/PRD_SERVICE_DIRECTORY.md` with the concrete seed-profile catalog, separately versioned `Growth_Strategy` components, seeder, acquisition/domain adapters, maintenance policy, settlement integration, archive/removal and fresh-reseed lifecycle components, resulting-roster reporting, and test ownership once implementation module names are final.

## Task Group 11: aggregate verification gate

_Requirements: R8.6 and all acceptance criteria R1.1–R8.6_

- [ ] 11.1 Run the Expected Contribution verification grep for direct generated-maintenance balance writers and confirm all current-economy changes, including `Robot_Acquisition`, use `Credit_Mutation_Service`/`Settlement_Service` and taxonomy `robot_creation` where applicable.
- [ ] 11.2 Run backend unit/property, integration, and heavy commands from Verification Criteria and record actual pass/fail output; the results must explicitly verify distinct `Growth_Strategy` mechanisms, enabled/omitted `Robot_Acquisition`, acquisition prerequisites and `robot_creation` taxonomy, permitted roster expansion beyond initial 1/2/3 seed cardinality without a fixed final roster assumption, final settlement completion, complete archive persistence before live generated removal, archive-failure preservation/no human reset, archive-backed history, fresh post-rollover seeding from exactly `Solo_Specialist`, `Pair_Team`, and `Trio_Formation`, and idempotent rollover/seed retries.
- [ ] 11.3 Run the documentation grep across `.kiro/steering`, `docs/guides`, `docs/game-systems`, and `docs/architecture` and confirm no stale generated-reset, archive-after-removal, missing-archive-failure-preservation, missing seed-vs-growth separation, omitted optional acquisition/roster reporting, or fixed-final-roster statement remains.
- [ ] 11.4 Run frontend responsive/admin route checks at 320px, 768px, and 1024px and confirm no horizontal overflow, touch-target violation, unauthorized mutation, missing validation, missing `Growth_Strategy`/`Robot_Acquisition`/resulting-roster metrics, or off-cycle growth action.
- [ ] 11.5 Run the full mandatory release gates for all affected packages and attach the generated-stable-specific test and observability results to the implementation record, including the distinct-strategy, acquisition, `robot_creation`, permitted-roster-expansion, archive-before-removal, and fresh-reseed verification outcomes.

## Notes

- All tasks are mandatory; none are optional.
- Tasks are sequenced so profile/seed and policy work precede settlement integration, financial adapters and admin surfaces depend on the core behavior, lifecycle/archive/reseed behavior is completed before integration and heavy validation, documentation follows finalized implementation, and aggregate verification is last.
- Existing task numbering and the dependency graph are preserved; lifecycle wording and requirement traces are explicit through R6.8.
- The dependency graph includes every decimal leaf task exactly once; task-group headings and this checkpoint-free plan structure are not graph nodes.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["1.3", "2.2"] },
    { "id": 4, "tasks": ["1.5", "2.3"] },
    { "id": 5, "tasks": ["2.4"] },
    { "id": 6, "tasks": ["2.5", "4.1", "4.2"] },
    { "id": 7, "tasks": ["4.3"] },
    { "id": 8, "tasks": ["4.4", "4.5"] },
    { "id": 9, "tasks": ["3.1", "4.6"] },
    { "id": 10, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6"] },
    { "id": 11, "tasks": ["3.7", "5.1", "6.1", "6.4", "6.5", "8.1", "8.2"] },
    { "id": 12, "tasks": ["5.2", "6.2", "6.3", "6.6"] },
    { "id": 13, "tasks": ["5.3", "7.1", "8.3", "9.1", "9.2"] },
    { "id": 14, "tasks": ["5.4", "7.2", "7.3", "8.4", "9.3"] },
    { "id": 15, "tasks": ["7.4"] },
    { "id": 16, "tasks": ["9.4"] },
    { "id": 17, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9"] },
    { "id": 18, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5"] }
  ]
}
```
