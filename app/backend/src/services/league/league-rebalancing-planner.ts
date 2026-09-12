import { getMinLPForPromotion } from './leaguePromotionThresholds';
import { LeagueRuleSet } from './league-rules';

export type PromotionBlockReason = 'destination_cohort_too_small';

export interface LeaguePlanSelectors<T> {
  getEntityId(entity: T): number;
  getLeaguePoints(entity: T): number;
  getCyclesInTier(entity: T): number;
}

export interface LeagueInstanceRebalancingPlan<T> {
  instanceId: string;
  totalEntities: number;
  eligibleEntities: number;
  hasEnoughEntities: boolean;
  promotionSlots: number;
  demotionSlots: number;
  minPromotionLP: number;
  promotionZone: T[];
  demotionZone: T[];
  promotionCandidates: T[];
  demotionCandidates: T[];
}

export interface LeagueTierRebalancingPlan<T> {
  tier: string;
  instancePlans: LeagueInstanceRebalancingPlan<T>[];
  eligibleEntities: number;
  promotionCandidates: T[];
  effectivePromotionCandidates: T[];
  demotionCandidates: T[];
  promotionBlockReason: PromotionBlockReason | null;
  destinationPopulation: number;
}

function sortByLeaguePoints<T>(
  entities: readonly T[],
  selectors: LeaguePlanSelectors<T>,
  direction: 'asc' | 'desc',
): T[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...entities].sort((left, right) => {
    const lpDifference = selectors.getLeaguePoints(left) - selectors.getLeaguePoints(right);
    if (lpDifference !== 0) return lpDifference * multiplier;
    return selectors.getEntityId(left) - selectors.getEntityId(right);
  });
}

/**
 * Plans fixed promotion and demotion zones for one instance.
 *
 * Zone size and position are determined from the complete instance population.
 * Residency and LP gates are then applied inside those fixed positions; an
 * ineligible entity never causes a lower-ranked entity to backfill the zone.
 */
export function planLeagueInstanceRebalancing<T>(
  instanceId: string,
  tier: string,
  entities: readonly T[],
  rules: LeagueRuleSet,
  selectors: LeaguePlanSelectors<T>,
): LeagueInstanceRebalancingPlan<T> {
  const totalEntities = entities.length;
  const eligibleEntities = entities.filter(
    (entity) => selectors.getCyclesInTier(entity) >= rules.minCyclesForRebalancing,
  ).length;
  const hasEnoughEntities = totalEntities >= rules.minEntitiesForRebalancing;
  const isLowestTier = tier === rules.tiers[0];
  const isHighestTier = tier === rules.tiers[rules.tiers.length - 1];
  const minPromotionLP = rules.promotionMinLPOverride ?? getMinLPForPromotion(tier);
  const promotionSlots = hasEnoughEntities && !isHighestTier
    ? Math.floor(totalEntities * rules.promotionPercentage)
    : 0;
  const demotionSlots = hasEnoughEntities && !isLowestTier
    ? Math.floor(totalEntities * rules.demotionPercentage)
    : 0;

  const promotionZone = sortByLeaguePoints(entities, selectors, 'desc').slice(0, promotionSlots);
  const demotionZone = sortByLeaguePoints(entities, selectors, 'asc').slice(0, demotionSlots);
  const promotionCandidates = promotionZone.filter(
    (entity) => selectors.getCyclesInTier(entity) >= rules.minCyclesForRebalancing
      && selectors.getLeaguePoints(entity) >= minPromotionLP,
  );
  const demotionCandidates = demotionZone.filter(
    (entity) => selectors.getCyclesInTier(entity) >= rules.minCyclesForRebalancing,
  );

  return {
    instanceId,
    totalEntities,
    eligibleEntities,
    hasEnoughEntities,
    promotionSlots,
    demotionSlots,
    minPromotionLP,
    promotionZone,
    demotionZone,
    promotionCandidates,
    demotionCandidates,
  };
}

/** Applies the destination-tier cohort rule to the combined instance plans. */
export function planLeagueTierRebalancing<T>(
  tier: string,
  instancePlans: readonly LeagueInstanceRebalancingPlan<T>[],
  destinationPopulation: number,
  rules: LeagueRuleSet,
): LeagueTierRebalancingPlan<T> {
  const promotionCandidates = instancePlans.flatMap((plan) => plan.promotionCandidates);
  const demotionCandidates = instancePlans.flatMap((plan) => plan.demotionCandidates);
  const opensEmptyTier = promotionCandidates.length > 0 && destinationPopulation === 0;
  const promotionBlockReason: PromotionBlockReason | null = opensEmptyTier
    && promotionCandidates.length < rules.minCohortForNewTier
    ? 'destination_cohort_too_small'
    : null;

  return {
    tier,
    instancePlans: [...instancePlans],
    eligibleEntities: instancePlans.reduce((sum, plan) => sum + plan.eligibleEntities, 0),
    promotionCandidates,
    effectivePromotionCandidates: promotionBlockReason ? [] : promotionCandidates,
    demotionCandidates,
    promotionBlockReason,
    destinationPopulation,
  };
}
