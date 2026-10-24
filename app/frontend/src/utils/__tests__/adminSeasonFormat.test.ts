import { describe, it, expect } from 'vitest';
import {
  attemptProblemText,
  attemptTriggerLabel,
  extendEffect,
  formatDate,
  groupPurgeTables,
  latestAttempt,
  timelineDates,
} from '../adminSeasonFormat';
import type { RolloverAttempt } from '../seasonApi';

const config = { seasonLengthCycles: 100, preparationLengthCycles: 2, countdownCycles: 7, accoladeDepth: 3, retainedImagesPerStable: 20 };
const base = {
  phase: 'competitive' as const,
  isLegacy: false,
  remainingCompetitiveCycles: 19,
  remainingPreparationCycles: 0,
  seasonLengthCycles: 100,
  nextSettlementAt: '2026-10-23T00:00:00.000Z',
  config,
};
const day = (iso: string): string => new Date(iso).toISOString();

describe('timelineDates', () => {
  it('counts one cycle per day from the next settlement in the competitive phase', () => {
    const dates = timelineDates(base);
    expect(dates.rolloverAt?.toISOString()).toBe(day('2026-11-10T00:00:00Z'));
    expect(dates.countdownAt?.toISOString()).toBe(day('2026-11-03T00:00:00Z'));
    expect(dates.competitiveAt?.toISOString()).toBe(day('2026-11-12T00:00:00Z'));
  });

  it('has no countdown date once the countdown shows, and rolls over at the next settlement on the last cycle', () => {
    expect(timelineDates({ ...base, remainingCompetitiveCycles: 7 }).countdownAt).toBeNull();
    expect(timelineDates({ ...base, remainingCompetitiveCycles: 1 }).rolloverAt?.toISOString()).toBe(day('2026-10-23T00:00:00Z'));
  });

  it('dates the competitive phase and the rollover while preparing', () => {
    const dates = timelineDates({ ...base, phase: 'preparation', remainingCompetitiveCycles: 0, remainingPreparationCycles: 2 });
    expect(dates.competitiveAt?.toISOString()).toBe(day('2026-10-24T00:00:00Z'));
    expect(dates.rolloverAt?.toISOString()).toBe(day('2027-02-01T00:00:00Z'));
  });

  it('has no dates without a scheduled settlement, for Season 0, or with nothing remaining', () => {
    const none = { rolloverAt: null, countdownAt: null, competitiveAt: null };
    expect(timelineDates({ ...base, nextSettlementAt: null })).toEqual(none);
    expect(timelineDates({ ...base, isLegacy: true })).toEqual(none);
    expect(timelineDates({ ...base, remainingCompetitiveCycles: 0 })).toEqual(none);
  });
});

describe('extendEffect and formatDate', () => {
  const now = new Date('2026-10-22T12:00:00Z');
  it('shows the new length and where the rollover moves', () => {
    expect(extendEffect(base, 5, now)).toBe('100 → 105 cycles · rollover moves to ~15 Nov');
    expect(extendEffect({ ...base, phase: 'preparation' }, 5, now)).toBe('100 → 105 cycles');
  });
  it('adds the year only when it differs', () => {
    expect(formatDate('2026-11-10T00:00:00Z', now)).toBe('10 Nov');
    expect(formatDate('2027-02-01T00:00:00Z', now)).toBe('1 Feb 2027');
  });
});

describe('groupPurgeTables', () => {
  it('groups known tables, sorts by rows and puts unknown tables in the last group', () => {
    const groups = groupPurgeTables({ battles: 10, battle_summaries: 30, audit_logs: 5, standings: 2, brand_new_table: 7 });
    expect(groups.map((group) => [group.label, group.total])).toEqual([
      ['Battles and summaries', 40],
      ['Ledger, audit and snapshots', 5],
      ['Standings, tournaments and other', 9],
    ]);
    expect(groups[0].tables.map((row) => row.table)).toEqual(['battle_summaries', 'battles']);
    expect(groups[2].tables.map((row) => row.table)).toEqual(['brand_new_table', 'standings']);
  });
});

describe('attempt text', () => {
  const attempt: RolloverAttempt = {
    source: 'run', id: 1, at: '2026-11-10T00:01:00Z', status: 'failed', trigger: 'manual',
    triggeredBy: { userId: 3, username: null }, durationMs: 1000, error: 'counts differ', failedStage: 'verify', stages: null, result: null,
  };
  it('labels the trigger and the problem', () => {
    expect(attemptTriggerLabel(attempt)).toBe('Admin · #3');
    expect(attemptTriggerLabel({ ...attempt, trigger: 'cron' })).toBe('Settlement');
    expect(attemptProblemText(attempt)).toBe('Failed at Verify: counts differ');
    expect(attemptProblemText({ ...attempt, status: 'interrupted', failedStage: null, error: null })).toBe('Interrupted');
  });
  it('finds the newest attempt anywhere in the history', () => {
    const older = { ...attempt, id: 2, at: '2026-11-09T00:00:00Z' };
    const newest = { ...attempt, id: 3, status: 'success' as const, at: '2026-11-11T00:00:00Z' };
    const history = {
      currentSeasonAttempts: [attempt],
      seasons: [{ seasonNumber: 1, isLegacy: false, startedAt: '', endedAt: null, competitiveCycles: 0, humanStableCount: 0, generatedStableCount: 0, rollover: newest, failedAttempts: [older] }],
    };
    expect(latestAttempt(history)?.id).toBe(3);
    expect(latestAttempt({ seasons: [], currentSeasonAttempts: [] })).toBeNull();
  });
});
