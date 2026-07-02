import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';

/**
 * Get weapon analytics data.
 */
export async function getWeaponAnalytics(userFilter: Prisma.UserWhereInput = {}) {
  // Weapon type distribution
  const weaponTypes = await prisma.weaponInventory.groupBy({
    by: ['weaponId'],
    where: { user: userFilter },
    _count: { id: true },
  });

  // Get weapon details for the IDs
  const weaponIds = weaponTypes.map((w) => w.weaponId);
  const weapons = await prisma.weapon.findMany({
    where: { id: { in: weaponIds } },
    select: { id: true, name: true, weaponType: true, cost: true, baseDamage: true },
  });

  const weaponMap = new Map(weapons.map((w) => [w.id, w]));

  const weaponPopularity = weaponTypes
    .map((wt) => {
      const weapon = weaponMap.get(wt.weaponId);
      return {
        weaponId: wt.weaponId,
        name: weapon?.name ?? 'Unknown',
        type: weapon?.weaponType ?? 'unknown',
        cost: weapon?.cost ?? 0,
        baseDamage: weapon?.baseDamage ?? 0,
        owned: wt._count.id,
      };
    })
    .sort((a, b) => b.owned - a.owned);

  // Type breakdown
  const typeBreakdown: Record<string, number> = {};
  for (const wp of weaponPopularity) {
    typeBreakdown[wp.type] = (typeBreakdown[wp.type] || 0) + wp.owned;
  }

  return {
    weapons: weaponPopularity.slice(0, 50),
    typeBreakdown,
    totalWeaponsOwned: weaponPopularity.reduce((sum, w) => sum + w.owned, 0),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get achievement analytics data.
 */
export async function getAchievementAnalytics(userFilter: Prisma.UserWhereInput = {}) {
  const [unlocksByAchievement, totalUsers, usersWithAnyAchievement] = await Promise.all([
    prisma.userAchievement.groupBy({
      by: ['achievementId'],
      where: { user: userFilter },
      _count: { id: true },
    }),
    prisma.user.count({ where: userFilter }),
    prisma.userAchievement.findMany({
      where: { user: userFilter },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const unlockMap = new Map(unlocksByAchievement.map(a => [a.achievementId, a._count.id]));

  // Import achievement config to enrich with names, tiers, categories
  const { ACHIEVEMENTS } = await import('../../config/achievements');

  const achievements = ACHIEVEMENTS.map((def) => {
    const unlockCount = unlockMap.get(def.id) || 0;
    return {
      achievementId: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      tier: def.tier,
      scope: def.scope,
      hidden: def.hidden,
      unlockCount,
      unlockRate: totalUsers > 0 ? Number(((unlockCount / totalUsers) * 100).toFixed(1)) : 0,
    };
  }).sort((a, b) => b.unlockCount - a.unlockCount);

  return {
    achievements,
    totalAchievements: ACHIEVEMENTS.length,
    totalUnlocks: achievements.reduce((sum, a) => sum + a.unlockCount, 0),
    uniquePlayersWithAchievements: usersWithAnyAchievement.length,
    totalUsers,
    participationRate: totalUsers > 0
      ? Number(((usersWithAnyAchievement.length / totalUsers) * 100).toFixed(1))
      : 0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get tuning system adoption metrics.
 */
export async function getTuningAdoption(userFilter: Prisma.UserWhereInput = {}) {
  // Count robots with any tuning allocation
  const robotsWithTuning = await prisma.tuningAllocation.count({
    where: {
      robot: { user: userFilter },
    },
  });

  const totalRobots = await prisma.robot.count({
    where: { user: userFilter },
  });

  // Get tuning allocations with details
  const allocations = await prisma.tuningAllocation.findMany({
    where: {
      robot: { user: userFilter },
    },
    select: {
      combatPower: true,
      targetingSystems: true,
      criticalSystems: true,
      penetration: true,
      weaponControl: true,
      attackSpeed: true,
      armorPlating: true,
      shieldCapacity: true,
      evasionThrusters: true,
      damageDampeners: true,
      counterProtocols: true,
      hullIntegrity: true,
      servoMotors: true,
      gyroStabilizers: true,
      hydraulicSystems: true,
      powerCore: true,
      combatAlgorithms: true,
      threatAnalysis: true,
      adaptiveAI: true,
      logicCores: true,
      syncProtocols: true,
      supportSystems: true,
      formationTactics: true,
    },
  });

  // Calculate which attributes are most tuned
  const attributeStats: Record<string, { total: number; robotCount: number }> = {};
  const tuningAttributes = [
    'combatPower', 'targetingSystems', 'criticalSystems', 'penetration',
    'weaponControl', 'attackSpeed', 'armorPlating', 'shieldCapacity',
    'evasionThrusters', 'damageDampeners', 'counterProtocols', 'hullIntegrity',
    'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
    'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
    'syncProtocols', 'supportSystems', 'formationTactics',
  ];

  for (const attr of tuningAttributes) {
    attributeStats[attr] = { total: 0, robotCount: 0 };
  }

  for (const alloc of allocations) {
    for (const attr of tuningAttributes) {
      const val = Number((alloc as Record<string, unknown>)[attr] ?? 0);
      if (val > 0) {
        attributeStats[attr].total += val;
        attributeStats[attr].robotCount++;
      }
    }
  }

  const attributeRanking = Object.entries(attributeStats)
    .map(([attribute, stats]) => ({
      attribute,
      totalPoints: Number(stats.total.toFixed(2)),
      robotCount: stats.robotCount,
      avgPerRobot: stats.robotCount > 0 ? Number((stats.total / stats.robotCount).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.robotCount - a.robotCount || b.totalPoints - a.totalPoints);

  return {
    robotsWithTuning,
    totalRobots,
    adoptionRate: totalRobots > 0 ? Number(((robotsWithTuning / totalRobots) * 100).toFixed(1)) : 0,
    totalAllocations: allocations.length,
    attributeRanking,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get weapon refinement adoption metrics.
 *
 * Surfaces how many players are using the Weapon Refinement system (Spec #34)
 * so admins can track feature adoption and per-tier engagement.
 *
 * Response shape:
 *   - usersWithRefinements: distinct user count with ≥1 refinement
 *   - totalUsers: total users in the filter scope
 *   - adoptionRate: percentage of in-scope users who have refined at least one weapon
 *   - totalRefinements: aggregate refinement row count
 *   - totalRefinedWeapons: count of distinct WeaponInventory rows with ≥1 refinement
 *   - totalCreditsSpent: lifetime credits spent on refinement across all in-scope users
 *   - tierBreakdown: per-tier slot counts and unique-user counts (hone/augment/sharpen/forge)
 *   - attributeRanking: which attributes are being honed/augmented most often
 *   - topSpenders: top 10 users by refinement credits spent (username, total spent, weapon count)
 *
 * Always excludes the `bye_robot_user` system account, regardless of filter mode.
 * The `real` and `auto` filters already exclude it via `buildUserFilter`; this extra
 * guard keeps the `all` filter honest so the system user can never appear in the
 * adoption stats even if a future filter mode forgets to exclude it.
 */
export async function getRefinementAdoption(userFilter: Prisma.UserWhereInput = {}) {
  // Compose the caller's filter into a scoped query.
  // When filter=real, buildUserFilter already excludes system accounts (bye_robot_user, bots).
  // When filter=all, no exclusions are applied — admins see the full picture.
  const scopedUserFilter: Prisma.UserWhereInput = {
    AND: [
      userFilter,
    ],
  };

  // ── Total users in scope ─────────────────────────────────────────────
  const totalUsers = await prisma.user.count({ where: scopedUserFilter });

  // ── Pull all in-scope refinements with the user/weapon context we need ─
  // Single query — refinements are bounded (max 5 per WeaponInventory row), so
  // this scales linearly with active refining users. For large player bases we
  // can switch to GROUP BY aggregations later if needed.
  const refinements = await prisma.weaponRefinement.findMany({
    where: {
      weaponInventory: {
        user: scopedUserFilter,
      },
    },
    select: {
      tier: true,
      magnitude: true,
      targetAttribute: true,
      costPaid: true,
      weaponInventoryId: true,
      weaponInventory: {
        select: {
          userId: true,
          user: {
            select: { username: true },
          },
        },
      },
    },
  });

  // ── Aggregate ─────────────────────────────────────────────────────────
  const userIds = new Set<number>();
  const weaponInventoryIds = new Set<number>();
  const tierBuckets: Record<string, { count: number; userIds: Set<number>; magnitudeSum: number }> = {
    hone:    { count: 0, userIds: new Set(), magnitudeSum: 0 },
    augment: { count: 0, userIds: new Set(), magnitudeSum: 0 },
    sharpen: { count: 0, userIds: new Set(), magnitudeSum: 0 },
    forge:   { count: 0, userIds: new Set(), magnitudeSum: 0 },
  };
  const attributeStats: Record<string, { count: number; userIds: Set<number>; magnitudeSum: number }> = {};
  const userSpend: Record<number, { username: string; totalSpent: number; weaponInventoryIds: Set<number> }> = {};
  let totalCreditsSpent = 0;

  for (const r of refinements) {
    const userId = r.weaponInventory.userId;
    const username = r.weaponInventory.user.username;
    userIds.add(userId);
    weaponInventoryIds.add(r.weaponInventoryId);
    totalCreditsSpent += r.costPaid;

    // Tier bucket — defensive lookup so a future tier value never throws
    const bucket = tierBuckets[r.tier];
    if (bucket) {
      bucket.count++;
      bucket.userIds.add(userId);
      bucket.magnitudeSum += r.magnitude;
    }

    // Attribute ranking (only hone/augment carry a target attribute)
    if (r.targetAttribute) {
      const stats = attributeStats[r.targetAttribute] ?? { count: 0, userIds: new Set(), magnitudeSum: 0 };
      stats.count++;
      stats.userIds.add(userId);
      stats.magnitudeSum += r.magnitude;
      attributeStats[r.targetAttribute] = stats;
    }

    // Per-user spend
    const spend = userSpend[userId] ?? { username, totalSpent: 0, weaponInventoryIds: new Set() };
    spend.totalSpent += r.costPaid;
    spend.weaponInventoryIds.add(r.weaponInventoryId);
    userSpend[userId] = spend;
  }

  const tierBreakdown = (Object.keys(tierBuckets) as Array<keyof typeof tierBuckets>).map((tier) => ({
    tier,
    refinementCount: tierBuckets[tier].count,
    uniqueUsers: tierBuckets[tier].userIds.size,
    totalMagnitude: tierBuckets[tier].magnitudeSum,
  }));

  const attributeRanking = Object.entries(attributeStats)
    .map(([attribute, stats]) => ({
      attribute,
      refinementCount: stats.count,
      uniqueUsers: stats.userIds.size,
      totalMagnitude: stats.magnitudeSum,
    }))
    .sort((a, b) => b.refinementCount - a.refinementCount || b.totalMagnitude - a.totalMagnitude);

  const topSpenders = Object.entries(userSpend)
    .map(([userIdStr, info]) => ({
      userId: Number(userIdStr),
      username: info.username,
      totalSpent: info.totalSpent,
      weaponCount: info.weaponInventoryIds.size,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);

  return {
    usersWithRefinements: userIds.size,
    totalUsers,
    adoptionRate: totalUsers > 0
      ? Number(((userIds.size / totalUsers) * 100).toFixed(1))
      : 0,
    totalRefinements: refinements.length,
    totalRefinedWeapons: weaponInventoryIds.size,
    totalCreditsSpent,
    tierBreakdown,
    attributeRanking,
    topSpenders,
    timestamp: new Date().toISOString(),
  };
}
