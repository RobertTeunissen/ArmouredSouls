/**
 * Unit tests for scoped pre-battle repair (issue #411).
 *
 * Covers the two properties that matter economically: only the robots about to
 * fight are repaired, and the Repair_Bay discount is computed from the owner's
 * whole roster regardless of how few robots the scope selected.
 */

const mockRobotFindMany = jest.fn();
const mockRobotGroupBy = jest.fn();
const mockRobotUpdate = jest.fn();
const mockFacilityFindMany = jest.fn();
const mockTransaction = jest.fn();
const mockResolveRobotIdsForEvent = jest.fn();

const mockTx = {
  robot: {
    findMany: (...args: unknown[]) => mockRobotFindMany(...args),
    groupBy: (...args: unknown[]) => mockRobotGroupBy(...args),
    update: (...args: unknown[]) => mockRobotUpdate(...args),
  },
  facility: { findMany: (...args: unknown[]) => mockFacilityFindMany(...args) },
  cycleMetadata: {
    findUnique: jest.fn().mockResolvedValue({ totalCycles: 0, featureFlags: {} }),
  },
  season: { findFirst: jest.fn().mockResolvedValue(null) },
  $executeRaw: jest.fn().mockResolvedValue(0),
  $queryRaw: jest.fn().mockResolvedValue([{ id: 1, currency: 100000 }]),
};

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: {
      findMany: (...args: unknown[]) => mockRobotFindMany(...args),
      groupBy: (...args: unknown[]) => mockRobotGroupBy(...args),
      update: (...args: unknown[]) => mockRobotUpdate(...args),
      fields: { maxHP: 'maxHP' },
    },
    facility: { findMany: (...args: unknown[]) => mockFacilityFindMany(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('../../../src/lib/creditGuard', () => ({
  lockUserForSpending: jest.fn().mockResolvedValue({ id: 1, currency: 100000 }),
}));

jest.mock('../../../src/services/financial/repairMutationService', () => ({
  applyRepairCreditMutationInTransaction: jest.fn().mockResolvedValue({ created: true, balanceAfter: 100000 }),
  buildRepairOperationId: jest.fn().mockReturnValue('test-repair-operation'),
}));

jest.mock('../../../src/services/battle/baseOrchestrator', () => ({
  __esModule: true,
  getCurrentCycleNumber: jest.fn().mockResolvedValue(1),
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/economy/repairScope', () => ({
  resolveRobotIdsForEvent: (...args: unknown[]) => mockResolveRobotIdsForEvent(...args),
}));

import { repairRobotsForEvent, repairAllRobots } from '../../../src/services/economy/repairService';
import { ROBOT_ATTRIBUTES } from '../../../src/shared/utils/robotAttributes';

/** Minimal damaged robot: every attribute at 10, half HP. */
function makeDamagedRobot(id: number, userId: number) {
  const attributes: Record<string, number> = {};
  for (const key of ROBOT_ATTRIBUTES) {
    attributes[key] = 10;
  }

  return {
    id,
    userId,
    name: `Robot ${id}`,
    currentHP: 50,
    maxHP: 100,
    currentShield: 0,
    maxShield: 20,
    ...attributes,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRobotFindMany.mockResolvedValue([]);
  mockRobotGroupBy.mockResolvedValue([]);
  mockFacilityFindMany.mockResolvedValue([]);
  mockRobotUpdate.mockResolvedValue({});
  mockTransaction.mockImplementation(async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx));
});

describe('repairRobotsForEvent', () => {
  it('should restrict the repair query to the robots with a queued match', async () => {
    mockResolveRobotIdsForEvent.mockResolvedValue([4, 9]);
    mockRobotFindMany.mockResolvedValue([makeDamagedRobot(4, 1), makeDamagedRobot(9, 1)]);
    mockRobotGroupBy.mockResolvedValue([{ userId: 1, _count: { id: 6 } }]);

    const summary = await repairRobotsForEvent('league_1v1');

    expect(mockResolveRobotIdsForEvent).toHaveBeenCalledWith('league_1v1');
    expect(mockRobotFindMany).toHaveBeenCalledWith({
      where: { id: { in: [4, 9] }, currentHP: { lt: 'maxHP' } },
    });
    expect(summary.robotsRepaired).toBe(2);
  });

  // The whole point of the change: a robot with no match this slot keeps its
  // damage, so its owner can still take the cheaper manual repair.
  it('should do nothing when no robot has a match queued', async () => {
    mockResolveRobotIdsForEvent.mockResolvedValue([]);

    const summary = await repairRobotsForEvent('koth');

    expect(summary).toEqual({
      robotsRepaired: 0,
      totalBaseCost: 0,
      totalFinalCost: 0,
      costsDeducted: true,
      userSummaries: [],
    });
    // Critically, no query — an empty `IN ()` would otherwise match everything.
    expect(mockRobotFindMany).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('should charge the owner when costs are deducted', async () => {
    mockResolveRobotIdsForEvent.mockResolvedValue([4]);
    mockRobotFindMany.mockResolvedValue([makeDamagedRobot(4, 1)]);
    mockRobotGroupBy.mockResolvedValue([{ userId: 1, _count: { id: 1 } }]);

    const summary = await repairRobotsForEvent('league_1v1', true);

    expect(summary.costsDeducted).toBe(true);
    expect(summary.totalFinalCost).toBeGreaterThan(0);
  });
});

describe('repair bay discount', () => {
  // Season 2 (#525): the discount is 6 × min(level, 10) percent and no longer
  // depends on the roster. The owner's whole-roster count is still looked up (it
  // is recorded on each repair as a stable fact), never the scoped subset.
  it('should give 6% per level whatever the roster size, and count the full roster', async () => {
    mockResolveRobotIdsForEvent.mockResolvedValue([4]);
    mockRobotFindMany.mockResolvedValue([makeDamagedRobot(4, 1)]);
    mockRobotGroupBy.mockResolvedValue([{ userId: 1, _count: { id: 8 } }]);
    mockFacilityFindMany.mockResolvedValue([
      { userId: 1, facilityType: 'repair_bay', level: 2 },
    ]);

    const summary = await repairRobotsForEvent('league_1v1');

    // level 2 × 6% = 12%, with 8 robots or any other count
    expect(summary.userSummaries[0].repairBayDiscount).toBe(12);

    // Neither lookup may be narrowed to the scoped robot ids.
    expect(mockRobotGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: { in: [1] } } }),
    );
    expect(mockFacilityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: { in: [1] }, facilityType: 'repair_bay' },
      }),
    );
  });

  it('should give the 60% maximum at Level 10, even for a 40-robot roster', async () => {
    mockResolveRobotIdsForEvent.mockResolvedValue([4]);
    mockRobotFindMany.mockResolvedValue([makeDamagedRobot(4, 1)]);
    mockRobotGroupBy.mockResolvedValue([{ userId: 1, _count: { id: 40 } }]);
    mockFacilityFindMany.mockResolvedValue([
      { userId: 1, facilityType: 'repair_bay', level: 10 },
    ]);

    const summary = await repairRobotsForEvent('league_1v1');

    expect(summary.userSummaries[0].repairBayDiscount).toBe(60);
  });

  it('should apply no discount without a repair bay', async () => {
    mockResolveRobotIdsForEvent.mockResolvedValue([4]);
    mockRobotFindMany.mockResolvedValue([makeDamagedRobot(4, 1)]);
    mockRobotGroupBy.mockResolvedValue([{ userId: 1, _count: { id: 3 } }]);
    mockFacilityFindMany.mockResolvedValue([]);

    const summary = await repairRobotsForEvent('league_1v1');

    expect(summary.userSummaries[0].repairBayDiscount).toBe(0);
  });
});

describe('repairAllRobots', () => {
  // Kept for admin maintenance, which deliberately patches up the whole roster.
  it('should query every damaged robot with no id filter', async () => {
    mockRobotFindMany.mockResolvedValue([makeDamagedRobot(1, 1)]);
    mockRobotGroupBy.mockResolvedValue([{ userId: 1, _count: { id: 1 } }]);

    await repairAllRobots(true);

    expect(mockRobotFindMany).toHaveBeenCalledWith({
      where: { currentHP: { lt: 'maxHP' } },
    });
    expect(mockResolveRobotIdsForEvent).not.toHaveBeenCalled();
  });
});
