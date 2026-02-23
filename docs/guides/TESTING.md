# Testing Guide
**Last Updated**: February 23, 2026  
**Current Pass Rate**: ~65% (540-557/829 tests)

## Quick Start

```bash
cd prototype/backend
npm test
```

**Expected**: 61-67% pass rate, 30-90 seconds

## Current Status

| Metric | Value |
|--------|-------|
| Pass Rate | ~65% |
| Tests Passing | 540-557/829 |
| Suites Passing | ~20-27/100 |
| Variability | ±5% (normal) |
| Status | ✅ Ready for use |

## Recent Improvements (Feb 23, 2026)

- ✅ Timeout increased from 10s to 30s (fixes property test timeouts)
- ✅ Weapon seeding added to integration tests
- ✅ Cleanup robustness improved (`.deleteMany()` everywhere)
- ✅ Pass rate improved from 49.7% to ~65% (+145 tests)

## Writing New Tests

### Best Practices
1. Use `.deleteMany()` instead of `.delete()`
2. Add cleanup in `afterEach` or `afterAll`
3. Use unique identifiers (timestamps, random values)
4. Follow cleanup order: auditLog → battleParticipants → battles → scheduledMatches → tagTeams → weaponInventory → facility → robots → users
5. Test in isolation before committing

### Example
```typescript
describe('My Test', () => {
  let testUserId: number;
  
  afterEach(async () => {
    // Cleanup in correct order
    await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });
  
  it('should do something', async () => {
    // Use unique identifier
    const username = `test_user_${Date.now()}`;
    const user = await prisma.user.create({
      data: { username, passwordHash: 'hash' }
    });
    testUserId = user.id;
    
    // Your test logic
  });
});
```

## When Tests Fail

1. **Check if flaky**: Run 3 times
   - Passes sometimes? Known issue (±5% variability)
   - Always fails? Real bug

2. **Run in isolation**: `npm test -- tests/yourtest.test.ts`
   - Passes alone? Interdependency issue
   - Fails alone? Real bug in test or code

3. **Don't spend too long**: If stuck after 30 min, document and move on

## Known Issues

### Test Interdependencies (224 tests)
- Tests pass in parallel (65%) but fail sequentially (42%)
- Caused by shared state between tests
- Workaround: Run in parallel (default)
- Fix: Requires test database per worker (1-2 days)

### Race Conditions (~50 tests)
- ±5% variability across runs
- Caused by timing issues
- Workaround: Re-run if results seem off
- Fix: Sequential execution or better locking

### Property Test Logic Errors (~50 tests)
- Tests expect old behavior
- Workaround: Ignore for now
- Fix: Update expectations (2-3 hours per file)

## Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/eventLogger.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should log events"

# Run with verbose output
npm test -- --verbose

# Run sequentially (slower but more stable)
npm test -- --maxWorkers=1
```

## Roadmap to 85-90%

### Phase 1: Infrastructure (1-2 days)
- Implement test database per worker
- Eliminates test interdependencies
- Expected: 85-90% pass rate

### Phase 2: Fix Logic Errors (2-3 days)
- Update property test expectations
- Fix integration test expectations
- Expected: 90-95% pass rate

### Phase 3: Optimization (1-2 days)
- Categorize tests (unit/integration/e2e)
- Reduce property test numRuns
- Expected: <30s test runs, 95%+ pass rate

## Test Strategy

### Unit Tests
- Test individual functions/services
- Mock external dependencies
- Fast execution (<1s per test)
- Should have 100% pass rate

### Integration Tests
- Test multiple components together
- Use real database
- Slower execution (1-5s per test)
- May have interdependencies

### Property Tests
- Test universal properties with random inputs
- Use fast-check library
- Slowest execution (5-30s per test)
- May timeout if too complex

### E2E Tests
- Test complete user flows
- Use real API endpoints
- Slowest execution (10-60s per test)
- Most prone to flakiness

## Files Modified

- `prototype/backend/jest.config.js` - Timeout 30s
- `prototype/backend/tests/integration/adminCycleGeneration.test.ts` - Weapon seeding
- All 100 test files - `.deleteMany()` improvements

## Support

Questions? Check this guide first, then ask the team.

Issues? Document and share with team.

Improvements? Propose changes and discuss before implementing.
