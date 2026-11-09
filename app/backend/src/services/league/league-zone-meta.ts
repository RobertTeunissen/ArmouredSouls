/**
 * The `zoneMeta` block every league standings endpoint returns (1v1, KotH,
 * Grand Melee, 2v2, 3v3, Tag Team): the tier's or selected instance's zone
 * sizes, gates and population, projected from the executor's tier plan.
 */
import type { PromotionBlockReason } from './league-rebalancing-planner';
import type { LeagueTierPreview, PlannableStanding } from './league-rebalancing-preview';
import type { LeagueRuleSet } from './league-rules';
import { getMinLPForPromotion } from './leaguePromotionThresholds';

export interface LeagueZoneMeta {
  tier: string;
  /** LP needed to promote out of this tier; null in the top tier (nobody promotes). */
  minLP: number | null;
  minCycles: number;
  minRobotsRequired: number;
  eligibleCount: number;
  hasEnoughRobots: boolean;
  promotionSlots: number;
  demotionSlots: number;
  promotionCandidates: number;
  effectivePromotionCandidates: number;
  promotionBlockReason: PromotionBlockReason | null;
  totalEntities: number;
  totalInstances: number;
  activeInstances: number;
  instancesBelowMinimum: number;
  smallestInstancePopulation: number;
  isChampion: boolean;
  isBronze: boolean;
}

export function buildLeagueZoneMeta<T extends PlannableStanding>(
  preview: LeagueTierPreview<T>,
  rules: LeagueRuleSet,
  tier: string,
  instance?: string,
): LeagueZoneMeta {
  const selected = instance ? preview.instancePlansById.get(instance) : undefined;
  const plans = selected ? [selected] : instance ? [] : preview.plan.instancePlans;
  const isChampion = tier === rules.tiers[rules.tiers.length - 1];
  const isBronze = tier === rules.tiers[0];
  const instancesBelowMinimum = plans.filter((plan) => !plan.hasEnoughEntities).length;
  const promotionCandidates = plans.reduce((sum, plan) => sum + plan.promotionCandidates.length, 0);

  return {
    tier,
    minLP: isChampion ? null : rules.promotionMinLPOverride ?? getMinLPForPromotion(tier),
    minCycles: rules.minCyclesForRebalancing,
    minRobotsRequired: rules.minEntitiesForRebalancing,
    eligibleCount: plans.reduce((sum, plan) => sum + plan.eligibleEntities, 0),
    hasEnoughRobots: plans.length > 0 && instancesBelowMinimum === 0,
    promotionSlots: plans.reduce((sum, plan) => sum + plan.promotionSlots, 0),
    demotionSlots: plans.reduce((sum, plan) => sum + plan.demotionSlots, 0),
    promotionCandidates,
    effectivePromotionCandidates: preview.plan.promotionBlockReason ? 0 : promotionCandidates,
    promotionBlockReason: preview.plan.promotionBlockReason,
    totalEntities: plans.reduce((sum, plan) => sum + plan.totalEntities, 0),
    totalInstances: plans.length,
    activeInstances: plans.length - instancesBelowMinimum,
    instancesBelowMinimum,
    smallestInstancePopulation: plans.length > 0 ? Math.min(...plans.map((plan) => plan.totalEntities)) : 0,
    isChampion,
    isBronze,
  };
}
