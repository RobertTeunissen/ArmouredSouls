/**
 * Unit tests for reserved slot stubs (Spec 36).
 *
 * Asserts each stub logs the expected info message with event name and cycle number,
 * returns without error, and does not trigger failure counts or monitoring alerts.
 *
 * _Requirements: R4.2, R4.4_
 */

// ── Mocks ────────────────────────────────────────────────────────────

// Mock node-cron to avoid actual scheduling (same pattern as scheduler.property.test.ts)
const mockSchedule = jest.fn().mockImplementation(() => ({
  stop: jest.fn(),
  start: jest.fn(),
  now: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
}));
jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    schedule: (...args: any[]) => mockSchedule(...args),
  },
  schedule: (...args: any[]) => mockSchedule(...args),
}));

// Mock logger to capture log calls
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Mock prisma: cycleMetadata.findUnique returns { id: 1, totalCycles: 42 }
const mockPrisma = {
  cycleMetadata: {
    findUnique: jest.fn().mockResolvedValue({ id: 1, totalCycles: 42 }),
  },
};
jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/config/env', () => ({
  __esModule: true,
  getConfig: () => ({ appBaseUrl: '' }),
}));

// Mock notification service to verify no alerts are dispatched
const mockDispatchNotification = jest.fn();
jest.mock('../../../src/services/notifications/notification-service', () => ({
  __esModule: true,
  buildSuccessMessage: jest.fn(),
  buildErrorMessage: jest.fn(),
  getActiveIntegrations: jest.fn().mockReturnValue([]),
  dispatchNotification: mockDispatchNotification,
}));

// Mock all service dependencies (same pattern as scheduler.property.test.ts)
jest.mock('../../../src/services/economy/repairService', () => ({
  repairAllRobots: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/league/leagueBattleOrchestrator', () => ({
  executeScheduledBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../../../src/services/koth/kothBattleOrchestrator', () => ({
  executeScheduledKothBattles: jest.fn().mockResolvedValue({ totalMatches: 0, successfulMatches: 0, failedMatches: 0 }),
}));
jest.mock('../../../src/services/league/leagueRebalancingService', () => ({
  rebalanceLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
}));
jest.mock('../../../src/services/analytics/matchmakingService', () => ({
  runMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../../src/services/tournament/tournamentService', () => ({
  getActiveTournaments: jest.fn().mockResolvedValue([]),
  getCurrentRoundMatches: jest.fn().mockResolvedValue([]),
  advanceWinnersToNextRound: jest.fn().mockResolvedValue(undefined),
  autoCreateNextTournament: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../src/services/tournament/tournamentBattleOrchestrator', () => ({
  processTournamentBattle: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/tag-team/tagTeamBattleOrchestrator', () => ({
  executeScheduledTagTeamBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));
jest.mock('../../../src/services/tag-team/tagTeamLeagueRebalancingService', () => ({
  rebalanceTagTeamLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
}));
jest.mock('../../../src/services/tag-team/tagTeamMatchmakingService', () => ({
  runTagTeamMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../../src/services/koth/kothMatchmakingService', () => ({
  runKothMatchmaking: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../../src/services/common/eventLogger', () => ({
  EventLogger: jest.fn().mockImplementation(() => ({
    logCycleStart: jest.fn(),
    logCycleComplete: jest.fn(),
    logEventBatch: jest.fn(),
  })),
  EventType: { PASSIVE_INCOME: 'passive_income', OPERATING_COSTS: 'operating_costs', CYCLE_END_BALANCE: 'cycle_end_balance' },
}));
jest.mock('../../../src/services/practice-arena/practiceArenaMetrics', () => ({
  practiceArenaMetrics: { flushAndReset: jest.fn() },
}));
jest.mock('../../../src/services/notifications/integration', () => ({
  __esModule: true,
  JobContext: {},
}));
jest.mock('../../../src/utils/scheduleUtils', () => ({
  getNextCronOccurrence: jest.fn().mockReturnValue(new Date()),
}));

// ── Import under test ────────────────────────────────────────────────

import { createReservedSlotHandler } from '../../../src/services/cycle/cycleScheduler';

// ── Tests ────────────────────────────────────────────────────────────

describe('Reserved slot stubs (R4.2, R4.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.cycleMetadata.findUnique.mockResolvedValue({ id: 1, totalCycles: 42 });
  });

  const reservedSlots = [
    'team2v2League',
    'team3v3League',
    'team2v2Tournament',
    'team3v3Tournament',
    'grandMelee',
  ] as const;

  describe.each(reservedSlots)('reserved slot "%s"', (eventName) => {
    test(`logs: Scheduler: reserved slot "${eventName}" fired (cycle 42) — reserved slot, no handler implemented yet`, async () => {
      const handler = createReservedSlotHandler(eventName);
      await handler();

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Scheduler: reserved slot "${eventName}" fired (cycle 42) — reserved slot, no handler implemented yet`
      );
    });

    test('returns a JobContext without throwing', async () => {
      const handler = createReservedSlotHandler(eventName);
      const result = await handler();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('jobName');
    });

    test('return value has jobName matching the event name', async () => {
      const handler = createReservedSlotHandler(eventName);
      const result = await handler();

      expect(result.jobName).toBe(eventName);
    });
  });

  test('handles missing cycleMetadata gracefully (defaults to cycle 0)', async () => {
    mockPrisma.cycleMetadata.findUnique.mockResolvedValue(null);

    const handler = createReservedSlotHandler('grandMelee');
    const result = await handler();

    expect(result).toBeDefined();
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Scheduler: reserved slot "grandMelee" fired (cycle 0) — reserved slot, no handler implemented yet`
    );
  });

  test('stubs do not trigger monitoring alerts', async () => {
    for (const eventName of reservedSlots) {
      const handler = createReservedSlotHandler(eventName);
      await handler();
    }

    expect(mockDispatchNotification).not.toHaveBeenCalled();
  });
});
