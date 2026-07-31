/**
 * Property-based tests for computeSchedulingEligibility.
 *
 * Feature: guided-robot-setup (Spec #47)
 *
 * Properties tested:
 * 1. Eligibility Consistency — isEligible matches the hard-gate formula
 * 2. Gate Completeness — always 3 gates with correct IDs and severities
 * 3. No Side Effects — no Prisma write operations occur
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.7**
 */

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: {
      findUniqueOrThrow: jest.fn(),
    },
    subscription: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    tuningAllocation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('../../analytics/matchmakingService', () => ({
  __esModule: true,
  checkSchedulingReadiness: jest.fn(),
}));

import * as fc from 'fast-check';
import prisma from '../../../lib/prisma';
import { checkSchedulingReadiness } from '../../analytics/matchmakingService';
import { computeSchedulingEligibility } from '../robotSchedulingEligibilityService';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedCheckSchedulingReadiness = checkSchedulingReadiness as jest.MockedFunction<
  typeof checkSchedulingReadiness
>;

describe('robotSchedulingEligibilityService — Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 1: Eligibility Consistency', () => {
    it('isEligible SHALL equal weaponCheck AND subscriptionCount > 0 for any robot state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            weaponCheck: fc.boolean(),
            subscriptionCount: fc.nat({ max: 20 }),
            hasTuning: fc.boolean(),
          }),
          async ({ weaponCheck, subscriptionCount, hasTuning }) => {
            // Configure mocks per-iteration
            (mockedPrisma.robot.findUniqueOrThrow as jest.Mock).mockResolvedValue({
              id: 1,
              loadoutType: 'single',
              mainWeaponId: weaponCheck ? 1 : null,
              offhandWeaponId: null,
              mainWeapon: weaponCheck ? { id: 1 } : null,
              offhandWeapon: null,
            });

            mockedCheckSchedulingReadiness.mockReturnValue({
              isReady: weaponCheck,
              reasons: weaponCheck ? [] : ['No main weapon equipped'],
              hpCheck: true,
              weaponCheck,
            });

            (mockedPrisma.subscription.count as jest.Mock).mockResolvedValue(subscriptionCount);

            (mockedPrisma.tuningAllocation.findUnique as jest.Mock).mockResolvedValue(
              hasTuning ? { id: 1, robotId: 1 } : null,
            );

            const report = await computeSchedulingEligibility(1);

            // isEligible must equal: weapon gate met AND subscription gate met
            const expectedEligible = weaponCheck && subscriptionCount > 0;
            expect(report.isEligible).toBe(expectedEligible);

            // isFullyConfigured must equal: all three gates met
            const expectedFullyConfigured = weaponCheck && subscriptionCount > 0 && hasTuning;
            expect(report.isFullyConfigured).toBe(expectedFullyConfigured);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 2: Gate Completeness', () => {
    it('gates array SHALL always contain exactly 3 elements with correct IDs and severities', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            weaponCheck: fc.boolean(),
            subscriptionCount: fc.nat({ max: 20 }),
            hasTuning: fc.boolean(),
          }),
          async ({ weaponCheck, subscriptionCount, hasTuning }) => {
            (mockedPrisma.robot.findUniqueOrThrow as jest.Mock).mockResolvedValue({
              id: 1,
              loadoutType: 'single',
              mainWeaponId: weaponCheck ? 1 : null,
              offhandWeaponId: null,
              mainWeapon: weaponCheck ? { id: 1 } : null,
              offhandWeapon: null,
            });

            mockedCheckSchedulingReadiness.mockReturnValue({
              isReady: weaponCheck,
              reasons: weaponCheck ? [] : ['No main weapon equipped'],
              hpCheck: true,
              weaponCheck,
            });

            (mockedPrisma.subscription.count as jest.Mock).mockResolvedValue(subscriptionCount);

            (mockedPrisma.tuningAllocation.findUnique as jest.Mock).mockResolvedValue(
              hasTuning ? { id: 1, robotId: 1 } : null,
            );

            const report = await computeSchedulingEligibility(1);

            // Exactly 3 gates
            expect(report.gates).toHaveLength(3);

            // Correct IDs in order
            expect(report.gates[0].id).toBe('weapon_equipped');
            expect(report.gates[1].id).toBe('event_subscribed');
            expect(report.gates[2].id).toBe('tuning_allocated');

            // Correct severities
            expect(report.gates[0].severity).toBe('hard');
            expect(report.gates[1].severity).toBe('hard');
            expect(report.gates[2].severity).toBe('soft');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 3: No Side Effects', () => {
    it('no Prisma .create, .update, .delete, .upsert, or .deleteMany methods SHALL be called', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            weaponCheck: fc.boolean(),
            subscriptionCount: fc.nat({ max: 20 }),
            hasTuning: fc.boolean(),
          }),
          async ({ weaponCheck, subscriptionCount, hasTuning }) => {
            (mockedPrisma.robot.findUniqueOrThrow as jest.Mock).mockResolvedValue({
              id: 1,
              loadoutType: 'single',
              mainWeaponId: weaponCheck ? 1 : null,
              offhandWeaponId: null,
              mainWeapon: weaponCheck ? { id: 1 } : null,
              offhandWeapon: null,
            });

            mockedCheckSchedulingReadiness.mockReturnValue({
              isReady: weaponCheck,
              reasons: weaponCheck ? [] : ['No main weapon equipped'],
              hpCheck: true,
              weaponCheck,
            });

            (mockedPrisma.subscription.count as jest.Mock).mockResolvedValue(subscriptionCount);

            (mockedPrisma.tuningAllocation.findUnique as jest.Mock).mockResolvedValue(
              hasTuning ? { id: 1, robotId: 1 } : null,
            );

            // Clear call counts before the function under test
            (mockedPrisma.subscription.create as jest.Mock).mockClear();
            (mockedPrisma.subscription.update as jest.Mock).mockClear();
            (mockedPrisma.subscription.delete as jest.Mock).mockClear();
            (mockedPrisma.subscription.upsert as jest.Mock).mockClear();
            (mockedPrisma.subscription.deleteMany as jest.Mock).mockClear();
            (mockedPrisma.tuningAllocation.create as jest.Mock).mockClear();
            (mockedPrisma.tuningAllocation.update as jest.Mock).mockClear();
            (mockedPrisma.tuningAllocation.delete as jest.Mock).mockClear();
            (mockedPrisma.tuningAllocation.upsert as jest.Mock).mockClear();
            (mockedPrisma.tuningAllocation.deleteMany as jest.Mock).mockClear();

            await computeSchedulingEligibility(1);

            // Assert no write operations on any model
            expect(mockedPrisma.subscription.create).not.toHaveBeenCalled();
            expect(mockedPrisma.subscription.update).not.toHaveBeenCalled();
            expect(mockedPrisma.subscription.delete).not.toHaveBeenCalled();
            expect(mockedPrisma.subscription.upsert).not.toHaveBeenCalled();
            expect(mockedPrisma.subscription.deleteMany).not.toHaveBeenCalled();
            expect(mockedPrisma.tuningAllocation.create).not.toHaveBeenCalled();
            expect(mockedPrisma.tuningAllocation.update).not.toHaveBeenCalled();
            expect(mockedPrisma.tuningAllocation.delete).not.toHaveBeenCalled();
            expect(mockedPrisma.tuningAllocation.upsert).not.toHaveBeenCalled();
            expect(mockedPrisma.tuningAllocation.deleteMany).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
