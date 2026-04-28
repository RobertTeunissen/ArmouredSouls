import prisma from '../lib/prisma';

// Helper to get display name (stableName or username fallback)
export const getUserDisplayName = (user: { username: string; stableName?: string | null }): string => {
  return user.stableName || user.username;
};

// User select for records (includes stableName)
export const userSelect = {
  username: true,
  stableName: true,
};

const robotUserInclude = { user: { select: userSelect } };
const battleInclude = {
  robot1: { include: robotUserInclude },
  robot2: { include: robotUserInclude },
};

const byeRobotFilter = { NOT: { name: 'Bye Robot' as const } };

// ─── Battle helper ──────────────────────────────────────────────────

type BattleWithRobots = Awaited<ReturnType<typeof prisma.battle.findMany<{ include: typeof battleInclude }>>>[number];

function mapBattleWinnerLoser(battle: BattleWithRobots) {
  const isR1Winner = battle.winnerId === battle.robot1Id;
  const winner = isR1Winner ? battle.robot1 : battle.robot2;
  const loser = isR1Winner ? battle.robot2 : battle.robot1;
  return {
    winner: { id: winner.id, name: winner.name, username: getUserDisplayName(winner.user) },
    loser: { id: loser.id, name: loser.name, username: getUserDisplayName(loser.user) },
  };
}

// ─── Combat Records ─────────────────────────────────────────────────

export async function fetchCombatRecords() {
  const fastestVictories = await prisma.battle.findMany({
    where: { winnerId: { not: null }, durationSeconds: { gt: 0 } },
    orderBy: { durationSeconds: 'asc' },
    take: 10,
    include: battleInclude,
  });

  const longestBattles = await prisma.battle.findMany({
    where: { winnerId: { not: null } },
    orderBy: { durationSeconds: 'desc' },
    take: 10,
    include: battleInclude,
  });

  // Most Damage in Single Battle
  const battleParticipants = await prisma.battleParticipant.findMany({
    select: {
      battleId: true,
      robotId: true,
      damageDealt: true,
      battle: { select: { id: true, durationSeconds: true, createdAt: true } },
    },
    orderBy: { damageDealt: 'desc' },
    take: 10,
  });

  const damagesBattleIds = [...new Set(battleParticipants.map(p => p.battleId))];
  const damagesBattles = await prisma.battle.findMany({
    where: { id: { in: damagesBattleIds } },
    include: battleInclude,
  });
  const damagesBattleMap = new Map(damagesBattles.map(b => [b.id, b]));

  const mostDamageDataList = [];
  for (const participant of battleParticipants) {
    const battle = damagesBattleMap.get(participant.battleId);
    if (battle) {
      const robot = participant.robotId === battle.robot1Id ? battle.robot1 : battle.robot2;
      const opponent = participant.robotId === battle.robot1Id ? battle.robot2 : battle.robot1;
      mostDamageDataList.push({ battle, damageDealt: participant.damageDealt, robotId: participant.robotId, robot, opponent });
    }
  }

  // Narrowest Victory
  const narrowestParticipants = await prisma.battleParticipant.findMany({
    where: { finalHP: { gt: 0 }, battle: { winnerId: { not: null } } },
    select: {
      battleId: true, robotId: true, finalHP: true,
      battle: { select: { winnerId: true, robot1Id: true, robot2Id: true } },
    },
  });

  const winnerParticipants = narrowestParticipants
    .filter(p => p.battle.winnerId === p.robotId)
    .sort((a, b) => a.finalHP - b.finalHP)
    .slice(0, 10);

  const narrowBattleIds = [...new Set(winnerParticipants.map(p => p.battleId))];
  const narrowBattles = await prisma.battle.findMany({
    where: { id: { in: narrowBattleIds } },
    include: battleInclude,
  });
  const narrowBattleMap = new Map(narrowBattles.map(b => [b.id, b]));

  const narrowestVictories = [];
  for (const participant of winnerParticipants) {
    const battle = narrowBattleMap.get(participant.battleId);
    if (battle) narrowestVictories.push({ battle, remainingHP: participant.finalHP });
  }

  return {
    fastestVictory: fastestVictories.map(battle => ({
      battleId: battle.id, durationSeconds: battle.durationSeconds,
      ...mapBattleWinnerLoser(battle), date: battle.createdAt,
    })),
    longestBattle: longestBattles.map(battle => ({
      battleId: battle.id, durationSeconds: battle.durationSeconds,
      ...mapBattleWinnerLoser(battle), date: battle.createdAt,
    })),
    mostDamageInBattle: mostDamageDataList.map(data => ({
      battleId: data.battle?.id, damageDealt: data.damageDealt,
      robot: { id: data.robot?.id, name: data.robot?.name, username: data.robot?.user ? getUserDisplayName(data.robot.user) : '' },
      opponent: { id: data.opponent?.id, name: data.opponent?.name, username: data.opponent?.user ? getUserDisplayName(data.opponent.user) : '' },
      durationSeconds: data.battle?.durationSeconds, date: data.battle?.createdAt,
    })),
    narrowestVictory: narrowestVictories.map(data => ({
      battleId: data.battle.id, remainingHP: data.remainingHP,
      ...mapBattleWinnerLoser(data.battle), date: data.battle.createdAt,
    })),
  };
}

// ─── Upset Records ──────────────────────────────────────────────────

export async function fetchUpsetRecords() {
  const allBattlesForUpset = await prisma.battle.findMany({
    where: { winnerId: { not: null } },
    select: { id: true, winnerId: true, robot1Id: true, robot2Id: true, robot1ELOBefore: true, robot2ELOBefore: true },
  });

  const upsetBattles: { battleId: number; upsetDiff: number }[] = [];
  for (const battle of allBattlesForUpset) {
    const winnerELO = battle.winnerId === battle.robot1Id ? battle.robot1ELOBefore : battle.robot2ELOBefore;
    const loserELO = battle.winnerId === battle.robot1Id ? battle.robot2ELOBefore : battle.robot1ELOBefore;
    if (winnerELO < loserELO) {
      upsetBattles.push({ battleId: battle.id, upsetDiff: loserELO - winnerELO });
    }
  }
  upsetBattles.sort((a, b) => b.upsetDiff - a.upsetDiff);

  const upsetBattleIds = upsetBattles.slice(0, 10).map(u => u.battleId);
  const upsetBattlesData = await prisma.battle.findMany({
    where: { id: { in: upsetBattleIds } },
    include: battleInclude,
  });
  const upsetBattleMap = new Map(upsetBattlesData.map(b => [b.id, b]));

  const biggestUpsets = [];
  for (const upset of upsetBattles.slice(0, 10)) {
    const battle = upsetBattleMap.get(upset.battleId);
    if (battle) biggestUpsets.push({ battle, upsetDiff: upset.upsetDiff });
  }

  const biggestEloGains = await prisma.battle.findMany({
    where: { winnerId: { not: null }, eloChange: { gt: 0 } },
    orderBy: { eloChange: 'desc' }, take: 10, include: battleInclude,
  });

  const biggestEloLosses = await prisma.battle.findMany({
    where: { winnerId: { not: null }, eloChange: { gt: 0 } },
    orderBy: { eloChange: 'desc' }, take: 10, include: battleInclude,
  });

  return {
    biggestUpset: biggestUpsets.map(data => {
      const isR1Winner = data.battle.winnerId === data.battle.robot1Id;
      const underdog = isR1Winner ? data.battle.robot1 : data.battle.robot2;
      const favorite = isR1Winner ? data.battle.robot2 : data.battle.robot1;
      return {
        battleId: data.battle.id, eloDifference: data.upsetDiff,
        underdog: {
          id: underdog.id, name: underdog.name, username: getUserDisplayName(underdog.user),
          eloBefore: isR1Winner ? data.battle.robot1ELOBefore : data.battle.robot2ELOBefore,
        },
        favorite: {
          id: favorite.id, name: favorite.name, username: getUserDisplayName(favorite.user),
          eloBefore: isR1Winner ? data.battle.robot2ELOBefore : data.battle.robot1ELOBefore,
        },
        date: data.battle.createdAt,
      };
    }),
    biggestEloGain: biggestEloGains.map(battle => {
      const isR1Winner = battle.winnerId === battle.robot1Id;
      const winner = isR1Winner ? battle.robot1 : battle.robot2;
      const loser = isR1Winner ? battle.robot2 : battle.robot1;
      return {
        battleId: battle.id, eloChange: battle.eloChange,
        winner: {
          id: winner.id, name: winner.name, username: getUserDisplayName(winner.user),
          eloBefore: isR1Winner ? battle.robot1ELOBefore : battle.robot2ELOBefore,
          eloAfter: isR1Winner ? battle.robot1ELOAfter : battle.robot2ELOAfter,
        },
        loser: {
          id: loser.id, name: loser.name, username: getUserDisplayName(loser.user),
          eloBefore: isR1Winner ? battle.robot2ELOBefore : battle.robot1ELOBefore,
        },
        date: battle.createdAt,
      };
    }),
    biggestEloLoss: biggestEloLosses.map(battle => {
      const isR1Winner = battle.winnerId === battle.robot1Id;
      const loser = isR1Winner ? battle.robot2 : battle.robot1;
      const winner = isR1Winner ? battle.robot1 : battle.robot2;
      return {
        battleId: battle.id, eloChange: battle.eloChange,
        loser: {
          id: loser.id, name: loser.name, username: getUserDisplayName(loser.user),
          eloBefore: isR1Winner ? battle.robot2ELOBefore : battle.robot1ELOBefore,
          eloAfter: isR1Winner ? battle.robot2ELOAfter : battle.robot1ELOAfter,
        },
        winner: { id: winner.id, name: winner.name, username: getUserDisplayName(winner.user) },
        date: battle.createdAt,
      };
    }),
  };
}

// ─── Career Records ─────────────────────────────────────────────────

export async function fetchCareerRecords() {
  const mostBattlesRobots = await prisma.robot.findMany({
    where: byeRobotFilter, orderBy: { totalBattles: 'desc' }, take: 10, include: robotUserInclude,
  });

  const highWinRateRobots = await prisma.robot.findMany({
    where: { ...byeRobotFilter, totalBattles: { gte: 50 } },
    select: { id: true, name: true, wins: true, totalBattles: true, elo: true, currentLeague: true, user: { select: userSelect } },
  });
  const robotsWithWinRate = highWinRateRobots
    .map(r => ({ ...r, winRate: r.wins / r.totalBattles }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10);

  const mostLifetimeDamageRobots = await prisma.robot.findMany({
    where: byeRobotFilter, orderBy: { damageDealtLifetime: 'desc' }, take: 10, include: robotUserInclude,
  });

  const highestEloRobots = await prisma.robot.findMany({
    where: byeRobotFilter, orderBy: { elo: 'desc' }, take: 10, include: robotUserInclude,
  });

  const mostKillsRobots = await prisma.robot.findMany({
    where: byeRobotFilter, orderBy: { kills: 'desc' }, take: 10, include: robotUserInclude,
  });

  return {
    mostBattles: mostBattlesRobots.map(robot => ({
      robotId: robot.id, robotName: robot.name, username: getUserDisplayName(robot.user),
      totalBattles: robot.totalBattles, wins: robot.wins, losses: robot.losses, draws: robot.draws,
      winRate: robot.totalBattles > 0 ? Number((robot.wins / robot.totalBattles * 100).toFixed(1)) : 0,
      elo: robot.elo,
    })),
    highestWinRate: robotsWithWinRate.map(robot => ({
      robotId: robot.id, robotName: robot.name, username: getUserDisplayName(robot.user),
      totalBattles: robot.totalBattles, wins: robot.wins,
      winRate: Number((robot.winRate * 100).toFixed(1)),
      elo: robot.elo, league: robot.currentLeague,
    })),
    mostLifetimeDamage: mostLifetimeDamageRobots.map(robot => ({
      robotId: robot.id, robotName: robot.name, username: getUserDisplayName(robot.user),
      damageDealt: robot.damageDealtLifetime, totalBattles: robot.totalBattles,
      avgDamagePerBattle: robot.totalBattles > 0 ? Number((robot.damageDealtLifetime / robot.totalBattles).toFixed(0)) : 0,
    })),
    highestElo: highestEloRobots.map(robot => ({
      robotId: robot.id, robotName: robot.name, username: getUserDisplayName(robot.user),
      elo: robot.elo, league: robot.currentLeague, wins: robot.wins, losses: robot.losses, draws: robot.draws,
    })),
    mostKills: mostKillsRobots.map(robot => ({
      robotId: robot.id, robotName: robot.name, username: getUserDisplayName(robot.user),
      kills: robot.kills, totalBattles: robot.totalBattles,
      killRate: robot.totalBattles > 0 ? Number((robot.kills / robot.totalBattles * 100).toFixed(1)) : 0,
    })),
  };
}

// ─── Economic Records ───────────────────────────────────────────────

export async function fetchEconomicRecords() {
  const highestFameRobots = await prisma.robot.findMany({
    where: byeRobotFilter, orderBy: { fame: 'desc' }, take: 10, include: robotUserInclude,
  });

  const richestStables = await prisma.user.findMany({
    orderBy: { currency: 'desc' }, take: 10,
    select: {
      id: true, username: true, stableName: true, currency: true, prestige: true,
      robots: { where: byeRobotFilter, select: { id: true, name: true } },
    },
  });

  return {
    mostExpensiveBattle: [],
    highestFame: highestFameRobots.map(robot => ({
      robotId: robot.id, robotName: robot.name, username: getUserDisplayName(robot.user),
      fame: robot.fame, league: robot.currentLeague, elo: robot.elo,
    })),
    richestStables: richestStables.map(stable => ({
      userId: stable.id, username: getUserDisplayName(stable),
      currency: stable.currency, prestige: stable.prestige, robotCount: stable.robots.length,
    })),
  };
}

// ─── Prestige Records ───────────────────────────────────────────────

export async function fetchPrestigeRecords() {
  const stableSelect = {
    id: true, username: true, stableName: true, prestige: true, championshipTitles: true,
    robots: { where: byeRobotFilter, select: { id: true, name: true } },
  };

  const highestPrestigeStables = await prisma.user.findMany({
    orderBy: { prestige: 'desc' }, take: 10, select: stableSelect,
  });

  const mostTitlesStables = await prisma.user.findMany({
    where: { championshipTitles: { gt: 0 } },
    orderBy: { championshipTitles: 'desc' }, take: 10, select: stableSelect,
  });

  return {
    highestPrestige: highestPrestigeStables.map(stable => ({
      userId: stable.id, username: getUserDisplayName(stable),
      prestige: stable.prestige, championshipTitles: stable.championshipTitles, robotCount: stable.robots.length,
    })),
    mostTitles: mostTitlesStables.map(stable => ({
      userId: stable.id, username: getUserDisplayName(stable),
      championshipTitles: stable.championshipTitles, prestige: stable.prestige, robotCount: stable.robots.length,
    })),
  };
}

// ─── KotH Records ───────────────────────────────────────────────────

export async function fetchKothRecords(): Promise<Record<string, unknown> | undefined> {
  const kothWhere = { kothMatches: { gt: 0 }, ...byeRobotFilter };

  const [mostKothWins, highestAvgZoneScore, mostKothKills, longestKothWinStreak, mostZoneTime, bestKothPlacement, zoneDominators] =
    await Promise.all([
      prisma.robot.findMany({ where: kothWhere, orderBy: { kothWins: 'desc' }, take: 10, include: robotUserInclude }),
      prisma.robot.findMany({ where: kothWhere, orderBy: { kothTotalZoneScore: 'desc' }, take: 10, include: robotUserInclude }),
      prisma.robot.findMany({ where: kothWhere, orderBy: { kothKills: 'desc' }, take: 10, include: robotUserInclude }),
      prisma.robot.findMany({ where: kothWhere, orderBy: { kothBestWinStreak: 'desc' }, take: 10, include: robotUserInclude }),
      prisma.robot.findMany({ where: kothWhere, orderBy: { kothTotalZoneTime: 'desc' }, take: 10, include: robotUserInclude }),
      prisma.robot.findMany({ where: { ...kothWhere, kothBestPlacement: { not: null } }, orderBy: { kothBestPlacement: 'asc' }, take: 10, include: robotUserInclude }),
      prisma.robot.findMany({ where: kothWhere, orderBy: { kothTotalZoneScore: 'desc' }, take: 10, include: robotUserInclude }),
    ]);

  const mapRobot = (robot: typeof mostKothWins[number]) => ({
    robotId: robot.id, robotName: robot.name, username: getUserDisplayName(robot.user),
  });

  return {
    mostWins: mostKothWins.map(r => ({
      ...mapRobot(r), kothWins: r.kothWins, kothMatches: r.kothMatches,
      winRate: r.kothMatches > 0 ? Number((r.kothWins / r.kothMatches * 100).toFixed(1)) : 0,
    })),
    highestAvgZoneScore: highestAvgZoneScore.map(r => ({
      ...mapRobot(r),
      avgZoneScore: r.kothMatches > 0 ? Number((r.kothTotalZoneScore / r.kothMatches).toFixed(1)) : 0,
      kothMatches: r.kothMatches,
    })),
    mostKillsCareer: mostKothKills.map(r => ({ ...mapRobot(r), kothKills: r.kothKills, kothMatches: r.kothMatches })),
    longestWinStreak: longestKothWinStreak.map(r => ({ ...mapRobot(r), bestWinStreak: r.kothBestWinStreak, kothWins: r.kothWins })),
    mostZoneTime: mostZoneTime.map(r => ({ ...mapRobot(r), totalZoneTime: r.kothTotalZoneTime, kothMatches: r.kothMatches })),
    bestPlacement: bestKothPlacement.map(r => ({ ...mapRobot(r), bestPlacement: r.kothBestPlacement, kothMatches: r.kothMatches })),
    zoneDominator: zoneDominators.map(r => ({ ...mapRobot(r), totalZoneScore: r.kothTotalZoneScore, kothMatches: r.kothMatches })),
  };
}
