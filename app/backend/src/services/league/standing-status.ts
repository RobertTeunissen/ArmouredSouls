/**
 * Per-entity league status, in words a player can act on: whether the next
 * rebalance moves a robot or team, and if it sits in a promotion or demotion
 * place without moving, why not.
 *
 * Derived from the executor's own tier plan (`LeagueTierPreview`), so the page
 * cannot disagree with what the rebalance does:
 * - zone places are fixed positions of the instance ranking (top/bottom 10%);
 * - inside them residency (cycles in tier) and, for promotion, the tier's LP
 *   minimum apply; a held place is not backfilled;
 * - opening an empty destination tier needs a tier-wide cohort, otherwise
 *   every promotion of the tier is held.
 */
import type { LeagueTierPreview, PlannableStanding } from './league-rebalancing-preview';
import type { LeagueRuleSet } from './league-rules';
import type { StandingStatus } from '../../shared/types';

/** Status for every entity in a promotion or demotion place of the tier; absent = no zone place. */
export function buildStandingStatuses<T extends PlannableStanding>(
  preview: LeagueTierPreview<T>,
  rules: LeagueRuleSet,
): Map<number, StandingStatus> {
  const statuses = new Map<number, StandingStatus>();
  const minCycles = rules.minCyclesForRebalancing;

  for (const instancePlan of preview.plan.instancePlans) {
    for (const standing of instancePlan.promotionZone) {
      const cyclesToGo = minCycles - standing.cyclesInTier;
      let status: StandingStatus;
      if (preview.effectivePromotionEntityIds.has(standing.entityId)) {
        status = { kind: 'promotes', zone: 'promotion' };
      } else if (cyclesToGo > 0) {
        status = { kind: 'held_cycles', zone: 'promotion', cyclesToGo };
      } else if (standing.leaguePoints < instancePlan.minPromotionLP) {
        status = { kind: 'held_lp', zone: 'promotion', minLP: instancePlan.minPromotionLP };
      } else {
        status = { kind: 'held_cohort', zone: 'promotion' };
      }
      statuses.set(standing.entityId, status);
    }
    for (const standing of instancePlan.demotionZone) {
      const cyclesToGo = minCycles - standing.cyclesInTier;
      statuses.set(
        standing.entityId,
        preview.demotionEntityIds.has(standing.entityId)
          ? { kind: 'demotes', zone: 'demotion' }
          : { kind: 'held_cycles', zone: 'demotion', cyclesToGo: Math.max(1, cyclesToGo) },
      );
    }
  }
  return statuses;
}
