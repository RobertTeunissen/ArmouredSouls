/**
 * Property 1: Bug Condition - Owned Economic Facilities Return Null/404 When Audit Events Missing
 *
 * This test encodes the EXPECTED behavior: for all owned economic facilities,
 * calling the ROI calculation should return non-null data with valid fields.
 *
 * On UNFIXED code, this test SHOULD FAIL because roiCalculatorService returns null
 * when no `facility_purchase` audit log event exists — confirming the bug.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */
import fc from 'fast-check';
import prisma from '../../../lib/prisma';
import { unifiedFacilityROIService } from '../unifiedFacilityROIService';

const ECONOMIC_FACILITY_TYPES = [
  'merchandising_hub',
  'streaming_studio',
  'repair_bay',
  'training_facility',
  'weapons_workshop',
] as const;

describe('Property 1: Bug Condition - Owned Economic Facilities Return Null/404 When Audit Events Missing', () => {
  let testUserIds: number[] = [];

  beforeAll(async () => {
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
    // Clean up test data created during each property run
    for (const userId of testUserIds) {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.facility.deleteMany({ where: { userId } });
      await prisma.robot.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
    testUserIds = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should return non-null ROI data for owned economic facilities even without purchase audit events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...ECONOMIC_FACILITY_TYPES),
        fc.integer({ min: 1, max: 10 }),
        async (facilityType, level) => {
          // Setup: Create a user with a facility at the given level
          // but NO facility_purchase audit log event (the bug condition)
          const user = await prisma.user.create({
            data: {
              username: `bugtest_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              passwordHash: '$2b$10$testhashedpassword000000000000000000000000000000',
              prestige: 5000,
              currency: 1000000,
            },
          });
          testUserIds.push(user.id);

          // Create the facility at the specified level (simulating a facility
          // that exists but has no purchase audit event — e.g., created via
          // admin tool, data migration, or lost audit log)
          await prisma.facility.create({
            data: {
              userId: user.id,
              facilityType,
              level,
              maxLevel: 10,
            },
          });

          // NO facility_purchase audit log event is created — this is the bug condition

          // Property assertion: The ROI calculation should return non-null data
          // with valid fields for any owned economic facility
          const result = await unifiedFacilityROIService.calculateFacilityROI(user.id, facilityType);

          // Expected behavior: result should NOT be null
          expect(result).not.toBeNull();

          if (result !== null) {
            // Validate the shape of the returned data
            expect(result.totalInvestment).toBeGreaterThan(0);
            expect(result.totalReturns).toBeGreaterThanOrEqual(0);
            expect(typeof result.netROI).toBe('number');
            expect(result.facilityType).toBe(facilityType);
            expect(result.currentLevel).toBe(level);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
