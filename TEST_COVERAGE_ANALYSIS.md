# Test Coverage Analysis & Recommendations

## Current Status
- **Overall Coverage**: 40.44% (Target: 80%)
- **Tests Passing**: 187/192 (97.4%)
- **Test Suites**: 13/18 passing

## Coverage by Category

### ✅ Well Covered (>80%)
- `src/middleware/auth.ts`: 100%
- `src/utils/storageCalculations.ts`: 100%
- `src/utils/weaponValidation.ts`: 95%
- `src/services/leagueInstanceService.ts`: 100%
- `src/services/battleOrchestrator.ts`: 85%
- `src/services/leagueRebalancingService.ts`: 85%
- `src/services/matchmakingService.ts`: 85%
- `src/routes/auth.ts`: 84%

### ⚠️ Needs More Tests (40-80%)
- `src/services/combatMessageGenerator.ts`: 78%
- `src/services/combatSimulator.ts`: 74%
- `src/config/facilities.ts`: 36%
- `src/routes/admin.ts`: 32%
- `src/routes/robots.ts`: 34%

### 🔴 Critical - Needs Tests (0-40%)
- **Routes (0% coverage)**:
  - `facility.ts`: 0%
  - `finances.ts`: 0%
  - `leaderboards.ts`: 0%
  - `leagues.ts`: 0%
  - `matches.ts`: 0%
  - `records.ts`: 0%
  - `weaponInventory.ts`: 0%
  - `weapons.ts`: 0%
  - `adminTournaments.ts`: 16%
  - `user.ts`: 28%

- **Services (10-11% coverage)**:
  - `tournamentBattleOrchestrator.ts`: 11%
  - `tournamentService.ts`: 11%

- **Utils (0-30% coverage)**:
  - `weaponCalculations.ts`: 0%
  - `userGeneration.ts`: 16%
  - `tournamentRewards.ts`: 18%
  - `robotCalculations.ts`: 19%
  - `economyCalculations.ts`: 28%

## Recommended Testing Strategy

### Phase 1: Quick Wins (Get to 60%)
Add integration tests for the 0% coverage routes:

```typescript
// Example: tests/routes/facility.test.ts
describe('Facility Routes', () => {
  it('should get user facilities', async () => {
    const response = await request(app)
      .get('/api/facility')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(200);
  });
  
  it('should upgrade facility', async () => {
    const response = await request(app)
      .post('/api/facility/upgrade')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ facilityType: 'roster_expansion' });
    expect(response.status).toBe(200);
  });
});
```

Priority order:
1. `facility.ts` - 122 lines
2. `weaponInventory.ts` - 237 lines
3. `finances.ts` - 299 lines
4. `leagues.ts` - 139 lines
5. `matches.ts` - 422 lines

### Phase 2: Improve Existing (Get to 70%)
Add more tests to partially covered files:

- `robots.ts`: Add tests for weapon equipping, repair, stats
- `admin.ts`: Add tests for admin operations
- `user.ts`: Add tests for user profile operations

### Phase 3: Utility Functions (Get to 80%)
Add unit tests for utility functions:

```typescript
// Example: tests/utils/weaponCalculations.test.ts
describe('Weapon Calculations', () => {
  it('should calculate weapon damage correctly', () => {
    const damage = calculateWeaponDamage({...});
    expect(damage).toBe(expectedValue);
  });
});
```

Priority:
1. `weaponCalculations.ts` - 0%
2. `robotCalculations.ts` - 19%
3. `economyCalculations.ts` - 28%
4. `tournamentRewards.ts` - 18%

### Phase 4: Tournament System (Get to 85%+)
Add comprehensive tests for tournament system:

- `tournamentService.ts`
- `tournamentBattleOrchestrator.ts`
- `adminTournaments.ts`

## Estimated Effort

- **Phase 1** (60%): ~4-6 hours - Add 8 route test files
- **Phase 2** (70%): ~2-3 hours - Expand existing tests
- **Phase 3** (80%): ~3-4 hours - Add 5 utility test files
- **Phase 4** (85%+): ~4-5 hours - Tournament system tests

**Total**: 13-18 hours to reach 80%+ coverage

## Test Template

Create new test files using this structure:

```typescript
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from './testApp';

const prisma = new PrismaClient();

describe('ComponentName', () => {
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    // Setup
    testUser = await prisma.user.findFirst({ where: { username: 'player1' } });
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should test main functionality', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('expectedField');
  });
});
```

## Next Steps

1. Fix remaining 5 test failures in Robot mocks
2. Create Phase 1 tests for 0% coverage routes
3. Run coverage report after each phase
4. Iterate until 80% coverage achieved

## Notes

- Integration tests are fastest way to increase route coverage
- Unit tests provide better isolation for utilities
- Tournament system is complex but lower priority
- Focus on user-facing features first (facility, finances, etc.)
