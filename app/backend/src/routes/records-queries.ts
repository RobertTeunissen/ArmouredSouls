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

const participantInclude = {
  robot: { include: { user: { select: userSelect } } },
};

const byeRobotFilter = { NOT: { name: 'Bye Robot' as const } };

// ─── Participant-based battle helpers ───────────────────────────────

interface ParticipantWithRobot {
  robotId: number;
  eloBefore: number;
  eloAfter: number;
  damageDealt: number;
  finalHP: number;
  destroyed: boolean;
  yielded: boolean;
  team: number;
  robot: { id: number; name: string; user: { username: string; stableName?: string | null } };
}

interface BattleWithParticipants {
  id: number;
  winnerId: number | null;
  durationSeconds: number;
  battleType: string;
  createdAt: Date;
  participants: ParticipantWithRobot[];
}

function getWinnerAndLoser(battle: BattleWithParticipants) {
  const winner = battle.participants.find(p => p.robotId === battle.winnerId);
  const loser = battle.participants.find(p => p.robotId !== battle.winnerId);
  return { winner, loser };
}

function mapParticipantDisplay(p: ParticipantWithRobot) {
  return { id: p.robot.id, name: p.robot.name, username: getUserDisplayName(p.robot.user) };
}

// Standard include for battle queries using participants
const battleWithParticipantsInclude = {
  participants: {
    include: { robot: { include: { user: { select: userSelect } } } },
  },
};

// ─── Combat Records ─────────────────────────────────────────────────

export async function fetchCombatRecords() {
  // Combat records only consider 1v1 battles (league/tournament) to avoid
  // multi-participant ambiguity in winner/loser assignment
  const oneVsOneFilter = { winnerId: { not: null }, battleType: { in: ['league_1v1', 'tournament_1v1'] } };

  const fastestVictories = await prisma.battle.findMany({
    where: { ...oneVsOneFilter, durationSeconds: { gt: 0 } },
    orderBy: { durationSeconds: 'asc' },
    take: 10,
    include: battleWithParticipantsInclude,
  });

  const longestBattles = await prisma.battle.findMany({
    where: oneVsOneFilter,
    orderBy: { durationSeconds: 'desc' },
    take: 10,
    include: battleWithParticipantsInclude,
  });

  // Most Damage in Single Battle (1v1 only for clean opponent display)
  const battleParticipants = await prisma.battleParticipant.findMany({
    where: { battle: { battleType: { in: ['league_1v1', 'tournament_1v1'] } } },
    orderBy: { damageDealt: 'desc' },
    take: 10,
    include: {
      robot: { include: { user: { select: userSelect } } },
      battle: {
        include: battleWithParticipantsInclude,
      },
    },
  });

  const mostDamageDataList = battleParticipants.map(participant => {
    const opponent = participant.battle.participants.find(p => p.robotId !== participant.robotId);
    return {
      battleId: participant.battle.id,
      damageDealt: participant.damageDealt,
      robot: { id: participant.robot.id, name: participant.robot.name, username: getUserDisplayName(participant.robot.user) },
      opponent: opponent
        ? { id: opponent.robot.id, name: opponent.robot.name, username: getUserDisplayName(opponent.robot.user) }
        : { id: 0, name: 'Unknown', username: '' },
      durationSeconds: participant.battle.durationSeconds,
      date: participant.battle.createdAt,
    };
  });

  // Narrowest Victory — winners with lowest finalHP (1v1 only)
  const narrowWinners = await prisma.battleParticipant.findMany({
    where: {
      finalHP: { gt: 0 },
      battle: { winnerId: { not: null }, battleType: { in: ['league_1v1', 'tournament_1v1'] } },
    },
    orderBy: { finalHP: 'asc' },
    take: 50, // Fetch extra to filter for actual winners
    include: {
      robot: { include: { user: { select: userSelect } } },
      battle: {
        select: { id: true, winnerId: true, durationSeconds: true, createdAt: true,
          participants: { include: participantInclude } },
      },
    },
  });

  // Filter to only actual winners
  const narrowestVictories = narrowWinners
    .filter(p => p.battle.winnerId === p.robotId)
    .slice(0, 10)
    .map(p => {
      const loser = p.battle.participants.find(op => op.robotId !== p.robotId);
      return {
        battleId: p.battle.id,
        remainingHP: p.finalHP,
        winner: { id: p.robot.id, name: p.robot.name, username: getUserDisplayName(p.robot.user) },
        loser: loser
          ? { id: loser.robot.id, name: loser.robot.name, username: getUserDisplayName(loser.robot.user) }
          : { id: 0, name: 'Unknown', username: '' },
        date: p.battle.createdAt,
      };
    });

  return {
    fastestVictory: fastestVictories.map(battle => {
      const { winner, loser } = getWinnerAndLoser(battle);
      return {
        battleId: battle.id, durationSeconds: battle.durationSeconds,
        winner: winner ? mapParticipantDisplay(winner) : { id: 0, name: 'Unknown', username: '' },
        loser: loser ? mapParticipantDisplay(loser) : { id: 0, name: 'Unknown', username: '' },
        date: battle.createdAt,
      };
    }),
    longestBattle: longestBattles.map(battle => {
      const { winner, loser } = getWinnerAndLoser(battle);
      return {
        battleId: battle.id, durationSeconds: battle.durationSeconds,
        winner: winner ? mapParticipantDisplay(winner) : { id: 0, name: 'Unknown', username: '' },
        loser: loser ? mapParticipantDisplay(loser) : { id: 0, name: 'Unknown', username: '' },
        date: battle.createdAt,
      };
    }),
    mostDamageInBattle: mostDamageDataList,
    narrowestVictory: narrowestVictories,
  };
}

// ─── Upset Records ──────────────────────────────────────────────────

export async function fetchUpsetRecords() {
  // Find upsets via BattleParticipant: winner had lower eloBefore than loser.
  // Only considers 1v1 battles (league/tournament) to avoid multi-participant ambiguity.
  const upsetRows = await prisma.$queryRaw<Array<{ battle_id: number; upset_diff: number }>>`
    SELECT
      w."battle_id",
      (l."elo_before" - w."elo_before") AS upset_diff
    FROM "battle_participants" w
    JOIN "battle_participants" l ON w."battle_id" = l."battle_id" AND w."robot_id" != l."robot_id"
    JOIN "battles" b ON b.id = w."battle_id"
    WHERE b."winner_id" = w."robot_id"
      AND w."elo_before" < l."elo_before"
      AND b."battle_type" IN ('league_1v1', 'tournament_1v1')
    ORDER BY upset_diff DESC
    LIMIT 10
  `;

  const upsetBattleIds = upsetRows.map(u => u.battle_id);
  const upsetBattlesData = upsetBattleIds.length > 0
    ? await prisma.battle.findMany({
        where: { id: { in: upsetBattleIds } },
        include: battleWithParticipantsInclude,
      })
    : [];
  const upsetBattleMap = new Map(upsetBattlesData.map(b => [b.id, b]));

  const biggestUpsets = upsetRows
    .map(upset => {
      const battle = upsetBattleMap.get(upset.battle_id);
      if (!battle) return null;
      const winner = battle.participants.find(p => p.robotId === battle.winnerId);
      const loser = battle.participants.find(p => p.robotId !== battle.winnerId);
      if (!winner || !loser) return null;
      return {
        battleId: battle.id,
        eloDifference: Number(upset.upset_diff),
        underdog: {
          id: winner.robot.id, name: winner.robot.name, username: getUserDisplayName(winner.robot.user),
          eloBefore: winner.eloBefore,
        },
        favorite: {
          id: loser.robot.id, name: loser.robot.name, username: getUserDisplayName(loser.robot.user),
          eloBefore: loser.eloBefore,
        },
        date: battle.createdAt,
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  // Biggest ELO gains — use raw SQL to sort by computed ELO difference
  const eloGainRows = await prisma.$queryRaw<Array<{ battle_id: number; robot_id: number; elo_gain: number }>>`
    SELECT "battle_id", "robot_id", ("elo_after" - "elo_before") AS elo_gain
    FROM "battle_participants"
    WHERE "elo_after" > "elo_before"
    ORDER BY elo_gain DESC
    LIMIT 10
  `;

  const gainBattleIds = eloGainRows.map(r => r.battle_id);
  const gainBattles = gainBattleIds.length > 0
    ? await prisma.battle.findMany({
        where: { id: { in: gainBattleIds } },
        include: battleWithParticipantsInclude,
      })
    : [];
  const gainBattleMap = new Map(gainBattles.map(b => [b.id, b]));

  const biggestEloGain = eloGainRows
    .map(row => {
      const battle = gainBattleMap.get(row.battle_id);
      if (!battle) return null;
      const winner = battle.participants.find(p => p.robotId === row.robot_id);
      const loser = battle.participants.find(p => p.robotId !== row.robot_id);
      if (!winner) return null;
      return {
        battleId: battle.id,
        eloChange: Number(row.elo_gain),
        winner: {
          id: winner.robot.id, name: winner.robot.name, username: getUserDisplayName(winner.robot.user),
          eloBefore: winner.eloBefore, eloAfter: winner.eloAfter,
        },
        loser: loser
          ? { id: loser.robot.id, name: loser.robot.name, username: getUserDisplayName(loser.robot.user), eloBefore: loser.eloBefore }
          : undefined,
        date: battle.createdAt,
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  // Biggest ELO losses
  const eloLossRows = await prisma.$queryRaw<Array<{ battle_id: number; robot_id: number; elo_loss: number }>>`
    SELECT "battle_id", "robot_id", ("elo_before" - "elo_after") AS elo_loss
    FROM "battle_participants"
    WHERE "elo_after" < "elo_before"
    ORDER BY elo_loss DESC
    LIMIT 10
  `;

  const lossBattleIds = eloLossRows.map(r => r.battle_id);
  const lossBattles = lossBattleIds.length > 0
    ? await prisma.battle.findMany({
        where: { id: { in: lossBattleIds } },
        include: battleWithParticipantsInclude,
      })
    : [];
  const lossBattleMap = new Map(lossBattles.map(b => [b.id, b]));

  const biggestEloLoss = eloLossRows
    .map(row => {
      const battle = lossBattleMap.get(row.battle_id);
      if (!battle) return null;
      const loser = battle.participants.find(p => p.robotId === row.robot_id);
      const winner = battle.participants.find(p => p.robotId !== row.robot_id);
      if (!loser) return null;
      return {
        battleId: battle.id,
        eloChange: Number(row.elo_loss),
        loser: {
          id: loser.robot.id, name: loser.robot.name, username: getUserDisplayName(loser.robot.user),
          eloBefore: loser.eloBefore, eloAfter: loser.eloAfter,
        },
        winner: winner
          ? { id: winner.robot.id, name: winner.robot.name, username: getUserDisplayName(winner.robot.user) }
          : undefined,
        date: battle.createdAt,
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  return {
    biggestUpset: biggestUpsets,
    biggestEloGain,
    biggestEloLoss,
  };
}

// ─── Career Records ─────────────────────────────────────────────────

export async function fetchCareerRecords() {
  const robotUserInclude = { user: { select: userSelect } };

  const mostBattlesRobots = await prisma.robot.findMany({
    where: byeRobotFilter, orderBy: { totalBattles: 'desc' }, take: 10, include: robotUserInclude,
  });

  // Highest win rate — use raw SQL to compute and sort at DB level
  interface WinRateRow {
    id: number;
    name: string;
    wins: number;
    total_battles: number;
    elo: number;
    current_league: string;
    username: string;
    stable_name: string | null;
  }
  const winRateRows = await prisma.$queryRaw<WinRateRow[]>`
    SELECT r.id, r.name, r.wins, r."total_battles", r.elo, r."current_league",
           u.username, u."stable_name"
    FROM "robots" r
    JOIN "users" u ON u.id = r."user_id"
    WHERE r.name != 'Bye Robot' AND r."total_battles" >= 50
    ORDER BY (r.wins::float / r."total_battles") DESC
    LIMIT 10
  `;
  const robotsWithWinRate = winRateRows.map(r => ({
    id: r.id, name: r.name, wins: r.wins, totalBattles: r.total_battles,
    elo: r.elo, currentLeague: r.current_league,
    winRate: r.wins / r.total_battles,
    user: { username: r.username, stableName: r.stable_name },
  }));

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
  const robotUserInclude = { user: { select: userSelect } };

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
  const robotUserInclude = { user: { select: userSelect } };
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

// ─── Team Battle Records ────────────────────────────────────────────

interface TeamBattleSurvivalRow {
  battle_id: number;
  robot_id: number;
  survival_seconds: number;
  battle_type: string;
  created_at: Date;
  robot_name: string;
  username: string;
  stable_name: string | null;
}

interface TeamBattleDecisiveRow {
  battle_id: number;
  hp_difference: number;
  battle_type: string;
  created_at: Date;
}

async function fetchTeamBattleRecordsForSize(battleType: 'league_2v2' | 'league_3v3') {
  // 1. Fastest victory (lowest durationSeconds for non-draw battles)
  const fastestVictories = await prisma.battle.findMany({
    where: { battleType, winnerId: { not: null }, durationSeconds: { gt: 0 } },
    orderBy: { durationSeconds: 'asc' },
    take: 10,
    include: battleWithParticipantsInclude,
  });

  // 2. Longest survival by a single robot (from battleLog JSON)
  const survivalRows = await prisma.$queryRaw<TeamBattleSurvivalRow[]>`
    SELECT
      b.id AS battle_id,
      (p.value->>'robotId')::int AS robot_id,
      (p.value->>'survivalSeconds')::float AS survival_seconds,
      b.battle_type,
      b.created_at,
      r.name AS robot_name,
      u.username,
      u.stable_name
    FROM battles b,
      jsonb_array_elements(b.battle_log->'participants') AS p(value)
    JOIN robots r ON r.id = (p.value->>'robotId')::int
    JOIN users u ON u.id = r.user_id
    WHERE b.battle_type = ${battleType}
      AND (p.value->>'survivalSeconds')::float > 0
    ORDER BY survival_seconds DESC
    LIMIT 10
  `;

  // 3. Most damage dealt by a single robot (from BattleParticipant table)
  const mostDamageParticipants = await prisma.battleParticipant.findMany({
    where: { battle: { battleType } },
    orderBy: { damageDealt: 'desc' },
    take: 10,
    include: {
      robot: { include: { user: { select: userSelect } } },
      battle: { select: { id: true, durationSeconds: true, createdAt: true, battleType: true } },
    },
  });

  // 4. Most decisive victory (largest HP difference between winning and losing side)
  const decisiveRows = await prisma.$queryRaw<TeamBattleDecisiveRow[]>`
    SELECT
      b.id AS battle_id,
      ABS(
        COALESCE((SELECT SUM(bp.final_hp) FROM battle_participants bp WHERE bp.battle_id = b.id AND bp.team = 1), 0) -
        COALESCE((SELECT SUM(bp.final_hp) FROM battle_participants bp WHERE bp.battle_id = b.id AND bp.team = 2), 0)
      ) AS hp_difference,
      b.battle_type,
      b.created_at
    FROM battles b
    WHERE b.battle_type = ${battleType}
      AND b.winner_id IS NOT NULL
    ORDER BY hp_difference DESC
    LIMIT 10
  `;

  // Fetch battle details for decisive victories
  const decisiveBattleIds = decisiveRows.map(r => r.battle_id);
  const decisiveBattles = decisiveBattleIds.length > 0
    ? await prisma.battle.findMany({
        where: { id: { in: decisiveBattleIds } },
        include: battleWithParticipantsInclude,
      })
    : [];
  const decisiveBattleMap = new Map(decisiveBattles.map(b => [b.id, b]));

  // 5. Longest non-draw battle (highest durationSeconds for non-draw battles)
  const longestBattles = await prisma.battle.findMany({
    where: { battleType, winnerId: { not: null } },
    orderBy: { durationSeconds: 'desc' },
    take: 10,
    include: battleWithParticipantsInclude,
  });

  // Map results
  const mapTeamBattleParticipants = (battle: BattleWithParticipants) => {
    const team1 = battle.participants.filter(p => p.team === 1);
    const team2 = battle.participants.filter(p => p.team === 2);
    return {
      team1: team1.map(mapParticipantDisplay),
      team2: team2.map(mapParticipantDisplay),
    };
  };

  return {
    fastestVictory: fastestVictories.map(battle => ({
      battleId: battle.id,
      durationSeconds: battle.durationSeconds,
      ...mapTeamBattleParticipants(battle),
      date: battle.createdAt,
    })),
    longestSurvival: survivalRows.map(row => ({
      battleId: row.battle_id,
      survivalSeconds: row.survival_seconds,
      robot: { id: row.robot_id, name: row.robot_name, username: row.stable_name || row.username },
      date: row.created_at,
    })),
    mostDamageDealt: mostDamageParticipants.map(p => ({
      battleId: p.battle.id,
      damageDealt: p.damageDealt,
      robot: { id: p.robot.id, name: p.robot.name, username: getUserDisplayName(p.robot.user) },
      durationSeconds: p.battle.durationSeconds,
      date: p.battle.createdAt,
    })),
    mostDecisiveVictory: decisiveRows.map(row => {
      const battle = decisiveBattleMap.get(row.battle_id);
      const teams = battle ? mapTeamBattleParticipants(battle) : { team1: [], team2: [] };
      return {
        battleId: row.battle_id,
        hpDifference: Number(row.hp_difference),
        ...teams,
        date: row.created_at,
      };
    }),
    longestNonDrawBattle: longestBattles.map(battle => ({
      battleId: battle.id,
      durationSeconds: battle.durationSeconds,
      ...mapTeamBattleParticipants(battle),
      date: battle.createdAt,
    })),
  };
}

export async function fetchTeamBattleRecords() {
  const [records2v2, records3v3] = await Promise.all([
    fetchTeamBattleRecordsForSize('league_2v2'),
    fetchTeamBattleRecordsForSize('league_3v3'),
  ]);

  return {
    '2v2': records2v2,
    '3v3': records3v3,
  };
}

// ─── Tournament Champions ───────────────────────────────────────────

export interface TournamentChampionEntry {
  tournamentId: number;
  tournamentName: string;
  championName: string; // Robot name for 1v1, team name for 2v2/3v3
  memberRobots?: string[]; // Only for team tournaments
  ownerStableName: string;
  completedAt: Date;
  participantType: string;
}

async function fetchChampionsByType(participantType: string): Promise<TournamentChampionEntry[]> {
  const tournaments = await prisma.tournament.findMany({
    where: { participantType, status: 'completed', winnerId: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: 10,
  });

  if (tournaments.length === 0) return [];

  return Promise.all(tournaments.map(async (t) => {
    if (participantType === 'robot') {
      const robot = await prisma.robot.findUnique({
        where: { id: t.winnerId! },
        include: { user: { select: { stableName: true, username: true } } },
      });
      return {
        tournamentId: t.id,
        tournamentName: t.name,
        championName: robot?.name ?? 'Unknown',
        ownerStableName: robot?.user ? getUserDisplayName(robot.user) : 'Unknown',
        completedAt: t.completedAt!,
        participantType,
      };
    } else {
      const team = await prisma.teamBattle.findUnique({
        where: { id: t.winnerId! },
        include: {
          members: { include: { robot: { select: { name: true } } }, orderBy: { slotIndex: 'asc' } },
          stable: { select: { stableName: true, username: true } },
        },
      });
      return {
        tournamentId: t.id,
        tournamentName: t.name,
        championName: team?.teamName ?? 'Unknown',
        memberRobots: team?.members.map(m => m.robot.name) ?? [],
        ownerStableName: team?.stable ? getUserDisplayName(team.stable) : 'Unknown',
        completedAt: t.completedAt!,
        participantType,
      };
    }
  }));
}

export async function fetchTournamentChampions(): Promise<{
  champions1v1: TournamentChampionEntry[];
  champions2v2: TournamentChampionEntry[];
  champions3v3: TournamentChampionEntry[];
}> {
  const [champions1v1, champions2v2, champions3v3] = await Promise.all([
    fetchChampionsByType('robot'),
    fetchChampionsByType('team_2v2'),
    fetchChampionsByType('team_3v3'),
  ]);

  return { champions1v1, champions2v2, champions3v3 };
}
