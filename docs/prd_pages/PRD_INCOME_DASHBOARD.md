# Product Requirements Document: Finance Center

**Route:** `/income`
**Spec:** #54
**Version:** 2.0
**Status:** Implemented application contract; release and blocking-verification evidence recorded separately
**Supersedes:** Legacy Income Dashboard / Daily Stable Report and player Cycle Summary specifications

## 1. Purpose

Finance Center is the single player-facing explanation of how a stable’s Credits changed during a selected active-season financial period. It replaces the financial responsibilities of the legacy Income Dashboard and Cycle Summary with reconciled, itemised evidence; direct robot deployment results; and clearly separated quoted or modelled context.

This PRD documents the implemented Spec #54 application contract. It does not substitute for release-environment or test-run evidence: current implementation, release evidence, and blocking-verification results are separately recorded in the [Finance Center Reporting Contract](../implementation_notes/finance-center-reporting-contract.md).

The report names its core read-only concepts as Revenue_Growth, Full_Damage_Repair_Reference, Prestige_Milestone_Forecast, and Robot_Deployment_View; the player-facing headings below use natural-language spacing for those same concepts.

## 2. Product principles

1. **Evidence before estimate.** Actual money comes only from complete identified financial records. Missing evidence is named, never reconstructed from current state.
2. **One period, one cutoff.** Every response normalizes one active-season period and assembles its comparisons from one server-consistent `asOf` view.
3. **One movement, one contribution.** Ledger/audit pairs prove one mutation; linked repair audit data adds subtype and display context, not a second amount.
4. **Read-only reporting.** Finance Center explains results. It does not repair robots, buy facilities, change teams, or mutate finances.
5. **Progressive and bounded.** Overview loads first. History and Robot Deployment load independently. Detail is paginated and set-based.
6. **Honest context.** Current periods are provisional; theoretical repair and prestige forecasts are labelled as quoted/modelled rather than actual cash.

## 3. Routes and migration

- Serve protected Finance Center at `/income`.
- Keep `/finances` as a compatibility redirect to `/income`.
- Redirect `/cycle-summary` to `/income?tab=history`; translate valid legacy `lastNCycles` values to the nearest supported period and otherwise use the History default.
- Provide exactly one player navigation entry named **Finance Center** at `/income`.
- Keep `/admin/economy` separate.
- Dashboard Credits continues to link to `/income` with “Open Finance Center” wording. Dashboard Prestige links to the relevant Finance Center context without changing Dashboard UTC/current-cycle behavior.
- Legacy report calls and components are retired only after replacement and redirect coverage passes. Redirects remain.

## 4. Canonical financial periods

### 4.1 Supported selections

| Selection | Content | Finality |
|---|---|---|
| Current Cycle | Active cycle through server `asOf` | Provisional |
| Last Completed Cycle | Most recent closed cycle | Historical |
| Last Seven Completed Cycles | Up to seven closed cycles | Historical |
| Custom completed range | Inclusive ordered active-season completed cycles | Historical |
| Season to Date | All active-season completed cycles plus Current Cycle through `asOf` | Provisional |

A custom range is applied only after both cycle bounds are present, ordered, completed, and inside the active season. Presets/ranges and active tab are URL-backed. Refresh appears only for Current Cycle and preserves tab and selection. Stale responses from an earlier period request are discarded.

### 4.2 Cycle identity

`CycleMetadata.totalCycles` is the completed financial-cycle count; active financial cycle is `totalCycles + 1`.

Financial Cycle 1 begins at Season Rollover, spans both preparation days and the first competitive/match day, and closes at the first competitive settlement. Every preparation purchase, upgrade, repair, and achievement Credit reward belongs to Cycle 1. Preparation midnights advance preparation state without settling, closing, or renumbering the financial cycle. During preparation, player labels say **Cycle 1 · Preparation · Provisional**. Later cycles start at their owning midnight UTC boundary.

Scheduled and admin settlement use identical serialized closure ordering: settle both components (including zero rows), write `cycle_end_balance`, write `cycle_complete`, write the snapshot after end balance, then advance completed count. Once balance capture starts, no writer may commit to the closing cycle; a blocked writer resumes after advancement and resolves the new active cycle.

### 4.3 Time display

The backend returns absolute UTC ISO timestamps and retains UTC as cycle authority. The client formats instants in the browser’s locale/timezone, including daylight-saving offsets. It does not display “Your local time” or repeatedly restate a fixed cycle-start hour.

## 5. Evidence and reconciliation

### 5.1 Actual financial records

Actual signed movement reads only complete `FinancialLedger` and `AuditLog` `financial_transaction` pairs joined by a non-null `financialEventId`. The ledger amount is counted once; its paired audit provides `(cycleNumber, sequenceNumber)` ordering. Sequence numbering restarts each cycle, so a range always sorts by both fields.

Opening balance is the first ordered `balanceAfter - amount`. Closing balance is the final ordered `balanceAfter`. The report proves:

```text
opening + signed movement = closing
opening + earned Credits + investment proceeds - running costs - investment purchases = closing
```

Each completed cycle is also checked against its own `cycle_end_balance` and `CycleSnapshot` closing balance. Those records are checks, not statement lines. `User.currency` confirms only Current Cycle at the same `asOf`; it never supplies a historical boundary.

### 5.2 Statement categories

The Finance Statement exposes:

- opening balance;
- earned Credits;
- investment proceeds;
- running costs;
- investment purchases;
- net cash movement; and
- closing/current balance.

**Earned Credits:** battle/bye income, streaming revenue, passive merchandising income, and achievement Credit rewards.

**Investment proceeds:** positive weapon-sale proceeds. A sale is neither earned revenue nor a purchase debit.

**Running costs:** actual manual repairs, actual automatic repairs, and each stored facility operating-cost component.

**Investment purchases:** each robot creation, facility upgrade, weapon purchase, **Weapon Refinement**, and attribute upgrade.

Prestige is not Credits and never enters statement arithmetic, ROI, balance, net movement, or Revenue Growth.

### 5.3 Limitations

Rows without financial identity remain legacy evidence. A missing pair/boundary, snapshot disagreement, administrative anomaly, cycle identity disagreement, repair-link mismatch, or battle-allocation mismatch produces a typed non-monetary limitation. A limitation does not create a line, total, trend, or robot amount. The UI shows what is affected and never fills the gap using timestamps, snapshots, cached quotes, current facilities, current prestige, or current formulas.

## 6. Repair presentation

### 6.1 Actual repair spend

One charged repair consists of one signed `repair_cost` ledger row, its paired financial audit, and one `robot_repair` audit whose `sourceEventId` equals the financial identity. Reconciliation counts the ledger once. The linked domain audit supplies positive `creditsCharged`, manual/automatic subtype, count, and robot context after exact user/robot/period/amount validation.

`robots.repairQuoteCredits`, battle payloads, and subtype-losing aggregates are not spend sources. An automatic repair near a bye is an independent repair event; it is not part of bye income.

Historical manual-repair audit rows written before Spec #48 may understate display spend and are not backfilled. Affected history is limited rather than recalculated from mutable past facilities or roster state.

### 6.2 Full Damage Repair Reference

Overview always provides a theoretical full-damage scenario for every active robot:

- automatic total and robot count;
- manual total, robot count, and saving;
- current Repair Bay discount context; and
- a zero-active-roster state.

It uses only shared functions in `app/shared/utils/repairCost.ts`, applies discounts once, and rounds per robot before summing. It is explicitly a scenario—not a charge, current-damage quote, recommendation, or signal that repairs are needed. It has no repair or facility action.

## 7. Overview

Overview is the only initial request. It uses project tile/card conventions and contains:

1. selected-period balance, net cash movement, operating result, and investment purchases;
2. expandable Finance Statement with separate proceeds and purchases headings;
3. Revenue Growth;
4. Prestige Milestone Forecast;
5. Full Damage Repair Reference; and
6. Prestige Earning Power.

Totals are not repeated in unrelated cards. A valid early-season state explains missing history, events, robots, or next prestige gate instead of showing invented zeros or recommendations.

### 7.1 Revenue Growth

Revenue Growth is the absolute and percentage change in actual **earned Credits**, not net cash movement. It excludes weapon-sale proceeds and all purchases.

- If the selected period’s latest cycle is Current Cycle, compare partial earned Credits through `asOf` with the immediately preceding completed cycle. Label this **Provisional: partial current cycle compared with a complete prior cycle**.
- Otherwise compare adjacent completed cycles.
- If no prior cycle or valid denominator exists, show a named unavailable state rather than a misleading percentage.

### 7.2 Prestige Earning Power and forecast

Prestige Earning Power shows current prestige, evidenced period gain, next facility gate, battle Credit multiplier, and merchandising effect. The battle multiplier is `min(1.50, 1 + prestige / 50,000)` and multiplies base battle Credits. Merchandising uses prestige per roster capacity, where capacity is `roster_expansion` level + 1.

Prestige Milestone Forecast uses only positive stored prestige awards from the latest up to seven completed active-season cycles. It displays sample size, awarded total, average pace, remaining prestige, and `ceil(remaining / average)` estimated completed cycles. Current-cycle awards are excluded. The panel is a historical estimate and never provides a date, guaranteed battle result, revenue promise, or purchase advice.

## 8. History

History supports every period selection. Current Cycle renders one provisional point and statement through `asOf`; Season to Date renders completed points plus that active point and marks the whole selection provisional. Last Seven and custom ranges contain completed cycles only.

The primary chart is a labelled SVG with cycle/value labels, semantic 44px keyboard-selectable points, visible focus, and a complete accessible table equivalent. Colour reinforces but never carries meaning alone. Selecting a point updates:

- that cycle’s complete or limited Finance Statement;
- its Revenue Growth comparison; and
- a “What changed?” list.

Recorded drivers may include category deltas, stored facility upgrades, standing-tier changes, battle activity, and separate manual/automatic repairs. Copy distinguishes evidence/correlation from causation; it does not claim an upgrade caused a movement without a proven model.

Zero-activity completed cycles remain explicit through zero-valued settlement pairs and retain statement/provenance display.

## 9. Robot Deployment

Robot Deployment is lazy, read-only, and shows actual directly attributable results rather than profitability ranking or synthetic facility allocation.

Each robot has exactly five vertically aligned headline metrics:

1. fought matches;
2. battle/bye income;
3. streaming revenue;
4. actual repair spend; and
5. direct net (`battle/bye income + streaming revenue - repair spend`).

`BattleParticipant.credits` is persisted allocation evidence. Because team, tag-team, placement, and bye awards may be stable-level ledger records, the read model joins participants to the related complete stable `battle_income` record, restricts participants to robots owned by that stable, and verifies the owner-scoped allocation sum equals the stable award. It does not require a ledger `robotId`, divide an award, include an opponent’s robots, or call persisted allocations modelled stable-wide allocation. Failed conservation excludes the unsupported robot amount and shows a limitation.

Byes may pay battle/bye income and appear in detail, but do not increment fought matches. Streaming and repair evidence remain robot-attributed.

### 9.1 Detail and exposure

Expandable robot detail uses one hierarchy for:

- individual battle, bye, streaming, and repair events;
- manual/automatic repair amount and count;
- opaque player-safe source references and provenance;
- subscriptions and held obligations;
- absolute scheduled instants formatted in browser local time;
- tier and team membership/role.

The only navigation action is **Manage subscriptions** to Booking Office. There are no repair, facility, team-management, eligibility, or mutation controls.

### 9.2 Pagination

Full-period robot totals are computed independently of pages. Event detail uses deterministic newest-first order with a player-safe-reference tie-breaker and bounded page size. It displays page/page size, total items/pages, next state, optional page subtotal, and unchanged full-period total.

Player notice: **This page shows part of the selected period. Its subtotal may differ from the full-period total; all pages together make up the itemised detail.** Page changes never alter or recompute headline totals.

## 10. Version 1 API

| Endpoint | Data |
|---|---|
| `GET /api/finances/report` | Overview statement, growth, repair reference, prestige context/forecast |
| `GET /api/finances/history` | Period points, selected statement, growth, recorded drivers |
| `GET /api/finances/robots` | Five-metric full-period summaries and limitations |
| `GET /api/finances/robots/:robotId/events` | Ownership-checked, paginated event/exposure detail |

Every success is `FinanceReportEnvelope<T>` with literal `version: 1`, normalized period, one response-wide `asOf`, provenance summary and per-component provenance, reconciliation/limitations, and typed data. Version 1 is response-schema compatibility, not season number.

Every route applies authentication before strict shared validation. Stable identity comes only from JWT. A missing/non-owned robot returns generic `403 Access denied`. Responses exclude raw financial identities, audit IDs/payloads, security payloads, tokens, and unnecessary internal IDs.

Player-safe source references are opaque, stable across refreshes/pages, collision-free within authenticated stable and active season, non-reversible, display/log safe, and never authorization credentials. The implemented generation and key-lifecycle mechanism must be recorded in the [reporting contract](../implementation_notes/finance-center-reporting-contract.md) before release.

## 11. Loading, errors, and accessibility

- Overview, History, Robot Deployment, and robot detail each own loading/error/retry state. Failure in a lazy panel never hides successful Overview content.
- Desktop tabs implement `tablist`/`tab`/`tabpanel`, roving focus, Arrow Left/Right, Home/End, selection preservation, and visible focus.
- Invalid custom fields use `aria-invalid` and `aria-describedby`; submission focuses the first invalid field and sends no request.
- Disclosures, chart points, tabs, and pagination controls are semantic and keyboard operable, with at least 44px by 44px activation regions where both dimensions apply.
- No explanation is hover-only. Tables have readable card/disclosure alternatives. Status is not conveyed by colour alone.

### Responsive behavior

- **320–1023px:** sections stack; statements, history rows, and event rows become labelled cards/disclosures; all five robot values remain visible; only an intentional tab strip may scroll internally; no page-level horizontal overflow.
- **≥1024px:** use the project responsive desktop tab pattern and multi-column card layout where it improves scanning.
- Required viewport checks: 320, 375, 768, 1023, 1024, and 1920px.

## 12. Security, caching, and performance

Cache isolation key dimensions are authenticated stable, active season, exact normalized period, resource, and page/page size/order where applicable. Only sanitized envelopes may be cached. Completed periods may be immutable; current-inclusive periods use a short TTL and retain their original `asOf`. Exact TTL, invalidation, and storage are implementation evidence, not values invented by this PRD.

Server p95 budgets at the deterministic maximum-roster fixture are:

- Overview: ≤700ms;
- robot summary: ≤1,000ms;
- one robot detail page: ≤300ms.

The implementation must set and record numeric query/payload ceilings, fixture facts, timings, and cache state. No finance, battle, or repair query may execute per robot. Diagnostics are payload-safe and exclude tokens, player IDs, raw source identities, and audit payloads.

## 13. Known product limitations

- Pre-identity records cannot be asserted as complete pairs.
- Pre-Spec-48 manual repair display evidence can be understated and is not backfilled.
- Live Finance Center ranges never cross a Season Rollover; purged live evidence is not reconstructed.
- Current-inclusive periods and their Revenue Growth remain provisional through `asOf`.
- Full Damage Repair Reference is theoretical current context.
- Prestige forecast is a completed-history pace estimate.
- Robot direct net excludes stable-wide apportionment.
- One detail page is not a complete period.
- Administrative corrections or inconsistent retained evidence produce explicit limitations.

Application implementation is distinct from release and verification evidence. The reporting contract records any available release identifier, mechanism evidence, and observed blocking-run results; absent evidence must not be converted into a claim that the application cutover is pending or that an unrun check passed.

## 14. Acceptance and verification summary

Release requires:

- canonical preparation-spanning Cycle 1 and serialized scheduled/admin closure race tests;
- sequence-ordered reconciliation and completed-boundary tests;
- sale polarity, stored facility itemisation, repair triple, and battle allocation conservation properties;
- version/provenance/period/security/cache/source-reference API integration tests;
- current-inclusive History, forecast, five robot metrics, pagination invariance, independent error, local-time/DST, keyboard, and responsive component tests;
- Playwright redirects/navigation/lazy-loading/accessibility/no-overflow checks; and
- measured performance fixture evidence.

Existing test retirement follows the disposition in the [reporting contract](../implementation_notes/finance-center-reporting-contract.md). All normal lint, build, typecheck, tier, unit, integration, heavy, frontend, and E2E gates remain blocking.

## 15. Related documentation

- [Finance Center Reporting Contract](../implementation_notes/finance-center-reporting-contract.md)
- [Financial Ledger and Audit Guide](../guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md)
- [Prestige and Fame PRD](../game-systems/PRD_PRESTIGE_AND_FAME.md)
- [Economy System PRD](../game-systems/PRD_ECONOMY_SYSTEM.md)
- [Cycle System PRD](../game-systems/PRD_CYCLE_SYSTEM.md)
- [Season System PRD](../game-systems/PRD_SEASON_SYSTEM.md)
