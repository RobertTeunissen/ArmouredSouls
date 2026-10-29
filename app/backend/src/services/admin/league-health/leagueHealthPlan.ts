/**
 * Pure League Health aggregation: groups standings rows per mode, tier and
 * instance, runs the rebalancer's own planner on them (structure, and who
 * qualifies right now), and adds the flow of the mode's last rebalances.
 *
 * `planLeagueInstanceRebalancing` / `planLeagueTierRebalancing` are the functions
 * `leagueEngine.buildTierPlanSnapshot` calls before a rebalance writes anything,
 * so places and zones here are the ones a rebalance uses.
 *
 * @module services/admin/league-health/leagueHealthPlan
 */

import {
  LeagueInstanceRebalancingPlan,
  LeaguePlanSelectors,
  planLeagueInstanceRebalancing,
  planLeagueTierRebalancing,
} from '../../league/league-rebalancing-planner';
import { getMinLPForPromotion } from '../../league/leaguePromotionThresholds';
import { LeagueRuleSet, TieredLeagueMode, getLeagueRulesForMode } from '../../league/league-rules';
import { LEAGUE_HISTORY_WINDOW, LEAGUE_LOW_MOVEMENT_SHARE, LEAGUE_UNSUBSCRIBED_NOTICE_SHARE } from '../adminThresholds';
import { classifyTierStatus } from './leagueHealthStatus';
import type {
  LeagueHealthEntityType,
  LeagueHealthInstance,
  LeagueHealthModeSummary,
  LeagueHealthRow,
  LeagueHealthTier,
  ModeRebalanceHistory,
  TierFlow,
} from './leagueHealthTypes';

const ROW_SELECTORS: LeaguePlanSelectors<LeagueHealthRow> = {
  getEntityId: (row) => row.entityId,
  getLeaguePoints: (row) => row.leaguePoints,
  getCyclesInTier: (row) => row.cyclesInTier,
};

const ENTITY_TYPE_BY_MODE: Record<TieredLeagueMode, LeagueHealthEntityType> = {
  league_1v1: 'robot',
  league_2v2: 'team',
  league_3v3: 'team',
  tag_team: 'team',
  koth: 'robot',
  grand_melee: 'robot',
};

const EMPTY_HISTORY: ModeRebalanceHistory = { cycles: [], moves: [] };

/** Instance number from `<tier>_<n>`, for a stable display order. */
function instanceNumber(instanceId: string): number {
  const parsed = parseInt(instanceId.split('_')[1] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/** The LP gate of a tier, or null when there is none (placement modes, top tier). */
export function promotionGateLp(tier: string, rules: LeagueRuleSet): number | null {
  if (rules.promotionMinLPOverride !== undefined) return null;
  const gate = getMinLPForPromotion(tier);
  return Number.isFinite(gate) ? gate : null;
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = groups.get(k);
    if (list) list.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

function rankByLeaguePoints(rows: readonly LeagueHealthRow[]): LeagueHealthRow[] {
  // Same order as the planner: LP descending, then entity id ascending.
  return [...rows].sort((a, b) => (b.leaguePoints - a.leaguePoints) || (a.entityId - b.entityId));
}

function summariseInstance(
  rows: readonly LeagueHealthRow[],
  plan: LeagueInstanceRebalancingPlan<LeagueHealthRow>,
): LeagueHealthInstance {
  const ranked = rankByLeaguePoints(rows);
  const promotionLineRank = plan.promotionSlots > 0 ? plan.promotionSlots : null;
  const demotionLineRank = plan.demotionSlots > 0 ? ranked.length - plan.demotionSlots + 1 : null;
  return {
    id: plan.instanceId,
    total: rows.length,
    active: rows.filter((row) => row.active).length,
    human: rows.filter((row) => row.stableType === 'human').length,
    topLp: ranked[0]?.leaguePoints ?? null,
    hasEnoughEntities: plan.hasEnoughEntities,
    promotionSlots: plan.promotionSlots,
    promotionCandidates: plan.promotionCandidates.length,
    promotionLineLp: promotionLineRank ? ranked[promotionLineRank - 1].leaguePoints : null,
    promotionLineRank,
    demotionSlots: plan.demotionSlots,
    demotionCandidates: plan.demotionCandidates.length,
    demotionLineLp: demotionLineRank ? ranked[demotionLineRank - 1].leaguePoints : null,
    demotionLineRank,
  };
}

/**
 * Moves out of `tier` over the history window, or null when the mode has fewer
 * than `window` observed rebalances (too early to judge).
 */
export function tierFlow(
  history: ModeRebalanceHistory,
  tier: string,
  changeType: 'promotion' | 'demotion',
  window: number = LEAGUE_HISTORY_WINDOW,
): TierFlow | null {
  const cycles = history.cycles.slice(0, window);
  if (cycles.length < window) return null;
  const inWindow = new Set(cycles);
  let total = 0;
  let last = 0;
  for (const move of history.moves) {
    if (move.sourceTier !== tier || move.changeType !== changeType || !inWindow.has(move.cycleNumber)) continue;
    total += move.moved;
    if (move.cycleNumber === cycles[0]) last += move.moved;
  }
  return { last, total, average: Math.round((total / cycles.length) * 10) / 10 };
}

/** Build one tier's summary from its rows, the tier above's population and the mode's history. */
export function summariseTier(
  tier: string,
  rows: readonly LeagueHealthRow[],
  destinationPopulation: number,
  rules: LeagueRuleSet,
  history: ModeRebalanceHistory = EMPTY_HISTORY,
): LeagueHealthTier {
  const tierIndex = rules.tiers.indexOf(tier);
  const nextTier = tierIndex >= 0 && tierIndex < rules.tiers.length - 1 ? rules.tiers[tierIndex + 1] : null;
  const isLowest = tierIndex === 0;
  const byInstance = [...groupBy(rows, (row) => row.leagueInstanceId)]
    .sort(([a], [b]) => instanceNumber(a) - instanceNumber(b));

  const instancePlans = byInstance.map(([instanceId, instanceRows]) =>
    planLeagueInstanceRebalancing(instanceId, tier, instanceRows, rules, ROW_SELECTORS));
  const tierPlan = planLeagueTierRebalancing(tier, instancePlans, destinationPopulation, rules);
  const instances = byInstance.map(([, instanceRows], index) => summariseInstance(instanceRows, instancePlans[index]));

  const total = rows.length;
  const active = rows.filter((row) => row.active).length;
  const unsubscribed = total - active;
  const elos = rows.map((row) => row.elo).filter((elo): elo is number => elo !== null);
  const sizes = instances.map((instance) => instance.total);
  const promotionSlots = instances.reduce((sum, instance) => sum + instance.promotionSlots, 0);
  const demotionSlots = instances.reduce((sum, instance) => sum + instance.demotionSlots, 0);
  const promotionFlow = nextTier === null || total === 0 ? null : tierFlow(history, tier, 'promotion');
  const demotionFlow = isLowest || total === 0 ? null : tierFlow(history, tier, 'demotion');

  const summary: Omit<LeagueHealthTier, 'status'> = {
    tier,
    nextTier,
    total,
    active,
    unsubscribed,
    unsubscribedNotice: total > 0 && unsubscribed / total >= LEAGUE_UNSUBSCRIBED_NOTICE_SHARE,
    stableMix: {
      human: rows.filter((row) => row.stableType === 'human').length,
      automaton: rows.filter((row) => row.stableType === 'automaton').length,
      generated: rows.filter((row) => row.stableType === 'generated').length,
    },
    averageElo: elos.length > 0 ? Math.round(elos.reduce((sum, elo) => sum + elo, 0) / elos.length) : null,
    eligible: rows.filter((row) => row.cyclesInTier >= rules.minCyclesForRebalancing).length,
    instanceSize: sizes.length > 0 ? { min: Math.min(...sizes), max: Math.max(...sizes) } : null,
    instances,
    destinationPopulation,
    promotion: {
      slots: promotionSlots,
      qualifyingNow: tierPlan.promotionCandidates.length,
      minLp: promotionGateLp(tier, rules),
      bestLp: rows.length > 0 ? Math.max(...rows.map((row) => row.leaguePoints)) : null,
      blockReason: tierPlan.promotionBlockReason,
      flow: promotionFlow,
    },
    demotion: {
      slots: demotionSlots,
      qualifyingNow: tierPlan.demotionCandidates.length,
      flow: demotionFlow,
    },
    lowDemotionNotice: demotionFlow !== null && demotionSlots > 0
      && demotionFlow.total / LEAGUE_HISTORY_WINDOW < demotionSlots * LEAGUE_LOW_MOVEMENT_SHARE,
  };

  return { ...summary, status: classifyTierStatus(summary, rules) };
}

/** Build one mode's summary: every tier in order, empty tiers included. */
export function summariseMode(
  mode: TieredLeagueMode,
  rows: readonly LeagueHealthRow[],
  history: ModeRebalanceHistory = EMPTY_HISTORY,
): LeagueHealthModeSummary {
  const rules = getLeagueRulesForMode(mode);
  const byTier = groupBy(rows, (row) => row.tier);
  const tiers = rules.tiers.map((tier, index) => {
    const nextTier = rules.tiers[index + 1];
    const destinationPopulation = nextTier ? (byTier.get(nextTier)?.length ?? 0) : 0;
    return summariseTier(tier, byTier.get(tier) ?? [], destinationPopulation, rules, history);
  });

  return {
    mode,
    entityType: ENTITY_TYPE_BY_MODE[mode],
    rules: {
      promotionPercentage: rules.promotionPercentage,
      demotionPercentage: rules.demotionPercentage,
      minCyclesInTier: rules.minCyclesForRebalancing,
      minEntitiesPerInstance: rules.minEntitiesForRebalancing,
      minCohortForNewTier: rules.minCohortForNewTier,
      lpGated: rules.promotionMinLPOverride === undefined,
    },
    total: rows.length,
    active: rows.filter((row) => row.active).length,
    rebalanceCycles: history.cycles.slice(0, LEAGUE_HISTORY_WINDOW),
    tiers,
  };
}
