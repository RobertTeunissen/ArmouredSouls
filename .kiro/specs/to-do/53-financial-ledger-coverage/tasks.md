# Implementation Plan: Financial Ledger Coverage

## Overview

All tasks are mandatory. This implementation starts with an evidence baseline, establishes the schema and typed contracts, migrates every current-economy writer to shared services, preserves nonfinancial/domain compatibility, and finishes with blocking verification. The work is forward-only from `Cutover_Cycle` in `ACC`: it does not reconstruct earlier cycles, add one-off historical scripts, or modify financial-page UI.

## Task Dependency Graph

```json
{
  "waves": [
    {"name": "Wave 1 — Coverage baseline", "tasks": ["Task Group 1"]},
    {"name": "Wave 2 — Schema and contracts", "tasks": ["Task Group 2"]},
    {"name": "Wave 3 — Atomic credit and prestige", "tasks": ["Task Group 3", "Task Group 4"]},
    {"name": "Wave 4 — Credit and repair writer migration", "tasks": ["Task Group 5", "Task Group 6"]},
    {"name": "Wave 5 — Settlement and admin compatibility", "tasks": ["Task Group 7"]},
    {"name": "Wave 6 — Lifecycle, cutover, and diagnostics", "tasks": ["Task Group 8"]},
    {"name": "Wave 7 — Test inventory and replacement", "tasks": ["Task Group 9"]},
    {"name": "Wave 8 — Documentation", "tasks": ["Task Group 10"]},
    {"name": "Wave 9 — Final verification", "tasks": ["Task Group 11"]}
  ]
}
```

## Notes

- `Task Group 3` and `Task Group 4` share the schema and typed contracts from `Task Group 2`; all writer migrations use their shared services.
- `Task Group 11` is the blocking completion gate. It records actual evidence and does not permit selection of `Cutover_Cycle` when any required validation is incomplete.

## Tasks

#### Task Group 1: Freeze the Coverage_Manifest and compatibility baseline

_Requirements: 2.1, 2.5, 7.2, 8.1, 8.2, 8.3, 10.1, 10.4, 10.5, 11.6_

- [ ] 1.1 Create `docs/implementation_notes/financial-ledger-coverage.md` with the current taxonomy, direct `User.currency` writers, verified `User.prestige` sources, repair source, settlement implementations, Booking_Office path, lifecycle boundaries, admin routes, player-guide validation, and financial-page files that must remain unchanged.
- [ ] 1.2 Create a typed `Coverage_Manifest` fixture for all nine battle modes, Bye_Event resolution, streaming, weapons, facilities, robot creation, attributes, manual/automatic/admin repairs, achievement rewards, both settlement implementations, the legacy admin daily-finance entry point, subscriptions, and lifecycle boundaries.
- [ ] 1.3 For every manifest entry record the current file/function, final service, expected taxonomy or nonfinancial boundary, stable identity strategy, paired/domain records, and target test tier.
- [ ] 1.4 Add a backend unit-tier direct-writer search/AST check that fails for any new current-economy `User.currency` mutation outside `Credit_Mutation_Service` or enumerated lifecycle boundaries. Exclude generated output and `app/backend/src/shared` because it is the symlinked shared path.
- [ ] 1.5 Record the no-UI boundary: no changes to `Income_Dashboard`, `Cycle_Summary`, financial-page components, or financial-page layouts; retain existing admin and player-guide regression surfaces.

### Task Group 2: Establish schema, taxonomy, and typed `Financial_Breakdown` contracts

_Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.2, 3.6, 3.7, 4.1, 7.7, 9.1_

- [ ] 2.1 Update `app/backend/prisma/schema.prisma` with nullable migration-safe `financialEventId` fields on `FinancialLedger` and `AuditLog`, a nullable `sourceEventId` field for `prestige_change` rows, the `FinancialLedger` uniqueness rule, the composite `AuditLog` uniqueness rules for `(eventType, financialEventId)` and `(eventType, sourceEventId)`, and indexes that preserve pre-cutover rows.
- [ ] 2.2 Add the Prisma migration and generate the project-local client. Add duplicate-identity diagnostics for existing `financialEventId` and `sourceEventId` values before relying on uniqueness against existing data; do not rewrite old amounts or fabricate old pairs.
- [ ] 2.3 Replace the runtime/type allowlist with exactly `battle_income`, `streaming_revenue`, `repair_cost`, `facility_upgrade`, `weapon_purchase`, `weapon_sale`, `weapon_refinement`, `robot_creation`, `attribute_upgrade`, `achievement_reward`, `passive_income`, and `operating_costs`.
- [ ] 2.4 Remove new-writer acceptance of `subscription_cost`, `prestige_award`, and `settlement_adjustment`; preserve old database values as immutable `Legacy_Record` values.
- [ ] 2.5 Define discriminated `Financial_Breakdown` types and validators for every taxonomy value. Require typed inputs, modifiers, discounts/bonuses, formula identifier/version, rounding/order facts, final amount, source identity, and mandatory repair subtype metadata.
- [ ] 2.6 Define the breakdown variants for battle tier/outcome/placement/team-size/prestige modifiers; Streaming Studio battle/fame/studio factors; Repair Bay/active robot/manual discounts; Merchandising Hub/prestige/roster-capacity inputs; operating-cost components; and purchase/upgrade/sale/refinement formulas. Exclude combat-only nonfinancial bonuses.
- [ ] 2.7 Add unit tests for exact taxonomy membership, required metadata, all breakdown variants, repair subtype validation, unknown/missing-field rejection, and legacy-row compatibility.

### Task Group 3: Implement `Credit_Mutation_Service`, pair atomicity, and `Financial_Event` identities

_Requirements: 2.1, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.8, 4.1, 4.2, 4.3, 4.4, 9.4_

- [ ] 3.1 Create the typed `Credit_Mutation_Service` operation and transaction-aware variant with signed integer amount, user/robot identity, exact taxonomy value, non-null `financialEventId`, source description, typed `Financial_Breakdown`, and audit context.
- [ ] 3.2 Implement lookup/compare/insert behavior: identical retries return the original result, conflicting facts fail closed, and concurrent unique-constraint races reread the committed result without applying a second delta.
- [ ] 3.3 In one interactive Prisma transaction lock/re-read the mutable balance as required, update `User.currency`, allocate the sequence only through `withAuditSequence`, insert one `FinancialLedger` row, and insert one paired `financial_transaction` `AuditLog` row.
- [ ] 3.4 Remove required-accounting dependence on `recordLedgerEntry.ts` swallowing failures and prevent `financial_ledger_active` from returning `null` or suppressing a required post-cutover pair. Retain only an explicit rollout guard that fails closed.
- [ ] 3.5 Add stable identity builders for battle reward components, streaming robot rewards, achievement unlocks, per-robot repairs, settlement components, and request-driven economic operations. Document retry propagation and reject timestamps/current balances/current quotes as identities.
- [ ] 3.6 Add unit and PostgreSQL integration tests for successful pairing, exact `balanceAfter`, rollback on balance/ledger/audit/sequence failure, same-event retry, conflicting retry, concurrent retry, unique constraints, sequence continuity, distinct ledger-versus-audit purposes, shared `financialEventId`, and the one-pair-per-credit-mutation row count.

### Task Group 4: Implement `Prestige_Service` and graphable stable-level records

_Requirements: 3.3, 4.2, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 11.1, 11.2, 11.3_

- [ ] 4.1 Create or consolidate `Prestige_Service` so a positive stable-level award atomically updates `User.prestige` and writes one `AuditLog` `prestige_change` record with a typed payload, unique `sourceEventId`, `withAuditSequence`, and identical-retry/conflicting-retry behavior.
- [ ] 4.2 Persist `eventTimestamp`, `cycleNumber`, stable/user identity, exact amount, source `'battle' | 'achievement'`, source identity, optional mode/battle/achievement identity, typed award breakdown, and resulting `User.prestige`.
- [ ] 4.3 Migrate every verified battle prestige source—1v1 league/tournament, 2v2/3v3 league, tag team, 2v2/3v3 team tournaments, KotH, Grand Melee, and shared battle reward strategy—to stable-level aggregation before calling the service.
- [ ] 4.4 Migrate achievement prestige awards to the same service and keep `battle_complete`/`achievement_unlock` payload values as context/display records only.
- [ ] 4.5 Assert Bye_Event, zero-award, account reset, and season rollover paths do not create positive prestige records or financial ledger rows.
- [ ] 4.6 Add unit, integration, and heavy coverage for every prestige source, team/placement aggregation, achievement awards, `sourceEventId` retry/conflict safety, `withAuditSequence` ordering, graph ordering fields, zero paths, reset boundaries, and absence of `prestige_award` ledger rows.

### Task Group 5: Migrate battle, streaming, achievement, and economic credit writers

_Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.5, 3.6, 4.2, 4.4, 7.1, 8.1, 11.1, 11.2, 11.3_

- [ ] 5.1 Route all nine battle orchestrators and shared reward code through `Battle_Financial_Reward_Service` and `Credit_Mutation_Service` for battle income, with stable aggregation and deterministic source identities.
- [ ] 5.2 Replace direct combined currency/prestige/streaming updates in `kothBattleOrchestrator.ts` and `grandMeleeBattleOrchestrator.ts` with the same separate battle-income, streaming, and prestige calls used by every other mode.
- [ ] 5.3 Implement exact row fan-out tests: two-stable 1v1 with two streaming robots yields two battle-income ledger rows, two streaming ledger rows, and four paired financial audit rows; one-stable 2v2 yields one battle-income pair and two streaming pairs; stable-level aggregation never creates one financial battle row per participant. Assert that each pair has one accounting/reporting `FinancialLedger` row and one operational/security `financial_transaction` `AuditLog` row, not two credit mutations.
- [ ] 5.4 Route `Bye_Event` reward resolution before absent-side loading/simulation and assert that this reward path emits only the mode participation-floor `battle_income` pair—no streaming, prestige, fame, repair spend, draw, or combat simulation. Separately verify that normal pre-battle automatic repair still runs for a byed robot with pre-existing damage under the repair task and is not attributed to the bye.
- [ ] 5.5 Migrate `streamingRevenueService.ts` to one `streaming_revenue` pair per eligible participating robot in every eligible fought mode, including KotH and Grand Melee; preserve its existing formula outputs in `Financial_Breakdown`.
- [ ] 5.6 Migrate achievement credit rewards to `achievement_reward` and ensure unlock retries cannot pay twice; route any achievement prestige through `Prestige_Service`.
- [ ] 5.7 Migrate `robotUpgradeService.ts`, weapon purchase/sale/refinement, facility upgrades, robot creation, and other economic operations to the shared service inside their existing ownership/spending transactions, preserving economics and operation identities.
- [ ] 5.8 Add/retain unit, integration, and heavy tests for source coverage, all modes, row fan-out, reward breakdowns, streaming, achievement retries, economic mutation pairing, subscription exclusion, and no direct current-economy credit writes.

### Task Group 6: Migrate repairs with separate subtype records

_Requirements: 1.3, 2.1, 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 4.2, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 11.1, 11.2, 11.3_

- [ ] 6.1 Refactor manual, automatic, and charged admin maintenance repairs to call `Credit_Mutation_Service` with `repair_cost`, mandatory `repairType`, stable per-operation/per-robot identity, and the shared transaction client. Keep automatic repair in the normal event scope for byed robots with pre-existing damage, while keeping its `repair_cost` event separate from the `Bye_Event` reward.
- [ ] 6.2 Keep `calculateRepairQuote`, `applyManualRepairDiscount`, and `calculateRepairBayDiscountPercent` as the only repair arithmetic in `app/shared/utils/repairCost.ts`; remove duplicate formulas and prevent reapplying an already-applied Repair Bay or manual discount.
- [ ] 6.3 Implement per-robot manual and automatic batch quoting, discounting, rounding, financial/domain identity, and audit pairing before summing. Execute all per-robot events atomically as one multi-robot operation. Prove the per-robot sum equals the balance delta, lifetime repair increment, ledger amount, and repair audit totals.
- [ ] 6.4 Persist Repair Bay level, active robot count, base quote, both discounts, operation order, rounding, and final charge in `Financial_Breakdown`; retain subtype-bearing `AuditLog` `robot_repair` rows.
- [ ] 6.5 Keep `cycleProgressService.ts`, `getRepairAuditLog()`, and related admin diagnostics on `AuditLog` `robot_repair` rows as the subtype-bearing `Canonical_Source`; remove fallback reads from battle payloads, cached quotes, or subtype-losing ledger sums.
- [ ] 6.6 Add unit/property/integration/heavy tests for manual/automatic separation, per-robot financial/domain pairs, atomic multi-robot rollback, batch rounding, all discount inputs, including automatic repair for a byed robot without bye attribution, duplicate retry, lifetime totals, admin repair logs, and current-cycle repair aggregation.

### Task Group 7: Unify settlement and preserve admin mutation contracts

_Requirements: 1.4, 2.1, 2.5, 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 4.2, 4.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 7.1 Create one `Settlement_Service` around the existing passive-income and operating-cost formulas. Route `cycleScheduler.ts`, `adminCycleService.ts`, and the supported admin trigger through it; remove the second independent mutation implementation.
- [ ] 7.2 Emit separate `passive_income` and `operating_costs` component events per applicable stable/cycle with deterministic identities, signed amounts, actual resulting balances, and complete formula breakdowns. Never emit `settlement_adjustment`.
- [ ] 7.3 Capture Merchandising Hub level, prestige, roster capacity/normalization, cycle, passive-income inputs, each operating-cost component, discounts/waivers, and rounding; keep per-battle Streaming Studio revenue under `streaming_revenue`.
- [ ] 7.4 Persist exactly one `passive_income` pair and one `operating_costs` pair for every applicable stable/cycle, including zero-valued components with unchanged `balanceAfter`. Test the shared zero-component policy, rerun behavior, partial-failure rollback, and same-cycle component idempotency. Preserve existing domain `passive_income`/`operating_costs` audit and snapshot compatibility records.
- [ ] 7.5 Keep `/api/admin/daily-finances/process` available as a delegation or non-mutating preview with its existing `summary.totalCostsDeducted`, `usersProcessed`, and `timestamp` fields. Preserve `/api/admin/cycles/bulk` `includeDailyFinances`, `settlement.finances`, `totalPassiveIncome`, `totalOperatingCosts`, `usersProcessed`, and `skipped` behavior.
- [ ] 7.6 Verify `/api/admin/audit-log` can query new `financial_transaction` rows while preserving its response fields/filters, and verify `/api/admin/audit-log/repairs` remains focused on subtype-bearing `robot_repair` records; preserve `/api/admin/economy/overview` response fields/filters for `AuditLogPage`, `RepairLogPage`, and `EconomyOverviewPage`. Update backend contract tests only for additive/intentional internal changes.
- [ ] 7.7 Add unit, PostgreSQL integration, heavy-cycle, frontend contract, and existing E2E tests for zero/positive income and costs, both components, reruns, rollback, admin routes, cycle snapshots, and no duplicate settlement payments.

### Task Group 8: Enforce lifecycle boundaries, forward-only ACC cutover, and diagnostics

_Requirements: 8.2, 8.3, 9.1, 9.2, 9.3, 9.4, 9.5, 10.3, 10.5, 11.2, 11.3_

- [ ] 8.1 Document account creation, account reset, season rollover, and explicit balance purge as `Opening_Balance_Boundary` operations with lifecycle/audit behavior and no current-economy transaction type.
- [ ] 8.2 Preserve season archive/purge behavior and verify no live/pre-cutover history is reconstructed from `battle_log`, `battle_complete`, achievement payloads, cached quotes, old ledger rows, or current formulas.
- [ ] 8.3 Add explicit `Rollout_Phase` checks for schema/client generation, writer/manifest completion, blocking tests, required capture activation, ACC cutover, reconciliation, and documentation. Record the selected `Cutover_Cycle` only after the gates pass.
- [ ] 8.4 Make required capture fail closed: no silent feature-flag suppression, swallowed post-balance errors, or null success for a required post-cutover financial pair.
- [ ] 8.5 Extend reconciliation diagnostics for unpaired post-cutover ledger/audit rows, duplicate/conflicting identities, invalid taxonomy/metadata, balance-after inconsistencies, repair subtype mismatches, missing settlement components, prestige source gaps, and direct writers outside `Coverage_Manifest`. Label pre-cutover findings outside the completeness claim.
- [ ] 8.6 Add PostgreSQL integration tests for lifecycle boundaries, cutover classification, diagnostics, and the absence of any one-off historical reconstruction script or PRD environment/workflow change.

### Task Group 9: Inventory and replace/retire only redundant behavior tests

_Requirements: 1.1, 1.2, 2.2, 2.3, 5.4, 6.4, 6.6, 7.1, 7.4, 8.1, 9.2, 10.1, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 9.1 Inventory all existing tests that assert feature-flag-off/null ledger enrichment, obsolete transaction labels, direct combined KotH/Grand Melee currency updates, or independent legacy daily-finance mutation. For each, record retain/replace/retire and the new requirement it verifies.
- [ ] 9.2 Replace removed-behavior tests with assertions for required atomic pairing, shared placement-mode mutation, separate settlement components, and fail-closed capture. Do not delete a test solely to make a suite pass.
- [ ] 9.3 Retain formula/property tests, repair-cost and repair-log tests, admin route/API contract tests, player-guide content validation, financial-page no-regression tests, battle-result/display tests, and existing domain audit/snapshot tests.
- [ ] 9.4 Add the complete test-tier coverage required by the implementation: backend unit, PostgreSQL integration, backend heavy, affected frontend admin-contract/unit, and existing Playwright E2E regression. Ensure the tier partition verifier collects each backend test in exactly one tier.
- [ ] 9.5 Add assertions for exact battle row fan-out, typed modifier metadata, graphable prestige fields, repair spend canonical-source behavior, admin compatibility, player-guide non-impact, free subscription changes, and forward-only/no-script policy.

### Task Group 10: Update named steering, PRD, guide, and operational documentation

_Requirements: 2.5, 3.6, 3.7, 3.8, 5.4, 5.6, 6.1, 6.2, 6.6, 6.8, 7.6, 7.7, 8.1, 8.2, 8.3, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.6_

- [ ] 10.1 Update `.kiro/steering/coding-standards.md` with the shared credit path, atomic pair, no-swallowed-required-write rule, exact taxonomy, repair subtype, `Financial_Breakdown`, and prestige/subscription exclusion.
- [ ] 10.2 Update `.kiro/steering/database-best-practices.md` with transaction/lock ordering, unique `financialEventId`, nullable legacy fields, pair constraints, and post-cutover reconciliation.
- [ ] 10.3 Update `.kiro/steering/testing-strategy.md` with `Coverage_Manifest`, direct-writer checks, all backend/frontend/E2E tiers, atomicity/idempotency tests, repair/prestige separation, and precise retirement policy.
- [ ] 10.4 Update `.kiro/steering/project-overview.md` with the finalized financial/audit architecture, separate settlement/prestige/repair/subscription sources, ACC-only forward cutover, and deferred `Financial_Page_Follow_On`.
- [ ] 10.5 Update `docs/game-systems/PRD_ECONOMY_SYSTEM.md` with exact taxonomy, all credit sources, typed breakdown expectations, repair source, achievement rewards, settlement components, and free Booking_Office changes.
- [ ] 10.6 Update `docs/game-systems/PRD_CYCLE_SYSTEM.md` with `Settlement_Service`, component identities, domain audit compatibility, lifecycle boundaries, ACC cutover, and reconciliation.
- [ ] 10.7 Update `docs/architecture/PRD_AUDIT_SYSTEM.md` with paired financial rows, stable prestige audit, `withAuditSequence`, identity conflicts, Canonical_Source rules, legacy policy, and no reconstruction.
- [ ] 10.8 Create `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md` with source mapping, exact battle row examples, the distinct accounting/reporting versus operational/security purposes of `FinancialLedger` and paired `AuditLog` rows, breakdown fields, per-robot repair pairs and byed-robot automatic-repair separation, zero-valued settlement component pairs, `prestige_change`/`sourceEventId` identity and retry behavior, repair/prestige/subscription boundaries, admin compatibility including generic `financial_transaction` visibility, rollout/reconciliation, failure response, and the no-UI/Financial_Page_Follow_On boundary.
- [ ] 10.9 Update `docs/guides/README.md` with the operational guide entry. Do not edit `app/backend/src/content/guide/`; retain `app/backend/tests/guide/content-validation.test.ts` as a blocking regression.
- [ ] 10.10 Record the actual `Cutover_Cycle`, `Rollout_Phase` results, test commands/results, diagnostic results, and any explicitly retained legacy limitations in `docs/implementation_notes/financial-ledger-coverage.md`.

### Task Group 11: Run the final Verification Criteria gate

_Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 11.1 Run Verification Criterion 1: the repository taxonomy/direct-writer search over `app/backend/src` and `app/shared` (excluding generated output and the symlinked shared path), and confirm exactly twelve final values plus no new obsolete writers.
- [ ] 11.2 Run Verification Criterion 2: the `Coverage_Manifest` test and confirm zero uncovered post-cutover credit writers, zero unpaired prestige sources, and zero conflicting prestige `sourceEventId` values.
- [ ] 11.3 Run Verification Criterion 3: the battle row-contract integration suite and confirm all stable/robot fan-out, Bye_Event exclusion, and typed `Financial_Breakdown` assertions.
- [ ] 11.4 Run Verification Criterion 4: PostgreSQL atomicity/idempotency tests including rollback, duplicate/conflict races, prestige `sourceEventId` retry/conflict behavior, zero-valued settlement component persistence, and settlement reruns.
- [ ] 11.5 Run Verification Criterion 5: repair audit tests for manual/automatic subtype separation, per-robot batch arithmetic and financial/domain pairs, discount metadata, byed-robot automatic-repair separation, canonical source, and no duplicate charges.
- [ ] 11.6 Run Verification Criterion 6: `pnpm --dir app/backend run lint`, `pnpm --dir app/backend run build`, `pnpm --dir app/backend run typecheck:tests`, `pnpm --dir app/backend run test:tiers:verify`, `pnpm --dir app/backend run test:unit`, `pnpm --dir app/backend run test:integration`, `pnpm --dir app/backend run test:heavy`, `pnpm --dir app/frontend run lint`, `pnpm --dir app/frontend run build`, `pnpm --dir app/frontend run test:ci`, and `pnpm --dir app/frontend exec playwright test`; preserve actual results rather than stale counts.
- [ ] 11.7 Run Verification Criterion 7: search the named documentation files for the final contract, ACC/`Cutover_Cycle` boundary, no-script/no-history policy, row fan-out, distinct ledger/audit purposes, canonical-source map, atomicity/idempotency rule, `Financial_Breakdown`, zero-valued settlement pairs, per-robot repair and byed-robot repair separation, `prestige_change`/`sourceEventId` identity, admin generic-audit visibility, guide, and Financial_Page_Follow_On language; confirm the design contains the atomic-pair, battle-fan-out, and reconciliation Mermaid diagrams and the operator guide contains its one-mutation/two-record purpose diagram and worked row-count example; also confirm no new historical reconstruction script or player-guide content change.
- [ ] 11.8 Re-read `requirements.md`, `design.md`, and `tasks.md`; verify every acceptance criterion, including 5.6, 6.8, and 7.7, appears in at least one `_Requirements:` line and every requirement has a design section. Confirm no financial-page UI file or player-guide article was modified in this planning/implementation scope unless an explicit requirement changes that boundary.
