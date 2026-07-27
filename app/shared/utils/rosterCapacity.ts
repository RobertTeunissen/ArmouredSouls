/**
 * Roster_Capacity — how many robot slots a stable has.
 *
 * Lives in `app/shared/utils/` because two formulas now depend on it and both are
 * consumed by the frontend as well as the backend:
 *
 * - the Merchandising Hub multiplier (Spec #46 R2), which divides prestige by capacity
 * - the Training Facility discount (Spec #46 R11), which shrinks per-level as capacity grows
 *
 * Derived from the `roster_expansion` facility level, never from a live count of
 * `robots` rows. That distinction matters: a facility level only ever rises, so
 * capacity is monotonic and a player cannot temporarily inflate a discount or an
 * income multiplier by selling a robot before a settlement runs.
 */

/**
 * Robot slots available to a stable: `roster_expansion` level + 1.
 *
 * A stable with no `roster_expansion` row, or one at level 0, has capacity 1 —
 * every stable can field at least one robot.
 *
 * Mirrors `maxRobots` in `robotCreationService.ts`, which is the enforcement point.
 */
export function getRosterCapacity(rosterExpansionLevel: number): number {
  return Math.max(1, rosterExpansionLevel + 1);
}
