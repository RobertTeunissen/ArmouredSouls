/**
 * Non-economic reads and the custom-name write behind `routes/weaponInventory.ts`
 * (moved out of the route file; response shapes unchanged). Purchases, sales
 * and refinements have their own services.
 */
import prisma from '../../lib/prisma';
import { getStorageStatus } from '../../utils/storageCalculations';

/** The stable's weapons, newest first, with where each is equipped and its refinements. */
export async function listWeaponInventory(userId: number) {
  return prisma.weaponInventory.findMany({
    where: { userId },
    include: {
      weapon: true,
      robotsMain: { select: { id: true, name: true } },
      robotsOffhand: { select: { id: true, name: true } },
      // Spec #34: refinements drive the My Inventory slot bar and the
      // rank-prefixed weapon name; ordered by slotIndex for stable display.
      refinements: { orderBy: { slotIndex: 'asc' } },
    },
    orderBy: { purchasedAt: 'desc' },
  });
}

/** Weapons held against the Storage Facility capacity. */
export async function getWeaponStorageStatus(userId: number) {
  const [storageFacility, currentWeaponCount] = await Promise.all([
    prisma.facility.findUnique({
      where: { userId_facilityType: { userId, facilityType: 'storage_facility' } },
      select: { level: true },
    }),
    prisma.weaponInventory.count({ where: { userId } }),
  ]);
  return getStorageStatus(currentWeaponCount, storageFacility?.level || 0);
}

/**
 * Set or clear a weapon's display name. Ownership is checked by the caller;
 * this is a cosmetic field, so it runs without a row lock (see the route).
 */
export async function setWeaponCustomName(inventoryId: number, customName: string | null) {
  return prisma.weaponInventory.update({
    where: { id: inventoryId },
    data: { customName },
    include: {
      weapon: true,
      refinements: { orderBy: { slotIndex: 'asc' } },
    },
  });
}
