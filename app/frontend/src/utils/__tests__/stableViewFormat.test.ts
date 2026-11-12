import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  archivedModeCells,
  bestFinish,
  bestTierPerMode,
  liveModeCells,
  ordinal,
  resultLabel,
  seasonTeams,
  sortRoster,
  tierDistribution,
  tierSummary,
  tierSummaryLabel,
  type ModeCell,
  type RosterRow,
} from '../stableViewFormat';
import type { PublicRobotStanding } from '../../components/stable-view/types';
import type { ArchivedRobot } from '@shared/types';

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

const standing = (overrides: Partial<PublicRobotStanding> & Pick<PublicRobotStanding, 'mode' | 'tier'>): PublicRobotStanding => ({
  leaguePoints: 0, wins: 0, losses: 0, draws: 0, totalMatches: null, teamName: null, ...overrides,
});

const archived = (overrides: Partial<ArchivedRobot>): ArchivedRobot => ({
  robotName: 'Smasher', imageUrl: null, frameId: 1, paintJob: null, finalElo: 1869, fame: 0,
  wins: 0, losses: 0, draws: 0, totalBattles: 0, damageDealtLifetime: 0, damageTakenLifetime: 0, kills: 0,
  mainWeaponName: null, offhandWeaponName: null, standings: [], teams: [], ...overrides,
});

describe('liveModeCells / tierSummary', () => {
  it('returns all six modes in order, with a dash for modes not played', () => {
    const cells = liveModeCells([standing({ mode: 'grand_melee', tier: 'champion' })]);
    expect(cells.map((c) => [c.mode, c.tier])).toEqual([
      ['league_1v1', null], ['league_2v2', null], ['league_3v3', null],
      ['tag_team', null], ['koth', null], ['grand_melee', 'champion'],
    ]);
  });

  it('counts the modes at the highest tier instead of naming one', () => {
    const cells = liveModeCells([
      standing({ mode: 'league_1v1', tier: 'champion', leaguePoints: 130 }),
      standing({ mode: 'koth', tier: 'champion', leaguePoints: 416 }),
      standing({ mode: 'grand_melee', tier: 'champion', leaguePoints: 718 }),
      standing({ mode: 'league_2v2', tier: 'diamond' }),
    ]);
    const summary = tierSummary(cells);
    expect(summary).toEqual({ tier: 'champion', modeCount: 3 });
    expect(tierSummaryLabel(summary!)).toBe('Champion ×3');
    expect(tierSummaryLabel({ tier: 'gold', modeCount: 1 })).toBe('Gold');
  });

  it('is null for a robot that has played nothing', () => {
    expect(tierSummary(liveModeCells([]))).toBeNull();
  });

  it('always picks the highest tier present (property)', () => {
    const cellArb = fc.array(fc.option(fc.constantFrom(...TIERS), { nil: null }), { minLength: 6, maxLength: 6 });
    fc.assert(fc.property(cellArb, (tiers) => {
      const cells = liveModeCells([]).map((c, i) => ({ ...c, tier: tiers[i] }));
      const played = tiers.filter((t): t is string => t !== null);
      const summary = tierSummary(cells);
      if (played.length === 0) return summary === null;
      const top = played.reduce((a, b) => (TIERS.indexOf(b) > TIERS.indexOf(a) ? b : a));
      return summary?.tier === top && summary.modeCount === played.filter((t) => t === top).length;
    }));
  });
});

describe('tierDistribution / bestTierPerMode', () => {
  it('counts robots per highest tier, best first, ignoring robots that have not played', () => {
    expect(tierDistribution([
      { tier: 'platinum', modeCount: 1 }, { tier: 'champion', modeCount: 3 }, null, { tier: 'champion', modeCount: 2 },
    ])).toEqual([{ tier: 'champion', count: 2 }, { tier: 'platinum', count: 1 }]);
  });

  it('takes the best tier per mode over the robots', () => {
    const a: ModeCell[] = liveModeCells([standing({ mode: 'league_1v1', tier: 'gold' })]);
    const b: ModeCell[] = liveModeCells([standing({ mode: 'league_1v1', tier: 'diamond' }), standing({ mode: 'koth', tier: 'silver' })]);
    const best = bestTierPerMode([a, b]);
    expect(best.find((m) => m.mode === 'league_1v1')?.tier).toBe('diamond');
    expect(best.find((m) => m.mode === 'koth')?.tier).toBe('silver');
    expect(best.find((m) => m.mode === 'tag_team')?.tier).toBeNull();
  });
});

describe('sortRoster', () => {
  const rows: RosterRow[] = [
    { id: 1, name: 'Bravo', elo: 1500, fame: 10, kills: 5, summary: { tier: 'gold', modeCount: 1 } },
    { id: 2, name: 'alpha', elo: 1800, fame: 30, kills: 1, summary: null },
    { id: 3, name: 'Charlie', elo: 1600, fame: 20, kills: 9, summary: { tier: 'gold', modeCount: 3 } },
  ];

  it('sorts by each key and direction without mutating the input', () => {
    expect(sortRoster(rows, 'elo', 'desc').map((r) => r.id)).toEqual([2, 3, 1]);
    expect(sortRoster(rows, 'name', 'asc').map((r) => r.id)).toEqual([2, 1, 3]);
    expect(sortRoster(rows, 'kills', 'desc').map((r) => r.id)).toEqual([3, 1, 2]);
    // Same tier: more modes at it ranks higher; not played ranks lowest.
    expect(sortRoster(rows, 'tier', 'desc').map((r) => r.id)).toEqual([3, 1, 2]);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});

describe('archived seasons', () => {
  const smasher = archived({
    standings: [
      { mode: 'league_1v1', tier: 'champion', leagueInstanceId: 'champion_1', leaguePoints: 259, wins: 167, losses: 20, draws: 8, bestWinStreak: 40, instanceRank: 1 },
      { mode: 'koth', tier: 'champion', leagueInstanceId: 'champion_1', leaguePoints: 535, wins: 35, losses: 0, draws: 0, bestWinStreak: 10, instanceRank: 13 },
      // Untouched subscription row.
      { mode: 'grand_melee', tier: 'bronze', leagueInstanceId: 'bronze_1', leaguePoints: 0, wins: 0, losses: 0, draws: 0, bestWinStreak: 0, instanceRank: 90 },
    ],
    teams: [
      { teamName: 'Smackers', teamSize: 2, modes: [{ mode: 'league_2v2', tier: 'platinum', leagueInstanceId: 'platinum_1', leaguePoints: 76, instanceRank: 20 }] },
    ],
  });

  it('builds the strip from robot and team standings and skips untouched rows', () => {
    const cells = archivedModeCells(smasher);
    expect(cells.map((c) => c.tier)).toEqual(['champion', 'platinum', null, null, 'champion', null]);
    expect(cells[1].detail).toBe('Team Smackers · 76 LP · #20');
    expect(tierSummary(cells)).toEqual({ tier: 'champion', modeCount: 2 });
  });

  it('reports the best finish as highest tier, then best rank', () => {
    expect(bestFinish(smasher)).toEqual({ tier: 'champion', mode: 'league_1v1', rank: 1 });
    expect(bestFinish(archived({}))).toBeNull();
  });

  it('collects teams with their members', () => {
    const splatter = archived({ robotName: 'Splatter', teams: smasher.teams });
    expect(seasonTeams([smasher, splatter])).toEqual([{ teamName: 'Smackers', teamSize: 2, members: ['Smasher', 'Splatter'] }]);
  });
});

describe('result labels', () => {
  it.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [21, '21st'], [102, '102nd']])('ordinal(%i) = %s', (n, label) => {
    expect(ordinal(n)).toBe(label);
  });

  it('prefers the placement, then the outcome', () => {
    expect(resultLabel({ robotId: 1, robotName: 'A', outcome: null, placement: 6 })).toBe('6th');
    expect(resultLabel({ robotId: 1, robotName: 'A', outcome: 'win', placement: null })).toBe('Win');
    expect(resultLabel({ robotId: 1, robotName: 'A', outcome: null, placement: null })).toBe('—');
  });
});
