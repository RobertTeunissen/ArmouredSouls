/**
 * #530 / #532 — every streaming caller uses the same all-modes battle count.
 *
 * Fixture: robot Wattage — robots.total_battles 211, KotH 68 matches, fame 1401,
 * Streaming Studio L5. The award path paid ₡9,824 for battle #466957, which only
 * a battle count of 279 (211 + 68) reproduces. With 6 Grand Melee matches the
 * count must be 285 everywhere: award (single + batch), Finance Center daily
 * breakdown and the facility recommendation estimate.
 */
const mockRobotFindUnique = jest.fn();
const mockRobotFindMany = jest.fn();
const mockFacilityFindUnique = jest.fn();
const mockFacilityFindMany = jest.fn();
const mockStandingFindMany = jest.fn();
const mockUserFindUnique = jest.fn();
const mockBattleFindMany = jest.fn();

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: {
      findUnique: (...args: unknown[]) => mockRobotFindUnique(...args),
      findMany: (...args: unknown[]) => mockRobotFindMany(...args),
    },
    facility: {
      findUnique: (...args: unknown[]) => mockFacilityFindUnique(...args),
      findMany: (...args: unknown[]) => mockFacilityFindMany(...args),
    },
    standing: { findMany: (...args: unknown[]) => mockStandingFindMany(...args) },
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    battle: { findMany: (...args: unknown[]) => mockBattleFindMany(...args) },
  },
}));

jest.mock('../../src/utils/economyCalculations', () => ({
  ...jest.requireActual('../../src/utils/economyCalculations'),
  generateFinancialReport: jest.fn().mockResolvedValue({ revenue: { streaming: 0 } }),
  calculateDailyPassiveIncome: jest.fn().mockResolvedValue({ merchandising: 0 }),
}));

import {
  calculateStreamingRevenue,
  calculateStreamingRevenueBatch,
} from '../../src/services/economy/streamingRevenueService';
import { getDailyFinancialReport } from '../../src/services/economy/financialReportService';
import { FacilityRecommendationService } from '../../src/services/economy/facilityRecommendationService';

const USER_ID = 7;
const WATTAGE = { id: 1, name: 'Wattage', totalBattles: 211, fame: 1401 };
const STUDIO_LEVEL = 5;

function serve(placement: { koth: number; grandMelee: number }): void {
  mockRobotFindUnique.mockResolvedValue(WATTAGE);
  mockRobotFindMany.mockResolvedValue([WATTAGE]);
  mockFacilityFindUnique.mockImplementation(
    async (args: { where: { userId_facilityType: { facilityType: string } } }) =>
      args.where.userId_facilityType.facilityType === 'streaming_studio'
        ? { level: STUDIO_LEVEL }
        : null,
  );
  mockFacilityFindMany.mockResolvedValue([{ userId: USER_ID, level: STUDIO_LEVEL }]);
  mockStandingFindMany.mockImplementation(async (args: { where: { mode: { in: string[] } } }) => {
    const rows = [
      { entityId: WATTAGE.id, mode: 'koth', totalMatches: placement.koth },
      { entityId: WATTAGE.id, mode: 'grand_melee', totalMatches: placement.grandMelee },
      // Win/loss-mode standings are already inside robots.total_battles.
      { entityId: WATTAGE.id, mode: 'tag_team', totalMatches: 70 },
    ];
    return rows
      .filter((r) => args.where.mode.in.includes(r.mode))
      .map(({ entityId, totalMatches }) => ({ entityId, totalMatches }));
  });
  mockUserFindUnique.mockResolvedValue({ prestige: 0 });
  mockBattleFindMany.mockResolvedValue([]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('streaming battle count (#530)', () => {
  it('reproduces the hand-verified Wattage payout (211 + 68 KotH = 279 → ₡9,824)', async () => {
    serve({ koth: 68, grandMelee: 0 });

    const result = await calculateStreamingRevenue(WATTAGE.id, USER_ID, false);

    expect(result?.robotBattles).toBe(279);
    expect(result?.totalRevenue).toBe(9824);
  });

  it('counts Grand Melee matches in both the single and batch award paths', async () => {
    serve({ koth: 68, grandMelee: 6 });

    const single = await calculateStreamingRevenue(WATTAGE.id, USER_ID, false);
    const batch = (await calculateStreamingRevenueBatch([{ robotId: WATTAGE.id, userId: USER_ID }])).get(WATTAGE.id);

    expect(single?.robotBattles).toBe(285);
    expect(batch?.robotBattles).toBe(285);
    expect(batch?.totalRevenue).toBe(single?.totalRevenue);
    expect(single?.totalRevenue).toBe(9870);
  });
});

describe('every streaming caller agrees for the same robot (#532)', () => {
  it('the Finance Center daily breakdown shows what the award path pays', async () => {
    serve({ koth: 68, grandMelee: 6 });

    const awarded = await calculateStreamingRevenue(WATTAGE.id, USER_ID, false);
    const report = await getDailyFinancialReport(USER_ID);

    const perRobot = report.multiplierBreakdown.streaming.perRobot[0];
    expect(perRobot.battles).toBe(285);
    expect(perRobot.revenuePerBattle).toBe(awarded?.totalRevenue);
    expect(report.multiplierBreakdown.streaming.totalBattles).toBe(285);
  });

  it('the facility recommendation estimate uses the same count', async () => {
    serve({ koth: 68, grandMelee: 6 });

    const awarded = await calculateStreamingRevenue(WATTAGE.id, USER_ID, false);
    const service = new FacilityRecommendationService() as unknown as {
      calculateAverageStreamingRevenue(userId: number, level: number): Promise<number>;
    };
    const estimate = await service.calculateAverageStreamingRevenue(USER_ID, STUDIO_LEVEL);

    expect(estimate).toBe(awarded?.totalRevenue);
  });
});
