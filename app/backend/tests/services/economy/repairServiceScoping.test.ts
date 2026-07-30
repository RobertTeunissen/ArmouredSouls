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
const mockUserUpdate = jest.fn();
const mockTransaction = jest.fn();
const mockResolveRobotIdsForEvent = jest.fn();

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
    user: { update: (...args: unknown[]) => mockUserUpdate(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/common/eventLogger', () => ({
  eventLogger: { logRobotRepair: jest.fn().mockResolvedValue(undefined) },
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
  mockRobotUpdate.mockReturnValue({});
  mockUserUpdate.mockReturnValue({});
  mockTransaction.mockResolvedValue([]);
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
  // Explicit regression guard: scoping must not shrink the discount. The formula
  // is repairBayLevel × (5 + activeRobotCount) capped at 90%, where the count is
  // the owner's whole roster — not the handful of robots being repaired.
  it('should size the discount from the full roster, not the scoped subset', async () => {
    mockResolveRobotIdsForEvent.mockResolvedValue([4]);
    mockRobotFindMany.mockResolvedValue([makeDamagedRobot(4, 1)]);
    mockRobotGroupBy.mockResolvedValue([{ userId: 1, _count: { id: 8 } }]);
    mockFacilityFindMany.mockResolvedValue([
      { userId: 1, facilityType: 'repair_bay', level: 2 },
    ]);

    const summary = await repairRobotsForEvent('league_1v1');

    // level 2 × (5 + 8 robots) = 26%
    expect(summary.userSummaries[0].repairBayDiscount).toBe(26);

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

  it('should cap the discount at 90%', async () => {
    mockResolveRobotIdsForEvent.mockResolvedValue([4]);
    mockRobotFindMany.mockResolvedValue([makeDamagedRobot(4, 1)]);
    mockRobotGroupBy.mockResolvedValue([{ userId: 1, _count: { id: 40 } }]);
    mockFacilityFindMany.mockResolvedValue([
      { userId: 1, facilityType: 'repair_bay', level: 10 },
    ]);

    const summary = await repairRobotsForEvent('league_1v1');

    expect(summary.userSummaries[0].repairBayDiscount).toBe(90);
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
