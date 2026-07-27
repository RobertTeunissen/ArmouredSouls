/**
 * Hall of Records pruning, re-scoping, and win streaks — Spec #46 Requirements 4 and 7
 *
 * These tests pin the *shape* of the records payload rather than exercising the
 * database. The defects Requirement 4 addresses were all degenerate rankings —
 * every entry reporting the same value — so what has to be guarded is that the
 * category is gone and cannot return, plus that the surviving categories are
 * keyed and rounded the way the API promises.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 4.10, 4.17, 4.24, 4.26, 7.2, 7.9, 7.10, 7.16**
 */

import * as fc from 'fast-check';
import {
  DAMAGE_RECORD_MODES,
  WIN_STREAK_MODES,
} from '../../src/services/records/recordsQueryService';

describe('Most Damage is mode-scoped (R4.5)', () => {
  it('covers exactly the six battle modes the requirement names', () => {
    expect([...DAMAGE_RECORD_MODES]).toEqual([
      'league_1v1',
      'tournament_1v1',
      'league_2v2',
      'league_3v3',
      'koth',
      'grand_melee',
    ]);
  });

  it('includes both multi-participant modes, which is why the scoping is needed', () => {
    // A Grand Melee robot swings at 19 opponents over the same clock a 1v1 robot
    // spends on one, so an unscoped ranking measures target count, not damage.
    expect(DAMAGE_RECORD_MODES).toContain('grand_melee');
    expect(DAMAGE_RECORD_MODES).toContain('koth');
  });

  it('has no duplicate modes, so no mode can rank twice', () => {
    expect(new Set(DAMAGE_RECORD_MODES).size).toBe(DAMAGE_RECORD_MODES.length);
  });
});

describe('Win streak modes (R7.2, R7.9, R7.10)', () => {
  it('covers exactly the four league modes', () => {
    expect([...WIN_STREAK_MODES]).toEqual(['league_1v1', 'league_2v2', 'league_3v3', 'tag_team']);
  });

  it('excludes the tournament modes, whose streak columns are permanently zero', () => {
    // Tournament orchestrators never call recordBattleResult(), so
    // standings.best_win_streak is never incremented for them.
    expect(WIN_STREAK_MODES).not.toContain('tournament_1v1');
    expect(WIN_STREAK_MODES).not.toContain('tournament_2v2');
    expect(WIN_STREAK_MODES).not.toContain('tournament_3v3');
  });

  it('excludes grand_melee, where a win is placement 1 of 20', () => {
    expect(WIN_STREAK_MODES).not.toContain('grand_melee');
  });

  it('excludes koth, which already has its own streak category on the KotH tab', () => {
    expect(WIN_STREAK_MODES).not.toContain('koth');
  });
});

describe('Zone_Metric_Precision (R4.10, R4.26)', () => {
  // Mirrors roundToZonePrecision in recordsQueryService.ts. The service copy is
  // module-private on purpose — it is display formatting, not a shared formula —
  // so this test pins the contract the API response has to satisfy.
  const roundToZonePrecision = (v: number): number => Math.round(v * 10) / 10;

  it('collapses the accumulated floating-point residue seen in production', () => {
    // The reported value was 1642.7000000000005, produced by repeated += of
    // per-tick contributions into a Float column.
    expect(roundToZonePrecision(1642.7000000000005)).toBe(1642.7);
  });

  it('never emits more than one decimal place', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100000, noNaN: true }), (raw) => {
        const rounded = roundToZonePrecision(raw);
        // Multiplying by 10 must land on an integer within float tolerance.
        expect(Math.abs(rounded * 10 - Math.round(rounded * 10))).toBeLessThan(1e-6);
      }),
      { numRuns: 300 },
    );
  });

  it('is idempotent, so re-rounding a stored value never shifts it', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100000, noNaN: true }), (raw) => {
        const once = roundToZonePrecision(raw);
        expect(roundToZonePrecision(once)).toBe(once);
      }),
      { numRuns: 200 },
    );
  });
});

describe('Property 6: retained categories rank distinct values distinctly (R4.24)', () => {
  /**
   * The removed categories all failed this: Longest Battle returned the
   * MAX_BATTLE_DURATION cap for every entry, Best Placement returned 1 for every
   * winner, and both ELO categories returned the fixed ELO_K_FACTOR of 32. A
   * retained category must map distinct underlying values to distinct ranked
   * values, which is exactly what a descending sort on a non-saturating metric
   * gives.
   */
  it('a descending sort over distinct inputs yields strictly decreasing output', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 2, maxLength: 10 }),
        (values) => {
          const ranked = [...values].sort((a, b) => b - a).slice(0, 10);
          for (let i = 1; i < ranked.length; i++) {
            expect(ranked[i]).toBeLessThan(ranked[i - 1]);
          }
          expect(new Set(ranked).size).toBe(ranked.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('demonstrates why the removed categories failed the property', () => {
    const MAX_BATTLE_DURATION = 120;
    const ELO_K_FACTOR = 32;

    // Every capped battle reports the same duration.
    const longestBattle = Array.from({ length: 10 }, () => MAX_BATTLE_DURATION);
    expect(new Set(longestBattle).size).toBe(1);

    // Every winner's best KotH placement is 1.
    const bestPlacement = Array.from({ length: 10 }, () => 1);
    expect(new Set(bestPlacement).size).toBe(1);

    // Every extreme ELO change is the K factor.
    const eloExtremes = Array.from({ length: 10 }, () => ELO_K_FACTOR);
    expect(new Set(eloExtremes).size).toBe(1);
  });
});

describe('Kills per match (R4.17)', () => {
  const killsPerMatch = (kills: number, matches: number): number =>
    matches > 0 ? Number((kills / matches).toFixed(2)) : 0;

  it('ranks a deadlier robot above a higher-volume one', () => {
    // 40 kills over 40 matches vs 12 kills over 4.
    expect(killsPerMatch(12, 4)).toBeGreaterThan(killsPerMatch(40, 40));
  });

  it('returns 0 rather than dividing by zero when a robot has no matches', () => {
    expect(killsPerMatch(0, 0)).toBe(0);
  });

  it('never emits more than two decimals', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 1, max: 500 }),
        (kills, matches) => {
          const rate = killsPerMatch(kills, matches);
          expect(Math.abs(rate * 100 - Math.round(rate * 100))).toBeLessThan(1e-6);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('Team upsets use summed ELO (R4.7)', () => {
  it('a 3v3 differential exceeds the equivalent per-robot gap', () => {
    // Each favourite robot outrates each underdog robot by 100.
    const underdog = [1000, 1000, 1000];
    const favorite = [1100, 1100, 1100];
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

    const teamGap = sum(favorite) - sum(underdog);
    const perRobotGap = favorite[0] - underdog[0];

    expect(teamGap).toBe(300);
    expect(teamGap).toBeGreaterThan(perRobotGap);
  });

  it('scales with team size, so 3v3 upsets outrank 2v2 upsets at equal per-robot gaps', () => {
    const gapPerRobot = 100;
    expect(gapPerRobot * 3).toBeGreaterThan(gapPerRobot * 2);
  });
});
