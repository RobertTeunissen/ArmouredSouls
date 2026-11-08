import { StandingsMode, Standing } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import {
  LeagueInstanceRebalancingPlan,
  LeagueTierRebalancingPlan,
  planLeagueInstanceRebalancing,
  planLeagueTierRebalancing,
} from './league-rebalancing-planner';
import { LeagueRuleSet } from './league-rules';

/** The standing fields the planner reads. */
export type PlannableStanding = Pick<Standing, 'entityId' | 'leagueInstanceId' | 'leaguePoints' | 'cyclesInTier'>;

const STANDING_SELECTORS = {
  getEntityId: (standing: PlannableStanding): number => standing.entityId,
  getLeaguePoints: (standing: PlannableStanding): number => standing.leaguePoints,
  getCyclesInTier: (standing: PlannableStanding): number => standing.cyclesInTier,
};

export interface LeagueTierPreview<T extends PlannableStanding = Standing> {
  plan: LeagueTierRebalancingPlan<T>;
  instancePlansById: Map<string, LeagueInstanceRebalancingPlan<T>>;
  effectivePromotionEntityIds: Set<number>;
  demotionEntityIds: Set<number>;
}

/** The tier above `tier`, or null for the top tier. */
export function nextTierOf(tier: string, rules: LeagueRuleSet): string | null {
  const nextTierIndex = rules.tiers.indexOf(tier) + 1;
  return nextTierIndex > 0 && nextTierIndex < rules.tiers.length ? rules.tiers[nextTierIndex] : null;
}

/**
 * The executor's plan for one tier, from rows already loaded: every standing
 * of the tier (any instance) and the population of the tier above. Pure, so a
 * caller can plan several tiers from one query.
 */
export function buildLeagueTierPreview<T extends PlannableStanding>(
  tier: string,
  standings: readonly T[],
  rules: LeagueRuleSet,
  destinationPopulation: number,
): LeagueTierPreview<T> {
  const standingsByInstance = new Map<string, T[]>();
  for (const standing of standings) {
    const rows = standingsByInstance.get(standing.leagueInstanceId) ?? [];
    rows.push(standing);
    standingsByInstance.set(standing.leagueInstanceId, rows);
  }

  const instancePlans = Array.from(standingsByInstance, ([leagueInstanceId, rows]) =>
    planLeagueInstanceRebalancing<T>(leagueInstanceId, tier, rows, rules, STANDING_SELECTORS));
  const plan = planLeagueTierRebalancing<T>(tier, instancePlans, destinationPopulation, rules);

  return {
    plan,
    instancePlansById: new Map(instancePlans.map((instancePlan) => [instancePlan.instanceId, instancePlan])),
    effectivePromotionEntityIds: new Set(
      plan.effectivePromotionCandidates.map((standing) => standing.entityId),
    ),
    demotionEntityIds: new Set(plan.demotionCandidates.map((standing) => standing.entityId)),
  };
}

/** Builds the same read-only tier plan used by the league executor. */
export async function getLeagueTierPreview(
  mode: StandingsMode,
  tier: string,
  rules: LeagueRuleSet,
  _instanceId?: string,
): Promise<LeagueTierPreview> {
  // Cohort decisions are tier-wide even when the caller displays one instance.
  // Callers project `instancePlansById` after this complete plan is built.
  const standings = await prisma.standing.findMany({
    where: {
      mode,
      tier,
    },
  });
  const nextTier = nextTierOf(tier, rules);
  const destinationPopulation = nextTier
    ? await prisma.standing.count({ where: { mode, tier: nextTier } })
    : 0;
  return buildLeagueTierPreview(tier, standings, rules, destinationPopulation);
}
