import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  describeMissed,
  formatCountdown,
  formatDayTime,
  formatDuration,
  jobLabel,
  runResultText,
  triggerLabel,
} from '../adminCycleFormat';
import { buildSchedulerHistoryParams } from '../adminCycleApi';

const NOW = new Date('2026-10-23T09:04:12.000Z');

describe('formatDuration', () => {
  it('reads seconds, minutes with seconds, and hours with minutes', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(3_400)).toBe('3s');
    expect(formatDuration(252_000)).toBe('4m 12s');
    expect(formatDuration(282_320)).toBe('4m 42s');
    expect(formatDuration(995_000)).toBe('16m 35s');
    expect(formatDuration(3_600_000)).toBe('1h 00m');
    expect(formatDuration(6_600_000)).toBe('1h 50m');
  });

  it('shows a dash for missing or invalid durations', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(-1)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
  });

  it('always uses one of the three shapes (property)', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 30 * 24 * 3_600_000 }), (ms) => {
      expect(formatDuration(ms)).toMatch(/^(\d{1,2}s|\d{1,2}m \d{2}s|\d+h \d{2}m)$/);
    }));
  });
});

describe('day and countdown labels (UTC)', () => {
  it('labels today, yesterday and older days', () => {
    expect(formatDayTime('2026-10-23T08:00:00.000Z', NOW)).toBe('Today 08:00');
    expect(formatDayTime('2026-10-22T23:59:00.000Z', NOW)).toBe('Yesterday 23:59');
    expect(formatDayTime('2026-10-21T18:00:00.000Z', NOW)).toBe('21 Oct 18:00');
  });

  it('counts down to the next slot', () => {
    expect(formatCountdown('2026-10-23T10:00:00.000Z', NOW)).toBe('in 56m');
    expect(formatCountdown('2026-10-23T11:15:00.000Z', NOW)).toBe('in 2h 11m');
    expect(formatCountdown('2026-10-23T09:00:00.000Z', NOW)).toBe('due now');
  });
});

describe('labels and results', () => {
  it('names jobs like the dashboard, and bulk runs', () => {
    expect(jobLabel('league')).toBe('League 1v1');
    expect(jobLabel('team3v3Tournament')).toBe('Tournament 3v3');
    expect(jobLabel('bulkCycles')).toBe('Bulk cycles');
  });

  it('describes the trigger and who started a manual run', () => {
    expect(triggerLabel({ trigger: 'cron', triggeredBy: null })).toBe('Cron');
    expect(triggerLabel({ trigger: 'manual', triggeredBy: { userId: 3, username: 'Robert' } })).toBe('Manual · Robert');
    expect(triggerLabel({ trigger: 'bulk', triggeredBy: { userId: 3, username: null } })).toBe('Bulk · #3');
    expect(triggerLabel({ trigger: 'resume', triggeredBy: null })).toBe('Resumed');
  });

  it('writes one line per kind of result', () => {
    const base = { status: 'success' as const, error: null };
    expect(runResultText({ ...base, jobName: 'team2v2League', summary: { matchesCompleted: 669 } })).toBe('669 battles');
    expect(runResultText({ ...base, jobName: 'koth', summary: { matchesCompleted: 1563 } })).toBe('1,563 matches');
    expect(runResultText({ ...base, jobName: 'tournament', summary: { tournamentRound: 3, tournamentMaxRounds: 12, matchesCompleted: 512 } })).toBe('Round 3/12 · 512 matches');
    expect(runResultText({ ...base, jobName: 'team2v2Tournament', summary: { tournamentName: '2v2 Cup #4' } })).toBe('2v2 Cup #4 created');
    expect(runResultText({ ...base, jobName: 'settlement', summary: { cycleNumber: 81 } })).toBe('Cycle 81 closed');
    expect(runResultText({ ...base, jobName: 'grandMelee', summary: { skippedReason: 'season_preparation' } })).toBe('Skipped: the season is preparing');
    expect(runResultText({
      ...base,
      jobName: 'bulkCycles',
      summary: { bulk: { cyclesRequested: 2, cyclesCompleted: 2, totalDurationMs: 1, averageCycleDurationMs: 1, generateUsersPerCycle: false, includeTournaments: true, includeKoth: true, includeDailyFinances: true } },
    })).toBe('2 of 2 cycles completed');
    expect(runResultText({ status: 'failed', error: 'arena collapsed', jobName: 'koth', summary: null })).toBe('arena collapsed');
    expect(runResultText({ ...base, jobName: 'league', summary: null })).toBeNull();
  });

  it('describes a missed run with its downtime', () => {
    expect(describeMissed({ jobName: 'team3v3Tournament', expectedAt: '2026-10-21T18:00:00.000Z', downtime: { from: '2026-10-21T17:58:00.000Z', to: '2026-10-21T18:03:00.000Z' } }, NOW))
      .toBe('Tournament 3v3 on 21 Oct 18:00 · backend down 17:58–18:03');
    expect(describeMissed({ jobName: 'league', expectedAt: '2026-10-23T08:00:00.000Z', downtime: null }, NOW)).toBe('League 1v1 on Today 08:00');
  });
});

describe('buildSchedulerHistoryParams', () => {
  it('sends only the filters that are set', () => {
    expect(buildSchedulerHistoryParams({})).toEqual({});
    expect(buildSchedulerHistoryParams({ problemsOnly: false, days: 7, page: 1, limit: 25 })).toEqual({ days: 7, page: 1, limit: 25 });
    expect(buildSchedulerHistoryParams({ jobName: 'bulkCycles', problemsOnly: true })).toEqual({ jobName: 'bulkCycles', problemsOnly: 'true' });
  });
});
