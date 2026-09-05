# Financial Ledger and Audit Guide

**Status**: Spec #53 capture contract and operator guidance  
**Scope**: Post-cutover financial capture, audit pairing, reconciliation, and compatibility  
**Related work**: Backlog Item #59 / Financial Ledger Coverage

This guide documents the accounting and audit contract for new economy events. It is intentionally forward-only: the contract becomes authoritative at the selected `Cutover_Cycle` in `ACC`, after the writer migration and blocking checks complete. It does not redesign financial pages, change player-visible reward formulas, or reconstruct historical records.

## 1. Balance and record model

The player-facing currency is Credits. The authoritative mutable balance is the exact Prisma field `User.currency`; do not document or implement a parallel `User.credits` field. `User.prestige` is a separate stable-level progression value and is never part of a credit amount.

A post-cutover `Credit_Mutation` has one identity and one atomic persistence unit:

```text
source operation
  -> financialEventId
  -> Credit_Mutation_Service
       -> lock and re-read User.currency
       -> update User.currency
       -> insert one FinancialLedger row
       -> insert one AuditLog row with eventType = financial_transaction
  -> commit once
```

The `FinancialLedger` row and the paired `AuditLog` row are two records for one mutation, not two mutations:

| Record | Purpose | What it answers |
|---|---|---|
| `FinancialLedger` mapped to `financial_ledger` | Accounting and reporting | What amount was applied, to which stable/robot, under which `transactionType`, and what was the resulting balance? |
| `AuditLog` mapped to `audit_logs`, with `eventType` `financial_transaction` | Immutable operational, security, and reconciliation trail | Which source produced the accounting event, when was it sequenced, and can the pair be proven complete? |

Both records carry the same non-null `financialEventId`, signed `amount`, `balanceAfter`, stable/user identity, optional robot identity, source description, and typed financial facts. The audit record never performs another `User.currency` update. The pair is written in one database transaction and receives one audit sequence through `withAuditSequence`.

### One mutation, two complementary records

```mermaid
flowchart LR
    SOURCE[Source operation] --> EVENT[One financialEventId]
    EVENT --> MUTATION[One Credit Mutation]

    subgraph ATOMIC[One database transaction]
        BALANCE[One User.currency delta]
        LEDGER[One FinancialLedger row\nAccounting and reporting]
        AUDIT[One AuditLog financial_transaction row\nOperational, security, and reconciliation]
        BALANCE --> LEDGER
        BALANCE --> AUDIT
        LEDGER <-->|same financialEventId| AUDIT
    end

    MUTATION --> ATOMIC
    ATOMIC --> COMMIT[Commit or roll back together]
```

The diagram's three writes are one `Credit_Mutation`, not three independent events: the balance is mutable state, while the ledger and audit rows are complementary immutable evidence of that same mutation.

The current repository contains pre-cutover ledger and audit behavior, including best-effort enrichment on some paths. Those rows and writers remain `Legacy_Record` evidence until the ACC cutover. Their existence does not prove complete coverage and does not permit a report or migration to invent missing pairs.

## 2. Closed transaction taxonomy

The post-cutover `Transaction_Taxonomy` contains exactly these twelve `transactionType` values:

| `transactionType` | Sign | Source and meaning |
|---|---:|---|
| `battle_income` | positive | Fought-battle reward or a `Bye_Event` participation floor |
| `streaming_revenue` | positive | Per-robot Streaming Studio reward from a fought battle |
| `repair_cost` | negative | `Manual_Repair`, `Automatic_Repair`, or charged admin maintenance |
| `facility_upgrade` | negative | Facility purchase or upgrade charge |
| `weapon_purchase` | negative | Weapon purchase charge |
| `weapon_sale` | positive | Weapon sale proceeds |
| `weapon_refinement` | negative | Weapon refinement charge |
| `robot_creation` | negative | Robot creation charge |
| `attribute_upgrade` | negative | Attribute upgrade charge |
| `achievement_reward` | positive | Achievement credit reward |
| `passive_income` | positive | Gross settlement passive income |
| `operating_costs` | negative | Gross settlement operating costs |

New writers must reject `subscription_cost`, `prestige_award`, and `settlement_adjustment`. These names may exist in surviving pre-cutover rows, but they are not valid post-cutover writes:

- `Subscription_Change` is free Booking Office state, not a charge.
- `Prestige_Award` is progression, not currency.
- Settlement is two component events, not a signed net adjustment.

## 3. Financial_Breakdown contract

Every financial event persists a typed and runtime-validated `Financial_Breakdown` in the ledger’s structured metadata and the paired audit payload. It is a record of the facts applied at the time of the event, not an instruction to recalculate the event later.

Every breakdown includes:

- formula identifier and version;
- source operation and `financialEventId`;
- typed inputs with units and source labels;
- amount-affecting modifiers, discounts, bonuses, or facility effects;
- operation order when multiple modifiers are applied;
- precision, rounding mode, and per-item versus aggregate rounding; and
- the final signed amount.

The source-specific facts are:

| Source | Required stored facts |
|---|---|
| `battle_income` | Mode, tier, outcome, placement, participation floor, win component, team size, stable aggregation, bye flag, modifiers, and final rounding |
| `streaming_revenue` | Robot, mode, base amount, battle-count multiplier, fame multiplier, Streaming Studio multiplier, eligibility, and rounding |
| `repair_cost` | Robot, `repairType`, base quote inputs, damage/condition inputs, Repair Bay level, active-robot count, Repair Bay discount, manual discount where applicable, per-robot charge, and rounding order |
| Purchases/upgrades/sales/refinements | Item or facility, previous/new level or condition, base price, discounts, roster/ownership inputs, operation identity, and rounding |
| `achievement_reward` | Achievement/unlock identity, base reward, applied modifiers, and final reward |
| `passive_income` | Cycle, Merchandising Hub level, prestige, roster capacity, prestige-per-slot normalization, facility effect, and rounding |
| `operating_costs` | Cycle, each facility and roster component, inputs, discounts/waivers, and aggregate rounding |

Combat-only values that do not affect a credit amount do not belong in the financial breakdown. A later report must explain a stored amount without reading current facilities, `User.prestige`, current robot fame, `robots.repairQuoteCredits`, or current formula code.

Example shape for a battle-income event:

```json
{
  "schemaVersion": 1,
  "formula": "battle-income-v1",
  "source": "league_1v1",
  "financialEventId": "battle:4821:stable:17:battle_income",
  "inputs": [
    { "name": "tier", "value": "gold", "unit": "tier", "source": "standing" },
    { "name": "participationFloor", "value": 6000, "unit": "credits", "source": "reward calculation" },
    { "name": "teamSize", "value": 1, "unit": "robots", "source": "battle result" }
  ],
  "modifiers": [],
  "rounding": { "precision": 0, "mode": "round", "order": "aggregate_then_round" },
  "finalAmount": 6000
}
```

## 4. Event identity, atomicity, and retries

`financialEventId` is supplied at the source boundary and must remain stable across retries. It must not be generated from the current balance, current facility state, current repair quote, or a retry timestamp.

| Source | Identity components |
|---|---|
| Battle reward | Source battle/match, receiving stable, and reward component (`battle_income` or bye component) |
| Streaming | Source battle/match, participating robot, and `streaming_revenue` |
| Achievement | Unlock identity, stable, and `achievement_reward` |
| Repair | Repair operation, repaired robot, and `repair_cost` |
| Settlement | Stable, cycle, and component (`passive_income` or `operating_costs`) |
| Request-driven economy | Durable operation identity or persisted request idempotency key |

An identical retry returns the original `balanceAfter` and creates no second balance delta or pair. A conflicting reuse of the identity fails closed if any immutable fact differs, including amount, user, robot, taxonomy, source, or breakdown. A concurrent unique-constraint race is resolved by rereading the committed event; the losing request must not apply money again.

The atomicity rule is strict:

1. validate the taxonomy, metadata, and breakdown;
2. lock/re-read `User.currency` when the mutation can race;
3. compare an existing identity before applying a new delta;
4. update `User.currency`;
5. allocate `sequenceNumber` through `withAuditSequence`;
6. insert `FinancialLedger` and the paired `financial_transaction` `AuditLog` row; and
7. commit only when all required writes succeed.

A balance update without both required records is a failed transaction, not a successful partial result. `recordLedgerEntry.ts` and any `financial_ledger_active` behavior that swallows a required failure are pre-cutover compatibility concerns and must not be used after activation.

## 5. Battle rewards and row fan-out

All nine scheduled modes use the shared `Battle_Financial_Reward_Service` and `Credit_Mutation_Service` after each mode has calculated its existing reward components:

- `league_1v1`
- `tournament_1v1`
- `tag_team`
- `koth`
- `league_2v2`
- `league_3v3`
- `tournament_2v2`
- `tournament_3v3`
- `grand_melee`

A fought battle has this contract:

- aggregate battle credits by receiving stable, then write one `battle_income` pair per stable;
- write one `streaming_revenue` pair per eligible participating robot;
- send positive stable-level prestige to `Prestige_Service`; and
- retain existing `battle_complete` and `BattleParticipant` fields for display and compatibility only.

### Worked row counts

Two robots from two different stables fight a 1v1 and both are streaming-eligible:

| New record | Count |
|---|---:|
| `FinancialLedger` `battle_income` rows | 2 |
| `FinancialLedger` `streaming_revenue` rows | 2 |
| Paired `financial_transaction` `AuditLog` rows | 4 |
| Credit mutations | 4 |

Each of the four mutations has one ledger row and one paired audit row. The eight stored financial records do not represent eight balance changes.

A 2v2 whose two robots belong to one stable produces one aggregated `battle_income` pair and two `streaming_revenue` pairs. A 2v2 with two receiving stables produces one income pair per stable. Streaming is per eligible robot; battle income is per receiving stable.

### Bye_Event

A `Bye_Event` is detected before the absent side is loaded or fabricated and before any combat simulation. Its reward path writes only the existing participation-floor `battle_income` pair. It writes no streaming revenue, prestige, fame, draw, repair spend, or simulated combat result.

A byed robot can still require `Automatic_Repair` before the scheduled event if it has pre-existing damage. That repair is resolved by the normal event schedule scope and creates its own per-robot `repair_cost` pair and `robot_repair` domain record. It is not part of, or attributed to, the bye reward. This distinction prevents a bye reward from being mistaken for a repair charge while ensuring a scheduled robot is not exempted from normal pre-battle repair.

## 6. Repair accounting

The arithmetic authority remains the shared module `app/shared/utils/repairCost.ts`:

- `calculateRepairQuote` produces the Repair_Quote after the Repair Bay discount;
- `applyManualRepairDiscount` applies the manual discount to that quote; and
- `calculateRepairBayDiscountPercent` records the Repair Bay effect.

No caller duplicates the formula or reapplies a discount already present in the quote.

`Manual_Repair`, `Automatic_Repair`, and charged admin maintenance use `repair_cost` with `repairType` exactly `manual` or `automatic`. Every repaired robot receives:

1. one `repair_cost` `FinancialLedger`/`financial_transaction` pair; and
2. one `AuditLog` `robot_repair` domain record.

The subtype-bearing `robot_repair` record is the `Repair_Spend` `Canonical_Source` for the dashboard and admin repair log. Its payload carries `creditsCharged`, `repairType`, `manualRepairDiscount`, and, on manual events, `creditsBeforeManualDiscount`. The financial pair supports accounting and reconciliation but does not replace the subtype-bearing repair source for repair reports.

A manual batch is expanded per robot: quote, apply the Repair Bay discount, apply the manual discount, round, create the per-robot records, then sum. The sum must equal the `User.currency` delta, `robots.lifetimeRepairCreditsPaid`, financial amounts, and repair audit totals. A failed pair rolls back the charge; an identical retry cannot charge the robot again.

Repair spend must never be read from:

- `battle_complete` payloads, including a missing or historical `repairCost` key;
- `robots.repairQuoteCredits`, which is a forward-looking quote and not money spent; or
- a net or subtype-losing ledger aggregation when the question is manual versus automatic spend.

## 7. Prestige records and growth history

Prestige is a stable-level progression resource. `Prestige_Service` is separate from `Credit_Mutation_Service` and writes positive awards as `AuditLog` rows with `eventType` `prestige_change`.

Each post-cutover prestige record includes:

- `sourceEventId`, unique for the source award;
- `eventTimestamp` and `cycleNumber`;
- stable/user identity;
- exact aggregate award amount;
- source `battle` or `achievement`;
- optional mode, battle, or achievement identity;
- typed award breakdown; and
- resulting `User.prestige`.

Team, placement, KotH, Grand Melee, and tournament rewards aggregate at stable level before calling `Prestige_Service`. Participant payload fields are context/display data and are not summed later to reconstruct the canonical amount.

An identical `sourceEventId` retry returns the original prestige result. Reusing it with different facts fails closed and does not alter `User.prestige`. `withAuditSequence` orders records for a current-season `Prestige_Growth_Series`; no credit ledger row is written for prestige. Bye outcomes, zero awards, account resets, and `Season_Rollover` do not create positive prestige records.

## 8. Settlement and zero-valued components

`Settlement_Service` is the sole mutating settlement implementation used by `cycleScheduler.ts`, `adminCycleService.ts`, and the supported administrative daily-finance trigger. For every applicable stable and `cycleNumber`, it writes:

1. exactly one `passive_income` pair; and
2. exactly one `operating_costs` pair.

This includes zero-valued components. A zero component records a completed calculation, typed inputs, and unchanged `balanceAfter`; it is not an additional credit delta. Rerunning a stable/cycle is idempotent and cannot pay or charge twice. Partial failure rolls back the component and its balance mutation.

`passive_income` stores gross passive income and its Merchandising Hub, prestige, roster-capacity, and rounding facts. `operating_costs` stores each facility/roster cost component and its inputs. Per-battle Streaming Studio revenue remains `streaming_revenue`, not settlement income.

Existing domain `passive_income` and `operating_costs` audit events and cycle snapshot fields remain compatible while the paired `financial_transaction` rows become the post-cutover accounting source. A future report may derive a net value from the two components; it must not create or expect `settlement_adjustment`.

## 9. Canonical-source map

| Reporting or operational question | `Canonical_Source` |
|---|---|
| Post-cutover credit amount, balance, taxonomy, breakdown, or pair | `FinancialLedger` plus paired `AuditLog` `financial_transaction`, joined by `financialEventId` |
| Repair spend and `repairType` | `AuditLog` `robot_repair` rows with `creditsCharged` and `repairType` |
| Prestige awards and current-season growth points | `AuditLog` `prestige_change` rows with `sourceEventId` |
| Subscription state and changes | Booking Office records and existing subscription audit records |
| Account creation, reset, rollover, and archive history | Existing lifecycle/audit and archive records |
| Battle display/result history | Existing `battle_complete`, `BattleParticipant`, and permanent battle-summary records |

No report should substitute a battle payload, cached quote, current formula, or subtype-losing aggregate for the source that answers its question.

## 10. Admin compatibility

The financial capture change preserves existing admin contracts while adding generic visibility for the new audit event:

- `/api/admin/audit-log` continues to expose its existing filters and response shape and can query `financial_transaction` rows.
- `/api/admin/audit-log/repairs` remains scoped to subtype-bearing `robot_repair` records and keeps `repairType`, `creditsCharged`, and manual-discount fields available.
- `/api/admin/daily-finances/process` remains available. Its response continues to include `summary.totalCostsDeducted`, `usersProcessed`, and `timestamp`; mutation delegates to `Settlement_Service` or the endpoint is a non-mutating preview.
- `/api/admin/cycles/bulk` preserves `includeDailyFinances`, `settlement.finances`, `totalPassiveIncome`, `totalOperatingCosts`, `usersProcessed`, and `skipped` while delegating settlement mutation.
- `/api/admin/economy/overview` preserves the response fields and filters consumed by `EconomyOverviewPage`.

`CycleControlsPage`, `RepairLogPage`, `AuditLogPage`, and `EconomyOverviewPage` require no redesign. Generic financial audit rows are visible through the existing audit route; the repair route remains a repair-domain view rather than a generic ledger view.

## 11. ACC cutover and reconciliation

The rollout is gated in this order:

1. **Schema and client** — add nullable pairing/identity fields, indexes, uniqueness safeguards, and generate the project-local Prisma client.
2. **Contract** — activate taxonomy, identity, and `Financial_Breakdown` validation.
3. **Writer migration** — move every `Coverage_Manifest` entry to the shared credit, battle, repair, settlement, and prestige services.
4. **Blocking verification** — pass direct-writer, manifest, unit, PostgreSQL integration, heavy, frontend, and E2E gates.
5. **ACC activation** — record `Cutover_Cycle` only after the previous gates pass and required capture is fail-closed.
6. **Reconciliation** — inspect post-cutover evidence and separate it from legacy history.
7. **Documentation and bypass removal** — remove obsolete best-effort/suppression paths only as part of the implementation rollout.

Reconciliation is diagnostic and non-mutating. It reports:

- post-cutover ledger rows without a paired `financial_transaction` row;
- financial audit rows without a ledger row;
- duplicate or conflicting `financialEventId` values;
- mismatched amount, identity, source, or `balanceAfter` facts;
- invalid taxonomy or incomplete `Financial_Breakdown` metadata;
- repair financial/domain pair mismatches or missing subtype data;
- missing `passive_income` or `operating_costs` components, including zero-valued rows;
- duplicate or conflicting prestige `sourceEventId` values; and
- direct `User.currency` writers outside the manifest/service boundary.

Pre-cutover gaps are labeled “outside the completeness claim.” They are not repaired by fallback payloads, current formulas, old ledger rows, or a one-off migration script.

### Failure response

If a required paired write fails after deployment:

1. treat the operation as failed and verify that `User.currency` rolled back;
2. inspect the transaction identity and sequence error without manually inserting a compensating ledger row;
3. check for a committed pair before retrying;
4. retry only with the same source identity and immutable facts; and
5. run post-cutover reconciliation before re-enabling a bypass or changing historical rows.

Never repair a missing pair by changing an old amount, adding a second balance adjustment, or reading a cached quote as spend.

## 12. Verification before ACC cutover

Run these blocking commands before recording `Cutover_Cycle` in `ACC`; do not substitute historical data, a partial test run, or a successful migration for this gate:

```sh
pnpm --dir app/backend run lint
pnpm --dir app/backend run build
pnpm --dir app/backend run typecheck:tests
pnpm --dir app/backend run test:tiers:verify
pnpm --dir app/backend run test:unit
pnpm --dir app/backend run test:integration
pnpm --dir app/backend run test:heavy
pnpm --dir app/frontend run lint
pnpm --dir app/frontend run build
pnpm --dir app/frontend run test:ci
pnpm --dir app/frontend exec playwright test
```

Also run the `Coverage_Manifest`, direct-writer, battle fan-out, atomicity/idempotency, repair-audit, and reconciliation checks named in the implementation record. Record each actual result in [`financial-ledger-coverage.md`](../implementation_notes/financial-ledger-coverage.md); a stalled or unavailable environment is inconclusive, not a pass. Only then may `recordAccCutover()` persist the immutable cutover.

## 13. Explicit non-scope

This guide does not change player-facing rules or presentation:

- No file under `app/backend/src/content/guide/` is modified for this capture-only work. `app/backend/tests/guide/content-validation.test.ts` remains a blocking regression check.
- `Income_Dashboard`, `Cycle_Summary`, financial-page components, charts, filters, navigation, and layouts are unchanged.
- The later `Financial_Page_Follow_On` must consume paired financial records, stored `Financial_Breakdown`, repair-source boundaries, and prestige records. It must not reconstruct historical money from battle payloads or current formulas.

For domain formulas and lifecycle rules, see [`PRD_ECONOMY_SYSTEM.md`](../game-systems/PRD_ECONOMY_SYSTEM.md), [`PRD_CYCLE_SYSTEM.md`](../game-systems/PRD_CYCLE_SYSTEM.md), [`PRD_AUDIT_SYSTEM.md`](../architecture/PRD_AUDIT_SYSTEM.md), and [`PRD_SEASON_SYSTEM.md`](../game-systems/PRD_SEASON_SYSTEM.md).