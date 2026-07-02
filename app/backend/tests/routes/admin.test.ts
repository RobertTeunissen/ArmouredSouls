/**
 * Unit tests for admin reserved-slot trigger endpoints (Spec 36).
 *
 * Asserts each reserved-slot trigger endpoint returns HTTP 200 with correct body,
 * creates an adminAuditLog row per invocation, and requires authenticateToken + requireAdmin.
 *
 * _Requirements: R6.3, R8.2, R8.3_
 */

import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../src/middleware/errorHandler';

// ── Mocks ────────────────────────────────────────────────────────────

const mockPrisma = {
  cycleMetadata: { findUnique: jest.fn() },
  user: { findMany: jest.fn(), findUnique: jest.fn() },
  robot: { findMany: jest.fn() },
  facility: { findMany: jest.fn() },
  tournament: { findUnique: jest.fn(), findFirst: jest.fn() },
  scheduledKothMatchParticipant: { findMany: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../src/services/security/securityMonitor', () => ({
  securityMonitor: {
    logValidationFailure: jest.fn(),
    logAuthorizationFailure: jest.fn(),
    logAdminAccess: jest.fn(),
    trackRateLimitViolation: jest.fn(),
  },
}));

// Track audit log calls
const mockRecordAction = jest.fn();
jest.mock('../../src/services/admin/adminAuditLogService', () => ({
  __esModule: true,
  recordAction: (...args: unknown[]) => mockRecordAction(...args),
  getEntries: jest.fn().mockResolvedValue({ entries: [], total: 0 }),
}));

// Mock other admin service dependencies to prevent import errors
jest.mock('../../src/services/admin/adminStatsService', () => ({
  __esModule: true,
  getSystemStats: jest.fn(),
  getAtRiskUsers: jest.fn(),
  getRobotAttributeStats: jest.fn(),
  getRecentUserActivity: jest.fn(),
  getRepairAuditLog: jest.fn(),
  getDashboardKpis: jest.fn(),
  getEngagementPlayers: jest.fn(),
  getEconomyOverview: jest.fn(),
  getLeagueHealth: jest.fn(),
  getTeamBattleLeagueHealth: jest.fn(),
  getWeaponAnalytics: jest.fn(),
  getAchievementAnalytics: jest.fn(),
  getTuningAdoption: jest.fn(),
  getRefinementAdoption: jest.fn(),
}));

jest.mock('../../src/services/admin/adminMaintenanceService', () => ({
  __esModule: true,
  repairAllRobotsAdmin: jest.fn(),
  recalculateAllRobotHP: jest.fn(),
}));

jest.mock('../../src/services/admin/adminCycleService', () => ({
  __esModule: true,
  executeBulkCycles: jest.fn(),
  backfillCycleSnapshots: jest.fn(),
}));

jest.mock('../../src/services/admin/adminBattleService', () => ({
  __esModule: true,
  getAdminBattleList: jest.fn(),
  getAdminBattleDetail: jest.fn(),
}));

jest.mock('../../src/services/league/leagueBattleOrchestrator', () => ({
  __esModule: true,
  executeScheduledBattles: jest.fn(),
}));

jest.mock('../../src/services/analytics/matchmakingService', () => ({
  __esModule: true,
  runMatchmaking: jest.fn(),
}));

jest.mock('../../src/services/league/leagueRebalancingService', () => ({
  __esModule: true,
  rebalanceLeagues: jest.fn(),
  rebalanceKothLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
  createStandingsAdapter: jest.fn().mockReturnValue({
    entityType: 'robot',
    getEntitiesWithMinPoints: jest.fn().mockResolvedValue([]),
    countEligibleInInstance: jest.fn().mockResolvedValue(0),
    getEntitiesForDemotion: jest.fn().mockResolvedValue([]),
    getInstancesForTier: jest.fn().mockResolvedValue([]),
    countEntitiesInTier: jest.fn().mockResolvedValue(0),
    countEntitiesInDestinationTier: jest.fn().mockResolvedValue(0),
    assignInstance: jest.fn().mockResolvedValue('bronze_1'),
    updateEntityLeague: jest.fn().mockResolvedValue(undefined),
    getEntityCurrentTier: jest.fn().mockReturnValue('bronze'),
    getEntityLeagueId: jest.fn().mockReturnValue('bronze_1'),
    getEntityLeaguePoints: jest.fn().mockReturnValue(0),
    getEntityOwnerId: jest.fn().mockReturnValue(1),
    getEntityDisplayName: jest.fn().mockReturnValue('entity#1'),
    onPromoted: jest.fn().mockResolvedValue(undefined),
    rebalanceInstances: jest.fn().mockResolvedValue(undefined),
    countAllEntities: jest.fn().mockResolvedValue(0),
  }),
}));

jest.mock('../../src/services/tag-team/tagTeamLeagueRebalancingService', () => ({
  __esModule: true,
  rebalanceTagTeamLeagues: jest.fn(),
}));

jest.mock('../../src/services/tag-team/tagTeamMatchmakingService', () => ({
  __esModule: true,
  runTagTeamMatchmaking: jest.fn(),
}));

jest.mock('../../src/services/tag-team/tagTeamBattleOrchestrator', () => ({
  __esModule: true,
  executeScheduledTagTeamBattles: jest.fn(),
}));

// Mock team battle services
const mockRunTeamBattleMatchmaking = jest.fn();
jest.mock('../../src/services/team-battle/teamBattleMatchmakingService', () => ({
  __esModule: true,
  runTeamBattleMatchmaking: (...args: unknown[]) => mockRunTeamBattleMatchmaking(...args),
}));

const mockExecuteScheduledTeamBattles = jest.fn();
jest.mock('../../src/services/team-battle/teamBattleOrchestrator', () => ({
  __esModule: true,
  executeScheduledTeamBattles: (...args: unknown[]) => mockExecuteScheduledTeamBattles(...args),
}));

const mockRebalanceTeamBattleLeagues = jest.fn();
jest.mock('../../src/services/team-battle/teamBattleAdapter', () => ({
  __esModule: true,
  rebalanceTeamBattleLeagues: (...args: unknown[]) => mockRebalanceTeamBattleLeagues(...args),
}));

jest.mock('../../src/services/economy/repairService', () => ({
  __esModule: true,
  repairAllRobots: jest.fn().mockResolvedValue({ robotsRepaired: 0, totalBaseCost: 0, totalFinalCost: 0, costsDeducted: false, repairs: [] }),
}));

jest.mock('../../src/utils/economyCalculations', () => ({
  __esModule: true,
  processAllDailyFinances: jest.fn(),
}));

jest.mock('../../src/services/cycle/cycleScheduler', () => ({
  __esModule: true,
  getSchedulerState: jest.fn().mockReturnValue({ active: false, runningJob: null, queue: [], jobs: [] }),
  runJob: jest.fn(),
  triggerJob: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/practice-arena/practiceArenaMetrics', () => ({
  __esModule: true,
  practiceArenaMetrics: { getStats: jest.fn(), getHistory: jest.fn().mockResolvedValue([]) },
}));

jest.mock('../../src/services/moderation/adminUploadsHandler', () => ({
  __esModule: true,
  handleAdminUploads: jest.fn(),
  handleAdminCleanup: jest.fn(),
}));

jest.mock('../../src/services/league/leagueHistoryService', () => ({
  __esModule: true,
  getHistoryByCycleRange: jest.fn(),
  getAggregates: jest.fn(),
  getEntityHistory: jest.fn(),
  detectYoYoCandidates: jest.fn(),
}));

// Mock team tournament services (used by dynamic imports in trigger endpoints)
const mockExecuteTeamTournamentRound = jest.fn();
jest.mock('../../src/services/tournament/teamTournamentBattleOrchestrator', () => ({
  __esModule: true,
  executeTeamTournamentRound: (...args: unknown[]) => mockExecuteTeamTournamentRound(...args),
}));

const mockAdvanceWinnersToNextRound = jest.fn();
jest.mock('../../src/services/tournament/tournamentService', () => ({
  __esModule: true,
  advanceWinnersToNextRound: (...args: unknown[]) => mockAdvanceWinnersToNextRound(...args),
  createSingleEliminationTournament: jest.fn(),
  getActiveTournaments: jest.fn().mockResolvedValue([]),
  getTournamentById: jest.fn(),
  getCurrentRoundMatches: jest.fn().mockResolvedValue([]),
  autoCreateNextTournament: jest.fn(),
  getEligibleRobotsForTournament: jest.fn().mockResolvedValue([]),
}));

// Mock auth middleware — control authentication per test
let mockUser: { userId: number; username: string; role: string } | null = null;
jest.mock('../../src/middleware/auth', () => ({
  __esModule: true,
  authenticateToken: (req: any, _res: any, next: any) => {
    if (!mockUser) {
      return _res.status(401).json({ error: 'Access token required' });
    }
    req.user = mockUser;
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  },
  AuthRequest: {},
}));

// Import routes after mocks
import adminRoutes from '../../src/routes/admin';

// ── Test App ─────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use(errorHandler);

// ── Tests ────────────────────────────────────────────────────────────

describe('Admin reserved-slot trigger endpoints (R6.3, R8.2, R8.3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { userId: 1, username: 'admin', role: 'admin' };
  });

  const reservedSlotEndpoints = [
    { path: '/api/admin/grand-melee/trigger', event: 'grand_melee' },
  ];

  describe.each(reservedSlotEndpoints)('POST $path', ({ path, event }) => {
    test('should return HTTP 200 with correct body', async () => {
      const res = await request(app).post(path).send({});

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        deprecated: true,
        message: 'Grand Melee cycle triggered successfully',
      });
    });

    test('should create an adminAuditLog row per invocation', async () => {
      await request(app).post(path).send({});

      expect(mockRecordAction).toHaveBeenCalledWith(
        1, // userId
        'grand_melee_trigger',
        'success',
        expect.objectContaining({ message: 'Grand Melee cycle triggered (deprecated endpoint)' }),
      );
    });

    test('should require authentication (401 without token)', async () => {
      mockUser = null;

      const res = await request(app).post(path).send({});

      expect(res.status).toBe(401);
    });

    test('should require admin role (403 for non-admin)', async () => {
      mockUser = { userId: 2, username: 'player', role: 'user' };

      const res = await request(app).post(path).send({});

      expect(res.status).toBe(403);
    });
  });
});

describe('Admin team-league trigger endpoints (R14.3, R14.4, R14.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { userId: 1, username: 'admin', role: 'admin' };
    mockExecuteScheduledTeamBattles.mockResolvedValue({ matchesCompleted: 2, matchesCancelled: 0, results: [] });
    mockRebalanceTeamBattleLeagues.mockResolvedValue({ promoted: 0, demoted: 0 });
    mockRunTeamBattleMatchmaking.mockResolvedValue(3);
  });

  describe('POST /api/admin/team-2v2-league/trigger', () => {
    test('should return HTTP 200 with execution, rebalance, and matchmaking results', async () => {
      const res = await request(app).post('/api/admin/team-2v2-league/trigger').send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.event).toBe('team_2v2_league');
      expect(res.body.execution).toEqual({ matchesCompleted: 2, matchesCancelled: 0 });
      expect(res.body.matchmaking).toEqual({ matchesCreated: 3 });
      expect(res.body.timestamp).toBeDefined();
      expect(mockExecuteScheduledTeamBattles).toHaveBeenCalledWith(2);
      expect(mockRunTeamBattleMatchmaking).toHaveBeenCalledWith(2);
    });

    test('should emit audit log on success', async () => {
      await request(app).post('/api/admin/team-2v2-league/trigger').send({});

      expect(mockRecordAction).toHaveBeenCalledWith(
        1,
        'team_battle',
        'success',
        expect.objectContaining({ action: 'trigger_cycle', teamSize: 2 }),
      );
    });

    test('should require authentication (401 without token)', async () => {
      mockUser = null;
      const res = await request(app).post('/api/admin/team-2v2-league/trigger').send({});
      expect(res.status).toBe(401);
    });

    test('should require admin role (403 for non-admin)', async () => {
      mockUser = { userId: 2, username: 'player', role: 'user' };
      const res = await request(app).post('/api/admin/team-2v2-league/trigger').send({});
      expect(res.status).toBe(403);
    });

    test('should return 500 and emit failure audit log on error', async () => {
      mockExecuteScheduledTeamBattles.mockRejectedValue(new Error('DB error'));

      const res = await request(app).post('/api/admin/team-2v2-league/trigger').send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to trigger Team 2v2 League cycle');
      expect(mockRecordAction).toHaveBeenCalledWith(
        1,
        'team_battle',
        'failure',
        expect.objectContaining({ action: 'trigger_cycle', teamSize: 2, error: 'DB error' }),
      );
    });
  });

  describe('POST /api/admin/team-3v3-league/trigger', () => {
    test('should return HTTP 200 with execution, rebalance, and matchmaking results', async () => {
      const res = await request(app).post('/api/admin/team-3v3-league/trigger').send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.event).toBe('team_3v3_league');
      expect(res.body.execution).toEqual({ matchesCompleted: 2, matchesCancelled: 0 });
      expect(res.body.matchmaking).toEqual({ matchesCreated: 3 });
      expect(mockExecuteScheduledTeamBattles).toHaveBeenCalledWith(3);
      expect(mockRunTeamBattleMatchmaking).toHaveBeenCalledWith(3);
    });

    test('should emit audit log on success', async () => {
      await request(app).post('/api/admin/team-3v3-league/trigger').send({});

      expect(mockRecordAction).toHaveBeenCalledWith(
        1,
        'team_battle',
        'success',
        expect.objectContaining({ action: 'trigger_cycle', teamSize: 3 }),
      );
    });

    test('should require authentication (401 without token)', async () => {
      mockUser = null;
      const res = await request(app).post('/api/admin/team-3v3-league/trigger').send({});
      expect(res.status).toBe(401);
    });

    test('should require admin role (403 for non-admin)', async () => {
      mockUser = { userId: 2, username: 'player', role: 'user' };
      const res = await request(app).post('/api/admin/team-3v3-league/trigger').send({});
      expect(res.status).toBe(403);
    });

    test('should return 500 and emit failure audit log on error', async () => {
      mockExecuteScheduledTeamBattles.mockRejectedValue(new Error('Timeout'));

      const res = await request(app).post('/api/admin/team-3v3-league/trigger').send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to trigger Team 3v3 League cycle');
      expect(mockRecordAction).toHaveBeenCalledWith(
        1,
        'team_battle',
        'failure',
        expect.objectContaining({ action: 'trigger_cycle', teamSize: 3, error: 'Timeout' }),
      );
    });
  });
});

describe('Admin team battle endpoints (R14.3, R14.4, R14.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { userId: 1, username: 'admin', role: 'admin' };
  });

  describe('POST /api/admin/team-battles/matchmaking', () => {
    test('should invoke matchmaking for teamSize 2 and return success', async () => {
      mockRunTeamBattleMatchmaking.mockResolvedValue(5);

      const res = await request(app)
        .post('/api/admin/team-battles/matchmaking')
        .send({ teamSize: 2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.matchesCreated).toBe(5);
      expect(res.body.teamSize).toBe(2);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.scheduledFor).toBeDefined();
      expect(mockRunTeamBattleMatchmaking).toHaveBeenCalledWith(2, expect.any(Date));
    });

    test('should invoke matchmaking for teamSize 3 and return success', async () => {
      mockRunTeamBattleMatchmaking.mockResolvedValue(3);

      const res = await request(app)
        .post('/api/admin/team-battles/matchmaking')
        .send({ teamSize: 3 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.matchesCreated).toBe(3);
      expect(res.body.teamSize).toBe(3);
      expect(mockRunTeamBattleMatchmaking).toHaveBeenCalledWith(3, expect.any(Date));
    });

    test('should emit audit log on success', async () => {
      mockRunTeamBattleMatchmaking.mockResolvedValue(4);

      await request(app)
        .post('/api/admin/team-battles/matchmaking')
        .send({ teamSize: 2 });

      expect(mockRecordAction).toHaveBeenCalledWith(
        1,
        'team_battle',
        'success',
        expect.objectContaining({ action: 'matchmaking', teamSize: 2, matchesCreated: 4 }),
      );
    });

    test('should emit audit log on failure', async () => {
      mockRunTeamBattleMatchmaking.mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app)
        .post('/api/admin/team-battles/matchmaking')
        .send({ teamSize: 2 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to run team battle matchmaking');
      expect(mockRecordAction).toHaveBeenCalledWith(
        1,
        'team_battle',
        'failure',
        expect.objectContaining({ action: 'matchmaking', error: 'DB connection lost' }),
      );
    });

    test('should require authentication (401 without token)', async () => {
      mockUser = null;

      const res = await request(app)
        .post('/api/admin/team-battles/matchmaking')
        .send({ teamSize: 2 });

      expect(res.status).toBe(401);
      expect(mockRunTeamBattleMatchmaking).not.toHaveBeenCalled();
    });

    test('should require admin role (403 for non-admin)', async () => {
      mockUser = { userId: 2, username: 'player', role: 'user' };

      const res = await request(app)
        .post('/api/admin/team-battles/matchmaking')
        .send({ teamSize: 2 });

      expect(res.status).toBe(403);
      expect(mockRunTeamBattleMatchmaking).not.toHaveBeenCalled();
    });

    test('should reject invalid teamSize via Zod validation', async () => {
      const res = await request(app)
        .post('/api/admin/team-battles/matchmaking')
        .send({ teamSize: 4 });

      expect(res.status).toBe(400);
      expect(mockRunTeamBattleMatchmaking).not.toHaveBeenCalled();
    });

    test('should reject missing teamSize via Zod validation', async () => {
      const res = await request(app)
        .post('/api/admin/team-battles/matchmaking')
        .send({});

      expect(res.status).toBe(400);
      expect(mockRunTeamBattleMatchmaking).not.toHaveBeenCalled();
    });

    test('should reject non-numeric teamSize via Zod validation', async () => {
      const res = await request(app)
        .post('/api/admin/team-battles/matchmaking')
        .send({ teamSize: 'two' });

      expect(res.status).toBe(400);
      expect(mockRunTeamBattleMatchmaking).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/team-battles/battles', () => {
    const mockSummary = { matchesCompleted: 3, matchesCancelled: 0, results: [] };

    test('should invoke battle execution for teamSize 2 and return success', async () => {
      mockExecuteScheduledTeamBattles.mockResolvedValue(mockSummary);

      const res = await request(app)
        .post('/api/admin/team-battles/battles')
        .send({ teamSize: 2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toEqual(mockSummary);
      expect(res.body.teamSize).toBe(2);
      expect(res.body.timestamp).toBeDefined();
      expect(mockExecuteScheduledTeamBattles).toHaveBeenCalledWith(2);
    });

    test('should invoke battle execution for teamSize 3 and return success', async () => {
      const summary3v3 = { matchesCompleted: 2, matchesCancelled: 1, results: [] };
      mockExecuteScheduledTeamBattles.mockResolvedValue(summary3v3);

      const res = await request(app)
        .post('/api/admin/team-battles/battles')
        .send({ teamSize: 3 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toEqual(summary3v3);
      expect(res.body.teamSize).toBe(3);
      expect(mockExecuteScheduledTeamBattles).toHaveBeenCalledWith(3);
    });

    test('should emit audit log on success', async () => {
      mockExecuteScheduledTeamBattles.mockResolvedValue(mockSummary);

      await request(app)
        .post('/api/admin/team-battles/battles')
        .send({ teamSize: 3 });

      expect(mockRecordAction).toHaveBeenCalledWith(
        1,
        'team_battle',
        'success',
        expect.objectContaining({ action: 'battles_run', teamSize: 3, matchesCompleted: mockSummary.matchesCompleted, matchesCancelled: mockSummary.matchesCancelled }),
      );
    });

    test('should emit audit log on failure', async () => {
      mockExecuteScheduledTeamBattles.mockRejectedValue(new Error('Simulation timeout'));

      const res = await request(app)
        .post('/api/admin/team-battles/battles')
        .send({ teamSize: 2 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to execute team battles');
      expect(mockRecordAction).toHaveBeenCalledWith(
        1,
        'team_battle',
        'failure',
        expect.objectContaining({ action: 'battles_run', error: 'Simulation timeout' }),
      );
    });

    test('should require authentication (401 without token)', async () => {
      mockUser = null;

      const res = await request(app)
        .post('/api/admin/team-battles/battles')
        .send({ teamSize: 2 });

      expect(res.status).toBe(401);
      expect(mockExecuteScheduledTeamBattles).not.toHaveBeenCalled();
    });

    test('should require admin role (403 for non-admin)', async () => {
      mockUser = { userId: 2, username: 'player', role: 'user' };

      const res = await request(app)
        .post('/api/admin/team-battles/battles')
        .send({ teamSize: 3 });

      expect(res.status).toBe(403);
      expect(mockExecuteScheduledTeamBattles).not.toHaveBeenCalled();
    });

    test('should reject invalid teamSize via Zod validation', async () => {
      const res = await request(app)
        .post('/api/admin/team-battles/battles')
        .send({ teamSize: 1 });

      expect(res.status).toBe(400);
      expect(mockExecuteScheduledTeamBattles).not.toHaveBeenCalled();
    });

    test('should reject missing teamSize via Zod validation', async () => {
      const res = await request(app)
        .post('/api/admin/team-battles/battles')
        .send({});

      expect(res.status).toBe(400);
      expect(mockExecuteScheduledTeamBattles).not.toHaveBeenCalled();
    });

    test('should reject non-numeric teamSize via Zod validation', async () => {
      const res = await request(app)
        .post('/api/admin/team-battles/battles')
        .send({ teamSize: 'three' });

      expect(res.status).toBe(400);
      expect(mockExecuteScheduledTeamBattles).not.toHaveBeenCalled();
    });
  });
});

describe('Admin team-tournament trigger endpoints (R8.3, R8.5, R8.7, R8.8)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { userId: 1, username: 'admin', role: 'admin' };
    mockExecuteTeamTournamentRound.mockResolvedValue({ matchesExecuted: 3, matchesFailed: 0 });
    mockAdvanceWinnersToNextRound.mockResolvedValue(undefined);
  });

  describe('POST /api/admin/team-2v2-tournament/trigger', () => {
    test('should return 404 when no active 2v2 tournament exists (R8.7)', async () => {
      mockPrisma.tournament.findFirst = jest.fn().mockResolvedValue(null);

      const res = await request(app).post('/api/admin/team-2v2-tournament/trigger').send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('No active 2v2 tournament available');
    });

    test('should execute round and return results when active tournament exists (R8.3)', async () => {
      mockPrisma.tournament.findFirst = jest.fn().mockResolvedValue({
        id: 10,
        name: '2v2 Tournament #1',
        participantType: 'team_2v2',
        status: 'active',
      });
      mockPrisma.tournament.findUnique = jest.fn().mockResolvedValue({
        id: 10,
        status: 'active',
        winnerId: null,
      });

      const res = await request(app).post('/api/admin/team-2v2-tournament/trigger').send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        matchesExecuted: 3,
        matchesFailed: 0,
        tournamentComplete: false,
        championTeamId: null,
      });
      expect(mockExecuteTeamTournamentRound).toHaveBeenCalledWith(10, 2);
      expect(mockAdvanceWinnersToNextRound).toHaveBeenCalledWith(10);
    });

    test('should return tournamentComplete=true and championTeamId when tournament completes', async () => {
      mockPrisma.tournament.findFirst = jest.fn().mockResolvedValue({
        id: 10,
        name: '2v2 Tournament #1',
        participantType: 'team_2v2',
        status: 'active',
      });
      mockPrisma.tournament.findUnique = jest.fn().mockResolvedValue({
        id: 10,
        status: 'completed',
        winnerId: 42,
      });

      const res = await request(app).post('/api/admin/team-2v2-tournament/trigger').send({});

      expect(res.status).toBe(200);
      expect(res.body.tournamentComplete).toBe(true);
      expect(res.body.championTeamId).toBe(42);
    });

    test('should record audit trail entry on success (R8.8)', async () => {
      mockPrisma.tournament.findFirst = jest.fn().mockResolvedValue({
        id: 10,
        name: '2v2 Tournament #1',
        participantType: 'team_2v2',
        status: 'active',
      });
      mockPrisma.tournament.findUnique = jest.fn().mockResolvedValue({
        id: 10,
        status: 'active',
        winnerId: null,
      });

      await request(app).post('/api/admin/team-2v2-tournament/trigger').send({});

      expect(mockRecordAction).toHaveBeenCalledWith(
        1,
        'team_tournament_trigger',
        'success',
        expect.objectContaining({
          tournamentType: '2v2',
          tournamentId: 10,
          tournamentName: '2v2 Tournament #1',
          matchesExecuted: 3,
          matchesFailed: 0,
        }),
      );
    });

    test('should require authentication (401 without token)', async () => {
      mockUser = null;
      const res = await request(app).post('/api/admin/team-2v2-tournament/trigger').send({});
      expect(res.status).toBe(401);
    });

    test('should require admin role (403 for non-admin)', async () => {
      mockUser = { userId: 2, username: 'player', role: 'user' };
      const res = await request(app).post('/api/admin/team-2v2-tournament/trigger').send({});
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/team-3v3-tournament/trigger', () => {
    test('should return 404 when no active 3v3 tournament exists (R8.7)', async () => {
      mockPrisma.tournament.findFirst = jest.fn().mockResolvedValue(null);

      const res = await request(app).post('/api/admin/team-3v3-tournament/trigger').send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('No active 3v3 tournament available');
    });

    test('should execute round and return results when active tournament exists (R8.3)', async () => {
      mockPrisma.tournament.findFirst = jest.fn().mockResolvedValue({
        id: 20,
        name: '3v3 Tournament #1',
        participantType: 'team_3v3',
        status: 'active',
      });
      mockPrisma.tournament.findUnique = jest.fn().mockResolvedValue({
        id: 20,
        status: 'active',
        winnerId: null,
      });

      const res = await request(app).post('/api/admin/team-3v3-tournament/trigger').send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        matchesExecuted: 3,
        matchesFailed: 0,
        tournamentComplete: false,
        championTeamId: null,
      });
      expect(mockExecuteTeamTournamentRound).toHaveBeenCalledWith(20, 3);
      expect(mockAdvanceWinnersToNextRound).toHaveBeenCalledWith(20);
    });

    test('should return tournamentComplete=true and championTeamId when tournament completes', async () => {
      mockPrisma.tournament.findFirst = jest.fn().mockResolvedValue({
        id: 20,
        name: '3v3 Tournament #1',
        participantType: 'team_3v3',
        status: 'active',
      });
      mockPrisma.tournament.findUnique = jest.fn().mockResolvedValue({
        id: 20,
        status: 'completed',
        winnerId: 99,
      });

      const res = await request(app).post('/api/admin/team-3v3-tournament/trigger').send({});

      expect(res.status).toBe(200);
      expect(res.body.tournamentComplete).toBe(true);
      expect(res.body.championTeamId).toBe(99);
    });

    test('should record audit trail entry on success (R8.8)', async () => {
      mockPrisma.tournament.findFirst = jest.fn().mockResolvedValue({
        id: 20,
        name: '3v3 Tournament #1',
        participantType: 'team_3v3',
        status: 'active',
      });
      mockPrisma.tournament.findUnique = jest.fn().mockResolvedValue({
        id: 20,
        status: 'active',
        winnerId: null,
      });

      await request(app).post('/api/admin/team-3v3-tournament/trigger').send({});

      expect(mockRecordAction).toHaveBeenCalledWith(
        1,
        'team_tournament_trigger',
        'success',
        expect.objectContaining({
          tournamentType: '3v3',
          tournamentId: 20,
          tournamentName: '3v3 Tournament #1',
          matchesExecuted: 3,
          matchesFailed: 0,
        }),
      );
    });

    test('should require authentication (401 without token)', async () => {
      mockUser = null;
      const res = await request(app).post('/api/admin/team-3v3-tournament/trigger').send({});
      expect(res.status).toBe(401);
    });

    test('should require admin role (403 for non-admin)', async () => {
      mockUser = { userId: 2, username: 'player', role: 'user' };
      const res = await request(app).post('/api/admin/team-3v3-tournament/trigger').send({});
      expect(res.status).toBe(403);
    });
  });
});
