# Implementation Plan: Finance Center

## Overview

This mandatory plan creates a secure, reconciled Finance_Center with Canonical_Cycle_Identity, itemised actual statement evidence, a theoretical repair reference, evidence-limited growth/forecast panels and conserved direct robot financial results.

## Notes

Finance_Center formats report ISO instants in the browser locale but does not display “Your local time” or repeat fixed cycle-start wording. Dashboard UTC upcoming-battle rendering is unchanged. A test marked retire is removed only after its stated replacement is green. Every task is mandatory.

## Task Dependency Graph

```json
{
  "waves": [
    {"name": "Evidence and versioned contract", "tasks": ["Task Group 1"]},
    {"name": "Canonical cycle identity", "tasks": ["Task Group 2"], "dependsOn": ["Task Group 1"]},
    {"name": "Statement and repair read models", "tasks": ["Task Group 3"], "dependsOn": ["Task Groups 1 and 2"]},
    {"name": "History and robot read models", "tasks": ["Task Group 4"], "dependsOn": ["Task Groups 1, 2 and 3"]},
    {"name": "Secure report APIs", "tasks": ["Task Group 5"], "dependsOn": ["Task Groups 3 and 4"]},
    {"name": "Finance Center UI", "tasks": ["Task Groups 6 and 7"], "dependsOn": ["Task Group 5"]},
    {"name": "Route migration and documentation", "tasks": ["Task Group 8"], "dependsOn": ["Task Groups 6 and 7"]},
    {"name": "Final blocking verification", "tasks": ["Task Group 9"], "dependsOn": ["Task Groups 1–8"]}
  ]
}
```

## Tasks

### Task Group 1: Establish Evidence, Versioned Contract and Test Dispositions

_Requirements: 1.1–1.3, 1.6–1.7, 2.1–2.7, 3.1–3.7, 4.1–4.8, 5.1–5.5, 6.1–6.8, 7.1–7.6, 8.1–8.6, 9.1–9.4, 10.1–10.2_

- [x] 1.1 Inventory `/income`, `/cycle-summary`, legacy finance/analytics APIs and current financial writers. Record `FinancialLedger`/audit pairing, paired audit (`cycleNumber`, `sequenceNumber`) ordering, `balanceAfter`, `cycle_end_balance`, `CycleSnapshot` closing fields, `CycleMetadata.totalCycles`, `competitiveCyclesCompleted`, Season_Rollover and preparation-state boundaries, current writer/settlement serialization points, database read-consistency capabilities, `BattleParticipant.credits`, source identities linking participant allocations to stable awards, `FinancialLedger` granularity by battle mode, streaming/repair robot attribution and repair `sourceEventId` linkage in `docs/implementation_notes/finance-center-reporting-contract.md`.
- [x] 1.2 Define complete `app/backend/src/types/financeReport.ts` response/internal types and export them through `src/types/index.ts`: literal `version: 1` envelopes; normalized Report_Period including phase/current inclusion; envelope source summary and per-component evidence kind/finality/basis; closed taxonomy; Finance_Statement including `investmentProceeds` and `investmentPurchases`; Reconciliation_Proof with per-cycle boundary proofs/typed limitations; history with completed or partial-current comparison basis; five robot headline metrics; Battle_Allocation_Evidence validation results; and paginated detail with page subtotal/full-period total. Define `sourceReference` as Player_Safe_Source_Reference generated at the report boundary; exclude raw `financialEventId`, audit IDs/payloads, security payloads and unnecessary internal IDs from responses.
- [x] 1.3 Create strict `app/backend/src/schemas/financeReportSchemas.ts` with one reusable period union for every applicable endpoint, ordered active-season ranges, deterministic ordering and bounded pagination. Reject scope+range conflicts, require field-naming messages and strip unknown fields.
- [x] 1.4 Define the deterministic maximum-roster fixture with financial Cycle 1 starting at Season_Rollover, both preparation midnights, first competitive settlement, preparation spending/achievement income, no cycle 0, writers racing closing-balance capture, a blocked writer reassigned after completed-count advancement, one Consistent_AsOf_View cutoff, scheduled/admin settlement, zero-valued settlement rows, closing boundaries/snapshot, weapon purchase and sale, facility components, two stables with different awards sharing one battle source, one stable with multiple placement participants, matching/mismatching owner-scoped allocations, streaming, linked/mismatched repairs, more than one event page, positive/zero prestige samples, subscriptions/obligations/teams/standing movement and adjacent seasons with repeated cycle numbers. Include Current_Cycle, Season_To_Date and completed-only History expectations plus source records suitable for Player_Safe_Source_Reference stability, collision and opacity tests.
- [x] 1.5 Record the existing-test disposition below. Retirement remains blocked until named replacement coverage passes.

| Existing test | Type | Outcome |
|---|---|---|
| `app/backend/tests/finances.test.ts` | Backend integration | Adapt report/auth/range/version/provenance/itemisation/early state; retire only legacy endpoint assertions. |
| `app/backend/tests/financesRouteValidation.test.ts` | Backend unit | Retire/adapt duplicated ROI schema test; add shared period/page schema tests. |
| `app/backend/tests/financialReportStreamingRevenue.test.ts` | Backend integration | Retire/replace legacy aggregation with paired/robot-attributed record tests. |
| `app/backend/tests/services/streamingRevenueParity.test.ts` | Backend unit/property/static | Retain/adapt formula/property checks. |
| `app/backend/tests/cycleSummaryStreamingRevenue.property.test.ts` | Backend integration/property | Retain unchanged. |
| `app/backend/tests/coverageManifest.test.ts` | Backend static/unit | Adapt stale Cycle Summary surface expectation. |
| `app/backend/tests/analyticsApi.test.ts` | Backend integration | Retire/repurpose only after analytics decommissioning. |
| `app/backend/src/services/financial/__tests__/financialService.test.ts` | Backend unit | Adapt/retire route-specific legacy behaviour. |
| `app/frontend/tests/e2e/financial-flow.spec.ts` | Playwright E2E | Keep unrelated flows; replace legacy Income assertions. |

- [x] 1.6 Add source-boundary regressions against existing persisted behavior: quote is not spend; prestige is not currency; achievement rewards retain their taxonomy; `weapon_sale` has a positive ledger amount; each `robot_repair` carries its link identity; and `BattleParticipant.credits` remains persisted allocation evidence. Groups 3–4 own new report reconciliation, allocation-conservation and pagination properties after their services exist.

### Task Group 2: Normalize Canonical Cycle Identity

_Requirements: 1.2, 1.4–1.6, 2.2–2.3, 7.2, 10.2_

- [x] 2.1 Create the canonical cycle resolver so `CycleMetadata.totalCycles` means completed financial cycles and every current financial writer resolves active cycle as `totalCycles + 1`. Financial Cycle 1 starts at Season_Rollover and remains active through both preparation days and the first competitive/match day; later cycles start at their owning midnight. Return phase metadata supporting explicit Cycle 1 / Preparation / Provisional player labels.
- [x] 2.2 Route every current financial writer through the resolver so all preparation spending and achievement income belongs to financial Cycle 1. Preserve all amount arithmetic and closed taxonomy while removing competing cycle-number derivations.
- [x] 2.3 Make preparation midnights advance preparation state without financial settlement, closure or renumbering. Make scheduled and admin settlement use identical Serialized_Cycle_Cutover ordering with current-economy writers: prevent commits to the closing cycle after balance capture begins; write paired `passive_income` and `operating_costs` including zero values; write `cycle_end_balance`; write `cycle_complete`; write `CycleSnapshot` after end-balance; advance completed count last; then allow blocked writers to resume and resolve the next active cycle. Choose the implementation mechanism during coding, but preserve this ordering invariant.
- [x] 2.4 Add unit/property tests for active=`totalCycles + 1`, Cycle 1 `startsAt` at Season_Rollover, preparation-midnight continuity, preparation spend/achievement assignment, first competitive closure, later owning-midnight starts, no cycle-0 split, repeated season-local cycle numbers and inconsistent identity producing `cycle_identity_mismatch` rather than a guessed period.
- [x] 2.5 Add integration race tests proving scheduled/admin parity, no settlement on either preparation midnight, first competitive settlement ownership, all closing evidence sharing one number, snapshot following `cycle_end_balance`, completed count advancing last, no writer committing to the closing cycle after balance capture and a blocked writer resuming against the next active cycle.

### Task Group 3: Implement Period, Statement, Reconciliation and Repair Read Models

_Requirements: 1.1–1.7, 2.1–2.7, 3.1–3.7, 4.1–4.6, 8.2–8.4, 9.1–9.3, 10.2_

- [x] 3.1 Create `financeReportPeriod.ts` using Canonical_Cycle_Identity. Return version-1 normalized active-season scope, cycle bounds, phase/current-inclusion metadata, UTC ISO bounds, `asOf`, evidence kind and period finality. Use Season_Rollover as Cycle 1 `startsAt`, owning midnight for later cycles, include Current_Cycle through `asOf` in Season_To_Date, mark any containing period `current_provisional`, and return typed limitations for inconsistent retained identities.
- [x] 3.2 Create `financeReportReconciliation.ts` and query orchestration that use one Consistent_AsOf_View for every ledger, paired/domain audit, boundary, snapshot and current-`currency` read in one response. Pair by non-null `financialEventId`; order complete records by paired audit (`cycleNumber`, `sequenceNumber`) so per-cycle sequence restarts cannot interleave a range; derive opening from earliest `balanceAfter - amount`; sum each ledger amount once; derive closing from final `balanceAfter`; verify signed/display equations; append one boundary proof for every Completed_Cycle in a single/range selection and compare its closing with its own `cycle_end_balance`/`CycleSnapshot`; use `User.currency` only as Current_Cycle confirmation at that same cutoff.
- [x] 3.3 Map signed taxonomy/stored Financial_Breakdown into itemised lines. Separate positive `weapon_sale` investment proceeds from earned Credits and investment purchases; itemise every sale, purchase, refinement, upgrade and stored facility component; preserve exact “Weapon Refinement” display.
- [x] 3.4 Represent modern no-activity cycles through zero-valued settlement pairs. Emit typed limitations for missing pair/boundary, snapshot disagreement, admin anomaly and legacy evidence; never create a fallback amount from timestamps, current state, current formulas or snapshots.
- [x] 3.5 Aggregate each charged repair as one linked logical event. Count the negative ledger once in reconciliation; join `robot_repair.sourceEventId` to Financial_Record `financialEventId`; verify positive `creditsCharged === abs(ledger.amount)` and same user/robot/period/subtype; use domain audit for manual/automatic count/display; emit `repair_link_mismatch` without fallback or double-counting.
- [x] 3.6 Implement Full_Damage_Repair_Reference through `app/shared/utils/repairCost.ts`, applying shared arithmetic/manual discount once and rounding per robot; include zero-active-roster behavior and keep `repairQuoteCredits` estimate-only.
- [x] 3.7 Add unit/property tests for Consistent_AsOf_View behavior under interleaved writes, (`cycleNumber`, `sequenceNumber`)-over-timestamp ordering including per-cycle sequence restarts in a range, both reconciliation equations, every single/range Completed_Cycle boundary including an interior-cycle mismatch while aggregate arithmetic balances, no-activity rows, every limitation, sale polarity/itemisation/Revenue_Growth exclusion, repair exact linkage/single contribution, facility components, quote isolation and full-damage rounding.
- [x] 3.8 Add deterministic timezone/DST tests for browser-local ISO formatting and assert no literal “Your local time”/fixed cycle-start copy or Dashboard UTC change.

### Task Group 4: Implement History, Forecast and Robot Read Models

_Requirements: 4.3–4.5, 5.1–5.5, 6.1–6.8, 8.2–8.6, 9.1–9.4, 10.2_

- [x] 4.1 Create `financeReportTrendService.ts` for Current_Cycle and completed-cycle net/earned-Credits deltas, selected-cycle Finance_Statement and evidence-bounded Recorded_Driver entries. Anchor Revenue_Growth to the latest included cycle: compare Current_Cycle partial evidence through `asOf` with the previous Completed_Cycle using provisional/asymmetric metadata, or compare adjacent completed cycles otherwise. Include a provisional active-cycle History point for Current_Cycle and Season_To_Date; keep last-seven/custom completed-only and exclude investment proceeds from Revenue_Growth.
- [x] 4.2 Create `prestigeMilestoneForecastService.ts` from latest up-to-seven completed active-season cycles, positive `prestige_change` totals and `ceil(remaining / average)`; return no-history/no-pace/no-gate states and never dates/promises.
- [x] 4.3 Create set-based `robotDeploymentQueryService.ts` and one-owned-robot detail service. Return exactly fought matches, battle/bye income, streaming revenue, actual repair spend and direct net plus event/exposure facts.
- [x] 4.4 Join `BattleParticipant.credits` to related `battle_income` Financial_Record entries for all modes, including stable-aggregated team league/tag/KotH/Grand Melee/byes. Restrict participants through robot ownership to the ledger `userId`, then validate that owner-scoped allocation sum equals that stable’s ledger award before reporting per-robot amounts; do not require ledger `robotId`, divide awards or label persisted allocations as Stable_Wide_Allocation.
- [x] 4.5 Compute full-period robot totals independently of pagination. Return stable `occurredAt DESC, sourceReference ASC` event ordering, bounded page metadata, optional page subtotal and unchanged full-period total; byes appear in detail but never increment fought matches.
- [x] 4.6 Add unit/property tests for completed-to-completed and partial-current-to-completed Revenue_Growth, provisional/asymmetric labelling, Current_Cycle and Season_To_Date active points, completed-only last-seven/custom behavior, forecast sample/ceil states, drivers, owner-scoped battle allocation conservation/mismatch with two stables sharing one source, one stable owning multiple placement participants, direct-net identity, stable-aggregated awards, no synthetic allocation, byes and pagination invariance/no duplicates/no omissions.
- [x] 4.7 Add integration tests for robot-attributed streaming/repairs, team-mode/bye allocations, event exposure, owned-robot isolation, absolute scheduled instants, typed limitations, stable ordering and multi-page composition.
- [x] 4.8 Add query-growth/performance fixture tests for all Report_Performance_Budget targets and prove no finance/battle/repair query per robot.

### Task Group 5: Expose Secure, Bounded Version-1 APIs

_Requirements: 1.1–1.2, 1.7, 2.6–2.7, 6.8, 7.1–7.6, 8.3–8.6, 10.2_

- [x] 5.1 Add thin overview/history/robot summary/detail routes in `app/backend/src/routes/finances.ts` after services exist. Apply `authenticateToken`, then shared `validateRequest`; derive stable only from JWT.
- [x] 5.2 Return named `FinanceReportEnvelope<T>` responses with literal `version: 1`, normalized period including phase/current inclusion, envelope provenance summary, truthful per-component source/finality/basis, typed reconciliation/limitations and concrete data from one Consistent_AsOf_View. Generate every Player_Safe_Source_Reference at the report boundary so it is stable across refreshes/pages, collision-free within authenticated stable/active season, non-reversible and display/log safe; never use it for authorization. Explain version as schema compatibility in API documentation.
- [x] 5.3 Apply the same applicable period grammar to every endpoint; reject scope+range conflicts. Verify detail ownership inside the service boundary and return generic `403 Access denied` for absent/non-owned IDs.
- [x] 5.4 Add integration coverage for unauthenticated/malformed/unknown inputs, every preset/custom range on every endpoint, exact echoed period, preparation phase metadata, Current_Cycle/Season_To_Date History inclusion, active-season bounds, one response-wide `asOf`, typed limitations, Player_Safe_Source_Reference stability across refreshes/pages, same-stable/season collision freedom, non-reversibility, non-authorization, and absence of raw `financialEventId`, audit IDs/payloads, security payloads, unnecessary internal IDs and cross-user data.
- [x] 5.5 Cache by authenticated stable, active season, normalized period, resource and page/page size/order where applicable; expose `asOf`; prove two-user, repeated-cycle-season and page isolation.
- [x] 5.6 Review authenticated per-user limiter placement, bound expensive requests, emit payload-safe duration/query/byte diagnostics and prohibit tokens/player IDs/raw payload logs.
- [x] 5.7 Prevent Finance_Center clients from using deprecated report routes; keep compatibility redirects for Group 8.

### Task Group 6: Build Overview and History UX

_Requirements: 1.1–1.3, 1.7, 2.1–2.7, 3.4–3.6, 4.1–4.8, 5.1–5.5, 8.1, 8.5, 9.1–9.4, 10.2_

- [x] 6.1 Create `financeApi.ts`, `useFinanceReport.ts` and `FinanceCenterPage.tsx`; consume version-1 envelopes, load Overview first, lazy-load other panels independently, use normalized period request keys and reject stale responses without page-wide `Promise.all`.
- [x] 6.2 Implement URL-backed presets/custom bounds/current-only Refresh. Associate invalid fields with `aria-invalid`/`aria-describedby`, focus the first invalid field and send no invalid request.
- [x] 6.3 Create `FinanceStatement.tsx` with separate earned Credits, investment proceeds, running costs and investment purchases headings. Itemise every sale/purchase and each stored facility component; show linked manual/automatic repair count/display once; expose player-safe source/provenance without raw payloads.
- [x] 6.4 Create read-only Revenue_Growth, Full_Damage_Repair_Reference, Prestige_Milestone_Forecast and Prestige_Earning_Power panels with named unavailable/zero-roster states, sample facts and no repair/facility/mutation action.
- [x] 6.5 Create History_View/Action_Effect_Trend with labelled SVG, 44px semantic points, complete table equivalent, selected-cycle complete statement, Revenue_Growth and evidence-bounded drivers. Render the active point and statement as provisional through `asOf` for Current_Cycle/Season_To_Date, and explain partial-current versus complete-prior asymmetry.
- [x] 6.6 Implement tablist/tab/tabpanel relationships, roving focus, Arrow/Home/End keys, visible focus and selection preservation. Add frontend tests for version/provenance, preparation Cycle 1 labels, period controls, Season_To_Date current inclusion, sale headings/arithmetic, reconciliation/limitations, provisional/asymmetric Revenue_Growth, selected-cycle updates, Player_Safe_Source_Reference display without raw IDs, independent errors/retries and local time.
- [x] 6.7 Implement 320–1023px stacked/card/disclosure layouts and ≥1024px responsive tab pattern; keep only intentional internal tab scrolling, no page overflow/hover-only data, and 44px statement/tab targets. Test 320px, 375px, 768px, 1023px, 1024px and desktop states.

### Task Group 7: Build Robot Deployment UX

_Requirements: 4.7–4.8, 6.1–6.8, 8.1, 8.5–8.6, 10.2_

- [x] 7.1 Create lazy `useRobotDeployment.ts`, `RobotDeploymentView.tsx`, `RobotDeploymentCard.tsx` and shared `RobotDeploymentDetail.tsx` consuming version-1 summary/detail envelopes.
- [x] 7.2 Render exactly five fixed label/value headline cells: fought matches, battle/bye income, streaming revenue, actual repair spend and direct net. Show attribution limitations without inventing values; byes remain detail-only.
- [x] 7.3 Render one detail hierarchy for individual financial events, repair split and current exposure. Label event income as battle/bye income, format absolute schedule instants locally and show allocation evidence with Player_Safe_Source_Reference values without claiming every ledger row has `robotId` or exposing raw IDs.
- [x] 7.4 Add deterministic pagination controls/status with 44px targets, optional page subtotal and repeated full-period total. State that loaded-page details need not equal full-period headlines and only all pages combined reconcile to itemised detail.
- [x] 7.5 Render loading, independent error/retry, no-activity and page-boundary states. Keep only Manage subscriptions to generic Booking Office; exclude repair/facility/team/eligibility actions and profitability ranking.
- [x] 7.6 Add component/property tests for Atlas/Nyx direct-net arithmetic, allocation mismatch, battle/bye versus streaming labels, bye fought exclusion, full-period/page invariance, keyboard pagination/focus/live announcements, all-page composition and forbidden actions.
- [x] 7.7 Add 320px, 375px, 768px, 1023px and ≥1024px no-overflow tests proving all five headline values, event values, pagination status and notice remain visible with Activation_Region compliance.

### Task Group 8: Execute Route Migration and Update Documentation

_Requirements: 9.4, 10.1, 10.3–10.6_

- [x] 8.1 Serve `FinanceCenterPage.tsx` at protected `/income`; redirect `/finances`; redirect `/cycle-summary` to History with valid `lastNCycles` conversion/default.
- [x] 8.2 Update `app/frontend/src/components/nav/types.ts` to replace “Income Dashboard” with one “Finance Center” `/income` entry and remove `/cycle-summary`; verify shared `Navigation.tsx`/`MobileDrawer.tsx` active states and keep mobile bottom tabs unchanged.
- [x] 8.3 Keep `CreditsTile.tsx` routed to `/income` with “Open Finance Center” wording and link `PrestigeTile.tsx` to the prestige context without changing Dashboard current-cycle/time semantics. Leave `/admin/economy` navigation separate.
- [x] 8.4 Remove legacy page calls/components only after replacement/redirect/player-navigation coverage passes; preserve redirects and apply Task 1.5 dispositions.
- [x] 8.5 Complete `docs/implementation_notes/finance-center-reporting-contract.md` with preparation-spanning financial Cycle 1, Canonical_Cycle_Identity/order, Serialized_Cycle_Cutover, Consistent_AsOf_View, version-1 envelopes, current-inclusive History/Season_To_Date, provisional/asymmetric Revenue_Growth, sequence reconciliation, sale polarity, repair triple, participant allocation conservation, Player_Safe_Source_Reference generation/security, pagination separation, limitations, cache/performance/test/migration record.
- [x] 8.6 Update `docs/prd_pages/PRD_INCOME_DASHBOARD.md` with Finance_Center contracts, preparation Cycle 1, current-inclusive History/Season_To_Date, provisional/asymmetric Revenue_Growth, itemisation, robot allocation/pagination, repair reference, forecast and migration.
- [x] 8.7 Update `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md` with Serialized_Cycle_Cutover, Consistent_AsOf_View, sequence-ordered identity reads, closing checks, repair single-contribution linkage, stored facility components, Player_Safe_Source_Reference boundary and Battle_Allocation_Evidence.
- [x] 8.8 Update `app/backend/src/content/guide/economy/credits-and-income.md` with Cycle 1 Preparation/Provisional labels, actual/provisional periods, Season_To_Date including current, partial-current Revenue_Growth caveat, investment proceeds versus purchases, theoretical repair reference, revenue versus net, forecast limits, five robot metrics and loaded-page notice.
- [x] 8.9 Update `docs/game-systems/PRD_PRESTIGE_AND_FAME.md` with multiplier, roster-capacity merchandising and forecast boundaries.
- [x] 8.10 Review/update `.kiro/steering/project-overview.md`, `.kiro/steering/frontend-standards.md`, `.kiro/steering/performance-guidelines.md` and `.kiro/steering/testing-strategy.md` for durable conventions only; record every checked-but-unchanged file.
- [x] 8.11 Add desktop/mobile navigation tests proving exactly one player Finance Center entry, no legacy labels, correct `/income` active state, drawer close behavior and separate admin Economy.

### Task Group 9: Run Final Blocking Verification Gates

_Requirements: 10.1–10.6; Verification Criteria 1–8_

- [x] 9.1 Run backend unit/property tests for preparation financial Cycle 1, Canonical_Cycle_Identity, Serialized_Cycle_Cutover, Consistent_AsOf_View, sequence reconciliation, sale polarity/itemisation, repair single-contribution/reference, completed and partial-current Revenue_Growth, prestige forecast, allocation conservation, direct net, pagination invariance and query growth. **Completed 10 September 2026:** focused Finance and blocker regressions passed; the mandatory full backend unit gate passed 287 suites with 1 skipped and 3,983 tests with 1 skipped; the tier partition assigned all 425 test files exactly once.
- [x] 9.2 Run backend integration for preparation midnights, first competitive settlement, scheduled/admin parity, closing-writer races, blocked-writer next-cycle resolution, first-cycle/snapshot order, one-cutoff report reads, report APIs, auth/Zod/ownership/cache isolation, Player_Safe_Source_Reference stability/collision/opacity/non-authorization, zero settlement/boundary evidence, repair links, stable-aggregated battle allocations, scopes and pagination.
- [x] 9.3 Run frontend Vitest/lint/build for version-1 envelopes, preparation/provisional labels, Current_Cycle and Season_To_Date History, statements/proceeds/purchases, provisional/asymmetric growth, forecast, robot five-metric layout, public source references, loaded-page notice, tabs, local time and mobile states.
- [x] 9.4 Run `app/frontend/tests/e2e/finance-center.spec.ts` at 320px, 375px, 768px, 1023px, 1024px and 1920px for redirects, Current_Cycle History visibility, Season_To_Date active-point inclusion, keyboard/focus, target size, itemised readability, pagination notice, no overflow and lazy loading.
- [x] 9.5 Run Verification Criteria 1–3 and resolve forbidden quote/double-count/subtotal/combined-investment/`Promise.all`/N+1 references.
- [x] 9.6 Run Verification Criteria 4–6 while preserving every check as blocking.
- [x] 9.7 Run Verification Criteria 7–8; confirm guides/navigations consistently use Finance_Center concepts, exactly one player destination and the separate admin Economy surface.
- [x] 9.8 Review every acceptance criterion and coverage row; do not complete with hidden limitation, cycle guess, untested security boundary, advisory gate, incomplete disposition or legacy player-navigation link.

## Requirements Coverage Matrix

| Requirement criteria | Task groups |
|---|---|
| 1.1–1.3 | 1, 3, 5, 6, 9 |
| 1.4–1.6 | 1, 2, 3, 9 |
| 1.7 | 1, 3, 5, 6, 9 |
| 2.1–2.7 | 1, 3, 5, 6, 9 |
| 3.1–3.7 | 1, 3, 5, 6, 9 |
| 4.1–4.8 | 1, 3, 4, 6, 7, 9 |
| 5.1–5.5 | 1, 4, 6, 9 |
| 6.1–6.8 | 1, 4, 5, 7, 9 |
| 7.1–7.6 | 1, 5, 6, 7, 9 |
| 8.1–8.6 | 1, 3, 4, 5, 6, 7, 9 |
| 9.1–9.4 | 1, 4, 6, 8, 9 |
| 10.1–10.5 | 1, 2, 3, 4, 5, 6, 7, 8, 9 |
| 10.6 | 8, 9 |

Every acceptance criterion maps to mandatory work. Task Group 9 depends on Groups 1–8 and is the final gate.
