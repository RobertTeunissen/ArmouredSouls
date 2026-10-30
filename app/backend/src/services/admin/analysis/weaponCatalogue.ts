/**
 * The weapon catalogue for the Weapons analysis, and which catalogue weapons
 * no human player owns right now.
 */
import prisma from '../../../lib/prisma';
import { Prisma } from '../../../../generated/prisma';

export interface CatalogueWeapon {
  id: number;
  name: string;
  weaponType: string;
  handsRequired: string;
  rangeBand: string;
  cost: number;
}

export async function loadWeaponCatalogue(): Promise<CatalogueWeapon[]> {
  return prisma.weapon.findMany({
    select: { id: true, name: true, weaponType: true, handsRequired: true, rangeBand: true, cost: true },
    orderBy: { id: 'asc' },
  });
}

/** Catalogue weapon ids at least one human stable owns. */
export async function weaponsOwnedByPlayers(): Promise<Set<number>> {
  const rows = await prisma.$queryRaw<Array<{ weapon_id: number }>>(Prisma.sql`
    SELECT DISTINCT wi.weapon_id
    FROM weapon_inventory wi
    JOIN users u ON u.id = wi.user_id
    WHERE u.stable_type = 'human'
  `);
  return new Set(rows.map((r) => r.weapon_id));
}
