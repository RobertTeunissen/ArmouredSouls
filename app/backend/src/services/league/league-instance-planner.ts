/**
 * Instance maintenance plan for one league tier (issue #603).
 *
 * League instances are meant to be fixed: an entity stays in its instance and
 * only moves on promotion or demotion, or when the tier's instances need
 * fixing. This pure planner decides, from the instance sizes alone, whether a
 * tier needs that fix after the nightly promotions and demotions:
 *
 * - **Re-deal** (full round-robin by LP) when an instance holds more than the
 *   maximum, or one is more than {@link REBALANCE_THRESHOLD} away from the tier
 *   target. A split is this case: a new instance opens only once every instance
 *   is full, and it starts with a single entity.
 * - **Merge** when the tier shrank enough to fit in fewer instances while
 *   keeping {@link INSTANCE_HEADROOM} free places in each. The highest-numbered
 *   instances are dissolved and their members spread over the rest; everyone
 *   else stays where they are. Promotions take the top 10% of every instance,
 *   so Bronze (and later the other tiers) shrinks over a season with a mostly
 *   static robot population.
 * - Otherwise **nothing moves**.
 *
 * Every re-deal and merge sizes the tier with {@link targetInstanceCount}, which
 * leaves the same headroom. That gap between "full" (100, a split) and "merge"
 * (80 on average) keeps a tier near a boundary from flipping back and forth.
 *
 * @module services/league/league-instance-planner
 */

/** An instance more than this many entities away from the tier target triggers a re-deal. */
export const REBALANCE_THRESHOLD = 20;

/** Free places per instance that a re-deal or merge leaves for later entrants. */
export const INSTANCE_HEADROOM = 20;

/** One instance and how many entities it holds. */
export interface InstanceSize {
  leagueId: string;
  instanceNumber: number;
  count: number;
}

export type InstanceMaintenancePlan =
  | { action: 'none' }
  | { action: 'redeal'; reason: 'overflow' | 'imbalance'; targetInstanceCount: number }
  | { action: 'merge'; keep: string[]; dissolve: string[] };

/**
 * Number of instances a re-deal or merge spreads `total` entities over: enough
 * that each holds at most `maxPerInstance - INSTANCE_HEADROOM` on average.
 * Always at least `ceil(total / maxPerInstance)`, and at least 1 for a non-empty tier.
 */
export function targetInstanceCount(total: number, maxPerInstance: number): number {
  if (total <= 0) return 0;
  const filledTo = maxPerInstance > INSTANCE_HEADROOM ? maxPerInstance - INSTANCE_HEADROOM : maxPerInstance;
  return Math.max(1, Math.ceil(total / filledTo), Math.ceil(total / maxPerInstance));
}

/** Decide whether a tier's instances need a re-deal, a merge, or nothing. */
export function planInstanceMaintenance(
  instances: readonly InstanceSize[],
  maxPerInstance: number,
): InstanceMaintenancePlan {
  const total = instances.reduce((sum, instance) => sum + instance.count, 0);
  if (total === 0) return { action: 'none' };

  const current = instances.length;
  const target = targetInstanceCount(total, maxPerInstance);

  if (instances.some((instance) => instance.count > maxPerInstance)) {
    return { action: 'redeal', reason: 'overflow', targetInstanceCount: target };
  }

  const perInstanceTarget = Math.ceil(total / current);
  const imbalanced = current >= 2 && instances.some(
    (instance) => Math.abs(instance.count - perInstanceTarget) > REBALANCE_THRESHOLD,
  );
  if (imbalanced) {
    return { action: 'redeal', reason: 'imbalance', targetInstanceCount: target };
  }

  if (current > target) {
    const byNumber = [...instances].sort((a, b) => a.instanceNumber - b.instanceNumber);
    return {
      action: 'merge',
      keep: byNumber.slice(0, target).map((instance) => instance.leagueId),
      dissolve: byNumber.slice(target).map((instance) => instance.leagueId),
    };
  }

  return { action: 'none' };
}
