import prisma from '../../lib/prisma';
import { MatchType, Prisma } from '../../../generated/prisma';
import {
  readRepairChargedCredits,
  readRepairPreDiscountCredits,
} from '../economy/repairPayloadKeys';
import { BANKRUPTCY_RISK_THRESHOLD } from './adminThresholds';

// Helper function to get weapon statistics
export async function getWeaponStats(userFilter: Prisma.UserWhereInput = {}) {
  const [totalBought, equippedWeapons, equippedInventoryItems] = await Promise.all([
    prisma.weaponInventory.count({
      where: {
        user: userFilter,
      },
    }),
    // Robots with a main weapon. Kept for compatibility; it ignores offhands.
    prisma.robot.count({
      where: {
        mainWeaponId: { not: null },
        user: userFilter,
      },
    }),
    // Owned weapons that sit in any robot's main or offhand slot.
    prisma.weaponInventory.count({
      where: {
        user: userFilter,
        OR: [{ robotsMain: { some: {} } }, { robotsOffhand: { some: {} } }],
      },
    }),
  ]);

  return {
    totalBought,
    equipped: equippedWeapons,
    equippedInventoryItems,
  };
}

// Helper function to get stance statistics
export async function getStanceStats(userFilter: Prisma.UserWhereInput = {}) {
  const stances = await prisma.robot.groupBy({
    by: ['stance'],
    where: {
  
      user: userFilter,
    },
    _count: { id: true },
  });
  
  return stances.map(s => ({
    stance: s.stance,
    count: s._count.id,
  }));
}

// Helper function to get loadout statistics
export async function getLoadoutStats(userFilter: Prisma.UserWhereInput = {}) {
  const loadouts = await prisma.robot.groupBy({
    by: ['loadoutType'],
    where: {
  
      user: userFilter,
    },
    _count: { id: true },
  });
  
  return loadouts.map(l => ({
    type: l.loadoutType,
    count: l._count.id,
  }));
}

// Helper function to get yield threshold statistics
export async function getYieldThresholdStats(userFilter: Prisma.UserWhereInput = {}) {
  const yieldThresholds = await prisma.robot.groupBy({
    by: ['yieldThreshold'],
    where: {
  
      user: userFilter,
    },
    _count: { id: true },
  });
  
  const distribution = yieldThresholds
    .map(y => ({
      threshold: y.yieldThreshold,
      count: y._count.id,
    }))
    .sort((a, b) => a.threshold - b.threshold);
  
  // Find most common threshold
  const mostCommon = distribution.length > 0
    ? distribution.reduce((max, curr) => curr.count > max.count ? curr : max)
    : { threshold: 10, count: 0 };
  
  return {
    distribution,
    mostCommon: mostCommon.threshold,
    mostCommonCount: mostCommon.count,
  };
}

/**
 * Map a robot record to an attribute object for stats display.
 * Accepts any object with the standard robot attribute fields.
 */
export function mapRobotAttributes(robot: {
  combatPower: Prisma.Decimal;
  targetingSystems: Prisma.Decimal;
  criticalSystems: Prisma.Decimal;
  penetration: Prisma.Decimal;
  weaponControl: Prisma.Decimal;
  attackSpeed: Prisma.Decimal;
  armorPlating: Prisma.Decimal;
  shieldCapacity: Prisma.Decimal;
  evasionThrusters: Prisma.Decimal;
  damageDampeners: Prisma.Decimal;
  counterProtocols: Prisma.Decimal;
  hullIntegrity: Prisma.Decimal;
  servoMotors: Prisma.Decimal;
  gyroStabilizers: Prisma.Decimal;
  hydraulicSystems: Prisma.Decimal;
  powerCore: Prisma.Decimal;
  combatAlgorithms: Prisma.Decimal;
  threatAnalysis: Prisma.Decimal;
  adaptiveAI: Prisma.Decimal;
  logicCores: Prisma.Decimal;
  syncProtocols: Prisma.Decimal;
  supportSystems: Prisma.Decimal;
  formationTactics: Prisma.Decimal;
}) {
  return {
    combatPower: robot.combatPower,
    targetingSystems: robot.targetingSystems,
    criticalSystems: robot.criticalSystems,
    penetration: robot.penetration,
    weaponControl: robot.weaponControl,
    attackSpeed: robot.attackSpeed,
    armorPlating: robot.armorPlating,
    shieldCapacity: robot.shieldCapacity,
    evasionThrusters: robot.evasionThrusters,
    damageDampeners: robot.damageDampeners,
    counterProtocols: robot.counterProtocols,
    hullIntegrity: robot.hullIntegrity,
    servoMotors: robot.servoMotors,
    gyroStabilizers: robot.gyroStabilizers,
    hydraulicSystems: robot.hydraulicSystems,
    powerCore: robot.powerCore,
    combatAlgorithms: robot.combatAlgorithms,
    threatAnalysis: robot.threatAnalysis,
    adaptiveAI: robot.adaptiveAI,
    logicCores: robot.logicCores,
    syncProtocols: robot.syncProtocols,
    supportSystems: robot.supportSystems,
    formationTactics: robot.formationTactics,
  };
}

/**
 * Calculate min/max/avg/median/quartile statistics from a number array.
 * Returns null for empty arrays.
 */
export function calculateStats(values: number[]) {
  if (values.length === 0) return null;
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;
  
  // Calculate median
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  
  // Calculate quartiles
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  // Calculate standard deviation
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Identify outliers using IQR method (values beyond 1.5 * IQR from quartiles)
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  return {
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1: Number(q1.toFixed(2)),
    q3: Number(q3.toFixed(2)),
    iqr: Number(iqr.toFixed(2)),
    lowerBound: Number(lowerBound.toFixed(2)),
    upperBound: Number(upperBound.toFixed(2)),
  };
}

/**
 * Gather all system-wide statistics for the admin /stats endpoint.
 * Returns the exact shape that the route handler sends as JSON.
 */
/**
 * League 1v1 tier counts and average ELO, from `standings` (the source of truth),
 * restricted to the robots of the filtered users. An empty filter means all.
 */
async function getLeague1v1TierCounts(
  userFilter: Prisma.UserWhereInput,
): Promise<Array<{ tier: string; count: number; avgElo: number }>> {
  const unfiltered = Object.keys(userFilter).length === 0;
  let ownerClause = Prisma.empty;
  if (!unfiltered) {
    const users = await prisma.user.findMany({ where: userFilter, select: { id: true } });
    if (users.length === 0) return [];
    ownerClause = Prisma.sql`AND r.user_id = ANY(${users.map((u) => u.id)}::int[])`;
  }
  const rows = await prisma.$queryRaw<Array<{ tier: string; count: bigint; avg_elo: number | null }>>`
    SELECT s."tier", COUNT(*)::bigint AS count, AVG(r.elo)::float8 AS avg_elo
    FROM "standings" s
    JOIN "robots" r ON r.id = s."entity_id"
    WHERE s."entity_type" = 'robot' AND s."mode" = 'league_1v1' ${ownerClause}
    GROUP BY s."tier"
  `;
  return rows.map((row) => ({ tier: row.tier, count: Number(row.count), avgElo: Math.round(Number(row.avg_elo ?? 0)) }));
}

/** Facility ownership per type (stables owning it at level ≥ 1), in SQL. */
async function getFacilityOwnership(
  userFilter: Prisma.UserWhereInput,
): Promise<Array<{ type: string; purchaseCount: number; avgLevel: number }>> {
  const groups = await prisma.facility.groupBy({
    by: ['facilityType'],
    where: { level: { gt: 0 }, user: userFilter },
    _count: { _all: true },
    _avg: { level: true },
  });
  return groups
    .map((group) => ({
      type: group.facilityType,
      purchaseCount: group._count._all,
      avgLevel: Number(group._avg.level ?? 0),
    }))
    .sort((a, b) => b.purchaseCount - a.purchaseCount);
}

export async function getSystemStats(userFilter: Prisma.UserWhereInput = {}) {
  const [tierCounts, totalRobots, readyRobots] = await Promise.all([
    getLeague1v1TierCounts(userFilter),
    prisma.robot.count({ where: { user: userFilter } }),
    prisma.robot.count({
      where: {
        currentHP: { gte: prisma.robot.fields.maxHP },
        mainWeaponId: { not: null },
        user: userFilter,
      },
    }),
  ]);

  // Scheduled matches by type (parallel queries)
  const [
    leagueMatchesScheduled,
    leagueMatchesCompleted,
    tournamentMatchesScheduled,
    tournamentMatchesCompleted,
    tagTeamMatchesScheduled,
    tagTeamMatchesCompleted,
    kothMatchesScheduled,
    kothMatchesCompleted,
  ] = await Promise.all([
    prisma.scheduledMatch.count({ where: { matchType: MatchType.league_1v1, status: 'scheduled' } }),
    prisma.scheduledMatch.count({ where: { matchType: MatchType.league_1v1, status: 'completed' } }),
    prisma.scheduledTournamentMatch.count({ where: { status: { in: ['pending', 'scheduled'] } } }),
    prisma.scheduledTournamentMatch.count({ where: { status: 'completed' } }),
    prisma.scheduledMatch.count({ where: { matchType: MatchType.tag_team, status: 'scheduled' } }),
    prisma.scheduledMatch.count({ where: { matchType: MatchType.tag_team, status: 'completed' } }),
    prisma.scheduledMatch.count({ where: { matchType: MatchType.koth, status: 'scheduled' } }),
    prisma.scheduledMatch.count({ where: { matchType: MatchType.koth, status: 'completed' } }),
  ]);

  // Total scheduled/completed across all types
  const scheduledMatches =
    leagueMatchesScheduled + tournamentMatchesScheduled + tagTeamMatchesScheduled + kothMatchesScheduled;
  const completedMatches =
    leagueMatchesCompleted + tournamentMatchesCompleted + tagTeamMatchesCompleted + kothMatchesCompleted;

  // Battle statistics — use SQL aggregations instead of loading all battles into memory
  interface BattleTypeStats {
    battle_type: string;
    total: bigint;
    draws: bigint;
    avg_duration: number;
    kills: bigint;
  }

  // Draw and kill definitions match the dashboard's battle activity
  // (adminBattleActivityService): team battles record their result in
  // `winning_side`, so `winner_id IS NULL` alone is not a draw; a kill is a
  // participant marked `destroyed`.
  const [recentBattles, totalBattles, battleTypeStats] = await Promise.all([
    prisma.battle.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.battle.count(),
    prisma.$queryRaw<BattleTypeStats[]>`
      SELECT
        b."battle_type",
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE b."winner_id" IS NULL AND b."winning_side" IS NULL)::bigint AS draws,
        COALESCE(AVG(b."duration_seconds"), 0) AS avg_duration,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM "battle_participants" bp
            WHERE bp."battle_id" = b.id AND bp."destroyed" IS TRUE
          )
        )::bigint AS kills
      FROM "battles" b
      GROUP BY b."battle_type"
    `,
  ]);

  const typeStatsMap = new Map(battleTypeStats.map(s => [s.battle_type, s]));

  const drawCount = battleTypeStats.reduce((sum, s) => sum + Number(s.draws), 0);
  const drawPercentage = totalBattles > 0 ? (drawCount / totalBattles) * 100 : 0;
  const avgDuration = totalBattles > 0
    ? battleTypeStats.reduce((sum, s) => sum + Number(s.avg_duration) * Number(s.total), 0) / totalBattles
    : 0;
  const killCount = battleTypeStats.reduce((sum, s) => sum + Number(s.kills), 0);

  function computeTypeStats(battleType: string) {
    const stats = typeStatsMap.get(battleType);
    if (!stats) return { total: 0, draws: 0, drawPercentage: 0, kills: 0, killPercentage: 0, avgDuration: 0 };
    const total = Number(stats.total);
    const draws = Number(stats.draws);
    const kills = Number(stats.kills);
    return {
      total,
      draws,
      drawPercentage: total > 0 ? Math.round((draws / total) * 1000) / 10 : 0,
      kills,
      killPercentage: total > 0 ? Math.round((kills / total) * 1000) / 10 : 0,
      avgDuration: Math.round(Number(stats.avg_duration) * 10) / 10,
    };
  }

  const battlesByType = {
    league: computeTypeStats('league_1v1'),
    tournament: computeTypeStats('tournament_1v1'),
    tagTeam: computeTypeStats('tag_team'),
    koth: computeTypeStats('koth'),
  };

  // Financial and facility statistics, aggregated in the database rather than
  // by loading every user (generated stables alone run into the thousands).
  const [balance, bankruptcyRisk, facilitySummary, weapons, stances, loadouts, yieldThresholds] = await Promise.all([
    prisma.user.aggregate({ where: userFilter, _sum: { currency: true }, _count: { _all: true } }),
    prisma.user.count({ where: { AND: [userFilter, { currency: { lt: BANKRUPTCY_RISK_THRESHOLD } }] } }),
    getFacilityOwnership(userFilter),
    getWeaponStats(userFilter),
    getStanceStats(userFilter),
    getLoadoutStats(userFilter),
    getYieldThresholdStats(userFilter),
  ]);
  const totalUsers = balance._count._all;
  const totalCredits = Number(balance._sum.currency ?? 0);
  const avgBalance = totalUsers > 0 ? totalCredits / totalUsers : 0;

  return {
    robots: {
      total: totalRobots,
      byTier: tierCounts.map((tier) => ({
        league: tier.tier,
        count: tier.count,
        averageElo: tier.avgElo,
      })),
      battleReady: readyRobots,
      // One decimal; the dashboard shows it as e.g. "86.1%".
      battleReadyPercentage: totalRobots > 0 ? Math.round((readyRobots / totalRobots) * 1000) / 10 : 0,
    },
    matches: {
      scheduled: scheduledMatches,
      completed: completedMatches,
      byType: {
        league: { scheduled: leagueMatchesScheduled, completed: leagueMatchesCompleted },
        tournament: { scheduled: tournamentMatchesScheduled, completed: tournamentMatchesCompleted },
        tagTeam: { scheduled: tagTeamMatchesScheduled, completed: tagTeamMatchesCompleted },
        koth: { scheduled: kothMatchesScheduled, completed: kothMatchesCompleted },
      },
    },
    battles: {
      last24Hours: recentBattles,
      total: totalBattles,
      draws: drawCount,
      drawPercentage: Math.round(drawPercentage * 10) / 10,
      avgDuration: Math.round(avgDuration * 10) / 10,
      kills: killCount,
      killPercentage: totalBattles > 0 ? Math.round((killCount / totalBattles) * 1000) / 10 : 0,
      byType: battlesByType,
    },
    finances: {
      totalCredits,
      avgBalance: Math.round(avgBalance),
      usersAtRisk: bankruptcyRisk,
      totalUsers,
    },
    facilities: {
      // `purchaseCount` is the number of stables owning the facility (level ≥ 1).
      summary: facilitySummary,
      totalPurchases: facilitySummary.reduce((sum, f) => sum + f.purchaseCount, 0),
      mostPopular: facilitySummary[0]?.type || 'None',
    },
    weapons,
    stances,
    loadouts,
    yieldThresholds,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get paginated repair audit log events with optional filtering.
 * Returns the exact shape that the /audit-log/repairs route handler sends as JSON.
 */
export async function getRepairAuditLog(params: {
  repairType?: string;
  startDate?: string;
  endDate?: string;
  stableName?: string;
  robotName?: string;
  page: number;
  limit: number;
}) {
  const { repairType, startDate, endDate, stableName, robotName, page, limit } = params;
  const skip = (page - 1) * limit;

  // Build where clause for audit log query
  const where: Prisma.AuditLogWhereInput = {
    eventType: 'robot_repair',
  };

  // Date range filtering
  if (startDate || endDate) {
    where.eventTimestamp = {};
    if (startDate) {
      where.eventTimestamp.gte = new Date(startDate);
    }
    if (endDate) {
      where.eventTimestamp.lte = new Date(endDate);
    }
  }

  // For repairType filtering, we need to filter on the JSON payload field.
  if (repairType) {
    where.payload = {
      path: ['repairType'],
      equals: repairType,
    };
  }

  // Filter by stable name (case-insensitive partial match)
  if (stableName) {
    const matchingUsers = await prisma.user.findMany({
      where: {
        OR: [
          { stableName: { contains: stableName, mode: 'insensitive' } },
          { username: { contains: stableName, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    where.userId = { in: matchingUsers.map(u => u.id) };
  }

  // Filter by robot name (case-insensitive partial match)
  if (robotName) {
    const matchingRobots = await prisma.robot.findMany({
      where: {
        name: { contains: robotName, mode: 'insensitive' },
      },
      select: { id: true },
    });
    where.robotId = { in: matchingRobots.map(r => r.id) };
  }

  // Get total count for pagination
  const totalEvents = await prisma.auditLog.count({ where });

  // Fetch paginated audit log events
  const auditEvents = await prisma.auditLog.findMany({
    where,
    skip,
    take: limit,
    orderBy: { eventTimestamp: 'desc' },
    select: {
      userId: true,
      robotId: true,
      payload: true,
      eventTimestamp: true,
    },
  });

  // Collect unique user and robot IDs for batch lookup
  const userIds = [...new Set(auditEvents.map(e => e.userId).filter((id): id is number => id !== null))];
  const robotIds = [...new Set(auditEvents.map(e => e.robotId).filter((id): id is number => id !== null))];

  // Batch fetch users and robots
  const [users, robots] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, stableName: true, username: true },
    }),
    prisma.robot.findMany({
      where: { id: { in: robotIds } },
      select: { id: true, name: true },
    }),
  ]);

  const userMap = new Map(users.map(u => [u.id, u.stableName || u.username]));
  const robotMap = new Map(robots.map(r => [r.id, r.name]));

  // Map events to response shape
  const events = auditEvents.map(event => {
    const payload = event.payload as Record<string, unknown>;
    return {
      userId: event.userId || 0,
      stableName: userMap.get(event.userId || 0) || 'Unknown',
      robotId: event.robotId || 0,
      robotName: robotMap.get(event.robotId || 0) || 'Unknown',
      repairType: (payload.repairType as 'manual' | 'automatic') || 'automatic',
      // Spec #48 Requirement 17 criteria 4, 10 and 13: read through the resolvers
      // so a row written before the key rename still reports its true amounts, and
      // rename the response fields to say what they mean. `RepairLogPage.tsx` moves
      // in the same change and renders the same columns and values as before.
      creditsCharged: readRepairChargedCredits(payload) ?? 0,
      creditsBeforeManualDiscount: readRepairPreDiscountCredits(payload),
      manualRepairDiscount: (payload.manualRepairDiscount as number) ?? null,
      eventTimestamp: event.eventTimestamp.toISOString(),
    };
  });

  // Calculate summary stats from ALL matching events (not just current page)
  const allEvents = await prisma.auditLog.findMany({
    where,
    select: {
      payload: true,
    },
  });

  let totalManualRepairs = 0;
  let totalAutomaticRepairs = 0;
  let totalSavings = 0;

  for (const event of allEvents) {
    const payload = event.payload as Record<string, unknown>;
    const eventRepairType = (payload.repairType as string) || 'automatic';
    if (eventRepairType === 'manual') {
      totalManualRepairs++;
      const preDiscount = readRepairPreDiscountCredits(payload);
      const charged = readRepairChargedCredits(payload);
      if (preDiscount !== null && charged !== null) {
        totalSavings += preDiscount - charged;
      }
    } else {
      totalAutomaticRepairs++;
    }
  }

  const totalPages = Math.ceil(totalEvents / limit);

  return {
    events,
    summary: {
      totalManualRepairs,
      totalAutomaticRepairs,
      totalSavings,
    },
    pagination: {
      page,
      limit,
      totalEvents,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}
