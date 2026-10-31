/**
 * Unit tests for the admin dashboard formatting and derivation helpers.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  computeTrend,
  countOpenItems,
  deriveAttentionItems,
  deriveStatusCells,
  formatAgo,
  formatDuration,
  formatUntil,
  formatUtcTime,
  jobLabel,
  modeLabel,
  readDashboardFilter,
  TIME,
} from '../adminDashboardFormat';
import type { DashboardStatus } from '../adminDashboardApi';

const NOW = new Date('2026-10-22T14:00:00.000Z');

function status(overrides: Partial<DashboardStatus> = {}, attention: Partial<DashboardStatus['attention']> = {}): DashboardStatus {
  return {
    cycle: { number: 412, lastSettlementAt: '2026-10-22T00:01:00.000Z', nextSettlementAt: '2026-10-23T00:00:00.000Z' },
    season: { number: 2, phase: 'competitive', seasonCycle: 38 },
    scheduler: {
      active: true, runningJob: null, queueLength: 0, jobsTotal: 10, jobsSucceeded: 10,
      jobsFailed: [], jobsNotYetReported: 0, processStartedAt: '2026-10-20T09:00:00.000Z',
    },
    queuedMatches: 180,
    ...overrides,
    attention: {
      bankruptcyRisk: { count: 0, threshold: 10000 },
      security: { activeAlerts: 0, critical: 0 },
      automatons: { needAttention: 0, failed: 0 },
      cycleHealth: { settlementOverdue: false, failedJobs: [], stuckMatches: 0 },
      ...attention,
    },
    timestamp: NOW.toISOString(),
  };
}

describe('labels and filter', () => {
  it('labels modes and jobs, humanizing unknown keys', () => {
    expect(modeLabel('koth')).toBe('King of the Hill');
    expect(modeLabel('tournament_3v3')).toBe('Tournament 3v3');
    expect(modeLabel('legacy_mode')).toBe('Legacy mode');
    expect(jobLabel('team2v2League')).toBe('League 2v2');
    expect(jobLabel('newJob')).toBe('New Job');
  });

  it('reads the URL filter and falls back to real', () => {
    expect(readDashboardFilter('automaton')).toBe('automaton');
    expect(readDashboardFilter(null)).toBe('real');
    expect(readDashboardFilter('bogus')).toBe('real');
  });
});

describe('time formatting', () => {
  it('formats UTC wall-clock times', () => {
    expect(formatUtcTime('2026-10-22T02:05:09.000Z')).toBe('02:05 UTC');
    expect(formatUtcTime('2026-10-22T02:05:09.000Z', true)).toBe('02:05:09 UTC');
  });

  it('formats compact durations', () => {
    expect(formatDuration(30_000)).toBe('under a minute');
    expect(formatDuration(3 * TIME.MINUTE)).toBe('3m');
    expect(formatDuration(12 * TIME.HOUR)).toBe('12h');
    expect(formatDuration(11 * TIME.HOUR + 58 * TIME.MINUTE)).toBe('11h 58m');
    expect(formatDuration(2 * TIME.DAY + 4 * TIME.HOUR)).toBe('2d 4h');
  });

  it('formats relative times in both directions', () => {
    expect(formatAgo('2026-10-22T02:00:00.000Z', NOW)).toBe('12h ago');
    expect(formatAgo(NOW.toISOString(), NOW)).toBe('just now');
    expect(formatUntil('2026-10-23T00:00:00.000Z', NOW)).toBe('in 10h');
    expect(formatUntil('2026-10-22T13:00:00.000Z', NOW)).toBe('now');
  });
});

describe('computeTrend', () => {
  it('returns null without a previous value', () => {
    expect(computeTrend(5, null, 'higher-is-better')).toBeNull();
  });

  it('treats a rise as bad when lower is better', () => {
    expect(computeTrend(7, 6, 'lower-is-better')).toEqual({ direction: 'up', delta: 1, tone: 'bad' });
    expect(computeTrend(5, 7, 'lower-is-better')).toEqual({ direction: 'down', delta: 2, tone: 'good' });
  });

  it('is neutral when unchanged', () => {
    expect(computeTrend(4, 4, 'higher-is-better')).toEqual({ direction: 'neutral', delta: 0, tone: 'neutral' });
  });

  it('flips tone, never direction or delta, between intents (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000 }), fc.integer({ min: 0, max: 10_000 }), (current, previous) => {
        const higher = computeTrend(current, previous, 'higher-is-better');
        const lower = computeTrend(current, previous, 'lower-is-better');
        expect(higher?.direction).toBe(lower?.direction);
        expect(higher?.delta).toBe(Math.abs(current - previous));
        if (higher?.tone === 'neutral') expect(lower?.tone).toBe('neutral');
        else expect(lower?.tone).not.toBe(higher?.tone);
      }),
    );
  });
});

describe('deriveAttentionItems', () => {
  it('shows four calm OK items when nothing is wrong', () => {
    const items = deriveAttentionItems(status());

    expect(items.map((item) => item.severity)).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(countOpenItems(items)).toBe(0);
    expect(items.find((item) => item.key === 'cycle')).toMatchObject({
      title: 'Last cycle healthy',
      detail: '10/10 jobs succeeded · 0 matches left behind',
    });
  });

  it('sorts errors before warnings before OK items', () => {
    const items = deriveAttentionItems(status({}, {
      security: { activeAlerts: 2, critical: 0 },
      bankruptcyRisk: { count: 3, threshold: 10000 },
    }));

    expect(items.map((item) => [item.key, item.severity])).toEqual([
      ['bankruptcy', 'error'],
      ['security', 'warning'],
      ['automatons', 'ok'],
      ['cycle', 'ok'],
    ]);
    expect(countOpenItems(items)).toBe(2);
    expect(items[0]).toMatchObject({ count: 3, title: 'Stables at bankruptcy risk', href: '/admin/players?segment=low-balance' });
    expect(items[1]).toMatchObject({ count: 2, detail: '2 warnings' });
  });

  it('makes security an error when any alert is critical', () => {
    const [item] = deriveAttentionItems(status({}, { security: { activeAlerts: 3, critical: 1 } }));
    expect(item).toMatchObject({ key: 'security', severity: 'error', title: 'Active security alerts', detail: '1 critical · 2 warnings' });
  });

  it('makes Automatons an error only when a turn failed', () => {
    const warning = deriveAttentionItems(status({}, { automatons: { needAttention: 5, failed: 0 } }))[0];
    const error = deriveAttentionItems(status({}, { automatons: { needAttention: 1, failed: 1 } }))[0];

    expect(warning).toMatchObject({ severity: 'warning', count: 5, title: 'Automatons need attention' });
    expect(error).toMatchObject({ severity: 'error', count: 1, title: 'Automaton needs attention', detail: '1 with a failed turn' });
  });

  it('lists every cycle problem in one item', () => {
    const [item] = deriveAttentionItems(status({}, {
      cycleHealth: { settlementOverdue: true, failedJobs: ['koth', 'team2v2League'], stuckMatches: 4 },
    }));

    expect(item).toMatchObject({
      key: 'cycle',
      severity: 'error',
      count: 3,
      title: 'Cycle problems',
      detail: 'Settlement overdue · Jobs failed: King of the Hill, League 2v2 · 4 matches left behind',
      href: '/admin/cycles',
    });
  });

  it('explains a healthy cycle right after a restart', () => {
    const items = deriveAttentionItems(status({
      scheduler: {
        active: true, runningJob: null, queueLength: 0, jobsTotal: 10, jobsSucceeded: 3,
        jobsFailed: [], jobsNotYetReported: 7, processStartedAt: '2026-10-22T09:30:00.000Z',
      },
    }));

    expect(items.find((item) => item.key === 'cycle')?.detail)
      .toBe('3/10 jobs reported since restart at 09:30 UTC · 0 matches left behind');
  });

  it('marks unreadable sections as unavailable, after open items', () => {
    const items = deriveAttentionItems(status({}, { security: null, bankruptcyRisk: { count: 1, threshold: 10000 } }));

    expect(items.map((item) => item.severity)).toEqual(['error', 'unavailable', 'ok', 'ok']);
    expect(items[1]).toMatchObject({ key: 'security', count: null, title: 'Security status unavailable' });
  });
});

describe('deriveStatusCells', () => {
  it('describes a healthy system', () => {
    const cells = deriveStatusCells(status(), NOW);

    expect(cells.map((cell) => [cell.label, cell.value, cell.tone])).toEqual([
      ['Cycle', '412 · Season 2', null],
      ['Last cycle', '00:01 UTC · 13h 59m ago', 'ok'],
      ['Next cycle', '00:00 UTC · in 10h', null],
      ['Scheduler', 'Healthy · 10 jobs', 'ok'],
      ['Queued matches', '180', null],
    ]);
  });

  it('flags an overdue settlement, failed jobs and a preparation season', () => {
    const cells = deriveStatusCells(status(
      {
        season: { number: 3, phase: 'preparation', seasonCycle: 0 },
        scheduler: {
          active: true, runningJob: null, queueLength: 0, jobsTotal: 10, jobsSucceeded: 9,
          jobsFailed: ['koth'], jobsNotYetReported: 0, processStartedAt: '2026-10-20T09:00:00.000Z',
        },
      },
      { cycleHealth: { settlementOverdue: true, failedJobs: ['koth'], stuckMatches: 0 } },
    ), NOW);

    expect(cells[0].value).toBe('412 · Season 3 (preparation)');
    expect(cells[1].tone).toBe('error');
    expect(cells[3]).toMatchObject({ value: '1 of 10 jobs failed', tone: 'error' });
  });

  it('shows a disabled scheduler and an unreadable queue', () => {
    const cells = deriveStatusCells(status({
      queuedMatches: null,
      scheduler: {
        active: false, runningJob: null, queueLength: 0, jobsTotal: 0, jobsSucceeded: 0,
        jobsFailed: [], jobsNotYetReported: 0, processStartedAt: '2026-10-20T09:00:00.000Z',
      },
    }), NOW);

    expect(cells[2]).toMatchObject({ value: 'Scheduler disabled', tone: 'muted' });
    expect(cells[3]).toMatchObject({ value: 'Disabled', tone: 'muted' });
    expect(cells[4].value).toBe('Unavailable');
  });

  it('shows the running job', () => {
    const cells = deriveStatusCells(status({
      scheduler: {
        active: true, runningJob: 'tagTeam', queueLength: 1, jobsTotal: 10, jobsSucceeded: 10,
        jobsFailed: [], jobsNotYetReported: 0, processStartedAt: '2026-10-20T09:00:00.000Z',
      },
    }), NOW);

    expect(cells[3]).toMatchObject({ value: 'Running Tag Team', tone: 'info' });
  });
});
