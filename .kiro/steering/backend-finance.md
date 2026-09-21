---
inclusion: fileMatch
fileMatchPattern: "**/backend/src/services/economy/**,**/backend/src/services/finance/**,**/backend/src/services/settlement/**,**/backend/src/services/common/auditSequence.ts,**/backend/src/services/*repair*/**,**/backend/src/services/*financial*/**,**/*credit*"
---

# Backend Finance and Credit Rules

- `User.currency` is the authoritative Credits balance. Every current-economy mutation uses `Credit_Mutation_Service` and writes one atomic `FinancialLedger` + `financial_transaction` `AuditLog` pair sharing one non-null `financialEventId`.
- The closed taxonomy is: `battle_income`, `streaming_revenue`, `repair_cost`, `facility_upgrade`, `weapon_purchase`, `weapon_sale`, `weapon_refinement`, `robot_creation`, `attribute_upgrade`, `achievement_reward`, `passive_income`, and `operating_costs`.
- Lock and re-read balances when operations can race. Validate typed `Financial_Breakdown` facts and allocate audit sequence numbers only through `withAuditSequence`. Any ledger/audit/sequence failure rolls back the balance.
- Account creation/reset, season rollover, and explicit balance purge are opening-balance boundaries, not current-economy events. Subscription changes are free and nonfinancial.
- Prestige is not currency: positive awards use `Prestige_Service` and `prestige_change` audit records, never ledger rows.
- Repairs are per robot. `repair_cost` requires `repairType` `manual` or `automatic`; repair spend is sourced from subtype-bearing `robot_repair` audit rows, never battle payloads, cached quotes, or ledger totals. Quote each robot, apply discounts, round, then sum.
- Settlement writes exactly one `passive_income` pair and one `operating_costs` pair per applicable stable/cycle, including zero values.
- Reports use complete pairs and stored breakdown facts; never reconstruct historical amounts from current formulas or facilities. Legacy rows without `financialEventId` remain legacy.
- Canonical details: `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md` and `docs/implementation_notes/finance-center-reporting-contract.md`.
