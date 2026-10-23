/**
 * Scheduled settlement runs the Automaton Turn_Step (Spec #55 task 6.3;
 * R7.1, R7.2, R7.3, R7.8): after `advancePreparationCycle()` in preparation,
 * as the last step after `advanceCompetitiveCycle()` when no boundary was
 * reached, never on the boundary cycle, and never failing settlement.
 */
import { executeSettlement } from '../cycleScheduler';
import { completeSerializedCycleCutover } from '../canonicalCycleIdentity';
import { executeSeasonRollover } from '../../season/seasonRolloverService';
import { runTurnStepNonFatal } from '../../automaton';

const mockGetCurrentSeason = jest.fn();
const mockAdvancePreparation = jest.fn();
const mockAdvanceCompetitive = jest.fn();
jest.mock('../../season/seasonService', () => ({
  getCurrentSeason: () => mockGetCurrentSeason(),
  advancePreparationCycle: () => mockAdvancePreparation(),
  advanceCompetitiveCycle: () => mockAdvanceCompetitive(),
}));
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

const mockTurnStep = runTurnStepNonFatal as jest.MockedFunction<typeof runTurnStepNonFatal>;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 4, phase: 'competitive' });
  mockAdvanceCompetitive.mockResolvedValue({ seasonNumber: 4, competitiveCyclesCompleted: 12, boundaryReached: false });
});

describe('executeSettlement — Automaton Turn_Steps', () => {
  it('runs the preparation turn after advancePreparationCycle (R7.3)', async () => {
    mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 5, phase: 'preparation' });
    mockAdvancePreparation.mockResolvedValue({
      seasonNumber: 5, preparationCyclesCompleted: 2, remainingPreparationCycles: 1, transitionedToCompetitive: false,
    });

    await executeSettlement();

    expect(mockTurnStep).toHaveBeenCalledTimes(1);
    expect(mockTurnStep).toHaveBeenCalledWith({ trigger: 'preparation', seasonNumber: 5, slot: 2, source: 'scheduler' });
    expect(mockAdvancePreparation.mock.invocationCallOrder[0]).toBeLessThan(mockTurnStep.mock.invocationCallOrder[0]);
  });

  it('runs the settlement turn for the closed cycle as the last step, after the cutover and the season advance (R7.1)', async () => {
    await executeSettlement();

    expect(mockTurnStep).toHaveBeenCalledTimes(1);
    expect(mockTurnStep).toHaveBeenCalledWith({ trigger: 'settlement', seasonNumber: 4, slot: 42, source: 'scheduler' });
    const turnOrder = mockTurnStep.mock.invocationCallOrder[0];
    expect((completeSerializedCycleCutover as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(turnOrder);
    expect(mockAdvanceCompetitive.mock.invocationCallOrder[0]).toBeLessThan(turnOrder);
  });

  it('runs no settlement turn on the boundary cycle; the rollover runs instead (R7.2)', async () => {
    mockAdvanceCompetitive.mockResolvedValue({ seasonNumber: 4, competitiveCyclesCompleted: 30, boundaryReached: true });

    await executeSettlement();

    expect(executeSeasonRollover).toHaveBeenCalledWith({ trigger: 'settlement' });
    expect(mockTurnStep).not.toHaveBeenCalled();
  });

  it('never fails settlement when the Turn_Step call throws (R7.8)', async () => {
    mockTurnStep.mockRejectedValueOnce(new Error('unexpected'));

    // The closed cycle is reported for the scheduler run history.
    await expect(executeSettlement()).resolves.toEqual({ jobName: 'settlement', cycleNumber: 42 });
  });
});
