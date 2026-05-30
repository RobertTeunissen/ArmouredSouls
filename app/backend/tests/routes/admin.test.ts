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
  tagTeam: { updateMany: jest.fn() },
  tournament: { findUnique: jest.fn() },
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

jest.mock('../../src/utils/economyCalculations', () => ({
  __esModule: true,
  processAllDailyFinances: jest.fn(),
}));

jest.mock('../../src/services/cycle/cycleScheduler', () => ({
  __esModule: true,
  getSchedulerState: jest.fn().mockReturnValue({ active: false, runningJob: null, queue: [], jobs: [] }),
  runJob: jest.fn(),
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
    { path: '/api/admin/team-2v2-league/trigger', event: 'team_2v2_league' },
    { path: '/api/admin/team-3v3-league/trigger', event: 'team_3v3_league' },
    { path: '/api/admin/team-2v2-tournament/trigger', event: 'team_2v2_tournament' },
    { path: '/api/admin/team-3v3-tournament/trigger', event: 'team_3v3_tournament' },
    { path: '/api/admin/grand-melee/trigger', event: 'grand_melee' },
  ];

  describe.each(reservedSlotEndpoints)('POST $path', ({ path, event }) => {
    test('should return HTTP 200 with correct body', async () => {
      const res = await request(app).post(path).send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: 'reserved slot, no handler implemented',
        event,
      });
    });

    test('should create an adminAuditLog row per invocation', async () => {
      await request(app).post(path).send({});

      expect(mockRecordAction).toHaveBeenCalledWith(
        1, // userId
        'reserved_slot_trigger',
        'success',
        expect.objectContaining({ event, outcome: 'no-op' }),
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
