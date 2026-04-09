/**
 * Property-Based Test for Income Generator No Longer Providing Streaming Revenue
 * Property 18: Income Generator No Longer Provides Streaming Revenue
 * 
 * **Validates: Requirements 13.1-13.8**
 * 
 * For any stable with an Income Generator facility, the daily passive income 
 * calculation should only include merchandising income and should not include 
 * any streaming revenue component.
 */

import fc from 'fast-check';
import prisma from '../src/lib/prisma';
import { calculateDailyPassiveIncome } from '../src/utils/economyCalculations';


describe('Property 18: Income Generator No Longer Provides Streaming Revenue', () => {
  let testUserId: number;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create a test user for all tests
    const user = await prisma.user.create({
      data: {
        username: `test_user_prop18_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 1000000,
        prestige: 0,
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up facilities after each test
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  /**
   * Property 18: For any stable with an Income Generator facility at any level,
   * the daily passive income should ONLY include merchandising income and should
   * NOT include any streaming revenue component.
   */
  test('Property 18: Income Generator provides only merchandising, no streaming', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),    // Income Generator level (1-10)
        fc.integer({ min: 0, max: 100000 }), // User prestige
        async (incomeGeneratorLevel, prestige) => {
          // Clean up facility first to ensure clean state
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'merchandising_hub',
            },
          });

          // Update user prestige
          await prisma.user.update({
            where: { id: testUserId },
            data: { prestige },
          });

          // Create Income Generator facility at specified level
          await prisma.facility.create({
            data: {
              userId: testUserId,
              facilityType: 'merchandising_hub',
              level: incomeGeneratorLevel,
            },
          });

          // Calculate daily passive income
          const result = await calculateDailyPassiveIncome(testUserId);

          // Property: Result should not be null
          expect(result).not.toBeNull();
          expect(result).toBeDefined();

          // Property: Result should have merchandising and total fields
          expect(result).toHaveProperty('merchandising');
          expect(result).toHaveProperty('total');

          // Property: Merchandising should be greater than 0 for level 1+
          expect(result.merchandising).toBeGreaterThan(0);

          // Property: Result should NOT have a streaming field
          // (The old system had a streaming field, the new system should not)
          expect(result).not.toHaveProperty('streaming');

          // Property: Total should equal merchandising only (no streaming component)
          // This is the KEY property being tested
          expect(result.total).toBe(result.merchandising);

          // Property: Total should NOT be greater than merchandising
          // (which would indicate streaming revenue is being added)
          expect(result.total).not.toBeGreaterThan(result.merchandising);

          // Property: Merchandising should scale with prestige
          // Base rates by level (from facilities.ts merchandising_hub):
          const baseRates: { [key: number]: number } = {
            1: 5000, 2: 10000, 3: 15000, 4: 20000, 5: 25000,
            6: 30000, 7: 35000, 8: 40000, 9: 45000, 10: 50000,
          };
          const expectedBaseRate = baseRates[incomeGeneratorLevel];
          const expectedPrestigeMultiplier = 1 + (prestige / 10000);
          const expectedMerchandising = Math.round(expectedBaseRate * expectedPrestigeMultiplier);

          // Property: Merchandising should match the expected formula
          expect(result.merchandising).toBe(expectedMerchandising);

          // Property: Total should match merchandising (no additional revenue)
          expect(result.total).toBe(expectedMerchandising);
        }
      ),
      { numRuns: 25 }
    );
  }, 30000); // Increase timeout to 30 seconds

  /**
   * Property 18.1: Edge case - Income Generator Level 0 (not purchased)
   * Should return zero income (no merchandising, no streaming)
   */
  test('Property 18.1: No Income Generator means no passive income', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100000 }), // User prestige
        async (prestige) => {
          // Ensure no Income Generator facility exists
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'merchandising_hub',
            },
          });

          // Also ensure no Streaming Studio exists (shouldn't affect passive income anyway)
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Update user prestige
          await prisma.user.update({
            where: { id: testUserId },
            data: { prestige },
          });

          // Calculate daily passive income
          const result = await calculateDailyPassiveIncome(testUserId);

          // Property: Result should not be null
          expect(result).not.toBeNull();

          // Property: Merchandising should be 0 (no Income Generator)
          expect(result.merchandising).toBe(0);

          // Property: Total should be 0 (no Income Generator)
          expect(result.total).toBe(0);

          // Property: Result should NOT have a streaming field
          expect(result).not.toHaveProperty('streaming');
        }
      ),
      { numRuns: 20 }
    );
  }, 15000); // Increase timeout

  /**
   * Property 18.2: Passive income should be independent of robot stats
   * (Streaming revenue was based on robot battles/fame, merchandising is not)
   */
  test('Property 18.2: Passive income is independent of robot stats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),    // Income Generator level
        fc.integer({ min: 0, max: 50000 }), // User prestige (same for both)
        async (incomeGeneratorLevel, prestige) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'merchandising_hub',
            },
          });

          // Update user prestige
          await prisma.user.update({
            where: { id: testUserId },
            data: { prestige },
          });

          // Create Income Generator facility
          await prisma.facility.create({
            data: {
              userId: testUserId,
              facilityType: 'merchandising_hub',
              level: incomeGeneratorLevel,
            },
          });

          // Calculate passive income (no robots needed)
          const result = await calculateDailyPassiveIncome(testUserId);

          // Property: Passive income should be calculated without needing robot data
          // (The old streaming system required robot battles/fame, the new system doesn't)
          expect(result).not.toBeNull();
          expect(result.merchandising).toBeGreaterThan(0);
          expect(result.total).toBe(result.merchandising);

          // Property: Result should NOT have a streaming field
          expect(result).not.toHaveProperty('streaming');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 18.3: Merchandising income scales only with prestige, not battles/fame
   * (Streaming revenue scaled with battles and fame, merchandising does not)
   */
  test('Property 18.3: Merchandising scales with prestige only', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),     // Income Generator level (same)
        fc.integer({ min: 0, max: 25000 }),  // Prestige 1
        fc.integer({ min: 1, max: 25000 }),  // Prestige increase
        async (incomeGeneratorLevel, prestige1, prestigeIncrease) => {
          const prestige2 = prestige1 + prestigeIncrease;

          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'merchandising_hub',
            },
          });

          // Create Income Generator facility
          await prisma.facility.create({
            data: {
              userId: testUserId,
              facilityType: 'merchandising_hub',
              level: incomeGeneratorLevel,
            },
          });

          // Calculate income at prestige1
          await prisma.user.update({
            where: { id: testUserId },
            data: { prestige: prestige1 },
          });
          const result1 = await calculateDailyPassiveIncome(testUserId);

          // Calculate income at prestige2 (higher)
          await prisma.user.update({
            where: { id: testUserId },
            data: { prestige: prestige2 },
          });
          const result2 = await calculateDailyPassiveIncome(testUserId);

          // Property: Higher prestige should result in higher or equal income
          expect(result2.merchandising).toBeGreaterThanOrEqual(result1.merchandising);
          expect(result2.total).toBeGreaterThanOrEqual(result1.total);

          // Property: Total should always equal merchandising (no streaming)
          expect(result1.total).toBe(result1.merchandising);
          expect(result2.total).toBe(result2.merchandising);

          // Property: Results should NOT have a streaming field
          expect(result1).not.toHaveProperty('streaming');
          expect(result2).not.toHaveProperty('streaming');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 18.4: All Income Generator levels provide only merchandising
   * (Verify that no level provides streaming revenue)
   */
  test('Property 18.4: All Income Generator levels provide only merchandising', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 50000 }), // User prestige
        async (prestige) => {
          // Update user prestige
          await prisma.user.update({
            where: { id: testUserId },
            data: { prestige },
          });

          // Test all Income Generator levels (1-10)
          for (let level = 1; level <= 10; level++) {
            // Clean up facility first
            await prisma.facility.deleteMany({
              where: {
                userId: testUserId,
                facilityType: 'merchandising_hub',
              },
            });

            // Create Income Generator at this level
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'merchandising_hub',
                level,
              },
            });

            // Calculate passive income
            const result = await calculateDailyPassiveIncome(testUserId);

            // Property: Result should not be null
            expect(result).not.toBeNull();

            // Property: Merchandising should be greater than 0
            expect(result.merchandising).toBeGreaterThan(0);

            // Property: Total should equal merchandising (no streaming)
            expect(result.total).toBe(result.merchandising);

            // Property: Result should NOT have a streaming field
            expect(result).not.toHaveProperty('streaming');
          }
        }
      ),
      { numRuns: 20 } // Fewer runs since we test all 10 levels in each iteration
    );
  }, 30000); // Increase timeout to 30 seconds for this test
});
