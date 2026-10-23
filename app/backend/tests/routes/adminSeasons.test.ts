/**
 * Route tests for Season Control (`/api/admin/seasons/*`): validation, status
 * codes (200 / 202 / 400 / 409 / 401 / 403), the standard error shape and
 * audit rows. Services are mocked; the DB-backed behaviour is covered by the
 * unit suites of the season services and the Heavy seasonRollover suite.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middleware/errorHandler';
import { SeasonError, SeasonErrorCode } from '../../src/errors/seasonErrors';

const mockGetCurrentSeason = jest.fn();
const mockExtend = jest.fn();
const mockSetPrep = jest.fn();
jest.mock('../../src/services/season/seasonService', () => ({
  __esModule: true,
  getCurrentSeason: (...args: unknown[]) => mockGetCurrentSeason(...args),
  extendCurrentSeason: (...args: unknown[]) => mockExtend(...args),
  setRemainingPreparationCycles: (...args: unknown[]) => mockSetPrep(...args),
}));
const mockPreview = jest.fn();
jest.mock('../../src/services/season/seasonPurgeService', () => ({ __esModule: true, previewRollover: () => mockPreview() }));
const mockState = jest.fn();
jest.mock('../../src/services/season/adminSeasonStateService', () => ({ __esModule: true, getAdminSeasonState: () => mockState() }));
const mockStartRollover = jest.fn();
const mockRunRollover = jest.fn();
jest.mock('../../src/services/season/adminSeasonRolloverRunService', () => ({
  __esModule: true,
  startAdminRollover: (...args: unknown[]) => mockStartRollover(...args),
  runAdminRollover: (...args: unknown[]) => mockRunRollover(...args),
}));
const mockHistory = jest.fn();
jest.mock('../../src/services/season/seasonRolloverHistoryService', () => ({ __esModule: true, getSeasonRolloverHistory: () => mockHistory() }));
const mockRecordAction = jest.fn();
jest.mock('../../src/services/admin/adminAuditLogService', () => ({
  __esModule: true,
  recordAction: (...args: unknown[]) => mockRecordAction(...args),
}));
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

import seasonRoutes from '../../src/routes/adminSeasons';

const app = express();
app.use(express.json());
app.use('/api/admin/seasons', seasonRoutes);
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

const QUEUED_AT = new Date('2026-10-23T09:00:00.000Z');
const RESULT = {
  completedSeasonNumber: 1, newSeasonNumber: 2, stablesArchived: 81, robotsArchived: 809, snapshotRows: 3650, accoladeRows: 304,
  generatedStablesDeleted: 3483, totalRowsPurged: 2_125_614, durations: { archiveMs: 68, purgeMs: 1303, postMs: 473, totalMs: 2289 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { userId: 1, username: 'admin', role: 'admin' };
  mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 1, phase: 'competitive' });
});

describe('POST /api/admin/seasons/rollover', () => {
  it('starts in the background with background: true and answers 202 with the queued run', async () => {
    mockStartRollover.mockResolvedValue({ runId: 41, jobName: 'seasonRollover', queuedAt: QUEUED_AT });

    const res = await request(baseUrl).post('/api/admin/seasons/rollover').send({ confirm: 'CONFIRM_ROLLOVER', seasonNumber: 1, background: true });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ run: { id: 41, jobName: 'seasonRollover', status: 'queued', queuedAt: QUEUED_AT.toISOString() } });
    expect(mockStartRollover).toHaveBeenCalledWith(1, 1);
    expect(mockRunRollover).not.toHaveBeenCalled();
  });

  it('waits for the result without background (the original contract)', async () => {
    mockRunRollover.mockResolvedValue(RESULT);
    const res = await request(baseUrl).post('/api/admin/seasons/rollover').send({ confirm: 'CONFIRM_ROLLOVER', seasonNumber: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(RESULT);
    expect(mockRunRollover).toHaveBeenCalledWith(1, 1);
  });

  it('rejects a wrong phrase, a missing, negative or fractional season number and a non-boolean background with 400', async () => {
    const post = (body: object): Promise<request.Response> => request(baseUrl).post('/api/admin/seasons/rollover').send(body);
    expect((await post({ confirm: 'YES', seasonNumber: 1 })).status).toBe(400);
    expect((await post({ confirm: 'CONFIRM_ROLLOVER' })).status).toBe(400);
    expect((await post({ confirm: 'CONFIRM_ROLLOVER', seasonNumber: -1 })).status).toBe(400);
    expect((await post({ confirm: 'CONFIRM_ROLLOVER', seasonNumber: 1.5 })).status).toBe(400);
    expect((await post({ confirm: 'CONFIRM_ROLLOVER', seasonNumber: 1, background: 'yes' })).status).toBe(400);
    expect(mockStartRollover).not.toHaveBeenCalled();
    expect(mockRunRollover).not.toHaveBeenCalled();
  });

  it('answers 400 SEASON_NUMBER_MISMATCH for a stale season number', async () => {
    const res = await request(baseUrl).post('/api/admin/seasons/rollover').send({ confirm: 'CONFIRM_ROLLOVER', seasonNumber: 0, background: true });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'SEASON_NUMBER_MISMATCH', error: 'Season number mismatch: the current season is 1' });
    expect(mockStartRollover).not.toHaveBeenCalled();
  });

  it('answers 409 ROLLOVER_IN_PROGRESS while one is queued or running', async () => {
    mockStartRollover.mockRejectedValue(new SeasonError(SeasonErrorCode.ROLLOVER_IN_PROGRESS, 'A season rollover is already queued or running', 409));
    const res = await request(baseUrl).post('/api/admin/seasons/rollover').send({ confirm: 'CONFIRM_ROLLOVER', seasonNumber: 1, background: true });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'ROLLOVER_IN_PROGRESS', error: 'A season rollover is already queued or running' });
  });

  it('requires an authenticated admin', async () => {
    mockUser = null;
    expect((await request(baseUrl).post('/api/admin/seasons/rollover').send({ confirm: 'CONFIRM_ROLLOVER', seasonNumber: 1 })).status).toBe(401);
    mockUser = { userId: 2, username: 'player', role: 'user' };
    expect((await request(baseUrl).post('/api/admin/seasons/rollover').send({ confirm: 'CONFIRM_ROLLOVER', seasonNumber: 1 })).status).toBe(403);
    expect(mockRunRollover).not.toHaveBeenCalled();
  });
});

describe('GET /state, /rollover-preview, /history', () => {
  it('returns each service result', async () => {
    mockState.mockResolvedValue({ seasonNumber: 1, nextSettlementAt: null, activeRollover: null });
    mockPreview.mockResolvedValue({ breakdown: { human: { stables: 87, robots: 200 } } });
    mockHistory.mockResolvedValue({ seasons: [], currentSeasonAttempts: [] });

    expect((await request(baseUrl).get('/api/admin/seasons/state')).body).toEqual({ seasonNumber: 1, nextSettlementAt: null, activeRollover: null });
    expect((await request(baseUrl).get('/api/admin/seasons/rollover-preview')).body).toEqual({ breakdown: { human: { stables: 87, robots: 200 } } });
    expect((await request(baseUrl).get('/api/admin/seasons/history')).body).toEqual({ seasons: [], currentSeasonAttempts: [] });
  });

  it('requires an admin for the reads', async () => {
    mockUser = { userId: 2, username: 'player', role: 'user' };
    expect((await request(baseUrl).get('/api/admin/seasons/history')).status).toBe(403);
    expect(mockHistory).not.toHaveBeenCalled();
  });
});

describe('POST /extend and /preparation-cycles', () => {
  it('extends the season and audits it', async () => {
    mockExtend.mockResolvedValue({ seasonNumber: 1, seasonLengthCycles: 105 });
    const res = await request(baseUrl).post('/api/admin/seasons/extend').send({ additionalCycles: 5 });
    expect(res.status).toBe(200);
    expect(mockExtend).toHaveBeenCalledWith(5);
    expect(mockRecordAction).toHaveBeenCalledWith(1, 'season_extend', 'success', expect.objectContaining({ additionalCycles: 5 }));
  });

  it('validates the extension: 1 to 365 whole cycles', async () => {
    for (const additionalCycles of [0, 366, 1.5, '5']) {
      expect((await request(baseUrl).post('/api/admin/seasons/extend').send({ additionalCycles })).status).toBe(400);
    }
    expect(mockExtend).not.toHaveBeenCalled();
  });

  it('sets the remaining preparation cycles and passes the service 400 through', async () => {
    mockSetPrep.mockResolvedValueOnce({ seasonNumber: 2, remainingPreparationCycles: 1 });
    expect((await request(baseUrl).post('/api/admin/seasons/preparation-cycles').send({ remainingCycles: 1 })).status).toBe(200);
    expect(mockRecordAction).toHaveBeenCalledWith(1, 'season_preparation_cycles', 'success', expect.objectContaining({ remainingCycles: 1 }));

    mockSetPrep.mockRejectedValueOnce(new SeasonError(SeasonErrorCode.INVALID_PREPARATION_CYCLES, 'Remaining preparation cycles must be a whole number from 0 to 2 (the preparation window)', 400, { min: 0, max: 2 }));
    const res = await request(baseUrl).post('/api/admin/seasons/preparation-cycles').send({ remainingCycles: 3 });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_PREPARATION_CYCLES', details: { min: 0, max: 2 } });
    expect(mockRecordAction).toHaveBeenCalledTimes(1);

    expect((await request(baseUrl).post('/api/admin/seasons/preparation-cycles').send({ remainingCycles: -1 })).status).toBe(400);
  });
});
