/**
 * The choice sections of the admin Meta page (`GET /api/admin/meta/choices`):
 * stances, loadouts, yield thresholds, weapon totals and facility ownership
 * of the robots and stables in the stable-type filter. Read-only.
 *
 * Replaced `GET /api/admin/stats`, which also counted every battle of the
 * season (4.1 s on ACC per Meta load) and scheduled matches, finances and
 * tiers that no page shows any more.
 */
import prisma from '../../../lib/prisma';
import type { Prisma } from '../../../../generated/prisma';
import type { MetaChoices } from '../../../shared/types';

/** Weapons owned, robots with a main weapon, and owned weapons in any slot. */
async function getWeaponStats(userFilter: Prisma.UserWhereInput = {}): Promise<MetaChoices['weapons']> {
  const [totalBought, equipped, equippedInventoryItems] = await Promise.all([
    prisma.weaponInventory.count({ where: { user: userFilter } }),
    prisma.robot.count({ where: { mainWeaponId: { not: null }, user: userFilter } }),
    prisma.weaponInventory.count({
      where: { user: userFilter, OR: [{ robotsMain: { some: {} } }, { robotsOffhand: { some: {} } }] },
    }),
  ]);
  return { totalBought, equipped, equippedInventoryItems };
}

async function getStanceStats(userFilter: Prisma.UserWhereInput = {}): Promise<MetaChoices['stances']> {
  const rows = await prisma.robot.groupBy({ by: ['stance'], where: { user: userFilter }, _count: { id: true } });
  return rows.map((row) => ({ stance: row.stance, count: row._count.id }));
}

async function getLoadoutStats(userFilter: Prisma.UserWhereInput = {}): Promise<MetaChoices['loadouts']> {
  const rows = await prisma.robot.groupBy({ by: ['loadoutType'], where: { user: userFilter }, _count: { id: true } });
  return rows.map((row) => ({ type: row.loadoutType, count: row._count.id }));
}

async function getYieldThresholdStats(userFilter: Prisma.UserWhereInput = {}): Promise<MetaChoices['yieldThresholds']> {
  const rows = await prisma.robot.groupBy({ by: ['yieldThreshold'], where: { user: userFilter }, _count: { id: true } });
  const distribution = rows
    .map((row) => ({ threshold: row.yieldThreshold, count: row._count.id }))
    .sort((a, b) => a.threshold - b.threshold);
  const mostCommon = distribution.length > 0
    ? distribution.reduce((max, current) => (current.count > max.count ? current : max))
    : { threshold: 10, count: 0 };
  return { distribution, mostCommon: mostCommon.threshold, mostCommonCount: mostCommon.count };
}

/** Facility ownership per type (stables owning it at level ≥ 1), most owned first. */
async function getFacilityOwnership(userFilter: Prisma.UserWhereInput = {}): Promise<MetaChoices['facilities']> {
  const groups = await prisma.facility.groupBy({
    by: ['facilityType'],
    where: { level: { gt: 0 }, user: userFilter },
    _count: { _all: true },
    _avg: { level: true },
  });
  const summary = groups
    .map((group) => ({ type: group.facilityType, purchaseCount: group._count._all, avgLevel: Number(group._avg.level ?? 0) }))
    .sort((a, b) => b.purchaseCount - a.purchaseCount);
  return {
    summary,
    totalPurchases: summary.reduce((total, f) => total + f.purchaseCount, 0),
    mostPopular: summary[0]?.type ?? 'None',
  };
}

export async function getMetaChoices(userFilter: Prisma.UserWhereInput = {}): Promise<MetaChoices> {
  const [weapons, stances, loadouts, yieldThresholds, facilities] = await Promise.all([
    getWeaponStats(userFilter),
    getStanceStats(userFilter),
    getLoadoutStats(userFilter),
    getYieldThresholdStats(userFilter),
    getFacilityOwnership(userFilter),
  ]);
  return { weapons, stances, loadouts, yieldThresholds, facilities, timestamp: new Date().toISOString() };
}
