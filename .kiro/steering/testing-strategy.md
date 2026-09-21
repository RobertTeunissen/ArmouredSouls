---
inclusion: fileMatch
fileMatchPattern: "**/tests/**,**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.property.test.ts,**/jest.config.*"
---

# Testing Strategy

## Frameworks and ownership
- Backend: Jest + TypeScript (`ts-jest`); frontend: Vitest 4 + jsdom; property testing: fast-check; browser workflows: Playwright.
- This file owns test classification, critical coverage contracts, fixture invariants, and blocking commands. Generic coding rules belong in `coding-standards.md`; current pass counts and roadmaps do not belong in steering.

## Backend Tier_Partition (Spec #51)
Every `*.test.ts` under `app/backend/tests/` or `app/backend/src/` must be collected by exactly one tier:

| Tier | Config | Command | Scope |
|---|---|---|---|
| Unit | `jest.config.unit.js` | `pnpm run test:unit` | Pure logic and mocked dependencies. |
| Integration | `jest.config.integration.js` | `pnpm run test:integration` | Real PostgreSQL or supertest; serialized. |
| Heavy | `jest.config.heavy.js` | `pnpm run test:heavy` | Full cycles and bulk operations. |

- Classification lives only in `app/backend/jest.tiers.js`: database/supertest tests go in `DB_DEPENDENT`, full-cycle/bulk tests in `HEAVY_TESTS`, and everything else defaults to Unit.
- Never use `testPathIgnorePatterns` to move or hide a test. `pnpm run test:tiers:verify` is blocking and detects orphaned or duplicated collection.
- Only genuinely removed behavior may have its tests retired. Update expectations when behavior changes; do not make a failing check advisory.

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

## Blocking validation gates
Required backend gates: `pnpm run lint`, `pnpm run build`, `pnpm run typecheck:tests`, `pnpm run test:tiers:verify`, `pnpm run test:unit`, `pnpm run test:integration`, and `pnpm run test:heavy`. Required frontend/E2E gates: frontend lint/build/unit and `pnpm exec playwright test`. A job must be able to fail; do not use `continue-on-error`, `|| true`, or unguarded pipes. Workflow dependencies must be verified in `.github/workflows/`, not inferred from old documentation.

## Database fixture invariants
- Creating a robot/team does not create competitive membership. Competition fixtures must use `tests/helpers/standings.ts`: `enterRobotStanding`, `enterTeamStanding`, or `enterRobotStandings`.
- Set `cyclesInTier` and `leaguePoints` deliberately. Rebalancing eligibility uses the configured minimum cycles and LP thresholds; when testing percentage promotion, size the fixture so the 10% candidate set reaches the minimum new-tier cohort of 3.
- `standings` is polymorphic and has no foreign key to robots or teams. Delete standings before entities during teardown; whole-mode rebalancing suites also clear that mode before running.
- A dropped schema column means its predicate moved to a new source; do not broaden the query by deleting the predicate.

## Schema and integration-test changes
- Update schema, migration, generated client, fixtures/mocks, and assertions together; run the affected tier afterward.
- Current battle identity is in `BattleParticipant` and `winningSide`, not removed `robot1Id`/`robot2Id` fields. Prefer `tests/testHelpers.ts:createTestBattle` over inline battle literals.
- For supertest suites, bind one listening server per file and pass that server to `request`; close it in teardown. `request(app)` creates repeated ephemeral servers and can produce transport failures unrelated to the assertion. Do not disable keep-alive globally as a workaround.
- Do not diagnose database flakes with concurrent full-tier runs. Run one tier at a time against the shared test database.

## Property-based tests
Use properties for invariants, conservation laws, mathematical behavior, transformations, and edge cases. Keep generators bounded and tests fast. Every bounded `fc.float`/`fc.double` representing a physical quantity must use `noNaN: true` and `noDefaultInfinity: true`:

```typescript
fc.float({ min: 1.52, max: 3.0, noNaN: true, noDefaultInfinity: true })
```

## Frontend testing conventions
- Vitest config: `app/frontend/vitest.config.ts`; setup: `app/frontend/src/setupTests.ts`; run with `pnpm exec vitest --run` or `--coverage`.
- Place tests in `__tests__/` beside the source. Use `*.test.ts`, `*.test.tsx`, and `*.pbt.test.ts(x)`.
- Use React Testing Library, `userEvent`, `vi.mock()`, accessible queries, and rendered-behavior assertions. Cover loading, error, empty, interaction, and responsive states.
- Reset Zustand stores with `useStore.setState(useStore.getInitialState())`; test actions and selectors independently.
- Playwright tests use one worker for shared-state flows, role/label/text locators, condition-based waits, and failure artifacts. Run with `pnpm exec playwright test`.
