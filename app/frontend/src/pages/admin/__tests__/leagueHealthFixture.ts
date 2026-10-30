/**
 * Small League Health overview for page and format tests: six modes, six tiers
 * each, with the problems the page must show (blocked team Champion, low
 * promotion, few demotions, unsubscribed rows).
 */
import type {
  LeagueHealthInstance,
  LeagueHealthMode,
  LeagueHealthModeSummary,
  LeagueHealthOverview,
  LeagueHealthTier,
  LeagueSeasonOverview,
} from '../../../utils/adminLeagueHealthApi';

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

export function instance(overrides: Partial<LeagueHealthInstance> = {}): LeagueHealthInstance {
  return {
    id: 'gold_1',
    total: 90,
    active: 90,
    human: 4,
    topLp: 110,
    hasEnoughEntities: true,
    promotionSlots: 9,
    promotionCandidates: 2,
    promotionLineLp: 72,
    promotionLineRank: 9,
    demotionSlots: 9,
    demotionCandidates: 1,
    demotionLineLp: 12,
    demotionLineRank: 82,
    ...overrides,
  };
}

export function tier(name: string, overrides: Partial<LeagueHealthTier> = {}): LeagueHealthTier {
  const index = TIERS.indexOf(name);
  return {
    tier: name,
    nextTier: TIERS[index + 1] ?? null,
    total: 90,
    active: 90,
    unsubscribed: 0,
    unsubscribedNotice: false,
    stableMix: { human: 4, automaton: 6, generated: 80 },
    averageElo: 1200,
    eligible: 60,
    instanceSize: { min: 90, max: 90 },
    instances: [instance({ id: `${name}_1` })],
    destinationPopulation: 50,
    promotion: {
      slots: index === TIERS.length - 1 ? 0 : 9,
      qualifyingNow: 2,
      minLp: [25, 50, 75, 100, 125][index] ?? null,
      bestLp: 110,
      blockReason: null,
      flow: index === TIERS.length - 1 ? null : { last: 4, average: 3.6, total: 18 },
    },
    demotion: { slots: index === 0 ? 0 : 9, qualifyingNow: 1, flow: index === 0 ? null : { last: 3, average: 2.4, total: 12 } },
    lowDemotionNotice: false,
    status: { level: 'ok', code: 'ok' },
    ...overrides,
  };
}

function mode(name: LeagueHealthMode, tiers: Partial<Record<string, Partial<LeagueHealthTier>>> = {}): LeagueHealthModeSummary {
  const team = name === 'league_2v2' || name === 'league_3v3' || name === 'tag_team';
  const placement = name === 'koth' || name === 'grand_melee';
  return {
    mode: name,
    entityType: team ? 'team' : 'robot',
    rules: {
      promotionPercentage: 0.1,
      demotionPercentage: 0.1,
      minCyclesInTier: placement ? 10 : 5,
      minEntitiesPerInstance: 10,
      minCohortForNewTier: 3,
      lpGated: !placement,
    },
    total: 540,
    active: 520,
    rebalanceCycles: [87, 86, 85, 84, 83],
    tiers: TIERS.map((name) => {
      const built = tier(name, tiers[name] ?? {});
      // Placement modes have no LP gate.
      return placement ? { ...built, promotion: { ...built.promotion, minLp: null } } : built;
    }),
  };
}

const blockedDiamond: Partial<LeagueHealthTier> = {
  total: 18,
  active: 18,
  stableMix: { human: 15, automaton: 0, generated: 3 },
  averageElo: 3389,
  instanceSize: { min: 18, max: 18 },
  instances: [instance({ id: 'diamond_1', total: 18, active: 18, human: 15, promotionSlots: 1, demotionSlots: 1, promotionLineRank: 1, demotionLineRank: 18 })],
  destinationPopulation: 0,
  promotion: { slots: 1, qualifyingNow: 1, minLp: 125, bestLp: 248, blockReason: null, flow: { last: 0, average: 0, total: 0 } },
  demotion: { slots: 1, qualifyingNow: 0, flow: { last: 0, average: 0.2, total: 1 } },
  status: { level: 'blocked', code: 'cohort_blocked' },
};
const emptyChampion: Partial<LeagueHealthTier> = {
  total: 0, active: 0, stableMix: { human: 0, automaton: 0, generated: 0 }, averageElo: null, eligible: 0,
  instanceSize: null, instances: [],
  promotion: { slots: 0, qualifyingNow: 0, minLp: null, bestLp: null, blockReason: null, flow: null },
  demotion: { slots: 0, qualifyingNow: 0, flow: null },
  status: { level: 'empty', code: 'empty' },
};

export function overview(overrides: Partial<LeagueHealthOverview> = {}): LeagueHealthOverview {
  return {
    generatedAt: '2026-10-29T17:30:00.000Z',
    season: { number: 1, phase: 'competitive', cycle: 88, lengthCycles: 100 },
    thresholds: { historyWindow: 5, lowMovementShare: 0.25, unsubscribedNoticeShare: 0.05 },
    modes: [
      mode('league_1v1', {
        bronze: { total: 2900, active: 2666, unsubscribed: 234, unsubscribedNotice: true },
        platinum: {
          total: 284,
          active: 284,
          instances: [
            instance({ id: 'platinum_1', total: 95, active: 95, human: 6, topLp: 105, promotionLineLp: 96, demotionLineLp: 76, demotionLineRank: 87 }),
            instance({ id: 'platinum_2', total: 95, active: 94, human: 4 }),
          ],
          promotion: { slots: 27, qualifyingNow: 0, minLp: 100, bestLp: 105, blockReason: null, flow: { last: 7, average: 6.4, total: 32 } },
          status: { level: 'warning', code: 'low_promotion' },
        },
      }),
      mode('league_2v2', { diamond: blockedDiamond, champion: emptyChampion }),
      mode('league_3v3', { diamond: { ...blockedDiamond, total: 17, active: 17 }, champion: emptyChampion }),
      mode('tag_team', { diamond: { ...blockedDiamond, total: 16, active: 16 }, champion: emptyChampion }),
      mode('koth', { gold: { lowDemotionNotice: true, demotion: { slots: 63, qualifyingNow: 0, flow: { last: 0, average: 0, total: 0 } } } }),
      mode('grand_melee'),
    ],
    attention: [
      {
        code: 'cohort_blocked', severity: 'error', tier: 'diamond', nextTier: 'champion', minCohortForNewTier: 3, minEntitiesPerInstance: 10, historyWindow: 5,
        entries: (['league_2v2', 'league_3v3', 'tag_team'] as const).map((m, i) => ({
          mode: m, tier: 'diamond', total: [18, 17, 16][i], unsubscribed: 0, promotionSlots: 1, promotionAverage: 0, demotionSlots: 1, demotionAverage: 0.2, minLp: 125,
        })),
      },
      {
        code: 'low_promotion', severity: 'warning', tier: 'platinum', nextTier: 'diamond', minCohortForNewTier: 3, minEntitiesPerInstance: 10, historyWindow: 5,
        entries: [{ mode: 'league_1v1', tier: 'platinum', total: 284, unsubscribed: 0, promotionSlots: 27, promotionAverage: 6.4, demotionSlots: 27, demotionAverage: 3.6, minLp: 100 }],
      },
      {
        code: 'low_demotion', severity: 'notice', tier: null, nextTier: null, minCohortForNewTier: 3, minEntitiesPerInstance: 10, historyWindow: 5,
        entries: [{ mode: 'koth', tier: 'gold', total: 90, unsubscribed: 0, promotionSlots: 9, promotionAverage: 3.6, demotionSlots: 63, demotionAverage: 0, minLp: null }],
      },
      {
        code: 'unsubscribed', severity: 'notice', tier: null, nextTier: null, minCohortForNewTier: 3, minEntitiesPerInstance: 10, historyWindow: 5,
        entries: [{ mode: 'league_1v1', tier: 'bronze', total: 2900, unsubscribed: 234, promotionSlots: 290, promotionAverage: 87, demotionSlots: 0, demotionAverage: null, minLp: 25 }],
      },
    ],
    ...overrides,
  };
}

/** "This season" for one mode: cycles 80–84 with cycle 82 quiet, two noted boundaries. */
export function season(overrides: Partial<LeagueSeasonOverview> = {}): LeagueSeasonOverview {
  return {
    mode: 'league_1v1',
    stable: 'all',
    window: 10,
    noteShare: 0.2,
    minSample: 20,
    firstCycle: 80,
    lastCycle: 84,
    judgedThroughCycle: 74,
    cycles: [
      { cycle: 80, promoted: 120, demoted: 20 },
      { cycle: 81, promoted: 140, demoted: 50 },
      { cycle: 82, promoted: 0, demoted: 0 },
      { cycle: 83, promoted: 151, demoted: 35 },
      { cycle: 84, promoted: 173, demoted: 30 },
    ],
    quietCycles: [82],
    totals: { promoted: 4449, demoted: 906 },
    boundaries: [
      { lower: 'bronze', upper: 'silver', promoted: 2754, demoted: 624, judged: 2057, back: 530, share: 530 / 2057, noted: true },
      { lower: 'silver', upper: 'gold', promoted: 1163, demoted: 209, judged: 817, back: 175, share: 175 / 817, noted: true },
      { lower: 'gold', upper: 'platinum', promoted: 428, demoted: 62, judged: 254, back: 44, share: 44 / 254, noted: false },
      { lower: 'platinum', upper: 'diamond', promoted: 93, demoted: 11, judged: 12, back: 3, share: 0.25, noted: false },
      { lower: 'diamond', upper: 'champion', promoted: 11, demoted: 0, judged: 0, back: 0, share: null, noted: false },
    ],
    ...overrides,
  };
}
