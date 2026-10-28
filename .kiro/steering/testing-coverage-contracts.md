---
inclusion: auto
name: testing-coverage-contracts
description: "Mandatory test coverage contracts for financial capture, Finance Center, and Automatons. Use when adding or changing economy writers, prestige sources, finance reports, or Automaton code and their tests."
---

# Domain Coverage Contracts

Tier rules and blocking commands are in `testing-strategy.md`.

## Financial capture and Finance Center coverage
Financial capture and reporting are critical paths, not advisory suites. The `Coverage_Manifest` must cover every current-economy writer and positive prestige source, including all nine battle modes, `Bye_Event`, streaming, achievements, robot creation, attributes, facilities, weapons, manual/automatic/admin repairs, both settlement entry points, legacy admin daily-finance, free subscriptions, prestige, and lifecycle boundaries.

Required financial coverage:
- **Unit:** closed `Transaction_Taxonomy`, typed `Financial_Breakdown`, identity construction/conflicts, reward aggregation, battle row fan-out, prestige fields, per-robot repair arithmetic, zero-valued settlement components, subscription exclusion, manifest, and direct-writer checks.
- **Integration:** atomic paired writes and rollback, duplicate/conflict behavior, concurrent retries, `withAuditSequence` continuity, all modes plus byes, streaming, repair pairs including automatic repair for byed robots, economic writers, settlement reruns/failure, lifecycle boundaries, diagnostics, and admin compatibility.
- **Heavy:** representative scheduler/admin flows through team modes, tag team, tournaments, KotH, Grand Melee, streaming, repairs, settlement, byes, and retry safety.

Required Finance Center replacement coverage:
- **Unit/property:** preparation-spanning Cycle 1, active cycle `totalCycles + 1`, sequence-ordered reconciliation, statement equations, sale polarity, stored facility itemisation, single repair contribution, battle-allocation conservation, forecast boundaries, pagination invariance, and opaque references.
- **Integration:** serialized cutover/races, blocked-writer next-cycle resolution, one `asOf` view, zero settlement rows, completed boundaries, API auth/validation/ownership, cache isolation, repair links, deterministic pagination, payload safety, and query-growth budgets.
- **Frontend/E2E:** provenance and preparation labels, URL periods, current-inclusive history, sale/purchase headings, five robot metrics, pagination, keyboard/focus/responsive behavior, `/income` migration and redirects, navigation/lazy loading, active points, and no required-viewport overflow.
- Feature-specific thresholds and file disposition live in `docs/implementation_notes/finance-center-reporting-contract.md`.
- Retirement is replacement-gated: retain formula/property, repair-log, admin contract, guide, battle-result, reconciliation/security, and route-migration coverage until replacements are green.

## Automaton coverage (Spec #55)
- **Unit:** `strategyConformance.property.test.ts` and `strategyScenario.test.ts` iterate every file in `src/config/automaton-strategies/`, so a new Strategy_Definition_File needs no new test; `{key}.v1.fixture.test.ts` pins the six approved v1 files. Catalogue tests (`catalogueSchema`, `automatonCatalogueCoverage`, `catalogueImages`) cover every repository Catalogue_Entry and Repository_Image.
- **Integration (`DB_DEPENDENT`):** `tests/integration/automaton*.test.ts` (turn wiring, Financial_Pairs, retries, access blocking, admin routes, sync, zero-write previews); a rollover suite that truncates history is `HEAVY_TESTS`.
- **Heavy:** `automatonMultiSeason.test.ts` tests the rules, not every stable. It syncs every repository Catalogue_Entry as a draft, then activates only the Starter_Stables (`STARTER_CATALOGUE_KEYS`; `automatonCatalogueCoverage.test.ts` proves they cover the Coverage_Matrix) for two seasons. Per-entry fit is the catalogue unit tests' job. Do not grow the heavy population with the catalogue. `AUTOMATON_HEAVY_POPULATION=catalogue` activates every entry for a scale measurement (manual `.github/workflows/automaton-scale.yml`, not a PR gate). Run it on a dedicated heavy database (`AUTOMATON_TURN_CONCURRENCY` selects the parallelism); timings are in `docs/implementation_notes/AUTOMATON_TURN_STEP_DEADLINE.md`.
- Automaton code must not write `User.currency` or reference Manual_Repair (`noDirectWriters.test.ts`).
- **E2E:** the `admin` project runs after `chromium` (its bulk cycles change seeded stables); `admin-teardown` deletes the `e2e-automaton*` stables via `scripts/deleteE2eAutomatons.ts`, so it needs the backend's `DATABASE_URL`.
