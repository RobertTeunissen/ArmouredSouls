import { DiscordIntegration } from '../src/services/notifications/discord-integration';

// Mock logger to prevent console output
jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';

describe('DiscordIntegration', () => {
  let fetchSpy: jest.Spied<typeof global.fetch>;

  afterEach(() => {
    if (fetchSpy) {
      fetchSpy.mockRestore();
    }
  });

  describe('successful webhook call', () => {
    it('should return { success: true, integrationName: "discord" } on 2xx response', async () => {
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const integration = new DiscordIntegration(WEBHOOK_URL);
      const result = await integration.send('Test message');

      expect(result).toEqual({ success: true, integrationName: 'discord' });
    });
  });

  describe('correct request shape', () => {
    it('should call fetch with correct URL, method POST, Content-Type header, and JSON body with content field', async () => {
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const integration = new DiscordIntegration(WEBHOOK_URL);
      const message = 'League battles have been completed! 🏆';
      await integration.send(message);

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe(WEBHOOK_URL);
      expect(options!.method).toBe('POST');
      expect(options!.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(options!.body as string)).toEqual({ content: message });
      expect(options!.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('non-2xx response', () => {
    it('should return { success: false } with error containing HTTP status', async () => {
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      } as unknown as Response);

      const integration = new DiscordIntegration(WEBHOOK_URL);
      const result = await integration.send('Test message');

      expect(result.success).toBe(false);
      expect(result.integrationName).toBe('discord');
      expect(result.error).toContain('HTTP 500');
    });
  });

  describe('timeout / network error', () => {
    it('should return { success: false } with error message on fetch rejection', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(abortError);

      const integration = new DiscordIntegration(WEBHOOK_URL);
      const result = await integration.send('Test message');

      expect(result.success).toBe(false);
      expect(result.integrationName).toBe('discord');
      expect(result.error).toContain('The operation was aborted');
    });
  });
});

// --- Scheduler Notification Integration Tests ---

// Mock all cycleScheduler dependencies before importing
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
  validate: jest.fn(() => true),
}));

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    cycleMetadata: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    league: { findMany: jest.fn() },
    tournament: { findMany: jest.fn() },
    robot: { findMany: jest.fn(), updateMany: jest.fn() },
  },
}));

jest.mock('../src/services/economy/repairService', () => ({
  repairAllRobots: jest.fn(),
}));

jest.mock('../src/services/league/leagueBattleOrchestrator', () => ({
  executeScheduledBattles: jest.fn(),
}));

jest.mock('../src/services/league/leagueRebalancingService', () => ({
  rebalanceLeagues: jest.fn(),
}));

jest.mock('../src/services/analytics/matchmakingService', () => ({
  runMatchmaking: jest.fn(),
}));

jest.mock('../src/services/tournament/tournamentService', () => ({
  getActiveTournaments: jest.fn(),
  getCurrentRoundMatches: jest.fn(),
  advanceWinnersToNextRound: jest.fn(),
  autoCreateNextTournament: jest.fn(),
}));

jest.mock('../src/services/tournament/tournamentBattleOrchestrator', () => ({
  processTournamentBattle: jest.fn(),
}));

jest.mock('../src/services/tag-team/tagTeamBattleOrchestrator', () => ({
  executeScheduledTagTeamBattles: jest.fn(),
}));

jest.mock('../src/services/tag-team/tagTeamLeagueRebalancingService', () => ({
  rebalanceTagTeamLeagues: jest.fn(),
}));

jest.mock('../src/services/tag-team/tagTeamMatchmakingService', () => ({
  runTagTeamMatchmaking: jest.fn(),
}));

jest.mock('../src/services/common/eventLogger', () => ({
  EventLogger: jest.fn().mockImplementation(() => ({
    logSettlement: jest.fn(),
  })),
}));

jest.mock('../src/services/notifications/notification-service', () => ({
  buildSuccessMessage: jest.fn(),
  buildErrorMessage: jest.fn(),
  getActiveIntegrations: jest.fn(),
  dispatchNotification: jest.fn(),
}));

import { runJob, resetScheduler } from '../src/services/cycle/cycleScheduler';
import { JobContext } from '../src/services/notifications/integration';
import {
  buildSuccessMessage,
  buildErrorMessage,
  getActiveIntegrations,
  dispatchNotification,
} from '../src/services/notifications/notification-service';
import logger from '../src/config/logger';

const mockBuildSuccessMessage = buildSuccessMessage as jest.MockedFunction<typeof buildSuccessMessage>;
const mockBuildErrorMessage = buildErrorMessage as jest.MockedFunction<typeof buildErrorMessage>;
const mockGetActiveIntegrations = getActiveIntegrations as jest.MockedFunction<typeof getActiveIntegrations>;
const mockDispatchNotification = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Scheduler Notification Integration', () => {
  const TEST_BASE_URL = 'https://test.example.com';

  beforeEach(() => {
    process.env.APP_BASE_URL = TEST_BASE_URL;
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';

    mockBuildSuccessMessage.mockReturnValue('League battles have been completed! 🏆');
    mockBuildErrorMessage.mockReturnValue('⚠️ league encountered an error.');
    mockGetActiveIntegrations.mockReturnValue([]);
    mockDispatchNotification.mockResolvedValue([]);

    jest.clearAllMocks();
  });

  afterEach(() => {
    resetScheduler();
    delete process.env.APP_BASE_URL;
    delete process.env.DISCORD_WEBHOOK_URL;
  });

  it('should call buildSuccessMessage and dispatchNotification on successful job', async () => {
    const jobContext: JobContext = { jobName: 'league' };
    const handler = jest.fn<Promise<JobContext>, []>().mockResolvedValue(jobContext);

    mockBuildSuccessMessage.mockReturnValue('League battles have been completed! 🏆');
    mockGetActiveIntegrations.mockReturnValue([]);
    mockDispatchNotification.mockResolvedValue([]);

    await runJob('league', handler);

    expect(mockBuildSuccessMessage).toHaveBeenCalledWith(jobContext, TEST_BASE_URL);
    expect(mockDispatchNotification).toHaveBeenCalled();
  });

  it('should call buildErrorMessage and dispatchNotification on failed job', async () => {
    const handler = jest.fn<Promise<JobContext>, []>().mockRejectedValue(new Error('DB connection lost'));

    mockBuildErrorMessage.mockReturnValue('⚠️ league encountered an error.');
    mockGetActiveIntegrations.mockReturnValue([]);
    mockDispatchNotification.mockResolvedValue([]);

    await runJob('league', handler);

    expect(mockBuildErrorMessage).toHaveBeenCalledWith('league', TEST_BASE_URL);
    expect(mockDispatchNotification).toHaveBeenCalled();
  });

  it('should complete job successfully even when notification dispatch throws', async () => {
    const jobContext: JobContext = { jobName: 'league' };
    const handler = jest.fn<Promise<JobContext>, []>().mockResolvedValue(jobContext);

    mockBuildSuccessMessage.mockReturnValue('League battles have been completed! 🏆');
    mockGetActiveIntegrations.mockReturnValue([]);
    mockDispatchNotification.mockRejectedValue(new Error('Network failure'));

    // runJob should NOT throw even though dispatchNotification fails
    await expect(runJob('league', handler)).resolves.toBeUndefined();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('notification dispatch failed')
    );
  });

  it('should log warning and skip Discord delivery when DISCORD_WEBHOOK_URL is missing', async () => {
    delete process.env.DISCORD_WEBHOOK_URL;

    // Use the real getActiveIntegrations for this test
    const { getActiveIntegrations: realGetActiveIntegrations } = jest.requireActual(
      '../src/services/notifications/notification-service'
    ) as typeof import('../src/services/notifications/notification-service');

    mockGetActiveIntegrations.mockImplementation(realGetActiveIntegrations);

    const jobContext: JobContext = { jobName: 'league' };
    const handler = jest.fn<Promise<JobContext>, []>().mockResolvedValue(jobContext);

    mockBuildSuccessMessage.mockReturnValue('League battles have been completed! 🏆');
    mockDispatchNotification.mockResolvedValue([]);

    await runJob('league', handler);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('DISCORD_WEBHOOK_URL not set')
    );
  });
});
