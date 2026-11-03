/**
 * Unit tests for the request metrics buffer: which requests are counted, how
 * they are bucketed, and that flushing writes one upsert per bucket and never
 * throws.
 */
const mockExecuteRaw = jest.fn();
const mockDeleteMany = jest.fn();
const mockWarn = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
    requestMetric: { deleteMany: (...args: unknown[]) => mockDeleteMany(...args) },
  },
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: (...args: unknown[]) => mockWarn(...args), error: jest.fn(), debug: jest.fn() },
}));

import {
  REQUEST_METRICS_RETENTION_DAYS,
  SLOW_REQUEST_MS,
  flushRequestMetrics,
  pendingRequestMetrics,
  recordRequest,
  resetRequestMetrics,
  routePattern,
} from '../requestMetrics';

const AT = new Date('2026-11-02T14:25:10.000Z');
const HOUR = new Date('2026-11-02T14:00:00.000Z');
const ROUTE = '/api/admin/economy/overview';

describe('routePattern', () => {
  it('joins the router mount path and the route path, never the raw URL', () => {
    expect(routePattern({ baseUrl: '/api/admin/users', route: { path: '/:id' } })).toBe('/api/admin/users/:id');
  });

  it('drops the trailing "/" of a route mounted at its base path', () => {
    expect(routePattern({ baseUrl: '/api/admin/system', route: { path: '/' } })).toBe('/api/admin/system');
    expect(routePattern({ baseUrl: '', route: { path: '/' } })).toBe('/');
  });

  it('is null when no route matched (404s, static files)', () => {
    expect(routePattern({ baseUrl: '', route: undefined })).toBeNull();
  });
});

describe('recordRequest', () => {
  beforeEach(() => resetRequestMetrics());

  it('counts a server error under its error code and hour', () => {
    recordRequest({ method: 'get', route: ROUTE, statusCode: 500, durationMs: 30_010.4, errorCode: 'STATEMENT_TIMEOUT', at: AT });

    expect(pendingRequestMetrics()).toEqual([
      { hour: HOUR, kind: 'error', method: 'GET', route: ROUTE, code: 'STATEMENT_TIMEOUT', count: 1, totalMs: 30_010, maxMs: 30_010, lastAt: AT },
      // 30 s is also slow: both are kept.
      { hour: HOUR, kind: 'slow', method: 'GET', route: ROUTE, code: '', count: 1, totalMs: 30_010, maxMs: 30_010, lastAt: AT },
    ]);
  });

  it('falls back to HTTP_<status> when no error code was set', () => {
    recordRequest({ method: 'POST', route: ROUTE, statusCode: 502, durationMs: 5, at: AT });

    expect(pendingRequestMetrics()).toEqual([expect.objectContaining({ kind: 'error', code: 'HTTP_502' })]);
  });

  it('sums repeated requests in one bucket', () => {
    const later = new Date(AT.getTime() + 60_000);
    recordRequest({ method: 'GET', route: ROUTE, statusCode: 200, durationMs: 2_500, at: AT });
    recordRequest({ method: 'GET', route: ROUTE, statusCode: 200, durationMs: 4_000, at: later });

    expect(pendingRequestMetrics()).toEqual([
      { hour: HOUR, kind: 'slow', method: 'GET', route: ROUTE, code: '', count: 2, totalMs: 6_500, maxMs: 4_000, lastAt: later },
    ]);
  });

  it('keeps separate buckets per hour', () => {
    recordRequest({ method: 'GET', route: ROUTE, statusCode: 500, durationMs: 1, at: AT });
    recordRequest({ method: 'GET', route: ROUTE, statusCode: 500, durationMs: 1, at: new Date('2026-11-02T15:00:00.000Z') });

    expect(pendingRequestMetrics().map((b) => b.hour.toISOString())).toEqual(['2026-11-02T14:00:00.000Z', '2026-11-02T15:00:00.000Z']);
  });

  it('ignores fast successes, client errors and requests without a route', () => {
    recordRequest({ method: 'GET', route: ROUTE, statusCode: 200, durationMs: SLOW_REQUEST_MS - 1, at: AT });
    recordRequest({ method: 'GET', route: ROUTE, statusCode: 404, durationMs: 10, at: AT });
    recordRequest({ method: 'GET', route: ROUTE, statusCode: 403, durationMs: 10, at: AT });
    recordRequest({ method: 'GET', route: null, statusCode: 500, durationMs: 10_000, at: AT });

    expect(pendingRequestMetrics()).toEqual([]);
  });

  it('counts a request of exactly the threshold as slow', () => {
    recordRequest({ method: 'GET', route: ROUTE, statusCode: 200, durationMs: SLOW_REQUEST_MS, at: AT });

    expect(pendingRequestMetrics()).toEqual([expect.objectContaining({ kind: 'slow' })]);
  });

  it('stops adding buckets past the cap and reports the dropped requests on flush', async () => {
    mockExecuteRaw.mockResolvedValue(1);
    for (let i = 0; i < 501; i += 1) {
      recordRequest({ method: 'GET', route: `/api/r${i}`, statusCode: 500, durationMs: 1, at: AT });
    }
    expect(pendingRequestMetrics()).toHaveLength(500);

    await flushRequestMetrics(AT);

    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('1 requests not counted'));
  });
});

describe('flushRequestMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRequestMetrics();
    mockExecuteRaw.mockResolvedValue(1);
    mockDeleteMany.mockResolvedValue({ count: 0 });
  });

  it('writes one upsert per bucket and empties the buffer', async () => {
    recordRequest({ method: 'GET', route: ROUTE, statusCode: 500, durationMs: 3_000, errorCode: 'INTERNAL_ERROR', at: AT });

    const written = await flushRequestMetrics(AT);

    expect(written).toBe(2);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(2);
    expect(pendingRequestMetrics()).toEqual([]);
  });

  it('prunes rows older than the retention at most once an hour', async () => {
    await flushRequestMetrics(AT);
    await flushRequestMetrics(new Date(AT.getTime() + 60_000));

    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { hour: { lt: new Date(AT.getTime() - REQUEST_METRICS_RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
    });

    await flushRequestMetrics(new Date(AT.getTime() + 60 * 60 * 1000));
    expect(mockDeleteMany).toHaveBeenCalledTimes(2);
  });

  it('never throws when the database rejects a write or the prune', async () => {
    mockExecuteRaw.mockRejectedValue(new Error('db down'));
    mockDeleteMany.mockRejectedValue(new Error('db down'));
    recordRequest({ method: 'GET', route: ROUTE, statusCode: 500, durationMs: 1, at: AT });

    await expect(flushRequestMetrics(AT)).resolves.toBe(1);
    expect(mockWarn).toHaveBeenCalledWith('[RequestMetrics] Could not write a bucket', { error: 'db down' });
    expect(mockWarn).toHaveBeenCalledWith('[RequestMetrics] Could not prune old rows', { error: 'db down' });
  });
});
