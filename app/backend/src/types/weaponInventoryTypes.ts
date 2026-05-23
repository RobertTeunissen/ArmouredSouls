/**
 * Typed query payloads for `WeaponInventory` queries that include relations.
 *
 * Spec #34 added the `WeaponRefinement` model and a back-reference on
 * `WeaponInventory.refinements`. Several read paths (the My Inventory tab,
 * the equipped-weapon display on robot pages, the combat data prep step)
 * now load weapon-inventory rows with their refinements joined in.
 *
 * These aliases give those call sites a precise, single-source-of-truth
 * type so we don't have to repeat the `Prisma.WeaponInventoryGetPayload<...>`
 * incantation everywhere.
 */

import type { Prisma } from '../../generated/prisma';

/**
 * A `WeaponInventory` row joined with its `Weapon` catalog entry and any
 * `WeaponRefinement` rows. Used by:
 *   - `GET /api/weapon-inventory` (My Inventory tab)
 *   - The combat data prep step (`prepareRobotForCombat`) — Task 10.
 *   - The custom-name endpoint response — Task 8.
 */
export type WeaponInventoryWithRefinements = Prisma.WeaponInventoryGetPayload<{
  include: {
    weapon: true;
    refinements: true;
  };
}>;

/**
 * Same as {@link WeaponInventoryWithRefinements} but also includes the
 * `robotsMain` and `robotsOffhand` summaries that the inventory listing
 * uses to show "equipped on Robot X" badges.
 */
export type WeaponInventoryListItem = Prisma.WeaponInventoryGetPayload<{
  include: {
    weapon: true;
    refinements: true;
    robotsMain: { select: { id: true; name: true } };
    robotsOffhand: { select: { id: true; name: true } };
  };
}>;
