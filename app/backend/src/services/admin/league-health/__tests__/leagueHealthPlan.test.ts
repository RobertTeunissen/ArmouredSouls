/**
 * Unit tests for the pure League Health aggregation and status rules.
 */

import { HEAD_TO_HEAD_LEAGUE_RULES, PLACEMENT_LEAGUE_RULES, getLeagueRulesForMode } from '../../../league/league-rules';
import type { TieredLeagueMode } from '../../../league/league-rules';
import { buildLeagueHealthOverview } from '../leagueHealthService';
import { summariseMode, summariseTier, tierFlow } from '../leagueHealthPlan';
import type { LeagueHealthRow, LeagueMoveCount, ModeRebalanceHistory } from '../leagueHealthTypes';

let nextId = 1;

function row(overrides: Partial<LeagueHealthRow> = {}): LeagueHealthRow {
  return {
    entityId: nextId++,
    entityType: 'robot',
    mode: 'league_1v1',
    tier: 'bronze',
    leagueInstanceId: 'bronze_1',
    leaguePoints: 0,
    cyclesInTier: 10,
    stableType: 'generated',
    active: true,
    elo: 1000,
    ...overrides,
  };
}

/** `count` rows whose LP counts down from `topLp` by `step`. */
function rows(count: number, overrides: Partial<LeagueHealthRow> = {}, topLp = 200, step = 1): LeagueHealthRow[] {
  return Array.from({ length: count }, (_, index) => row({ leaguePoints: topLp - index * step, ...overrides }));
}

/**
 * History over cycles 87..83 (newest first). `promoted` / `demoted` list the
 * moves out of `tier` per cycle, newest first.
 */
function history(
  tier: string,
  promoted: number[],
  demoted: number[] = [],
  mode: TieredLeagueMode = 'league_1v1',
  cycles: number[] = [87, 86, 85, 84, 83],
): ModeRebalanceHistory {
  const moves: LeagueMoveCount[] = [];
  cycles.forEach((cycleNumber, index) => {
    if (promoted[index]) moves.push({ mode, cycleNumber, sourceTier: tier, changeType: 'promotion', moved: promoted[index] });
    if (demoted[index]) moves.push({ mode, cycleNumber, sourceTier: tier, changeType: 'demotion', moved: demoted[index] });
  });
  return { cycles, moves };
}

describe('getLeagueRulesForMode', () => {
  it('uses the head-to-head rules for the LP leagues', () => {
    for (const mode of ['league_1v1', 'league_2v2', 'league_3v3', 'tag_team']) {
      expect(getLeagueRulesForMode(mode)).toBe(HEAD_TO_HEAD_LEAGUE_RULES);
    }
  });

  it('uses 10 cycles and no LP gate for KotH and Grand Melee', () => {
    for (const mode of ['koth', 'grand_melee']) {
      const rules = getLeagueRulesForMode(mode);
      expect(rules).toBe(PLACEMENT_LEAGUE_RULES);
      expect(rules.minCyclesForRebalancing).toBe(10);
      expect(rules.promotionMinLPOverride).toBe(0);
    }
  });
});

describe('tierFlow', () => {
  it('sums the window, takes the newest cycle as last, and averages per rebalance', () => {
    expect(tierFlow(history('gold', [4, 0, 2, 1, 1]), 'gold', 'promotion')).toEqual({ last: 4, total: 8, average: 1.6 });
  });

  it('ignores cycles outside the window and other tiers', () => {
    const h = history('gold', [1, 1, 1, 1, 1, 50], [], 'league_1v1', [87, 86, 85, 84, 83, 82]);
    h.moves.push({ mode: 'league_1v1', cycleNumber: 87, sourceTier: 'silver', changeType: 'promotion', moved: 9 });
    expect(tierFlow(h, 'gold', 'promotion')).toEqual({ last: 1, total: 5, average: 1 });
  });

  it('is null before the mode has a full window of rebalances', () => {
    expect(tierFlow(history('gold', [3, 3], [], 'league_1v1', [87, 86]), 'gold', 'promotion')).toBeNull();
  });
});

describe('summariseTier', () => {
  const rules = HEAD_TO_HEAD_LEAGUE_RULES;

  it('counts active, unsubscribed and the stable mix', () => {
    const tierRows = [
      ...rows(18, { tier: 'silver', leagueInstanceId: 'silver_1' }),
      row({ tier: 'silver', leagueInstanceId: 'silver_1', active: false, stableType: 'automaton' }),
      row({ tier: 'silver', leagueInstanceId: 'silver_1', stableType: 'human' }),
    ];
    const tier = summariseTier('silver', tierRows, 50, rules);
    expect(tier.total).toBe(20);
    expect(tier.active).toBe(19);
    expect(tier.unsubscribed).toBe(1);
    expect(tier.unsubscribedNotice).toBe(true); // 1 of 20 = 5%
    expect(tier.stableMix).toEqual({ human: 1, automaton: 1, generated: 18 });
    expect(tier.nextTier).toBe('gold');
  });

  it('keeps zones at fixed places and reports the LP at each line', () => {
    // 20 robots in Silver (LP gate 50): 2 promotion places, 2 demotion places.
    const tierRows = rows(20, { tier: 'silver', leagueInstanceId: 'silver_1' }, 60, 5);
    tierRows[0].cyclesInTier = 1; // rank 1 lacks residency: its place stays empty
    const tier = summariseTier('silver', tierRows, 50, rules);
    const [instance] = tier.instances;

    expect(instance.promotionSlots).toBe(2);
    expect(instance.promotionCandidates).toBe(1);
    expect(instance.promotionLineRank).toBe(2);
    expect(instance.promotionLineLp).toBe(55);
    expect(instance.demotionLineRank).toBe(19);
    expect(instance.demotionLineLp).toBe(-30);
    expect(tier.promotion).toMatchObject({ slots: 2, qualifyingNow: 1, minLp: 50 });
    expect(tier.demotion).toMatchObject({ slots: 2, qualifyingNow: 2 });
  });

  it('matches the planner: an LP-blocked place is not back-filled from below', () => {
    const tierRows = rows(20, { tier: 'platinum', leagueInstanceId: 'platinum_1' }, 101, 1);
    tierRows[1].leaguePoints = 99; // rank 2 short of the 100 LP gate; rank 3 is not considered
    const tier = summariseTier('platinum', tierRows, 50, rules);
    expect(tier.promotion).toMatchObject({ slots: 2, qualifyingNow: 1 });
  });

  it('reports no zones below the minimum instance size', () => {
    const tier = summariseTier('champion', rows(7, { tier: 'champion', leagueInstanceId: 'champion_1' }), 0, rules);
    expect(tier.instances[0].hasEnoughEntities).toBe(false);
    expect(tier.promotion.slots).toBe(0);
    expect(tier.demotion.slots).toBe(0);
    expect(tier.promotion.minLp).toBeNull(); // top tier has no gate
    expect(tier.status).toEqual({ level: 'warning', code: 'frozen' });
  });

  it('averages ELO over rows that have one and sorts instances by number', () => {
    const tierRows = [
      row({ leagueInstanceId: 'bronze_10', elo: 1200 }),
      row({ leagueInstanceId: 'bronze_2', elo: 1000 }),
      row({ leagueInstanceId: 'bronze_2', elo: null }),
    ];
    const tier = summariseTier('bronze', tierRows, 0, rules);
    expect(tier.averageElo).toBe(1100);
    expect(tier.instances.map((instance) => instance.id)).toEqual(['bronze_2', 'bronze_10']);
    expect(tier.instanceSize).toEqual({ min: 1, max: 2 });
  });

  it('has no promotion flow in the top tier and no demotion flow in the lowest', () => {
    const h = history('bronze', [5, 5, 5, 5, 5]);
    expect(summariseTier('bronze', rows(20), 10, rules, h).demotion.flow).toBeNull();
    const champion = summariseTier('champion', rows(20, { tier: 'champion', leagueInstanceId: 'champion_1' }), 0, rules, history('champion', []));
    expect(champion.promotion.flow).toBeNull();
    expect(champion.demotion.flow).toEqual({ last: 0, total: 0, average: 0 });
  });
});

describe('tier status', () => {
  const rules = HEAD_TO_HEAD_LEAGUE_RULES;
  const diamond = (count: number, overrides: Partial<LeagueHealthRow> = {}): LeagueHealthRow[] =>
    rows(count, { tier: 'diamond', leagueInstanceId: 'diamond_1', ...overrides }, 248, 1);

  it('is empty without rows', () => {
    expect(summariseTier('champion', [], 0, rules).status).toEqual({ level: 'empty', code: 'empty' });
  });

  it('is blocked when the tier above is empty and the tier has fewer places than the cohort', () => {
    // 18 teams in one Diamond instance: 1 promotion place, cohort needs 3.
    const tier = summariseTier('diamond', diamond(18, { mode: 'league_2v2' }), 0, rules);
    expect(tier.promotion.slots).toBe(1);
    expect(tier.status).toEqual({ level: 'blocked', code: 'cohort_blocked' });
  });

  it('is not blocked by a snapshot that holds promotions when the tier has enough places', () => {
    // 30 rows, 3 places, only 2 reach 125 LP right now; flow decides instead.
    const tierRows = rows(30, { tier: 'diamond', leagueInstanceId: 'diamond_1' }, 130, 4);
    const tier = summariseTier('diamond', tierRows, 0, rules, history('diamond', [3, 3, 3, 3, 3]));
    expect(tier.promotion.blockReason).toBe('destination_cohort_too_small');
    expect(tier.status.code).toBe('ok');
  });

  it('is not blocked when the tier above has entities', () => {
    expect(summariseTier('diamond', diamond(18), 7, rules).status.code).toBe('ok');
  });

  it('is "no promotions" when the full window promoted nobody', () => {
    const tier = summariseTier('diamond', diamond(68), 7, rules, history('diamond', [0, 0, 0, 0, 0]));
    expect(tier.promotion.flow).toEqual({ last: 0, total: 0, average: 0 });
    expect(tier.status).toEqual({ level: 'warning', code: 'no_promotions' });
  });

  it('is "low promotion" below a quarter of the places on average', () => {
    // 68 robots: 6 places; average 1.4 per rebalance < 1.5.
    const tier = summariseTier('diamond', diamond(68), 7, rules, history('diamond', [1, 2, 1, 2, 1]));
    expect(tier.status).toEqual({ level: 'warning', code: 'low_promotion' });
  });

  it('is ok at exactly a quarter of the places on average', () => {
    // 80 robots: 8 places; average 2 per rebalance.
    const tier = summariseTier('diamond', diamond(80), 7, rules, history('diamond', [1, 3, 2, 2, 2]));
    expect(tier.status.code).toBe('ok');
  });

  it('is not judged on flow before the full window', () => {
    const tier = summariseTier('diamond', diamond(68), 7, rules, history('diamond', [0, 0], [], 'league_1v1', [87, 86]));
    expect(tier.promotion.flow).toBeNull();
    expect(tier.status.code).toBe('ok');
  });

  it('notes few demotions without changing the status', () => {
    // 68 robots: 6 demotion places; 2 demotions in 5 rebalances.
    const tier = summariseTier('diamond', diamond(68), 7, rules, history('diamond', [3, 3, 3, 3, 3], [1, 0, 1, 0, 0]));
    expect(tier.lowDemotionNotice).toBe(true);
    expect(tier.status.code).toBe('ok');
  });

  it('applies flow rules to placement modes too, without an LP gate', () => {
    const tierRows = rows(90, { tier: 'gold', leagueInstanceId: 'gold_1', mode: 'koth' }, 5, 0);
    const tier = summariseTier('gold', tierRows, 50, PLACEMENT_LEAGUE_RULES, history('gold', [9, 8, 9, 9, 7], [], 'koth'));
    expect(tier.promotion.minLp).toBeNull();
    expect(tier.status.code).toBe('ok');
    expect(tier.lowDemotionNotice).toBe(true);
  });
});

describe('summariseMode and the overview', () => {
  it('returns all six tiers in order, empty ones included', () => {
    // 40 teams: 4 promotion places, enough to open the empty Silver tier.
    const mode = summariseMode('league_3v3', rows(40, { mode: 'league_3v3', entityType: 'team' }));
    expect(mode.entityType).toBe('team');
    expect(mode.tiers.map((tier) => tier.tier)).toEqual(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion']);
    expect(mode.tiers[0].status.code).toBe('ok');
    expect(mode.tiers[1].status.code).toBe('empty');
    expect(mode.rules).toMatchObject({ minCyclesInTier: 5, minEntitiesPerInstance: 10, lpGated: true });
    expect(mode.rebalanceCycles).toEqual([]);
  });

  it('groups problems across modes and orders errors before warnings and notices', () => {
    const teamDiamond = (mode: TieredLeagueMode, count: number): LeagueHealthRow[] =>
      rows(count, { mode, entityType: 'team', tier: 'diamond', leagueInstanceId: 'diamond_1' }, 248, 10);
    const allRows = [
      ...rows(30, { mode: 'league_1v1' }),
      ...rows(7, { mode: 'league_1v1', tier: 'champion', leagueInstanceId: 'champion_1' }),
      ...rows(68, { mode: 'league_1v1', tier: 'diamond', leagueInstanceId: 'diamond_1' }, 124, 1),
      ...teamDiamond('league_2v2', 18),
      ...teamDiamond('league_3v3', 15),
      ...rows(20, { mode: 'grand_melee', active: false, stableType: 'automaton' }),
      ...rows(80, { mode: 'grand_melee' }),
    ];
    const oneV1 = history('diamond', [0, 0, 0, 0, 0], [0, 1, 0, 0, 0]);
    oneV1.moves.push(...history('bronze', [3, 3, 3, 3, 3]).moves);
    const overview = buildLeagueHealthOverview(
      allRows,
      new Map([['league_1v1', oneV1]]),
      null,
      new Date('2026-10-28T09:42:00Z'),
    );

    expect(overview.modes.map((mode) => mode.mode))
      .toEqual(['league_1v1', 'league_2v2', 'league_3v3', 'tag_team', 'koth', 'grand_melee']);
    expect(overview.attention.map((item) => [item.code, item.tier])).toEqual([
      ['cohort_blocked', 'diamond'],
      ['frozen', 'champion'],
      ['no_promotions', 'diamond'],
      ['low_demotion', null],
      ['unsubscribed', null],
    ]);
    const [blocked, , , lowDemotion, unsubscribed] = overview.attention;
    expect(blocked.severity).toBe('error');
    expect(blocked.nextTier).toBe('champion');
    expect(blocked.entries.map((entry) => [entry.mode, entry.total])).toEqual([['league_2v2', 18], ['league_3v3', 15]]);
    expect(lowDemotion.severity).toBe('notice');
    expect(lowDemotion.entries).toEqual([expect.objectContaining({ mode: 'league_1v1', tier: 'diamond', demotionSlots: 6, demotionAverage: 0.2 })]);
    expect(unsubscribed.entries).toEqual([expect.objectContaining({ mode: 'grand_melee', tier: 'bronze', unsubscribed: 20, total: 100 })]);
    expect(overview.thresholds).toEqual({ historyWindow: 5, lowMovementShare: 0.25, unsubscribedNoticeShare: 0.05 });
    expect(overview.generatedAt).toBe('2026-10-28T09:42:00.000Z');
  });
});
