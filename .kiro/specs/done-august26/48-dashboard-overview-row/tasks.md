# Implementation Plan: Dashboard Overview_Row

## Overview

This plan implements Spec #48 — three Dashboard tiles built from one shared Dashboard_Tile, one new
authenticated read (`GET /api/dashboard/current-cycle`), and the repair-figure corrections the
Credits_Tile rests on: one repair cost implementation, one repair spend source, correct manual repair
audit figures, `repair_cost` ledger coverage, and self-describing names for the four
Repair_Figure_Stores. One Prisma migration (two column renames). 18 task groups, 116 tasks.

**Ordering rationale.** The order is fixed by three constraints:

1. **The parity tests are written before the code they pin.** The Repair_Cost_Parity_Test captures
   literal expected values from the pre-consolidation implementation, and the
   Repair_Audit_Parity_Test must be observed *failing* against today's double-discount before the fix
   lands. Neither can be written after the change it guards.
2. **The corrections come before the renames.** The two Prisma column renames touch roughly forty test
   fixtures and five frontend files. Landing them first would mean every correction afterwards fights
   fixture churn, so they are the last code task group.
3. **The dead-read removal comes before the JSON key rename**, because both edit
   `cycleSnapshotService.aggregateStableMetrics` and the deletion is unconditional while the rename
   introduces a resolver the same function then uses.

## Task Dependency Graph

```json
{
  "waves": [
    {"name": "Wave 1 — Baseline and parity capture", "tasks": ["Task Group 1"]},
    {"name": "Wave 2 — Shared module, dead reads, tile shell", "tasks": ["Task Group 2", "Task Group 8", "Task Group 13"]},
    {"name": "Wave 3 — Call-site migration", "tasks": ["Task Group 3", "Task Group 4"]},
    {"name": "Wave 4 — Per-robot charge", "tasks": ["Task Group 5"]},
    {"name": "Wave 5 — Audit fix and ledger", "tasks": ["Task Group 6", "Task Group 7"]},
    {"name": "Wave 6 — JSON key renames", "tasks": ["Task Group 9"]},
    {"name": "Wave 7 — Prohibition test and cycle service", "tasks": ["Task Group 10", "Task Group 11"]},
    {"name": "Wave 8 — Endpoint", "tasks": ["Task Group 12"]},
    {"name": "Wave 9 — The three tiles", "tasks": ["Task Group 14"]},
    {"name": "Wave 10 — Row assembly and old-card removal", "tasks": ["Task Group 15"]},
    {"name": "Wave 11 — Prisma column renames", "tasks": ["Task Group 16"]},
    {"name": "Wave 12 — Documentation", "tasks": ["Task Group 17"]},
    {"name": "Wave 13 — Verification", "tasks": ["Task Group 18"]}
  ]
}
```

- **Wave 1**: TG1 alone. A red baseline makes every later parity signal unreadable, and the captured
  literals must come from code the consolidation has not touched.
- **Wave 2**: TG2 (shared module surface), TG8 (dead reads and the CSV column) and TG13
  (Dashboard_Tile) share no files and run in parallel.
- **Wave 3**: TG3 and TG4 both depend on TG2's new surface; they touch disjoint files.
- **Wave 4**: TG5 depends on TG3 — the per-robot charge is expressed with the consolidated function.
- **Wave 5**: TG6 and TG7 both depend on TG5's `chargedPerRobot`.
- **Wave 6**: TG9 depends on TG8 (both edit `aggregateStableMetrics`) and on TG6 (both edit the
  `logRobotRepair` call).
- **Wave 7**: TG10 and TG11 depend on TG9's resolvers.
- **Wave 8**: TG12 depends on TG11's service.
- **Wave 9**: TG14 depends on TG13's primitives and TG12's response type.
- **Wave 10**: TG15 depends on TG14.
- **Wave 11**: TG16 last of the code, so its fixture churn blocks nothing.
- **Wave 12**: TG17 after all code, so the documentation describes what shipped.
- **Wave 13**: TG18 runs the Verification Criteria against the finished tree.

## Tasks

### Task Group 1: Baseline and Parity Expectation Capture

_Requirements: 15.13, 15.14, 15.15_

- [x] 1.1 Run the backend unit suite (`cd app/backend && pnpm run test:unit`) and the frontend suite (`cd app/frontend && pnpm test -- --run`) and record the result. The earlier Dashboard refactor in this session was never verified against the full backend suite. Any pre-existing failure is fixed or explicitly reported before Task Group 2 begins.
- [x] 1.2 Write a throwaway capture script that calls the pre-consolidation `calculateRepairCost` in `app/backend/src/utils/robotCalculations.ts` across the seven-case matrix in design § 3.6 (0% HP, 5% of max, 40% of max, 100% of max, Repair Bay level 0, level 2 with 5 active robots, and a level/count product above the 90% cap) and prints the returned credits. **Delete the script in this same task** — it is scaffolding, not a deliverable.
- [x] 1.3 Create `app/backend/tests/unit/repairCostParity.test.ts` (the Repair_Cost_Parity_Test) asserting each case against its captured literal, never against a call to the consolidated function, so the test can fail. Add the multi-robot case asserting that a manual repair of two or more robots charges the sum of the per-robot Charged_Repair_Costs, with a comment stating that this case is deliberately *not* a parity assertion because Requirement 15 criterion 12 sanctions a figure up to N−1 credits below today's batch rounding.
- [x] 1.4 Confirm `repairCostParity.test.ts` passes against the current, unmodified code. It must be green before the module is touched, so that a later failure means the consolidation changed a charged amount.

### Task Group 2: Shared_Repair_Module Final Surface

_Requirements: 15.1, 15.2, 15.4, 15.5, 15.9, 15.10, 15.16, 15.17, 17.6_

- [x] 2.1 Rewrite `app/shared/utils/repairCost.ts` to the surface in design § 3.1: export `calculateRepairQuote(subject, context)`, `applyManualRepairDiscount(quote)`, `calculateRepairBayDiscountPercent(context)`, `sumAttributes(robot)`, `MANUAL_REPAIR_DISCOUNT`, `MAX_REPAIR_BAY_DISCOUNT_PERCENT`, and the `RepairCostRobot`, `RepairBayContext` and `RepairQuoteSubject` types. `calculateRepairQuote` accepts either the robot form or the explicit `{ attributeTotal, damagePercent, hpPercent }` form, so the yield-threshold scenario table can price a hypothetical.
- [x] 2.2 Drop the `calculateRepairCost`, `calculateRobotRepairCost` and `calculateRepairBayDiscount` exports. Keep `sumAttributes` — the robot form of `calculateRepairQuote` needs it and the Frontend estimate needs a Decimal-tolerant attribute sum. **Delete no file under `app/backend/src/shared/utils/`**: that directory is a symlink to `app/shared/utils`, so deleting through it would delete the Shared_Repair_Module itself.
- [x] 2.3 Compute the Repair_Quote as attribute total × 100 × (damage percent ÷ 100) × Damage_Multiplier × (1 − Repair_Bay_Discount), and the Repair_Bay_Discount as `min(90, repairBayLevel × (5 + activeRobotCount)) / 100`. Preserve the rounding split exactly: `Math.round` on the quote, `Math.floor` on the manually discounted amount. Return `0` for an undamaged robot.
- [x] 2.4 Throw `RangeError` from both `calculateRepairQuote` and `applyManualRepairDiscount` when an attribute total, damage percentage, HP percentage, Repair Bay level, active robot count or quote is negative or non-finite. A plain `RangeError` is used rather than an `AppError` subclass because this module is imported by the Frontend and must not depend on `src/errors/`.
- [x] 2.5 Update the `app/shared/utils/index.ts` barrel to the new surface. One edit covers both views of the file through the symlink. No caller imports the repair symbols through the barrel today, so this is a consistency change with no call-site consequence.
- [x] 2.6 Create `app/backend/tests/unit/repairCost.pbt.test.ts` implementing Property 25 (the Repair_Quote formula is exact, bounded and monotonic) and Property 27 (bad input signals an error), at 500 iterations each, with the design-property tag comment on each test.

### Task Group 3: Backend Migration off `robotCalculations.calculateRepairCost`

_Requirements: 15.3, 15.6, 15.7, 15.13_

- [x] 3.1 Delete the `calculateRepairCost` declaration from `app/backend/src/utils/robotCalculations.ts`. Keep `calculateAttributeSum` — it computes an attribute total rather than performing arithmetic on one. Do **not** re-export the shared function under the old name: that would keep the six-argument positional signature and its dead `_medicalBayLevel` placeholder alive, which is the shape that made the double-discount easy to write.
- [x] 3.2 Update `app/backend/src/services/robot/robotRepairService.ts` to import `calculateRepairQuote`, `applyManualRepairDiscount` and `calculateRepairBayDiscountPercent` from `../../shared/utils/repairCost`.
- [x] 3.3 Update `app/backend/src/services/economy/repairService.ts` to obtain each robot's Repair_Quote from `calculateRepairQuote`.
- [x] 3.4 Update `app/backend/src/services/admin/adminMaintenanceService.ts` to use the robot form of `calculateRepairQuote`, dropping its local `calculateAttributeSum` + `calculateRepairCost` pairing.
- [x] 3.5 At both repair paths, catch the `RangeError` from task 2.4 and rethrow it as `RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, …, 400)` so the response shape stays consistent with the rest of the robot routes.
- [x] 3.6 Update `app/backend/tests/stanceAndYield.test.ts` (rename the `calculateRepairCost` describe block to `calculateRepairQuote` using the explicit-numbers subject form, expected values unchanged) and `app/backend/tests/manualRepairDiscount.property.test.ts` (import from the Shared_Repair_Module, assert against `calculateRepairQuote`).
- [x] 3.7 Re-run `repairCostParity.test.ts`. It must still pass with its literals untouched — that is the proof the consolidation charged nobody a different amount.

### Task Group 4: Frontend Migration off Its Two Local Repair Implementations

_Requirements: 15.8, 15.9, 15.11_

- [x] 4.1 Update `app/frontend/src/hooks/useRobotsList.ts`: `calculateRobotRepairCost` → `calculateRepairQuote({ robot }, ctx)`, `calculateRepairBayDiscount` → `calculateRepairBayDiscountPercent`, and replace the batch-level `totalBaseCost × MANUAL_REPAIR_DISCOUNT` with a per-robot `applyManualRepairDiscount` followed by a sum. This is a correctness change, not tidiness: Task Group 5 makes the charged amount a per-robot-then-sum figure, so the batch estimate the confirmation dialog shows today would sit up to N−1 credits above what the player is charged. Keep the import path `../../../shared/utils/repairCost`.
- [x] 4.2 Delete the local non-exported `calculateRepairCost` and its accompanying attribute-sum loop from `app/frontend/src/components/YieldThresholdSlider.tsx`, replacing them with `calculateRepairQuote({ attributeTotal, damagePercent, hpPercent }, { repairBayLevel, activeRobotCount })`. Confirm the rendered scenario figures are unchanged, or record the difference if the inline copy had drifted — that drift is the reason this consolidation is in the spec.
- [x] 4.3 Have the Frontend treat a thrown `RangeError` as "estimate unavailable" and disable the repair confirmation, rather than rendering a wrong or negative number.

### Task Group 5: Per-Robot-Then-Sum Manual Charge

_Requirements: 15.11, 15.12, 18.6_

- [x] 5.1 In `robotRepairService.repairAllRobots`, replace `Math.floor(totalBaseCost * MANUAL_REPAIR_DISCOUNT)` with `chargedPerRobot = robotsNeedingRepair.map(r => ({ robotId: r.id, charged: applyManualRepairDiscount(r.calculatedRepairCost) }))` and `finalCost = chargedPerRobot.reduce(…)`. The fixed order is: quote each robot, discount each robot, then sum.
- [x] 5.2 Add `chargedPerRobot` to `RepairAllResult` so the route can log and record the ledger without recomputing. Leave the existing `preDiscountCost` response field equal to `totalBaseCost` — it is a response field, not a Repair_Spend_Source figure.
- [x] 5.3 Increment Lifetime_Repair_Spend from the same per-robot figure, so the deduction and the increment can no longer disagree through two different roundings.
- [x] 5.4 Create `app/backend/tests/unit/manualRepairCharge.pbt.test.ts` implementing Property 26 (a manual batch reconciles to the credit across all four records) and Property 29 (the fix never lowers a Repair_Spend figure), at 500 iterations, with a comment recording that the deduction may be up to N−1 credits below today's batch figure for a batch of N and that this is sanctioned.

### Task Group 6: Correct the Manual Repair Audit Figures

_Requirements: 6.11, 9.17, 18.1, 18.2, 18.3, 18.4, 18.5, 18.7, 18.8, 18.9, 18.10, 18.11, 18.14_

- [x] 6.1 Create `app/backend/tests/unit/repairAuditParity.test.ts` (the Repair_Audit_Parity_Test) with the four cases from design § 4.4: Repair Bay level 2 with 5 active robots (20%), a level and count giving exactly 90%, a manual batch of three robots, and one Automatic_Repair_Path repair. Derive every expected value from the Repair_Quote and the Manual_Repair_Discount alone — never from the logged payload or the handler under test.
- [x] 6.2 Run it against the unfixed code and **record the failure**. The 20% case must record 80% of the truth and the 90% case a tenth of it. A test that passes here is not testing the bug.
- [x] 6.3 In the audit loop in `app/backend/src/routes/robots.ts`, delete `const perRobotCostAfterRepairBay = Math.floor(robot.calculatedRepairCost * (1 - result.discount / 100))`. Pass `applyManualRepairDiscount(robot.calculatedRepairCost)` as the charged figure and `robot.calculatedRepairCost` unmodified as the pre-discount figure. No line in the loop may multiply or divide a figure derived from `robot.calculatedRepairCost` by `result.discount`; `result.discount` continues to be passed as the `discountPercent` payload field, which records the discount rather than applying it.
- [x] 6.4 Leave the Automatic_Repair_Path logging as it is: it passes `event.repairCost`, which carries the Repair_Bay_Discount once, and records no pre-discount figure.
- [x] 6.5 Add Property 28 (the manual audit figures apply the Repair_Bay_Discount exactly once) to `manualRepairCharge.pbt.test.ts` at 500 iterations.
- [x] 6.6 Re-run `repairAuditParity.test.ts` and confirm it now passes, and re-run `repairCostParity.test.ts` to confirm the charged amounts are still untouched.

### Task Group 7: Repair_Ledger_Entries on Both Paths

_Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.10_

- [x] 7.1 In `app/backend/src/routes/robots.ts`, after `repairAllRobots` has returned and its transaction has committed, call `recordLedgerEntry` once per robot with `transactionType: 'repair_cost'`, `amount: -entry.charged`, `robotId`, and a description naming the path as manual and the robot count. Follow the `robot_creation` pattern already in the file: no `await`, outside any transaction.
- [x] 7.2 Produce the per-robot `balanceAfter` by walking `result.newCurrency` backwards across `[...result.chargedPerRobot].reverse()`, so each entry's `balanceAfter` is the balance immediately after that robot's share was taken. Both paths deduct once per user, so no per-robot balance is ever observed in the database — carry a comment saying this is a derivation, not a reading.
- [x] 7.3 In `app/backend/src/services/economy/repairService.ts`, add the equivalent call in the existing `repairEvents` loop that runs after the chunked transactions commit, with a description naming the path as automatic. Read the post-deduction balance once per user and walk it back across that user's events.
- [x] 7.4 Write **no** ledger entry when `deductCosts === false`. That dry-run mode moves no credits, so an entry would record a charge that never happened and a `balanceAfter` with no meaning.
- [x] 7.5 Add no call site for any other `TransactionType`. `streaming_revenue`, `subscription_cost`, `prestige_award`, `attribute_upgrade` and `settlement_adjustment` stay unwritten and out of scope; backlog item #59 in `docs/BACKLOG.md` carries them.
- [x] 7.6 Create `app/backend/tests/unit/repairLedger.test.ts` implementing Property 30 (Repair_Ledger_Entries reconcile one-to-one with Repair_Spend_Source) plus examples for: the write happening after commit and not enrolled in the transaction, a failed ledger write leaving the repair committed and the response unchanged, and no `financial_ledger` row being persisted while `financial_ledger_active` is `false`.

### Task Group 8: Remove the Two Dead `payload.repairCost` Reads and the CSV Column

_Requirements: 9.2, 9.3, 9.12, 9.13, 9.14, 9.15, 9.16_

- [x] 8.1 Delete `metric.totalRepairCosts += payload.repairCost || 0` from the `battle_complete` loop in `cycleSnapshotService.aggregateStableMetrics`, leaving the `robot_repair` loop below it as the sole repair contributor.
- [x] 8.2 In `app/backend/src/services/cycle/cycleCsvExportService.ts`, remove the `repair_cost` member from the `BattleCSVRow` interface, the name from the header string, `repair_cost: payload.repairCost || 0` from the pushed row object, and `${row.repair_cost},` from the row template literal. The Cycle_Battle_Export goes from twelve columns to eleven with the relative order of the survivors unchanged. The column is removed rather than repointed: a row is one battle participant and a Repair_Spend_Source row carries no battle reference, so no repair figure can be attributed to an identified battle.
- [x] 8.3 Add a comment above the header constant recording the rule for any future repair column — source it from Repair_Spend_Source and state the period it covers in the column name — and recording that no surviving column may carry a stable-level or cycle-level total repeated across a stable's rows, because a consumer totalling such a column would get a multiple of the true figure.
- [x] 8.4 **Last of the three**, delete `repairCost?: number;` from `CycleEventPayload` in `app/backend/src/types/snapshotTypes.ts`. The compiler is the mechanism proving the other two reads are gone. `CycleEventPayload` carries an index signature, so `payload.repairCost` types as `unknown` rather than erroring outright — `+= unknown` and `repair_cost: unknown` are both still compile errors, so the guard holds for both former call sites.
- [x] 8.5 Create `app/backend/tests/unit/cycleCsvExport.pbt.test.ts` implementing Property 24 (the header and every row agree on eleven fields) and `app/backend/tests/unit/repairSpendSourcing.pbt.test.ts` implementing Property 20 (a `battle_complete` payload carrying an arbitrary repair-shaped extra field contributes nothing to any repair figure).

### Task Group 9: Rename the Two Repair JSON Keys Behind One Resolver Module

_Requirements: 9.7, 9.9, 9.10, 17.3, 17.4, 17.5, 17.8, 17.9, 17.10, 17.11, 17.12, 17.13, 17.16, 18.15_

- [x] 9.1 Create `app/backend/src/services/economy/repairPayloadKeys.ts` exporting `CYCLE_REPAIR_SPEND_KEY`, `REPAIR_CHARGED_KEY`, `REPAIR_PRE_DISCOUNT_KEY` and the three resolvers `readCycleRepairSpend`, `readRepairChargedCredits` and `readRepairPreDiscountCredits`. Each resolver reads the renamed key first, falls back to the old key, and **never sums the two**, so a payload carrying both cannot double a repair total. `readRepairChargedCredits` returns `null` for a non-numeric value, which satisfies the malformed-row rule at every reader at once.
- [x] 9.2 Carry a file-header comment naming Season_Rollover as the condition under which every fallback in the module becomes removable, because a rollover purges both `cycle_snapshots` and `audit_logs` in full.
- [x] 9.3 Rename the `StableMetric` field `totalRepairCosts` → `cycleRepairCreditsPaid` in `app/backend/src/types/snapshotTypes.ts`. The compiler then locates every reader, which is the point of doing the TypeScript rename rather than only the JSON one.
- [x] 9.4 Convert every `StableMetric.totalRepairCosts` reader to `readCycleRepairSpend`: `services/analytics/stableAnalyticsService.ts`, `services/common/dataIntegrityService.ts`, `services/economy/unifiedFacilityROIService.ts` (two sites) and `services/economy/facilityRecommendationService.ts`. None of these five is named in the requirements; they are named here so the task is sized honestly.
- [x] 9.5 Update `eventLogger.logRobotRepair` to build the payload with `creditsCharged` and `creditsBeforeManualDiscount` only, never the old keys alongside them. Rename its parameters to match; leave the parameter *order* alone so the two call sites need no positional rework beyond task 6.3's argument changes. Leave `repairType`, `manualRepairDiscount` and `discountPercent` unrenamed — the `payload.repairType` JSON path filter behind `GET /api/admin/audit-log/repairs` must keep matching pre- and post-rename rows.
- [x] 9.6 Convert `getRepairAuditLog` in `services/admin/adminSystemStatsService.ts` to the resolvers in both places it reads the payload (the per-event mapping and the summary loop) and rename its response fields to `creditsCharged` / `creditsBeforeManualDiscount`.
- [x] 9.7 Convert the `payload.cost` read on repair events in `services/analytics/robotPerformanceService.ts` to `readRepairChargedCredits`. Also unnamed in the requirements; without this a pre-rename row reports zero there.
- [x] 9.8 Update the `robot_repair` rollup in `cycleSnapshotService.aggregateStableMetrics` to read through `readRepairChargedCredits`, sum over rows whose event timestamp falls inside that cycle's window, record zero for a stable with no such row, skip a row with no `repairType` or a non-numeric charged figure, and write `cycleRepairCreditsPaid` only — never both keys.
- [x] 9.9 Update `app/frontend/src/pages/admin/RepairLogPage.tsx` in this same change: the three column `key` values follow the renamed response fields while the labels, order, filters and rendered values stay exactly as they are today, including for a pre-rename row.
- [x] 9.10 Create `app/backend/tests/unit/repairPayloadKeys.pbt.test.ts` implementing Property 31 (the resolvers prefer the renamed key and never sum), Property 32 (new writes carry the renamed keys only) and Property 33 (the renames preserve every value).

### Task Group 10: Pin `backfillCycleSnapshots` as Create-Only

_Requirements: 9.8, 9.11, 18.12, 18.13_

- [x] 10.1 Confirm by inspection that `adminCycleService.backfillCycleSnapshots` keeps its skip-if-a-snapshot-exists guard and that `cycleSnapshotService.createSnapshot` keeps `prisma.cycleSnapshot.create` against the `@unique` `cycleNumber`. Add no reprocess path, no upsert, no repair-source count check and no `cyclesSkippedForMissingRepairSource` field to `BackfillSnapshotsResult`. The only edit either operation takes is task 9.8's write-shape change.
- [x] 10.2 Create `app/backend/tests/unit/backfillCycleSnapshots.test.ts` asserting that a cycle which already has a snapshot is skipped and its stored Cycle_Repair_Spend total is byte-identical afterwards, and that a newly created snapshot carries the renamed key only. This test exists to make the prohibition fail loudly if someone later adds the reprocess path.
- [x] 10.3 Add no migration, no one-off correction script and no admin action that rewrites a pre-fix Repair_Spend_Source row or a pre-fix `cycle_snapshots` repair total. Pre-fix rows keep their understated values; the discontinuity is documented in Task Group 17, not corrected.

### Task Group 11: Cycle_Progress_Summary Service

_Requirements: 2.1, 2.3, 2.4, 2.6, 2.7, 2.8, 4.9, 4.10, 5.1, 5.2, 5.3, 5.4, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15, 6.2, 6.3, 6.4, 6.5, 8.5, 8.6, 8.7, 8.10, 8.11, 8.12, 8.13, 8.14, 9.1, 9.4, 9.5, 9.6, 10.3, 10.5, 10.6, 16.9_

- [x] 11.1 Create `app/backend/src/services/dashboard/cycleWindow.ts` exporting `currentCycleWindow(now)`, returning the most recent midnight UTC boundary as `start`, the request timestamp as `end`, and the next midnight boundary. Never derive a window from the request timestamp minus a fixed duration, and never read `lastLoginAt`.
- [x] 11.2 Create `app/backend/src/types/dashboardTypes.ts` with `CycleProgressSummary`, `CycleWindow`, `CycleComparison`, `RepairSpendByType` and `BestPlacement` as design § 2.2 specifies. `bestPlacement` and `comparison` are nullable as a whole, and `comparison.repairSpend` is nullable independently of the other two members, so no field can carry a misleading `0`.
- [x] 11.3 Add `export` to `PLACEMENT_MODE_BATTLE_TYPES` in `userProfileService.ts` and import it in the new service. Declare no second list of placement modes anywhere.
- [x] 11.4 Create `app/backend/src/services/dashboard/cycleProgressService.ts` with the reads of design § 2.4, issued as two parallel batches, capturing the window once and threading `{ start, end }` through every query: roster and team ids; battle participation (battles fought as distinct `battleId`; win/loss/draw grouped by distinct `(battleId, team)` pair excluding Placement_Modes, so a 3v3 victory is one win rather than three; Best_Placement and field sizes), selecting `team`, `robotId`, `battles.winnerId` and `battles.winningSide` so the outcome per pair can be derived; a `_sum` aggregate for Battle_Earnings and prestige earned; scheduled matches and remaining Battle_Slots from the unified Match_Schedule_Source; Current_Cycle Repair_Spend; and the Last_Completed_Cycle comparison.
- [x] 11.5 Add the second Match_Schedule_Source read (design § 2.4 query 4b) over `scheduled_tournament_matches`, filtered to `status` in `pending`/`scheduled`, `tournament.status: 'active'`, `winnerId: null` and `scheduledFor` inside the same window — the same filter `resolveOutstandingEventsForRobots` applies, so the two cannot disagree about what "queued" means. Build the participant filter by iterating `EVENT_SCHEDULE_SCOPES` for entries with `source: 'tournament'`, exactly as `buildReverseLookups` does. Declare no literal list of battle modes and name neither table outside that iteration, so a tenth event mode fails in the scope map rather than silently vanishing from the tile. Resolve a team-participant bracket row to every member of that team and count it once per stable, matching the once-per-stable rule the unified read already applies.
- [x] 11.6 Fold both sources into `matchesScheduled` and `remainingSlotsUtc`. Without this the 10:00 1v1 Tournament, 15:00 2v2 Tournament and 18:00 3v3 Tournament slots would be missing from the scheduled count while their battles still counted as fought — so the tile would report more fought than scheduled on an ordinary day, and `nextSettlementAt` would replace the upcoming-slot line while a tournament round was pending.
- [x] 11.7 Derive the outcome of each `(battleId, team)` pair from `battles.winningSide` where it is set, else from whether that pair holds `battles.winnerId`, else record a draw. The fallback is required, not defensive: the schema documents `winningSide` as null for both a draw and a 1v1, so it cannot distinguish them alone. Read none of this from `battle_log`, which is NULLed after seven days under the Spec #39 retention rule.
- [x] 11.8 Derive Best_Placement as the numerically lowest `battle_participants.placement` across the player's Placement_Mode rows in the window, break a tie by the largest field size so the pair is deterministic, and exclude a battle in which none of the player's robots recorded a placement. Return the pair as absent rather than zero when no Placement_Mode battle recorded one.
- [x] 11.9 Aggregate Repair_Spend by fetching only `robot_repair` rows for the authenticated user inside the window and summing per `repairType` **in application code**, via `readRepairChargedCredits`. Never `_sum` a field inside a `Json` column, never read `preDiscountCost`, never read `robots.repairCost`, never read a `battle_complete` payload, and never read `financial_ledger`. Derive Avoidable_Repair_Spend from the automatic total alone.
- [x] 11.10 Resolve the Last_Completed_Cycle as the single `cycle_snapshots` row with the highest cycle number strictly below the Current_Cycle, take its Battle_Earnings as `totalCreditsEarned + streamingIncome` (passive income writes `streaming: 0`, so this picks up no facility income), and scope the repair comparison to that row's own `startTime`/`endTime` columns as a half-open interval. Return `comparison.cycleNumber` so the Frontend can label a comparison that is not the immediately preceding cycle.
- [x] 11.11 Catch a comparison-read failure inside the service, log it, and return `comparison: null` while the Current_Cycle figures still return. Return `comparison.repairSpend: null` when the rows for that window are absent, for example after Season_Rollover purged `audit_logs`.
- [x] 11.12 Write to no table and create no audit entry. Two successive calls with no intervening battle, credit award or repair must return equal results apart from the window end.
- [x] 11.13 Create `app/backend/tests/unit/cycleProgressService.pbt.test.ts` implementing Properties 3, 4, 5, 10, 12, 21, 22 and 23, and `app/backend/tests/unit/cycleProgressService.test.ts` covering the query-count and unpaginated-shape bound for 20 robots and 40 battles, a reference-equality assertion that the imported `PLACEMENT_MODE_BATTLE_TYPES` is the same array object as the one in `userProfileService.ts`, the two-source case required by Verification criterion 29 (a stable with one unified match and one active tournament bracket row in the window reports `matchesScheduled === 2` and carries the tournament round's Battle_Slot time in `remainingSlotsUtc`), and the three multi-robot cases required by Verification criterion 32 (a won 3v3 with three of the player's robots on team 1 reports 1 fought, 1 scheduled and 1 win, not 3; a Same_Stable_Pairing reports 1 fought with one win and one loss; a Grand Melee holding three of the player's robots reports 1 fought, no win/loss/draw contribution and exactly one Best_Placement).

### Task Group 12: Cycle_Progress_Summary Endpoint

_Requirements: 8.1, 8.2, 8.3, 8.4, 8.8, 8.9_

- [x] 12.1 Create `app/backend/src/routes/dashboardCycle.ts` with one route, `GET /current-cycle`, and the middleware chain `authenticateToken` then `validateRequest({ query: z.object({}) })`. Zod's default `.strip()` removes an unknown query field rather than rejecting the request. The handler takes the user id from `req.user` only, ignoring any identifier in `req.params`, `req.query` or `req.body`. No try/catch — Express 5 forwards rejections to `errorHandler`. No Prisma import and no inline query in the file.
- [x] 12.2 Register it in `src/index.ts` as `app.use('/api/dashboard', dashboardCycleRoutes)`. The base path must not be `/api/robots`, because the robots router is mounted first and its `GET /:id` captures single-segment collection paths through `positiveIntParam`.
- [x] 12.3 Create `app/backend/tests/unit/dashboardCycle.route.test.ts` on the express-app pattern already used by `tests/unit/tuningAllocation.route.test.ts`, with a robots-router stand-in mounted first. Cover route resolution past that stand-in, middleware order, token-only identity, unknown-query stripping, and a 401 raised before the service runs with no state change.

### Task Group 13: Shared Dashboard_Tile Component

_Requirements: 2.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 13.4, 13.5, 14.1, 14.2, 14.4, 14.5, 14.6_

- [x] 13.1 Create `app/frontend/src/components/dashboard/DashboardTile.tsx` declaring `TILE_CONTAINER` (`bg-surface-elevated border border-gray-700 rounded-lg p-4`), `TILE_HEADING` (`text-xl font-medium text-white mb-3`) and `TILE_CONTENT` (with a `min-h` set from the tallest loaded tile) **once**, and applying all three identically in the loading, error and loaded branches so no tile reflows as data arrives. Never `bg-surface` with `border-white/10`, never `text-2xl font-semibold`, never `text-lg font-semibold`.
- [x] 13.2 Declare the `DashboardTileProps` interface with exactly `title`, `clickThrough?`, `isLoading`, `error` and `content`. No `className`, no `style`, no `variant`, and no colour, padding, size or typography member of any kind, so an instance cannot override the shared geometry.
- [x] 13.3 Declare the module-private `STAT_COLOUR` map (`text-white` neutral, `text-success` favourable, `text-error` unfavourable) and the `statColour(signMeaning, delta)` function, returning neutral whenever the delta is absent, zero, or the sign meaning is `'no-meaning'`. Do not export `STAT_COLOUR`, so `text-success` and `text-error` appear in exactly one file. Apply `text-primary` to link and action elements only, never to a stat value. Implement no colour flip at any fixed threshold.
- [x] 13.4 Export the five content primitives — `DashboardTileStat`, `DashboardTileProgress`, `DashboardTileLines`, `DashboardTilePrompt` and `DashboardTileNote` — so a tile never writes a layout or typography class. `DashboardTileStat` carries the label, the pre-formatted value, a period label drawn from exactly two permitted values, an optional comparison and the sign meaning; the tile applies colour, never formatting.
- [x] 13.5 Render the loading state as the heading plus one neutral placeholder per expected stat row, with no stat value and no zero. Render the error state as the heading plus a single "figures unavailable" message, with no partial stat value.
- [x] 13.6 Render the click-through as a native `<button type="button">` calling react-router `navigate(to)`, with `min-h-11 min-w-11 inline-flex items-center` for the 44×44px activation region. Native button semantics supply Enter and Space activation, a visible focus indicator, and DOM-order tab sequence, and `navigate` pushes exactly one history entry. When `clickThrough` is absent, render no interactive element at all so the tile is not in the focus order and does not navigate on activation. Assign to `window.location.href` nowhere, and call no full-document navigation or reload API.
- [x] 13.7 Create `app/frontend/src/components/dashboard/__tests__/dashboardTile.pbt.test.tsx` implementing Properties 6, 7, 9, 16, 17 and 19, and `dashboardTile.test.tsx` covering the props-surface assertions, the container and heading class assertions, the 44px activation-region assertions, single-history-entry navigation, and a source-content assertion that no tile file contains a container, padding, heading-typography or stat-colour class.

### Task Group 14: The Three Tiles

_Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.5, 5.6, 5.7, 5.8, 6.1, 6.6, 6.7, 6.8, 6.9, 6.10, 10.1, 10.2, 10.3, 10.4, 10.7, 10.8, 10.9, 10.10, 10.11, 14.3_

- [x] 14.1 Create `app/frontend/src/components/dashboard/types.ts` with `OverviewRowData`: `prestigeTotal`, `creditBalance`, `robotCount` and `isPreparationPhase` from the auth context and existing reads, plus `cycleProgress`, `isLoading` and `error`.
- [x] 14.2 Create `PrestigeTile.tsx` rendering only: the prestige total, prestige earned this cycle (rendered as `0` when zero, because a known zero is not an absent figure), the comparison with its direction indicator, and Prestige_Gate progress. Compute progress on the Frontend from `getNextPrestigeThreshold` and `PRESTIGE_GATES[getUnlockedFacilityLevel(prestige) - 1]`, clamp the percentage to 0–100, and render the remaining figure and the percentage as text beside the bar so the bar is not the only carrier. When `getNextPrestigeThreshold` returns `null`, render the facility level from `getUnlockedFacilityLevel` in place of both the remaining figure and the bar. Render a signed decline rather than clamping when this cycle is below the comparison. No click-through target.
- [x] 14.3 Create `TodaysBattlesTile.tsx` rendering only: `{fought} of {scheduled}` as whole numbers 0–999 with no abbreviation and no per-mode breakdown, wins/losses/draws, `best {ordinal} of {fieldSize}`, the earliest two remaining Battle_Slot times in ascending UTC order plus a `+N more` indicator, and — when every scheduled match is fought — the time remaining to the next midnight UTC settlement in whole hours and minutes. Render no credits, no prestige, no per-battle list and no LP figure; do not import `GRAND_MELEE_LP_SCALE`. Never render a completion proportion above 100% when the fought count exceeds the scheduled count. No click-through target.
- [x] 14.4 Add the `placementReward(position)` helper to `TodaysBattlesTile.tsx`: 1–3 prestige-earning, 4–10 LP-and-fame-earning, 11+ non-earning, applied identically to `'koth'` and `'grand_melee'` and to every field size. Render a Reward_Earning_Placement with a trophy glyph prefix a non-earning placement does not carry. Pass `signMeaning: 'no-meaning'` and no delta for every placement figure, so no placement can ever render in the loss or error colour.
- [x] 14.5 Create `CreditsTile.tsx` rendering only: the balance from the auth context in `text-white` with no comparison, Battle_Earnings (`higher-is-better`), Repair_Spend as manual plus automatic (`lower-is-better`), Avoidable_Repair_Spend as `round(automatic × MANUAL_REPAIR_DISCOUNT)` (`lower-is-better`), and the `/income` link. Label Avoidable_Repair_Spend with a robot's next scheduled match as the deadline for the Manual_Repair_Discount — never "at settlement" or "at midnight", because pre-battle repair is scoped per event, not per cycle. Render no passive facility income, no operating costs, and no repair control.
- [x] 14.6 Implement the Credits_Tile partial error state: on a Cycle_Progress_Summary failure keep the balance and the `/income` link and replace the three cycle figures with a `DashboardTileNote`, passing `error: null` to `DashboardTile` rather than putting the whole tile into the shared error state.
- [x] 14.7 Implement the omission table line by line: omit win/loss/draw and Best_Placement when no battles were fought while keeping the progress line; omit Best_Placement alone when only Win_Loss_Mode battles were fought; omit both repair lines together when Current_Cycle Repair_Spend is zero; omit a Comparison_Figure when its source is absent; render an omitted line as absent from the DOM with no `0`, no dash and no placeholder; render the no-robots prompt in place of all Todays_Battles_Tile figure lines when the player owns no robots; and render the Preparation_Phase note as a note rather than an error state, with no retry control.
- [x] 14.8 Create `__tests__/prestigeTile.test.tsx` (Property 8 plus the absent-comparison and max-level examples), `__tests__/todaysBattlesTile.pbt.test.tsx` (Properties 11, 13, 15, 18), `__tests__/todaysBattlesTile.test.tsx` (the error-state and Preparation_Phase examples), and `__tests__/creditsTile.test.tsx` (the `/income` link, the deadline copy, and the partial error state).

### Task Group 15: Assemble the Overview_Row and Retire the Two Old Cards

_Requirements: 1.1, 1.2, 1.8, 2.2, 2.9, 3.10, 3.11, 6.12, 6.13, 7.1, 7.2, 7.3, 7.4, 7.5, 7.8, 7.9, 13.1, 13.2, 13.3, 13.6, 13.7, 13.8_

- [x] 15.1 Create `OverviewRow.tsx` rendering `<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">` with the three tiles in the fixed order Prestige, Today's Battles, Credits. Tailwind's `lg` breakpoint is 1024px, exactly the boundary the mobile requirements name, so one utility pair covers stacking below it, the equal-width three-column grid at and above it, and re-render on rotation with no reload. Add no `min-w`, no `whitespace-nowrap`, no fixed pixel width and no `overflow-hidden` anywhere in the row or the tiles.
- [x] 15.2 Render all three tiles in the same order in every data state, including while the Cycle_Progress_Summary is loading, after it has failed, and when every figure in a tile is omitted. Tile count and tile order must never depend on data availability.
- [x] 15.3 Create `app/frontend/src/components/dashboard/index.ts` as the barrel.
- [x] 15.4 Extend `app/frontend/src/hooks/useDashboardData.ts` with `cycleProgress`, `cycleProgressLoading` and `cycleProgressError`, issuing `api.get<CycleProgressSummary>('/api/dashboard/current-cycle')` inside the existing `userId`-keyed effect under the same `cancelled` guard. Unlike the five existing optional reads, this one sets an explicit error rather than failing silently, because three tiles depend on it. Add the API type and function to `app/frontend/src/utils/dashboardApi.ts`.
- [x] 15.5 In the same effect, call `refreshUser()` from `AuthContext` **exactly once**, so the credit balance and prestige total describe the same moment as the Cycle_Progress_Summary figures beside them. `AuthContext` invokes `refreshUser` only on application mount, so without this a player navigating the SPA across a Battle_Slot boundary sees a stale total next to a current one, and a Prestige_Gate progress bar computed from the stale total. Swallow a rejection: the tiles fall back to the values already in the context rather than entering an error state, and no second request is issued for the balance alone.
- [x] 15.6 In `DashboardPage.tsx`, replace the two-column `StableStatistics` / `FinancialSummary` grid with `<OverviewRow />`, positioned as the immediate sibling after the notification stack and the immediate sibling before the Recent Battles section. That position must hold regardless of how many notifications render, including zero.
- [x] 15.7 Delete `app/frontend/src/components/StableStatistics.tsx` and `app/frontend/src/components/FinancialSummary.tsx`, together with every import, JSX usage and test reference to either anywhere under `app/frontend/src/`, including test files, so that `pnpm run build` and `pnpm test -- --run` both complete with no unresolved-module or undefined-component failure. Add no replacement Dashboard surface for the nine removed Lifetime_Stats — each remains reachable on a per-robot detail page or in league standings.
- [x] 15.8 Issue no request to `GET /api/user/stats` for the purpose of rendering any tile.
- [x] 15.9 Create `__tests__/overviewRow.pbt.test.tsx` implementing Properties 1, 2, 14 and 34, and `app/frontend/src/pages/__tests__/DashboardPage.overviewRow.test.tsx` asserting the sibling position with zero notifications and with several. Extend `app/frontend/src/hooks/__tests__/useDashboardData.test.ts` with the new read, its error path, a confirmation that the five existing reads still fail silently, that `refreshUser` is called exactly once, and that a rejected `refreshUser` still leaves the balance and prestige total rendered. Add viewport assertions at 320px, 1023px, 1024px and 1920px covering no horizontal overflow in the loading, error and loaded states, and Battle_Slot times wrapping rather than truncating below 1024px.

### Task Group 16: Rename the Two Repair Columns

_Requirements: 7.6, 7.7, 17.1, 17.2, 17.7, 17.14, 17.15_

- [x] 16.1 Create the Prisma migration `rename_repair_figure_columns` with `ALTER TABLE "robots" RENAME COLUMN "repair_cost" TO "repair_quote_credits"` and `ALTER TABLE "robots" RENAME COLUMN "total_repairs_paid" TO "lifetime_repair_credits_paid"`. Column renames, not add-and-keep. Values carry across unchanged.
- [x] 16.2 Update `model Robot` in `app/backend/prisma/schema.prisma` to `repairQuoteCredits Int @default(0) @map("repair_quote_credits")` and `lifetimeRepairCreditsPaid Int @default(0) @map("lifetime_repair_credits_paid")`, then run `pnpm exec prisma generate`.
- [x] 16.3 Update the repair write sites (`robotRepairService.ts` and `repairService.ts`, which both zero the quote and increment the lifetime figure) and the robot-creation default sites (`services/battle/byeRobot.ts`, `services/practice-arena/practiceArenaService.ts`, `services/team-battle/teamBattleMatchmakingService.ts`).
- [x] 16.4 Update the frontend surface, which changes because the rename changes the JSON field names the robot endpoints return: `app/frontend/src/types/robot.ts`, `app/frontend/src/utils/robotApi.ts`, `app/frontend/src/hooks/useRobotDetail.ts` and the "Lifetime Repairs" render in `app/frontend/src/pages/RobotDetailPage.tsx`.
- [x] 16.5 Update the roughly thirty backend and frontend test fixtures that spread a full `Robot` shape. Confirm every renamed figure reports the same number before and after: a robot's Lifetime_Repair_Spend, a stable's Cycle_Repair_Spend and an audit row's charged amount.
- [x] 16.6 Confirm `userProfileService.ts` still returns every stable statistics field with unchanged names, types and computed values, so consumers outside the Dashboard — per-robot detail pages and league standings — are unaffected by Task Group 15's display removal.

### Task Group 17: Steering Files and Documentation

_Requirements: 9.8, 9.16, 15.1, 17.6, 17.12, 18.12, 18.13_

- [x] 17.1 `.kiro/steering/coding-standards.md`: add repair cost as a named worked example in § Code Organization beside upgrade costs and academy caps, recording that the rule existed and was violated for as long as the duplicate stood; record that `app/backend/src/shared/utils` is a symlink to `app/shared/utils`, so a file appearing under both paths is one file; add a short § Repair Data Architecture beside § Battle Data Architecture naming Repair_Spend_Source as the single source for every repair spend figure with the three non-sources called out (not a `battle_complete` payload, not the Cached_Repair_Quote column, not `financial_ledger`) and naming the four Repair_Figure_Stores under their new names; and add to § Season-Scoped Data that the two fallbacks in `services/economy/repairPayloadKeys.ts` are removable at the next Season_Rollover.
- [x] 17.2 `.kiro/steering/project-overview.md`: extend § Key Systems item 3 (Economy) with the Repair Bay discount formula's home in the Shared_Repair_Module and the rule that repair spend is read from Repair_Spend_Source only. Add a Dashboard line naming `DashboardPage.tsx`, `useDashboardData.ts`, `dashboardNotifications.ts` and `components/dashboard/`, and stating the Current_Cycle basis with the Last_Completed_Cycle as its comparison. Leave § Technology Stack and § Project Structure unchanged.
- [x] 17.3 `.kiro/steering/frontend-standards.md`: add `dashboard/` to § Existing Feature Directories beside `practice-arena/`, `facilities/`, `weapon-shop/`, `hall-of-records/`, `battle-detail/` and `nav/`, noting that it holds the Overview_Row tiles plus the shared Dashboard_Tile. Change no pattern in the file.
- [x] 17.4 `docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md`: add a Dashboard_Tile pattern to § Component Patterns stating the container, the H3 heading step, the three stat-value treatments with the rule that a colour applies only when a comparison exists and the direction is meaningful, that `text-primary` is for links and actions only, the 44px minimum activation region, the `grid-cols-1 lg:grid-cols-3` row layout, and — the reason it earns a place — that container, heading and reserved content height are identical across the loading, error and loaded states.
- [x] 17.5 `docs/game-systems/PRD_ECONOMY_SYSTEM.md`: name `app/shared/utils/repairCost.ts` and `calculateRepairQuote` as the sole implementation, replacing the Phase-summary pointer to `robotCalculations.ts`; rewrite § Manual Repair Discount in the Glossary's terms, because its ambiguous `baseCost` is precisely the reading that produced the double-discount, and state that a batch is discounted per robot then summed; add a subsection recording that manual repair audit figures written before this spec are understated by the Repair_Bay_Discount factor, that no backfill is attempted, and that the manual repair series therefore has a discontinuity at the cycle this spec ships; add `repair_cost` to any list of written ledger transaction types.
- [x] 17.6 `docs/prd_pages/PRD_INCOME_DASHBOARD.md`: correct the repair source to Repair_Spend_Source and state the period as per cycle from `robot_repair` audit rows, replacing the rolling-7-day framing and the `battle.robot1RepairCost` / `robot2RepairCost` columns that do not exist on the current `Battle` model; note that historical `repairCosts` figures and the Cycle_Repair_Spend totals behind them understate manual repair spend for every cycle before this spec and are not corrected retroactively; add the Credits_Tile as the entry point and state what it deliberately omits.
- [x] 17.7 `docs/prd_pages/PRD_DASHBOARD_PAGE.md`: replace the "Top Row Grid" in § Current Dashboard Structure and § Component Hierarchy with the Overview_Row, its fixed tile order and its position invariant; remove `StableStatistics.tsx` and `FinancialSummary.tsx` from § Related Files and add the five new `components/dashboard/` files plus `hooks/useDashboardData.ts`, `hooks/useAcknowledgedPrestigeLevel.ts` and `utils/dashboardNotifications.ts`; add `GET /api/dashboard/current-cycle` and `services/dashboard/cycleProgressService.ts` to the backend list; replace or mark historical the § Size Improvements figures for the two deleted cards; and add the decision record that the Dashboard shows Current_Cycle figures against the Last_Completed_Cycle and that nine Lifetime_Stats were removed because they cannot change within a day.

### Task Group 18: Verification

_Requirements: Verification Criteria 1–34_

- [x] 18.1 Run Verification Criteria 1–8 from `requirements.md` — the Frontend greps: no `window.location.href`, no Lifetime_Stat field names, both old components deleted, no `bg-surface`, stat colours confined to `DashboardTile.tsx`, at least three `DashboardTile` imports — and record each result.
- [x] 18.2 Run Verification Criteria 9–14 — the endpoint and dead-read greps: `PLACEMENT_MODE_BATTLE_TYPES` imported not redeclared, the route registered outside `robots.ts`, no `_sum` and no `preDiscountCost` in the cycle-progress service, no `payload.repairCost` anywhere under `app/backend/src/`, no `repair_cost` in `cycleCsvExportService.ts`, no `repairCost` in `snapshotTypes.ts`.
- [x] 18.3 Run Verification Criteria 15–21 — the repair consolidation greps. Criteria 15 and 17 must be run with `--exclude-dir=shared`: BSD `grep -r` follows symlinks and GNU `grep -r` does not, so an unqualified recursive search over `app/` reports the Shared_Repair_Module twice on macOS and once in CI, and an "exactly one match" check would fail locally while passing on the build server.
- [x] 18.4 Confirm Verification Criteria 22–26 by test: the Repair_Cost_Parity_Test with its six named cases plus a manual batch; a unit test proving a failed Repair_Ledger_Entry leaves the repair committed and the response unchanged; a unit test proving a reader of Cycle_Repair_Spend and a reader of Repair_Spend_Source each resolve a row written under the pre-rename key; the absence of `1 - result.discount` from `routes/robots.ts`; and the Repair_Audit_Parity_Test with its four named cases.
- [x] 18.5 Confirm Verification Criteria 27–29 (the two Match_Schedule_Sources): the Cycle_Progress_Summary service reads `EVENT_SCHEDULE_SCOPES`, reads `scheduledTournamentMatch`, declares no literal list of battle modes, and passes the unit test asserting a stable with one unified match plus one active tournament bracket row reports `matchesScheduled === 2` with the tournament slot present in `remainingSlotsUtc`.
- [x] 18.6 Confirm Verification Criteria 30 and 31: `refreshUser` appears exactly once in `useDashboardData.ts` with a test covering its rejection path, and the two in-game guide articles on repair economics still hold — `economy/repair-costs.md` and `combat/yielding-and-repair-costs.md` both state that the Manual_Repair_Discount stacks on top of the Repair_Bay_Discount and that the deadline is a robot's next scheduled match. Record that no guide article needs editing, rather than leaving it unchecked.
- [x] 18.7 Confirm Verification criterion 32 by test, all three multi-robot cases: a won 3v3 League battle with three of the player's robots on team 1 reports 1 battle fought, 1 match scheduled and **1** win; a Same_Stable_Pairing reports 1 fought with one win and one loss; and a Grand Melee holding three of the player's robots reports 1 fought, no win/loss/draw contribution and exactly one Best_Placement figure. This is the check that the two halves of the tile agree on what a match is.
- [x] 18.8 Run the full suites for Verification Criteria 33 and 34: `cd app/backend && pnpm run test:unit` and `cd app/frontend && pnpm test -- --run`, plus `pnpm run lint`, `pnpm run build` and `pnpm run typecheck:tests` on the backend and `pnpm run lint` and `pnpm run build` on the frontend. Every tier is blocking; introduce no bypass, no pipe that swallows an exit code, and no `continue-on-error`.
- [x] 18.9 Confirm the twelve Expected Contribution outcomes hold, in particular: figures that can change within a day went from 2 to 12; nine Lifetime_Stats left the row; repair cost declarations went from two tracked plus one inline to one; the Cycle_Battle_Export emits eleven populated columns; written ledger categories went from six to seven; the fought-of-scheduled figure covers all nine Battle_Slots rather than six; and a manual Repair_Spend_Source row now records the credits deducted rather than a fraction of them.

## Notes

- **Requirement coverage is complete.** Every acceptance criterion across Requirements 1–18 appears in
  at least one task group's `_Requirements:` trace. The criteria that are prohibitions rather than
  behaviour (9.8, 9.11, 9.15, 9.16, 16.10, 18.12, 18.13) are traced to the task that verifies the
  absence — Task Groups 8, 10 and 17 — rather than left implicit.
- **Two ordering criteria are satisfied by task sequence, not by code.** Requirement 6 criterion 11 and
  Requirement 9 criterion 17 both say the manual audit fix must land before the Repair_Spend figures
  can be trusted. Task Group 6 precedes Task Group 11, which is what satisfies them.
- **Five read sites are named in the tasks but not in the requirements.** `robotPerformanceService.ts`,
  `stableAnalyticsService.ts`, `dataIntegrityService.ts`, `unifiedFacilityROIService.ts` (twice) and
  `facilityRecommendationService.ts` all read a renamed figure. They are in tasks 9.4 and 9.7 so the
  rename is sized honestly; the `StableMetric` TypeScript rename in task 9.3 is what turns each
  unconverted reader into a compile error rather than a silent zero.
- **No historical data is corrected.** Pre-fix Repair_Spend_Source rows and the `cycle_snapshots`
  repair totals derived from them keep their understated values. Task 10.3 states the prohibition and
  tasks 17.5 and 17.6 document the resulting discontinuity in the manual repair series, so the next
  person comparing two cycles does not read the step as a balance change.
- **Two backend suites are not in this plan.** `test:integration` and `test:heavy` are unaffected by
  this spec's changes but are blocking gates in CI, so a failure in either after Task Group 18 is a
  regression to fix, not an expected cost of the change.

## Verification Results

Run on 26 August 2026 against the finished tree. All 34 Verification Criteria were
executed. **Thirty are green as written. Four are green in intent but not in literal form,
and the reason is recorded against each rather than glossed** — a criterion that has to be
reinterpreted every time it runs is a criterion that will eventually be skipped, so the
mismatch is stated here for whoever reruns them.

### Criteria 1–8 — Frontend

| # | Result |
|---|---|
| 1 | ✅ No `window.location.href` under `components/dashboard/` or in `DashboardPage.tsx`. |
| 2 | ⚠️ **Green in intent.** `repairCost` is gone from `CycleEventPayload`, which is what the criterion's own parenthetical asks for. A case-sensitive grep over the whole file still returns one match: `RobotMetric.repairCosts`, a live per-robot per-cycle field correctly fed from Repair_Spend_Source via `readRepairChargedCredits`. The criterion should have been scoped to `CycleEventPayload`. |
| 3 | ✅ No `payload.repairCost` under `app/backend/src/services/`. |
| 4 | ✅ No Lifetime_Stat field name on the Dashboard. |
| 5 | ✅ `StableStatistics.tsx` and `FinancialSummary.tsx` do not exist anywhere in the repository. |
| 6 | ⚠️ **Green in intent.** No bare `bg-surface` in production code; the one match is a comment in `dashboardTile.test.tsx` asserting the rule. The criterion's `bg-surface\b` is wrong as written: `\b` matches between `e` and `-`, so the pattern also matches every `bg-surface-elevated` — the class the criterion itself prescribes. `bg-surface[^-]` is the check that means what was intended. |
| 7 | ✅ Stat colours are declared once, in the private `STAT_COLOUR` map in `DashboardTile.tsx`. `text-primary` appears twice, on a `<button>` and a `<Link>` — never on a stat value. A dedicated test pins that no tile file contains `text-success` or `text-error`. |
| 8 | ✅ Four imports of `./DashboardTile` — the three tiles plus the barrel. |

### Criteria 9–14 — Endpoint and dead reads

| # | Result |
|---|---|
| 9 | ✅ `cycleProgressService.ts` imports `PLACEMENT_MODE_BATTLE_TYPES` from `userProfileService.ts`; the only declaration remains in `userProfileService.ts`. |
| 10 | ✅ `GET /current-cycle` is declared in `routes/dashboardCycle.ts` and mounted at `/api/dashboard`, outside `robots.ts`. |
| 11 | ⚠️ **Green in intent.** No `_sum` touches the repair path; repair is summed in application code through `readRepairChargedCredits`. Three `_sum` uses remain, all on real `Int` columns in one `battleParticipant.aggregate` for Battle_Earnings and prestige — which design § 2.4 explicitly requires. The criterion as written ("returns no matches") contradicts the design; its stated intent, "never a Prisma `_sum` over a JSON field", holds. |
| 12 | ✅ No `preDiscountCost` in the service. The one comment that referenced it was reworded to name the current field, `creditsBeforeManualDiscount`. |
| 13 | ✅ No `payload.repairCost` anywhere under `app/backend/src/`. |
| 14 | ⚠️ **Green in intent.** The column is gone from the header string, the row interface and the row builder; the header now declares eleven fields. One match remains, in the comment recording the removal and the rule for any future repair column. Kept deliberately: `repair_cost` inside a comment cannot be mistaken for a live column, and naming the removed column is the point of the note. |

### Criteria 15–21 — Repair consolidation

| # | Result |
|---|---|
| 15 | ✅ Exactly one `export function calculateRepairQuote`, in `app/shared/utils/repairCost.ts`. Reported twice on macOS because `app/backend/src/shared/utils` is a symlink to the same file — the caveat the criterion predicted, now also recorded in `coding-standards.md`. |
| 16 | ✅ `calculateRepairCost` appears nowhere in `app/backend/src`, `app/frontend/src` or `app/shared`. Two comments that named it historically were reworded so the check is provable. (Stale build artefacts under `app/*/coverage/` still contain the old name; the criterion is scoped to the three source trees.) |
| 17 | ✅ One assignment of `MANUAL_REPAIR_DISCOUNT`, in the Shared_Repair_Module. Same symlink double-report. |
| 18 | ⚠️ **Green in intent.** No Frontend file computes the Repair_Bay_Discount. The two matches for `Math.min` near `90` are the Training Facility discount cap in two Spec #46 Upgrade Planner *test* files — a different formula. |
| 19 | ✅ Zero references to `MANUAL_REPAIR_DISCOUNT` under `services/` or `routes/`: the discount is applied only by `applyManualRepairDiscount`, never by a call-site multiplication. |
| 20 | ✅ `useRobotsList.ts` imports `calculateRepairQuote`, `applyManualRepairDiscount` and `calculateRepairBayDiscountPercent` from `../../../shared/utils/repairCost` and from no other path. |
| 21 | ✅ `transactionType: 'repair_cost'` is written from `routes/robots.ts` (Manual_Repair_Path) and `services/economy/repairService.ts` (Automatic_Repair_Path). |

### Criteria 22–26 — Confirmed by test

| # | Result |
|---|---|
| 22 | ✅ `repairCostParity.test.ts` — seven primary cases covering 0% HP, 5% HP, 40% HP, undamaged, Repair Bay level 0, a level×count above the 90% cap, and an odd quote; plus two manual-batch cases and ten cases inherited from the deleted `sharedRepairCostParity.test.ts`. |
| 23 | ✅ `repairLedger.test.ts` — a rejection from `recordTransaction`, and one from the cycle-number lookup, both leave the repair committed and the response unchanged. |
| 24 | ✅ `repairPayloadKeys.pbt.test.ts` — `readCycleRepairSpend` resolves a `totalRepairCosts` row and `readRepairChargedCredits` a `cost` row, neither summing the two; `cycleProgressService.pbt.test.ts` covers the same through the service. |
| 25 | ✅ No `1 - result.discount` in `routes/robots.ts`. `result.discount` survives only as the `discountPercent` payload argument and a response field — no arithmetic on a figure derived from `calculatedRepairCost`. |
| 26 | ✅ `repairAuditParity.test.ts` — a below-cap Repair Bay level, the 90% cap, a manual batch of three summing to the credits deducted, and the Automatic_Repair_Path left unchanged. |

### Criteria 27–32

| # | Result |
|---|---|
| 27 | ✅ The service reads `EVENT_SCHEDULE_SCOPES` and `prisma.scheduledTournamentMatch`. |
| 28 | ✅ No literal battle-mode list in `cycleProgressService.ts`. |
| 29 | ✅ One unified match plus one active bracket row reports `matchesScheduled === 2`, with both `08:00` and the tournament's `10:00` in `remainingSlotsUtc`. |
| 30 | ✅ One `refreshUser` call site, with a test covering its rejection path. |
| 31 | ✅ Both guide articles still hold. `economy/repair-costs.md` needed no change. `combat/yielding-and-repair-costs.md` said automatic repairs happen "during the daily cycle", which invites the settlement-timed reading the design decision explicitly forbids; that one sentence now states the per-event timing and the next-scheduled-match deadline, and links to the fuller article. |
| 32 | ✅ All three multi-robot cases pass: a won 3v3 with three of the player's robots reports 1 fought / 1 scheduled / 1 win; a Same_Stable_Pairing reports 1 fought with one win and one loss; a Grand Melee with three robots reports 1 fought, no outcome contribution and one Best_Placement. |

### Criteria 33–34 — Full suites

| Gate | Result |
|---|---|
| Backend `test:unit` | ✅ 227 suites, 3356 tests passed |
| Backend `lint` | ✅ clean |
| Backend `build` | ✅ clean |
| Backend `typecheck:tests` | ✅ clean |
| Frontend `test:ci` | ✅ 187 files, 1894 passed, 1 file / 3 tests skipped |
| Frontend `lint` | ✅ clean |
| Frontend `build` | ✅ clean |

No bypass, no pipe swallowing an exit code and no `continue-on-error` was introduced. `test:integration`, `test:heavy` and Playwright were **not** run locally; they are unaffected by this spec's changes but remain blocking gates in CI.

### Expected Contribution outcomes

Confirmed: figures that can change within a day went 2 → 12 (3 on the Prestige_Tile, 5 on
the Todays_Battles_Tile, 4 on the Credits_Tile); nine Lifetime_Stats left the row with no
replacement surface; repair cost declarations went from two tracked plus one inline to one;
the Cycle_Battle_Export emits eleven populated columns; written ledger categories went 6 → 7;
the fought-of-scheduled figure covers all nine Battle_Slots rather than six; and a manual
Repair_Spend_Source row now records the credits deducted rather than a fraction of them.

### Work done during verification that was not in the plan

- **`StatisticalRankings.pbt.test.tsx` was racy and is fixed.** It failed once in the full
  frontend run (seed 1152160664, counterexample `[4,2,525]`) and passed in isolation. The
  cause is not load: the component renders the same `Statistical Rankings` heading in its
  loading state, so `await findAllByText(/Statistical Rankings/i)` resolves while the nine
  skeletons are still mounted, and the twelve synchronous `getAllByText` calls that followed
  were racing the mocked promise. A `waitForRankingsLoaded()` helper now waits for the
  skeletons to clear, and all thirteen tests pass. The file is untouched by this spec; the
  race predates it.
- **Two assertions named in task 11.13 were missing and have been added** to
  `cycleProgressService.pbt.test.ts`: the query-count and unpaginated-shape bound (20 robots
  and 40 battles issue the same query count as one of each, and no query carries `skip` or
  `take`), and the Placement_Mode single-list check. The latter is a source-level assertion
  rather than a reference-equality one, because the service imports the constant without
  re-exporting it, so there is no second binding to compare from a test — and a structural
  `toEqual` would pass against a copied `['koth', 'grand_melee']` right up until someone
  added a third mode to one of the two.
- **Seven pre-existing `require()` lint errors and one `prefer-const`** in
  `tagTeamBattleOrchestrator.property.test.ts` and `practiceArenaService.test.ts` were fixed.
  The pre-commit hook surfaced them once Task Group 16 staged those files; `pnpm run lint`
  covers `src` only, so they had never been caught.

### Observation for a future spec, not fixed here

`economyCalculations.ts` builds the per-robot ROI breakdown with
`const repairCosts = robot.repairQuoteCredits || 0` — the Cached_Repair_Quote used as though
it were a spend. It predates this spec, sits outside Requirement 9's named read sites, and
changing it alters what the Income_Dashboard's per-robot ROI figure *means*, which is a
product decision rather than a bug fix. Flagged rather than silently changed.
