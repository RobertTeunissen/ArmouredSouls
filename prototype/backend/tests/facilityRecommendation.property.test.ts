import prisma from '../src/lib/prisma';
import fc from 'fast-check';
import { facilityRecommendationService } from '../src/services/facilityRecommendationService';
import { createTestUser, createTestRobot } from './testHelpers';


/**
 * Property 22: Investment Recommendation Ranking
 * 
 * For any facility recommendation request, facilities should be ranked by ROI (highest first),
 * and only facilities with positive projected ROI should be recommended.
 * 
 * Validates: Requirements 8.3, 8.5
 */
describe('Property 22: Investment Recommendation Ranking', () => {
  let testUserIds: number[] = [];

  beforeEach(async () => {
    testUserIds = [];
    
    // Ensure cycle metadata exists
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        totalCycles: 50,
        lastCycleAt: new Date(),
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    for (const userId of testUserIds) {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.facility.deleteMany({ where: { userId } });
      await prisma.robot.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Property 22.1: Recommendations are sorted by ROI (highest first)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 50 }), // lastNCycles
        fc.integer({ min: 1000000, max: 10000000 }), // user currency
        fc.integer({ min: 5000, max: 50000 }), // user prestige
        fc.integer({ min: 0, max: 3 }), // number of robots
        async (lastNCycles, currency, prestige, robotCount) => {
          // Clean up any existing audit logs from previous iterations
          await prisma.auditLog.deleteMany({});
          
          // Setup: Create user
          const user = await createTestUser();
          testUserIds.push(user.id);
          
          await prisma.user.update({
            where: { id: user.id },
            data: { currency, prestige },
          });

          // Update cycle metadata
          const currentCycle = 50;
          await prisma.cycleMetadata.update({
            where: { id: 1 },
            data: { totalCycles: currentCycle },
          });

          // Create robots
          for (let i = 0; i < robotCount; i++) {
            await createTestRobot(user.id, `Robot ${i + 1}`);
          }

          // Create some activity events to generate recommendations
          const startCycle = Math.max(1, currentCycle - lastNCycles + 1);
          for (let cycle = startCycle; cycle <= currentCycle; cycle++) {
            let sequenceCounter = cycle * 1000; // Unique base per cycle
            
            // Repair events
            await prisma.auditLog.create({
              data: {
                cycleNumber: cycle,
                eventType: 'robot_repair',
                eventTimestamp: new Date(),
                sequenceNumber: sequenceCounter++,
                userId: user.id,
                payload: { cost: 30000, robotId: 1 },
              },
            });

            // Upgrade events
            await prisma.auditLog.create({
              data: {
                cycleNumber: cycle,
                eventType: 'attribute_upgrade',
                eventTimestamp: new Date(),
                sequenceNumber: sequenceCounter++,
                userId: user.id,
                payload: { cost: 20000, robotId: 1, attributeName: 'combatSystems' },
              },
            });
          }

          // Execute
          const result = await facilityRecommendationService.generateRecommendations(
            user.id,
            lastNCycles
          );

          // Property: Recommendations should be sorted by ROI (highest first)
          for (let i = 0; i < result.recommendations.length - 1; i++) {
            expect(result.recommendations[i].projectedROI).toBeGreaterThanOrEqual(
              result.recommendations[i + 1].projectedROI
            );
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 22.2: Only facilities with positive projected ROI are recommended', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 30 }), // lastNCycles
        fc.integer({ min: 500000, max: 5000000 }), // user currency
        fc.integer({ min: 2000, max: 20000 }), // user prestige
        async (lastNCycles, currency, prestige) => {
          // Clean up any existing audit logs from previous iterations
          await prisma.auditLog.deleteMany({});
          
          // Setup: Create user
          const user = await createTestUser();
          testUserIds.push(user.id);
          
          await prisma.user.update({
            where: { id: user.id },
            data: { currency, prestige },
          });

          // Update cycle metadata
          const currentCycle = 40;
          await prisma.cycleMetadata.update({
            where: { id: 1 },
            data: { totalCycles: currentCycle },
          });

          // Create minimal activity (so most facilities won't have positive ROI)
          const startCycle = Math.max(1, currentCycle - lastNCycles + 1);
          for (let cycle = startCycle; cycle <= currentCycle; cycle++) {
            const sequenceCounter = cycle * 1000; // Unique base per cycle
            
            await prisma.auditLog.create({
              data: {
                cycleNumber: cycle,
                eventType: 'robot_repair',
                eventTimestamp: new Date(),
                sequenceNumber: sequenceCounter,
                userId: user.id,
                payload: { cost: 10000, robotId: 1 },
              },
            });
          }

          // Execute
          const result = await facilityRecommendationService.generateRecommendations(
            user.id,
            lastNCycles
          );

          // Property: All recommendations should have positive ROI
          for (const recommendation of result.recommendations) {
            expect(recommendation.projectedROI).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 22.3: Recommendations respect prestige requirements', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 10000 }), // user prestige (varying levels)
        fc.integer({ min: 10, max: 30 }), // lastNCycles
        async (prestige, lastNCycles) => {
          // Setup: Create user
          const user = await createTestUser();
          testUserIds.push(user.id);
          
          await prisma.user.update({
            where: { id: user.id },
            data: {
              currency: 5000000,
              prestige,
            },
          });

          // Update cycle metadata
          await prisma.cycleMetadata.update({
            where: { id: 1 },
            data: { totalCycles: 30 },
          });

          // Execute
          const result = await facilityRecommendationService.generateRecommendations(
            user.id,
            lastNCycles
          );

          // Property: No recommendation should require more prestige than user has
          for (const recommendation of result.recommendations) {
            // Get facility config to check prestige requirement
            const { getFacilityConfig } = await import('../src/config/facilities');
            const config = getFacilityConfig(recommendation.facilityType);
            
            if (config && config.prestigeRequirements) {
              const requiredPrestige = config.prestigeRequirements[recommendation.recommendedLevel - 1] || 0;
              expect(prestige).toBeGreaterThanOrEqual(requiredPrestige);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 22.4: High activity users get more discount facility recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 50000, max: 200000 }), // high repair cost per cycle
        fc.integer({ min: 30000, max: 100000 }), // high upgrade cost per cycle
        fc.integer({ min: 20, max: 40 }), // lastNCycles
        async (repairCostPerCycle, upgradeCostPerCycle, lastNCycles) => {
          // Clean up any existing audit logs from previous iterations
          await prisma.auditLog.deleteMany({});
          
          // Setup: Create user with high activity
          const user = await createTestUser();
          testUserIds.push(user.id);
          
          await prisma.user.update({
            where: { id: user.id },
            data: {
              currency: 10000000,
              prestige: 15000,
            },
          });

          // Update cycle metadata
          const currentCycle = 50;
          await prisma.cycleMetadata.update({
            where: { id: 1 },
            data: { totalCycles: currentCycle },
          });

          // Create high activity events
          const startCycle = Math.max(1, currentCycle - lastNCycles + 1);
          for (let cycle = startCycle; cycle <= currentCycle; cycle++) {
            let sequenceCounter = cycle * 1000; // Unique base per cycle
            
            // High repair costs
            await prisma.auditLog.create({
              data: {
                cycleNumber: cycle,
                eventType: 'robot_repair',
                eventTimestamp: new Date(),
                sequenceNumber: sequenceCounter++,
                userId: user.id,
                payload: { cost: repairCostPerCycle, robotId: 1 },
              },
            });

            // High upgrade costs
            await prisma.auditLog.create({
              data: {
                cycleNumber: cycle,
                eventType: 'attribute_upgrade',
                eventTimestamp: new Date(),
                sequenceNumber: sequenceCounter++,
                userId: user.id,
                payload: { cost: upgradeCostPerCycle, robotId: 1, attributeName: 'combatSystems' },
              },
            });
          }

          // Execute
          const result = await facilityRecommendationService.generateRecommendations(
            user.id,
            lastNCycles
          );

          // Property: Should recommend discount facilities (repair_bay, training_facility)
          const discountFacilities = result.recommendations.filter(
            r => r.facilityType === 'repair_bay' || r.facilityType === 'training_facility'
          );
          
          // With high activity, at least one discount facility should be recommended
          expect(discountFacilities.length).toBeGreaterThan(0);
          
          // Discount facilities should have positive ROI
          for (const facility of discountFacilities) {
            expect(facility.projectedROI).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  it('Property 22.5: Recommendations include upgrade cost and payoff cycles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 30 }), // lastNCycles
        fc.integer({ min: 2000000, max: 8000000 }), // user currency
        async (lastNCycles, currency) => {
          // Clean up any existing audit logs from previous iterations
          await prisma.auditLog.deleteMany({});
          
          // Setup: Create user
          const user = await createTestUser();
          testUserIds.push(user.id);
          
          await prisma.user.update({
            where: { id: user.id },
            data: {
              currency,
              prestige: 10000,
            },
          });

          // Update cycle metadata
          await prisma.cycleMetadata.update({
            where: { id: 1 },
            data: { totalCycles: 40 },
          });

          // Create some activity
          const startCycle = Math.max(1, 40 - lastNCycles + 1);
          for (let cycle = startCycle; cycle <= 40; cycle++) {
            const sequenceCounter = cycle * 1000; // Unique base per cycle
            
            await prisma.auditLog.create({
              data: {
                cycleNumber: cycle,
                eventType: 'robot_repair',
                eventTimestamp: new Date(),
                sequenceNumber: sequenceCounter,
                userId: user.id,
                payload: { cost: 40000, robotId: 1 },
              },
            });
          }

          // Execute
          const result = await facilityRecommendationService.generateRecommendations(
            user.id,
            lastNCycles
          );

          // Property: All recommendations should have valid upgrade cost and payoff info
          for (const recommendation of result.recommendations) {
            // Upgrade cost should be positive
            expect(recommendation.upgradeCost).toBeGreaterThan(0);
            
            // Should have a reason
            expect(recommendation.reason).toBeTruthy();
            expect(recommendation.reason.length).toBeGreaterThan(0);
            
            // Should have a priority
            expect(['high', 'medium', 'low']).toContain(recommendation.priority);
            
            // Current level should be less than recommended level
            expect(recommendation.currentLevel).toBeLessThan(recommendation.recommendedLevel);
          }
        }
      ),
      { numRuns: 25 }
    );
  });
});
