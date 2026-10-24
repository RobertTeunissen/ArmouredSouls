/**
 * Route tests for Cycle Controls' scheduler endpoints and the bulk runner:
 * validation, status codes (202 / 200 / 400 / 404 / 409 / 401 / 403), the
 * standard error shape and audit rows. Services are mocked; the DB-backed
 * behaviour is covered by the integration and Heavy suites.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middleware/errorHandler';
import { SchedulerError, SchedulerErrorCode } from '../../src/errors/schedulerErrors';

const mockStartManualRun = jest.fn();
jest.mock('../../src/services/cycle/cycleScheduler', () => ({
  __esModule: true,
  startManualRun: (...args: unknown[]) => mockStartManualRun(...args),
  getSchedulerState: jest.fn(() => ({ active: true, runningJob: null, queue: [], jobs: [] })),
  triggerJob: jest.fn(),
}));

const mockOverview = jest.fn();
const mockListRuns = jest.fn();
const mockGetRun = jest.fn();
jest.mock('../../src/services/cycle/schedulerHistoryService', () => ({
  __esModule: true,
  MAX_HISTORY_DAYS: 30,
  getSchedulerOverview: (...args: unknown[]) => mockOverview(...args),
  listSchedulerRuns: (...args: unknown[]) => mockListRuns(...args),
  getSchedulerRun: (...args: unknown[]) => mockGetRun(...args),
}));

const mockRunBulk = jest.fn();
const mockStartBulk = jest.fn();
jest.mock('../../src/services/admin/adminBulkCycleRunService', () => ({
  __esModule: true,
  runBulkCycles: (...args: unknown[]) => mockRunBulk(...args),
  startBulkCycles: (...args: unknown[]) => mockStartBulk(...args),
}));

const mockRecordAction = jest.fn();
jest.mock('../../src/services/admin/adminAuditLogService', () => ({
  __esModule: true,
  recordAction: (...args: unknown[]) => mockRecordAction(...args),
}));

jest.mock('../../src/services/admin/adminMaintenanceService', () => ({ __esModule: true, repairAllRobotsAdmin: jest.fn(), recalculateAllRobotHP: jest.fn() }));
const mockPracticeOverview = jest.fn();
const mockPracticeStats = jest.fn();
jest.mock('../../src/services/practice-arena/practiceArenaUsageService', () => ({
  __esModule: true,
  getPracticeArenaOverview: () => mockPracticeOverview(),
  getLegacyPracticeArenaStats: () => mockPracticeStats(),
}));
jest.mock('../../src/services/admin/adminCycleService', () => ({ __esModule: true, backfillCycleSnapshots: jest.fn() }));
jest.mock('../../src/utils/economyCalculations', () => ({ __esModule: true, processAllDailyFinances: jest.fn() }));
jest.mock('../../src/config/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../../src/services/security/securityMonitor', () => ({
  securityMonitor: { logValidationFailure: jest.fn(), logAuthorizationFailure: jest.fn(), logAdminAccess: jest.fn(), trackRateLimitViolation: jest.fn() },
}));

let mockUser: { userId: number; username: string; role: string } | null = null;
jest.mock('../../src/middleware/auth', () => ({
  __esModule: true,
  authenticateToken: (req: { user?: unknown }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'Access token required', code: 'AUTH_REQUIRED' });
    req.user = mockUser;
    next();
  },
  requireAdmin: (req: { user?: { role: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
    next();
  },
}));

import schedulerRoutes from '../../src/routes/adminScheduler';
import maintenanceRoutes from '../../src/routes/adminMaintenance';

const app = express();
app.use(express.json());
app.use('/api/admin', schedulerRoutes);
app.use('/api/admin', maintenanceRoutes);
app.use(errorHandler);

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { userId: 1, username: 'admin', role: 'admin' };
});

const QUEUED_AT = new Date('2026-10-23T09:00:00.000Z');

describe('POST /api/admin/scheduler/runs', () => {
  it('starts the job in the background and answers 202 with the queued run', async () => {
    mockStartManualRun.mockResolvedValue({ runId: 41, jobName: 'grandMelee', queuedAt: QUEUED_AT });

    const res = await request(baseUrl).post('/api/admin/scheduler/runs').send({ jobName: 'grandMelee' });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ run: { id: 41, jobName: 'grandMelee', status: 'queued', queuedAt: QUEUED_AT.toISOString() } });
    expect(mockStartManualRun).toHaveBeenCalledWith('grandMelee', 1);
    expect(mockRecordAction).toHaveBeenCalledWith(1, 'scheduler_trigger', 'success', { jobName: 'grandMelee', runId: 41, background: true });
  });

  it('accepts every scheduler job', async () => {
    mockStartManualRun.mockImplementation(async (jobName: string) => ({ runId: 1, jobName, queuedAt: QUEUED_AT }));
    for (const jobName of ['league', 'team2v2League', 'tournament', 'tagTeam', 'koth', 'team3v3League', 'team2v2Tournament', 'grandMelee', 'team3v3Tournament', 'settlement']) {
      const res = await request(baseUrl).post('/api/admin/scheduler/runs').send({ jobName });
      expect(res.status).toBe(202);
    }
    expect(mockStartManualRun).toHaveBeenCalledTimes(10);
  });

  it('rejects an unknown job, a missing job and extra fields with 400', async () => {
    expect((await request(baseUrl).post('/api/admin/scheduler/runs').send({ jobName: 'notAJob' })).status).toBe(400);
    expect((await request(baseUrl).post('/api/admin/scheduler/runs').send({})).status).toBe(400);
    expect((await request(baseUrl).post('/api/admin/scheduler/runs').send({ jobName: 'league', force: true })).status).toBe(400);
    expect(mockStartManualRun).not.toHaveBeenCalled();
  });

  it('answers 409 with the standard error shape when the job is already active', async () => {
    mockStartManualRun.mockRejectedValue(new SchedulerError(SchedulerErrorCode.JOB_ALREADY_ACTIVE, 'koth is already queued or running', 409));

    const res = await request(baseUrl).post('/api/admin/scheduler/runs').send({ jobName: 'koth' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'koth is already queued or running', code: 'SCHEDULER_JOB_ALREADY_ACTIVE' });
    expect(mockRecordAction).not.toHaveBeenCalled();
  });

  it('requires an authenticated admin', async () => {
    mockUser = null;
    expect((await request(baseUrl).post('/api/admin/scheduler/runs').send({ jobName: 'league' })).status).toBe(401);
    mockUser = { userId: 2, username: 'player', role: 'user' };
    expect((await request(baseUrl).post('/api/admin/scheduler/runs').send({ jobName: 'league' })).status).toBe(403);
    expect(mockStartManualRun).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/scheduler/overview, /runs, /runs/:id', () => {
  it('returns the overview', async () => {
    mockOverview.mockResolvedValue({ scheduler: { active: true }, slots: [] });
    const res = await request(baseUrl).get('/api/admin/scheduler/overview');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ scheduler: { active: true }, slots: [] });
  });

  it('parses the history filters and applies defaults', async () => {
    mockListRuns.mockResolvedValue({ entries: [], page: 1, limit: 25, total: 0, windowDays: 7 });

    await request(baseUrl).get('/api/admin/scheduler/runs');
    expect(mockListRuns).toHaveBeenLastCalledWith({ problemsOnly: false, days: 7, page: 1, limit: 25 });

    await request(baseUrl).get('/api/admin/scheduler/runs?jobName=bulkCycles&problemsOnly=true&days=30&page=2&limit=10');
    expect(mockListRuns).toHaveBeenLastCalledWith({ jobName: 'bulkCycles', problemsOnly: true, days: 30, page: 2, limit: 10 });
  });

  it('rejects out-of-range or unknown history filters with 400', async () => {
    for (const query of ['days=31', 'days=0', 'limit=101', 'jobName=nope', 'problemsOnly=yes', 'extra=1']) {
      const res = await request(baseUrl).get(`/api/admin/scheduler/runs?${query}`);
      expect(res.status).toBe(400);
    }
    expect(mockListRuns).not.toHaveBeenCalled();
  });

  it('returns one run, 404 for a missing one and 400 for a bad id', async () => {
    mockGetRun.mockResolvedValueOnce({ id: 5, jobName: 'league' });
    expect((await request(baseUrl).get('/api/admin/scheduler/runs/5')).body).toEqual({ id: 5, jobName: 'league' });

    mockGetRun.mockRejectedValueOnce(new SchedulerError(SchedulerErrorCode.RUN_NOT_FOUND, 'Run not found', 404));
    const missing = await request(baseUrl).get('/api/admin/scheduler/runs/999');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('SCHEDULER_RUN_NOT_FOUND');

    expect((await request(baseUrl).get('/api/admin/scheduler/runs/abc')).status).toBe(400);
  });

  it('requires an admin for reads too', async () => {
    mockUser = { userId: 2, username: 'player', role: 'user' };
    expect((await request(baseUrl).get('/api/admin/scheduler/overview')).status).toBe(403);
    expect((await request(baseUrl).get('/api/admin/scheduler/runs')).status).toBe(403);
  });
});

describe('POST /api/admin/cycles/bulk', () => {
  it('waits for the result by default (synchronous contract, user generation off by default)', async () => {
    mockRunBulk.mockResolvedValue({ success: true, cyclesCompleted: 2, results: [] });

    const res = await request(baseUrl).post('/api/admin/cycles/bulk').send({ cycles: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cyclesCompleted: 2 });
    expect(mockRunBulk).toHaveBeenCalledWith(
      { cycles: 2, generateUsersPerCycle: false, includeTournaments: true, includeKoth: true, includeDailyFinances: true },
      1,
    );
  });

  it('starts in the background with background=true and answers 202', async () => {
    mockStartBulk.mockResolvedValue({ runId: 9, jobName: 'bulkCycles', queuedAt: QUEUED_AT });

    const res = await request(baseUrl).post('/api/admin/cycles/bulk').send({ cycles: 3, generateUsersPerCycle: true, includeKoth: false, background: true });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ run: { id: 9, jobName: 'bulkCycles', status: 'queued', queuedAt: QUEUED_AT.toISOString() } });
    expect(mockStartBulk).toHaveBeenCalledWith(
      { cycles: 3, generateUsersPerCycle: true, includeTournaments: true, includeKoth: false, includeDailyFinances: true },
      1,
    );
    expect(mockRunBulk).not.toHaveBeenCalled();
  });

  it('answers 409 when a bulk run is already active, in both modes', async () => {
    const busy = new SchedulerError(SchedulerErrorCode.JOB_ALREADY_ACTIVE, 'A bulk run is already queued or running', 409);
    mockStartBulk.mockRejectedValue(busy);
    mockRunBulk.mockRejectedValue(busy);

    expect((await request(baseUrl).post('/api/admin/cycles/bulk').send({ cycles: 1, background: true })).status).toBe(409);
    expect((await request(baseUrl).post('/api/admin/cycles/bulk').send({ cycles: 1 })).status).toBe(409);
  });

  it('keeps the generic 500 for an unexpected synchronous failure', async () => {
    mockRunBulk.mockRejectedValue(new Error('db down'));
    const res = await request(baseUrl).post('/api/admin/cycles/bulk').send({ cycles: 1 });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to run bulk cycles' });
  });
});

describe('GET /api/admin/practice-arena/overview and /stats', () => {
  it('returns the persisted overview and the original stats shape', async () => {
    mockPracticeOverview.mockResolvedValue({ windowDays: 30, days: [], season: { number: 1, battles: 798, players: 20 } });
    mockPracticeStats.mockResolvedValue({ current: { totalBattlesSinceStart: 798, battlesToday: 0, rateLimitHitsToday: 0, uniquePlayersToday: 0 }, history: [] });

    const overview = await request(baseUrl).get('/api/admin/practice-arena/overview');
    expect(overview.status).toBe(200);
    expect(overview.body).toMatchObject({ windowDays: 30, season: { battles: 798 } });

    const stats = await request(baseUrl).get('/api/admin/practice-arena/stats');
    expect(stats.status).toBe(200);
    expect(stats.body.current.totalBattlesSinceStart).toBe(798);
  });

  it('requires an admin', async () => {
    mockUser = { userId: 2, username: 'player', role: 'user' };
    expect((await request(baseUrl).get('/api/admin/practice-arena/overview')).status).toBe(403);
    mockUser = null;
    expect((await request(baseUrl).get('/api/admin/practice-arena/stats')).status).toBe(401);
    expect(mockPracticeOverview).not.toHaveBeenCalled();
  });
});
