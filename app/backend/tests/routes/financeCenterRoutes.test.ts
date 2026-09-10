import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middleware/errorHandler';

const overview = jest.fn();
const history = jest.fn();
const summaries = jest.fn();
const events = jest.fn();
const mockCanonicalCycleIdentity = jest.fn();
const mockTrackRateLimitViolation = jest.fn();
let mockActiveCycle = 3;
let mockUserId = 17;

jest.mock('../../src/middleware/auth', () => ({
  __esModule: true,
  authenticateToken: (req: Request & { user?: { userId: number } }, _res: Response, next: NextFunction): void => {
    req.user = { userId: mockUserId };
    next();
  },
}));
jest.mock('../../src/services/financial/financeReportQueryService', () => ({
  financeReportQueryService: { getOverview: (...args: unknown[]) => overview(...args) },
}));
jest.mock('../../src/services/financial/financeReportTrendService', () => ({
  financeReportTrendService: { getHistory: (...args: unknown[]) => history(...args) },
}));
jest.mock('../../src/services/financial/robotDeploymentQueryService', () => ({
  robotDeploymentQueryService: { getSummaries: (...args: unknown[]) => summaries(...args), getEvents: (...args: unknown[]) => events(...args) },
}));
jest.mock('../../src/services/cycle/canonicalCycleIdentity', () => ({
  resolveCanonicalCycleIdentity: (...args: unknown[]) => mockCanonicalCycleIdentity(...args),
}));
jest.mock('../../src/services/security/securityMonitor', () => ({
  securityMonitor: {
    logValidationFailure: jest.fn(),
    trackRateLimitViolation: (...args: unknown[]) => mockTrackRateLimitViolation(...args),
  },
}));

import financesRoutes from '../../src/routes/finances';

const app = express();
app.use(express.json());
app.use('/api/finances', financesRoutes);
app.use(errorHandler);

const response = { version: 1, period: { scope: 'current' }, provenance: [], reconciliation: {}, limitations: [], data: {} };

describe('Finance Center routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 17;
    mockActiveCycle += 1;
    mockCanonicalCycleIdentity.mockResolvedValue({ seasonNumber: 9, activeCycle: mockActiveCycle });
    overview.mockResolvedValue(response);
    history.mockResolvedValue(response);
    summaries.mockResolvedValue(response);
    events.mockResolvedValue(response);
  });

  it('should derive the overview stable and period only from JWT and validated query', async () => {
    const result = await request(app).get('/api/finances/report?scope=current&ignored=value');

    expect(result.status).toBe(200);
    expect(result.body.version).toBe(1);
    expect(overview).toHaveBeenCalledWith(17, { scope: 'current' });
  });

  it('should delegate the versioned history and robot summary resources', async () => {
    await expect(request(app).get('/api/finances/history?scope=last_completed')).resolves.toMatchObject({ status: 200 });
    await expect(request(app).get('/api/finances/robots?fromCycle=1&toCycle=2')).resolves.toMatchObject({ status: 200 });

    expect(history).toHaveBeenCalledWith(17, { scope: 'last_completed' });
    expect(summaries).toHaveBeenCalledWith(17, { fromCycle: 1, toCycle: 2 });
  });

  it('should pass bounded detail pagination to the owned-robot service', async () => {
    const result = await request(app).get('/api/finances/robots/6/events?scope=current&page=2&pageSize=10');

    expect(result.status).toBe(200);
    expect(events).toHaveBeenCalledWith(17, 6, { scope: 'current', fromCycle: undefined, toCycle: undefined }, 2, 10);
  });

  it('should reject a missing or conflicting report period before any service call', async () => {
    await expect(request(app).get('/api/finances/report')).resolves.toMatchObject({ status: 400 });
    await expect(request(app).get('/api/finances/history?scope=current&fromCycle=1&toCycle=1')).resolves.toMatchObject({ status: 400 });

    expect(overview).not.toHaveBeenCalled();
    expect(history).not.toHaveBeenCalled();
  });

  it('should replace the same Current-cycle cache entry when no-cache is requested', async () => {
    const initial = {
      ...response,
      period: { scope: 'current', asOf: '2026-09-10T10:00:00.000Z' },
      data: { generation: 1 },
    };
    const refreshed = {
      ...response,
      period: { scope: 'current', asOf: '2026-09-10T10:00:01.000Z' },
      data: { generation: 2 },
    };
    overview.mockResolvedValueOnce(initial).mockResolvedValueOnce(refreshed);

    const first = await request(app).get('/api/finances/report?scope=current');
    const cached = await request(app).get('/api/finances/report?scope=current');
    const fresh = await request(app)
      .get('/api/finances/report?scope=current')
      .set('Cache-Control', 'no-cache');
    const replaced = await request(app).get('/api/finances/report?scope=current');

    expect(first.body.period.asOf).toBe('2026-09-10T10:00:00.000Z');
    expect(cached.body.period.asOf).toBe('2026-09-10T10:00:00.000Z');
    expect(fresh.body.period.asOf).toBe('2026-09-10T10:00:01.000Z');
    expect(replaced.body.period.asOf).toBe('2026-09-10T10:00:01.000Z');
    expect(overview).toHaveBeenCalledTimes(2);
    expect(fresh.headers['cache-control']).toBe('private, max-age=15');
  });

  it.each(['No-Cache', 'max-age=0, no-cache'])(
    'should recognize the %s request directive case-insensitively',
    async (cacheControl) => {
      await request(app).get('/api/finances/report?scope=current');
      await request(app)
        .get('/api/finances/report?scope=current')
        .set('Cache-Control', cacheControl);

      expect(overview).toHaveBeenCalledTimes(2);
    },
  );

  it('should ignore unrelated directives and no-cache on non-Current reports', async () => {
    await request(app).get('/api/finances/report?scope=current');
    await request(app)
      .get('/api/finances/report?scope=current')
      .set('Cache-Control', 'max-age=0');
    await request(app).get('/api/finances/report?scope=last_completed');
    await request(app)
      .get('/api/finances/report?scope=last_completed')
      .set('Cache-Control', 'no-cache');

    expect(overview).toHaveBeenCalledTimes(2);
  });

  it('should keep cached Finance responses isolated by authenticated stable', async () => {
    const stable17 = { ...response, data: { stable: 17 } };
    const stable18 = { ...response, data: { stable: 18 } };
    overview.mockResolvedValueOnce(stable17).mockResolvedValueOnce(stable18);

    const first = await request(app).get('/api/finances/report?scope=current');
    mockUserId = 18;
    const second = await request(app).get('/api/finances/report?scope=current');
    mockUserId = 17;
    const firstAgain = await request(app).get('/api/finances/report?scope=current');

    expect(first.body.data.stable).toBe(17);
    expect(second.body.data.stable).toBe(18);
    expect(firstAgain.body.data.stable).toBe(17);
    expect(overview).toHaveBeenCalledTimes(2);
  });

  it('should rate-limit only honored authenticated Current-cycle refreshes', async () => {
    mockUserId = 99;

    for (let index = 0; index < 35; index += 1) {
      const normal = await request(app).get('/api/finances/report?scope=current');
      const historicalNoCache = await request(app)
        .get('/api/finances/report?scope=last_completed')
        .set('Cache-Control', 'no-cache');
      expect(normal.status).toBe(200);
      expect(historicalNoCache.status).toBe(200);
    }

    for (let index = 0; index < 30; index += 1) {
      const allowed = await request(app)
        .get('/api/finances/report?scope=current')
        .set('Cache-Control', 'no-cache');
      expect(allowed.status).toBe(200);
    }

    const limited = await request(app)
      .get('/api/finances/report?scope=current')
      .set('Cache-Control', 'no-cache');

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      error: 'Too many Finance Center refresh requests. Try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
    expect(mockTrackRateLimitViolation).toHaveBeenCalledWith(99, '/api/finances/report?scope=current');
  });
});
