/**
 * Scheduled settlement tops up the generated stables to their target: on every
 * preparation day (the first one after a rollover rebuilds the population, before
 * competitive cycle 1 creates the first tournaments) and in competitive step 7.
 * A failed top-up never fails settlement.
 */
import { executeSettlement } from '../cycleScheduler';
import { runTurnStepNonFatal } from '../../automaton';
import { topUpGeneratedStables } from '../../../utils/userGeneration';

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
jest.mock('../../../utils/userGeneration', () => ({
  topUpGeneratedStables: jest.fn(async () => ({ usersCreated: 150, robotsCreated: 450, target: 150, existingBefore: 0 })),
}));
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

const mockTopUp = topUpGeneratedStables as jest.MockedFunction<typeof topUpGeneratedStables>;
const mockTurnStep = runTurnStepNonFatal as jest.MockedFunction<typeof runTurnStepNonFatal>;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 4, phase: 'competitive' });
  mockAdvanceCompetitive.mockResolvedValue({ seasonNumber: 4, competitiveCyclesCompleted: 12, boundaryReached: false });
  mockAdvancePreparation.mockResolvedValue({
    seasonNumber: 5, preparationCyclesCompleted: 1, remainingPreparationCycles: 1, transitionedToCompetitive: false,
  });
});

describe('executeSettlement — generated stables', () => {
  it('tops up on a preparation day, after the phase advance and before the Automaton turn', async () => {
    mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 5, phase: 'preparation' });

    await expect(executeSettlement()).resolves.toEqual({ jobName: 'settlement' });

    expect(mockTopUp).toHaveBeenCalledTimes(1);
    expect(mockAdvancePreparation.mock.invocationCallOrder[0]).toBeLessThan(mockTopUp.mock.invocationCallOrder[0]);
    expect(mockTopUp.mock.invocationCallOrder[0]).toBeLessThan(mockTurnStep.mock.invocationCallOrder[0]);
  });

  it('tops up once in a competitive settlement', async () => {
    await expect(executeSettlement()).resolves.toEqual({ jobName: 'settlement', cycleNumber: 42 });
    expect(mockTopUp).toHaveBeenCalledTimes(1);
  });

  it('never fails a preparation or competitive settlement when the top-up throws', async () => {
    mockTopUp.mockRejectedValueOnce(new Error('db down'));
    await expect(executeSettlement()).resolves.toEqual({ jobName: 'settlement', cycleNumber: 42 });

    mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 5, phase: 'preparation' });
    mockTopUp.mockRejectedValueOnce(new Error('db down'));
    await expect(executeSettlement()).resolves.toEqual({ jobName: 'settlement' });
    expect(mockTurnStep).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'preparation' }));
  });
});
