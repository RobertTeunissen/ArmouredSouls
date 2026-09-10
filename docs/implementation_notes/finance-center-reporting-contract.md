# Finance Center Reporting Contract

**Spec:** #54 — Finance Center
**Document role:** Evidence inventory, implemented reporting contract, cutover record, and verification runbook
**Status:** Application cutover implemented; release/deployment and blocking-verification evidence are recorded separately
**Last reviewed:** September 2026

## 1. Status and interpretation

This document deliberately separates implementation from release and verification evidence:

| State | Meaning |
|---|---|
| **Implemented application behavior** | Version-1 Finance Center routes, read models, UI, and canonical cutover behavior have landed in the application. This establishes repository/application implementation; it is not by itself release-environment proof. |
| **Release/deployment evidence** | Environment, release identifier, activation time, and any operational rollout facts. An unrecorded value is an evidence gap, not evidence that the implementation is absent. |
| **Verification evidence** | An actual command, execution date, and observed result. Required or replacement coverage is not a claim that an unrun test passed. |
| **Implementation record incomplete** | A mechanism, configuration value, benchmark, or other implementation fact still needs to be documented here. It must not be described as an unimplemented Finance Center feature solely because this record is incomplete. |

The Finance Center application cutover is implemented. This contract does not independently prove which environment received a release or that a blocking suite passed: those are separate facts recorded in §10.3 when evidence is available. Version-1 APIs and UI may be described as implemented; they may be described as release-verified only with a recorded result.

## 2. Pre-cutover surface inventory and migration reference

The following inventory records the legacy surfaces and writer behavior that the Finance Center cutover replaced. It is retained for migration and compatibility decisions; it is not a statement of current application behavior.

### 2.1 Player routes and loading behavior

| Surface | Pre-cutover behavior | Post-cutover disposition |
|---|---|---|
| `/income` | Protected `FinancialReportPage`. It requested daily report, projections, and per-robot report in one page-wide `Promise.all`; one failure hid the whole page. | `FinanceCenterPage`; Overview loads first, while History and Robots load independently when opened. |
| `/finances` | Redirected to `/income`. | Preserve compatibility redirect. |
| `/cycle-summary` | Separate protected `CycleSummaryPage`; sent the authenticated user ID in the URL and read `CycleSnapshot.stableMetrics` through the analytics API. | Redirect to `/income?tab=history`, translating a valid `lastNCycles` value where possible. Remove the separate player navigation entry. |
| `/admin/economy` | Separate administrative economy surface. | Preserve; it is not a player Finance Center alias. |

The pre-cutover navigation labels “Income Dashboard” and “Cycle Summary” as two player destinations. Finance Center provides exactly one player destination, “Finance Center” at `/income`.

### 2.2 Deployed finance and analytics APIs

All deployed finance routes authenticate, but their responses are unversioned and do not form a reconciled report envelope.

| Endpoint | Current source/behavior | Cutover disposition |
|---|---|---|
| `GET /api/finances/daily` | Legacy daily report. Uses rolling battle activity/current calculations and legacy presentation shapes. | Replace as a Finance Center client dependency. |
| `GET /api/finances/summary` | Current `User.currency`, prestige, and current-state passive/operating calculations. | Not a historical statement source. |
| `GET /api/finances/operating-costs` | Recalculates costs from current facilities. | Current context only; historical lines use stored settlement facts. |
| `GET /api/finances/revenue-streams` | Current passive calculation and prestige multiplier context. | Current context only. |
| `GET /api/finances/projections` | Current-state weekly/monthly extrapolations and recommendations. | Not part of the read-only evidence contract. |
| `GET /api/finances/per-robot` | Rolling seven-day battles, current repair quotes, synthetic merchandising share, evenly allocated facility cost, profitability ranking; performs a battle query per robot. | Retire as a Finance Center dependency after replacement coverage. |
| `POST /api/finances/roi-calculator` | Facility ROI calculator. | Outside the Finance Center read contract; removal, if any, is a separate decision. |
| `GET /api/finances/ledger` | Groups all ledger rows by type/cycle. Optional bounds can be supplied independently; sale proceeds are grouped as ordinary income; pair completeness, ordering, boundaries, repair subtype, season scope, and reconciliation are not checked. | Replace for player reporting with version 1 read models. |
| `GET /api/analytics/stable/:userId/summary?lastNCycles=N` | Builds completed-cycle income, expense, purchases, balance, and net from `CycleSnapshot.stableMetrics`. | Retire/repurpose only after History replacement. A snapshot is a closing check, not a Finance Statement line source. |

### 2.3 Pre-cutover writer and serialization inventory

- `Credit_Mutation_Service` locks and re-reads `User.currency`, applies one signed change, and writes one `FinancialLedger` plus one `AuditLog` `financial_transaction` sharing `financialEventId` in the same transaction. A failure rolls back the balance. Duplicate immutable identity retries return the existing result.
- `withAuditSequence` allocates the audit `sequenceNumber`; ordering is unique within a cycle, not globally.
- `Repair_Mutation_Service` creates one per-robot `repair_cost` pair and, only when that pair is newly created, one `robot_repair` domain audit whose `sourceEventId` is the same financial identity.
- `Settlement_Service` writes deterministic `passive_income` and `operating_costs` pairs per stable/cycle, including zero-valued rows. Stored breakdowns contain merchandising and individual operating-cost components. A stable’s two components commit together and retries use the existing identities.
- Settlement currently serializes each stable against its own `User.currency` row. There is no shared cycle-cutover lock preventing an unrelated writer from resolving the closing cycle before balance capture and committing after capture.
- The pre-cutover scheduled settlement treated `CycleMetadata.totalCycles` as the cycle being closed, wrote settlement and `cycle_end_balance`, advanced `totalCycles`, and only then wrote `cycle_complete` and `CycleSnapshot`. That historic order is retained here as contrast with the Finance Center contract.
- Pre-cutover `Settlement_Service.getCurrentSettlementCycleNumber()` returned `totalCycles` (or `0`), confirming the prior active-cycle convention differed from the canonical contract.
- Scheduled and administrative cycle flows use the shared serialized closure behavior. The exact shared entry point and parity-run evidence remain separately recorded implementation and verification details.

## 3. Evidence inventory and source boundaries

### 3.1 Canonical source map

| Question | Authoritative evidence | Supporting/check evidence | Never use as a substitute |
|---|---|---|---|
| Current Credits balance | `User.currency`, read in the report’s consistent view | Final current-cycle financial record | A ledger-derived mutable balance field or invented `User.credits` |
| Signed Credits movement | Complete `FinancialLedger` + `financial_transaction` audit pair joined by non-null `financialEventId` | Stored breakdown in ledger metadata/audit payload | Snapshot totals, battle payloads, current formulas, or null-identity legacy rows |
| Record order | Paired audit `(cycleNumber, sequenceNumber)` | Timestamps for display only | Timestamp order or `sequenceNumber` without cycle |
| Historical opening | First ordered ledger `balanceAfter - amount` | Completed-cycle boundaries | Current `User.currency` |
| Historical closing | Last ordered ledger `balanceAfter` | `cycle_end_balance` and snapshot `StableMetric.balance` | Current `User.currency` |
| Completed-cycle closure | The cycle’s derived closing, checked against `cycle_end_balance` and `CycleSnapshot.stableMetrics[].balance` | `cycle_complete` for closure identity/order | Treating snapshot metrics as transaction lines |
| Category and explanation | Closed taxonomy plus stored Financial_Breakdown | Player-safe category labels | Re-running today’s formula against historical mutable state |
| Actual repair movement | Negative/zero `repair_cost` ledger row counted once | Paired financial audit; linked `robot_repair` for positive display amount, subtype, count, and robot | `battle_complete`, `repairQuoteCredits`, or adding audit amount to ledger amount |
| Manual vs automatic repair spend | Linked `robot_repair.creditsCharged` and `repairType` after exact identity/amount/owner/robot/period validation | The related `repair_cost` pair | A subtype-losing ledger aggregate |
| Facility operating components | Stored `operating_costs` Financial_Breakdown | Settlement domain audit | Current facility levels/formulas |
| Weapon-sale proceeds | Positive `weapon_sale` pair | Stored item facts | Earned Credits or negative purchase spend |
| Robot battle/bye allocation | `BattleParticipant.credits` joined to the related complete `battle_income` pair and owner-scoped conservation check | Battle/schedule identity and stored award breakdown | Dividing a stable award or assuming every ledger row has `robotId` |
| Robot streaming revenue | Complete robot-attributed `streaming_revenue` pair | `BattleParticipant.streamingRevenue` as compatibility/result evidence | Synthetic stable-wide allocation |
| Fought match count | Retained battle participation/result evidence | Battle summary | A bye event; byes are detail but not fought matches |
| Prestige gain | Positive `prestige_change` audit rows with unique `sourceEventId` | Current `User.prestige` as context | A financial amount or ledger line |
| Full-damage repair reference | Active robots and shared `app/shared/utils/repairCost.ts` functions, rounded per robot | Current Repair Bay context | `repairQuoteCredits` as spend or any statement movement |
| Cross-season history | Season archive tables only | None | Purged live ledger/audit/snapshot/battle rows |

### 3.2 Stored fields and granularity

- `FinancialLedger` stores `cycleNumber`, `userId`, optional `robotId`, signed `amount`, `balanceAfter`, taxonomy, description, structured metadata, nullable legacy-compatible `financialEventId`, and `createdAt`.
- `AuditLog` stores `cycleNumber`, cycle-local `sequenceNumber`, event type/time, optional user/robot/battle IDs, payload/metadata, and nullable `financialEventId`/`sourceEventId`.
- `BattleParticipant` permanently stores `battleId`, `robotId`, `credits`, and `streamingRevenue`. It has no foreign key to a financial row.
- `CycleSnapshot.stableMetrics` stores per-stable `balance` and aggregate context. It is a boundary/check source after cutover, never a transaction-line source.
- `CycleMetadata.totalCycles` and `lastCycleAt` are the global counter/timestamp fields. Pre-cutover code treated `totalCycles` as active/closing; the implemented canonical contract uses it as completed count.
- Active `Season` stores `phase`, `competitiveCyclesCompleted`, `preparationCyclesCompleted`, and `startedAt`. `Season.startedAt` is the durable Season_Rollover instant used for financial Cycle 1; the preparation-to-competitive transition advances phase/counters without rewriting it.
- `cycle_end_balance` audit payloads retain the closing `balance`; `CycleSnapshot.stableMetrics[].balance` is the corresponding snapshot check. Both share the canonical closing cycle in the Finance Center contract.
- Finance Center Overview, History, robot summary, and robot-detail reads each execute in a Prisma interactive transaction at PostgreSQL `REPEATABLE READ` with a 30-second timeout. The first transaction statement is `SELECT CURRENT_TIMESTAMP AS "asOf"`; PostgreSQL fixes that value at the transaction start, and every evidence query in the envelope observes the same repeatable-read snapshot.
- Financial battle identity supports both stable-only and recipient-robot forms. `buildBattleIncomeEventId` may include a recipient robot, while team/placement/stable awards need not. Bye identities use scheduled-match identity and stable. Streaming identities are robot-specific.
- Participant allocation is accepted only when the participants owned by the ledger stable sum exactly to that stable’s award. Opposing-stable participants are excluded from the conservation sum.
- Direct robot result is exactly validated battle/bye income plus robot-attributed streaming revenue minus linked actual repair spend. Stable-wide merchandising, operating costs, purchases, and synthetic allocation do not enter the default result.

### 3.3 Repair triple

One charged repair is one logical event:

```text
FinancialLedger repair_cost (signed movement, counted once)
  <-> AuditLog financial_transaction (same financialEventId)
  <-> AuditLog robot_repair (sourceEventId = financialEventId)
```

The report must verify equal user, robot, cycle/period and `creditsCharged === abs(ledger.amount)`, with `repairType` exactly `manual` or `automatic`. A mismatch produces `repair_link_mismatch`; it never creates a fallback line or a second contribution. An automatic repair around a bye remains an independent repair event and is not attributed to bye income.

## 4. Canonical cycle and cutover contract

### 4.1 Implemented canonical invariant

In the implemented Finance Center, `CycleMetadata.totalCycles` means completed financial cycles and the active cycle is `totalCycles + 1`.

Financial Cycle 1 starts at the retained Season_Rollover instant, remains active through both preparation days and the first competitive/match day, contains all preparation spending and achievement income, and closes only at the first competitive settlement. Preparation midnights advance preparation state without settlement, closure, or financial renumbering. Later cycles begin at their owning midnight UTC boundary.

Scheduled and admin settlement use the same Serialized_Cycle_Cutover:

1. Resolve and lock the active financial cycle.
2. Prevent a current-economy writer from committing to that cycle once closing balance capture starts.
3. Write paired `passive_income` and `operating_costs`, including zero values.
4. Write `cycle_end_balance`.
5. Write `cycle_complete`.
6. Write `CycleSnapshot` after `cycle_end_balance`, under the same cycle number.
7. Advance `CycleMetadata.totalCycles` last.
8. Release blocked writers; each re-resolves and writes to the new active cycle.

### 4.2 Cutover implementation and evidence record

| Item | Implemented mechanism | Release/verification disposition |
|---|---|---|
| Counter semantics | `CycleMetadata.totalCycles` is completed count; the resolver assigns `activeCycle = totalCycles + 1`. | The application behavior is implemented. No environment activation boundary or migration/release attestation is available. |
| Cycle 1 boundary | The active season's `Season.startedAt` is the retained Season_Rollover instant. Preparation transitions update phase/counters without rewriting it. | Covered by focused canonical-period tests; no deployed-environment boundary is asserted. |
| Writer exclusion | Namespace/key `(4, 1)` is reserved for finance cutover. Ordinary writers acquire `pg_advisory_xact_lock_shared(4, 1)` inside the same transaction that resolves and writes the financial cycle. A closer acquires exclusive `pg_advisory_xact_lock(4, 1)`, waits for in-flight shared holders, and records `finance_cycle_closing: true` plus `finance_cycle_closing_number` in `CycleMetadata.featureFlags`. | The lock and marker behavior are implemented and covered by focused unit/integration tests. |
| Blocked-writer retry | `runFinancialWriteTransaction` rolls back on `FinancialCycleCutoverInProgressError`, waits outside all transactions/locks, and retries the complete operation. The default policy is 61 attempts at 500 ms. Exhaustion returns controlled `FINANCIAL_CYCLE_CUTOVER_TIMEOUT` / HTTP 503. | Implemented; focused cutover coverage and the final full backend unit/integration gates passed as recorded in §10.3. |
| Closing order | Settlement writes its paired rows and closing evidence while the marker owns the closing number. `completeSerializedCycleCutover` takes the exclusive lock, validates the marker, advances `totalCycles` and `lastCycleAt` last, and removes both marker keys atomically. `abortSerializedCycleCutover` removes a matching marker without advancing the count. | Focused Finance/cutover coverage passed; no production execution attestation is available. |
| Scheduled/admin parity | Scheduled and administrative paths delegate to the same `beginSerializedCycleCutover`, `completeSerializedCycleCutover`, and `abortSerializedCycleCutover` entry points. | Implementation parity is recorded; release activation is not. |
| Historical records | Existing cycle numbers and null identities remain unchanged. | Forward-only behavior; no relabelling or backfill. |

The advisory namespace is intentionally distinct from audit-sequence and robot-lock namespaces. This is an application implementation record, not proof that any deployed process has activated these semantics.

## 5. Version 1 API contract

### 5.1 Endpoints

These implemented version-1 endpoints are:

```text
GET /api/finances/report
GET /api/finances/history
GET /api/finances/robots
GET /api/finances/robots/:robotId/events
```

Every route applies `authenticateToken`, then shared `validateRequest`. Stable identity comes only from the JWT. Robot detail verifies ownership inside the service/data boundary and returns generic `403 Access denied` for absent or non-owned IDs.

Every applicable route accepts either:

```text
?scope=current|last_completed|last_seven|season_to_date
```

or a complete ordered active-season range:

```text
?fromCycle=42&toCycle=48
```

The forms are mutually exclusive. Partial, reversed, out-of-season, unknown, or oversized ranges fail before expensive reads. Robot detail also accepts bounded `page` and `pageSize`.

### 5.2 Envelope

Every success returns a named `FinanceReportEnvelope<T>` with:

- literal `version: 1` (response-schema compatibility, not game season);
- normalized active-season period, inclusive cycle bounds, phase, current inclusion, UTC ISO `startsAt`/`endsAt`, one response-wide `asOf`, and finality;
- envelope source summary and truthful per-component provenance separating `actual`, `quoted`, and `modelled` evidence from `current_provisional` or `completed_historical` finality;
- typed reconciliation and limitations;
- concrete overview, history, robot summary, or paginated robot detail data.

The statement exposes `openingBalance`, `earnedCredits`, `investmentProceeds`, `runningCosts`, `investmentPurchases`, `netCashMovement`, and `closingBalance`. Earned Credits are only `battle_income`, `streaming_revenue`, `passive_income`, and `achievement_reward`. Positive `weapon_sale` is investment proceeds. Purchase/refinement/upgrade debits display as positive purchase totals backed by negative ledger amounts. Prestige never enters the arithmetic.

History includes a provisional active point for Current Cycle and Season to Date. Last Seven and custom ranges are completed-only. Revenue Growth compares earned Credits—not net movement—and is `current_partial_to_completed` and visibly provisional/asymmetric when anchored to Current Cycle; otherwise it is `completed_to_completed`.

Robot summary returns exactly five headline metrics: fought matches, battle/bye income, streaming revenue, actual repair spend, and direct net. Detail is ordered `occurredAt DESC, sourceReference ASC` and returns page/page size, total items/pages, next state, optional page subtotal, and unchanged full-period total. One page is a transport slice and need not equal the headline; all pages combined must reconcile without duplication or omission.

### 5.3 Reconciliation

Overview, History, robot summary, and robot-detail services each open a Prisma interactive transaction with `isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead` and `timeout: 30_000`. Their first transaction query is `SELECT CURRENT_TIMESTAMP AS "asOf"`. Under PostgreSQL transaction semantics this is the database transaction-start timestamp; the transaction's repeatable-read snapshot then anchors every ledger, paired/domain audit, boundary, snapshot, allocation, and current-`currency` read used by that envelope. The `asOf` returned in period and provenance metadata is therefore the cutoff of the same view whose evidence is reported, not an application-clock sample taken before or after the queries.

Within that Consistent_AsOf_View:

1. Select only complete identified ledger/audit pairs.
2. Order by `(cycleNumber, sequenceNumber)`.
3. Derive opening from the first `balanceAfter - amount`.
4. Sum each ledger amount exactly once.
5. Derive closing from the final `balanceAfter`.
6. Prove both equations:

```text
opening + signed movement = closing
opening + earned Credits + investment proceeds - running costs - investment purchases = closing
```

7. For every completed cycle in the selection, compare that cycle’s closing with its own `cycle_end_balance` and snapshot balance. An interior mismatch limits the aggregate even when range arithmetic balances.
8. Use `User.currency` only to confirm Current Cycle at the same cutoff.

### 5.4 Player-safe references

Raw `financialEventId`, audit IDs/payloads, security payloads, tokens, unnecessary internal IDs, and cross-user data must not enter responses, caches, or diagnostics. A Player_Safe_Source_Reference is generated at the report boundary and must be stable across refreshes/pages, collision-free within authenticated stable and active season, non-reversible, and display/log safe. It is never authorization.

The implementation uses HMAC-SHA-256 over the UTF-8 byte sequence `finance-report-v1`, NUL, authenticated stable id, NUL, season number, NUL and raw source identity. It base64url-encodes the digest, retains 22 characters and prefixes it with `FIN-`. The single active key is the independent `FINANCE_REPORT_REFERENCE_SECRET`; production configuration and the generator both fail closed when it is absent, while non-production uses the explicit development-only fallback `development-finance-reference-secret`. The key is never stored or returned, and there is no persisted key id or dual-key grace period. `20260910123000_finance_report_source_reference` enables PostgreSQL `pgcrypto` and provides the matching parameterized SQL function used only to sort bounded robot-detail pages. The database receives the independent report key as a bound query parameter and does not persist it. Rotation immediately changes future display references, so references are presentation values rather than durable authorization or lookup keys and callers must not expect continuity across rotation. The integration regression checks Node and PostgreSQL parity, including a non-ASCII identity.

## 6. Period, forecast, and read-only presentation rules

- Current Cycle and Season to Date are provisional through `asOf`; completed cycles are historical unless an administrative correction is explicitly reported.
- Browser-local formatting applies only to absolute server ISO timestamps. UTC remains the report-boundary authority; UI copy does not say “Your local time.”
- Full Damage Repair Reference models every active robot at full repairable damage through shared repair functions, with automatic/manual totals, saving, robot count, and Repair Bay context. It is quoted current context, not a charge, current-damage quote, recommendation, or statement line.
- Prestige Milestone Forecast samples the latest up to seven completed active-season cycles, sums only positive stored `prestige_change` awards, computes average per completed cycle, and uses `ceil(remaining / average)`. It has explicit no-history, no-positive-pace, and no-next-gate states. It predicts neither date, wins, revenue, nor a purchase decision.
- Finance Center is read-only. The sole Robot Deployment navigation action is “Manage subscriptions” to Booking Office. It exposes no repair, facility, team, eligibility, or generic mutation controls.

## 7. Known limitations and fail-closed behavior

1. Null-identity ledger/audit rows predate paired capture. They remain legacy evidence and cannot support a reconciled line.
2. Manual repair audit amounts written before Spec #48 may be understated; credits deducted were correct, but mutable historical inputs prevent a trustworthy backfill.
3. Missing financial pairs, boundaries, snapshot agreement, repair links, battle-allocation conservation, or canonical cycle identity produce typed non-monetary limitations. Unsupported amounts are excluded, not estimated.
4. Live reports are active-season only. Season rollover purges live ledger, audit, snapshot, battle, and analytics evidence; cross-season history is read only from archives and is outside the live Finance Statement.
5. Current Cycle and Season to Date can change after refresh. Current-vs-completed Revenue Growth compares a partial interval to a complete one.
6. Full Damage Repair Reference is theoretical and cannot be interpreted as spend, current damage, or required action.
7. Prestige forecast is a historical pace estimate, not a calendar promise or decision recommendation.
8. Direct robot results intentionally exclude stable-wide merchandising, facility costs, and investments. No synthetic apportionment is allowed.
9. A loaded event page is only a slice; its subtotal is not expected to equal the full-period headline.
10. Administrative corrections after closure require an explicit limitation/provenance update; current mutable state may not replace historical evidence.
11. Release and verification evidence is recorded separately from application implementation. The absence of a recorded blocking run neither changes implemented Finance Center behavior nor proves an unrun test passed.
12. Legacy compatibility routes may remain, but Finance Center uses version-1 evidence envelopes rather than presenting legacy views as reconciled Finance Center output.

The closed limitation codes are `missing_financial_pair`, `missing_period_boundary`, `snapshot_balance_disagreement`, `cycle_end_balance_disagreement`, `administrative_anomaly`, `legacy_evidence`, `cycle_identity_mismatch`, `repair_link_mismatch`, and `battle_allocation_mismatch`.

## 8. Caching, performance, and observability

### 8.1 Implemented cache boundary and refresh lifecycle

Finance Center uses one process-local `KeyedCache` in `routes/finances.ts`, configured with a 15,000 ms TTL and maximum 500 entries. Keys include authenticated user, active season number, canonical active cycle, resource, normalized selection, and—for robot detail—robot, page, page size, and fixed order. Only the sanitized response envelope is stored. Expired entries are removed lazily on read and when capacity is reached; if expiry cleanup leaves the cache full, insertion evicts the oldest map entry. The cache has no cross-process coherence and Finance Center registers no mutation-driven invalidation.

Ordinary responses, including cache hits, send `Cache-Control: private, max-age=15`. A validated `scope=current` request carrying `Cache-Control: no-cache` bypasses the cache read, loads a fresh Consistent_AsOf_View, and replaces the same key. The bypass is accepted only after authentication and schema validation and is bounded per authenticated user to 30 requests per 60 seconds with security-monitor reporting. Historical presets and custom ranges ignore the bypass directive. Tests cover ordinary cache reuse, current refresh replacement, and user/season/cycle/resource/selection/detail isolation.

### 8.2 Performance budgets

| Request | p95 target |
|---|---:|
| Overview | ≤700 ms |
| Robot summary | ≤1,000 ms |
| One robot detail page | ≤300 ms |

The blocking fixture is `app/backend/tests/financeCenterPerformance.integration.test.ts`, classified in the heavy tier. It builds two otherwise equivalent stables over the maximum 100-cycle custom range: one owns one robot and one owns the supported maximum of 11. Each stable has 300 valid paired Financial_Record rows—100 conserved stable-level battle awards backed by `BattleParticipant`, 100 robot-attributed streaming rows, and 100 exactly linked repair rows—all assigned to one target robot. Robot detail requests the maximum 100-row page. Fixture setup, connection warm-up, and cleanup are excluded from measurements; each resource is called directly with the route cache bypassed, and JSON serialization is included in duration and byte counts.

Every driver statement is observed without parameter values. The fixture compares the one-robot and 11-robot statement profiles exactly, then applies fixed ceilings to total statements, finance/audit statements (`financial_ledger` or `audit_logs`), and battle-allocation statements (`battle_participants` or `battles`). This proves roster growth adds no finance, battle, or repair query. The fixed release ceilings are:

| Request | p95 target | Response ceiling | Statement ceiling (`total` / finance-audit / battle) |
|---|---:|---:|---:|
| Overview | ≤700 ms | ≤512 KiB | 32 / 15 / 0 |
| Robot summary | ≤1,000 ms | ≤64 KiB | 20 / 8 / 2 |
| One robot detail page | ≤300 ms | ≤128 KiB | 18 / 6 / 4 |

Latency uses 20 sequential post-warm-up samples and the nearest-rank calculation `sorted[Math.ceil(0.95 × n) - 1]`. Cache state is `bypassed_direct_service_calls`, so the measurements exercise the read models rather than a warm response cache. On 10 September 2026 with Node.js v24.15.0 and PostgreSQL 17.10, the focused heavy test recorded:

| Request | Observed statements (`total` / finance-audit / battle) | Response bytes | p95 | Maximum sample |
|---|---:|---:|---:|---:|
| Overview | 28 / 13 / 0 | 92,038 | 20.59 ms | 21.58 ms |
| Robot summary | 16 / 6 / 1 | 4,549 | 12.85 ms | 13.15 ms |
| One robot detail page | 16 / 4 / 2 | 32,802 | 53.36 ms | 54.24 ms |

The one-robot and 11-robot profiles were identical for every resource. The detail response contained exactly 100 of 300 events, while its full-period total and the summary headline both remained 11,500 Credits. All p95, response-size, absolute-statement, repeated-sample stability, roster-growth, pagination, and headline-invariance assertions passed.

Robot event detail uses one set-based metrics/count query and one independently set-based `LIMIT`/`OFFSET` page query inside the report transaction; its battle allocation, streaming and repair evidence are joined in those queries, so no finance/battle/repair query runs per page event or per robot. Full-period headlines come from the metrics query and the page subtotal from at most the bounded page size. The opaque SQL sort key is the same Player_Safe_Source_Reference returned to the player, with `occurredAt DESC` then C-collated reference ordering. Unit, PostgreSQL integration, and the heavy performance fixture verify the fixed query shape, page composition, conservation, repair exclusion, and maximum-shape budgets.

Diagnostics may include route/resource, duration, query count, response bytes, cache result, normalized scope, and limitation codes. They must exclude tokens, player IDs, raw source identities, SQL parameter values, and payloads.

## 9. Test disposition and required replacement coverage

### Named Task 1.5 test-file disposition record

The following named file dispositions satisfy Task 1.5’s documentation requirement. They are not retirement approvals: a named legacy assertion or test may be retired only after its specified replacement coverage has passed. Replacement coverage may be implemented, but this record does not claim any unrun test passed.

| Existing test | Type | Disposition |
|---|---|---|
| `app/backend/tests/finances.test.ts` | Integration | Adapt for authenticated version-1 endpoints, period/range/version/provenance/itemisation/early-state/security; retire only legacy endpoint assertions. |
| `app/backend/tests/financesRouteValidation.test.ts` | Unit | Adapt/partly retire duplicated ROI schema checks; add shared period/page schema tests. |
| `app/backend/tests/financialReportStreamingRevenue.test.ts` | Integration | Replace rolling `BattleParticipant` report aggregation with complete paired robot-attributed record coverage, then retire legacy assertions. |
| `app/backend/tests/services/streamingRevenueParity.test.ts` | Unit/property/static | Retain formula/property coverage; adapt only legacy presentation-path checks. |
| `app/backend/tests/cycleSummaryStreamingRevenue.property.test.ts` | Integration/property | Retain unchanged; it covers battle execution summary streaming, not the Finance Center page. |
| `app/backend/tests/coverageManifest.test.ts` and `tests/factories/coverageManifest.ts` | Static/unit | Adapt stale Income/Cycle Summary surface expectations after replacement coverage. |
| `app/backend/tests/analyticsApi.test.ts` | Integration | Repurpose/retire only after the stable-summary endpoint is decommissioned. Preserve unrelated analytics coverage. |
| `app/backend/src/services/financial/__tests__/financialService.test.ts` | Unit | Adapt/retire grouped-ledger route behavior after sequence/pair/reconciliation replacements. |
| `app/frontend/tests/e2e/financial-flow.spec.ts` | Playwright | Retain unrelated facility/attribute mutation flows; replace legacy Income assertions. |

Replacement coverage is mandatory across:

- unit/property: canonical cycle identity, both reconciliation equations, per-cycle sequence restarts, sale polarity, facility itemisation, repair single contribution, allocation conservation, direct-net identity, pagination invariance, forecasts, and source-reference properties;
- PostgreSQL integration: preparation Cycle 1, scheduled/admin cutover races and blocked-writer reassignment, consistent read cutoff, zero settlement rows, boundaries/snapshots, API auth/validation/ownership, cache isolation, repair and battle joins, stable ordering, and payload safety;
- frontend component: version/provenance, period controls, provisional labels, independent errors, itemised statements, public references, local time/DST, five robot metrics, pagination notices, keyboard and responsive states;
- Playwright: redirects, one player navigation entry, lazy panels, current-inclusive history, 44px controls, keyboard tabs/pagination, readable itemisation, and no horizontal overflow at 320, 375, 768, 1023, 1024, and 1920px;
- performance fixture: p95, query-growth, and payload ceilings with no per-robot query growth.

The release gate consists of backend lint/build/test typecheck/tier verification/unit/integration/heavy, frontend lint/build/unit, and E2E. The dated observed snapshot and its final results are recorded in §10.3; future release decisions must use a fresh run rather than treating that local snapshot as permanently green or red.

## 10. Migration and rollback record

### 10.1 Existing identity migration

`20260904120000_financial_event_identity` added nullable `financial_event_id` to `financial_ledger` and nullable `financial_event_id`/`source_event_id` to `audit_logs`, then added uniqueness and lookup indexes. Nullability is deliberate and forward-only: existing rows were not backfilled, paired, reclassified, or rewritten.

Finance Center adds read models, not duplicate report tables. `20260910123000_finance_report_source_reference` adds PostgreSQL `pgcrypto` plus `finance_report_source_reference(...)`, a stateless HMAC/base64url formatter used to preserve opaque source-reference ordering in the database-bounded robot event page. `20260910130000_finance_report_breakdown_validation` adds the matching fail-closed PostgreSQL `finance_report_breakdown_is_valid(...)` predicate, so detail pagination excludes malformed nested financial evidence on the same stored-fact boundary as the canonical report reader. Neither migration stores a secret, identity projection or new financial state. The obsolete PRD proposals for `DailyFinancialSnapshot`, `SpendingTransaction`, and `RobotFinancialPerformance` are not part of Spec #54.

### 10.2 Application cutover implementation record

The implemented application scope is retained here as an audit sequence; the wording does not assert that its associated tests or benchmarks have passed:

1. Canonical cycle resolution and serialized scheduled/admin closure are implemented.
2. Current financial writers resolve the canonical active cycle.
3. Version-1 read models, security boundaries, player-safe references, cache behavior, and performance instrumentation are implemented.
4. Finance Center UI and independent-panel behavior are implemented.
5. `/income` serves Finance Center; `/finances` remains a redirect; `/cycle-summary` redirects to History; player navigation is consolidated.
6. Finance Center clients use the version-1 report APIs rather than legacy report APIs.
7. Legacy components and assertions remain subject to the replacement-gated retirement record in §9.
8. Exact locking, read-view, reference-key, cache/refresh, benchmark, and observed verification details are recorded in §§4.2, 5.3, 5.4, 8, and 10.3. Release identifier and environment activation remain explicitly unavailable.

Rollback may restore legacy routes/UI, but must not reverse or reinterpret identified financial evidence, backfill legacy rows, or restore competing current-economy writers. If canonical cycle semantics have activated, rollback must preserve the new counter meaning or ship an explicit data-safe migration; a UI rollback alone cannot revert cycle identity.

### 10.3 Implementation, release, and verification evidence

All observations below were made locally on 10 September 2026 from a worktree based on Git commit `5379276c`. That identifier scopes the local observation only; it is not a release identifier or proof of deployment.

| Evidence category / command | Observed result | Disposition |
|---|---|---|
| Application cutover | Version-1 routes/read models/UI and canonical writer/cutover behavior are present in the repository. | **Implemented application behavior; not an environment attestation.** |
| Release identifier / environment / activation time | No deployment record, release identifier, environment attestation, or activation time was available. | **Not released/activated by this record; no inference permitted.** |
| Canonical counter activation boundary | No migration/deployment boundary proving when an environment changed `totalCycles` semantics was available. | **Not recorded.** |
| Serialized cutover mechanism | Shared advisory writer lock/exclusive closer lock `(4, 1)`, durable closing marker, 61 × 500 ms retry policy, controlled HTTP 503 exhaustion, and shared begin/complete/abort paths; see §4.2. | **Implementation recorded.** |
| Consistent read mechanism | Prisma `RepeatableRead`, 30-second timeout, first query `SELECT CURRENT_TIMESTAMP AS "asOf"`; see §5.3. | **Implementation recorded.** |
| Player-safe reference lifecycle | HMAC-SHA-256 with independent production-required secret, development fallback, bound SQL key, no persistence, and rotation-changing presentation references; see §5.4. | **Implementation recorded.** |
| Cache / refresh lifecycle | Process-local 15-second, 500-entry `KeyedCache`; lazy expiry/oldest eviction; no mutation invalidation; current-only authenticated no-cache replacement at 30 requests/60 seconds; see §8.1. | **Implementation recorded.** |
| Backend `pnpm run lint` | Passed. | Green static gate. |
| Backend `pnpm run build` | Passed. | Green static gate. |
| Backend `pnpm run typecheck:tests` | Passed. | Green static gate. |
| Backend `pnpm run test:tiers:verify` | Passed: 288 unit, 113 integration, 24 heavy, 425 total; every test file belonged to exactly one tier. | Green partition gate. |
| Frontend `pnpm run lint` | Passed. | Green static gate. |
| Frontend `pnpm run build` | Passed; Vite emitted non-blocking chunk-size warnings. | Green static gate. |
| Backend `pnpm run test:unit -- financeReport` | Passed: 5 suites, 28 tests. | Focused Finance coverage green. |
| Backend `pnpm run test:integration -- finances` | Passed: 1 suite, 17 tests. | Focused Finance API/integration coverage green. |
| Frontend `pnpm exec vitest run src/pages/__tests__/FinanceCenterPage.test.tsx src/components/finance/__tests__` | Passed: 6 files, 40 tests. The plan's `pnpm test -- --run ...` wrapper was not accepted by the process runner, so the direct one-shot Vitest equivalent was used. | Focused Finance component coverage green. |
| Backend `pnpm run test:unit -- tests/guide/content-validation.test.ts` | Passed: 221 tests. | Player-guide/content validation green. |
| Frontend `pnpm exec vitest run src/components/nav/__tests__/financeNavigation.test.tsx` | Passed: 3 tests. | Navigation migration coverage green. |
| Focused `pnpm exec playwright test tests/e2e/finance-center.spec.ts` | Passed in the prepared environment: 6/6. | Focused Finance E2E green. |
| Frontend `pnpm run test:ci` | Passed: 202 files; 1,999 tests passed and 3 skipped. | Full frontend unit gate green. |
| Backend blocker regressions | Passed: seven corrected unit suites / 111 tests; duplicate-email and duplicate-username integration suites / 2 tests; limiter/environment suites / 28 tests. | Root-cause regressions green without weakening production cycle locking, HTTPS handling, or rate limits. |
| Frontend blocker regressions | Passed: FrontPage onboarding 1 file / 4 tests; affected facility/onboarding/tuning/weapon-shop Playwright run 32/32. | Product routing and E2E environment corrections green. |
| Backend `pnpm run test:unit` | Passed: 287 suites passed and 1 skipped; 3,983 tests passed and 1 skipped. | Green full unit gate. |
| Backend `pnpm run test:integration` | Passed: 113 suites and 1,474 tests. | Green full integration gate. |
| Backend `pnpm run test:heavy` | Passed: 24 suites, 245 tests. | Full heavy gate green. |
| Full `pnpm exec playwright test` | After the documented idempotent reseed and backend startup with the E2E-only `USER_ECONOMIC_RATE_LIMIT_MAX=5000` override, passed: 89 tests passed, 5 skipped, 0 failed across 94 tests. | Green full E2E gate. |
| Query/payload ceilings and measured p95 | Focused heavy fixture passed with the 100-cycle/300-record/1-vs-11-robot/100-row shape and the measurements in §8.2. | Focused performance evidence green; full heavy gate also green. |
| Legacy API/component retirement | Remains replacement-gated under §9. | No unsupported retirement approval. |

E2E prerequisite chronology is part of the evidence rather than hidden: integration tests remove or mutate E2E fixtures, so the final full run used the documented idempotent `pnpm exec prisma db seed` before starting the backend. The backend used `USER_ECONOMIC_RATE_LIMIT_MAX=5000` only for E2E, preserving the validated production default of 100 requests per minute. The prepared full run then passed 89 tests with 5 skips and no failures. Earlier failed attempts and their root causes remain represented by the focused blocker regressions above rather than being treated as successful runs.

**Release conclusion:** all local blocking release-verification gates are green: backend lint/build/test typecheck/tier verification/unit/integration/heavy, frontend lint/build/unit, and full E2E. This is repository verification, not deployment evidence: no release identifier, environment activation, or canonical-counter activation boundary is attested here. Spec #54 is complete and may be moved from `to-do` to the September 2026 done directory.

## 11. Task 8.10 steering review record

All four required steering files were reviewed for durable conventions. The two files checked but unchanged are explicitly recorded below; Finance Center-specific values remain in this contract and its PRD.

| Steering file | Disposition | Reason |
|---|---|---|
| `.kiro/steering/project-overview.md` | **Updated** | Added the durable Finance Center reporting/cycle/source boundary and removed the statement that the financial page is merely a deferred follow-on. |
| `.kiro/steering/testing-strategy.md` | **Updated** | Replaced the Spec #53 capture-only no-UI boundary with durable Finance Center tier and replacement-test rules. |
| `.kiro/steering/frontend-standards.md` | **Checked; unchanged** | Existing typed API, extracted hook/component, responsive tab/stack, accessibility, pure derivation, and component-test conventions already cover the reusable frontend patterns. Finance Center-specific provenance, periods, five metrics, and pagination wording belong in its PRD/contract. |
| `.kiro/steering/performance-guidelines.md` | **Checked; unchanged** | Existing measure-first, no-N+1, pagination, field selection, TTL cache, rate-limit, lazy-load, and performance-measurement rules are sufficient. Finance Center’s p95/cache-key/fixture budgets are feature-specific and remain here and in blocking tests. |

## 12. References

- [Finance Center page PRD](../prd_pages/PRD_INCOME_DASHBOARD.md)
- [Financial Ledger and Audit Guide](../guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md)
- [Credits & Income player guide](../../app/backend/src/content/guide/economy/credits-and-income.md)
- [Prestige and Fame PRD](../game-systems/PRD_PRESTIGE_AND_FAME.md)
- [Economy System PRD](../game-systems/PRD_ECONOMY_SYSTEM.md)
- [Cycle System PRD](../game-systems/PRD_CYCLE_SYSTEM.md)
- [Season System PRD](../game-systems/PRD_SEASON_SYSTEM.md)
- [Audit System PRD](../architecture/PRD_AUDIT_SYSTEM.md)
- [Battle Data Architecture](../architecture/PRD_BATTLE_DATA_ARCHITECTURE.md)
- [`app/shared/utils/repairCost.ts`](../../app/shared/utils/repairCost.ts)
- [Spec #54 requirements](../../.kiro/specs/done-september26/54-finance-center/requirements.md), [design](../../.kiro/specs/done-september26/54-finance-center/design.md), and [tasks](../../.kiro/specs/done-september26/54-finance-center/tasks.md)
