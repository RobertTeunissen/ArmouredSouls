import prisma from '../../lib/prisma';
import { getTopModeKills } from '../battle/modeKillsQueries';

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

// byeRobotFilter removed — Spec #41 (no persistent Bye Robot)
const byeRobotFilter = {};

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

// `getWinnerAndLoser()` was removed with Spec #46 R4.1/R4.2 — its only callers
// were the Longest Battle and Fastest Victory mappers.

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

/**
 * Battle types Most Damage is scoped by (Spec #46 R4.5).
 *
 * A single overall ranking is meaningless: a Grand Melee robot swings at 19
 * opponents over the same clock a 1v1 robot spends on one, so the top of an
 * unscoped list is just "which mode has the most targets". Scoping by mode
 * makes each list a comparison between robots that faced the same conditions.
 */
export const DAMAGE_RECORD_MODES = [
  'league_1v1',
  'tournament_1v1',
  'league_2v2',
  'league_3v3',
  'koth',
  'grand_melee',
] as const;

export type DamageRecordMode = typeof DAMAGE_RECORD_MODES[number];

/** Modes where exactly one opponent exists, so naming them is well defined. */
const SINGLE_OPPONENT_MODES = new Set<string>(['league_1v1', 'tournament_1v1']);

async function fetchMostDamageForMode(battleType: DamageRecordMode) {
  const rows = await prisma.battleParticipant.findMany({
    where: { battle: { battleType } },
    orderBy: { damageDealt: 'desc' },
    take: 10,
    include: {
      robot: { include: { user: { select: userSelect } } },
      battle: { include: battleWithParticipantsInclude },
    },
  });

  const namesOpponent = SINGLE_OPPONENT_MODES.has(battleType);

  return rows.map(participant => {
    const opponent = namesOpponent
      ? participant.battle.participants.find(p => p.robotId !== participant.robotId)
      : undefined;
    return {
      battleId: participant.battle.id,
      damageDealt: participant.damageDealt,
      robot: {
        id: participant.robot.id,
        name: participant.robot.name,
        username: getUserDisplayName(participant.robot.user),
      },
      // Multi-participant modes omit the opponent entirely rather than picking
      // an arbitrary one of many.
      ...(namesOpponent
        ? {
            opponent: opponent
              ? { id: opponent.robot.id, name: opponent.robot.name, username: getUserDisplayName(opponent.robot.user) }
              : { id: 0, name: 'Unknown', username: '' },
          }
        : {}),
      durationSeconds: participant.battle.durationSeconds,
      date: participant.battle.createdAt,
    };
  });
}

export async function fetchCombatRecords() {
  // Spec #46 R4.1/R4.2: Longest Battle and Fastest Victory removed. Every
  // league battle that reaches the MAX_BATTLE_DURATION cap forces a draw at the
  // same duration, so Longest Battle reported an identical 2:00 for every entry
  // and any duration-derived replacement inherits the same ceiling.

  // Most Damage in Single Battle, scoped per mode (R4.5)
  const damageByModeEntries = await Promise.all(
    DAMAGE_RECORD_MODES.map(async (mode) => [mode, await fetchMostDamageForMode(mode)] as const),
  );
  const mostDamageInBattle = Object.fromEntries(damageByModeEntries) as Record<
    DamageRecordMode,
    Awaited<ReturnType<typeof fetchMostDamageForMode>>
  >;

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
    mostDamageInBattle,
    narrowestVictory: narrowestVictories,
  };
}

// ─── Upset Records ──────────────────────────────────────────────────

export async function fetchUpsetRecords() {
  // Spec #46 R4.6: tournament modes only. League matchmaking scores on LP and
  // scopes to a tier instance, so it deliberately pairs robots of comparable
  // standing — a "biggest upset" drawn from league battles is measuring the
  // matchmaker's tolerance, not an underdog result. Tournament brackets are
  // seeded, so a low-seed win against a high seed is a genuine upset.
  const upsetRows = await prisma.$queryRaw<Array<{ battle_id: number; upset_diff: number }>>`
    SELECT
      w."battle_id",
      (l."elo_before" - w."elo_before") AS upset_diff
    FROM "battle_participants" w
    JOIN "battle_participants" l ON w."battle_id" = l."battle_id" AND w."robot_id" != l."robot_id"
    JOIN "battles" b ON b.id = w."battle_id"
    WHERE b."winner_id" = w."robot_id"
      AND w."elo_before" < l."elo_before"
      AND b."battle_type" = 'tournament_1v1'
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

  // Spec #46 R4.7: team tournament upsets, computed from *summed* team ELO
  // rather than per-robot ELO. `calculateTeamBattleELOChanges()` derives a
  // team's rating the same way, and summing is what makes a 2v2/3v3 upset
  // differential larger than a 1v1 one — the gap that has to be overcome is
  // the sum of two or three rating gaps.
  const teamUpsetRows = await prisma.$queryRaw<
    Array<{ battle_id: number; upset_diff: number; winning_team: number; battle_type: string; created_at: Date }>
  >`
    WITH team_elo AS (
      SELECT
        bp."battle_id",
        bp."team",
        SUM(bp."elo_before")::float AS team_elo_before
      FROM "battle_participants" bp
      JOIN "battles" b ON b.id = bp."battle_id"
      WHERE b."battle_type" IN ('tournament_2v2', 'tournament_3v3')
      GROUP BY bp."battle_id", bp."team"
    )
    SELECT
      w."battle_id",
      (l.team_elo_before - w.team_elo_before) AS upset_diff,
      w."team" AS winning_team,
      b."battle_type",
      b."created_at"
    FROM team_elo w
    JOIN team_elo l ON w."battle_id" = l."battle_id" AND w."team" != l."team"
    JOIN "battles" b ON b.id = w."battle_id"
    WHERE b."winning_side" = w."team"
      AND w.team_elo_before < l.team_elo_before
    ORDER BY upset_diff DESC
    LIMIT 10
  `;

  const teamUpsetBattleIds = teamUpsetRows.map(r => r.battle_id);
  const teamUpsetBattles = teamUpsetBattleIds.length > 0
    ? await prisma.battle.findMany({
        where: { id: { in: teamUpsetBattleIds } },
        include: battleWithParticipantsInclude,
      })
    : [];
  const teamUpsetBattleMap = new Map(teamUpsetBattles.map(b => [b.id, b]));

  const biggestTeamUpsets = teamUpsetRows
    .map(row => {
      const battle = teamUpsetBattleMap.get(row.battle_id);
      if (!battle) return null;
      const underdogSide = battle.participants.filter(p => p.team === row.winning_team);
      const favoriteSide = battle.participants.filter(p => p.team !== row.winning_team);
      if (underdogSide.length === 0 || favoriteSide.length === 0) return null;
      const sumElo = (side: typeof underdogSide) => side.reduce((acc, p) => acc + p.eloBefore, 0);
      return {
        battleId: battle.id,
        battleType: row.battle_type,
        eloDifference: Number(row.upset_diff),
        underdog: {
          robots: underdogSide.map(mapParticipantDisplay),
          teamEloBefore: sumElo(underdogSide),
        },
        favorite: {
          robots: favoriteSide.map(mapParticipantDisplay),
          teamEloBefore: sumElo(favoriteSide),
        },
        date: battle.createdAt,
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  // Spec #46 R4.8: Biggest ELO Gain and Biggest ELO Loss removed. ELO_K_FACTOR
  // is a fixed 32, so the extreme of both is +32 / -32 for every entry and the
  // ranking carried no information.
  return {
    biggestUpset: biggestUpsets,
    biggestTeamUpset: biggestTeamUpsets,
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
    tier: string | null;
    username: string;
    stable_name: string | null;
  }
  const winRateRows = await prisma.$queryRaw<WinRateRow[]>`
    SELECT r.id, r.name, r.wins, r."total_battles", r.elo,
           s."tier",
           u.username, u."stable_name"
    FROM "robots" r
    JOIN "users" u ON u.id = r."user_id"
    LEFT JOIN "standings" s ON s."entity_type" = 'robot' AND s."entity_id" = r.id AND s."mode" = 'league_1v1'
    WHERE r."total_battles" >= 50
    ORDER BY (r.wins::float / r."total_battles") DESC
    LIMIT 10
  `;
  const robotsWithWinRate = winRateRows.map(r => ({
    id: r.id, name: r.name, wins: r.wins, totalBattles: r.total_battles,
    elo: r.elo, league: r.tier ?? 'bronze',
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
      elo: robot.elo, league: robot.league,
    })),
    mostLifetimeDamage: mostLifetimeDamageRobots.map(robot => ({
      robotId: robot.id, robotName: robot.name, username: getUserDisplayName(robot.user),
      damageDealt: robot.damageDealtLifetime, totalBattles: robot.totalBattles,
      avgDamagePerBattle: robot.totalBattles > 0 ? Number((robot.damageDealtLifetime / robot.totalBattles).toFixed(0)) : 0,
    })),
    highestElo: highestEloRobots.map(robot => ({
      robotId: robot.id, robotName: robot.name, username: getUserDisplayName(robot.user),
      elo: robot.elo, wins: robot.wins, losses: robot.losses, draws: robot.draws,
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
      fame: robot.fame, elo: robot.elo,
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

/**
 * Round a KotH zone metric to the Zone_Metric_Precision of one decimal.
 *
 * `standings.total_zone_score` and `total_zone_time` are `Float` columns
 * accumulated by repeated `+=` of per-tick contributions, which leaves binary
 * floating-point residue — `1642.7000000000005` shipped to the Hall of Records
 * as-is. One decimal is the meaningful resolution: the simulation advances in
 * 0.1s ticks, so anything finer is noise rather than measurement.
 *
 * Rounded here rather than in `KothRecords.tsx` so the API ships display-ready
 * values and every consumer sees the same number.
 */
function roundToZonePrecision(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function fetchKothRecords(): Promise<Record<string, unknown> | undefined> {
  // Query standings for KotH records (source of truth since Spec #40).
  // Destructions are the exception — see getTopModeKills.
  const kothFilter = { mode: 'koth' as const, totalMatches: { gt: 0 } };

  // Spec #46 R4.3: Best Placement removed. Any robot that has ever won a KotH
  // match has a bestPlacement of 1, so the category ranked every winner as
  // joint first and carried no information.
  // Destructions are ranked from the per-mode tally; every other category still
  // ranks on a standings column.
  const [mostWinsStandings, highestZoneScoreStandings, mostKillsTallies, longestStreakStandings, mostZoneTimeStandings, zoneDominatorStandings] =
    await Promise.all([
      prisma.standing.findMany({ where: { ...kothFilter, entityType: 'robot' }, orderBy: { wins: 'desc' }, take: 10 }),
      prisma.standing.findMany({ where: { ...kothFilter, entityType: 'robot' }, orderBy: { totalZoneScore: 'desc' }, take: 10 }),
      getTopModeKills('koth', 10),
      prisma.standing.findMany({ where: { ...kothFilter, entityType: 'robot' }, orderBy: { bestWinStreak: 'desc' }, take: 10 }),
      prisma.standing.findMany({ where: { ...kothFilter, entityType: 'robot' }, orderBy: { totalZoneTime: 'desc' }, take: 10 }),
      prisma.standing.findMany({ where: { ...kothFilter, entityType: 'robot' }, orderBy: { totalZoneScore: 'desc' }, take: 10 }),
    ]);

  // Match counts for the destruction leaders, which the tally does not carry.
  const killLeaderMatches = new Map(
    (mostKillsTallies.length > 0
      ? await prisma.standing.findMany({
          where: { mode: 'koth', entityType: 'robot', entityId: { in: mostKillsTallies.map(k => k.robotId) } },
          select: { entityId: true, totalMatches: true },
        })
      : []
    ).map(s => [s.entityId, s.totalMatches ?? 0]),
  );

  // Collect all unique robot IDs across all categories
  const allStandings = [mostWinsStandings, highestZoneScoreStandings, longestStreakStandings, mostZoneTimeStandings, zoneDominatorStandings];
  const allRobotIds = [...new Set([
    ...allStandings.flat().map(s => s.entityId),
    ...mostKillsTallies.map(k => k.robotId),
  ])];

  // Fetch robot details (name + user) in one query
  const robots = allRobotIds.length > 0
    ? await prisma.robot.findMany({
        where: { id: { in: allRobotIds } },
        include: { user: { select: userSelect } },
      })
    : [];
  const robotMap = new Map(robots.map(r => [r.id, r]));

  const mapStanding = (s: typeof mostWinsStandings[number]) => {
    const robot = robotMap.get(s.entityId);
    return {
      robotId: s.entityId,
      robotName: robot?.name ?? 'Unknown',
      username: robot ? getUserDisplayName(robot.user) : '',
    };
  };

  return {
    mostWins: mostWinsStandings.map(s => ({
      ...mapStanding(s), kothWins: s.wins, kothMatches: s.totalMatches ?? 0,
      winRate: (s.totalMatches ?? 0) > 0 ? Number((s.wins / (s.totalMatches ?? 1) * 100).toFixed(1)) : 0,
    })),
    highestAvgZoneScore: highestZoneScoreStandings.map(s => ({
      ...mapStanding(s),
      avgZoneScore: (s.totalMatches ?? 0) > 0 ? Number(((s.totalZoneScore ?? 0) / (s.totalMatches ?? 1)).toFixed(1)) : 0,
      kothMatches: s.totalMatches ?? 0,
    })),
    mostKillsCareer: mostKillsTallies.map(k => {
      const robot = robotMap.get(k.robotId);
      return {
        robotId: k.robotId,
        robotName: robot?.name ?? 'Unknown',
        username: robot ? getUserDisplayName(robot.user) : '',
        kothKills: k.kills,
        kothMatches: killLeaderMatches.get(k.robotId) ?? 0,
      };
    }),
    longestWinStreak: longestStreakStandings.map(s => ({ ...mapStanding(s), bestWinStreak: s.bestWinStreak, kothWins: s.wins })),
    mostZoneTime: mostZoneTimeStandings.map(s => ({
      ...mapStanding(s),
      totalZoneTime: roundToZonePrecision(s.totalZoneTime ?? 0),
      kothMatches: s.totalMatches ?? 0,
    })),
    zoneDominator: zoneDominatorStandings.map(s => ({
      ...mapStanding(s),
      totalZoneScore: roundToZonePrecision(s.totalZoneScore ?? 0),
      kothMatches: s.totalMatches ?? 0,
    })),
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

  // 2. Longest survival by a single robot (from battle_summaries — Spec #39)
  // Falls back to battle_log->'participants' for battles without summaries
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
    FROM battles b
    JOIN battle_summaries bs ON bs.battle_id = b.id,
      jsonb_array_elements(bs.participants) AS p(value)
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

// ─── Grand Melee Records ────────────────────────────────────────────

export async function fetchGrandMeleeRecords(): Promise<Record<string, unknown> | undefined> {
  const grandMeleeFilter = { mode: 'grand_melee' as const, totalMatches: { gt: 0 } };

  const [mostWinsRobots, highestLpStandings, mostKillsTallies] = await Promise.all([
    prisma.robot.findMany({
      where: { grandMeleeWins: { gt: 0 } },
      orderBy: { grandMeleeWins: 'desc' },
      take: 10,
      select: { id: true, name: true, grandMeleeWins: true, user: { select: userSelect } },
    }),
    prisma.standing.findMany({
      where: { ...grandMeleeFilter, entityType: 'robot' },
      orderBy: { leaguePoints: 'desc' },
      take: 10,
    }),
    getTopModeKills('grand_melee', 10),
  ]);

  // No data at all — return undefined
  if (mostWinsRobots.length === 0 && highestLpStandings.length === 0 && mostKillsTallies.length === 0) {
    return undefined;
  }

  // Match counts for the destruction leaders, which the tally does not carry.
  const killLeaderMatches = new Map(
    (mostKillsTallies.length > 0
      ? await prisma.standing.findMany({
          where: { mode: 'grand_melee', entityType: 'robot', entityId: { in: mostKillsTallies.map(k => k.robotId) } },
          select: { entityId: true, totalMatches: true },
        })
      : []
    ).map(s => [s.entityId, s.totalMatches ?? 0]),
  );

  // Batch-resolve robot names for standing-based queries
  const allRobotIds = [...new Set([
    ...highestLpStandings.map(s => s.entityId),
    ...mostKillsTallies.map(k => k.robotId),
  ])];

  const robots = allRobotIds.length > 0
    ? await prisma.robot.findMany({
        where: { id: { in: allRobotIds } },
        include: { user: { select: userSelect } },
      })
    : [];
  const robotMap = new Map(robots.map(r => [r.id, r]));

  const mapStanding = (s: typeof highestLpStandings[number]) => {
    const robot = robotMap.get(s.entityId);
    return {
      robotId: s.entityId,
      robotName: robot?.name ?? 'Unknown',
      username: robot ? getUserDisplayName(robot.user) : '',
    };
  };

  return {
    mostWins: mostWinsRobots.map(r => ({
      robotId: r.id,
      robotName: r.name,
      username: getUserDisplayName(r.user),
      grandMeleeWins: r.grandMeleeWins,
    })),
    highestLp: highestLpStandings.map(s => ({
      ...mapStanding(s),
      leaguePoints: s.leaguePoints,
      tier: s.tier,
    })),
    mostKillsCareer: mostKillsTallies.map(k => {
      const robot = robotMap.get(k.robotId);
      const matches = killLeaderMatches.get(k.robotId) ?? 0;
      return {
        robotId: k.robotId,
        robotName: robot?.name ?? 'Unknown',
        username: robot ? getUserDisplayName(robot.user) : '',
        totalKills: k.kills,
        grandMeleeMatches: matches,
        // Spec #46 R4.17: total kills alone rewards volume — a robot subscribed
        // since the mode launched outranks a deadlier robot that joined later.
        killsPerMatch: matches > 0 ? Number((k.kills / matches).toFixed(2)) : 0,
      };
    }),
  };
}

// ─── League Win Streak Records (Spec #46 R7) ────────────────────────

/**
 * League modes that carry a meaningful win streak.
 *
 * The tournament modes are excluded because their orchestrators never call
 * `recordBattleResult()`, so `standings.best_win_streak` is permanently zero for
 * them — including them would render four empty lists.
 *
 * `grand_melee` is excluded by decision rather than by data: a "win" there is
 * placement 1 of 20, so a streak of 2 is already exceptional and the numbers
 * would sit near zero for everyone. Listing them beside a 1v1 league streak of
 * 15 invites a comparison that means nothing.
 */
export const WIN_STREAK_MODES = ['league_1v1', 'league_2v2', 'league_3v3', 'tag_team'] as const;

export type WinStreakMode = typeof WIN_STREAK_MODES[number];

/** Modes whose `standings.entity_id` references a `TeamBattle` rather than a `Robot`. */
const TEAM_STREAK_MODES = new Set<string>(['league_2v2', 'league_3v3', 'tag_team']);

export interface WinStreakEntry {
  entityId: number;
  entityName: string;
  username: string;
  bestWinStreak: number;
  currentWinStreak: number;
  /** True when the best streak is the one currently running. */
  isActive: boolean;
  wins: number;
}

/**
 * Longest league win streaks, one list per League_Mode.
 *
 * Reads `standings.best_win_streak` directly rather than recomputing from battle
 * history: `battle_log` is NULLed by the 7-day retention cron (Spec #39), so any
 * recomputation would silently truncate to the retention window. The streak
 * columns are maintained counters and survive retention.
 *
 * Entity resolution is batched into one `robot.findMany` and one
 * `teamBattle.findMany` across all four result sets, following the `robotMap`
 * pattern in `fetchKothRecords()`.
 */
export async function fetchWinStreakRecords(): Promise<Record<WinStreakMode, WinStreakEntry[]>> {
  const standingsByMode = await Promise.all(
    WIN_STREAK_MODES.map(async (mode) => {
      const rows = await prisma.standing.findMany({
        where: { mode, bestWinStreak: { gt: 0 } },
        // entityId ascending is the deterministic tiebreak, so equal streaks
        // always render in the same order across requests and cache refreshes.
        orderBy: [{ bestWinStreak: 'desc' }, { entityId: 'asc' }],
        take: 10,
      });
      return [mode, rows] as const;
    }),
  );

  const robotIds = new Set<number>();
  const teamIds = new Set<number>();
  for (const [mode, rows] of standingsByMode) {
    for (const row of rows) {
      (TEAM_STREAK_MODES.has(mode) ? teamIds : robotIds).add(row.entityId);
    }
  }

  const [robots, teams] = await Promise.all([
    robotIds.size > 0
      ? prisma.robot.findMany({
          where: { id: { in: [...robotIds] } },
          select: { id: true, name: true, wins: true, user: { select: userSelect } },
        })
      : Promise.resolve([]),
    teamIds.size > 0
      ? prisma.teamBattle.findMany({
          where: { id: { in: [...teamIds] } },
          select: { id: true, teamName: true, stable: { select: userSelect } },
        })
      : Promise.resolve([]),
  ]);

  const robotMap = new Map(robots.map(r => [r.id, r]));
  const teamMap = new Map(teams.map(t => [t.id, t]));

  const result = {} as Record<WinStreakMode, WinStreakEntry[]>;
  for (const [mode, rows] of standingsByMode) {
    result[mode] = rows.map((row) => {
      const isTeamMode = TEAM_STREAK_MODES.has(mode);
      const team = isTeamMode ? teamMap.get(row.entityId) : undefined;
      const robot = isTeamMode ? undefined : robotMap.get(row.entityId);
      return {
        entityId: row.entityId,
        entityName: team?.teamName ?? robot?.name ?? 'Unknown',
        username: team?.stable
          ? getUserDisplayName(team.stable)
          : robot?.user
            ? getUserDisplayName(robot.user)
            : '',
        bestWinStreak: row.bestWinStreak,
        currentWinStreak: row.currentWinStreak,
        isActive: row.currentWinStreak === row.bestWinStreak,
        wins: row.wins,
      };
    });
  }

  return result;
}
