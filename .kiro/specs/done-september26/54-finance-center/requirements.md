# Requirements Document

## Finance Center

## Glossary

- **Finance_Center**: The player-facing financial report at `/income`, replacing the financial responsibilities of the existing Income Dashboard and Cycle Summary.
- **Current_Cycle**: The in-progress financial cycle. Its canonical number is `CycleMetadata.totalCycles + 1`, and its results through server-generated `asOf` are provisional. Financial Cycle 1 begins at the Season_Rollover instant, spans both preparation days plus the first competitive/match day and closes at the first competitive settlement; later cycles begin at their owning midnight UTC boundary.
- **Completed_Cycle**: A cycle whose complete closing evidence was written before `CycleMetadata.totalCycles` advanced. Its Finance_Statement is historical except for an explicitly documented administrative correction.
- **Canonical_Cycle_Identity**: The single financial cycle number and UTC boundary assignment used by every current financial writer, scheduled settlement, admin cycle, `cycle_end_balance`, `cycle_complete` event and `CycleSnapshot`.
- **Serialized_Cycle_Cutover**: The shared cycle-assignment boundary that prevents a current-economy writer from committing to a closing cycle after its balance capture; a writer blocked by closing resumes only after the completed count advances and resolves the next Current_Cycle.
- **Consistent_AsOf_View**: One database-consistent read view used for all ledger, audit, boundary, snapshot and current-`currency` evidence in one report response, so every comparison describes the same server-generated `asOf` cutoff.
- **Report_Period**: One Current_Cycle, one Completed_Cycle, a bounded inclusive completed-cycle range, or Season_To_Date, represented by normalized active-season cycle identity and UTC bounds.
- **Season_To_Date**: All active-season Completed_Cycles plus Current_Cycle through `asOf`; it never crosses a Season_Rollover or reads purged live history, and its finality is provisional because it contains Current_Cycle.
- **Season_Rollover**: The established season boundary that archives then purges live competitive and financial history; Finance_Center ranges never cross it.
- **Finance_Statement**: A reconcilable explanation of Credits movement exposing opening balance, earned Credits, investment proceeds, running costs, investment purchases, net cash movement and closing/current balance.
- **Financial_Record**: A current-economy `FinancialLedger`/`AuditLog` pair whose rows share a non-null `financialEventId`. The ledger amount is the authoritative signed balance movement; the paired financial audit supplies sequence and operational evidence. A row without that identity remains legacy evidence.
- **Reconciliation_Proof**: The ordered evidence and typed result proving Finance_Statement arithmetic agrees with actual balance movement, or identifying a named limitation without mutable reconstruction.
- **Reconciliation_Limitation**: A typed, named reason why a period cannot be asserted as reconciled, including missing pair, missing boundary, snapshot disagreement, administrative anomaly or legacy evidence.
- **Financial_Breakdown**: The stored amount-affecting facts attached to a Financial_Record; report code reads them as historical evidence and never recomputes old amounts from current state.
- **Repair_Spend**: Credits actually charged for repairs. One logical charged event is represented by a negative `FinancialLedger` `repair_cost`, its paired `financial_transaction`, and a `robot_repair` domain audit whose positive `creditsCharged` is used for repair subtype, count and display.
- **Full_Damage_Repair_Reference**: A non-financial, theoretical quote for repairing every currently active robot from full repairable damage, shown with automatic/manual totals, discount and per-robot count.
- **Battle_Allocation_Evidence**: Persisted per-robot battle/bye Credits in `BattleParticipant.credits`, joined to the related `battle_income` Financial_Record and validated so participant allocations sum to the stable ledger award.
- **Direct_Robot_Result**: Actual Credits attributable to one robot in the selected Report_Period: validated battle/bye allocation plus robot-attributed streaming revenue less robot-attributed Repair_Spend.
- **Stable_Wide_Allocation**: An optional, disclosed model apportioning stable-level income, operating cost or investment to robots. Persisted `BattleParticipant.credits` is actual Battle_Allocation_Evidence, not Stable_Wide_Allocation.
- **Booking_Office**: The established event-subscription surface opened by the sole action in Robot_Deployment_View.
- **Event_Exposure**: A robot’s subscriptions, held obligations, scheduled moments and team role that inform deployment decisions.
- **Robot_Deployment_View**: The tab presenting Direct_Robot_Result, financial event detail and Event_Exposure as read-only evidence. Its sole navigation action is Manage subscriptions to Booking_Office; it provides no team, repair or facility action.
- **Prestige_Earning_Power**: Non-currency context: prestige, next gate, battle-credit multiplier and merchandising prestige-per-roster-capacity effect.
- **Revenue_Growth**: The absolute and percentage change in actual earned Credits for the latest cycle included by the selected Report_Period. A Current_Cycle anchor compares partial earned Credits through `asOf` with the immediately previous Completed_Cycle and is labelled provisional/asymmetric; a Completed_Cycle anchor compares adjacent completed cycles. It is not net cash movement and excludes investment proceeds and purchases.
- **Prestige_Milestone_Forecast**: A clearly labelled historical estimate of completed cycles required to reach the next prestige gate, calculated only from stored positive prestige awards in a stated completed-cycle sample.
- **History_View**: The tab for Current_Cycle and completed-cycle financial history, Action_Effect_Trend and player-safe drill-down; Current_Cycle and Season_To_Date include the provisional active-cycle point and statement through `asOf`.
- **Action_Effect_Trend**: A readable comparison explaining whether net cash movement and Revenue_Growth changed versus the applicable prior cycle, using supported evidence.
- **Recorded_Driver**: A stored event or measured change shown by Action_Effect_Trend, such as a financial category movement, facility upgrade, standing-tier change, battle activity or repair event. It is evidence, not unsupported causation.
- **Player_Safe_Source_Reference**: An opaque display and drill-down reference generated at the report boundary. It is stable for the same source across refreshes and pages, collision-free within one authenticated stable and active season, non-reversible to raw internal identifiers, safe to display and log, and never an authorization credential.
- **Local_Time_Presentation**: Browser-local formatting of absolute server ISO timestamps. UTC remains the data and report-boundary authority; the UI does not add a redundant “Your local time” label.
- **Report_Contract**: Complete versioned authenticated Finance_Center response envelopes containing normalized period metadata, source/finality provenance, data, Reconciliation_Proof or limitations and pagination where applicable.
- **Report_Read_Model**: The read-only backend query service and typed contract that assemble Finance_Center data without mutation.
- **Report_Performance_Budget**: Agreed response-time, query-count and payload-size limits at the supported roster fixture.
- **Source_Provenance**: Machine-readable evidence basis and period finality. Actual, quoted or modelled source kind is separate from current-provisional or completed-historical period state.
- **Early_Season_State**: A valid state with no completed history, robots, financial events or prestige gate; it explains absence rather than inventing values.
- **Activation_Region**: A full pointer, keyboard and assistive-technology control target; at least 44px by 44px where both dimensions apply.
- **Route_Migration**: Compatibility redirects from `/finances` and `/cycle-summary` to Finance_Center.

## Introduction

The existing `/income` screen mixes rolling activity, current facility state and cached repair quotes, while `/cycle-summary` presents a separate completed-cycle view. Neither reliably explains Credits movement, operating costs per facility, investment purchases and proceeds, revenue growth or deployment outcomes. The current per-robot report also has N+1 query growth.

Finance_Center provides one time-bounded report: actual financial evidence itemised to the event/facility where stored, an always useful Full_Damage_Repair_Reference, current-or-completed Revenue_Growth with explicit finality, a completed-sample Prestige_Milestone_Forecast, and direct robot financial evidence. It changes reporting and normalizes Canonical_Cycle_Identity only; it does not change financial arithmetic, repair/reward amounts, subscriptions, teams or prestige rules.

## Scope and Boundaries

1. In scope: Finance_Center Overview, History_View, Robot_Deployment_View, report APIs, Canonical_Cycle_Identity normalization, reconciliation, itemised operating/investment evidence, Full_Damage_Repair_Reference, Revenue_Growth, Prestige_Milestone_Forecast, route migration, performance, security, guide content and tests.
2. In scope: Current_Cycle on every tab, Last Completed Cycle, Last Seven Completed Cycles, bounded completed-cycle ranges and Season_To_Date including Current_Cycle through `asOf`. Any period containing Current_Cycle is visibly provisional.
3. Out of scope: a player timezone/profile setting and any Dashboard UTC upcoming-battle change.
4. Out of scope: changing the closed transaction taxonomy, financial arithmetic, reward/repair arithmetic, `User.currency`, subscriptions, facilities, teams or prestige gates.
5. Source boundary: signed balance movement reads complete paired Financial_Record evidence. Repair display reads the linked `robot_repair` audit once for subtype/count/positive amount; it never adds that amount to the ledger amount a second time. `robots.repairQuoteCredits` is estimate-only.
6. Historical boundary: records without `financialEventId` are never paired or relabelled. State snapshots are boundaries/checks, not financial line sources. A Reconciliation_Limitation is stated instead of fabricated history.

## Expected Contribution

1. **Reconciled, itemised finance.** Before, Income uses estimated repairs, hides stable operating-cost components and conflates weapon sales with spend. After, each logical event is counted once, purchases and positive sale proceeds are separate, and complete periods prove opening plus signed movement equals closing.
2. **Canonical cycle ownership and consistent cutover.** Before, writers can disagree over active/completed numbering around midnight and report comparisons can observe different read cutoffs. After, all scheduled/admin writers use `CycleMetadata.totalCycles + 1`, preparation activity remains in financial Cycle 1 until first competitive settlement, Serialized_Cycle_Cutover prevents post-capture writes to the closing cycle, and each response uses one Consistent_AsOf_View.
3. **Auditable robot results.** Before, direct robot income lacks a conservation rule. After, five finance-only headlines show fought matches, battle/bye income, streaming revenue, actual repair spend and direct net, while `BattleParticipant.credits` allocations are validated against each related stable award.
4. **A useful repair planning reference and honest forecasts.** Before, a current-damage quote is often zero after login and forecasts lack evidence context. After, Full_Damage_Repair_Reference and sample-labelled Revenue_Growth/Prestige_Milestone_Forecast remain visibly separate from actual movement.
5. **Faster, safer report access.** Before, a client `Promise.all` blocks on an N+1 robot query. After, independently loaded, set-based, version-1 APIs enforce bounded periods, ownership and pagination while computing full-period totals independently of detail pages.
6. **Durable quality coverage.** Existing tests have explicit retain/adapt/retire dispositions and new coverage guards cycle identity, accounting sources, allocation conservation, itemisation, repair linkage, pagination, security, responsive UX and player-guide language.

### Verification Criteria

1. `grep -R "repairQuoteCredits" app/backend/src/services/financial app/frontend/src/components/finance app/frontend/src/pages/FinanceCenterPage.tsx` produces only Full_Damage_Repair_Reference quote use; report tests prove it never contributes to spend, net, balance or ROI.
2. `grep -R "robot_repair\|readRepairChargedCredits" app/backend/src/services/financial/financeReportQueryService.ts` confirms canonical repair display evidence; tests prove one signed ledger contribution per repair and exact linked subtype/count/amount validation.
3. `grep -R "Promise.all" app/frontend/src/pages/FinanceCenterPage.tsx app/frontend/src/hooks/useFinanceReport.ts app/frontend/src/hooks/useRobotDeployment.ts` returns no initial all-or-nothing panel coupling; query-growth tests prove robot summary work does not scale per robot.
4. `cd app/backend && pnpm run test:unit -- financeReport && pnpm run test:integration -- finances && pnpm run build && pnpm run typecheck:tests` verifies Canonical_Cycle_Identity, preparation Cycle 1, Serialized_Cycle_Cutover races, Consistent_AsOf_View reads, ordered reconciliation, sale proceeds, Battle_Allocation_Evidence, repairs, pagination, security routes and backend types.
5. `cd app/frontend && pnpm test -- --run src/pages/__tests__/FinanceCenterPage.test.tsx src/components/finance/__tests__ && pnpm run lint && pnpm run build` verifies period selection, version-1 contracts, itemisation, full-period/page separation, local display and responsive components.
6. `cd app/frontend && pnpm exec playwright test tests/e2e/finance-center.spec.ts` verifies redirects, keyboard tabs, 44px controls, no overflow from 320px through 1920px, page-total notices and lazy robot loading.
7. `grep -n "Full_Damage_Repair_Reference\|Revenue_Growth\|Prestige_Milestone_Forecast\|Robot_Deployment_View" docs/prd_pages/PRD_INCOME_DASHBOARD.md docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md app/backend/src/content/guide/economy/credits-and-income.md` confirms documentation migration.
8. `grep -n "Finance Center\|Income Dashboard\|Cycle Summary" app/frontend/src/components/nav/types.ts app/frontend/src/components/Navigation.tsx app/frontend/src/components/nav/MobileDrawer.tsx` confirms one shared player Finance Center entry and no legacy Stable-menu labels; navigation tests verify its desktop/mobile active state and that `/admin/economy` remains separate.

## Requirements

### Requirement 1: Define Canonical Time-Bounded Financial Records

**User Story:** As a player, I want every Credits figure to identify one canonical period and display timestamps naturally in my browser’s local time, so I can compare results safely.

#### Acceptance Criteria

1. THE Finance_Center SHALL support Current_Cycle, Last Completed Cycle, Last Seven Completed Cycles, bounded inclusive completed ranges and Season_To_Date.
2. THE Report_Contract SHALL return `version: 1`, normalized active-season identity, scope, inclusive cycle bounds, absolute UTC ISO `startsAt`, `endsAt`, `asOf`, period finality and per-component Source_Provenance; actual report evidence, completed-history comparisons, quoted current context and modelled forecasts SHALL not share one misleading provenance label. Version 1 SHALL identify the initial compatibility shape, not the game season.
3. THE client SHALL implement Local_Time_Presentation with browser-local formatting and correct daylight-saving offsets; it SHALL not display the redundant literal “Your local time” or repeatedly state the fixed cycle-start time.
4. Canonical_Cycle_Identity SHALL define `CycleMetadata.totalCycles` as completed financial cycles and active financial cycle as `totalCycles + 1`. Financial Cycle 1 SHALL start at the Season_Rollover instant, remain provisional across both preparation days and the first competitive/match day, contain every preparation Credits spend and achievement reward, and close only at the first competitive settlement. Preparation midnights SHALL advance preparation state without settling, closing or renumbering financial Cycle 1. Later financial cycles SHALL begin at their owning midnight UTC boundary. Every current financial writer SHALL use one canonical resolver. Scheduled and admin settlement SHALL close the active number, write settlement rows, `cycle_end_balance`, `cycle_complete` and `CycleSnapshot` under it, then advance `totalCycles` only after closing evidence; `CycleSnapshot` SHALL be written after `cycle_end_balance`. Serialized_Cycle_Cutover SHALL prevent a current-economy writer from committing to the closing cycle after closing balance capture; a blocked writer SHALL resume only after completed count advancement and resolve the next active cycle.
5. Active-season player labels SHALL use canonical financial cycle identity. During preparation they SHALL explicitly identify Cycle 1, Preparation and Provisional; after preparation they SHALL align with `competitiveCyclesCompleted + 1`. Midnight belongs to the financial cycle closed by settlement, scheduled/admin paths SHALL have parity, and Finance_Center SHALL return a Reconciliation_Limitation rather than guess when retained cycle identities disagree.
6. Season_To_Date SHALL include all active-season Completed_Cycles plus Current_Cycle through `asOf`, remain active-season scoped and never query purged live data. Its period finality SHALL be `current_provisional`. Current_Cycle, Season_To_Date and every financial evidence comparison in one response SHALL be assembled from one Consistent_AsOf_View; ledger, audit, boundary, snapshot and current-`currency` values from drifting read cutoffs SHALL not be compared. If retained evidence cannot prove a historical line or boundary, response/UI SHALL name the limitation and not substitute mutable current state.
7. A preset selection SHALL update URL state and request its exact Report_Period while retaining the tab. A custom range SHALL apply only after valid ordered active-season Completed_Cycle bounds pass field-associated validation. The UI SHALL reject stale responses. Refresh SHALL appear only for Current_Cycle and preserve tab/range/state.

### Requirement 2: Reconcile Actual Credits Movement with Itemised Evidence

**User Story:** As a player, I want every actual cost, purchase and proceed explained at the level I can verify, so I can trust the statement.

#### Acceptance Criteria

1. Finance_Statement SHALL expose `openingBalance`, `earnedCredits`, `investmentProceeds`, `runningCosts`, `investmentPurchases`, `netCashMovement` and `closingBalance` for its Report_Period.
2. For a period, Reconciliation_Proof SHALL read all ledger, paired-audit and boundary evidence from the response's Consistent_AsOf_View, select only complete identified Financial_Record entries, order them by paired audit (`cycleNumber`, `sequenceNumber`) so sequence numbers that restart in later cycles cannot interleave a range, derive opening as the earliest ledger `balanceAfter - amount`, sum each ledger `amount` exactly once as signed movement, and derive closing as the final ledger `balanceAfter`. It SHALL verify both `openingBalance + signedMovement = closingBalance` and `openingBalance + earnedCredits + investmentProceeds - runningCosts - investmentPurchases = closingBalance`.
3. For each Completed_Cycle, closing SHALL agree with retained `cycle_end_balance` and `CycleSnapshot` closing balance. Settlement’s zero-valued paired `passive_income` and `operating_costs` rows SHALL make a modern no-activity cycle explicit. A missing pair/boundary, snapshot disagreement, administrative anomaly or legacy evidence SHALL produce a typed Reconciliation_Limitation, never mutable reconstruction. `User.currency` SHALL confirm only Current_Cycle current balance, never historical opening/closing.
4. Earned Credits SHALL group `battle_income`, `streaming_revenue`, `passive_income` and `achievement_reward`. Positive `weapon_sale` SHALL be investment proceeds, not earned revenue and not subtracted investment purchases. Prestige SHALL never be currency.
5. Running costs SHALL show manual and automatic Repair_Spend independently with amount/count, then each stored facility operating-cost component. Investment proceeds SHALL itemise every weapon sale; investment purchases SHALL itemise every robot creation, facility upgrade, weapon purchase, Weapon Refinement and attribute upgrade. No event SHALL be collapsed into an ambiguous combined line.
6. Report rows SHALL use paired Financial_Record evidence and not reconstruct legacy records without `financialEventId`. A limitation SHALL be non-monetary and SHALL not create a line, total, trend, drill-down or robot amount.
7. Drill-down SHALL expose player-safe category, amount, Player_Safe_Source_Reference, evidence kind and period finality without raw audit/security payloads or internal identifiers.

### Requirement 3: Represent Repairs Once and Provide a Theoretical Reference

**User Story:** As a player, I want actual repairs explained once and a separate maximum repair scenario, even when I have already repaired today.

#### Acceptance Criteria

1. One logical charged repair SHALL consist of a negative `FinancialLedger` `repair_cost`, paired `financial_transaction`, and `robot_repair` audit whose `sourceEventId` equals the Financial_Record `financialEventId`.
2. Reconciliation_Proof SHALL count the signed ledger `amount` once. Repair_Spend subtype/count/display SHALL use the linked `robot_repair` positive `creditsCharged`; it SHALL verify `creditsCharged === abs(ledger.amount)` plus equal user, robot, Report_Period and `manual`/`automatic` subtype, and SHALL never add ledger and audit amounts as separate contributions.
3. A missing or mismatched repair link SHALL produce a typed Reconciliation_Limitation. `robots.repairQuoteCredits` remains estimate-only and SHALL never enter Finance_Statement, Direct_Robot_Result, history or Reconciliation_Proof.
4. Overview SHALL display Full_Damage_Repair_Reference: theoretical automatic and manual full-damage repair paths, manual saving, active-robot count and current Repair Bay discount context. It SHALL state it is a scenario, not a charge.
5. Full_Damage_Repair_Reference SHALL use shared functions in `app/shared/utils/repairCost.ts`, calculate/round per robot and not duplicate arithmetic in report code.
6. Full_Damage_Repair_Reference SHALL be read-only context with no repair, facility or mutation action and no implication that the scenario is a current quote or required decision.
7. A repair charged around a bye remains an independently linked automatic Repair_Spend event and is not attributed to bye income.

### Requirement 4: Deliver an Accessible, Read-Only Finance Overview

**User Story:** As a player on desktop or mobile, I want actual movement, growth and realistic planning without confusing decision prompts or finance mutations.

#### Acceptance Criteria

1. Overview SHALL follow project tile/card conventions and show balance, net cash movement, operating result and investment purchases for selected Report_Period; statement headings SHALL separately identify investment proceeds and purchases.
2. Overview SHALL provide an expandable Finance_Statement, Revenue_Growth and Prestige_Milestone_Forecast, Full_Damage_Repair_Reference and Prestige_Earning_Power without duplicating totals in unrelated cards.
3. Revenue_Growth SHALL anchor to the latest cycle included by the selected Report_Period and SHALL show actual earned Credits difference and percentage against the immediately previous cycle. When the anchor is Current_Cycle, it SHALL compare partial current earned Credits through `asOf` with the immediately previous Completed_Cycle and label the comparison provisional/asymmetric because the current side is incomplete; otherwise it SHALL compare adjacent Completed_Cycles. It SHALL exclude investment proceeds/purchases and distinguish revenue from net cash movement.
4. Prestige_Milestone_Forecast SHALL use only a stated completed-cycle sample with positive stored prestige awards, expose its facts, call itself a historical estimate and render named unavailable states.
5. Prestige_Earning_Power and forecast panels SHALL be explanatory/read-only and contain no facility or mutation action.
6. Overview SHALL render Early_Season_State for no history, events, robots or applicable prestige gate.
7. From 320px through 1023px sections SHALL stack, tables become cards/expandable rows, no page-level horizontal overflow occurs and no explanation requires hover. At 1024px+ tabs SHALL follow `.kiro/steering/frontend-standards.md`; all tabs, disclosures and pagination controls SHALL be keyboard accessible, visibly focused and meet Activation_Region requirements.
8. A failed History_View or Robot_Deployment_View request SHALL not hide successful Overview content.

### Requirement 5: Explain Revenue Growth, Trend and Recorded Effects

**User Story:** As a player, I want to see a real graph for revenue/cash movement and understand which stored changes are relevant.

#### Acceptance Criteria

1. History_View SHALL support Current_Cycle, Season_To_Date and completed-only selections. Current_Cycle and Season_To_Date SHALL include a provisional active-cycle point and Finance_Statement through `asOf`; completed-only custom and Last Seven Completed Cycles selections SHALL remain completed-only. History_View SHALL lead with the latest included cycle's net cash movement and Revenue_Growth, each with signed difference versus the applicable immediately prior cycle and plain up/down wording.
2. The primary visual SHALL be a labelled line graph with plotted values, cycle labels, 44px keyboard/selectable points and a complete accessible table equivalent. Colours only reinforce meaning; provisional active-cycle points SHALL be explicitly labelled as partial through `asOf`.
3. Selecting a point SHALL update that cycle’s Finance_Statement, Revenue_Growth comparison and “What changed?” list, ordered by financial deltas, relevant stored upgrades, standing-tier changes, battle activity and separate manual/automatic repairs.
4. UI SHALL distinguish evidence from causation and never claim an upgrade caused a measured movement without a proven model.
5. History_View SHALL retain a reconciled/limited statement card and player-safe drill-down for zero-activity cycles and provenance, with investment proceeds distinct from purchases.

### Requirement 6: Provide Direct Robot Deployment Evidence

**User Story:** As a player, I want direct robot financial performance and readable detail, so I can understand deployment evidence without initiating routine maintenance from this audit surface.

#### Acceptance Criteria

1. Robot_Deployment_View SHALL calculate Direct_Robot_Result as validated battle/bye allocation plus robot-attributed streaming revenue minus linked Repair_Spend. Streaming and repairs are already robot-attributed.
2. `BattleParticipant.credits` SHALL be treated as persisted per-robot Battle_Allocation_Evidence. Because `FinancialLedger` granularity varies and team league, tag team, KotH, Grand Melee and bye awards may be stable-aggregated, the read model SHALL join participant allocations to the related `battle_income` Financial_Record, restrict participants to robots whose owner equals that ledger row’s `userId`, and verify their sum equals that stable’s ledger award. It SHALL not claim every battle ledger row has `robotId`.
3. A missing/mismatched allocation sum SHALL create a typed limitation and exclude the unsupported robot amount; it SHALL never divide a stable award or relabel actual Battle_Allocation_Evidence as Stable_Wide_Allocation.
4. Each robot headline SHALL show exactly five vertically stacked, fixed-alignment metrics: fought matches, battle/bye income, streaming revenue, actual repair spend and direct net. Byes SHALL appear only in expandable detail and SHALL not increment fought matches.
5. Detail SHALL use one consistent visual hierarchy and show manual/automatic repair amount/count, individual battle/bye and streaming evidence with Player_Safe_Source_Reference values, subscriptions, held obligations, absolute scheduled instants formatted locally, tier and team membership/role.
6. Robot_Deployment_View SHALL expose only “Manage subscriptions” to the existing Booking Office; it SHALL not render generic team management, repair/facility actions, eligibility labels or duplicate mutation controls.
7. Default results SHALL exclude Stable_Wide_Allocation. A future modelled lens must disclose method/source totals without replacing Direct_Robot_Result.
8. Detail SHALL be ownership-verified, lazy and paginated. Full-period headline/period totals SHALL be computed independently of event pages. Detail SHALL have deterministic ordering, pagination metadata, optional page subtotal and the same full-period total; only all pages combined must reconcile to itemised period detail, and no individual page is required to equal the headline.

### Requirement 7: Secure and Version Report Access

**User Story:** As a player, I want private finance and robot data protected while using understandable, compatible filters and drill-downs.

#### Acceptance Criteria

1. Every Finance_Center route SHALL apply `authenticateToken` then `validateRequest` with strict `financeReportSchemas.ts` schemas for the same applicable period grammar, active-season range, ordering and pagination, using field-naming messages.
2. Every success response SHALL be a complete Report_Contract envelope with literal `version: 1`, normalized Report_Period metadata, a Source_Provenance summary plus truthful provenance on each independently sourced component, typed data, Reconciliation_Proof and/or Reconciliation_Limitation entries and one response-wide `asOf` representing its Consistent_AsOf_View; version 1 SHALL be explained as response-schema compatibility.
3. Report data SHALL define concrete payloads for Finance_Statement, History_View, robot summary and paginated robot detail; page metadata SHALL include stable order/tie-breaker, page/page size, total items, page count/next state, optional page subtotal and full-period total.
4. Stable identity SHALL derive only from JWT. `:robotId` SHALL verify ownership inside the data boundary and return generic `403 Access denied` without revealing existence.
5. Range/page maxima SHALL validate before expensive queries. The report boundary SHALL generate every Player_Safe_Source_Reference so it is stable for the same source across refreshes/pages, collision-free within the authenticated stable and active season, non-reversible to raw internal identifiers and safe to display/log. A Player_Safe_Source_Reference SHALL never authorize access. Responses, diagnostics and caches SHALL not expose raw `financialEventId`, audit IDs/payloads, tokens, unneeded internal IDs or cross-user data; tests SHALL verify reference stability, collision isolation, opacity and non-authorization.
6. Cache keys SHALL include authenticated stable, active season, exact normalized Report_Period, resource and page/order where applicable; tests SHALL prove isolation.

### Requirement 8: Meet Performance and Progressive Loading Budgets

**User Story:** As a player, I want useful reporting promptly with a large roster.

#### Acceptance Criteria

1. Initial load SHALL request Overview only; History_View and Robot_Deployment_View load when opened.
2. Report_Read_Model SHALL use bounded set-based query/grouping and not query finance, battle or repair rows per robot.
3. The deterministic fixture SHALL enforce p95 server targets: Overview ≤700ms, robot summary ≤1,000ms and one robot detail page ≤300ms, plus bounded response/query counts.
4. Completed reports may be immutably cached and Current_Cycle briefly cached; both expose `asOf` and meet Requirement 7 cache isolation.
5. Panels SHALL have independent loading/error/retry states with no page-wide `Promise.all`.
6. Pagination SHALL bound detail transport only; changing pages SHALL not recompute or change full-period robot headline totals.

### Requirement 9: Surface Prestige, Revenue and Forecast Context Honestly

**User Story:** As a player saving toward a facility gate, I want prestige and revenue context explained without calling prestige income.

#### Acceptance Criteria

1. Prestige_Earning_Power SHALL show current prestige, evidenced period gain, next gate and facility-unlock context; Battle Multiplier SHALL explain it multiplies base battle Credits awarded; merchandising context SHALL explain roster capacity as `roster_expansion` level plus one.
2. Prestige_Earning_Power SHALL never add prestige to Credits, balance, net, ROI or Revenue_Growth and SHALL use shared sources, not duplicated formulas.
3. Prestige_Milestone_Forecast SHALL expose sample size, total positive awards, average pace and ceiling-rounded cycle estimate; it SHALL not forecast a calendar date, battle results or prestige where pace is insufficient.
4. Dashboard prestige entry SHALL link to Finance_Center context without changing Dashboard Current_Cycle or UTC behaviour.

### Requirement 10: Preserve Evidence, Guide Content and Quality Gates

**User Story:** As a maintainer, I want evidence, player guidance and test disposition explicit so legacy behaviour cannot return silently.

#### Acceptance Criteria

1. Implementation plan SHALL classify every identified existing finance/cycle-summary test as retain, adapt or retire, with path/type; retire only after replacement contract coverage passes.
2. New backend unit/property, backend integration, frontend component and Playwright tests SHALL cover preparation financial Cycle 1, Canonical_Cycle_Identity, Serialized_Cycle_Cutover races, Consistent_AsOf_View reads, reconciliation, sale polarity, source isolation, Player_Safe_Source_Reference stability/opacity/non-authorization, Battle_Allocation_Evidence conservation, linked repairs, itemisation, report envelopes, current-inclusive History/Season_To_Date, provisional/asymmetric Revenue_Growth, pagination invariance, forecasts, security, local display/DST, trends, lazy loading and responsive accessibility.
3. Update `docs/prd_pages/PRD_INCOME_DASHBOARD.md`, `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md`, `app/backend/src/content/guide/economy/credits-and-income.md` and `docs/game-systems/PRD_PRESTIGE_AND_FAME.md`; player guidance SHALL explain actual/provisional periods, itemised proceeds/costs, repair reference, Revenue_Growth, forecasts and Robot_Deployment_View.
4. Create `docs/implementation_notes/finance-center-reporting-contract.md` and update named applicable steering files, recording checked-but-unchanged files.
5. Tests and CI gates SHALL remain blocking: no `continue-on-error`, `|| true`, unguarded pipe or advisory bypass.
6. Player navigation SHALL expose exactly one Finance Center destination at `/income`, remove legacy player labels/entries, preserve shared desktop/mobile active state and leave `/admin/economy` separate.

## Deliberately Out of Scope

- Changing finance, repair, prestige, fame, battle or bye arithmetic.
- Retrospectively rewriting legacy financial/audit evidence.
- Player timezone preference, profile locale field or Dashboard UTC-time behaviour.
- Treating any repair reference as a transaction.
- Predicting battle wins, revenue guarantees, calendar dates or a facility purchase decision from historical pace.
- A full progression page or player-side finance mutations in Finance_Center.
