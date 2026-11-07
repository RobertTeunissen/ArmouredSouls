import { describe, it, expect } from 'vitest';
import { formItems, successRate, tierBands } from '../robotProfileFormat';
import { robotPath, workshopPath, workshopPathForTab } from '../robotRoutes';
import type { RecentResult } from '../../components/stable-view/types';

describe('tierBands', () => {
  it('starts one tier below the first promotion and ends at the current cycle', () => {
    const bands = tierBands([
      { cycleNumber: 10, destinationTier: 'silver', changeType: 'promotion', leaguePoints: 40 },
      { cycleNumber: 30, destinationTier: 'gold', changeType: 'promotion', leaguePoints: 45 },
    ], 'gold', 96);
    expect(bands.map((b) => [b.tier, b.fromCycle, b.toCycle])).toEqual([
      ['bronze', 1, 10], ['silver', 10, 30], ['gold', 30, 96],
    ]);
  });

  it('starts one tier above a first demotion', () => {
    expect(tierBands([{ cycleNumber: 5, destinationTier: 'gold', changeType: 'demotion', leaguePoints: 0 }], 'gold', 20)[0].tier).toBe('platinum');
  });

  it('is one band of the current tier without changes, and empty without a tier', () => {
    expect(tierBands([], 'diamond', 50)).toEqual([{ tier: 'diamond', fromCycle: 1, toCycle: 50, leaguePoints: null }]);
    expect(tierBands([], null, 50)).toEqual([]);
  });

  it('lets the current standing decide the last band', () => {
    const bands = tierBands([{ cycleNumber: 3, destinationTier: 'silver', changeType: 'promotion', leaguePoints: 30 }], 'gold', 10);
    expect(bands.at(-1)?.tier).toBe('gold');
  });
});

describe('formItems', () => {
  const result = (overrides: Partial<RecentResult>, entry: Partial<RecentResult['entries'][number]>): RecentResult => ({
    battleId: 1, battleType: 'league_1v1', tier: 'champion', tournamentRound: null, createdAt: '2026-11-06T00:00:00Z',
    entries: [{ robotId: 7, robotName: 'G', outcome: null, placement: null, ...entry }], ...overrides,
  });

  it('labels wins, losses and placements with the ELO change', () => {
    expect(formItems([
      result({ battleId: 3 }, { outcome: 'win', eloChange: 18 }),
      result({ battleId: 2, battleType: 'grand_melee' }, { placement: 1 }),
      result({ battleId: 1, battleType: 'koth' }, { placement: 5 }),
    ], 7).map((f) => [f.kind, f.label, f.eloChange])).toEqual([
      ['win', 'Win', 18], ['first', '1st', 0], ['placement', '5th', 0],
    ]);
  });
});

describe('successRate', () => {
  it('uses W/(W+L+D) for leagues and first places per match for placement modes', () => {
    expect(successRate({ mode: 'league_1v1', wins: 57, losses: 35, draws: 3, totalMatches: null })).toBeCloseTo(0.6, 2);
    expect(successRate({ mode: 'koth', wins: 27, losses: 0, draws: 0, totalMatches: 95 })).toBeCloseTo(0.284, 2);
    expect(successRate({ mode: 'grand_melee', wins: 0, losses: 0, draws: 0, totalMatches: 0 })).toBe(0);
  });
});

describe('robot routes', () => {
  it('sends owners to the Workshop and everyone else to the profile', () => {
    expect(robotPath(5, true)).toBe('/robots/5/prepare');
    expect(robotPath(5, false)).toBe('/robots/5');
    expect(workshopPath(5, 'loadout', true)).toBe('/robots/5/prepare?section=loadout&onboarding=true');
  });

  it('maps old owner tabs to Workshop sections and leaves public tabs on the profile', () => {
    expect(workshopPathForTab(5, 'upgrades', false)).toBe('/robots/5/prepare');
    expect(workshopPathForTab(5, 'tuning', false)).toBe('/robots/5/prepare');
    expect(workshopPathForTab(5, 'stats', false)).toBe('/robots/5/prepare');
    expect(workshopPathForTab(5, 'battle-config', false)).toBe('/robots/5/prepare?section=loadout');
    expect(workshopPathForTab(5, 'overview', false)).toBeNull();
    expect(workshopPathForTab(5, null, true)).toBe('/robots/5/prepare?section=loadout&onboarding=true');
  });
});
