/**
 * Unit tests for the dashboard battle-activity row builder (pure).
 */
import fc from 'fast-check';

jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { toBattleActivityRows, type RawBattleTypeAggregate } from '../adminBattleActivityService';
import { DASHBOARD_BATTLE_MODES } from '../adminQueuedMatches';

function aggregate(battleType: string, overrides: Partial<RawBattleTypeAggregate> = {}): RawBattleTypeAggregate {
  return {
    battleType,
    season: 10,
    lastCycle: 2,
    walkovers: 0,
    fought: 10,
    draws: 1,
    kills: 3,
    avgDuration: 40,
    ...overrides,
  };
}

describe('toBattleActivityRows', () => {
  it('emits one row per dashboard mode in a fixed order, even with no battles', () => {
    const { rows, totals } = toBattleActivityRows([], new Map(), true);

    expect(rows.map((row) => row.mode)).toEqual([...DASHBOARD_BATTLE_MODES]);
    expect(rows.every((row) => row.season === 0 && row.lastCycle === 0 && row.queued === 0)).toBe(true);
    expect(totals).toEqual({
      lastCycle: 0, season: 0, walkovers: 0, queued: 0, drawRate: 0, killRate: 0, avgDurationSeconds: 0,
    });
  });

  it('reports last-cycle counts as null when there is no window', () => {
    const { rows, totals } = toBattleActivityRows([aggregate('league_1v1')], new Map(), false);

    expect(rows.every((row) => row.lastCycle === null)).toBe(true);
    expect(totals.lastCycle).toBeNull();
  });

  it('computes rates over fought battles and leaves draws n/a for placement modes', () => {
    const { rows } = toBattleActivityRows(
      [
        aggregate('league_1v1', { season: 12, walkovers: 2, fought: 10, draws: 1, kills: 4, avgDuration: 48.64 }),
        aggregate('koth', { fought: 5, draws: 0, kills: 5 }),
      ],
      new Map([['league_1v1', 7]]),
      true,
    );
    const league = rows.find((row) => row.mode === 'league_1v1');
    const koth = rows.find((row) => row.mode === 'koth');

    expect(league).toMatchObject({ season: 12, walkovers: 2, queued: 7, drawRate: 10, killRate: 40, avgDurationSeconds: 48.6 });
    expect(koth?.drawRate).toBeNull();
    expect(koth?.killRate).toBe(100);
  });

  it('keeps an unknown battle type as its own row so totals still add up', () => {
    const { rows, totals } = toBattleActivityRows([aggregate('league'), aggregate('league_1v1')], new Map(), true);

    expect(rows.at(-1)?.mode).toBe('league');
    expect(totals.season).toBe(20);
  });

  it('weights the total average duration by fought battles and excludes placement modes from the draw rate', () => {
    const { totals } = toBattleActivityRows(
      [
        aggregate('league_1v1', { fought: 30, draws: 3, avgDuration: 40 }),
        aggregate('koth', { fought: 10, draws: 0, avgDuration: 100 }),
      ],
      new Map(),
      true,
    );

    expect(totals.avgDurationSeconds).toBe(55);
    expect(totals.drawRate).toBe(10);
  });

  it('conserves counts: totals equal the sum of the rows (property)', () => {
    const modes = [...DASHBOARD_BATTLE_MODES, 'legacy_mode'];
    const rawArb = fc.uniqueArray(
      fc.record({
        battleType: fc.constantFrom(...modes),
        season: fc.nat({ max: 50_000 }),
        lastCycle: fc.nat({ max: 5_000 }),
        walkovers: fc.nat({ max: 1_000 }),
        fought: fc.nat({ max: 50_000 }),
        draws: fc.nat({ max: 1_000 }),
        kills: fc.nat({ max: 1_000 }),
        avgDuration: fc.double({ min: 0, max: 300, noNaN: true, noDefaultInfinity: true }),
      }),
      { selector: (row) => row.battleType, maxLength: modes.length },
    );
    const queuedArb = fc.dictionary(fc.constantFrom(...DASHBOARD_BATTLE_MODES), fc.nat({ max: 500 }));

    fc.assert(
      fc.property(rawArb, queuedArb, (raw, queued) => {
        const { rows, totals } = toBattleActivityRows(raw, new Map(Object.entries(queued)), true);
        const sum = (pick: (row: (typeof rows)[number]) => number): number =>
          rows.reduce((total, row) => total + pick(row), 0);

        expect(totals.season).toBe(sum((row) => row.season));
        expect(totals.lastCycle).toBe(sum((row) => row.lastCycle ?? 0));
        expect(totals.walkovers).toBe(sum((row) => row.walkovers));
        expect(totals.queued).toBe(sum((row) => row.queued));
        expect(rows).toHaveLength(DASHBOARD_BATTLE_MODES.length + (raw.some((row) => row.battleType === 'legacy_mode') ? 1 : 0));
      }),
      { numRuns: 200 },
    );
  });
});
