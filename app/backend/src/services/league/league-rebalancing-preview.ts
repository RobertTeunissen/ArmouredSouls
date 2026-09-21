import { StandingsMode, Standing } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import {
  LeagueInstanceRebalancingPlan,
  LeagueTierRebalancingPlan,
  planLeagueInstanceRebalancing,
  planLeagueTierRebalancing,
} from './league-rebalancing-planner';
import { LeagueRuleSet } from './league-rules';

const STANDING_SELECTORS = {
  getEntityId: (standing: Standing): number => standing.entityId,
  getLeaguePoints: (standing: Standing): number => standing.leaguePoints,
  getCyclesInTier: (standing: Standing): number => standing.cyclesInTier,
};

export interface LeagueTierPreview {
  plan: LeagueTierRebalancingPlan<Standing>;
  instancePlansById: Map<string, LeagueInstanceRebalancingPlan<Standing>>;
  effectivePromotionEntityIds: Set<number>;
  demotionEntityIds: Set<number>;
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
  const standingsByInstance = new Map<string, Standing[]>();
  for (const standing of standings) {
    const rows = standingsByInstance.get(standing.leagueInstanceId) ?? [];
    rows.push(standing);
    standingsByInstance.set(standing.leagueInstanceId, rows);
  }

  const instancePlans = Array.from(standingsByInstance, ([leagueInstanceId, rows]) =>
    planLeagueInstanceRebalancing(leagueInstanceId, tier, rows, rules, STANDING_SELECTORS));
  const nextTierIndex = rules.tiers.indexOf(tier) + 1;
  const nextTier = nextTierIndex > 0 && nextTierIndex < rules.tiers.length
    ? rules.tiers[nextTierIndex]
    : null;
  const destinationPopulation = nextTier
    ? await prisma.standing.count({ where: { mode, tier: nextTier } })
    : 0;
  const plan = planLeagueTierRebalancing(tier, instancePlans, destinationPopulation, rules);

  return {
    plan,
    instancePlansById: new Map(instancePlans.map((instancePlan) => [instancePlan.instanceId, instancePlan])),
    effectivePromotionEntityIds: new Set(
      plan.effectivePromotionCandidates.map((standing) => standing.entityId),
    ),
    demotionEntityIds: new Set(plan.demotionCandidates.map((standing) => standing.entityId)),
  };
}
