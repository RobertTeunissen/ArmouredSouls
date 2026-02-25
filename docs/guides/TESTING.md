# Testing Guide
**Last Updated**: February 24, 2026  
**Current Pass Rate**: ~82% (900-910/1099 tests)

## Quick Start

```bash
cd prototype/backend
npm test
```

**Expected**: ~82% pass rate, ~150-160 seconds with maxWorkers=2

## Current Status

| Metric | Value |
|--------|-------|
| Pass Rate | ~82% |
| Tests Passing | ~900-910/1099 |
| Suites Passing | 57-65/100 |
| Variability | ±2-3% between runs |
| Status | 🟡 Actively improving |

## Recent Improvements (Feb 24, 2026)

- ✅ Database connection singleton pattern (72 files updated)
- ✅ Battle → BattleParticipant schema migration fixes (8 test files)
- ✅ Robot mock fields updated (tag team fields + imageUrl)
- ✅ Test isolation fixes (matchmaking, tagTeams, facilityROI)
- ✅ Formula/expectation corrections (training costs, combat power, attack speed)
- ✅ Compilation fixes (profileApiResponse, tagTeamBattleLogCompleteness, userGeneration)
- ✅ Jest maxWorkers reduced to 2 for stability

## Writing New Tests

### Best Practices
1. Import shared prisma: `import prisma from '../src/lib/prisma'`
2. Use unique identifiers: `\`test_${Date.now()}_${Math.random().toString(36).substring(7)}\``
3. Create BattleParticipants with required fields: `team`, `credits`, `eloBefore`, `eloAfter`, `finalHP`
4. Scope cleanup to test data (never `deleteMany({})` without a where clause)
5. Cleanup order: auditLog → battleParticipants → battles → scheduledMatches → tagTeams → weaponInventory → facility → robots → users

### Battle Creation Pattern
```typescript
await prisma.battle.create({
  data: {
    robot1: { connect: { id: robot1.id } },
    robot2: { connect: { id: robot2.id } },
    winnerId: robot1.id,
    robot1ELOBefore: 1200,
    robot1ELOAfter: 1220,
    robot2ELOBefore: 1200,
    robot2ELOAfter: 1180,
    eloChange: 20,
    winnerReward: 500,
    loserReward: 100,
    battleLog: {},
    durationSeconds: 60,
    battleType: 'league',
    leagueType: 'bronze',
    participants: {
      create: [
        { robotId: robot1.id, team: 1, credits: 500, eloBefore: 1200, eloAfter: 1220, finalHP: 50 },
        { robotId: robot2.id, team: 2, credits: 100, eloBefore: 1200, eloAfter: 1180, finalHP: 0 },
      ],
    },
  },
});
```

## When Tests Fail

1. **Run in isolation first**: `npm test -- tests/yourtest.test.ts`
   - Passes alone but fails in suite? Parallel conflict (known issue)
   - Fails alone? Real bug

2. **Check for old Battle fields**: If you see `robot1DamageDealt`, `userId` on Battle, etc. — these moved to BattleParticipant

3. **Check Robot mock fields**: Ensure `totalTagTeamBattles`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws`, `timesTaggedIn`, `timesTaggedOut`, `imageUrl` are included

## Known Issues

### Parallel Test Conflicts (~100+ tests)
- Tests pass individually but fail together due to shared DB state
- ±2-3% variability between runs
- Fix: per-worker database isolation (planned)

### Missing Modules (~3 suites)
- `trendAnalysisService` - module doesn't exist
- `migrateBattlesToEvents` - script doesn't exist
- These tests can't pass until the modules are implemented

## Commands

```bash
# Run all tests
npm test

# Run specific test
npm test -- tests/eventLogger.test.ts

# Run with pattern match
npm test -- --testNamePattern="should log events"

# Run sequentially (most stable, slower)
npm test -- --maxWorkers=1

# Run with verbose output
npm test -- --verbose
```

## Roadmap to 90%+

### Phase 1: Parallel Isolation (1-2 days)
- Implement per-worker test database
- Expected: 88-92% pass rate

### Phase 2: Logic Fixes (2-3 days)
- Update league/rebalancing test expectations
- Fix analytics route tests
- Expected: 92-95% pass rate

### Phase 3: Cleanup (1 day)
- Remove tests for missing modules
- Fix remaining compilation errors
- Expected: 95%+ pass rate
