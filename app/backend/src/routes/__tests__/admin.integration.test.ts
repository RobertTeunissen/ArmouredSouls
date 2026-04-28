/**
 * Integration tests for new admin API endpoints.
 *
 * Tests the 10 new endpoints added by the Admin Portal Redesign spec:
 * - GET /api/admin/dashboard/kpis
 * - GET /api/admin/engagement/players
 * - GET /api/admin/economy/overview
 * - GET /api/admin/league-health
 * - GET /api/admin/weapons/analytics
 * - GET /api/admin/achievements/analytics
 * - GET /api/admin/tuning/adoption
 * - GET /api/admin/audit-log
 * - POST /api/admin/audit-log
 * - GET /api/admin/users/search (with robot name)
 *
 * Mocks auth middleware, service layer, and external dependencies
 * to isolate route handler logic.
 *
 * Requirements: 5.1, 9.2, 13.1, 14.1, 15.1, 16.1, 17.1, 18.1, 19.3
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockGetDashboardKpis = jest.fn();
const mockGetEngagementPlayers = jest.fn();
const mockGetEconomyOverview = jest.fn();
const mockGetLeagueHealth = jest.fn();
const mockGetWeaponAnalytics = jest.fn();
const mockGetAchievementAnalytics = jest.fn();
const mockGetTuningAdoption = jest.fn();
const mockGetAuditEntries = jest.fn();
const mockRecordAuditAction = jest.fn();

jest.mock('../../services/admin/adminStatsService', () => ({
  getSystemStats: jest.fn(),
  getAtRiskUsers: jest.fn(),
  getRobotAttributeStats: jest.fn(),
  getRecentUserActivity: jest.fn(),
  getRepairAuditLog: jest.fn(),
  getDashboardKpis: (...args: unknown[]) => mockGetDashboardKpis(...args),
  getEngagementPlayers: (...args: unknown[]) => mockGetEngagementPlayers(...args),
  getEconomyOverview: (...args: unknown[]) => mockGetEconomyOverview(...args),
  getLeagueHealth: (...args: unknown[]) => mockGetLeagueHealth(...args),
  getWeaponAnalytics: (...args: unknown[]) => mockGetWeaponAnalytics(...args),
  getAchievementAnalytics: (...args: unknown[]) => mockGetAchievementAnalytics(...args),
  getTuningAdoption: (...args: unknown[]) => mockGetTuningAdoption(...args),
}));

jest.mock('../../services/admin/adminAuditLogService', () => ({
  recordAction: (...args: unknown[]) => mockRecordAuditAction(...args),
  getEntries: (...args: unknown[]) => mockGetAuditEntries(...args),
}));

// Mock auth middleware — admin user by default
let mockUser: { userId: number; username: string; role: string } | null = {
  userId: 1,
  username: 'admin',
  role: 'admin',
};

jest.mock('../../middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authenticateToken: (req: any, _res: any, next: any) => {
    if (!mockUser) {
      return _res.status(401).json({ error: 'Access token required' });
    }
    req.user = mockUser;
    next();
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// Mock logger
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock security monitor
jest.mock('../../services/security/securityMonitor', () => ({
  securityMonitor: {
    logValidationFailure: jest.fn(),
    trackRateLimitViolation: jest.fn(),
    logAuthorizationFailure: jest.fn(),
    logAdminAccess: jest.fn(),
    recordEvent: jest.fn(),
    getRecentEvents: jest.fn().mockReturnValue([]),
    getSummary: jest.fn().mockReturnValue({}),
    setStableName: jest.fn(),
    trackConflict: jest.fn(),
  },
  SecuritySeverity: { INFO: 'info', WARNING: 'warning', CRITICAL: 'critical' },
}));

// Mock prisma for user search endpoint
const mockPrismaUserFindMany = jest.fn().mockResolvedValue([]);
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findMany: (...args: unknown[]) => mockPrismaUserFindMany(...args),
    },
  },
}));

// Mock other services used by admin routes that we don't test here
jest.mock('../../services/league/leagueBattleOrchestrator', () => ({
  executeScheduledBattles: jest.fn(),
}));
jest.mock('../../services/analytics/matchmakingService', () => ({
  runMatchmaking: jest.fn(),
}));
jest.mock('../../services/league/leagueRebalancingService', () => ({
  rebalanceLeagues: jest.fn(),
}));
jest.mock('../../services/tag-team/tagTeamLeagueRebalancingService', () => ({
  rebalanceTagTeamLeagues: jest.fn(),
}));
jest.mock('../../services/tag-team/tagTeamMatchmakingService', () => ({
  runTagTeamMatchmaking: jest.fn(),
}));
jest.mock('../../services/tag-team/tagTeamBattleOrchestrator', () => ({
  executeScheduledTagTeamBattles: jest.fn(),
}));
jest.mock('../../utils/economyCalculations', () => ({
  processAllDailyFinances: jest.fn(),
}));
jest.mock('../../services/cycle/cycleScheduler', () => ({
  getSchedulerState: jest.fn().mockReturnValue({ active: false }),
}));
jest.mock('../../services/admin/adminBattleService', () => ({
  getAdminBattleList: jest.fn(),
  getAdminBattleDetail: jest.fn(),
}));
jest.mock('../../services/admin/adminMaintenanceService', () => ({
  repairAllRobotsAdmin: jest.fn(),
  recalculateAllRobotHP: jest.fn(),
}));
jest.mock('../../services/admin/adminCycleService', () => ({
  executeBulkCycles: jest.fn(),
  backfillCycleSnapshots: jest.fn(),
}));
jest.mock('../../services/practice-arena/practiceArenaMetrics', () => ({
  practiceArenaMetrics: {
    getStats: jest.fn().mockReturnValue({}),
    getHistory: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../../services/auth/passwordResetService', () => ({
  resetPassword: jest.fn(),
}));
jest.mock('../../utils/validation', () => ({
  validatePassword: jest.fn().mockReturnValue({ valid: true }),
}));
jest.mock('../../services/moderation/adminUploadsHandler', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleAdminUploads: jest.fn((_req: any, res: any) => res.json([])),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleAdminCleanup: jest.fn((_req: any, res: any) => res.json({ success: true })),
}));
jest.mock('../adminTournaments', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Router } = require('express');
  return { __esModule: true, default: Router() };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import request from 'supertest';
import express from 'express';
import adminRouter from '../admin';
import { errorHandler } from '../../middleware/errorHandler';

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleKpis = {
  inactiveRealPlayers: 5,
  battlesToday: 42,
  scheduledMatches: 10,
  currentCycle: 100,
  trends: {
    inactiveRealPlayers: { direction: 'up', previous: 3 },
    battlesToday: { direction: 'down', previous: 50 },
  },
};

const sampleEngagement = {
  players: [
    {
      userId: 1,
      username: 'player1',
      stableName: 'Stable One',
      lastLoginAt: '2026-04-20T12:00:00.000Z',
      daysSinceLogin: 3,
      churnRisk: 'medium',
      activityIndicators: {
        checkedMatches: true,
        investedFacilities: false,
        boughtWeapons: true,
        upgradedAttributes: false,
      },
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
};

const sampleEconomy = {
  totalCreditsInCirculation: 5000000,
  inflationRate: 2.5,
  averagePlayerIncome: 15000,
  averagePlayerCosts: 12000,
  weaponPurchaseTrend: [{ cycle: 99, purchases: 10 }],
  creditTrend: [{ cycle: 99, totalCredits: 4900000 }],
};

const sampleLeagueHealth = {
  solo: {
    tiers: [
      { tier: 'bronze', robotCount: 20, avgElo: 1000, promotionEligible: 5, demotionEligible: 2 },
    ],
  },
  tagTeam: {
    tiers: [
      { tier: 'bronze', teamCount: 8, avgElo: 1000, promotionEligible: 2, demotionEligible: 1 },
    ],
  },
};

const sampleWeaponAnalytics = {
  weapons: [
    {
      id: 1,
      name: 'Laser Cannon',
      tier: 'common',
      purchaseCount: 50,
      equipCount: 30,
      equipRate: 0.6,
      neverPurchased: false,
      highPurchaseLowEquip: false,
      pricePerformanceOutlier: false,
    },
  ],
  summary: { totalWeapons: 1, totalPurchases: 50, avgEquipRate: 0.6 },
};

const sampleAchievementAnalytics = {
  achievements: [
    {
      id: 'C1',
      name: "I'll Be Back",
      unlockRate: 0.75,
      totalUnlocks: 15,
      difficultyFlag: null,
      rarity: 'common',
    },
  ],
  summary: { total: 1, avgUnlockRate: 0.75, tooHard: 0, tooEasy: 0 },
};

const sampleTuningAdoption = {
  aggregate: {
    totalRobotsWithTuning: 30,
    percentageEligible: 0.6,
    averagePoolUtilization: 0.45,
  },
  players: [
    { userId: 1, username: 'player1', robotsWithTuning: 2, totalRobots: 3 },
  ],
};

const sampleAuditEntries = {
  entries: [
    {
      id: 1,
      adminUserId: 1,
      operationType: 'matchmaking_run',
      operationResult: 'success',
      resultSummary: { matchesCreated: 10 },
      createdAt: new Date('2026-04-20T12:00:00.000Z'),
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin API — New Endpoints Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { userId: 1, username: 'admin', role: 'admin' };
  });

  // -----------------------------------------------------------------------
  // Authentication & Authorization (shared across all endpoints)
  // -----------------------------------------------------------------------

  describe('Authentication & Authorization', () => {
    it('should return 401 when no auth token is provided', async () => {
      mockUser = null;

      const res = await request(app).get('/api/admin/dashboard/kpis');

      expect(res.status).toBe(401);
    });

    it('should return 403 when non-admin user accesses admin endpoint', async () => {
      mockUser = { userId: 2, username: 'player', role: 'user' };

      const res = await request(app).get('/api/admin/dashboard/kpis');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access required');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/dashboard/kpis
  // -----------------------------------------------------------------------

  describe('GET /api/admin/dashboard/kpis', () => {
    it('should return KPI data with correct response shape', async () => {
      mockGetDashboardKpis.mockResolvedValue(sampleKpis);

      const res = await request(app).get('/api/admin/dashboard/kpis');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('inactiveRealPlayers');
      expect(res.body).toHaveProperty('battlesToday');
      expect(res.body).toHaveProperty('scheduledMatches');
      expect(res.body).toHaveProperty('currentCycle');
    });

    it('should pass filter parameter to service', async () => {
      mockGetDashboardKpis.mockResolvedValue(sampleKpis);

      await request(app).get('/api/admin/dashboard/kpis?filter=auto');

      expect(mockGetDashboardKpis).toHaveBeenCalledWith('auto', expect.any(Object));
    });

    it('should default filter to real', async () => {
      mockGetDashboardKpis.mockResolvedValue(sampleKpis);

      await request(app).get('/api/admin/dashboard/kpis');

      expect(mockGetDashboardKpis).toHaveBeenCalledWith('real', expect.any(Object));
    });

    it('should reject invalid filter values via Zod validation', async () => {
      const res = await request(app).get('/api/admin/dashboard/kpis?filter=invalid');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/engagement/players
  // -----------------------------------------------------------------------

  describe('GET /api/admin/engagement/players', () => {
    it('should return engagement data with correct response shape', async () => {
      mockGetEngagementPlayers.mockResolvedValue(sampleEngagement);

      const res = await request(app).get('/api/admin/engagement/players');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('players');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.players)).toBe(true);
    });

    it('should pass pagination and sort parameters to service', async () => {
      mockGetEngagementPlayers.mockResolvedValue(sampleEngagement);

      await request(app).get(
        '/api/admin/engagement/players?page=2&pageSize=10&sortBy=username&sortOrder=asc&filter=all'
      );

      expect(mockGetEngagementPlayers).toHaveBeenCalledWith(
        { page: 2, pageSize: 10, sortBy: 'username', sortOrder: 'asc' },
        expect.any(Object),
      );
    });

    it('should reject invalid sortBy values via Zod validation', async () => {
      const res = await request(app).get(
        '/api/admin/engagement/players?sortBy=invalidField'
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid filter values', async () => {
      const res = await request(app).get(
        '/api/admin/engagement/players?filter=bogus'
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/economy/overview
  // -----------------------------------------------------------------------

  describe('GET /api/admin/economy/overview', () => {
    it('should return economy overview with correct response shape', async () => {
      mockGetEconomyOverview.mockResolvedValue(sampleEconomy);

      const res = await request(app).get('/api/admin/economy/overview');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalCreditsInCirculation');
      expect(res.body).toHaveProperty('inflationRate');
      expect(res.body).toHaveProperty('averagePlayerIncome');
      expect(res.body).toHaveProperty('averagePlayerCosts');
    });

    it('should propagate service errors as 500', async () => {
      mockGetEconomyOverview.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/admin/economy/overview');

      expect(res.status).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/league-health
  // -----------------------------------------------------------------------

  describe('GET /api/admin/league-health', () => {
    it('should return league health data with correct response shape', async () => {
      mockGetLeagueHealth.mockResolvedValue(sampleLeagueHealth);

      const res = await request(app).get('/api/admin/league-health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('solo');
      expect(res.body).toHaveProperty('tagTeam');
    });

    it('should propagate service errors as 500', async () => {
      mockGetLeagueHealth.mockRejectedValue(new Error('Query failed'));

      const res = await request(app).get('/api/admin/league-health');

      expect(res.status).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/weapons/analytics
  // -----------------------------------------------------------------------

  describe('GET /api/admin/weapons/analytics', () => {
    it('should return weapon analytics with correct response shape', async () => {
      mockGetWeaponAnalytics.mockResolvedValue(sampleWeaponAnalytics);

      const res = await request(app).get('/api/admin/weapons/analytics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('weapons');
      expect(res.body).toHaveProperty('summary');
      expect(Array.isArray(res.body.weapons)).toBe(true);
    });

    it('should pass user filter to service', async () => {
      mockGetWeaponAnalytics.mockResolvedValue(sampleWeaponAnalytics);

      await request(app).get('/api/admin/weapons/analytics?filter=auto');

      expect(mockGetWeaponAnalytics).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should reject invalid filter values', async () => {
      const res = await request(app).get('/api/admin/weapons/analytics?filter=bad');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/achievements/analytics
  // -----------------------------------------------------------------------

  describe('GET /api/admin/achievements/analytics', () => {
    it('should return achievement analytics with correct response shape', async () => {
      mockGetAchievementAnalytics.mockResolvedValue(sampleAchievementAnalytics);

      const res = await request(app).get('/api/admin/achievements/analytics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('achievements');
      expect(res.body).toHaveProperty('summary');
      expect(Array.isArray(res.body.achievements)).toBe(true);
    });

    it('should pass user filter to service', async () => {
      mockGetAchievementAnalytics.mockResolvedValue(sampleAchievementAnalytics);

      await request(app).get('/api/admin/achievements/analytics?filter=all');

      expect(mockGetAchievementAnalytics).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should reject invalid filter values', async () => {
      const res = await request(app).get('/api/admin/achievements/analytics?filter=nope');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/tuning/adoption
  // -----------------------------------------------------------------------

  describe('GET /api/admin/tuning/adoption', () => {
    it('should return tuning adoption data with correct response shape', async () => {
      mockGetTuningAdoption.mockResolvedValue(sampleTuningAdoption);

      const res = await request(app).get('/api/admin/tuning/adoption');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('aggregate');
      expect(res.body).toHaveProperty('players');
    });

    it('should pass adoptionFilter to service', async () => {
      mockGetTuningAdoption.mockResolvedValue(sampleTuningAdoption);

      await request(app).get('/api/admin/tuning/adoption?adoptionFilter=zero');

      expect(mockGetTuningAdoption).toHaveBeenCalledWith('zero');
    });

    it('should default adoptionFilter to all', async () => {
      mockGetTuningAdoption.mockResolvedValue(sampleTuningAdoption);

      await request(app).get('/api/admin/tuning/adoption');

      expect(mockGetTuningAdoption).toHaveBeenCalledWith('all');
    });

    it('should reject invalid adoptionFilter values', async () => {
      const res = await request(app).get('/api/admin/tuning/adoption?adoptionFilter=invalid');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/audit-log
  // -----------------------------------------------------------------------

  describe('GET /api/admin/audit-log', () => {
    it('should return paginated audit log entries', async () => {
      mockGetAuditEntries.mockResolvedValue(sampleAuditEntries);

      const res = await request(app).get('/api/admin/audit-log');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('entries');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('totalPages');
      expect(Array.isArray(res.body.entries)).toBe(true);
    });

    it('should pass pagination and filter parameters', async () => {
      mockGetAuditEntries.mockResolvedValue(sampleAuditEntries);

      await request(app).get(
        '/api/admin/audit-log?page=2&pageSize=10&operationType=matchmaking_run'
      );

      expect(mockGetAuditEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 10,
          operationType: 'matchmaking_run',
        }),
      );
    });

    it('should reject pageSize exceeding max (100)', async () => {
      const res = await request(app).get('/api/admin/audit-log?pageSize=200');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/admin/audit-log
  // -----------------------------------------------------------------------

  describe('POST /api/admin/audit-log', () => {
    it('should record an audit action and return 201', async () => {
      const res = await request(app)
        .post('/api/admin/audit-log')
        .send({
          operationType: 'manual_test',
          operationResult: 'success',
          resultSummary: { detail: 'test entry' },
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true });
      expect(mockRecordAuditAction).toHaveBeenCalledWith(
        1,
        'manual_test',
        'success',
        { detail: 'test entry' },
      );
    });

    it('should reject missing operationType', async () => {
      const res = await request(app)
        .post('/api/admin/audit-log')
        .send({
          operationResult: 'success',
          resultSummary: {},
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid operationResult', async () => {
      const res = await request(app)
        .post('/api/admin/audit-log')
        .send({
          operationType: 'test',
          operationResult: 'maybe',
          resultSummary: {},
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing resultSummary', async () => {
      const res = await request(app)
        .post('/api/admin/audit-log')
        .send({
          operationType: 'test',
          operationResult: 'success',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty operationType', async () => {
      const res = await request(app)
        .post('/api/admin/audit-log')
        .send({
          operationType: '',
          operationResult: 'success',
          resultSummary: {},
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/admin/users/search (with robot name)
  // -----------------------------------------------------------------------

  describe('GET /api/admin/users/search', () => {
    const sampleUsers = [
      { id: 1, username: 'player1', email: 'p1@test.com', stableName: 'Stable One' },
    ];

    it('should return search results with correct response shape', async () => {
      mockPrismaUserFindMany.mockResolvedValue(sampleUsers);

      const res = await request(app).get('/api/admin/users/search?q=player');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('should search by robot name (calls prisma with robot relation filter)', async () => {
      mockPrismaUserFindMany.mockResolvedValue(sampleUsers);

      await request(app).get('/api/admin/users/search?q=Ultron');

      // The endpoint makes multiple prisma calls (by ID, username, email, stableName, robotName)
      // At least one call should include the robots relation filter
      const calls = mockPrismaUserFindMany.mock.calls;
      const robotNameCall = calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any) => call[0]?.where?.robots?.some?.name
      );
      expect(robotNameCall).toBeDefined();
    });

    it('should reject missing q parameter', async () => {
      const res = await request(app).get('/api/admin/users/search');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject q parameter exceeding max length (50)', async () => {
      const longQuery = 'a'.repeat(51);
      const res = await request(app).get(`/api/admin/users/search?q=${longQuery}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should deduplicate results by user ID', async () => {
      const duplicateUser = { id: 1, username: 'player1', email: 'p1@test.com', stableName: 'Stable One' };
      // Return the same user from multiple search paths
      mockPrismaUserFindMany.mockResolvedValue([duplicateUser]);

      const res = await request(app).get('/api/admin/users/search?q=player1');

      expect(res.status).toBe(200);
      // Even though the same user is returned from multiple queries,
      // the endpoint deduplicates by ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userIds = res.body.users.map((u: any) => u.id);
      const uniqueIds = new Set(userIds);
      expect(userIds.length).toBe(uniqueIds.size);
    });
  });
});
