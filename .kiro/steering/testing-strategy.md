---
inclusion: fileMatch
fileMatchPattern: "**/tests/**,**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.property.test.ts,**/jest.config.*"
---

# Testing Strategy

## Frameworks

- Backend: Jest with TypeScript (ts-jest)
- Frontend: Vitest 4 with jsdom
- Property testing: fast-check, both sides

**No pass-rate snapshot lives here.** This section used to claim "Pass rate: ~82% (900-910 of 1099
tests passing), Last updated: February 24, 2026". Counts change on almost every commit, so a
snapshot is stale within days and is then read as authoritative — the same failure mode
`coding-standards.md` documents costing real time in August 2026. Run the suite to learn the
current state.

## Test tiers and the Tier_Partition (Spec #51)

The backend has three tiers, and **every `*.test.ts` file under `app/backend/tests/` or
`app/backend/src/` must be collected by exactly one of them.**

| Tier | Config | Command | For |
|---|---|---|---|
| Unit | `jest.config.unit.js` | `pnpm run test:unit` | Pure logic, mocked dependencies. Parallel. |
| Integration | `jest.config.integration.js` | `pnpm run test:integration` | Needs a real database or supertest. `maxWorkers: 1`. |
| Heavy | `jest.config.heavy.js` | `pnpm run test:heavy` | Full cycle execution, bulk operations. Own CI job. |

### Choosing a tier for a new test

Membership is declared in one place: `app/backend/jest.tiers.js`.

- **Needs a real database, or drives the app through supertest** → add it to `DB_DEPENDENT`.
- **Runs a full game cycle or bulk operations** → add it to `HEAVY_TESTS`.
- **Anything else** → add nothing. The unit tier is the default.

A new test therefore lands in the unit tier automatically, and if it actually needs a database it
fails immediately and loudly. That is the intended failure direction.

### Never add `testPathIgnorePatterns` to a tier config

Excluding a file from one tier does not move it into another. Doing so is how four suites came to
run in **no tier at all** — including `tests/middleware/errorHandler.test.ts`, the only test for
the middleware that shapes every API error body. A separate hand-maintained path list in
`jest.config.integration.js` had also fallen behind the codebase, so ten `src/**/__tests__/` files
were running **twice**. Both failure modes were silent.

`pnpm run test:tiers:verify` enforces the partition and blocks CI. It reports any file collected by
zero tiers (Orphaned_Test) or more than one (Duplicated_Test), naming each offender. If you find
yourself wanting a bespoke exclusion, change the classification in `jest.tiers.js` instead.

## Spec #53 financial coverage and tier rules

Financial capture is critical-path database behavior, so its coverage is partitioned across the existing Unit, Integration, Heavy, frontend, and E2E tiers rather than placed in an advisory suite.

- **`Coverage_Manifest`** is the typed inventory of every post-cutover current-economy credit writer and every positive prestige source. It must include all nine battle modes, `Bye_Event` resolution, streaming, achievement rewards, robot creation, attributes, facilities, weapons, manual/automatic/admin repairs, both settlement entry points, the legacy admin daily-finance route, free subscriptions, and lifecycle boundaries. Each entry names the source function, shared service, identity strategy, record type, and target tier.
- **Direct-writer verification** searches or analyzes production code for `User.currency` mutations. It fails for any current-economy increment, decrement, set, or replacement outside `Credit_Mutation_Service`, except enumerated `Opening_Balance_Boundary` operations. Exclude generated output and `app/backend/src/shared` because that path is the symlink to `app/shared`; do not count the shared module twice.
- **Unit coverage** validates the closed `Transaction_Taxonomy`, typed `Financial_Breakdown`, event-identity construction/conflicts, stable reward aggregation, exact battle row fan-out, prestige record fields, per-robot repair arithmetic, settlement component construction including zero values, subscription exclusion, the manifest, and direct-writer checks.
- **PostgreSQL Integration_Tier coverage** proves paired-write atomicity and rollback, `financialEventId` and `sourceEventId` duplicate/conflict behavior, concurrent retry safety, `withAuditSequence` continuity, all nine battle modes plus `Bye_Event`, per-stable income/per-robot streaming, per-robot repair pairs including automatic repair for a byed robot, achievement/economic writers, settlement reruns and partial failure, lifecycle boundaries, diagnostics, and admin route compatibility.
- **Heavy_Tier coverage** runs representative complete scheduler and admin-cycle flows through team modes, tag team, tournaments, KotH, Grand Melee, streaming, automatic/manual repairs, settlement, and retry safety. It must verify that a bye’s automatic repair is a separate `repair_cost` event and that zero-valued settlement components still receive one pair each.
- **Frontend and E2E regression coverage** retains admin contract tests for `CycleControlsPage`, `RepairLogPage`, `EconomyOverviewPage`, and `AuditLogPage`, plus existing authenticated admin and battle/result Playwright flows. No financial-page UI test or player-guide behavior is changed by this capture-only work.

Only tests for removed behavior may be retired: feature-flag-off/null ledger enrichment, obsolete taxonomy labels, direct combined KotH/Grand Melee currency updates, and independent legacy daily-finance mutation. Formula/property, repair-log, admin contract, financial-page no-regression, player-guide content, battle-result, and domain snapshot tests remain blocking. The final gate uses `pnpm run lint`, `pnpm run build`, `pnpm run typecheck:tests`, `pnpm run test:tiers:verify`, `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run test:heavy`, the frontend lint/build/unit commands, and the existing Playwright command; this documentation-only task does not run those suites.

## Testing Policy

### Required Testing Standards
**Always write tests as part of development** - Testing is mandatory, not optional.

**Coverage Requirements**:
- Minimum 80% code coverage for all new code
- Minimum 90% code coverage for critical functionality
- Critical functionality includes:
  - Combat calculations and battle resolution
  - Economy and credit transactions
  - Matchmaking algorithms
  - League promotion/relegation logic
  - Authentication and authorization
  - Database migrations and schema changes

### When to Write Tests
1. **Always** - Write tests for all new features and functionality
2. **Always** - Write tests for bug fixes (regression tests)
3. **Always** - Write tests for refactored code
4. **Always** - Write tests for API endpoints
5. **Always** - Write tests for service layer logic

### Test Execution Requirements
**After completing development**:
1. Run full test suite: `pnpm test`
2. Verify all tests pass
3. Check coverage report: `pnpm test -- --coverage`
4. Ensure coverage meets minimum thresholds (80% general, 90% critical)
5. Fix any failing tests before committing

**Note**: Do not commit code without accompanying tests and verified test passage.

## Test Types

### Unit Tests (Required)
- Test individual functions and services in isolation
- Mock external dependencies (database, APIs)
- Fast execution (<1s per test)
- Located in `app/backend/tests/`
- **Coverage target**: 80% minimum

### Integration Tests (Required for Critical Paths)
- Test multiple components working together
- Use real database (test transactions)
- Slower execution (1-5s per test)
- Located in `app/backend/tests/integration/`
- **Coverage target**: 90% for critical functionality

### Property-Based Tests (Recommended)
- Test properties that should always hold true
- Generate random inputs with fast-check
- Find edge cases automatically
- Files named `*.property.test.ts`
- Use for complex algorithms and game mechanics

### E2E Tests (Implemented)
- Test complete user workflows through a real browser using Playwright
- Located in `app/frontend/tests/e2e/`
- 11+ spec files covering registration, onboarding, robot creation, weapon shop, practice arena, financial flow, battle history, protected page smoke tests, and a critical user journey
- Blocking CI gate — E2E failures prevent deployment

**Helpers** (`tests/e2e/helpers/`):
- `login.ts` — `loginAndGoToDashboard` for authenticating as a test user (default: `test_user_001`)
- `navigate.ts` — `navigateToProtectedPage` with retry logic for auth race conditions
- `register.ts` — `registerNewUser` for creating fresh accounts via the UI with unique timestamp-based identifiers

**Auth Setup**: The `setup` project in `playwright.config.ts` logs in as `test_user_001` and saves storage state to `.auth/test_user_001.json`. Tests in the `chromium` project reuse this state.

**Conventions**:
- Serial execution: `fullyParallel: false`, `workers: 1` (tests mutate shared state)
- Locators: role-based (`getByRole`), label-based (`getByLabel`), text-based (`getByText`) — no CSS class selectors
- Waits: condition-based (`waitForLoadState`, `toBeVisible`) — no `waitForTimeout`
- Retries: 2 in CI, 0 locally
- Artifacts: screenshots on failure, video retained on failure, trace on first retry

**Running E2E tests**:
```bash
cd app/frontend && pnpm exec playwright test          # Run all E2E tests
cd app/frontend && pnpm exec playwright test --list   # List all test cases
cd app/frontend && pnpm exec playwright test --ui     # Interactive UI mode (local dev)
```

## Running Tests

### Required: Run All Tests After Development
```bash
cd app/backend
pnpm test
```
**Must pass before committing code**

### Check Coverage (Required)
```bash
pnpm test -- --coverage
```
**Verify**: 80% minimum coverage, 90% for critical functionality

### Specific Test File (Development)
```bash
pnpm test -- tests/facility.test.ts
```

### Watch Mode (Local Development)
```bash
pnpm test -- --watch
```

### Sequential Execution (If Parallel Issues)
```bash
pnpm test -- --maxWorkers=1
```

### Current Configuration
- **maxWorkers**: 2 (reduced to minimize parallel conflicts)
- **testTimeout**: 10000ms (10 seconds)
- **setupFilesAfterEnv**: Database setup and teardown
- **Coverage thresholds**: 80% general, 90% critical

## Known Testing Issues

### 1. Parallel Test Conflicts (~20 suites)
**Problem**: Tests pass individually but fail when run in parallel due to shared database state and sequence conflicts.

**Affected suites**: tagTeamService, queryService, eventLogger, battleOrchestrator, cycleExecution, various property tests

**Workaround**: Run with `pnpm test -- --maxWorkers=1` for 100% reliability (slower)

**Long-term fix**: Implement per-worker database isolation

### 2. Compilation Failures (~3 suites)
**Problem**: Missing modules or outdated schema references

**Affected files**:
- `tests/trendAnalysis.property.test.ts` - Missing service module
- `tests/migrateBattlesToEvents.test.ts` - References old Battle schema
- `tests/integration/repairCostConsistency.test.ts` - 67 compilation errors

**Fix**: Update or remove these test files

### 3. Business Logic Mismatches (~10 suites)
**Problem**: Tests expect old behavior after game mechanics changed

**Examples**:
- League rebalancing now retains LP on promotion/demotion (tests expect reset)
- Training facility costs changed
- Two-handed weapon bonus reduced from 25% to 10%

**Fix**: Update test expectations to match current implementation

## Test Structure Best Practices

### File Organization
```typescript
// tests/feature-name.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Feature Name', () => {
  beforeEach(async () => {
    // Setup test data
  });

  afterEach(async () => {
    // Cleanup test data
  });

  it('should do something specific', async () => {
    // Arrange
    const input = { /* test data */ };
    
    // Act
    const result = await serviceFunction(input);
    
    // Assert
    expect(result).toEqual(expectedOutput);
  });
});
```

### Test Isolation
- Each test should be independent
- Use `beforeEach` for setup, `afterEach` for cleanup
- Don't rely on test execution order
- Clean up created data to avoid conflicts

### Naming Conventions
- Test files: `feature-name.test.ts`
- Property tests: `feature-name.property.test.ts`
- Integration tests: `integration/feature-name.test.ts`
- Describe blocks: Feature or service name
- Test cases: "should [expected behavior] when [condition]"

## Database Testing

### Test Database Setup
- Uses same PostgreSQL instance as development
- Each test suite should create its own test data
- Use transactions for isolation (when possible)
- Clean up after tests complete

### Creating Test Data
```typescript
beforeEach(async () => {
  // Create test user
  testUser = await prisma.user.create({
    data: {
      username: 'test_user_' + Date.now(),
      password: await bcrypt.hash('password', 10),
      credits: 1000000,
    },
  });

  // Create test robot
  testRobot = await prisma.robot.create({
    data: {
      userId: testUser.id,
      name: 'Test Robot',
      armor: 100,
      // ... other required fields
    },
  });
});
```

### A competitive fixture must write `standings` (Spec #40, #43, #51)

**Creating a robot or a team does not enter it into a competition.** Spec #40 moved tier,
league instance, LP and `cyclesInTier` out of `Robot` and `TeamBattle` and into
`standings`; Spec #43 dropped the old columns and migrated the reads. A fixture that
creates entities and no standing rows creates entities that are in no league at all.

`getInstancesForTier`, `getLeagueInstanceStats`, `rebalanceLeagues`,
`rebalanceTagTeamLeagues`, `runMatchmakingForTier`, `getEligibleTeams` and the tag team
orchestrator all scope their work from `standings`, find nothing, and correctly do
nothing. **That is what "Expected 331, Received 0" means: not a broken service, a fixture
that predates Spec #40.** It was the single largest cause of Heavy_Tier failures.

Use `tests/helpers/standings.ts` — `enterRobotStanding`, `enterTeamStanding`,
`enterRobotStandings` — rather than an inline `prisma.standing.create`, so the shape of a
correct fixture lives in one place.

Two fields gate the league engine and must be set deliberately, not defaulted:

- **`cyclesInTier`** — `leagueEngine` counts only entities at or above
  `minCyclesForRebalancing` (5 for the LP leagues, 10 for the Placement_Modes) as
  eligible, and takes 10% of the **eligible** count, not of the tier total. Leave it at 0
  and every promotion assertion reads 0.
- **`leaguePoints`** — promotion also requires the per-tier threshold from
  `getMinLPForPromotion` (bronze 25, silver 50, gold 75, platinum 100, diamond 125).

There is also a **destination-cohort rule** that surprises fixtures: `leagueEngine` holds
promotions entirely when the destination tier is empty and there are fewer than
`minCohortForNewTier` (3) candidates. A 20-entity tier yields 2 candidates at 10%, which
is below that floor, so a 20-entity fixture promotes nobody — and a test written for it
ends up asserting the cohort rule by accident instead of the percentage rule on purpose.
Size the fixture so 10% is at least 3.

### `standings` has no foreign key, so deleting entities does not clean it up

`standings` is polymorphic (`entityType` + `entityId`), so it has **no** foreign key to
`robots` or `team_battles`. `prisma.robot.deleteMany` leaves its standing rows behind, and
the next test in the file inherits them. Since suites reuse tier names — `bronze` above
all — an uncleared row lands directly in a later test's instance counts.

Clear it explicitly in teardown, and clear it before the entities:

```typescript
afterEach(async () => {
  // standings first: no FK, so it is not cascaded by the deletes below
  await prisma.standing.deleteMany({});
  // then in reverse order of foreign key dependencies
  await prisma.battleParticipant.deleteMany({ where: { robotId: testRobot.id } });
  await prisma.robot.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
});
```

A suite that rebalances a whole competition — anything calling `rebalanceLeagues` or
`rebalanceTagTeamLeagues` — must also clear that mode's standings in `beforeAll`, because
those functions operate on every row for the mode, not only on the rows the suite created.

### A dropped column takes its predicate with it — check what the `where` still asks

When Spec #40 moved tier off `TeamBattle`, `tests/integration/tagTeamLeagueRebalancing.test.ts`
kept its verification queries and lost only the tier predicate that no longer compiled.
What remained was `prisma.teamBattle.findMany({ where: { id: { in: teamIds } } })` — a
query that counts every team the test created, whatever tier it ended in.

The suite then asserted the same unfiltered 20-row result equalled both 2 and 18 in one
test, so it could not pass under any behaviour. It reported "Received: 20", which reads
like a rebalancing defect and was in fact a test that had stopped asking about tiers.

**When a migration drops a column, a query that filtered on it does not become a broader
query — it becomes a different question.** Move the predicate to its new home rather than
deleting it.


## Schema Changes and Tests

### When Schema Changes
1. Update Prisma schema
2. Create migration: `pnpm exec prisma migrate dev`
3. Update affected test files
4. Run tests to verify: `pnpm test`

### Common Schema-Related Test Failures
- **Missing fields**: Add new required fields to test mocks
- **Removed fields**: Delete references from test assertions
- **Renamed fields**: Update all test references
- **Changed relationships**: Update foreign key handling

### Battle Schema Migration Example
Old Battle model had fields like `robot1DamageDealt`, `robot2DamageDealt`.  
New model uses `BattleParticipant` with `participants` relation.

**Old test code**:
```typescript
await prisma.battle.create({
  data: {
    robot1Id: robot1.id,
    robot2Id: robot2.id,
    robot1DamageDealt: 50,
    robot2DamageDealt: 30,
  },
});
```

**New test code**:
```typescript
await prisma.battle.create({
  data: {
    // No robot1Id / robot2Id: Spec #43 dropped both columns. The participants ARE the
    // identity of the two sides, and `winningSide` records the outcome.
    participants: {
      create: [
        { robotId: robot1.id, team: 1, damageDealt: 50, credits: 1000, eloBefore: 1500, eloAfter: 1520, finalHP: 80 },
        { robotId: robot2.id, team: 2, damageDealt: 30, credits: 500, eloBefore: 1480, eloAfter: 1460, finalHP: 50 },
      ],
    },
  },
});
```

Prefer `createTestBattle` in `tests/testHelpers.ts` over an inline `battle.create`. Spec
#51 found removed Battle columns (`robot1Id`, `robot2Id`, `robot1ELOBefore`, `eloChange`)
still being passed at nine inline call sites across eight suites, every one of which threw
`PrismaClientValidationError` — including from the "new" example in this very file, which
carried `robot1Id` for as long as the columns had been gone. A shared helper is one place
to fix; nine inline literals are nine.

### Pass a listening server to supertest, not the app (Spec #51)

`request(app)` makes supertest stand up a **fresh ephemeral server for every call** and tear
it down again. In a suite that issues many requests — a property test multiplies its call
sites by `numRuns` — that churn produces failures that have nothing to do with the assertion:

- **HTTP 426**, a status nothing in this codebase sends, arriving where a 200 or 401 was
  expected.
- **`socket hang up`**.
- Occasionally an **indefinite hang**: `changelog.property` normally finishes in under 2s and
  was once observed sitting until Jest's 30s timeout fired, leaving a worker to be killed by
  hand.

Bind once per file and pass the server:

```typescript
let server: import('http').Server;

beforeAll(() => { server = app.listen(0); });
afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });

// then
await request(server).get('/api/thing');
```

Converted for this reason so far: `guide-routes`, `battleLogStreamingRevenue.property`,
`changelog.property`, `streamingStudioPrestigeRequirements.property` (~800 requests per run,
the worst offender), `weaponInventory`.

**Do not "fix" this by disabling HTTP keep-alive.** It looks like the right answer — Node 19+
defaults `http.globalAgent.keepAlive` to `true`, so a pooled socket can outlive the ephemeral
server it was opened against. Spec #51 tried exactly that, globally, and reverted it: with
pooling off, every request opens and closes its own connection, which took the machine to
**1,536 sockets in TIME_WAIT** and converted an intermittent 426 into ephemeral port
exhaustion. A full tier run stalled at 91 of 113 suites and left four stray workers. The
problem is the number of servers, not the pooling of sockets.

### Beware measuring a shared database from two runs at once

Spec #51 spent real time chasing "flakes" that were an artefact of its own measurement: two
full tier runs had been started in the background and overlapped on one database. The symptoms
look alarming and nothing like a race in the code under test — 32 `robots_user_id_fkey`
violations, 29 "No record was found for a delete", and 7
`(cycle_number, sequence_number)` collisions in a single run, spread across suites with
nothing in common.

The tell is breadth: a genuine flake hits one suite, and a concurrency artefact hits a dozen
unrelated ones with foreign-key and missing-row errors. Before diagnosing anything, check that
only one runner is live (`pgrep -f jest`), and prefer running tiers in the foreground one at a
time when measuring.

### Every `fc.float` and `fc.double` needs `noNaN: true`

fast-check generates `NaN` from a **bounded** `fc.float({ min, max })` unless told not to,
and `NaN` fails every comparison silently rather than loudly. This is the single most
likely cause of a property test that passes locally and fails on a different seed.

```typescript
// wrong — one run in three or so draws NaN
fc.float({ min: 1.52, max: 3.0 })
// right
fc.float({ min: 1.52, max: 3.0, noNaN: true, noDefaultInfinity: true })
```

Spec #51 traced an intermittent Integration_Tier failure to exactly this: a duration
multiplier drew `NaN`, `Math.floor(baseline * NaN)` produced a `NaN` duration, and the
degradation detector correctly reported nothing. Worse, the sibling property asserting the
detector returns `null` **passed on the same input for the wrong reason**, which is how the
generator survived so long. Physical quantities — durations, damage, percentages, scores —
cannot be `NaN`; say so in the arbitrary.

## Property-Based Testing

### When to Use
- Testing mathematical properties (commutative, associative)
- Testing invariants (balance should never be negative)
- Finding edge cases in complex logic
- Validating data transformations

### Example
```typescript
import fc from 'fast-check';

it('should always calculate positive damage', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 100 }), // weapon power
      fc.integer({ min: 1, max: 100 }), // armor
      (weaponPower, armor) => {
        const damage = calculateDamage(weaponPower, armor);
        expect(damage).toBeGreaterThanOrEqual(0);
      }
    )
  );
});
```

### Property Test Best Practices
- Define clear properties to test
- Use appropriate generators (fc.integer, fc.string, etc.)
- Set reasonable bounds on generated values
- Keep property tests fast (limit iterations if needed)

## CI/CD Testing

### GitHub Actions Pipeline
1. **Install dependencies**: `pnpm install --frozen-lockfile`
2. **Run linter**: `pnpm run lint`
3. **Run tests**: `pnpm test`
4. **Check coverage**: Coverage report generated
5. **Deploy**: Only if all tests pass

### Test Requirements for Deployment
- All tests must pass (or be explicitly skipped)
- No compilation errors
- Linter must pass
- Coverage should not decrease significantly

## Test Maintenance

### Regular Maintenance Tasks
- Update tests when features change
- Remove tests for deleted features
- Fix flaky tests (tests that randomly fail)
- Improve test isolation
- Update test data to match current schema

### Identifying Flaky Tests
- Tests that pass on retry
- Tests that fail only in CI/CD
- Tests that fail when run in parallel
- Tests with timing dependencies

### Fixing Flaky Tests
- Add proper cleanup in afterEach
- Use deterministic test data (avoid Date.now())
- Increase timeouts for slow operations
- Mock external dependencies
- Ensure proper test isolation

## Testing Checklist

### Before Committing Code
- [ ] Run tests locally: `pnpm test`
- [ ] All tests pass
- [ ] No compilation errors
- [ ] Added tests for new features (if requested)
- [ ] Updated tests for changed features
- [ ] Cleaned up test data properly

### When Adding New Features
- [ ] Identify critical paths to test
- [ ] Write unit tests for business logic
- [ ] Write integration tests for workflows
- [ ] Consider property tests for complex logic
- [ ] Test edge cases and error conditions

### When Fixing Bugs
- [ ] Write failing test that reproduces bug
- [ ] Fix the bug
- [ ] Verify test now passes
- [ ] Add additional tests for related edge cases

## Future Testing Improvements

### Short Term
- Fix parallel test conflicts (per-worker databases)
- Update business logic tests to match current implementation
- Remove or fix compilation failures
- Achieve 90%+ pass rate

### Medium Term
- ~~Add E2E tests with Playwright~~ ✅ Done — 11+ spec files, blocking CI gate
- Improve test coverage for critical paths
- Add performance benchmarks
- Implement visual regression testing

### Long Term
- Automated test generation
- Mutation testing
- Load testing
- Security testing automation

## Frontend Testing

### Framework
- **Runner**: Vitest 4 with jsdom environment
- **Component testing**: React Testing Library (`@testing-library/react`, `@testing-library/user-event`)
- **Assertions**: `@testing-library/jest-dom` matchers
- **Property testing**: fast-check
- **Coverage**: `@vitest/coverage-v8`

### Setup
- Config: `app/frontend/vitest.config.ts`
- Setup file: `app/frontend/src/setupTests.ts` (RTL cleanup, jest-dom matchers, matchMedia/localStorage/sessionStorage mocks)

### File Conventions
- Test files live in `__tests__/` subdirectories next to source files (not co-located)
- Naming: `*.test.ts` for utilities, `*.test.tsx` for components, `*.pbt.test.ts(x)` for property-based tests

### Coverage Targets
- **Utilities and stores**: 80% minimum
- **Components**: Baseline coverage (at least one test file per extracted directory)

### Running Frontend Tests
```bash
cd app/frontend
pnpm exec vitest --run                   # Single run (CI-safe)
pnpm exec vitest --run --coverage        # With coverage report
pnpm exec vitest                         # Watch mode (local dev)
```

### CI Integration
Already integrated in `.github/workflows/ci.yml` under the `frontend-tests` job, which runs `pnpm exec vitest --run --reporter=verbose`.

### Test File Locations
- Utility tests: `src/utils/__tests__/*.test.ts`
- Store tests: `src/stores/__tests__/*.test.ts`
- Component tests: `src/components/__tests__/*.test.tsx` and `src/components/{feature}/__tests__/*.test.tsx`
- Page tests: `src/pages/__tests__/*.test.tsx`
- Property-based tests: `*.pbt.test.ts(x)` or `*.property.test.ts(x)`

## Quick Reference

### Run Backend Tests
```bash
pnpm test                           # All tests
pnpm test -- tests/facility.test.ts # Specific file
pnpm test -- --watch                # Watch mode
pnpm test -- --maxWorkers=1         # Sequential (most stable)
pnpm test -- --coverage             # With coverage
```

### Debug Backend Tests
```bash
# Run with verbose output
pnpm test -- --verbose

# Run single test
pnpm test -- -t "should create facility"

# Debug in VS Code
# Add breakpoint, press F5 with Jest debug config
```

### Backend Test File Locations
- Unit tests: `app/backend/tests/*.test.ts`
- Property tests: `app/backend/tests/*.property.test.ts`
- Integration tests: `app/backend/tests/integration/*.test.ts`
- Test utilities: `app/backend/tests/helpers/`

### Run Frontend Tests
```bash
cd app/frontend
pnpm exec vitest --run                   # Single run
pnpm exec vitest --run --coverage        # With coverage
pnpm exec vitest                         # Watch mode
```

### Frontend Test File Locations
- Utility tests: `src/utils/__tests__/*.test.ts`
- Store tests: `src/stores/__tests__/*.test.ts`
- Component tests: `src/components/{feature}/__tests__/*.test.tsx`
- Page tests: `src/pages/__tests__/*.test.tsx`
