# Financial Ledger Coverage Implementation Record

**Spec:** 53 — Financial Ledger Coverage (Backlog Item #59)  
**Status:** Code migration is recorded as complete; ACC activation, immutable `Cutover_Cycle` selection, and the remaining blocking verification gates are pending.  
**Cutover_Cycle:** Not recorded — this forward-only value is intentionally unavailable until all required rollout gates pass in ACC.

## Purpose and scope

This note is the implementation record for the Spec 53 capture boundary. The real balance field remains `User.currency`; the implementation does not introduce or substitute a `User.credits` field. The typed source of truth is [`app/backend/tests/factories/coverageManifest.ts`](../../app/backend/tests/factories/coverageManifest.ts), enforced by [`app/backend/tests/coverageManifest.test.ts`](../../app/backend/tests/coverageManifest.test.ts).

The migration inventory below records the pre-migration writers and prestige sources. The implemented system covers the nine scheduled battle modes, bye rewards, streaming, achievements, economic operations, repairs, settlement, free Booking Office changes, lifecycle boundaries, and compatible admin surfaces. It keeps the deliberate no-UI and no-player-guide-change boundary: no financial-page layout or `app/backend/src/content/guide/` article changes under this spec.

The implementation provides `Credit_Mutation_Service`, `Settlement_Service`, `Prestige_Service`, deterministic event identities, a nullable forward-only schema migration, post-cutover diagnostics, and paired financial audit records. Historical baseline wording is retained only to show the debt being removed; it does not describe the current writer architecture.

## Frozen taxonomy

The final `Transaction_Taxonomy` contains exactly these twelve `transactionType` values:

```text
battle_income
streaming_revenue
repair_cost
facility_upgrade
weapon_purchase
weapon_sale
weapon_refinement
robot_creation
attribute_upgrade
achievement_reward
passive_income
operating_costs
```

New production writers use the validated twelve-value taxonomy above. `subscription_cost`, `prestige_award`, and `settlement_adjustment` are rejected for new events and remain readable only where immutable pre-cutover `Legacy_Record` data survives. `financialService.ts` is retained solely as a compatibility guard: it rejects required post-cutover mutations that cannot create the atomic pair. Subscriptions and prestige remain non-credit domain records.

The final row contract is one balance mutation, one `FinancialLedger` row, and one paired `AuditLog` row with `eventType: 'financial_transaction'`, sharing one `financialEventId`. The two rows have different purposes:

- `FinancialLedger` is the accounting/reporting record.
- `AuditLog` is the immutable operational, security, sequence, and reconciliation record.
- The audit row is not a second balance mutation.

A positive stable-level prestige award is separate: one `AuditLog` row with `eventType: 'prestige_change'`, a unique `sourceEventId`, and no `FinancialLedger` row. Existing `battle_complete`, `robot_repair`, `passive_income`, and `operating_costs` rows remain domain compatibility records; they are not additional credit mutations.

## Historical `User.currency` writer baseline

The AST check originally discovered 22 direct `data: { currency: ... }` assignments in backend production code. The table is retained as the migration inventory: `Current source` means the pre-migration source, and `Final service` identifies the implemented target. The live direct-writer guard now permits only `Credit_Mutation_Service` and the explicit `Opening_Balance_Boundary` files (`userGeneration.ts`, `resetService.ts`, and `seasonPurgeService.ts`); current-economy writers must not bypass the shared service.

| ID | Current source | Current operation | Final service | Expected taxonomy/boundary | Identity and paired/domain records | Tier |
|---|---|---:|---|---|---|---|
| `currency-battle-simple-award` | `app/backend/src/services/battle/battlePostCombat.ts` — `awardCreditsToUser` | increment | `Credit_Mutation_Service` | `battle_income` | battle/match + stable + component; `FinancialLedger` + `financial_transaction` + existing battle record | Unit, Integration, Heavy |
| `currency-battle-ledger-award` | `app/backend/src/services/battle/battlePostCombat.ts` — `awardCreditsWithLedger` | increment | `Credit_Mutation_Service` | `battle_income` | battle/match + stable + component; atomic pair plus existing battle record | Unit, Integration, Heavy |
| `currency-streaming-award` | `app/backend/src/services/economy/streamingRevenueService.ts` — `awardStreamingRevenue` | increment | `Credit_Mutation_Service` | `streaming_revenue` | battle + participating robot + component; pair plus `BattleParticipant.streamingRevenue` | Unit, Integration, Heavy |
| `currency-koth-combined-award` | `app/backend/src/services/koth/kothBattleOrchestrator.ts` — `processKothBattle` | increment | `Battle_Financial_Reward_Service` | separate `battle_income` and `streaming_revenue` | KotH battle + stable/robot + component; pair(s), battle compatibility rows, and separate prestige | Unit, Integration, Heavy |
| `currency-grand-melee-combined-award` | `app/backend/src/services/grand-melee/grandMeleeBattleOrchestrator.ts` — `processGrandMeleeBattle` | increment | `Battle_Financial_Reward_Service` | separate `battle_income` and `streaming_revenue` | Grand Melee battle + stable/robot + component; pair(s), battle compatibility rows, and separate prestige | Unit, Integration, Heavy |
| `currency-achievement-reward` | `app/backend/src/services/achievement/achievementService.ts` — `AchievementService.checkAndAward` | increment | `Credit_Mutation_Service` + `Prestige_Service` | `achievement_reward`; prestige is nonfinancial | unlock + stable + component; pair, `achievement_unlock`, and separate prestige record | Unit, Integration, Heavy |
| `currency-weapon-purchase` | `app/backend/src/routes/weaponInventory.ts` — `POST /purchase` transaction | decrement | `Credit_Mutation_Service` | `weapon_purchase` | durable purchase operation + user + weapon; pair and existing purchase audit | Unit, Integration, Heavy |
| `currency-weapon-sale` | `app/backend/src/routes/weaponInventory.ts` — `DELETE /:id` resale transaction | increment | `Credit_Mutation_Service` | `weapon_sale` | durable resale operation + user + inventory; pair and sale audit | Unit, Integration, Heavy |
| `currency-weapon-refinement` | `app/backend/src/routes/weaponInventory.ts` — `POST /:id/refine` transaction | decrement | `Credit_Mutation_Service` | `weapon_refinement` | durable refinement operation + user + weapon; pair and refinement audit | Unit, Integration, Heavy |
| `currency-facility-upgrade` | `app/backend/src/routes/facility.ts` — `POST /upgrade` transaction | decrement | `Credit_Mutation_Service` | `facility_upgrade` | durable upgrade + user + facility transition; pair and facility audit | Unit, Integration, Heavy |
| `currency-robot-creation` | `app/backend/src/services/robot/robotCreationService.ts` — `createRobotTransaction` | decrement | `Credit_Mutation_Service` | `robot_creation` | durable creation operation + user + robot; pair plus robot/standing rows | Unit, Integration, Heavy |
| `currency-attribute-upgrade` | `app/backend/src/services/robot/robotUpgradeService.ts` — `executeUpgradeTransaction` | decrement | `Credit_Mutation_Service` | `attribute_upgrade` | durable upgrade + user + robot + ordered attributes; pair plus robot update | Unit, Integration, Heavy |
| `currency-manual-repair` | `app/backend/src/services/robot/robotRepairService.ts` — `repairAllRobots` | decrement | `Credit_Mutation_Service` | `repair_cost` with `repairType: 'manual'` | operation + robot; pair, `robot_repair`, and `lifetimeRepairCreditsPaid` | Unit, Integration, Heavy |
| `currency-automatic-repair` | `app/backend/src/services/economy/repairService.ts` — `repairRobots` | decrement | `Credit_Mutation_Service` | `repair_cost` with `repairType: 'automatic'` | operation + robot; pair, `robot_repair`, and lifetime total | Unit, Integration, Heavy |
| `currency-admin-repair` | `app/backend/src/services/admin/adminMaintenanceService.ts` — `repairAllRobotsAdmin` | decrement | `Credit_Mutation_Service` | `repair_cost` with `repairType: 'automatic'` when charged | admin operation + robot; pair and `robot_repair` | Unit, Integration, Heavy |
| `currency-scheduled-passive-income` | `app/backend/src/services/cycle/cycleScheduler.ts` — `executeSettlement` | increment | `Settlement_Service` | `passive_income` | stable + cycle + component; pair, `passive_income`, and cycle snapshot data | Unit, Integration, Heavy |
| `currency-scheduled-operating-costs` | `app/backend/src/services/cycle/cycleScheduler.ts` — `executeSettlement` | decrement | `Settlement_Service` | `operating_costs` | stable + cycle + component; pair, `operating_costs`, and cycle snapshot data | Unit, Integration, Heavy |
| `currency-admin-bulk-settlement` | `app/backend/src/services/admin/adminCycleService.ts` — `executeBulkCycles` | increment of net change | `Settlement_Service` | separate `passive_income` and `operating_costs` | stable + cycle + component; no net `settlement_adjustment` row | Unit, Integration, Heavy |
| `currency-legacy-daily-finances` | `app/backend/src/utils/economyCalculations.ts` — `processDailyFinances` | decrement | `Settlement_Service` | `operating_costs` | stable + cycle + component; pair plus compatibility summary | Unit, Integration, Heavy |
| `currency-generated-stable-opening-balance` | `app/backend/src/utils/userGeneration.ts` — `generateBattleReadyUsers` | set | `Opening_Balance_Boundary` | no taxonomy value | generated user creation identity; `User` and generated domain rows | Unit, Integration, Heavy |
| `lifecycle-account-reset` | `app/backend/src/services/common/resetService.ts` — `performAccountReset` | set | `Opening_Balance_Boundary` | no taxonomy value | reset identity; `resetLog`, deleted live rows, and reset User state | Unit, Integration |
| `lifecycle-season-rollover-reset` | `app/backend/src/services/season/seasonPurgeService.ts` — `resetCompetitiveAndEconomicState` | set | `Opening_Balance_Boundary` | no taxonomy value | season rollover/purge identity; archives, purged rows, and reset human stables | Unit, Integration, Heavy |

The database default used by `app/backend/src/services/auth/userService.ts` — `createUser` — is also listed as an account-creation boundary even though it is not a direct `data: { currency: ... }` assignment. Generated stables are explicitly initialized in `userGeneration.ts`; they are deleted at rollover rather than reset.

### Direct-writer guard

`app/backend/tests/factories/coverageManifest.ts` parses backend TypeScript with the TypeScript AST and looks for `data` object literals containing a `currency` property. It excludes:

- `app/backend/src/shared`, which is the symlink to `app/shared`;
- generated output and `dist`; and
- `src/**/__tests__` fixtures, which are not production writers.

The check compares each discovered file, operation, and per-file operation occurrence with the frozen manifest. A new current-economy writer fails the Unit-tier test before it can silently bypass the shared path. Current-economy entries are absent from the direct-writer set; only the enumerated `Opening_Balance_Boundary` operations remain outside the shared service.

## Historical `User.prestige` source inventory

Prestige is progression, not currency. The current positive source inventory has nine boundaries:

| Source | Current code boundary | Final record |
|---|---|---|
| 1v1 league | `app/backend/src/services/league/leagueBattleOrchestrator.ts` — `calculatePrestigeForBattle` and `updateRobotStats` | one stable-level `AuditLog` `prestige_change` row through `Prestige_Service` |
| 1v1 tournament | `app/backend/src/services/tournament/tournamentBattleOrchestrator.ts` — `processTournamentBattle` and `updateRobotStatsForTournament` consuming participant prestige | one stable-level `prestige_change` row after aggregate calculation |
| 2v2/3v3 league | `app/backend/src/services/team-battle/teamBattleRewardService.ts` — `calculateTeamBattlePrestige`, consumed by `executeSingleTeamBattle` | one stable-level row per positive stable award, before participant rounding |
| Tag Team | `app/backend/src/services/tag-team/tagTeamRewards.ts` — `calculateTagTeamPrestige`, consumed by `updateTagTeamBattleResults` | one stable-level row per positive team award |
| 2v2/3v3 tournaments | `app/backend/src/services/tournament/teamTournamentBattleOrchestrator.ts` — `calculateTeamTournamentPrestige` | one stable-level row with round/team-size source facts |
| KotH | `app/backend/src/services/koth/kothBattleOrchestrator.ts` — `calculateKothRewards` | one stable-level row from the placement reward aggregate |
| Grand Melee | `app/backend/src/services/grand-melee/grandMeleeRewards.ts` — `calculateGrandMeleeRewards` | one stable-level row from the placement reward aggregate |
| Shared battle strategy | `app/backend/src/services/battle/battleStrategy.ts` — `BattleStrategy.calculateRewards` and `BattleProcessor.process` `reward?.prestige` path | one stable-level row when the strategy produces a positive award |
| Achievements | achievement definitions' `rewardPrestige`, consumed by `app/backend/src/services/achievement/achievementService.ts` — `AchievementService.checkAndAward` | one `prestige_change` row with achievement `sourceEventId` |

Historical pre-migration direct writers were the shared `awardPrestigeToUser` in `battlePostCombat.ts`, the combined `User.update` operations in `processKothBattle`, `processGrandMeleeBattle`, and `AchievementService.checkAndAward`, plus the reset sets in `performAccountReset` and `resetCompetitiveAndEconomicState`. The reset sets are lifecycle boundaries, not positive sources. Bye rewards always carry zero prestige and must not create a positive prestige record.

`Prestige_Service` persists the source (`'battle'` or `'achievement'`), exact aggregate amount, stable/user identity, cycle/timestamp, source event identity, optional mode/battle/achievement identity, and resulting `User.prestige`. It uses `withAuditSequence`, returns the original result for an identical retry, and rejects a conflicting `sourceEventId` without changing prestige.

## Battle modes and `Bye_Event` boundaries

The nine scheduled modes are:

```text
league_1v1, tournament_1v1, tag_team, koth,
league_2v2, league_3v3, tournament_2v2, tournament_3v3, grand_melee
```

Every fought mode uses `Battle_Financial_Reward_Service`, which aggregates `battle_income` at stable level and emits `streaming_revenue` per eligible robot. The concrete boundaries are:

- `league_1v1`: `leagueBattleOrchestrator.ts` — `processBattle`;
- `tournament_1v1`: `tournamentBattleOrchestrator.ts` — `processTournamentBattle`;
- `tag_team`: `tagTeamResultUpdater.ts` — `updateTagTeamBattleResults`;
- `koth`: `kothBattleOrchestrator.ts` — `processKothBattle`;
- `league_2v2` and `league_3v3`: `teamBattleOrchestrator.ts` — `executeSingleTeamBattle` with team size 2 or 3;
- `tournament_2v2` and `tournament_3v3`: `teamTournamentBattleOrchestrator.ts` — `executeTeamTournamentRound` with team size 2 or 3; and
- `grand_melee`: `grandMeleeBattleOrchestrator.ts` — `processGrandMeleeBattle`.

There are **five actual direct caller expressions** of `resolveByeEvent`, not six:

| Caller boundary | Current source | Modes | Claim identity |
|---|---|---|---|
| League bye | `app/backend/src/services/league/leagueBattleOrchestrator.ts` — `processByeBattle` | `league_1v1` | `scheduled_matches_v2.id` + stable + bye component |
| Team league bye | `app/backend/src/services/team-battle/teamBattleOrchestrator.ts` — `resolveTeamLeagueBye` | `league_2v2`, `league_3v3` | `scheduled_matches_v2.id` + team stable + bye component |
| Tag Team bye | `app/backend/src/services/tag-team/tagTeamScheduler.ts` — `resolveTagTeamBye` | `tag_team` | `scheduled_matches_v2.id` + team stable + bye component |
| Tournament bye | `app/backend/src/services/tournament/tournamentService.ts` — `completeByeMatch` | `tournament_1v1`, `tournament_2v2`, `tournament_3v3` | `scheduled_tournament_matches.id` + round + bye component |
| Thin placement-instance bye | `app/backend/src/services/scheduling/thinInstanceByes.ts` — `resolvePlacementBye` | `koth`, `grand_melee` | `scheduled_matches_v2.id` + robot stable + bye component |

The implementation is `app/backend/src/services/battle/byeResolutionService.ts` — `resolveByeEvent`. A `Bye_Event` is detected before absent-side loading or combat simulation. It creates only the mode-scaled participation-floor `battle_income` pair and its inert battle/domain records. It creates no streaming revenue, prestige, fame, draw, or combat repair spend. Normal pre-battle automatic repair still includes a byed robot with pre-existing damage through the ordinary event scope; that separate `repair_cost` event is not attributed to the bye.

The claim is taken before payment. `scheduled_matches_v2.status` is the claim token for unified scheduled matches; `scheduled_tournament_matches.battleId` is the tournament claim boundary. A retry with the same claim must not pay twice.

## Streaming and achievement boundaries

### Streaming

The formula and current data source are in `app/backend/src/services/economy/streamingRevenueService.ts`:

- `computeStreamingRevenue` is the formula source;
- `calculateStreamingRevenue` and `calculateStreamingRevenueBatch` calculate per robot; and
- `awardStreamingRevenue` routes the signed award through `Credit_Mutation_Service`.

The final `streaming_revenue` identity is battle/match + robot + component. It records the base amount, battle-count multiplier, fame multiplier, Studio level multiplier, eligibility, and final amount in `Financial_Breakdown`. KotH and Grand Melee must use the same per-robot path; a bye never earns streaming revenue.

### Achievements

`AchievementService.checkAndAward` creates `UserAchievement`, applies credits through `Credit_Mutation_Service` using `achievement_reward`, applies any positive prestige through `Prestige_Service`, and writes the existing achievement audit event. The unlock identity is carried through retries; `achievement_unlock` remains a domain compatibility record and is not a second credit mutation.

## Repairs and the canonical `Repair_Spend` source

The three repair boundaries are:

- `Manual_Repair`: `app/backend/src/services/robot/robotRepairService.ts` — `repairAllRobots`;
- `Automatic_Repair`: `app/backend/src/services/economy/repairService.ts` — `repairRobots` and `repairRobotsForEvent`; and
- charged admin maintenance: `app/backend/src/services/admin/adminMaintenanceService.ts` — `repairAllRobotsAdmin`.

All three target `repair_cost` with mandatory `repairType: 'manual' | 'automatic'`. The arithmetic remains solely in `app/shared/utils/repairCost.ts`: `calculateRepairQuote`, `applyManualRepairDiscount`, and `calculateRepairBayDiscountPercent`. Manual batches quote, discount, round, and identify each robot before summing.

The reporting `Canonical_Source` is `audit_logs`/`AuditLog` rows with:

```text
eventType: 'robot_repair'
payload.creditsCharged
payload.repairType
```

Readers include `cycleProgressService.ts`, the admin repair-log path, and robot/stable analytics. Repair spend is never read from `battle_complete` payloads, `robots.repairQuoteCredits` (the cached forward-looking quote), or a subtype-losing `financial_ledger` sum. Each repaired robot has one repair financial pair and one subtype-bearing `robot_repair` domain record. An automatic repair for a byed robot remains a normal event-scope repair, separate from the bye reward.

## Settlement implementation sources (historical migration inventory)

The table preserves the pre-migration entry points and their implemented unified path:

| Pre-migration entry point | Historical behavior | Implemented path |
|---|---|---|
| `app/backend/src/services/cycle/cycleScheduler.ts` — `executeSettlement` | Separate direct passive-income and operating-cost balance updates with domain events and cycle data | `Settlement_Service`, one `passive_income` pair and one `operating_costs` pair per stable/cycle, including zero components |
| `app/backend/src/services/admin/adminCycleService.ts` — `executeBulkCycles` | Calculated passive income and costs, then applied one net `User.currency` mutation | `Settlement_Service`, separate `passive_income` and `operating_costs` components; no net `settlement_adjustment` row |
| `app/backend/src/utils/economyCalculations.ts` — `processDailyFinances` / `processAllDailyFinances` | Legacy per-user operating-cost debit and batch wrapper | `Settlement_Service` delegation or non-mutating preview |
| `app/backend/src/routes/adminMaintenance.ts` — `POST /daily-finances/process` | Admin compatibility route invoked the legacy batch path | Delegates while preserving `summary.totalCostsDeducted`, `usersProcessed`, and `timestamp` |

Settlement identity is stable user + cycle + component (`passive_income` or `operating_costs`). The persisted breakdown records Merchandising Hub level, prestige, roster capacity/normalization, facility/roster cost components, and rounding. Streaming Studio battle revenue remains `streaming_revenue`, not passive settlement income. Scheduler and admin paths share the zero-valued component policy and cannot pay or charge twice on rerun.

## Booking Office subscriptions

Subscription writes use one core path in `app/backend/src/services/subscription/subscriptionService.ts`:

- `applySubscriptionChange` is the shared write implementation;
- `subscribeRobot` and `unsubscribeRobot` are thin single-event wrappers; and
- the bulk subscription route delegates to the same operation.

The event types are all nine battle modes listed above. Subscribing under the cap is free, unsubscribing is free and immediate, and an outstanding scheduled obligation continues to occupy its slot. These writes create subscription/domain audit records only. They never create a `FinancialLedger` row or a `financial_transaction` audit row, and no `subscription_cost` taxonomy value is allowed for new work.

## Lifecycle boundaries

The following are `Opening_Balance_Boundary` operations, not current-economy events:

1. `app/backend/src/services/auth/userService.ts` — `createUser` and the schema default for a human account.
2. `app/backend/src/utils/userGeneration.ts` — `generateBattleReadyUsers`, which explicitly creates generated stables with an opening balance. Generated stables are deleted rather than reset at rollover.
3. `app/backend/src/services/common/resetService.ts` — `performAccountReset`, which resets User state and writes `resetLog`.
4. `app/backend/src/services/season/seasonRolloverService.ts` — `executeSeasonRollover`, delegating to archive/purge services.
5. `app/backend/src/services/season/seasonPurgeService.ts` — `resetCompetitiveAndEconomicState`, which purges season-scoped data and restores human stables to starting values.

Season rollover retains only the documented archive tables and permitted account/profile/image data. It does not reconstruct, normalize, relabel, split, or repair old financial rows. No pre-cutover row is evidence of post-cutover completeness.

## Admin compatibility surfaces

The following routes remain part of the baseline and must retain their current response/filter contracts while later services are introduced:

- `app/backend/src/routes/adminMaintenance.ts`: `POST /repair/all`, `POST /recalculate-hp`, `POST /daily-finances/process`, `POST /cycles/bulk`, `GET /scheduler/status`, and `POST /scheduler/trigger/:jobName`;
- `app/backend/src/routes/adminUsers.ts`: `GET/POST /audit-log` and `GET /audit-log/repairs`;
- `app/backend/src/routes/adminAnalytics.ts`: `GET /economy/overview`; and
- `app/backend/src/routes/adminSeasons.ts`: `GET /rollover-preview` and `POST /rollover`.

`/api/admin/audit-log` can query `financial_transaction` rows without breaking existing fields and filters. `/api/admin/audit-log/repairs` remains focused on subtype-bearing `robot_repair` rows and `creditsCharged`. `/api/admin/economy/overview` remains compatible with the existing admin economy page. The bulk-cycle response retains `includeDailyFinances`, `settlement.finances`, `totalPassiveIncome`, `totalOperatingCosts`, `usersProcessed`, and `skipped`.

## Test-tier baseline

The typed manifest records all five existing tiers:

| Tier | Command | Baseline surfaces |
|---|---|---|
| Unit | `pnpm run test:unit` | `tests/coverageManifest.test.ts`, taxonomy/identity/formula tests, repair properties, direct-writer guard |
| PostgreSQL Integration | `pnpm run test:integration` | financial/finance reports, credit audit trail, admin contracts, repair audit, mode and bye workflows |
| Heavy | `pnpm run test:heavy` | full cycles, bulk admin cycles, team/tag/tournament/KotH/Grand Melee, bye scope/repair, settlement behavior |
| Frontend | `pnpm run test:ci` | existing admin page and player financial/report regressions; no new financial page |
| E2E | `pnpm exec playwright test` | `app/frontend/tests/e2e/financial-flow.spec.ts`, authenticated admin and battle/result flows |

Existing tier partitioning is authoritative in `app/backend/jest.tiers.js` and `scripts/verifyTiers.ts`. The final spec gate requires lint, build, test typecheck, tier verification, all backend tiers, frontend lint/build/unit, and Playwright. Task Group 1 runs only the focused manifest Unit-tier check.

## No-UI and Player_Guide boundary

This baseline does not add or redesign `Income_Dashboard`, `Cycle_Summary`, or any financial-page layout. The following existing files remain unchanged by Task Group 1 and are retained as regression surfaces:

- `app/frontend/src/pages/FinancialReportPage.tsx`;
- `app/frontend/src/pages/CycleSummaryPage.tsx`;
- `app/frontend/src/pages/admin/CycleControlsPage.tsx`;
- `app/frontend/src/pages/admin/RepairLogPage.tsx`;
- `app/frontend/src/pages/admin/EconomyOverviewPage.tsx`;
- `app/frontend/src/pages/admin/AuditLogPage.tsx`; and
- `app/frontend/src/utils/financialApi.ts`.

`app/frontend/tests/e2e/financial-flow.spec.ts` remains an existing regression test. The later `Financial_Page_Follow_On` may consume corrected records, but it is not part of this capture baseline.

The `Player_Guide` under `app/backend/src/content/guide/` is also unchanged. Its existing validation test, `app/backend/tests/guide/content-validation.test.ts`, remains a blocking regression surface. This task changes no player-visible formula or reward rule and does not rewrite guide articles.

## Validation performed for this baseline

The focused command run for this task was:

```text
pnpm exec jest --config jest.config.unit.js tests/coverageManifest.test.ts --runInBand
```

Result: **1 suite passed, 5 tests passed**. No full backend, frontend, integration, heavy, or E2E suite was run, and no schema/service migration was made.

## Task Group 8 implementation note: forward-only ACC rollout and diagnostics

**Spec:** 53 — Financial Ledger Coverage  
**Task group:** 8 — Enforce lifecycle boundaries, forward-only ACC cutover, and diagnostics

### Durable rollout state and ordered gates

The rollout authority is persisted in `cycle_metadata.feature_flags.financial_rollout`; it is not an environment-only switch and it does not require a new Prisma model. The typed state records the current phase, each completed gate, and the immutable `cutoverCycle` once ACC is recorded. The ordered phases are:

```text
schema_client_generation
writer_manifest_completion
blocking_tests
required_capture_activation
acc_cutover
reconciliation
documentation
```

`recordAccCutover()` refuses to select a `Cutover_Cycle` until schema/client generation, writer/manifest completion, blocking tests, and required capture activation have all passed. Once recorded, the cycle is immutable: `cycleNumber >= cutoverCycle` is `post_cutover`, and earlier cycles are `pre_cutover`. Reconciliation and documentation remain explicit completion gates after cutover; they cannot be silently inferred from the cutover write.

The production direct-writer scanner in `app/backend/src/services/migration/directWriterCoverage.ts` parses `app/backend/src` with the TypeScript AST. It excludes the symlinked shared directory, generated output, `dist`, and test fixtures. Only `Credit_Mutation_Service` and the explicit opening-balance files (`userGeneration.ts`, `resetService.ts`, and `seasonPurgeService.ts`) are allowed direct `User.currency` assignments. The Coverage_Manifest test now reflects the completed writer migration: the shared service plus the three lifecycle assignments are the four discovered direct assignments; current-economy writers remain represented as service targets and historical baseline entries, but are no longer direct assignment expectations.

### Forward-only evidence boundary

Post-cutover completeness is claimed only for cycles at or after the selected `Cutover_Cycle`. Pre-cutover findings remain useful diagnostic history but are labeled outside the completeness claim with their evidence boundary; they are not paired, relabeled, backfilled, or used to infer missing coverage. No one-off reconstruction script was added. In particular, diagnostics never derive financial amounts from `battle_log`, `battle_complete` payloads, achievement payloads, cached repair quotes, legacy ledger rows, current facilities/prestige/fame, or current formula code.

Season archive and purge behavior remains unchanged. Account creation, generated-stable creation, account reset, season rollover, and explicit balance purge remain `Opening_Balance_Boundary` operations with no transaction-taxonomy value. Generated stables are deleted at rollover; human stables are archived/purged and reset through the existing lifecycle service. These boundaries are deliberately excluded from current-economy capture rather than being converted into financial events.

### Pre-cutover compatibility and fail-closed required capture

Before `Cutover_Cycle`, `Credit_Mutation_Service` preserves the usable legacy economy path: it applies the balance mutation inside the caller transaction and may perform compatible legacy ledger enrichment when that legacy feature is enabled. It intentionally does not create or claim a paired financial audit record for this period, because pre-cutover history is outside the paired-capture completeness claim.

At and after cutover, `Credit_Mutation_Service` checks the durable rollout state before every new financial mutation. Required capture cannot be disabled by a null or false feature flag. The legacy `financialService.recordTransaction()` path rejects post-cutover mutations because it cannot create the required atomic pair, and `recordLedgerEntry.ts` propagates required post-cutover failures instead of logging and returning success. A required mutation therefore either commits the balance, `FinancialLedger` row, and paired `financial_transaction` `AuditLog` row together, or rolls back; it cannot leave a balance change with a missing pair.

### Post-cutover diagnostic coverage

`financialIntegrityDiagnostics.ts` adds forward-only checks for:

- unpaired ledger and financial-audit rows;
- duplicate identities and conflicting identity facts;
- invalid transaction taxonomy and malformed `Financial_Breakdown` values;
- `balanceAfter` inconsistencies;
- repair subtype mismatches (`manual` versus `automatic`);
- missing `passive_income` or `operating_costs` settlement components;
- positive prestige source gaps; and
- direct currency writers outside the shared service and enumerated lifecycle boundaries.

`dataIntegrityService.ts` runs these financial checks only for post-cutover evidence and attaches `evidenceBoundary` and `completenessClaim` labels to findings. The existing pre-cutover integrity checks remain available without incorrectly presenting legacy history as complete ACC coverage.

### Scope boundary

This group adds rollout authority, migration/coverage enforcement, fail-closed financial error handling, diagnostics, the required shared writer migrations, focused tests, and this implementation record. It does not add historical reconstruction, alter financial-page or dashboard UI, or modify `app/backend/src/content/guide/` player-facing content.

### Validation performed

- Focused rollout/financial Unit-tier command: **4 suites passed, 23 tests passed** (`financialRollout`, `financialService`, financial-ledger property, and `creditMutationService`).
- Coverage_Manifest Unit-tier command: **1 suite passed, 5 tests passed**.
- Test-tier partition verification: **passed** — 265 unit suites, 113 integration suites, 23 heavy suites, 401 discovered files, each assigned to exactly one tier.
- ESLint on touched production rollout/diagnostic/financial files: **0 errors**; two unused-variable warnings remain (`mutationFacts` and `TRANSACTION_TYPES`).
- Backend build was started but produced only the pnpm/TypeScript command header with no completion output; it was stopped as inconclusive rather than retried indefinitely.
- `typecheck:tests` was started and produced no diagnostics or completion output before it was stopped as inconclusive.
- The focused PostgreSQL integration run could not execute its assertions because the configured database was unavailable. Prisma setup failed with `code: "ECONNREFUSED"` (`modelName: "Weapon"`); the fresh run reported **1 failed suite and 12 failed tests**, all blocked by that environment condition. No integration test was weakened or made advisory.

### Current verification record

The following later checks supplement the focused evidence above. They do not select a `Cutover_Cycle` or activate ACC capture:

- `pnpm run test:tiers:verify`: **passed** — 271 unit suites, 112 integration suites, 23 heavy suites, and 406 discovered test files, each assigned to exactly one tier.
- `pnpm run test:unit`: **passed** — 271 suites and 3912 tests after the final scanner, scheduling, and bye-counter corrections.
- `pnpm run test:integration`: **passed** — 112 suites and 1474 tests on the completed financial-capture implementation; no later production change alters an integration-only financial path.
- `pnpm run test:heavy`: **passed** — 23 suites and 244 tests in 70.979 seconds after the final corrections. Jest then force-exited because of known open handles after reporting the successful result.
- Backend `lint`, `build`, and `typecheck:tests` previously emitted only their command headers without a completion result; they remain inconclusive and were not retried.
- Frontend `build` **passed** (Vite production build); frontend `test:ci` **passed** (192 files, 1945 passed, 3 skipped). Frontend lint emitted only its command header and remained runner-inconclusive.
- Playwright E2E remains incomplete: the backend started, but the setup project stalled while authenticating `test_user_001` after an application error. The run was stopped without a trustworthy suite result, and no test data was changed merely to force it through.

The required rollout gate is therefore **not complete**: no `Cutover_Cycle` has been selected, and the spec remains in `to-do` until every required validation result is successfully recorded.