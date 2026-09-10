# Design Document: Finance Center

## Overview

Finance_Center replaces the financial responsibilities of `/income` and `/cycle-summary` with a read-only report. Canonical_Cycle_Identity is prerequisite normalization: every financial writer and closing artifact must agree on the active cycle before the read model can classify periods, and Serialized_Cycle_Cutover prevents post-capture writes from entering a closing cycle. Every monetary amount is retained Financial_Record evidence for a UTC Report_Period read through one Consistent_AsOf_View; quote/model context is visibly separate. The client receives ISO instants and formats them naturally in browser local time.

```text
Canonical cycle resolver
        │
        ▼
Paired financial records + canonical repair audits + participant allocations + closing boundaries
        │
        ▼
Report_Read_Model (read-only, bounded, versioned)
   ┌──────────────┼──────────────┐
   ▼              ▼              ▼
Overview API   History API   Robot deployment APIs
        │
        ▼
Finance_Center: Overview | History_View | Robot_Deployment_View
```

## Source and Reporting Decisions

| Figure | Authoritative source | Boundary |
|---|---|---|
| Current balance confirmation | `User.currency` | Current_Cycle only. It is not a historical opening/closing source. |
| Signed movement | Complete Financial_Record: `FinancialLedger` plus paired `AuditLog` `financial_transaction` sharing `financialEventId` | Count each ledger `amount` once; paired audit (`cycleNumber`, `sequenceNumber`) orders records because sequence numbering restarts per cycle. Orphans yield a limitation. |
| Historical opening/closing | Earliest ordered ledger `balanceAfter - amount`; final ordered ledger `balanceAfter` | Never reconstructed from current state or timestamps. |
| Completed boundary check | `cycle_end_balance` and `CycleSnapshot` closing balance | Check/boundary only; never a financial line source. |
| Earned/running/purchase/proceed lines | Financial_Record taxonomy and stored Financial_Breakdown | Never use current formulas or rolling windows. |
| Weapon sale | Positive `weapon_sale` Financial_Record | Investment proceeds, outside earned Credits and purchase spend. Each sale is itemised. |
| Repair_Spend | One linked repair triple: negative `repair_cost` ledger row, paired financial audit and `robot_repair` audit | Ledger contributes once to signed movement. `robot_repair.creditsCharged` supplies positive display amount/subtype/count after exact link validation; never double-count. |
| Facility operating-cost line | Stored component facts in the paired settlement Financial_Breakdown | Never recompute from current facility levels. |
| Battle/bye robot allocation | `BattleParticipant.credits`, joined to the related `battle_income` Financial_Record | `FinancialLedger` granularity varies. Validate allocations sum to the stable ledger award; do not require ledger `robotId` or synthesize allocations. |
| Streaming robot attribution | Existing robot-attributed streaming Financial_Record evidence | No stable-wide apportionment. |
| Full_Damage_Repair_Reference | Active robots plus shared `repairCost.ts` functions using full repairable damage | Quote-only; no cash statement field. |
| Revenue_Growth | Actual earned Credits for the latest cycle included by the selected Report_Period versus its immediate predecessor | Current_Cycle compares partial evidence through `asOf` with the prior Completed_Cycle and is provisional/asymmetric; otherwise adjacent Completed_Cycles are compared. Excludes investment proceeds/purchases and is not net cash. |
| Prestige_Milestone_Forecast | Positive `prestige_change` records in stated completed-cycle sample plus current/next gate | Historical pace only; no promise/date/battle prediction. |
| Fought matches | Retained battle participation/activity evidence | Activity count only. |

Rows without `financialEventId`, missing pairs, missing boundaries, snapshot disagreement, administrative anomalies and inconsistent cycle identities produce typed Reconciliation_Limitation entries. No record is reconstructed or relabelled.

## Canonical Cycle Identity Prerequisite

A single resolver, proposed as `app/backend/src/services/cycle/canonicalCycleIdentity.ts`, owns financial cycle numbering:

1. `CycleMetadata.totalCycles` is the number of completed financial cycles; the active financial cycle is `totalCycles + 1`.
2. Financial Cycle 1 starts at the Season_Rollover instant. It remains provisional through both preparation days and the first competitive/match day, and every preparation spend and achievement reward is assigned to it. Preparation midnights advance preparation state without financial settlement, closure or renumbering. The first competitive settlement closes Cycle 1; later financial cycles start at their owning midnight UTC boundary.
3. During preparation, report metadata and player labels explicitly expose Cycle 1, Preparation and Provisional. After preparation, active-season labels align with `competitiveCyclesCompleted + 1`.
4. Every current financial writer requests the active number from this resolver rather than deriving or accepting a competing number.
5. Scheduled and admin settlement use Serialized_Cycle_Cutover with current-economy writers. Once closing balance capture begins, no writer can commit to the closing cycle. A blocked writer resumes only after `CycleMetadata.totalCycles` advances, then resolves the next active cycle before writing. This is an ordering invariant; the implementation may choose the transaction/locking mechanism that preserves it.
6. Settlement writes zero-or-nonzero paired `passive_income` and `operating_costs`, then `cycle_end_balance`, then `cycle_complete`, then `CycleSnapshot` under that same closing number. Only after complete closing evidence exists does the flow advance `CycleMetadata.totalCycles`.

Midnight ownership tests pin preparation midnights, first competitive settlement, records immediately before/during/after closure, blocked-writer reassignment, scheduled/admin parity, Cycle 1’s Season_Rollover `startsAt` and snapshot-after-end-balance ordering. Amount arithmetic does not change.

## Components and Interfaces

The service modules and frontend panels below form the Finance_Center interfaces. Each route returns a named version-1 envelope, and no route/component duplicates accounting arithmetic.

## Architecture

The backend is a thin authenticated route layer over bounded Report_Read_Model services. Contracts and Canonical_Cycle_Identity precede read-model implementation; routes follow services. The frontend uses independently loaded Overview, History_View and Robot_Deployment_View panels. No report path mutates finance, repairs, battles, subscriptions, teams or standings.

### Backend components

- `app/backend/src/services/cycle/canonicalCycleIdentity.ts` — one active/completed cycle resolver used by financial writers and settlement/admin paths.
- `app/backend/src/services/financial/financeReportPeriod.ts` — UTC active-season Report_Period normalization using Canonical_Cycle_Identity.
- `app/backend/src/services/financial/financeReportReconciliation.ts` — pure sequence-ordered statement, limitation and itemised-line mapping.
- `app/backend/src/services/financial/financeReportQueryService.ts` — stable statement, repair reference, Revenue_Growth and prestige data.
- `app/backend/src/services/financial/financeReportTrendService.ts` — Action_Effect_Trend and Recorded_Driver evidence.
- `app/backend/src/services/financial/prestigeMilestoneForecastService.ts` — pure sample validation and ceiling-rounded estimate.
- `app/backend/src/services/financial/robotDeploymentQueryService.ts` and `robotDeploymentDetailQueryService.ts` — batched summaries, allocation conservation and one owned paginated detail.
- `app/backend/src/types/financeReport.ts` — response/internal report types, exported by `src/types/index.ts`.
- `app/backend/src/schemas/financeReportSchemas.ts` — strict shared period and pagination schemas.

`app/backend/src/routes/finances.ts` stays thin: middleware, service call and response only.

## Data Models

The following projections are response/read-model types only; they add no Prisma model or duplicated financial state.

## Versioned Report Contract

The report is a projection; it introduces no Prisma model or duplicated financial state. `version: 1` means the first Finance Center response-schema compatibility version. It is unrelated to game season/cycle identity. Evidence kind and period finality are separate so an actual event may belong to a provisional Current_Cycle.

```ts
type FinanceTaxonomy =
  | 'battle_income'
  | 'streaming_revenue'
  | 'repair_cost'
  | 'facility_upgrade'
  | 'weapon_purchase'
  | 'weapon_sale'
  | 'weapon_refinement'
  | 'robot_creation'
  | 'attribute_upgrade'
  | 'achievement_reward'
  | 'passive_income'
  | 'operating_costs';

type ReportScope =
  | 'current'
  | 'last_completed'
  | 'last_seven'
  | 'season_to_date'
  | 'custom';

type EvidenceKind = 'actual' | 'quoted' | 'modelled';
type PeriodFinality = 'current_provisional' | 'completed_historical';

type ReconciliationLimitationCode =
  | 'missing_financial_pair'
  | 'missing_period_boundary'
  | 'snapshot_balance_disagreement'
  | 'cycle_end_balance_disagreement'
  | 'administrative_anomaly'
  | 'legacy_evidence'
  | 'cycle_identity_mismatch'
  | 'repair_link_mismatch'
  | 'battle_allocation_mismatch';

interface ReportPeriodMetadata {
  seasonNumber: number;
  scope: ReportScope;
  fromCycle: number;
  toCycle: number;
  activeCycle: number;
  phase: 'preparation' | 'competitive';
  containsCurrentCycle: boolean;
  startsAt: string;
  endsAt: string;
  asOf: string;
  finality: PeriodFinality;
}

interface SourceProvenance {
  evidenceKind: EvidenceKind;
  finality: PeriodFinality;
  basis: 'report_period' | 'current_context' | 'completed_sample';
  asOf: string;
}

interface ReportLimitation {
  code: ReconciliationLimitationCode;
  message: string;
  affectedSourceReference?: string;
}

interface CycleBoundaryProof {
  cycleNumber: number;
  cycleEndBalance: number | null;
  snapshotClosingBalance: number | null;
  status: 'matched' | 'limited';
  limitations: ReportLimitation[];
}

interface ReconciliationProof {
  status: 'reconciled' | 'provisional' | 'limited';
  orderedBy: 'cycle_number_then_audit_sequence_number';
  firstOrderKey: { cycleNumber: number; sequenceNumber: number } | null;
  lastOrderKey: { cycleNumber: number; sequenceNumber: number } | null;
  financialRecordCount: number;
  openingBalance: number | null;
  signedMovement: number;
  earnedCredits: number;
  investmentProceeds: number;
  runningCosts: number;
  investmentPurchases: number;
  closingBalance: number | null;
  equationDifference: number | null;
  completedCycleBoundaries: CycleBoundaryProof[];
  currentCurrencyConfirmation: number | null;
}

interface FinanceReportEnvelope<TData> {
  version: 1;
  period: ReportPeriodMetadata;
  provenance: SourceProvenance[];
  reconciliation: ReconciliationProof;
  limitations: ReportLimitation[];
  data: TData;
}

interface ItemisedStatementLine {
  taxonomy: FinanceTaxonomy;
  label: string;
  amount: number;
  sourceReference: string;
  provenance: SourceProvenance;
}

interface RepairStatementLine extends ItemisedStatementLine {
  taxonomy: 'repair_cost';
  repairType: 'manual' | 'automatic';
  eventCount: number;
}

interface FinanceStatement {
  provenance: SourceProvenance;
  openingBalance: number | null;
  earnedCredits: number;
  investmentProceeds: number;
  runningCosts: number;
  investmentPurchases: number;
  netCashMovement: number;
  closingBalance: number | null;
  earnedLines: ItemisedStatementLine[];
  investmentProceedLines: ItemisedStatementLine[];
  runningCostLines: Array<ItemisedStatementLine | RepairStatementLine>;
  investmentPurchaseLines: ItemisedStatementLine[];
}

interface FullDamageRepairReference {
  provenance: SourceProvenance;
  activeRobotCount: number;
  automatic: { amount: number; robotCount: number };
  manual: { amount: number; robotCount: number; saving: number };
  repairBayDiscountPercent: number;
  scenario: 'full_repairable_damage';
}

interface RevenueGrowth {
  provenance: SourceProvenance;
  currentEarnedCredits: number;
  previousEarnedCredits: number | null;
  amountDelta: number | null;
  percentDelta: number | null;
  comparedCycleNumber: number | null;
  comparisonBasis: 'completed_to_completed' | 'current_partial_to_completed';
}

interface PrestigeMilestoneForecast {
  provenance: SourceProvenance;
  currentPrestige: number;
  nextGatePrestige: number | null;
  remainingPrestige: number | null;
  completedCyclesSampled: number;
  positivePrestigeAwarded: number;
  averagePerCompletedCycle: number | null;
  estimatedCycles: number | null;
  status: 'available' | 'insufficient_history' | 'no_positive_pace' | 'no_next_gate';
}

interface FinanceOverviewData {
  statement: FinanceStatement;
  revenueGrowth: RevenueGrowth;
  repairReference: FullDamageRepairReference;
  prestigeForecast: PrestigeMilestoneForecast;
}

interface FinanceHistoryPoint {
  cycleNumber: number;
  statement: FinanceStatement;
  revenueGrowth: RevenueGrowth;
  reconciliation: ReconciliationProof;
  limitations: ReportLimitation[];
  drivers: RecordedDriver[];
}

interface FinanceHistoryData {
  points: FinanceHistoryPoint[];
  selectedCycle: FinanceHistoryPoint | null;
}

interface RobotFinancialSummary {
  provenance: SourceProvenance;
  robotId: number;
  robotName: string;
  foughtMatches: number;
  battleByeIncome: number;
  streamingRevenue: number;
  actualRepairSpend: number;
  directNet: number;
  fullPeriodTotal: number;
  limitations: ReportLimitation[];
}

interface RobotFinancialEvent {
  provenance: SourceProvenance;
  occurredAt: string;
  sourceReference: string;
  eventKind: 'battle_income' | 'bye_income' | 'streaming_revenue' | 'repair_cost';
  mode: string | null;
  fought: boolean;
  amount: number;
  repairType: 'manual' | 'automatic' | null;
}

interface PageMetadata {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  order: 'occurred_at_desc_source_reference_asc';
}

interface RobotFinancialEventPage {
  robot: RobotFinancialSummary;
  items: RobotFinancialEvent[];
  page: PageMetadata;
  pageSubtotal?: number;
  fullPeriodTotal: number;
}

type FinanceOverviewResponse = FinanceReportEnvelope<FinanceOverviewData>;
type FinanceHistoryResponse = FinanceReportEnvelope<FinanceHistoryData>;
type RobotSummaryResponse = FinanceReportEnvelope<RobotFinancialSummary[]>;
type RobotDetailResponse = FinanceReportEnvelope<RobotFinancialEventPage>;
```

`RecordedDriver` is the existing typed player-safe trend shape. Every response `sourceReference` is a Player_Safe_Source_Reference generated at the report boundary, not a retained raw identity. The generation scheme is stable for the same source across refreshes/pages, collision-free within `{authenticated stable, active season}`, non-reversible to the underlying identifier and safe to display/log. It is presentation/drill-down data only and never participates in authentication or authorization. Responses never expose raw `financialEventId`, audit row IDs, `AuditLog.payload`, security payloads or unnecessary internal IDs. Envelope `provenance` summarizes all source combinations, while each independently sourced component carries its own truthful provenance: an actual current statement, actual completed or partial-current Revenue_Growth, quoted current repair context and modelled completed-sample forecast can coexist without being collapsed into one label.

## Reconciliation and Itemisation

For each selected period, the query service opens one Consistent_AsOf_View and derives the response `asOf` from that database view. Ledger rows, paired/domain audits, completed boundaries, snapshots and Current_Cycle `User.currency` confirmation are all read inside it; no comparison combines values from separate drifting cutoffs.

1. Pair ledger and financial audit rows by non-null `financialEventId`; incomplete identities are excluded and named.
2. Order complete Financial_Record entries by paired audit (`cycleNumber`, `sequenceNumber`), never timestamp; `sequenceNumber` is only unique within its cycle.
3. Derive opening from the earliest ledger `balanceAfter - amount`.
4. Sum each ledger `amount` once to obtain signed movement.
5. Derive closing from the final ledger `balanceAfter`.
6. Verify `opening + signedMovement = closing` and the display equation:

```text
opening + earnedCredits + investmentProceeds - runningCosts - investmentPurchases = closing
```

7. For every Completed_Cycle inside a single-cycle or range selection, append one `CycleBoundaryProof` and compare that cycle’s closing with its own `cycle_end_balance` and `CycleSnapshot` closing balance. These are checks, not lines. An interior missing/mismatched boundary limits that cycle and the aggregate proof even when range opening/closing arithmetic balances. A modern no-activity cycle remains explicit because settlement writes zero-valued paired rows.
8. For Current_Cycle only, compare derived current closing with `User.currency` at the same read cutoff. `User.currency` never fills a historical boundary.

`achievement_reward` belongs to earned Credits. Positive `weapon_sale` belongs to investment proceeds and each sale is itemised separately. Purchases/refinements/upgrades remain positive display totals backed by negative ledger amounts. `prestige_change` never enters monetary arithmetic.

Settlement mapping reads stored operating-cost components and emits one line per facility. Missing historical component facts yield a non-monetary `legacy_evidence` limitation; current facilities are not used to manufacture history.

## Repair Linkage and Reference

A charged repair is one logical event with three records. The negative ledger row is used once in signed reconciliation. Its paired financial audit proves the Financial_Record, while the domain `robot_repair` audit supplies `creditsCharged`, `repairType`, count and robot display. The join requires `robot_repair.sourceEventId === financialEventId`, equal user/robot/period/subtype and `creditsCharged === Math.abs(ledger.amount)`. Failure produces `repair_link_mismatch`; there is no fallback and no second monetary contribution.

Full_Damage_Repair_Reference calculates each active robot as though it required full repairable damage, using shared utilities, per-robot rounding, current Repair Bay context and manual discount exactly once. It is always marked theoretical/not charged and provides no action. `repairQuoteCredits` is not read as spend.

## Robot Attribution and Pagination

`FinancialLedger` rows are not assumed to be per robot. Some 1v1/streaming/repair evidence may carry robot identity, while team league, tag team, KotH, Grand Melee and bye `battle_income` may be one stable-level award. `BattleParticipant.credits` is the retained allocation for the robots that earned that award.

For each related battle/bye source, the read model:

1. Locates the complete stable `battle_income` Financial_Record by retained source identity.
2. Loads `BattleParticipant.credits` for that source only where the participant robot’s owner equals the ledger `userId`.
3. Verifies that owner-scoped allocation sum equals the positive stable ledger award.
4. Assigns each persisted participant amount to that robot as actual Battle_Allocation_Evidence.
5. Emits `battle_allocation_mismatch` and excludes unsupported attribution if identity or conservation fails; it never divides the award.

Streaming and repairs retain their existing robot attribution. Direct net is `battleByeIncome + streamingRevenue - actualRepairSpend`. The five headline metrics are fought matches, battle/bye income, streaming revenue, actual repair spend and direct net. Byes are detail evidence but not fought matches.

Headline and grouped full-period totals are computed before pagination. Individual event detail uses deterministic `occurredAt DESC, sourceReference ASC`, bounded page size, page metadata, optional page subtotal and the unchanged full-period total. A page is a transport slice: no page must equal the headline. Concatenating every page exactly once must reproduce the bounded itemised period set and total without duplicates/omissions.

## API Contract and Security Boundary

All endpoints accept the same applicable period selector: either `scope=current|last_completed|last_seven|season_to_date` or both ordered `fromCycle`/`toCycle`, never both forms.

```text
GET /api/finances/report?scope=current
GET /api/finances/report?fromCycle=42&toCycle=48
GET /api/finances/history?scope=last_seven
GET /api/finances/history?fromCycle=42&toCycle=48
GET /api/finances/robots?scope=current
GET /api/finances/robots?fromCycle=42&toCycle=48
GET /api/finances/robots/:robotId/events?scope=current&page=1&pageSize=20
GET /api/finances/robots/:robotId/events?fromCycle=42&toCycle=48&page=1&pageSize=20
```

Every route returns its named `FinanceReportEnvelope<T>` or the standard `{ error, code, details? }` error. Every route applies `authenticateToken`, then `validateRequest`. Range normalization occurs before service/cache lookup. Cache keys contain `{userId, activeSeasonId, normalizedPeriod, resource, page, pageSize, order}` where applicable.

Stable identity comes only from JWT. Robot detail verifies ownership inside the service data boundary and returns generic `403 Access denied`. Bounded input validates before expensive reads. Each service assembles its envelope inside one Consistent_AsOf_View and uses that view’s `asOf`. The report boundary converts internal source identity into Player_Safe_Source_Reference values before response, cache or diagnostics handling; public references never authorize access. Responses/diagnostics/caches exclude raw `financialEventId`, audit IDs/payloads, tokens, security information and unnecessary internal IDs.

## Report Period Controls and Time

`FinanceCenterPage.tsx` owns URL-backed `tab=overview|history|robots` and period selection. Every panel request key includes normalized Report_Period identity, so stale responses cannot attach after period changes. Custom errors set `aria-invalid`, associate text through `aria-describedby` and focus the first invalid bound. Refresh exists only for `scope=current`.

`financeReportPeriod.ts` returns UTC ISO instants. Financial Cycle 1 uses the Season_Rollover instant as `startsAt`; later cycles use their owning midnight. During preparation, `phase: 'preparation'`, Current_Cycle number 1 and provisional finality drive explicit Cycle 1 / Preparation / Provisional labels. Season_To_Date spans all active-season Completed_Cycles plus Current_Cycle through `asOf`, sets `containsCurrentCycle: true` and is wholly `current_provisional`. `financeTime.ts` formats report instants in browser locale/timezone. Absolute exposure instants use the same presentation. DST tests pin both sides of transition instants. Dashboard UTC behavior remains unchanged.

Tabs implement tablist/tab/tabpanel relationships, roving `tabindex`, Arrow Left/Right, Home/End, Enter/Space where applicable, visible focus and focus preservation across URL updates.

## Revenue Growth, Forecast and History

Revenue_Growth anchors to the latest cycle included by History_View. If that anchor is Current_Cycle, it compares earned Credits through `asOf` with the immediately previous Completed_Cycle and returns `comparisonBasis: 'current_partial_to_completed'`; UI copy explicitly calls the comparison provisional/asymmetric because a partial active cycle is compared with a complete prior cycle. Otherwise it compares adjacent Completed_Cycles with `comparisonBasis: 'completed_to_completed'`. Both forms exclude investment proceeds and purchases and remain distinct from net cash movement. Early history renders an explanation rather than a percentage from zero.

Prestige_Milestone_Forecast uses the latest seven completed active-season cycles available, positive `prestige_change` awards and `ceil(remainingPrestige / averagePerCompletedCycle)`. Current_Cycle does not enter that completed sample. It displays its sample and limitations and never predicts dates, wins or guaranteed income.

History_View accepts every Report_Period. Current_Cycle renders one provisional active-cycle point/statement through `asOf`; Season_To_Date renders all completed points plus that provisional point and marks the entire period current-provisional. Last Seven Completed Cycles and custom ranges remain completed-only. The labelled SVG and complete accessible table identify partial points explicitly. Selecting a point updates the selected cycle’s complete statement, Revenue_Growth and Recorded_Driver entries. Drivers can include category movement, recorded upgrades, tier movement, battle activity and repair movement, but report correlation rather than unsupported causation.

## Frontend Composition and Responsive Behaviour

Create `FinanceCenterPage.tsx`, `useFinanceReport.ts`, `useRobotDeployment.ts`, `financeApi.ts`, `financeTime.ts`, `FinanceStatement.tsx`, `RevenueGrowthForecast.tsx`, `FullDamageRepairReference.tsx`, `PrestigeMilestoneForecast.tsx`, `FinanceHistoryView.tsx`, `ActionEffectTrend.tsx`, `RobotDeploymentView.tsx`, `RobotDeploymentCard.tsx` and `RobotDeploymentDetail.tsx`.

Overview is the only initial request. History and robot panels load independently on first open. At 320–1023px, sections stack, statements/history/event rows become labelled cards or disclosures, pagination stays readable, all values remain visible and only the responsive tab strip may scroll internally; there is no page-level horizontal overflow. At ≥1024px, tabs use `.kiro/steering/frontend-standards.md`. Tabs, statement disclosures and pagination controls retain visible focus and 44px Activation_Region targets. No explanation is hover-only and colour is never the sole cue.

Robot detail uses one section hierarchy for event results, repair breakdown and exposure. Its only action is Manage subscriptions to generic Booking Office. Loading, error/retry, empty/no-activity and page-boundary states retain the full-period context and never rank a robot as unprofitable.

## Performance, Cache and Observability

| Request | p95 target | Strategy |
|---|---:|---|
| Overview | ≤700ms | Bounded grouped records; no robot detail; short current/immutable completed cache. |
| Robot summary | ≤1,000ms | Set-based allocation/repair/streaming aggregation plus exposure. |
| Robot detail page | ≤300ms | One owned robot, precomputed full-period totals and bounded event slice. |

The deterministic fixture records input facts, query count, response bytes and timings. A breach fails. Cache entries never cross user, season, normalized period, resource or page/order.

## Route Migration

1. Render Finance_Center at `/income` inside shared player Navigation.
2. Replace “Income Dashboard” with “Finance Center” at `/income`; remove the `/cycle-summary` player entry.
3. Redirect `/finances` to `/income` and `/cycle-summary` to `/income?tab=history`, translating valid `lastNCycles`.
4. Keep Dashboard Credits/Prestige links pointed to Finance_Center without changing Dashboard time/current-cycle semantics.
5. Keep `/admin/economy` separate.
6. Remove legacy calls only after replacement/redirect/navigation coverage passes; retain redirects.

## Correctness Properties

### Property 1: Sequence-Ordered Reconciliation

**Validates: Requirements 2.2, 2.3**

For complete identified records ordered by paired audit (`cycleNumber`, `sequenceNumber`), earliest `balanceAfter - amount` plus each signed ledger amount once equals final `balanceAfter`; per-cycle sequence restarts cannot interleave range records. Every Completed_Cycle in a range has its own boundary proof and equals both closing checks or names a limitation; an interior mismatch limits the aggregate even when range arithmetic balances. Timestamps/current state never repair a gap.

### Property 2: Sale Polarity and Itemisation

**Validates: Requirements 2.1, 2.4, 2.5**

Every positive `weapon_sale` increases closing balance once, appears as one investment-proceeds line, stays outside earned Credits/Revenue_Growth and is never subtracted as a purchase. Every purchase and stored facility component remains separately itemised.

### Property 3: Repair Single-Contribution Link

**Validates: Requirements 3.1, 3.2, 3.3**

A repair contributes its ledger amount once. Linked `robot_repair.creditsCharged` equals the absolute ledger amount and supplies subtype/count/display. Any link mismatch yields `repair_link_mismatch`, never fallback, reconstruction or double-counting.

### Property 4: Repair Reference Isolation

**Validates: Requirements 3.3, 3.4, 3.5, 3.6**

Full_Damage_Repair_Reference and `repairQuoteCredits` cannot enter actual statement, net, balance, history or robot fields and cannot render a mutation/navigation action.

### Property 5: Battle Allocation Conservation

**Validates: Requirements 6.1, 6.2, 6.3**

For each related stable battle/bye award, the sum of `BattleParticipant.credits` belonging to robots owned by the ledger `userId` equals that stable’s ledger award before any per-robot amount is reported. No ledger `robotId` is required, no opposing stable’s allocation can enter the sum, no unsupported stable amount is apportioned, and persisted allocations remain actual evidence.

### Property 6: Robot Direct-Net Identity

**Validates: Requirements 6.4, 6.5, 6.6, 6.7**

For every robot, `battleByeIncome + streamingRevenue - actualRepairSpend = directNet`; byes do not increment fought matches and Stable_Wide_Allocation never enters the default result.

### Property 7: Pagination Invariance

**Validates: Requirements 6.8, 8.6**

Changing page/page size does not change full-period totals. Stable ordering yields no duplicate/omitted event; all pages combined equal the itemised bounded-period set, while no individual page must equal the headline.

### Property 8: Cycle Identity and Serialized Cutover

**Validates: Requirements 1.4, 1.5**

Scheduled/admin paths resolve the same active cycle. Financial Cycle 1 starts at Season_Rollover, contains all preparation spending/achievement income and does not close or renumber at preparation midnights; its first closure is the first competitive settlement. Later cycles use owning midnight boundaries. Once closing balance capture begins, no current-economy writer can commit to the closing cycle; a blocked writer resumes after completed-count advancement and resolves the next cycle. `CycleSnapshot` follows `cycle_end_balance`, and completed count advances only after all closing evidence.

### Property 9: Provenance, Consistent View and Contract Version

**Validates: Requirements 1.2, 1.6, 7.2, 7.3**

Every success envelope has `version: 1`; actual evidence can be current-provisional or completed-historical without conflating source kind and finality. Every endpoint echoes the normalized period. Every ledger/audit/boundary/snapshot/current-`currency` comparison in one envelope comes from one Consistent_AsOf_View and shares its `asOf`.

### Property 10: Forecast Evidence Boundary

**Validates: Requirements 4.3, 4.4, 9.3**

Revenue_Growth and Prestige_Milestone_Forecast use only stated completed evidence and never include sale proceeds or promise revenue/date/battle outcome.

## Error Handling

Authentication/validation errors use existing middleware and field-naming messages. Missing/non-owned robot detail is generic `403 Access denied`. Reconciliation_Limitation entries use the closed codes in the contract and never expose raw payloads. Missing cycle identity, financial pairs/boundaries, snapshot disagreement, repair-link mismatch, allocation mismatch, legacy component gaps, unavailable forecast samples and independent panel/page failures render named explanations rather than invented values or page-wide failure.

## Testing Strategy

Backend unit/property tests cover preparation Cycle 1, cycle identity/order, Serialized_Cycle_Cutover races, Consistent_AsOf_View reads, sequence reconciliation, sale polarity, itemisation, repair linkage/reference, allocation conservation, direct-net identity, pagination invariance, current-inclusive Revenue_Growth and forecasts. Backend integration tests cover persisted source joins, zero settlement rows, boundary comparisons, scheduled/admin parity, blocked-writer reassignment, API envelopes/period grammar, Current_Cycle/Season_To_Date History, ownership, Player_Safe_Source_Reference stability/collision isolation/opacity/non-authorization, caching and safe payloads. Frontend Vitest covers version-1 consumption, preparation/current labels, provisional/asymmetric comparisons, statement headings, robot metrics, full-period/page separation, tabs, field errors, loading/empty/error states and mobile transformations. Playwright covers route migration, current History visibility, keyboard interactions, page notices, 44px targets and 320–1920px no-overflow behavior.

### Existing Test Disposition

| Existing file | Type | Disposition |
|---|---|---|
| `app/backend/tests/finances.test.ts` | Backend integration | Adapt; retire legacy endpoint assertions after replacements. |
| `app/backend/tests/financesRouteValidation.test.ts` | Backend unit | Retire/adapt duplicated ROI schema assertions; add report-schema coverage. |
| `app/backend/tests/financialReportStreamingRevenue.test.ts` | Backend integration | Retire/replace legacy report aggregation assertions. |
| `app/backend/tests/services/streamingRevenueParity.test.ts` | Backend unit/property/static | Retain/adapt formula/property checks. |
| `app/backend/tests/cycleSummaryStreamingRevenue.property.test.ts` | Backend integration/property | Retain unchanged. |
| `app/backend/tests/coverageManifest.test.ts` | Backend static/unit | Adapt stale Cycle Summary expectations. |
| `app/backend/tests/analyticsApi.test.ts` | Backend integration | Retire/repurpose after endpoint decommissioning. |
| `app/backend/src/services/financial/__tests__/financialService.test.ts` | Backend unit | Adapt/retire legacy route-specific tests. |
| `app/frontend/tests/e2e/financial-flow.spec.ts` | Playwright E2E | Adapt legacy Income tests; retain unrelated flows. |

## Documentation Impact

- `docs/prd_pages/PRD_INCOME_DASHBOARD.md`: versioned contracts, itemisation, robot allocation, pagination, repair reference, growth/forecast and migration.
- `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md`: sequence reconciliation, closing boundaries, repair triple and Battle_Allocation_Evidence.
- `app/backend/src/content/guide/economy/credits-and-income.md`: player-facing proceeds/purchases, repair evidence/reference, growth/forecast and deployment metrics.
- `docs/game-systems/PRD_PRESTIGE_AND_FAME.md`: multiplier/roster-capacity definitions and forecast boundary.
- `docs/implementation_notes/finance-center-reporting-contract.md`: Canonical_Cycle_Identity, response envelopes, source map, limitations, formulas, security/cache/performance/test/migration record.
- `.kiro/steering/project-overview.md`, `.kiro/steering/frontend-standards.md`, `.kiro/steering/performance-guidelines.md`, `.kiro/steering/testing-strategy.md`: update durable conventions only; record checked-but-unchanged files.

## Requirements Traceability

| Requirement criteria | Design coverage |
|---|---|
| 1.1–1.3 | Versioned Report Contract; Report Period Controls and Time |
| 1.4–1.6 | Canonical Cycle Identity Prerequisite; Reconciliation and Itemisation |
| 1.7 | Report Period Controls and Time; Frontend Composition |
| 2.1–2.7 | Source Decisions; Versioned Report Contract; Reconciliation and Itemisation; Properties 1–2 |
| 3.1–3.7 | Repair Linkage and Reference; Properties 3–4 |
| 4.1–4.8 | Versioned Report Contract; Frontend Composition; Revenue Growth/Forecast |
| 5.1–5.5 | Revenue Growth, Forecast and History; Reconciliation and Itemisation |
| 6.1–6.4 | Robot Attribution and Pagination; Properties 5–6 |
| 6.5–6.8 | Robot Attribution and Pagination; Frontend Composition; Property 7 |
| 7.1–7.6 | Versioned Report Contract; API Contract and Security Boundary |
| 8.1–8.6 | Architecture; Frontend Composition; Performance/Cache; Property 7 |
| 9.1–9.4 | Revenue Growth, Forecast and History; Route Migration |
| 10.1–10.2 | Existing Test Disposition; Testing Strategy |
| 10.3–10.5 | Documentation Impact; Testing Strategy |
| 10.6 | Route Migration |
