/**
 * Unit tests for the pure "This season" assembly.
 */

import { buildLeagueSeason } from '../leagueSeasonService';

const move = (cycle: number, change: 'promotion' | 'demotion', source: string, destination: string, moved: number) => ({
  cycle_number: cycle, change_type: change, source_tier: source, destination_tier: destination, moved,
});

describe('buildLeagueSeason', () => {
  it('fills every cycle from first to last and lists quiet cycles of the mode', () => {
    const season = buildLeagueSeason('league_1v1', 'all', [10, 11, 13], [
      move(10, 'promotion', 'bronze', 'silver', 5),
      move(11, 'promotion', 'bronze', 'silver', 3),
      move(11, 'demotion', 'silver', 'bronze', 1),
      move(13, 'promotion', 'silver', 'gold', 2),
    ], []);
    expect(season.firstCycle).toBe(10);
    expect(season.lastCycle).toBe(13);
    expect(season.cycles).toEqual([
      { cycle: 10, promoted: 5, demoted: 0 },
      { cycle: 11, promoted: 3, demoted: 1 },
      { cycle: 12, promoted: 0, demoted: 0 },
      { cycle: 13, promoted: 2, demoted: 0 },
    ]);
    expect(season.quietCycles).toEqual([12]);
    expect(season.totals).toEqual({ promoted: 10, demoted: 1 });
  });

  it('shows zeros, not quiet cycles, where a filtered stable type had no moves', () => {
    // The mode moved in cycles 10-12 (any stable); this stable type only in 10.
    const season = buildLeagueSeason('league_1v1', 'human', [10, 11, 12], [move(10, 'promotion', 'bronze', 'silver', 2)], []);
    expect(season.quietCycles).toEqual([]);
    expect(season.cycles.map((c) => c.promoted)).toEqual([2, 0, 0]);
  });

  it('counts each boundary: promotions out of the lower tier, demotions out of the upper', () => {
    const season = buildLeagueSeason('league_1v1', 'all', [30], [
      move(30, 'promotion', 'bronze', 'silver', 40),
      move(30, 'demotion', 'silver', 'bronze', 9),
      move(30, 'promotion', 'silver', 'gold', 12),
      move(30, 'demotion', 'gold', 'silver', 3),
    ], []);
    expect(season.boundaries.map((b) => [`${b.lower}/${b.upper}`, b.promoted, b.demoted])).toEqual([
      ['bronze/silver', 40, 9],
      ['silver/gold', 12, 3],
      ['gold/platinum', 0, 0],
      ['platinum/diamond', 0, 0],
      ['diamond/champion', 0, 0],
    ]);
  });

  it('derives the bounce-back share and notes it above 20% with at least 20 judged promotions', () => {
    const season = buildLeagueSeason('league_1v1', 'all', [10, 87], [], [
      { source_tier: 'bronze', judged: 2057, back: 530 }, // 25.8% → noted
      { source_tier: 'silver', judged: 100, back: 20 }, // exactly 20% → not noted
      { source_tier: 'gold', judged: 10, back: 5 }, // 50% but only 10 judged → not noted
    ]);
    const [bronze, silver, gold, platinum] = season.boundaries;
    expect(bronze).toMatchObject({ judged: 2057, back: 530, noted: true });
    expect(bronze.share).toBeCloseTo(0.2577, 3);
    expect(silver).toMatchObject({ share: 0.2, noted: false });
    expect(gold).toMatchObject({ share: 0.5, noted: false });
    expect(platinum).toMatchObject({ judged: 0, share: null, noted: false });
    expect(season.judgedThroughCycle).toBe(77);
    expect(season).toMatchObject({ window: 10, noteShare: 0.2, minSample: 20 });
  });

  it('judges nothing before the mode has the window of cycles, and handles an empty mode', () => {
    expect(buildLeagueSeason('koth', 'all', [10, 15], [], []).judgedThroughCycle).toBeNull();
    const empty = buildLeagueSeason('league_3v3', 'all', [], [], []);
    expect(empty).toMatchObject({ firstCycle: null, lastCycle: null, judgedThroughCycle: null, cycles: [], quietCycles: [] });
  });
});
