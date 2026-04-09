---
inclusion: fileMatch
fileMatchPattern: "**/tests/**,**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.property.test.ts,**/jest.config.*"
---

# Testing Strategy

## Current Test Status
- Pass rate: ~82% (900-910 of 1099 tests passing)
- Last updated: February 24, 2026
- Framework: Jest with TypeScript
- Property testing: fast-check library

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
1. Run full test suite: `npm test`
2. Verify all tests pass
3. Check coverage report: `npm test -- --coverage`
4. Ensure coverage meets minimum thresholds (80% general, 90% critical)
5. Fix any failing tests before committing

**Note**: Do not commit code without accompanying tests and verified test passage.

## Test Types

### Unit Tests (Required)
- Test individual functions and services in isolation
- Mock external dependencies (database, APIs)
- Fast execution (<1s per test)
- Located in `prototype/backend/tests/`
- **Coverage target**: 80% minimum

### Integration Tests (Required for Critical Paths)
- Test multiple components working together
- Use real database (test transactions)
- Slower execution (1-5s per test)
- Located in `prototype/backend/tests/integration/`
- **Coverage target**: 90% for critical functionality

### Property-Based Tests (Recommended)
- Test properties that should always hold true
- Generate random inputs with fast-check
- Find edge cases automatically
- Files named `*.property.test.ts`
- Use for complex algorithms and game mechanics

### E2E Tests (Future)
- Test complete user workflows
- Use Playwright
- Run in CI/CD pipeline before deployment
- Not yet implemented

## Running Tests

### Required: Run All Tests After Development
```bash
cd prototype/backend
npm test
```
**Must pass before committing code**

### Check Coverage (Required)
```bash
npm test -- --coverage
```
**Verify**: 80% minimum coverage, 90% for critical functionality

### Specific Test File (Development)
```bash
npm test -- tests/facility.test.ts
```

### Watch Mode (Local Development)
```bash
npm test -- --watch
```

### Sequential Execution (If Parallel Issues)
```bash
npm test -- --maxWorkers=1
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

**Workaround**: Run with `npm test -- --maxWorkers=1` for 100% reliability (slower)

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

### Cleaning Up Test Data
```typescript
afterEach(async () => {
  // Delete in reverse order of foreign key dependencies
  await prisma.battle.deleteMany({ where: { robot1Id: testRobot.id } });
  await prisma.robot.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
});
```

## Schema Changes and Tests

### When Schema Changes
1. Update Prisma schema
2. Create migration: `npx prisma migrate dev`
3. Update affected test files
4. Run tests to verify: `npm test`

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
    robot1Id: robot1.id,
    robot2Id: robot2.id,
    participants: {
      create: [
        { robotId: robot1.id, team: 1, damageDealt: 50, credits: 1000, eloBefore: 1500, eloAfter: 1520, finalHP: 80 },
        { robotId: robot2.id, team: 2, damageDealt: 30, credits: 500, eloBefore: 1480, eloAfter: 1460, finalHP: 50 },
      ],
    },
  },
});
```

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
1. **Install dependencies**: `npm ci`
2. **Run linter**: `npm run lint`
3. **Run tests**: `npm test`
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
- [ ] Run tests locally: `npm test`
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
- Add E2E tests with Playwright
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
- Config: `prototype/frontend/vitest.config.ts`
- Setup file: `prototype/frontend/src/setupTests.ts` (RTL cleanup, jest-dom matchers, matchMedia/localStorage/sessionStorage mocks)

### File Conventions
- Test files live in `__tests__/` subdirectories next to source files (not co-located)
- Naming: `*.test.ts` for utilities, `*.test.tsx` for components, `*.pbt.test.ts(x)` for property-based tests

### Coverage Targets
- **Utilities and stores**: 80% minimum
- **Components**: Baseline coverage (at least one test file per extracted directory)

### Running Frontend Tests
```bash
cd prototype/frontend
npx vitest --run                   # Single run (CI-safe)
npx vitest --run --coverage        # With coverage report
npx vitest                         # Watch mode (local dev)
```

### CI Integration
Already integrated in `.github/workflows/ci.yml` under the `frontend-tests` job, which runs `npx vitest --run --reporter=verbose`.

### Test File Locations
- Utility tests: `src/utils/__tests__/*.test.ts`
- Store tests: `src/stores/__tests__/*.test.ts`
- Component tests: `src/components/__tests__/*.test.tsx` and `src/components/{feature}/__tests__/*.test.tsx`
- Page tests: `src/pages/__tests__/*.test.tsx`
- Property-based tests: `*.pbt.test.ts(x)` or `*.property.test.ts(x)`

## Quick Reference

### Run Backend Tests
```bash
npm test                           # All tests
npm test -- tests/facility.test.ts # Specific file
npm test -- --watch                # Watch mode
npm test -- --maxWorkers=1         # Sequential (most stable)
npm test -- --coverage             # With coverage
```

### Debug Backend Tests
```bash
# Run with verbose output
npm test -- --verbose

# Run single test
npm test -- -t "should create facility"

# Debug in VS Code
# Add breakpoint, press F5 with Jest debug config
```

### Backend Test File Locations
- Unit tests: `prototype/backend/tests/*.test.ts`
- Property tests: `prototype/backend/tests/*.property.test.ts`
- Integration tests: `prototype/backend/tests/integration/*.test.ts`
- Test utilities: `prototype/backend/tests/helpers/`

### Run Frontend Tests
```bash
cd prototype/frontend
npx vitest --run                   # Single run
npx vitest --run --coverage        # With coverage
npx vitest                         # Watch mode
```

### Frontend Test File Locations
- Utility tests: `src/utils/__tests__/*.test.ts`
- Store tests: `src/stores/__tests__/*.test.ts`
- Component tests: `src/components/{feature}/__tests__/*.test.tsx`
- Page tests: `src/pages/__tests__/*.test.tsx`
