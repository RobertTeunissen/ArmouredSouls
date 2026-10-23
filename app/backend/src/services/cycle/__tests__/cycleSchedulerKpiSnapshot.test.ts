/**
 * Scheduled settlement records the admin dashboard KPI snapshot for the closed
 * cycle: after the cutover completes, only in the competitive phase, and
 * never failing settlement.
 */
import { executeSettlement } from '../cycleScheduler';
import { completeSerializedCycleCutover } from '../canonicalCycleIdentity';
import { recordKpiSnapshotNonFatal } from '../../admin/adminKpiSnapshotService';

const mockGetCurrentSeason = jest.fn();
const mockAdvancePreparation = jest.fn();
const mockAdvanceCompetitive = jest.fn();
jest.mock('../../season/seasonService', () => ({
  getCurrentSeason: () => mockGetCurrentSeason(),
  advancePreparationCycle: () => mockAdvancePreparation(),
  advanceCompetitiveCycle: () => mockAdvanceCompetitive(),
}));
jest.mock('../../admin/adminKpiSnapshotService', () => ({ recordKpiSnapshotNonFatal: jest.fn(async () => undefined) }));
jest.mock('../../season/seasonRolloverService', () => ({ executeSeasonRollover: jest.fn(async () => ({})) }));
jest.mock('../../automaton', () => ({ runTurnStepNonFatal: jest.fn(async () => ({ ok: true, summary: {} })) }));
jest.mock('../canonicalCycleIdentity', () => ({
  beginSerializedCycleCutover: jest.fn(async () => 42),
  getSerializedCycleCutoverUserIdWatermark: jest.fn(async () => 100),
  completeSerializedCycleCutover: jest.fn(async () => undefined),
  abortSerializedCycleCutover: jest.fn(async () => undefined),
  resolveCanonicalCycleIdentity: jest.fn(),
}));
jest.mock('../cycle-closing-evidence', () => ({ logCycleEndBalances: jest.fn(async () => 5) }));
jest.mock('../cycleSnapshotService', () => ({ cycleSnapshotService: { createSnapshot: jest.fn(async () => undefined) } }));
jest.mock('../../financial/settlementService', () => ({
  settlementService: { settleCycle: jest.fn(async () => ({ totalPassiveIncome: 0, totalOperatingCosts: 0, usersProcessed: 5 })) },
}));
jest.mock('../../common/eventLogger', () => ({
  EventLogger: jest.fn().mockImplementation(() => ({
    logCycleStart: jest.fn(async () => undefined),
    logCycleComplete: jest.fn(async () => undefined),
  })),
}));
jest.mock('../../achievement', () => ({
  achievementService: { checkAndAward: jest.fn(async () => []), refreshRarityCache: jest.fn(async () => undefined) },
}));
jest.mock('../../practice-arena/practiceArenaMetrics', () => ({ practiceArenaMetrics: { flushAndReset: jest.fn(async () => undefined) } }));
jest.mock('../../../utils/userGeneration', () => ({ generateBattleReadyUsers: jest.fn(async () => ({ usersCreated: 0, robotsCreated: 0 })) }));
jest.mock('../../leaderboard/leaderboardService', () => ({ leaderboardService: { refreshAll: jest.fn(async () => undefined) } }));
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    standing: { updateMany: jest.fn(async () => ({ count: 0 })) },
    user: { findMany: jest.fn(async () => []) },
  },
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockRecord = recordKpiSnapshotNonFatal as jest.MockedFunction<typeof recordKpiSnapshotNonFatal>;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 4, phase: 'competitive' });
  mockAdvanceCompetitive.mockResolvedValue({ seasonNumber: 4, competitiveCyclesCompleted: 12, boundaryReached: false });
});

describe('executeSettlement — admin KPI snapshot', () => {
  it('records the snapshot for the closed cycle after the cutover completes', async () => {
    await executeSettlement();

    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenCalledWith(4, 42);
    expect((completeSerializedCycleCutover as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan(mockRecord.mock.invocationCallOrder[0]);
  });

  it('records the snapshot on the boundary cycle too, before the rollover', async () => {
    mockAdvanceCompetitive.mockResolvedValue({ seasonNumber: 4, competitiveCyclesCompleted: 30, boundaryReached: true });

    await executeSettlement();

    expect(mockRecord).toHaveBeenCalledWith(4, 42);
  });

  it('records nothing during a preparation day (the cycle counter does not move)', async () => {
    mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 5, phase: 'preparation' });
    mockAdvancePreparation.mockResolvedValue({
      seasonNumber: 5, preparationCyclesCompleted: 1, remainingPreparationCycles: 2, transitionedToCompetitive: false,
    });

    await executeSettlement();

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('never fails settlement when the snapshot throws', async () => {
    mockRecord.mockRejectedValueOnce(new Error('unexpected'));

    await expect(executeSettlement()).resolves.toEqual({ jobName: 'settlement' });
  });
});
