/**
 * Admin System page against the database.
 *
 * - Request metrics: the flush upserts into `request_metrics` (a second flush
 *   of the same bucket adds to the row) and prunes rows past the retention.
 * - `getSystemOverview` reads those rows, the backend starts (deploy vs
 *   restart, including the start just before the window) and finished
 *   scheduler runs.
 * - `getRequestFailures` (the Dashboard item) counts the last 24 hours only.
 *
 * Uses dates in 2099 so rows of other suites in the shared database fall
 * outside every window, and removes its rows afterwards.
 */
import prisma from '../../src/lib/prisma';
import {
  REQUEST_METRICS_RETENTION_DAYS,
  flushRequestMetrics,
  recordRequest,
  resetRequestMetrics,
} from '../../src/services/monitoring/requestMetrics';
import { getRequestFailures, getSystemOverview } from '../../src/services/admin/system';

const NOW = new Date('2099-03-10T12:30:00.000Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ROUTE = `/api/admin/economy/overview-test-${Date.now()}`;
const FROM = new Date('2099-01-01T00:00:00.000Z');

async function cleanup(): Promise<void> {
  await prisma.requestMetric.deleteMany({ where: { hour: { gte: FROM } } });
  await prisma.schedulerJobRun.deleteMany({ where: { startedAt: { gte: FROM } } });
  await prisma.schedulerProcess.deleteMany({ where: { startedAt: { gte: FROM } } });
}

describe('Admin System page (database)', () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    resetRequestMetrics();
  });
  beforeEach(() => resetRequestMetrics());

  it('upserts buffered counts into one row per bucket and prunes old rows', async () => {
    const old = new Date(NOW.getTime() - (REQUEST_METRICS_RETENTION_DAYS + 1) * DAY);
    await prisma.requestMetric.create({
      data: { hour: old, kind: 'error', method: 'GET', route: ROUTE, code: 'OLD', count: 1, totalMs: 1, maxMs: 1, lastAt: old },
    });

    recordRequest({ method: 'GET', route: ROUTE, statusCode: 500, durationMs: 30_000, errorCode: 'STATEMENT_TIMEOUT', at: new Date(NOW.getTime() - 10 * 60_000) });
    await flushRequestMetrics(NOW);
    recordRequest({ method: 'GET', route: ROUTE, statusCode: 500, durationMs: 31_000, errorCode: 'STATEMENT_TIMEOUT', at: new Date(NOW.getTime() - 5 * 60_000) });
    await flushRequestMetrics(new Date(NOW.getTime() + 60_000));

    const rows = await prisma.requestMetric.findMany({ where: { route: ROUTE }, orderBy: [{ hour: 'asc' }, { kind: 'asc' }] });
    expect(rows.map((r) => ({ kind: r.kind, code: r.code, count: r.count, totalMs: Number(r.totalMs), maxMs: r.maxMs, lastAt: r.lastAt.toISOString() }))).toEqual([
      { kind: 'error', code: 'STATEMENT_TIMEOUT', count: 2, totalMs: 61_000, maxMs: 31_000, lastAt: '2099-03-10T12:25:00.000Z' },
      { kind: 'slow', code: '', count: 2, totalMs: 61_000, maxMs: 31_000, lastAt: '2099-03-10T12:25:00.000Z' },
    ]);
  });

  it('reads requests, starts and scheduler runs into the overview', async () => {
    // Two days ago: one more error and a slow request.
    const twoDaysAgo = new Date('2099-03-08T09:00:00.000Z');
    await prisma.requestMetric.createMany({
      data: [
        { hour: twoDaysAgo, kind: 'error', method: 'GET', route: ROUTE, code: 'STATEMENT_TIMEOUT', count: 3, totalMs: 90_000, maxMs: 30_000, lastAt: twoDaysAgo },
        { hour: twoDaysAgo, kind: 'slow', method: 'GET', route: ROUTE, code: '', count: 1, totalMs: 9_000, maxMs: 9_000, lastAt: twoDaysAgo },
      ],
    });
    // A deploy before the window, a restart with the same tag inside it, then a new deploy.
    await prisma.schedulerProcess.createMany({
      data: [
        { startedAt: new Date(NOW.getTime() - 9 * DAY), schedulerEnabled: true, deployTag: 'deploy-acc-20990301-100000' },
        { startedAt: new Date(NOW.getTime() - 3 * DAY), schedulerEnabled: true, deployTag: 'deploy-acc-20990301-100000' },
        { startedAt: new Date(NOW.getTime() - 2 * HOUR), schedulerEnabled: true, deployTag: 'deploy-acc-20990310-103000' },
      ],
    });
    const processRow = await prisma.schedulerProcess.findFirstOrThrow({ where: { startedAt: { gte: FROM } }, orderBy: { startedAt: 'desc' } });
    const start = new Date('2099-03-10T00:00:00.000Z');
    await prisma.schedulerJobRun.createMany({
      data: [
        { processId: processRow.id, jobName: 'settlement', status: 'success', trigger: 'cron', startedAt: start, finishedAt: new Date(start.getTime() + 40_000) },
        { processId: processRow.id, jobName: 'settlement', status: 'interrupted', trigger: 'cron', startedAt: new Date(start.getTime() - DAY), finishedAt: new Date(start.getTime() - DAY + 600_000) },
      ],
    });

    const overview = await getSystemOverview(NOW);

    const errors = overview.requests.errors.filter((e) => e.route === ROUTE);
    expect(errors).toEqual([expect.objectContaining({ code: 'STATEMENT_TIMEOUT', count: 5, page: 'Economy', lastAt: '2099-03-10T12:25:00.000Z' })]);
    expect(overview.requests.days).toHaveLength(7);
    expect(overview.requests.days.at(-1)).toBe('2099-03-10');
    expect(errors[0].perDay.at(-1)).toBe(2);
    expect(errors[0].perDay.at(-3)).toBe(3);
    expect(overview.requests.failures24h).toBe(2);
    expect(overview.requests.slow.filter((s) => s.route === ROUTE)).toEqual([
      expect.objectContaining({ count: 3, avgMs: Math.round(70_000 / 3), maxMs: 31_000 }),
    ]);

    expect(overview.starts).toEqual([
      { at: new Date(NOW.getTime() - 2 * HOUR).toISOString(), kind: 'deploy', deployTag: 'deploy-acc-20990310-103000' },
      { at: new Date(NOW.getTime() - 3 * DAY).toISOString(), kind: 'restart', deployTag: 'deploy-acc-20990301-100000' },
    ]);

    const settlement = overview.jobs.rows.find((job) => job.jobName === 'settlement');
    expect(settlement).toMatchObject({ medianMs: 40_000, interrupted: 1, last: { status: 'success', durationMs: 40_000 } });
    expect(overview.jobs.lockPerDay).toHaveLength(8);
    expect(overview.jobs.lockPerDay.at(-1)).toEqual({ day: '2099-03-10', ms: 40_000 });
  });

  it('counts only the last 24 hours for the Dashboard', async () => {
    const failures = await getRequestFailures(NOW);

    expect(failures).toEqual({ failures24h: 2, topRoute: `GET ${ROUTE}`, topCode: 'STATEMENT_TIMEOUT' });
  });
});
