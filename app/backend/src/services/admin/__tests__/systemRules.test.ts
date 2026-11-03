/**
 * Unit tests for the pure rules of the admin System page.
 */
import {
  classifyStarts,
  failuresSince,
  medianOf,
  pageOfRoute,
  parseMemInfo,
  summarizeErrors,
  summarizeJobs,
  summarizeSlow,
  type MetricRow,
} from '../system/systemRules';

const d = (iso: string): Date => new Date(iso);

describe('classifyStarts', () => {
  it('marks a start with a new deploy tag as a deploy and a repeated tag as a restart, newest first', () => {
    const starts = classifyStarts([
      { startedAt: d('2026-11-02T15:50:00Z'), deployTag: 'deploy-acc-20261102-155000' },
      { startedAt: d('2026-11-01T23:05:00Z'), deployTag: 'deploy-acc-20261101-120000' },
      { startedAt: d('2026-11-01T12:00:00Z'), deployTag: 'deploy-acc-20261101-120000' },
    ]);

    expect(starts).toEqual([
      { at: '2026-11-02T15:50:00.000Z', kind: 'deploy', deployTag: 'deploy-acc-20261102-155000' },
      { at: '2026-11-01T23:05:00.000Z', kind: 'restart', deployTag: 'deploy-acc-20261101-120000' },
      { at: '2026-11-01T12:00:00.000Z', kind: 'deploy', deployTag: 'deploy-acc-20261101-120000' },
    ]);
  });

  it('treats starts without a tag (before the deploy tag existed) as restarts', () => {
    expect(classifyStarts([{ startedAt: d('2026-10-31T09:42:00Z'), deployTag: null }])).toEqual([
      { at: '2026-10-31T09:42:00.000Z', kind: 'restart', deployTag: null },
    ]);
  });
});

describe('medianOf', () => {
  it('is null for no values, the middle value for an odd count, the rounded mean of the middle two otherwise', () => {
    expect(medianOf([])).toBeNull();
    expect(medianOf([9, 1, 5])).toBe(5);
    expect(medianOf([4, 1, 2, 3])).toBe(3); // (2 + 3) / 2 = 2.5, rounded
  });
});

describe('summarizeJobs', () => {
  const run = (jobName: string, status: string, start: string, seconds: number) => ({
    jobName, status, startedAt: d(start), finishedAt: new Date(d(start).getTime() + seconds * 1000),
  });

  it('orders jobs by the given order, then unknown jobs; runs oldest first', () => {
    const jobs = summarizeJobs([
      run('settlement', 'success', '2026-11-02T00:00:00Z', 30),
      run('league', 'success', '2026-11-02T20:00:00Z', 60),
      run('league', 'failed', '2026-11-01T20:00:00Z', 5),
      run('custom', 'success', '2026-11-02T01:00:00Z', 1),
    ], ['league', 'settlement']);

    expect(jobs.map((job) => job.jobName)).toEqual(['league', 'settlement', 'custom']);
    expect(jobs[0].runs.map((r) => r.startedAt)).toEqual(['2026-11-01T20:00:00.000Z', '2026-11-02T20:00:00.000Z']);
    expect(jobs[0].last?.status).toBe('success');
    expect(jobs[0].failed).toBe(1);
  });

  it('takes the median of successful runs only and the slowest of all runs', () => {
    const [job] = summarizeJobs([
      run('koth', 'success', '2026-11-01T10:00:00Z', 10),
      run('koth', 'success', '2026-11-02T10:00:00Z', 30),
      run('koth', 'interrupted', '2026-10-31T10:00:00Z', 900),
    ], ['koth']);

    expect(job.medianMs).toBe(20_000);
    expect(job.slowest).toEqual({ startedAt: '2026-10-31T10:00:00.000Z', durationMs: 900_000, status: 'interrupted' });
    expect(job.interrupted).toBe(1);
  });

  it('leaves out jobs without runs', () => {
    expect(summarizeJobs([], ['league'])).toEqual([]);
  });
});

describe('pageOfRoute', () => {
  it('maps admin routes to their page, the longest prefix first', () => {
    expect(pageOfRoute('/api/admin/economy/overview')).toBe('Economy');
    expect(pageOfRoute('/api/admin/automatons/strategies/comparison')).toBe('Automatons · Strategies');
    expect(pageOfRoute('/api/admin/automatons/:id')).toBe('Automatons');
    expect(pageOfRoute('/api/admin/users/:id')).toBe('Players');
  });

  it('does not match a prefix that is only part of a path segment', () => {
    expect(pageOfRoute('/api/admin/systemic')).toBe('Admin');
  });

  it('names player routes after their API area', () => {
    expect(pageOfRoute('/api/robots/:id')).toBe('Robots');
    expect(pageOfRoute('/api/practice-arena/battle')).toBe('Practice arena');
    expect(pageOfRoute('/')).toBe('API');
  });
});

function metric(overrides: Partial<MetricRow>): MetricRow {
  return {
    hour: d('2026-11-02T14:00:00Z'), kind: 'error', method: 'GET', route: '/api/admin/economy/overview', code: 'STATEMENT_TIMEOUT',
    count: 1, totalMs: 30_000, maxMs: 30_000, lastAt: d('2026-11-02T14:10:00Z'), ...overrides,
  };
}

describe('summarizeErrors', () => {
  const days = ['2026-11-01', '2026-11-02'];

  it('groups by method, route and code, sums per day and keeps the latest time', () => {
    const errors = summarizeErrors([
      metric({ hour: d('2026-11-01T09:00:00Z'), count: 3, lastAt: d('2026-11-01T09:30:00Z') }),
      metric({ count: 4 }),
      metric({ code: 'INTERNAL_ERROR', count: 1 }),
      metric({ kind: 'slow', code: '', count: 50 }),
    ], days);

    expect(errors).toEqual([
      {
        method: 'GET', route: '/api/admin/economy/overview', page: 'Economy', code: 'STATEMENT_TIMEOUT',
        count: 7, lastAt: '2026-11-02T14:10:00.000Z', perDay: [3, 4],
      },
      {
        method: 'GET', route: '/api/admin/economy/overview', page: 'Economy', code: 'INTERNAL_ERROR',
        count: 1, lastAt: '2026-11-02T14:10:00.000Z', perDay: [0, 1],
      },
    ]);
  });

  it('counts errors outside the day list in the total only', () => {
    const [error] = summarizeErrors([metric({ hour: d('2026-10-20T09:00:00Z'), count: 2 })], days);
    expect(error.count).toBe(2);
    expect(error.perDay).toEqual([0, 0]);
  });
});

describe('summarizeSlow', () => {
  it('averages over all slow requests of a route and keeps the slowest', () => {
    const slow = summarizeSlow([
      metric({ kind: 'slow', code: '', count: 2, totalMs: 6_000, maxMs: 4_000 }),
      metric({ kind: 'slow', code: '', hour: d('2026-11-02T15:00:00Z'), count: 1, totalMs: 9_000, maxMs: 9_000, lastAt: d('2026-11-02T15:01:00Z') }),
      metric({ kind: 'slow', code: '', route: '/api/admin/meta/choices', count: 1, totalMs: 2_100, maxMs: 2_100 }),
      metric({ kind: 'error' }),
    ]);

    expect(slow).toEqual([
      { method: 'GET', route: '/api/admin/economy/overview', page: 'Economy', count: 3, avgMs: 5_000, maxMs: 9_000, lastAt: '2026-11-02T15:01:00.000Z' },
      { method: 'GET', route: '/api/admin/meta/choices', page: 'Meta', count: 1, avgMs: 2_100, maxMs: 2_100, lastAt: '2026-11-02T14:10:00.000Z' },
    ]);
  });
});

describe('failuresSince', () => {
  it('counts errors from the hour that contains the start onwards', () => {
    const rows = [
      metric({ hour: d('2026-11-01T13:00:00Z'), count: 5 }),
      metric({ hour: d('2026-11-01T14:00:00Z'), count: 2 }),
      metric({ hour: d('2026-11-02T14:00:00Z'), count: 1 }),
      metric({ kind: 'slow', hour: d('2026-11-02T14:00:00Z'), count: 9 }),
    ];

    expect(failuresSince(rows, d('2026-11-01T14:25:00Z'))).toBe(3);
  });
});

describe('parseMemInfo', () => {
  it('reads total, available and swap in MB', () => {
    const text = [
      'MemTotal:        2008064 kB',
      'MemFree:          102400 kB',
      'MemAvailable:     962560 kB',
      'SwapTotal:       2097148 kB',
      'SwapFree:        1904636 kB',
    ].join('\n');

    expect(parseMemInfo(text)).toEqual({ totalMB: 1961, availableMB: 940, swapTotalMB: 2048, swapUsedMB: 188 });
  });

  it('is null when total or available memory is missing', () => {
    expect(parseMemInfo('MemTotal: 2008064 kB')).toBeNull();
    expect(parseMemInfo('')).toBeNull();
  });
});
