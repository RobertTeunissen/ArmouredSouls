import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { buildUserFilter } from '../../utils/buildUserFilter';

const BANKRUPTCY_RISK_THRESHOLD = 10000; // Credits below which a user is considered at risk

// Helper function to get weapon statistics
export async function getWeaponStats(userFilter: Prisma.UserWhereInput = {}) {
  const totalBought = await prisma.weaponInventory.count({
    where: {
      user: userFilter,
    },
  });
  const equippedWeapons = await prisma.robot.count({
    where: {
      NOT: { name: 'Bye Robot' },
      mainWeaponId: { not: null },
      user: userFilter,
    },
  });
  
  return {
    totalBought,
    equipped: equippedWeapons,
  };
}

// Helper function to get stance statistics
export async function getStanceStats(userFilter: Prisma.UserWhereInput = {}) {
  const stances = await prisma.robot.groupBy({
    by: ['stance'],
    where: {
      NOT: { name: 'Bye Robot' },
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
      NOT: { name: 'Bye Robot' },
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
      NOT: { name: 'Bye Robot' },
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
export async function getSystemStats(userFilter: Prisma.UserWhereInput = {}) {
  // Total robots by tier
  const robotsByTier = await prisma.robot.groupBy({
    by: ['currentLeague'],
    where: { NOT: { name: 'Bye Robot' }, user: userFilter },
    _count: { id: true },
    _avg: { elo: true },
  });

  // Battle readiness
  const totalRobots = await prisma.robot.count({
    where: { NOT: { name: 'Bye Robot' }, user: userFilter },
  });

  const readyRobots = await prisma.robot.count({
    where: {
      NOT: { name: 'Bye Robot' },
      currentHP: { gte: prisma.robot.fields.maxHP },
      mainWeaponId: { not: null },
      user: userFilter,
    },
  });

  // Scheduled matches by type
  const leagueMatchesScheduled = await prisma.scheduledLeagueMatch.count({
    where: { status: 'scheduled' },
  });
  const leagueMatchesCompleted = await prisma.scheduledLeagueMatch.count({
    where: { status: 'completed' },
  });

  const tournamentMatchesScheduled = await prisma.scheduledTournamentMatch.count({
    where: { status: { in: ['pending', 'scheduled'] } },
  });
  const tournamentMatchesCompleted = await prisma.scheduledTournamentMatch.count({
    where: { status: 'completed' },
  });

  const tagTeamMatchesScheduled = await prisma.scheduledTagTeamMatch.count({
    where: { status: 'scheduled' },
  });
  const tagTeamMatchesCompleted = await prisma.scheduledTagTeamMatch.count({
    where: { status: 'completed' },
  });

  const kothMatchesScheduled = await prisma.scheduledKothMatch.count({
    where: { status: 'scheduled' },
  });
  const kothMatchesCompleted = await prisma.scheduledKothMatch.count({
    where: { status: 'completed' },
  });

  // Total scheduled/completed across all types
  const scheduledMatches =
    leagueMatchesScheduled + tournamentMatchesScheduled + tagTeamMatchesScheduled + kothMatchesScheduled;
  const completedMatches =
    leagueMatchesCompleted + tournamentMatchesCompleted + tagTeamMatchesCompleted + kothMatchesCompleted;

  // Recent battles (last 24 hours)
  const recentBattles = await prisma.battle.count({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  // Total battles
  const totalBattles = await prisma.battle.count();

  // Battle statistics — draw count and duration
  const battles = await prisma.battle.findMany({
    select: {
      winnerId: true,
      robot1Id: true,
      robot2Id: true,
      durationSeconds: true,
      battleType: true,
      participants: true,
    },
  });

  const drawCount = battles.filter(b => b.winnerId === null).length;
  const drawPercentage = totalBattles > 0 ? (drawCount / totalBattles) * 100 : 0;
  const avgDuration =
    battles.length > 0
      ? battles.reduce((sum, b) => sum + b.durationSeconds, 0) / battles.length
      : 0;

  // Kill outcomes (loser has 0 HP, excluding draws)
  const killCount = battles.filter(b => {
    if (!b.winnerId) return false;
    const loserParticipant = b.participants.find(p => p.robotId !== b.winnerId);
    return loserParticipant?.finalHP === 0;
  }).length;

  // Per-type battle stats
  function computeTypeStats(typeBattles: typeof battles) {
    const total = typeBattles.length;
    const draws = typeBattles.filter(b => b.winnerId === null).length;
    const kills = typeBattles.filter(b => {
      if (!b.winnerId) return false;
      const loser = b.participants.find(p => p.robotId !== b.winnerId);
      return loser?.finalHP === 0;
    }).length;
    const avgDur = total > 0
      ? typeBattles.reduce((sum, b) => sum + b.durationSeconds, 0) / total
      : 0;
    return {
      total,
      draws,
      drawPercentage: total > 0 ? Math.round((draws / total) * 1000) / 10 : 0,
      kills,
      killPercentage: total > 0 ? Math.round((kills / total) * 1000) / 10 : 0,
      avgDuration: Math.round(avgDur * 10) / 10,
    };
  }

  const battlesByType = {
    league: computeTypeStats(battles.filter(b => b.battleType === 'league')),
    tournament: computeTypeStats(battles.filter(b => b.battleType === 'tournament')),
    tagTeam: computeTypeStats(battles.filter(b => b.battleType === 'tag_team')),
    koth: computeTypeStats(battles.filter(b => b.battleType === 'koth')),
  };

  // Financial statistics
  const users = await prisma.user.findMany({
    where: userFilter,
    select: {
      currency: true,
      facilities: { select: { facilityType: true, level: true } },
    },
  });

  const totalCredits = users.reduce((sum, u) => sum + u.currency, 0);
  const avgBalance = users.length > 0 ? totalCredits / users.length : 0;
  const bankruptcyRisk = users.filter(u => u.currency < BANKRUPTCY_RISK_THRESHOLD).length;

  // Facility statistics
  const facilityStats: Record<string, { count: number; totalLevel: number }> = {};
  users.forEach(user => {
    user.facilities.forEach(facility => {
      if (facility.level > 0) {
        if (!facilityStats[facility.facilityType]) {
          facilityStats[facility.facilityType] = { count: 0, totalLevel: 0 };
        }
        facilityStats[facility.facilityType].count++;
        facilityStats[facility.facilityType].totalLevel += facility.level;
      }
    });
  });

  const facilitySummary = Object.entries(facilityStats)
    .map(([type, stats]) => ({
      type,
      purchaseCount: stats.count,
      avgLevel: stats.count > 0 ? stats.totalLevel / stats.count : 0,
    }))
    .sort((a, b) => b.purchaseCount - a.purchaseCount);

  return {
    robots: {
      total: totalRobots,
      byTier: robotsByTier.map(tier => ({
        league: tier.currentLeague,
        count: tier._count.id,
        averageElo: Math.round(tier._avg.elo || 0),
      })),
      battleReady: readyRobots,
      battleReadyPercentage: totalRobots > 0 ? Math.round((readyRobots / totalRobots) * 100) : 0,
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
      totalUsers: users.length,
    },
    facilities: {
      summary: facilitySummary,
      totalPurchases: facilitySummary.reduce((sum, f) => sum + f.purchaseCount, 0),
      mostPopular: facilitySummary[0]?.type || 'None',
    },
    weapons: await getWeaponStats(userFilter),
    stances: await getStanceStats(userFilter),
    loadouts: await getLoadoutStats(userFilter),
    yieldThresholds: await getYieldThresholdStats(userFilter),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get users at risk of bankruptcy with financial history.
 * Returns the exact shape that the /users/at-risk route handler sends as JSON.
 */
export async function getAtRiskUsers(bankruptcyThreshold: number = BANKRUPTCY_RISK_THRESHOLD) {
  // Get current cycle number
  const cycleMetadata = await prisma.cycleMetadata.findUnique({
    where: { id: 1 },
  });
  const currentCycle = cycleMetadata?.totalCycles || 0;

  // Get users below bankruptcy threshold
  const atRiskUsers = await prisma.user.findMany({
    where: { currency: { lt: bankruptcyThreshold } },
    select: {
      id: true,
      username: true,
      stableName: true,
      currency: true,
      createdAt: true,
      robots: {
        select: {
          id: true,
          name: true,
          currentHP: true,
          maxHP: true,
          repairCost: true,
          battleReadiness: true,
        },
      },
    },
    orderBy: { currency: 'asc' },
  });

  // For each user, get their financial history from audit logs
  const usersWithHistory = await Promise.all(
    atRiskUsers.map(async (user) => {
      const financialEvents = await prisma.auditLog.findMany({
        where: {
          userId: user.id,
          eventType: {
            in: ['credit_change', 'operating_costs', 'passive_income', 'robot_repair'],
          },
          cycleNumber: { gte: Math.max(1, currentCycle - 30) },
        },
        select: {
          cycleNumber: true,
          eventTimestamp: true,
          eventType: true,
          payload: true,
          sequenceNumber: true,
        },
        orderBy: [{ cycleNumber: 'desc' }, { sequenceNumber: 'desc' }],
      });

      // Calculate balance for each cycle by working backwards from current balance
      const cycleMap = new Map<number, { costs: number; income: number; repairs: number }>();

      for (const event of financialEvents) {
        const cycle = event.cycleNumber;
        if (!cycleMap.has(cycle)) {
          cycleMap.set(cycle, { costs: 0, income: 0, repairs: 0 });
        }

        const cycleData = cycleMap.get(cycle)!;

        if (event.eventType === 'operating_costs') {
          cycleData.costs += (event.payload as Record<string, number>)?.totalCost || 0;
        } else if (event.eventType === 'passive_income') {
          cycleData.income += (event.payload as Record<string, number>)?.totalIncome || 0;
        } else if (event.eventType === 'robot_repair') {
          cycleData.repairs += (event.payload as Record<string, number>)?.cost || 0;
        } else if (event.eventType === 'credit_change') {
          const amount = (event.payload as Record<string, number>)?.amount || 0;
          if (amount > 0) {
            cycleData.income += amount;
          } else {
            cycleData.costs += Math.abs(amount);
          }
        }
      }

      // Build balance history by working backwards from current balance
      const cycles = Array.from(cycleMap.keys()).sort((a, b) => b - a);
      const balanceHistory: Array<{
        cycle: number;
        timestamp: Date;
        balance: number;
        dailyCost: number;
        dailyIncome: number;
      }> = [];

      let runningBalance = user.currency;

      for (const cycle of cycles) {
        const data = cycleMap.get(cycle)!;
        const totalCosts = data.costs + data.repairs;
        const netChange = data.income - totalCosts;

        balanceHistory.push({
          cycle,
          timestamp: financialEvents.find(e => e.cycleNumber === cycle)?.eventTimestamp || new Date(),
          balance: runningBalance,
          dailyCost: totalCosts,
          dailyIncome: data.income,
        });

        runningBalance -= netChange;
      }

      balanceHistory.sort((a, b) => b.cycle - a.cycle);
      const recentHistory = balanceHistory.slice(0, 10);

      // Determine when they first went below threshold
      let cyclesAtRisk = 0;
      let firstAtRiskCycle: number | null = null;

      for (let i = 0; i < balanceHistory.length; i++) {
        if (balanceHistory[i].balance < bankruptcyThreshold) {
          cyclesAtRisk++;
          firstAtRiskCycle = balanceHistory[i].cycle;
        } else {
          break;
        }
      }

      const totalRepairCost = user.robots.reduce((sum, robot) => sum + robot.repairCost, 0);

      const avgDailyCost =
        recentHistory.length > 0
          ? recentHistory.reduce((sum, h) => sum + h.dailyCost, 0) / recentHistory.length
          : 0;
      const daysOfRunway = avgDailyCost > 0 ? Math.floor(user.currency / avgDailyCost) : 999;

      return {
        userId: user.id,
        username: user.username,
        stableName: user.stableName || user.username,
        currentBalance: user.currency,
        totalRepairCost,
        netBalance: user.currency - totalRepairCost,
        cyclesAtRisk,
        firstAtRiskCycle,
        daysOfRunway,
        robotCount: user.robots.length,
        damagedRobots: user.robots.filter(r => r.battleReadiness < 100).length,
        balanceHistory: recentHistory,
        createdAt: user.createdAt,
      };
    })
  );

  return {
    threshold: bankruptcyThreshold,
    currentCycle,
    totalAtRisk: usersWithHistory.length,
    users: usersWithHistory,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get comprehensive statistics about robot attributes for debugging and outlier detection.
 * Returns the exact shape that the /stats/robots route handler sends as JSON.
 */
export async function getRobotAttributeStats() {
  const robots = await prisma.robot.findMany({
    where: { NOT: { name: 'Bye Robot' } },
    select: {
      id: true,
      name: true,
      userId: true,
      currentLeague: true,
      elo: true,
      totalBattles: true,
      wins: true,
      losses: true,
      draws: true,
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

  if (robots.length === 0) {
    return {
      message: 'No robots found',
      totalRobots: 0,
      timestamp: new Date().toISOString(),
    };
  }

  type RobotAttribute = 'combatPower' | 'targetingSystems' | 'criticalSystems' | 'penetration' | 'weaponControl' | 'attackSpeed'
    | 'armorPlating' | 'shieldCapacity' | 'evasionThrusters' | 'damageDampeners' | 'counterProtocols'
    | 'hullIntegrity' | 'servoMotors' | 'gyroStabilizers' | 'hydraulicSystems' | 'powerCore'
    | 'combatAlgorithms' | 'threatAnalysis' | 'adaptiveAI' | 'logicCores'
    | 'syncProtocols' | 'supportSystems' | 'formationTactics';

  const attributes: RobotAttribute[] = [
    'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
    'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
    'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
    'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
    'syncProtocols', 'supportSystems', 'formationTactics',
  ];

  // Calculate statistics for each attribute
  const attributeStats: Record<string, ReturnType<typeof calculateStats>> = {};
  const outliers: Record<string, Array<{ id: number; name: string; value: number; league: string; elo: number; winRate: number }>> = {};

  for (const attr of attributes) {
    const values = robots.map(r => Number(r[attr]));
    const stats = calculateStats(values);

    if (stats) {
      attributeStats[attr] = stats;

      const robotsWithOutliers = robots
        .map(r => ({
          id: r.id,
          name: r.name,
          value: Number(r[attr]),
          league: r.currentLeague,
          elo: r.elo,
          winRate: r.totalBattles > 0 ? Number((r.wins / r.totalBattles * 100).toFixed(1)) : 0,
        }))
        .filter(r => r.value < stats.lowerBound || r.value > stats.upperBound)
        .sort((a, b) => Math.abs(b.value - stats.mean) - Math.abs(a.value - stats.mean))
        .slice(0, 10);

      if (robotsWithOutliers.length > 0) {
        outliers[attr] = robotsWithOutliers;
      }
    }
  }

  // Statistics by league tier
  const leagues = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
  const statsByLeague: Record<string, { count: number; averageElo: number; attributes: Record<string, { mean: number; median: number; min: number; max: number }> }> = {};

  for (const league of leagues) {
    const leagueRobots = robots.filter(r => r.currentLeague === league);
    if (leagueRobots.length === 0) continue;

    statsByLeague[league] = {
      count: leagueRobots.length,
      averageElo: Number((leagueRobots.reduce((sum, r) => sum + r.elo, 0) / leagueRobots.length).toFixed(0)),
      attributes: {},
    };

    for (const attr of attributes) {
      const values = leagueRobots.map(r => Number(r[attr]));
      const stats = calculateStats(values);
      if (stats) {
        statsByLeague[league].attributes[attr] = {
          mean: stats.mean,
          median: stats.median,
          min: stats.min,
          max: stats.max,
        };
      }
    }
  }

  // Win rate correlations by quintile
  const winRateAnalysis: Record<string, Array<{ quintile: number; avgValue: number; avgWinRate: number; sampleSize: number }>> = {};

  for (const attr of attributes) {
    const robotsWithWinRate = robots
      .filter(r => r.totalBattles >= 5)
      .map(r => ({
        value: Number(r[attr]),
        winRate: r.wins / r.totalBattles,
      }));

    if (robotsWithWinRate.length === 0) continue;

    robotsWithWinRate.sort((a, b) => a.value - b.value);
    const quintileSize = Math.floor(robotsWithWinRate.length / 5);

    const quintiles = [];
    for (let i = 0; i < 5; i++) {
      const start = i * quintileSize;
      const end = i === 4 ? robotsWithWinRate.length : (i + 1) * quintileSize;
      const quintileRobots = robotsWithWinRate.slice(start, end);

      if (quintileRobots.length > 0) {
        const avgValue = quintileRobots.reduce((sum, r) => sum + r.value, 0) / quintileRobots.length;
        const avgWinRate = quintileRobots.reduce((sum, r) => sum + r.winRate, 0) / quintileRobots.length;

        quintiles.push({
          quintile: i + 1,
          avgValue: Number(avgValue.toFixed(2)),
          avgWinRate: Number((avgWinRate * 100).toFixed(1)),
          sampleSize: quintileRobots.length,
        });
      }
    }

    winRateAnalysis[attr] = quintiles;
  }

  // Top and bottom performers
  type PerformerEntry = { id: number; name: string; value: number; league: string; elo: number; winRate: number };
  const topPerformers: Record<string, PerformerEntry[]> = {};
  const bottomPerformers: Record<string, PerformerEntry[]> = {};

  for (const attr of attributes) {
    const sorted = [...robots].sort((a, b) => Number(b[attr]) - Number(a[attr]));

    topPerformers[attr] = sorted.slice(0, 5).map(r => ({
      id: r.id,
      name: r.name,
      value: Number(r[attr]),
      league: r.currentLeague,
      elo: r.elo,
      winRate: r.totalBattles > 0 ? Number((r.wins / r.totalBattles * 100).toFixed(1)) : 0,
    }));

    bottomPerformers[attr] = sorted.slice(-5).reverse().map(r => ({
      id: r.id,
      name: r.name,
      value: Number(r[attr]),
      league: r.currentLeague,
      elo: r.elo,
      winRate: r.totalBattles > 0 ? Number((r.wins / r.totalBattles * 100).toFixed(1)) : 0,
    }));
  }

  // Overall summary
  const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0);
  const robotsWithBattles = robots.filter(r => r.totalBattles > 0);
  const overallWinRate = totalBattles > 0
    ? robots.reduce((sum, r) => sum + r.wins, 0) / totalBattles * 100
    : 0;

  return {
    summary: {
      totalRobots: robots.length,
      robotsWithBattles: robotsWithBattles.length,
      totalBattles,
      overallWinRate: Number(overallWinRate.toFixed(2)),
      averageElo: Number((robots.reduce((sum, r) => sum + r.elo, 0) / robots.length).toFixed(0)),
    },
    attributeStats,
    outliers,
    statsByLeague,
    winRateAnalysis,
    topPerformers,
    bottomPerformers,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get recent real (non-auto-generated) user activity across cycles.
 * Returns the exact shape that the /users/recent route handler sends as JSON.
 */
export async function getRecentUserActivity(cyclesBack: number, filter: string = 'real') {
  // Get current cycle number
  const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  const currentCycle = cycleMetadata?.totalCycles || 0;

  // Get the timestamp of the cycle we're looking back to (from cycle snapshots)
  let cutoffDate: Date | null = null;
  const targetCycle = Math.max(0, currentCycle - cyclesBack);
  if (targetCycle > 0) {
    const snapshot = await prisma.cycleSnapshot.findUnique({
      where: { cycleNumber: targetCycle },
      select: { createdAt: true },
    });
    cutoffDate = snapshot?.createdAt || null;
  }

  // If no snapshot found, fall back to cycle metadata lastCycleAt minus rough estimate
  if (!cutoffDate && cycleMetadata?.lastCycleAt) {
    cutoffDate = new Date(Date.now() - cyclesBack * 24 * 60 * 60 * 1000);
  }

  // Apply user filter (real/auto/all)
  const userFilter = buildUserFilter(filter as 'all' | 'real' | 'auto');
  const recentUsers = await prisma.user.findMany({
    where: {
      ...userFilter,
      ...(cutoffDate ? { createdAt: { gte: cutoffDate } } : {}),
    },
    select: {
      id: true,
      username: true,
      stableName: true,
      currency: true,
      role: true,
      hasCompletedOnboarding: true,
      onboardingSkipped: true,
      onboardingStep: true,
      onboardingStrategy: true,
      lastLoginAt: true,
      createdAt: true,
      robots: {
        select: {
          id: true,
          name: true,
          currentHP: true,
          maxHP: true,
          elo: true,
          currentLeague: true,
          totalBattles: true,
          wins: true,
          losses: true,
          draws: true,
          battleReadiness: true,
          mainWeaponId: true,
          offhandWeaponId: true,
          loadoutType: true,
          stance: true,
          createdAt: true,
        },
      },
      facilities: {
        where: { level: { gt: 0 } },
        select: {
          facilityType: true,
          level: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Enrich each user with activity indicators
  const usersWithActivity = recentUsers.map((user) => {
    const robots = user.robots;
    const totalRobots = robots.length;
    const battleReadyRobots = robots.filter(
      (r) => r.battleReadiness >= 80 && r.mainWeaponId !== null
    ).length;
    const robotsWithBattles = robots.filter((r) => r.totalBattles > 0).length;
    const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0);
    const totalWins = robots.reduce((sum, r) => sum + r.wins, 0);

    // Determine user status / potential issues
    const issues: string[] = [];
    if (!user.hasCompletedOnboarding && !user.onboardingSkipped) {
      issues.push(`Stuck in onboarding (step ${user.onboardingStep})`);
    }
    if (totalRobots === 0) {
      issues.push('No robots created');
    }
    if (totalRobots > 0 && battleReadyRobots === 0) {
      issues.push('No battle-ready robots');
    }
    if (totalRobots > 0 && robots.every((r) => r.mainWeaponId === null)) {
      issues.push('No weapons equipped');
    }
    if (totalRobots > 0 && robotsWithBattles === 0 && user.hasCompletedOnboarding) {
      issues.push('Completed onboarding but no battles yet');
    }
    if (user.currency < 10000 && totalRobots > 0) {
      issues.push('Low balance');
    }

    return {
      userId: user.id,
      username: user.username,
      stableName: user.stableName,
      currency: user.currency,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      churnRisk: classifyChurnRisk(user),
      onboarding: {
        completed: user.hasCompletedOnboarding,
        skipped: user.onboardingSkipped,
        currentStep: user.onboardingStep,
        strategy: user.onboardingStrategy,
      },
      robots: robots.map((r) => ({
        id: r.id,
        name: r.name,
        currentHP: r.currentHP,
        maxHP: r.maxHP,
        hpPercent: r.maxHP > 0 ? Math.round((r.currentHP / r.maxHP) * 100) : 0,
        elo: r.elo,
        league: r.currentLeague,
        totalBattles: r.totalBattles,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        winRate: r.totalBattles > 0 ? Math.round((r.wins / r.totalBattles) * 100) : 0,
        battleReady: r.battleReadiness >= 80 && r.mainWeaponId !== null,
        hasWeapon: r.mainWeaponId !== null,
        loadout: r.loadoutType,
        stance: r.stance,
        createdAt: r.createdAt,
      })),
      summary: {
        totalRobots,
        battleReadyRobots,
        robotsWithBattles,
        totalBattles,
        totalWins,
        winRate: totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0,
        facilitiesPurchased: user.facilities.length,
      },
      issues,
    };
  });

  return {
    currentCycle,
    cyclesBack,
    cutoffDate: cutoffDate?.toISOString() || null,
    totalUsers: usersWithActivity.length,
    usersWithIssues: usersWithActivity.filter((u) => u.issues.length > 0).length,
    users: usersWithActivity,
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
  page: number;
  limit: number;
}) {
  const { repairType, startDate, endDate, page, limit } = params;
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
      cost: (payload.cost as number) || 0,
      preDiscountCost: (payload.preDiscountCost as number) ?? null,
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
      const preDiscount = payload.preDiscountCost as number | undefined;
      const cost = payload.cost as number | undefined;
      if (preDiscount != null && cost != null) {
        totalSavings += preDiscount - cost;
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


// ---------------------------------------------------------------------------
// New analytics service functions for admin portal redesign (Spec #28)
// ---------------------------------------------------------------------------

/**
 * Get high-level KPI metrics for the admin dashboard.
 */
export async function getDashboardKpis(userFilter: Prisma.UserWhereInput = {}) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersLast7d,
    totalRobots,
    battlesLast24h,
    totalBattles,
    activeUsersLast7d,
    cycleMetadata,
  ] = await Promise.all([
    prisma.user.count({ where: userFilter }),
    prisma.user.count({ where: { ...userFilter, createdAt: { gte: sevenDaysAgo } } }),
    prisma.robot.count({ where: { NOT: { name: 'Bye Robot' }, user: userFilter } }),
    prisma.battle.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.battle.count(),
    prisma.user.count({
      where: {
        ...userFilter,
        robots: { some: { updatedAt: { gte: sevenDaysAgo } } },
      },
    }),
    prisma.cycleMetadata.findUnique({ where: { id: 1 } }),
  ]);

  return {
    totalUsers,
    newUsersLast7d,
    totalRobots,
    battlesLast24h,
    totalBattles,
    activeUsersLast7d,
    currentCycle: cycleMetadata?.totalCycles ?? 0,
    lastCycleAt: cycleMetadata?.lastCycleAt?.toISOString() ?? null,
    timestamp: now.toISOString(),
  };
}

/**
 * Classify a user's churn risk based on activity signals.
 */
export function classifyChurnRisk(user: {
  lastLoginAt: Date | null;
  createdAt: Date;
  robots: { totalBattles: number }[];
}): 'low' | 'medium' | 'high' {
  const now = Date.now();
  const lastActive = user.lastLoginAt?.getTime() ?? user.createdAt.getTime();
  const daysSinceActive = (now - lastActive) / (1000 * 60 * 60 * 24);
  const totalBattles = user.robots.reduce((sum, r) => sum + r.totalBattles, 0);

  if (daysSinceActive > 14 || (totalBattles === 0 && daysSinceActive > 3)) return 'high';
  if (daysSinceActive > 7 || totalBattles < 5) return 'medium';
  return 'low';
}

/**
 * Get player engagement data with churn risk classification.
 */
export async function getEngagementPlayers(
  userFilter: Prisma.UserWhereInput = {},
  page = 1,
  limit = 50,
) {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: userFilter,
      select: {
        id: true,
        username: true,
        stableName: true,
        currency: true,
        lastLoginAt: true,
        createdAt: true,
        hasCompletedOnboarding: true,
        robots: {
          select: {
            totalBattles: true,
            wins: true,
            currentLeague: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where: userFilter }),
  ]);

  const players = users.map((u) => {
    const totalBattles = u.robots.reduce((sum, r) => sum + r.totalBattles, 0);
    const totalWins = u.robots.reduce((sum, r) => sum + r.wins, 0);
    return {
      userId: u.id,
      username: u.username,
      stableName: u.stableName,
      currency: u.currency,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      onboardingComplete: u.hasCompletedOnboarding,
      robotCount: u.robots.length,
      totalBattles,
      totalWins,
      winRate: totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0,
      churnRisk: classifyChurnRisk(u),
    };
  });

  return {
    players,
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get economy overview metrics.
 */
export async function getEconomyOverview(userFilter: Prisma.UserWhereInput = {}) {
  const users = await prisma.user.findMany({
    where: userFilter,
    select: {
      currency: true,
      facilities: { select: { facilityType: true, level: true } },
    },
  });

  const balances = users.map((u) => u.currency);
  const totalCredits = balances.reduce((sum, b) => sum + b, 0);
  const avgBalance = users.length > 0 ? Math.round(totalCredits / users.length) : 0;
  const medianBalance = balances.length > 0
    ? [...balances].sort((a, b) => a - b)[Math.floor(balances.length / 2)]
    : 0;
  const bankruptcyRisk = users.filter((u) => u.currency < BANKRUPTCY_RISK_THRESHOLD).length;

  // Facility adoption — aggregate stats + per-level breakdown
  const facilityStats: Record<string, { count: number; totalLevel: number; levels: Record<number, number> }> = {};
  users.forEach((user) => {
    user.facilities.forEach((f) => {
      if (f.level > 0) {
        if (!facilityStats[f.facilityType]) {
          facilityStats[f.facilityType] = { count: 0, totalLevel: 0, levels: {} };
        }
        facilityStats[f.facilityType].count++;
        facilityStats[f.facilityType].totalLevel += f.level;
        facilityStats[f.facilityType].levels[f.level] = (facilityStats[f.facilityType].levels[f.level] || 0) + 1;
      }
    });
  });

  const facilities = Object.entries(facilityStats)
    .map(([type, stats]) => ({
      type,
      owners: stats.count,
      avgLevel: stats.count > 0 ? Number((stats.totalLevel / stats.count).toFixed(1)) : 0,
      maxLevel: Math.max(...Object.keys(stats.levels).map(Number), 0),
      levelDistribution: Object.entries(stats.levels)
        .map(([level, count]) => ({ level: Number(level), count }))
        .sort((a, b) => a.level - b.level),
    }))
    .sort((a, b) => b.owners - a.owners);

  return {
    totalCreditsInCirculation: totalCredits,
    averageBalance: avgBalance,
    medianBalance,
    usersAtBankruptcyRisk: bankruptcyRisk,
    totalUsers: users.length,
    facilities,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get league health metrics.
 */
export async function getLeagueHealth(userFilter: Prisma.UserWhereInput = {}) {
  const leagues = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

  const robotsByLeague = await prisma.robot.groupBy({
    by: ['currentLeague'],
    where: { NOT: { name: 'Bye Robot' }, user: userFilter },
    _count: { id: true },
    _avg: { elo: true },
  });

  // Count distinct league instances per tier
  const instancesByLeague = await prisma.robot.groupBy({
    by: ['currentLeague', 'leagueId'],
    where: { NOT: { name: 'Bye Robot' }, user: userFilter },
    _count: { id: true },
  });

  const leagueData = leagues.map((league) => {
    const data = robotsByLeague.find((r) => r.currentLeague === league);
    const instances = instancesByLeague.filter((r) => r.currentLeague === league);
    return {
      league,
      robotCount: data?._count.id ?? 0,
      averageElo: Math.round(data?._avg.elo ?? 0),
      instances: instances.length,
      instanceDetails: instances.map((i) => ({
        id: i.leagueId,
        robotCount: i._count.id,
      })),
    };
  });

  const totalRobots = leagueData.reduce((sum, l) => sum + l.robotCount, 0);

  return {
    leagues: leagueData,
    totalRobots,
    timestamp: new Date().toISOString(),
  };
}

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
      robot: { user: userFilter, NOT: { name: 'Bye Robot' } },
    },
  });

  const totalRobots = await prisma.robot.count({
    where: { NOT: { name: 'Bye Robot' }, user: userFilter },
  });

  // Get tuning allocations with details
  const allocations = await prisma.tuningAllocation.findMany({
    where: {
      robot: { user: userFilter, NOT: { name: 'Bye Robot' } },
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
