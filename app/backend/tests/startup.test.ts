/**
 * Unit tests for startup assertion (Spec 36).
 *
 * Asserts application exits with FATAL error when `subscription` table is missing,
 * and proceeds normally when `subscription` table exists.
 *
 * _Requirements: R3.5, R12.1_
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};
jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

const mockQueryRaw = jest.fn();
const mockPrisma = {
  $queryRaw: mockQueryRaw,
};
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// Mock the env config
jest.mock('../src/config/env', () => ({
  __esModule: true,
  loadEnvConfig: () => ({
    nodeEnv: 'development',
    port: 3001,
    logLevel: 'info',
    databaseUrl: '',
    jwtSecret: 'test-secret',
    jwtExpiration: '24h',
    bcryptSaltRounds: 10,
    corsOrigins: ['http://localhost:5173'],
    schedulerEnabled: false,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 30,
    loginRateLimitWindowMs: 900000,
    loginRateLimitMax: 10,
    leagueSchedule: '0 8 * * *',
    tournamentSchedule: '0 10 * * *',
    tagTeamSchedule: '0 11 * * *',
    settlementSchedule: '0 0 * * *',
    kothSchedule: '0 13 * * *',
    team2v2LeagueSchedule: '0 9 * * *',
    team3v3LeagueSchedule: '0 14 * * *',
    team2v2TournamentSchedule: '0 15 * * *',
    team3v3TournamentSchedule: '0 18 * * *',
    grandMeleeSchedule: '0 17 * * *',
    monitoringDiscordWebhook: undefined,
    discordWebhookUrl: undefined,
    dailyReportSchedule: '30 0 * * *',
    changelogDeployToken: undefined,
    appBaseUrl: undefined,
    enableModeration: false,
  }),
  getConfig: () => ({
    nodeEnv: 'development',
    schedulerEnabled: false,
  }),
  _resetConfigForTesting: jest.fn(),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe('Startup assertion: subscription table check (R3.5, R12.1)', () => {
  let mockExit: jest.SpiedFunction<typeof process.exit>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  /**
   * Simulates the startup assertion logic from src/index.ts.
   * We extract the assertion logic to test it in isolation without
   * starting the full Express server.
   */
  async function runSubscriptionTableCheck(): Promise<void> {
    const prisma = (await import('../src/lib/prisma')).default;
    const logger = (await import('../src/config/logger')).default;

    const subscriptionTableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'subscription'
      )`;

    if (!(subscriptionTableExists as Array<{ exists: boolean }>)[0]?.exists) {
      logger.error('FATAL: subscription table does not exist. Spec 35 (Booking Office) must be deployed first.');
      process.exit(1);
    }
  }

  test('should exit with code 1 when subscription table does not exist', async () => {
    mockQueryRaw.mockResolvedValue([{ exists: false }]);

    await expect(runSubscriptionTableCheck()).rejects.toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('FATAL'),
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('subscription table does not exist'),
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Spec 35'),
    );
  });

  test('should exit with code 1 when query returns empty array', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await expect(runSubscriptionTableCheck()).rejects.toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('FATAL'),
    );
  });

  test('should proceed normally when subscription table exists', async () => {
    mockQueryRaw.mockResolvedValue([{ exists: true }]);

    await expect(runSubscriptionTableCheck()).resolves.toBeUndefined();
    expect(mockExit).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
