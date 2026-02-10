# Test Failure Analysis & Fix Plan

## Executive Summary

**Current State**: 254/313 tests passing (81.2%)  
**Target**: 305+/313 tests passing (97%+)  
**Issue**: 54 of 68 newly added tests are failing due to poor test isolation  
**Root Cause**: Tests depend on seeded database state instead of creating their own data  
**Solution**: Update each test file to create and clean up its own test data  
**Estimated Fix Time**: ~2.5 hours

---

## The Problem

When adding integration tests for 8 routes (68 tests total), I used this pattern:

```typescript
beforeAll(async () => {
  testUser = await prisma.user.findFirst({
    where: { username: 'player1' },
  });
  if (!testUser) {
    throw new Error('Test user player1 not found');
  }
});
```

This causes tests to:
- ✅ Pass when run as part of full suite (database is seeded early)
- ❌ Fail when run individually (no guaranteed database state)
- ❌ Have poor isolation (depend on external state)
- ❌ Be fragile (breaks if seed changes)

---

## Detailed Failure Breakdown

### Category 1: My New Route Tests (45 failures)

#### 1. finances.test.ts (15 failures)
**Tests**:
- GET /api/finances/daily (2 tests: with/without auth)
- GET /api/finances/summary (2 tests: with/without auth)
- GET /api/finances/operating-costs (2 tests: with/without auth)
- GET /api/finances/revenue-streams (2 tests: with/without auth)
- GET /api/finances/projections (2 tests: with/without auth)
- GET /api/finances/per-robot (2 tests: with/without auth)
- POST /api/finances/roi-calculator (3 tests: validation, calculation, auth)

**Root Cause**: All fail in `beforeAll()` looking for player1 user

**Fix**:
```typescript
beforeAll(async () => {
  // Create test user
  const hashedPassword = await bcrypt.hash('test123', 10);
  testUser = await prisma.user.create({
    data: {
      username: `test_finances_${Date.now()}`,
      password: hashedPassword,
      credits: 1000000,
    },
  });
  
  // Create test robot
  testRobot = await prisma.robot.create({
    data: {
      name: 'Test Robot',
      userId: testUser.id,
      // ... attributes
    },
  });
  
  authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET);
});

afterAll(async () => {
  await prisma.robot.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
});
```

**Estimated Time**: 30 minutes

---

#### 2. facility.test.ts (7 failures)
**Tests**:
- GET /api/facility (3 tests: with auth, without auth, invalid token)
- POST /api/facility/upgrade (4 tests: validation, invalid type, max level, auth)

**Root Cause**: Same as finances - no test user

**Fix**: Similar to finances but also create initial facility

```typescript
beforeAll(async () => {
  testUser = await prisma.user.create({...});
  
  // Create initial facility
  testFacility = await prisma.facility.create({
    data: {
      userId: testUser.id,
      facilityType: 'repair_bay',
      level: 1,
    },
  });
  
  authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET);
});

afterAll(async () => {
  await prisma.facility.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
});
```

**Estimated Time**: 20 minutes

---

#### 3. weaponInventory.test.ts (10 failures)
**Tests**:
- GET /api/weapon-inventory (2 tests)
- POST /api/weapon-inventory/purchase (4 tests: validation, invalid IDs, auth)
- GET /api/weapon-inventory/storage-status (2 tests)
- GET /api/weapon-inventory/:id/available (2 tests)

**Root Cause**: No test user, also needs weapon and inventory items

**Fix**:
```typescript
beforeAll(async () => {
  testUser = await prisma.user.create({...});
  
  // Create test weapon
  testWeapon = await prisma.weapon.create({
    data: {
      name: 'Test Weapon',
      cost: 10000,
      baseDamage: 10,
      cooldown: 3,
      weaponType: 'ballistic',
      handsRequired: 'one',
      damageType: 'ballistic',
      loadoutType: 'single',
    },
  });
  
  // Create inventory item
  testInventory = await prisma.weaponInventory.create({
    data: {
      userId: testUser.id,
      weaponId: testWeapon.id,
      purchasePrice: 10000,
    },
  });
  
  authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET);
});

afterAll(async () => {
  await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
  await prisma.weapon.delete({ where: { id: testWeapon.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
});
```

**Estimated Time**: 30 minutes

---

#### 4. matches.test.ts (8 failures)
**Tests**:
- GET /api/matches/upcoming (3 tests)
- GET /api/matches/history (4 tests: basic, pagination, filtering, auth)
- GET /api/matches/battles/:id/log (3 tests)

**Root Cause**: No test user, needs robots and battles

**Fix**:
```typescript
beforeAll(async () => {
  testUser = await prisma.user.create({...});
  
  testRobot1 = await prisma.robot.create({
    data: { userId: testUser.id, name: 'Robot 1', ... },
  });
  
  testRobot2 = await prisma.robot.create({
    data: { userId: testUser.id, name: 'Robot 2', ... },
  });
  
  // Create test battle
  testBattle = await prisma.battle.create({
    data: {
      robot1Id: testRobot1.id,
      robot2Id: testRobot2.id,
      winnerId: testRobot1.id,
      log: [],
    },
  });
  
  authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET);
});

afterAll(async () => {
  await prisma.battle.deleteMany({
    where: {
      OR: [
        { robot1Id: { in: [testRobot1.id, testRobot2.id] } },
        { robot2Id: { in: [testRobot1.id, testRobot2.id] } },
      ],
    },
  });
  await prisma.robot.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
});
```

**Estimated Time**: 25 minutes

---

#### 5. leagues.test.ts (5 failures)
**Tests**:
- GET /api/leagues/:tier/standings (4 tests: bronze, silver, invalid, pagination)
- GET /api/leagues/:tier/instances (2 tests: bronze, invalid)

**Root Cause**: No test user (but leagues might not need auth?)

**Fix**: Check if these endpoints actually require auth. If not, they might be passing. If yes:
```typescript
beforeAll(async () => {
  testUser = await prisma.user.create({...});
  authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET);
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: testUser.id } });
});
```

**Estimated Time**: 20 minutes

---

#### 6. weapons.test.ts (0 failures?)
**Tests**:
- GET /api/weapons (4 tests)

**Status**: Might actually be passing now - need to verify

**Estimated Time**: 15 minutes to verify/fix if needed

---

### Category 2: Existing Test Issues (14 failures)

#### 7. integration.test.ts (2 failures)
**Tests**:
- should execute complete daily cycle successfully
- should maintain data consistency after cycle

**Root Cause**: Complex integration test that runs full cycle. Failures might be:
- Timing issues
- Missing dependencies in cycle execution
- Data state issues

**Fix**: Need to investigate specific failure messages

**Estimated Time**: 20 minutes

---

#### 8. trainingAcademyCaps.test.ts (5 failures)
**Tests**:
- should allow upgrading to level 10 without academy
- should allow upgrading to level 15 with academy level 1
- should allow upgrading to level 50 with academy level 10

**Root Cause**: Likely calculation or validation logic mismatch

**Fix**: Check actual vs expected values, update test expectations if formula changed

**Estimated Time**: 15 minutes

---

#### 9. stanceAndYield.test.ts (3 failures)
**Tests**:
- should apply stance modifiers after loadout modifiers

**Root Cause**: Rounding/calculation precision mismatch

**Example Error**:
```
Expected: 28.75
Received: 25.3
```

**Fix**: Either:
- Update calculation to match expected
- Update expected to match actual calculation
- Verify which is correct per game design

**Estimated Time**: 10 minutes

---

#### 10. robotCalculations.test.ts (4 failures)
**Tests**:
- should apply loadout bonuses correctly for weapon_shield

**Root Cause**: Calculation precision or formula mismatch

**Example Error**:
```
Expected: 8
Received: 8.5
```

**Fix**: Similar to stance tests - verify formula and update accordingly

**Estimated Time**: 10 minutes

---

## Total Estimated Time

| Category | Files | Tests | Time |
|----------|-------|-------|------|
| finances | 1 | 15 | 30 min |
| facility | 1 | 7 | 20 min |
| weaponInventory | 1 | 10 | 30 min |
| matches | 1 | 8 | 25 min |
| leagues | 1 | 5 | 20 min |
| weapons | 1 | 0-4 | 15 min |
| integration | 1 | 2 | 20 min |
| trainingAcademyCaps | 1 | 5 | 15 min |
| stanceAndYield | 1 | 3 | 10 min |
| robotCalculations | 1 | 4 | 10 min |
| **TOTAL** | **10** | **59** | **~3 hours** |

---

## Implementation Priority

### Phase 1: Fix My New Tests (2 hours)
1. finances.test.ts (30 min) - 15 tests
2. weaponInventory.test.ts (30 min) - 10 tests
3. matches.test.ts (25 min) - 8 tests
4. facility.test.ts (20 min) - 7 tests
5. leagues.test.ts (20 min) - 5 tests
6. weapons.test.ts (15 min) - 0-4 tests

**Result**: 45-49 tests fixed, pass rate: ~95%

### Phase 2: Fix Existing Tests (1 hour)
7. integration.test.ts (20 min) - 2 tests
8. trainingAcademyCaps.test.ts (15 min) - 5 tests
9. stanceAndYield.test.ts (10 min) - 3 tests
10. robotCalculations.test.ts (10 min) - 4 tests

**Result**: All 59 tests fixed, pass rate: 97%+

---

## The Correct Pattern

### Before (Bad):
```typescript
describe('My Routes', () => {
  let testUser: any;
  
  beforeAll(async () => {
    // PROBLEM: Assumes external state exists
    testUser = await prisma.user.findFirst({
      where: { username: 'player1' },
    });
    if (!testUser) {
      throw new Error('Test user not found');
    }
  });
  
  // Tests depend on finding this user
});
```

### After (Good):
```typescript
describe('My Routes', () => {
  let testUser: any;
  let testData: any[] = [];
  
  beforeAll(async () => {
    // CREATE: Own test data
    testUser = await prisma.user.create({
      data: {
        username: `test_${Date.now()}`,
        password: await bcrypt.hash('test123', 10),
        credits: 1000000,
      },
    });
    
    // Create any other needed data
    // ... testRobot, testFacility, etc.
    
    authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET);
  });
  
  afterAll(async () => {
    // CLEANUP: Remove test data
    await prisma.robot.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });
  
  // Tests are now isolated and independent
});
```

---

## Success Criteria

After all fixes:
- ✅ All 313 tests pass individually
- ✅ All 313 tests pass as a suite
- ✅ Pass rate: 305+/313 (97%+)
- ✅ Each test file can run standalone
- ✅ Tests don't depend on seed data
- ✅ Tests clean up after themselves

---

## Lessons Learned

1. **Always test individually**: Run each test file standalone
2. **Create, don't find**: Tests should create their own data
3. **Clean up**: Always remove test data in `afterAll()`
4. **Independent tests**: Each test should work in isolation
5. **Don't rely on seeds**: Seeds are for development, not tests
6. **Run before committing**: Verify all tests pass before pushing

---

## Next Steps

1. Start with Phase 1 (my new tests)
2. Fix one file at a time
3. Verify each file passes standalone: `npm test -- filename.test.ts`
4. Verify full suite still passes: `npm test`
5. Move to Phase 2 (existing tests)
6. Final verification
7. Document success

---

**Status**: Analysis complete, ready to implement fixes  
**ETA**: ~3 hours to 97%+ pass rate  
**Commitment**: All tests will be properly isolated and independent
