/**
 * Missed scheduler runs (pure): expected slots, coverage, downtime, tracking start.
 */
import fc from 'fast-check';
import {
  MISSED_RUN_GRACE_MS,
  dailyOccurrences,
  findMissedRuns,
  parseDailyCron,
  type MissedRunEvidence,
  type MissedRunProcess,
} from '../schedulerMissedRuns';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const at = (iso: string): Date => new Date(iso);

const process = (id: number, startedAt: string, lastHeartbeatAt: string, schedulerEnabled = true): MissedRunProcess => ({
  id, startedAt: at(startedAt), lastHeartbeatAt: at(lastHeartbeatAt), schedulerEnabled,
});
const cron = (jobName: string, queuedAt: string, trigger = 'cron'): MissedRunEvidence => ({ jobName, trigger, queuedAt: at(queuedAt) });

const GM = { jobName: 'grandMelee', schedule: '0 17 * * *' };
const T3 = { jobName: 'team3v3Tournament', schedule: '0 18 * * *' };

describe('parseDailyCron / dailyOccurrences', () => {
  it('reads daily schedules and rejects anything else', () => {
    expect(parseDailyCron('0 17 * * *')).toEqual({ hour: 17, minute: 0 });
    expect(parseDailyCron('30 0 * * *')).toEqual({ hour: 0, minute: 30 });
    expect(parseDailyCron('0 */2 * * *')).toBeNull();
    expect(parseDailyCron('0 8 * * 1')).toBeNull();
    expect(parseDailyCron('61 8 * * *')).toBeNull();
  });

  it('lists every occurrence inside the window', () => {
    expect(dailyOccurrences('0 17 * * *', at('2026-10-20T18:00:00Z'), at('2026-10-23T09:00:00Z')).map((d) => d.toISOString()))
      .toEqual(['2026-10-21T17:00:00.000Z', '2026-10-22T17:00:00.000Z']);
    expect(dailyOccurrences('0 17 * * *', at('2026-10-23T09:00:00Z'), at('2026-10-20T09:00:00Z'))).toEqual([]);
  });
});

describe('findMissedRuns', () => {
  const now = at('2026-10-23T09:04:00Z');
  const from = new Date(now.getTime() - 7 * DAY);

  it('reports nothing when every slot has a cron run', () => {
    const missed = findMissedRuns({
      jobs: [GM],
      processes: [process(1, '2026-10-20T00:00:00Z', '2026-10-23T09:03:00Z')],
      runs: [cron('grandMelee', '2026-10-20T17:00:00Z'), cron('grandMelee', '2026-10-21T17:00:01Z'), cron('grandMelee', '2026-10-22T17:00:00Z')],
      from,
      now,
    });
    expect(missed).toEqual([]);
  });

  it('flags a slot that fell in a deploy, with the downtime window', () => {
    const missed = findMissedRuns({
      jobs: [T3],
      processes: [
        process(1, '2026-10-20T00:00:00Z', '2026-10-21T17:58:00Z'),
        process(2, '2026-10-21T18:03:00Z', '2026-10-23T09:03:00Z'),
      ],
      runs: [cron('team3v3Tournament', '2026-10-20T18:00:00Z'), cron('team3v3Tournament', '2026-10-22T18:00:00Z')],
      from,
      now,
    });
    expect(missed).toEqual([{
      jobName: 'team3v3Tournament',
      expectedAt: at('2026-10-21T18:00:00Z'),
      downtime: { from: at('2026-10-21T17:58:00Z'), to: at('2026-10-21T18:03:00Z') },
    }]);
  });

  it('does not let a later manual run hide the missed cron run', () => {
    const missed = findMissedRuns({
      jobs: [T3],
      processes: [process(1, '2026-10-21T00:00:00Z', '2026-10-23T09:03:00Z')],
      runs: [cron('team3v3Tournament', '2026-10-21T18:06:00Z', 'manual'), cron('team3v3Tournament', '2026-10-22T18:00:00Z')],
      from,
      now,
    });
    expect(missed.map((m) => m.expectedAt.toISOString())).toEqual(['2026-10-21T18:00:00.000Z']);
    expect(missed[0].downtime).toBeNull();
  });

  it('counts a resumed settlement and a run queued within the grace period', () => {
    const missed = findMissedRuns({
      jobs: [{ jobName: 'settlement', schedule: '0 0 * * *' }, GM],
      processes: [process(1, '2026-10-21T12:00:00Z', '2026-10-23T09:03:00Z')],
      runs: [
        cron('settlement', '2026-10-22T00:02:00Z', 'resume'),
        cron('settlement', '2026-10-23T00:00:00Z'),
        cron('grandMelee', '2026-10-21T17:14:00Z'),
        cron('grandMelee', '2026-10-22T17:00:00Z'),
      ],
      from,
      now,
    });
    expect(missed).toEqual([]);
  });

  it('never flags slots before tracking started, while the scheduler was disabled, or still within grace', () => {
    expect(findMissedRuns({ jobs: [GM], processes: [], runs: [], from, now })).toEqual([]);

    const disabled = findMissedRuns({
      jobs: [GM],
      processes: [process(1, '2026-10-22T10:00:00Z', '2026-10-23T09:03:00Z', false)],
      runs: [],
      from,
      now,
    });
    expect(disabled).toEqual([]);

    const fresh = findMissedRuns({
      jobs: [{ jobName: 'league', schedule: '0 9 * * *' }],
      processes: [process(1, '2026-10-23T08:00:00Z', '2026-10-23T09:03:00Z')],
      runs: [],
      from,
      now,
    });
    expect(fresh).toEqual([]);
  });

  it('a run inside the coverage window always covers its slot (property)', () => {
    const offsetArb = fc.integer({ min: -MIN, max: MISSED_RUN_GRACE_MS });
    fc.assert(fc.property(fc.array(offsetArb, { minLength: 7, maxLength: 7 }), (offsets) => {
      const start = at('2026-10-15T00:00:00Z').getTime();
      const runs = offsets.map((offset, day) => ({ jobName: 'grandMelee', trigger: 'cron', queuedAt: new Date(start + day * DAY + 17 * HOUR + offset) }));
      const missed = findMissedRuns({
        jobs: [GM],
        processes: [{ id: 1, startedAt: new Date(start), lastHeartbeatAt: at('2026-10-22T09:00:00Z'), schedulerEnabled: true }],
        runs,
        from: new Date(start),
        now: at('2026-10-22T09:00:00Z'),
      });
      expect(missed).toEqual([]);
    }));
  });

  it('every reported miss is an expected slot without a covering run (property)', () => {
    fc.assert(fc.property(
      fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
      fc.boolean(),
      (ranOnDay, enabled) => {
        const start = at('2026-10-15T00:00:00Z').getTime();
        const runs = ranOnDay.flatMap((ran, day) => (ran ? [{ jobName: 'grandMelee', trigger: 'cron', queuedAt: new Date(start + day * DAY + 17 * HOUR) }] : []));
        const missed = findMissedRuns({
          jobs: [GM],
          processes: [{ id: 1, startedAt: new Date(start), lastHeartbeatAt: at('2026-10-21T09:00:00Z'), schedulerEnabled: enabled }],
          runs,
          from: new Date(start),
          now: at('2026-10-21T09:00:00Z'),
        });
        const expected = enabled ? ranOnDay.filter((ran) => !ran).length : 0;
        expect(missed).toHaveLength(expected);
      },
    ));
  });
});
