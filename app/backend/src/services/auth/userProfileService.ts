/**
 * User Profile & Stats Service
 *
 * Handles profile retrieval and stable statistics aggregation.
 */

import prisma from '../../lib/prisma';
import { AuthError, AuthErrorCode } from '../../errors/authErrors';
import { getPrestigeRank } from '../../utils/prestigeUtils';
import type { StableMetric, RobotMetric } from '../../types/snapshotTypes';

const LEAGUE_HIERARCHY = [
  'bronze_4', 'bronze_3', 'bronze_2', 'bronze_1',
  'silver_4', 'silver_3', 'silver_2', 'silver_1',
  'gold_4', 'gold_3', 'gold_2', 'gold_1',
  'platinum_4', 'platinum_3', 'platinum_2', 'platinum_1',
  'diamond_4', 'diamond_3', 'diamond_2', 'diamond_1',
  'master', 'grandmaster', 'challenger',
];

export async function getUserProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      currency: true,
      prestige: true,
      createdAt: true,
      stableName: true,
      profileVisibility: true,
      notificationsBattle: true,
      notificationsLeague: true,
      themePreference: true,
    },
  });

  if (!user) {
    throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404);
  }

  return {
    ...user,
    stableName: user.stableName || user.username,
  };
}

export async function getStableStats(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { prestige: true },
  });

  if (!user) {
    throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404);
  }

  const robots = await prisma.robot.findMany({
    where: { userId },
    select: {
      id: true,
      elo: true,
      totalBattles: true,
      wins: true,
      losses: true,
      draws: true,
      totalTagTeamBattles: true,
      totalTagTeamWins: true,
      totalTagTeamLosses: true,
      totalTagTeamDraws: true,
      currentLeague: true,
      currentHP: true,
      maxHP: true,
      mainWeapon: true,
    },
  });

  const tagTeams = await prisma.tagTeam.findMany({
    where: { stableId: userId },
    select: { tagTeamLeague: true },
  });

  const cycleChanges = await computeCycleChanges(userId, robots);

  if (robots.length === 0) {
    return {
      totalBattles: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      highestELO: 0,
      highestLeague: null,
      highestTagTeamLeague: null,
      totalRobots: 0,
      prestige: user.prestige,
      prestigeRank: getPrestigeRank(user.prestige),
      cycleChanges,
    };
  }

  const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles + r.totalTagTeamBattles, 0);
  const wins = robots.reduce((sum, r) => sum + r.wins + r.totalTagTeamWins, 0);
  const losses = robots.reduce((sum, r) => sum + r.losses + r.totalTagTeamLosses, 0);
  const draws = robots.reduce((sum, r) => sum + r.draws + r.totalTagTeamDraws, 0);
  const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;
  const highestELO = Math.max(...robots.map(r => r.elo));

  const highestLeague = robots
    .map(r => r.currentLeague)
    .filter((league): league is string => league !== null)
    .sort((a, b) => LEAGUE_HIERARCHY.indexOf(b) - LEAGUE_HIERARCHY.indexOf(a))[0] || null;

  const highestTagTeamLeague = tagTeams.length > 0
    ? tagTeams
        .map(t => t.tagTeamLeague)
        .sort((a, b) => LEAGUE_HIERARCHY.indexOf(b) - LEAGUE_HIERARCHY.indexOf(a))[0]
    : null;

  return {
    totalBattles,
    wins,
    losses,
    draws,
    winRate: Math.round(winRate * 10) / 10,
    highestELO,
    highestLeague,
    highestTagTeamLeague,
    totalRobots: robots.length,
    prestige: user.prestige,
    prestigeRank: getPrestigeRank(user.prestige),
    cycleChanges,
  };
}

// ─── Internal helpers ───────────────────────────────────────────────

interface RobotSlim {
  id: number;
  elo: number;
}

async function computeCycleChanges(userId: number, robots: RobotSlim[]) {
  const latestSnapshot = await prisma.cycleSnapshot.findFirst({
    orderBy: { cycleNumber: 'desc' },
    select: { cycleNumber: true },
  });

  if (!latestSnapshot || latestSnapshot.cycleNumber <= 1) return null;

  const [currentSnapshot, previousSnapshot] = await Promise.all([
    prisma.cycleSnapshot.findUnique({
      where: { cycleNumber: latestSnapshot.cycleNumber },
      select: { stableMetrics: true, robotMetrics: true },
    }),
    prisma.cycleSnapshot.findUnique({
      where: { cycleNumber: latestSnapshot.cycleNumber - 1 },
      select: { stableMetrics: true, robotMetrics: true },
    }),
  ]);

  if (!currentSnapshot || !previousSnapshot) return null;

  const currentStableMetrics = (currentSnapshot.stableMetrics as unknown as StableMetric[]).find(
    (m: StableMetric) => m.userId === userId,
  );

  const robotIds = robots.map(r => r.id);

  const currentRobotMetrics = (currentSnapshot.robotMetrics as unknown as RobotMetric[]).filter(
    (m: RobotMetric) => robotIds.includes(m.robotId),
  );
  const previousRobotMetrics = (previousSnapshot.robotMetrics as unknown as RobotMetric[]).filter(
    (m: RobotMetric) => robotIds.includes(m.robotId),
  );

  const currentWins = currentRobotMetrics.reduce((sum: number, m: RobotMetric) => sum + (m.wins || 0), 0);
  const currentLosses = currentRobotMetrics.reduce((sum: number, m: RobotMetric) => sum + (m.losses || 0), 0);
  const previousWins = previousRobotMetrics.reduce((sum: number, m: RobotMetric) => sum + (m.wins || 0), 0);
  const previousLosses = previousRobotMetrics.reduce((sum: number, m: RobotMetric) => sum + (m.losses || 0), 0);

  const currentHighestElo = robots.length > 0 ? Math.max(...robots.map(r => r.elo)) : 0;

  let previousHighestElo = currentHighestElo;
  if (previousRobotMetrics.length > 0) {
    const highestEloRobot = robots.find(r => r.elo === currentHighestElo);
    if (highestEloRobot) {
      const robotMetric = currentRobotMetrics.find((m: RobotMetric) => m.robotId === highestEloRobot.id);
      if (robotMetric && robotMetric.eloChange !== undefined) {
        previousHighestElo = currentHighestElo - robotMetric.eloChange;
      }
    }
  }

  return {
    prestige: currentStableMetrics?.totalPrestigeEarned || 0,
    wins: currentWins - previousWins,
    losses: currentLosses - previousLosses,
    highestElo: currentHighestElo - previousHighestElo,
  };
}
