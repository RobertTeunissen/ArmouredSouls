# Requirements: Financial Ledger Coverage (Backlog Item #59)

## Glossary

- **Backlog_Item_59** — The financial-ledger coverage and audit-correctness work identified as item #59 in `docs/BACKLOG.md`.
- **Financial_Ledger** — The durable accounting/reporting record stored in `financial_ledger`; its `amount` and `balanceAfter` represent credits only, and it is optimized for financial aggregation and explanation.
- **Financial_Audit_Record** — The immutable operational/security trail represented by an `AuditLog` record with `eventType` `'financial_transaction'`; it preserves source context, audit sequencing, and reconciliation evidence and is paired one-to-one with a new `Financial_Ledger` row.
- **Credit_Mutation** — One business operation that changes a stable's `User.currency` balance.
- **Credit_Mutation_Service** — The shared transaction-aware service that applies one `Credit_Mutation` and writes its paired financial records.
- **Battle_Financial_Reward_Service** — The shared battle-result adapter that turns every mode's already-calculated reward components into stable-level credit, per-robot streaming, and separate prestige records.
- **Financial_Event** — The durable identity of one `Credit_Mutation`, shared by its `Financial_Ledger` row and `Financial_Audit_Record`.
- **Transaction_Taxonomy** — The finite set of permitted `transactionType` values and the source/subtype metadata required for each value.
- **Financial_Breakdown** — Typed, persisted formula inputs, multipliers, discounts, bonuses, rounding, and final amount for one financial event; it records what was applied rather than asking a later report to recalculate history.
- **Atomicity_Unit** — The database transaction containing the balance change, its `Financial_Ledger` row, and its `Financial_Audit_Record`.
- **Duplicate_Suppression** — The rule that retrying one `Financial_Event` cannot apply its credit delta more than once.
- **Repair_Spend** — Credits actually charged for restoring robot condition, distinct from a current repair quote.
- **Manual_Repair** — A player-requested repair, including a multi-robot request whose quote and discount are calculated per robot before summing.
- **Automatic_Repair** — A pre-battle repair charged by the cycle/event execution path.
- **Settlement_Cycle** — One daily cycle's passive-income and operating-cost calculation for one stable.
- **Settlement_Service** — The single mutating service that calculates and records both components of a `Settlement_Cycle`.
- **Passive_Income** — Credits produced by the cycle's passive facilities, recorded as gross income.
- **Operating_Costs** — Credits charged by the cycle's recurring operating-cost rules, recorded separately from gross income.
- **Prestige_Award** — A positive change to `User.prestige` caused by a fought battle or an achievement unlock; it is progression, not currency.
- **Prestige_Service** — The atomic service that applies one stable-level `Prestige_Award` and writes its `Prestige_Audit_Record`.
- **Prestige_Audit_Record** — The stable-level audit record for one exact `Prestige_Award`, including its source, cycle/timestamp, and resulting prestige balance.
- **Prestige_Growth_Series** — An ordered current-season sequence of `Prestige_Audit_Record` points that can be plotted from award amounts or resulting balances.
- **Opening_Balance_Boundary** — A lifecycle operation that establishes, resets, or purges a credit balance rather than earning or spending credits in the current economy.
- **Cutover_Cycle** — The first cycle/event execution after activation in `ACC` from which the new paired ledger/audit contract is authoritative.
- **Forward_Only_Cutover** — The deliberate policy that the new contract starts at `Cutover_Cycle`; earlier cycles are not reconstructed, repaired, or promised to be complete.
- **Booking_Office** — The event-subscription system that controls participation capacity and does not charge credits for subscription changes.
- **Subscription_Change** — A `Booking_Office` subscribe or unsubscribe operation; it is operational state, not a financial event.
- **Season_Rollover** — The lifecycle transition that archives and purges the season-scoped live data under the existing season rules.
- **Fought_Battle** — A battle in which combat simulation actually ran and may produce battle income, streaming revenue, repair spend, fame, or prestige according to that mode's rules.
- **Bye_Event** — A scheduled participation result that pays only its mode's participation floor and performs no combat simulation; it has no streaming revenue or prestige award.
- **Canonical_Source** — The one authoritative event store used to answer a particular reporting question; a fallback payload or cached estimate is not a `Canonical_Source`.
- **Legacy_Record** — A pre-`Cutover_Cycle` row retained as-is for history; its presence does not mean the earlier period has complete or corrected financial coverage.
- **Coverage_Manifest** — The maintained list mapping every production credit mutation and prestige award source to its shared writer and record type.
- **Rollout_Phase** — A controlled deployment stage in which schema, writers, verification, activation, and reconciliation are completed in order.
- **Admin_Compatibility** — The requirement that existing admin routes, response fields, filters, cycle controls, repair logs, and admin audit behavior continue to work while their financial implementation is unified.
- **Player_Guide** — The in-game articles under `app/backend/src/content/guide/`; these describe player-visible rules, not internal accounting rows.
- **Income_Dashboard** — The later financial-page work that will present income, expense, modifier, and ROI information from the corrected records.
- **Cycle_Summary** — The later dashboard/report work that will present current-cycle and completed-cycle financial and progression summaries from the corrected records.
- **Financial_Page_Follow_On** — The later, separate change covering the `Income_Dashboard` and `Cycle_Summary` presentation/API work after capture correctness is established.

## Introduction

Backlog_Item_59 addresses a correctness gap in the economy's audit trail. The current `Financial_Ledger` declares twelve transaction labels, but several real credit mutations bypass it, the ledger is feature-flagged and non-atomic with balance updates, and ledger failures can be swallowed after money has changed. The `AuditLog` stream and the ledger can therefore disagree precisely where players and administrators need reliable numbers for investment decisions.

The finished system SHALL have one authoritative credit-mutation path, one paired financial audit record for every new credit event, explicit idempotency, and a finite `Transaction_Taxonomy` that distinguishes financial resources from repairs, subscriptions, and prestige. This is a `Forward_Only_Cutover`: the implementation starts in `ACC` at the selected `Cutover_Cycle`. It does not reconstruct, correct, or claim completeness for earlier cycles, and it does not create one-off migration scripts.

Existing player-facing financial pages and cycle summaries are deliberately not redesigned in this work. The `Income_Dashboard` and `Cycle_Summary` are the `Financial_Page_Follow_On` consumers of the corrected data. The `Player_Guide` is also unchanged because this spec changes capture correctness, not player-visible reward formulas or rules.

## Expected Contribution

This spec addresses the identified debt of incomplete credit coverage, non-atomic ledger enrichment, ambiguous transaction labels, missing formula provenance, and the absence of canonical stable-level prestige history. It makes no claim about cycles before `Cutover_Cycle`.

1. **Forward-only correctness boundary:** before, the ledger is incomplete and disabled on some paths; after, every new in-scope mutation from `Cutover_Cycle` in `ACC` is captured, while earlier cycles remain untouched and explicitly outside the completeness claim. There are zero one-off reconstruction scripts.
2. **Taxonomy and mutation closure:** before, 12 declared labels include obsolete/nonfinancial concepts and several real sources bypass the ledger; after, exactly 12 permitted labels have real writers, with zero new writes for `subscription_cost`, `prestige_award`, or `settlement_adjustment` and explicit `achievement_reward`, `passive_income`, and `operating_costs` coverage.
3. **Predictable battle rows:** before, some modes combine battle credits, streaming, and prestige in one direct update; after, every fought mode uses one shared row fan-out: one `battle_income` pair per stable recipient and one `streaming_revenue` pair per eligible robot, with exact modifier breakdowns and no duplicate per-participant financial debits.
4. **Atomic and explainable records:** before, balance, ledger, and audit writes are separate and applied modifiers may be lost; after, each new event has one `Atomicity_Unit`, one `Financial_Ledger` row, one `Financial_Audit_Record`, and a typed `Financial_Breakdown` containing the actual inputs and amount.
5. **Progression and operations remain queryable:** before, prestige awards are only present in non-canonical battle/achievement payloads and admin settlement paths duplicate logic; after, stable-level prestige records support a current-season `Prestige_Growth_Series`, settlement components remain separately stored, and existing admin contracts remain usable.

### Verification Criteria

The final task SHALL run all of these checks and record their results in the implementation note:

1. A repository search over `app/backend/src` and `app/shared` (excluding the symlinked shared path and generated output) confirms the final `transactionType` allowlist contains exactly the twelve values in Requirement 1.1 and no production writer emits `subscription_cost`, `prestige_award`, or `settlement_adjustment`.
2. The `Coverage_Manifest` test fails if a production credit mutation or listed prestige source is not represented; its passing output reports zero uncovered post-cutover credit writers, zero unpaired prestige sources, and zero conflicting prestige `sourceEventId` values.
3. The battle row-contract integration suite proves the 1v1, team, KotH, Grand Melee, and Bye_Event fan-out counts, stable-level aggregation, per-robot streaming rows, and typed `Financial_Breakdown` values.
4. The financial atomicity/idempotency integration suite runs against PostgreSQL and proves rollback on ledger/audit failure, same-event retry stability, conflicting-event rejection, prestige `sourceEventId` retry/conflict behavior, zero-valued settlement component persistence, and settlement rerun stability.
5. The repair audit suite proves that manual and automatic rows are separately queryable, every repaired robot has one repair financial pair and one subtype-bearing domain row, manual batch rounding is per robot before summing, all applied repair discounts are recorded, automatic repair remains scoped to byed robots without attributing its spend to a bye reward, and no `battle_complete`, cached quote, or subtype-losing fallback is used as the dashboard `Repair_Spend` source.
6. The complete blocking validation runs `pnpm --dir app/backend run lint`, `pnpm --dir app/backend run build`, `pnpm --dir app/backend run typecheck:tests`, `pnpm --dir app/backend run test:tiers:verify`, `pnpm --dir app/backend run test:unit`, `pnpm --dir app/backend run test:integration`, `pnpm --dir app/backend run test:heavy`, `pnpm --dir app/frontend run lint`, `pnpm --dir app/frontend run build`, `pnpm --dir app/frontend run test:ci`, and the existing `pnpm --dir app/frontend exec playwright test` suite. No financial-page or player-guide change is required for this spec.
7. A repository search shows the named documentation files contain the `Forward_Only_Cutover`/`ACC` boundary, final taxonomy, row fan-out, the distinct `Financial_Ledger`/`Financial_Audit_Record` purposes and one-to-one relationship, canonical-source map for credit/repair/prestige/subscription/lifecycle questions, atomicity/idempotency rule, `Financial_Breakdown` rule, repair metadata rule, prestige graph contract, admin compatibility, player-guide non-impact, and `Financial_Page_Follow_On` dependency. The repository contains no new one-off historical reconstruction script.

## Scope and Boundaries

### In scope

- The schema, service, route, battle, economy, settlement, achievement, admin-maintenance, and lifecycle changes required to make new credit capture complete and paired from `Cutover_Cycle` onward.
- Removal of obsolete financial labels and separation of `Repair_Spend`, `Prestige_Award`, and `Subscription_Change` from credit accounting.
- Typed financial modifier/breakdown metadata so future `Income_Dashboard` and ROI work can use recorded facts rather than re-deriving old formulas.
- Admin route/response compatibility, reconciliation diagnostics integrated into existing services/routes, tests, and developer/operator documentation.

### Explicitly out of scope

- No reconstruction, correction, backfill, or completeness claim for any cycle before `Cutover_Cycle`; no one-off scripts for that purpose.
- No new or redesigned `Income_Dashboard`, `Cycle_Summary`, frontend financial pages, charts, filters, report navigation, or financial-page layout changes.
- No change to game-balance formulas except where the current implementation fails to record an already-existing credit or prestige mutation.
- No invented subscription fee, no credit value assigned to prestige, and no change to player-visible reward rules.
- No `Player_Guide` article rewrite. The existing guide content-validation test remains a regression check only.
- No `PRD` deployment environment work. `ACC` is the only rollout target covered by this spec.

## Requirements

### Requirement 1: Maintain a closed and semantically correct transaction taxonomy

**Acceptance criteria:**

1.1 The final `Transaction_Taxonomy` contains exactly these twelve `transactionType` values: `battle_income`, `streaming_revenue`, `repair_cost`, `facility_upgrade`, `weapon_purchase`, `weapon_sale`, `weapon_refinement`, `robot_creation`, `attribute_upgrade`, `achievement_reward`, `passive_income`, and `operating_costs`.

1.2 New production code SHALL NOT write `subscription_cost`, `prestige_award`, or `settlement_adjustment`. `Subscription_Change` and `Prestige_Award` SHALL be represented by their domain records, not by a `Financial_Ledger` row. Pre-cutover `Legacy_Record` rows SHALL remain untouched and are not part of the new completeness claim.

1.3 `repair_cost` SHALL remain one credit transaction type, but every new repair record SHALL carry `repairType` with exactly `manual` or `automatic` in both the ledger metadata and the paired financial audit payload.

1.4 `achievement_reward`, `passive_income`, and `operating_costs` SHALL each have a real writer and tests; a type declared without a production writer does not satisfy coverage.

1.5 The shared type/runtime validation SHALL reject unknown transaction types and reject missing or invalid required metadata before a financial record is written.

### Requirement 2: Capture every production credit mutation with one shared battle path

**Acceptance criteria:**

2.1 Every positive or negative `User.currency` mutation in production code SHALL call the shared credit mutation service, including battle and bye rewards, streaming revenue, achievements, attributes, weapons, facilities, robot creation, repairs, settlement, and charged admin maintenance repairs.

2.2 All nine scheduled battle modes—`league_1v1`, `tournament_1v1`, `tag_team`, `koth`, `league_2v2`, `league_3v3`, `tournament_2v2`, `tournament_3v3`, and `grand_melee`—SHALL use the same `Battle_Financial_Reward_Service` and `Credit_Mutation_Service` for fought-battle credits. KotH and Grand Melee SHALL not use a combined-currency exception.

2.3 A `Fought_Battle` MAY record `battle_income` and `streaming_revenue` according to existing mode rules. The bye-reward resolution path for a `Bye_Event` SHALL record only its existing participation-floor credit as `battle_income`; it SHALL create no streaming revenue, prestige, fame, repair spend, or simulated combat result. Any `Automatic_Repair` required for pre-existing damage before the scheduled event remains a separate repair operation under Requirement 5, applies to byed robots under the normal event scope, and is not produced by or attributed to the bye.

2.4 No production path may directly increment, decrement, set, or otherwise mutate `User.currency` outside the shared service, except the explicitly documented `Opening_Balance_Boundary` operations. The exception SHALL not be used to award or spend current-season credits.

2.5 `Coverage_Manifest` SHALL name every writer and source listed in 2.1, including both settlement implementations, the legacy admin daily-finance entry point, and all prestige sources separately.

2.6 For a normal fought battle, the financial row contract SHALL be:

- one `battle_income` `Financial_Ledger` row and one paired `Financial_Audit_Record` per stable receiving the aggregated battle reward;
- one `streaming_revenue` `Financial_Ledger` row and one paired `Financial_Audit_Record` per eligible participating robot, because streaming is calculated per robot;
- one `Prestige_Audit_Record` per stable receiving a positive aggregate prestige award; and
- the existing one `battle_complete` audit row and `BattleParticipant` display/result fields per participant remain compatible but are not additional financial mutation sources.

For example, a two-robot 1v1 fought by two different stables with Streaming Studio eligibility for both produces two `battle_income` ledger rows, two `streaming_revenue` ledger rows, and four paired `financial_transaction` audit rows, plus the existing two participant-level battle audit rows and any separate prestige/repair/achievement records. A 2v2 team whose two robots belong to one stable produces one aggregated battle-income pair for that stable and two streaming-revenue pairs. No stream or prestige pair is written when the mode rules produce none.

### Requirement 3: Make the balance, ledger, audit, and modifier facts atomic

**Acceptance criteria:**

3.1 The shared mutation service SHALL execute the balance update, `Financial_Ledger` insert, and `Financial_Audit_Record` insert in one `Atomicity_Unit`.

3.2 A new financial event SHALL contain a signed integer credit `amount`, resulting `balanceAfter`, stable/user identity, optional robot identity, exact `transactionType`, source description, `Financial_Event` identity, and a typed `Financial_Breakdown`. The paired audit payload SHALL contain the same financial facts and subtype metadata.

3.3 If any required balance, ledger, or financial-audit operation fails, the entire `Atomicity_Unit` SHALL roll back. Required financial record failures SHALL not be swallowed after the balance has changed.

3.4 Financial audit sequence allocation SHALL use `withAuditSequence` and remain compatible with the existing cycle/sequence continuity checks.

3.5 A successful `Credit_Mutation` SHALL produce exactly one new ledger row and exactly one paired financial audit row; a duplicate retry SHALL produce neither a second balance delta nor a second pair. Existing domain audit rows such as `battle_complete`, `robot_repair`, `passive_income`, and `operating_costs` may remain as compatibility records but are not extra credit mutations.

3.6 Every amount-affecting discount, bonus, facility effect, multiplier, formula input, and rounding decision SHALL be captured in the event's typed `Financial_Breakdown`. This includes, where applicable, battle tier/outcome/placement/team-size/prestige modifiers, Streaming Studio level plus battle-count/fame multipliers, Repair Bay and manual-repair discounts plus active-robot count, Merchandising Hub level plus prestige/roster-capacity inputs, facility/roster operating-cost components, and purchase/upgrade/sale/refinement formula inputs. Combat-only bonuses that do not affect a credit amount SHALL not be copied into financial records.

3.7 A later report SHALL be able to explain the recorded amount from its stored `Financial_Breakdown` without querying current facility levels, current prestige, current fame, current repair quotes, or current formulas.

3.8 `Financial_Ledger` and `Financial_Audit_Record` SHALL remain separate records with distinct purposes: `Financial_Ledger` is the accounting/reporting record, while `Financial_Audit_Record` is the immutable operational/security/reconciliation trail. They SHALL share one `Financial_Event` identity and be written atomically, but the audit row SHALL never represent a second credit mutation. The design and operational documentation SHALL include a row-purpose diagram and a worked row-count example.

### Requirement 4: Make all financial events idempotent and conflict-safe

**Acceptance criteria:**

4.1 The schema SHALL provide a unique, non-null `Financial_Event` identity for every new `Financial_Ledger` row and enforce the same identity on the paired financial audit record. Pre-cutover rows may remain nullable `Legacy_Record` rows.

4.2 Retrying a source operation with the same `Financial_Event` identity SHALL return the original result without applying credits again. This SHALL cover battle rewards, achievement rewards, purchases, repairs, and settlement components.

4.3 Reusing an identity with different amount, user, robot, transaction type, breakdown, or source metadata SHALL fail closed with a domain error and SHALL not alter any balance or record.

4.4 Event identities SHALL be stable at the source boundary: scheduled rewards use the source battle/match and reward component, settlement uses stable/cycle/component, and request-driven economic operations persist or propagate their operation identity across retries.

### Requirement 5: Preserve separate manual and automatic repair accounting

**Acceptance criteria:**

5.1 `Manual_Repair`, `Automatic_Repair`, and charged admin maintenance repairs SHALL all use the shared repair/credit path and `repair_cost` with mandatory `repairType` metadata.

5.2 The repair charge SHALL use `calculateRepairQuote`, `applyManualRepairDiscount`, and `calculateRepairBayDiscountPercent` from `app/shared/utils/repairCost.ts`; no caller may duplicate or re-apply those formulas.

5.3 A manual batch SHALL quote and discount each robot independently, round each robot's charge according to the existing rule, then sum the charges. The sum SHALL be identical in the user balance delta, ledger rows, audit rows, lifetime repair total, and any ledger mirror.

5.4 Dashboard repair totals and the existing admin repair log SHALL continue to use `AuditLog` rows with event type `robot_repair`, `creditsCharged`, and `repairType` as the `Canonical_Source`; they SHALL not fall back to `battle_complete`, `robots.repairQuoteCredits`, or a net ledger aggregation that loses the subtype.

5.5 Repair tests SHALL prove that a failed paired write rolls back the repair charge, every applied discount is in `Financial_Breakdown`, and a retry cannot double-charge a robot.

5.6 Each repaired robot SHALL have one `repair_cost` `Financial_Event`/financial pair and one subtype-bearing `robot_repair` domain record. A multi-robot manual or automatic operation SHALL execute its per-robot events atomically as one operation, and the final balance/lifetime delta SHALL equal the sum of those per-robot charges. An automatic repair for a byed robot is a separate pre-battle repair event and is not attributed to the `Bye_Event` reward.

### Requirement 6: Unify and make settlement auditable with separate stored components

**Acceptance criteria:**

6.1 One `Settlement_Service` SHALL be the only mutating implementation used by `cycleScheduler.ts`, `adminCycleService.ts`, and any supported administrative trigger. It SHALL create separate `passive_income` and `operating_costs` events for each applicable stable and `Settlement_Cycle`, rather than a signed `settlement_adjustment` net row.

6.2 Each settlement component SHALL contain the `cycleNumber`, component identity, formula inputs needed for later reconciliation, typed `Financial_Breakdown`, signed amount, and resulting balance in its ledger/audit pair. Gross passive income and costs SHALL remain independently reportable.

6.3 Re-running a `Settlement_Cycle` for the same stable SHALL be safe through `Duplicate_Suppression`; it SHALL not pay passive income or charge operating costs twice.

6.4 The legacy admin daily-finance path SHALL remain available for `Admin_Compatibility`, but it SHALL delegate to the unified `Settlement_Service` or return a non-mutating preview. It SHALL not perform a second independent balance update. Existing response fields such as `summary.totalCostsDeducted`, `usersProcessed`, and `timestamp` SHALL remain available; additive fields are allowed.

6.5 The `/api/admin/cycles/bulk` path SHALL preserve its existing `includeDailyFinances` behavior and `settlement.finances` response shape while delegating the mutation to `Settlement_Service`.

6.6 Existing `passive_income` and `operating_costs` domain audit events needed by current cycle snapshots and admin diagnostics SHALL remain compatible during this spec. The new `financial_transaction` rows are the canonical financial pair; `Income_Dashboard` and `Cycle_Summary` migration to that pair is deferred.

6.7 Settlement tests SHALL cover zero income, zero costs, positive income, positive costs, both components together, reruns, partial-failure rollback, formula breakdowns, and admin-trigger compatibility.

6.8 For every applicable stable and `Settlement_Cycle`, `Settlement_Service` SHALL record exactly one `passive_income` component pair and one `operating_costs` component pair, including zero-valued components. A zero-valued component records a completed calculation with an unchanged `balanceAfter`; it is not an additional credit delta. The zero-component policy SHALL be consistent across scheduler and admin-trigger paths.

### Requirement 7: Record prestige separately at stable level and make growth graphable

**Acceptance criteria:**

7.1 No new `Financial_Ledger` row SHALL represent `Prestige_Award`; prestige points SHALL never be included in a credit `amount` or `balanceAfter`.

7.2 Every positive battle prestige source—1v1 league/tournament, 2v2/3v3 league, tag team, 2v2/3v3 team tournament, KotH, Grand Melee, and shared battle reward strategy—and every achievement prestige source SHALL call one `Prestige_Service` that writes one `Prestige_Audit_Record` with exact aggregate award amount, `source` `'battle'` or `'achievement'`, optional battle/achievement identity, and resulting `User.prestige`.

7.3 Team and placement rewards SHALL be aggregated at stable level before the audit row is written; the canonical amount SHALL not be reconstructed by summing rounded participant payload fields.

7.4 `Opening_Balance_Boundary` resets, season rollover resets, and zero-prestige `Bye_Event` outcomes SHALL not be recorded as positive `Prestige_Award` rows. Their existing lifecycle records remain distinct.

7.5 Prestige tests SHALL cover every source, team aggregation, achievement awards, zero-award paths, reset boundaries, and the absence of financial ledger rows.

7.6 Each `Prestige_Audit_Record` SHALL persist `eventTimestamp`, `cycleNumber`, stable/user identity, exact awarded amount, source, source event identity, optional mode/battle/achievement identity, and resulting prestige balance. These fields SHALL support a current-season `Prestige_Growth_Series` ordered by timestamp plus audit sequence without reconstructing earlier cycles. No prestige graph UI is part of this spec.

7.7 `Prestige_Audit_Record` SHALL be represented by an `AuditLog` row with `eventType` `'prestige_change'`, a typed payload, and a unique `sourceEventId` for the source award. The prestige row and `User.prestige` update SHALL be atomic, use `withAuditSequence`, return the original result for an identical retry, and reject a conflicting reuse of `sourceEventId` without changing prestige.

### Requirement 8: Keep subscriptions and lifecycle boundaries out of financial events

**Acceptance criteria:**

8.1 `Booking_Office` subscribe and unsubscribe operations SHALL remain free and SHALL create only their existing subscription/audit records; no `Financial_Ledger` row or `Financial_Audit_Record` may be emitted.

8.2 `Opening_Balance_Boundary` operations—account creation, account reset, season rollover, and explicit balance purge—SHALL be documented as lifecycle boundaries. They SHALL not be disguised as income, expense, settlement, or adjustment events.

8.3 Season rollover SHALL preserve the documented archive/purge behavior. Data from earlier cycles may remain or be purged according to existing lifecycle rules, but this spec SHALL not reconstruct, normalize, or repair it.

### Requirement 9: Define the forward-only ACC cutover and reconciliation boundary

**Acceptance criteria:**

9.1 The migration SHALL add the identity/pairing fields and constraints without rewriting immutable old amounts. New writes become authoritative from the selected `Cutover_Cycle` in `ACC` only after every writer is migrated and the ledger is active.

9.2 Existing valid or invalid pre-cutover ledger/audit rows SHALL remain queryable as-is where they survive normal retention. They SHALL not be silently relabelled, split, paired, or counted as proof of the new taxonomy's coverage.

9.3 No prestige, repair, settlement, battle, or other historical reconstruction SHALL be implemented. No one-off backfill/migration script may be added. The new services SHALL not accept an old payload as a substitute for a missing canonical post-cutover event.

9.4 Rollout SHALL use explicit `Rollout_Phase` gates—schema/client generation, writer migration, tests and coverage-manifest pass, activation in `ACC`, reconciliation, and removal of obsolete bypasses/feature-flag behavior. No `PRD` deployment environment or workflow is in scope.

9.5 Reconciliation diagnostics SHALL report unpaired post-cutover ledger rows, unpaired post-cutover financial audit rows, duplicate event identities, balance-after inconsistencies, invalid taxonomy/metadata, and uncovered direct credit writers. Diagnostics SHALL label pre-cutover data as outside the completeness claim rather than attempting to fix it.

### Requirement 10: Preserve admin compatibility and keep player-facing surfaces out of this change

**Acceptance criteria:**

10.1 This spec SHALL not modify `Income_Dashboard`, `Cycle_Summary`, financial-page components, financial-page layouts, charts, filters, report navigation, or report presentation behavior. The later `Financial_Page_Follow_On` SHALL consume the final `Transaction_Taxonomy`, paired records, `Financial_Breakdown`, and repair/prestige boundaries rather than reconstructing money from battle payloads.

10.2 The implementation SHALL update `.kiro/steering/coding-standards.md`, `.kiro/steering/database-best-practices.md`, `.kiro/steering/testing-strategy.md`, `.kiro/steering/project-overview.md`, `docs/game-systems/PRD_ECONOMY_SYSTEM.md`, `docs/game-systems/PRD_CYCLE_SYSTEM.md`, `docs/architecture/PRD_AUDIT_SYSTEM.md`, and `docs/guides/README.md`; it SHALL create `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md` with the final contract and operational procedure.

10.3 The documentation SHALL state the `Canonical_Source` for post-cutover credit questions (the paired `Financial_Ledger`/`Financial_Audit_Record` records), repair questions (`AuditLog` `robot_repair` rows), prestige questions (`AuditLog` `prestige_change` rows), subscription questions (Booking_Office records), and lifecycle questions (existing lifecycle/archive records), as well as the `Forward_Only_Cutover`/`ACC` policy, no-UI boundary, no-one-off-script rule, and verification commands.

10.4 `Admin_Compatibility` SHALL preserve the existing `/api/admin/daily-finances/process`, `/api/admin/cycles/bulk`, `/api/admin/audit-log`, `/api/admin/audit-log/repairs`, and `/api/admin/economy/overview` route contracts, including existing filter/response fields used by `CycleControlsPage`, `AuditLogPage`, `RepairLogPage`, and `EconomyOverviewPage`. New `financial_transaction` rows SHALL be queryable through the existing generic admin audit-log route without changing its response shape; the repair endpoint SHALL remain focused on subtype-bearing `robot_repair` records. The internals may delegate to shared services; no admin page redesign is required.

10.5 No `Player_Guide` article under `app/backend/src/content/guide/` SHALL be changed for this capture-only work. The existing `app/backend/tests/guide/content-validation.test.ts` SHALL remain a blocking content regression check. The new `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md` is an operator/developer guide, not player content.

### Requirement 11: Assess and consolidate every affected test tier

**Acceptance criteria:**

11.1 Backend unit coverage SHALL include taxonomy and `Financial_Breakdown` validation, event-identity construction/conflicts, battle row fan-out, reward aggregation, prestige aggregation/graph fields, settlement component construction, repair arithmetic, and subscription exclusion.

11.2 PostgreSQL integration coverage SHALL include atomic balance/ledger/audit rollback, unique-identity races, duplicate retries, all financial source families, all nine battle modes plus Bye_Event behavior, settlement reruns, lifecycle boundaries, post-cutover diagnostics, and admin endpoint compatibility.

11.3 Backend heavy coverage SHALL execute representative complete cycles through the real scheduler/admin-cycle paths, including team modes, tag team, tournaments, KotH, Grand Melee, automatic repairs, streaming, settlement, and duplicate/retry safety.

11.4 Frontend unit coverage SHALL retain and run the affected admin contract tests for `CycleControlsPage`, `RepairLogPage`, `EconomyOverviewPage`, and `AuditLogPage`; financial-page tests remain no-regression tests and their components are not changed.

11.5 Existing Playwright E2E coverage SHALL run for authenticated admin navigation/cycle controls and representative battle/result flows. No new UI E2E scenario is required unless an API response contract changes; any such change requires an explicit test and a corresponding scope decision.

11.6 Tests that only assert removed behavior SHALL be retired or replaced after the implementation inventory proves they are redundant: feature-flag-off/null ledger enrichment tests, acceptance of obsolete transaction labels, direct combined KotH/Grand Melee currency-update tests, and independent legacy daily-finance mutation tests. Formula, route, player-visible behavior, repair-log, financial-page regression, and battle-result tests SHALL be retained unless their covered behavior is demonstrably removed.
