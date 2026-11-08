import prisma from '../../lib/prisma';
import { BATTLE_LOG_OMIT } from '../battle/battleLogCodec';
import type { StableType } from '../../../generated/prisma';
import { getTopModeKills } from '../battle/modeKillsQueries';
import { getAllModesBattleCounts, getTopRobotsByAllModesBattleCount } from '../robot/all-modes-battle-count';

/** Highest Win Rate only ranks robots with at least this many win/loss-mode battles. */
export const WIN_RATE_MIN_BATTLES = 50;

/**
 * Highest Avg Zone Score only ranks robots with at least this many KotH matches,
 * so one lucky match cannot top the list (the frontend states the same floor).
 */
export const KOTH_AVG_ZONE_SCORE_MIN_MATCHES = 10;

// Helper to get display name (stableName or username fallback)
export const getUserDisplayName = (user: { username: string; stableName?: string | null }): string => {
  return user.stableName || user.username;
};

// User select for records (id for the stable link, stableName and, Spec #55, stableType)
export const userSelect = {
  id: true,
  username: true,
  stableName: true,
  stableType: true,
};

interface RecordOwnerUser {
  id?: number;
  username: string;
  stableName?: string | null;
  stableType: StableType;
}

/** Display name, id and Stable_Type of a record holder's stable. */
export interface RecordOwnerDisplay {
  /** The owning stable's user id (links to `/stables/:id`); null when unknown. */
  userId: number | null;
  username: string;
  /** Spec #55 decision 42: drives the Automaton_Badge on every Hall of Records record. */
  stableType: StableType | null;
}

/** The owning stable as every record mapping ships it (decision 42). */
export const getRecordOwner = (user: RecordOwnerUser | null | undefined): RecordOwnerDisplay => (
  user
    ? { userId: user.id ?? null, username: getUserDisplayName(user), stableType: user.stableType }
    : { userId: null, username: '', stableType: null }
);

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
  robot: { id: number; name: string; user: RecordOwnerUser };
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
  return { id: p.robot.id, name: p.robot.name, ...getRecordOwner(p.robot.user) };
}

/** A robot as a record names it: id, name and owning stable. Never the full robot row. */
const robotNameSelect = { id: true, name: true, user: { select: userSelect } } as const;

// Standard include for battle queries using participants
const battleWithParticipantsInclude = {
  participants: {
    include: { robot: { select: robotNameSelect } },
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
  const namesOpponent = SINGLE_OPPONENT_MODES.has(battleType);
  // Narrow selects: this used to `include` the whole battle, combat log
  // (`battle_log_zst`, ~1.6 MB for the Grand Melee top 10 on ACC) and every
  // participant's full robot row, for six modes on every records build.
  const rows = await prisma.battleParticipant.findMany({
    where: { battle: { battleType } },
    orderBy: [{ damageDealt: 'desc' }, { id: 'asc' }],
    take: 10,
    select: {
      robotId: true,
      damageDealt: true,
      robot: { select: robotNameSelect },
      battle: {
        select: {
          id: true,
          durationSeconds: true,
          createdAt: true,
          // Only the 1v1 modes (two participants) name an opponent; elsewhere load none.
          participants: {
            take: namesOpponent ? 2 : 0,
            select: { robotId: true, robot: { select: robotNameSelect } },
          },
        },
      },
    },
  });

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
        ...getRecordOwner(participant.robot.user),
      },
      // Multi-participant modes omit the opponent entirely rather than picking
      // an arbitrary one of many.
      ...(namesOpponent
        ? {
            opponent: opponent
              ? { id: opponent.robot.id, name: opponent.robot.name, ...getRecordOwner(opponent.robot.user) }
              : { id: 0, name: 'Unknown', ...getRecordOwner(null) },
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

  // Narrowest Victory removed (Nov 2026): wins at exactly 1 HP are common (94
  // on ACC), so the whole list read "1 HP remaining" and ranked nothing.
  return { mostDamageInBattle };
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
        omit: BATTLE_LOG_OMIT,
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
          id: winner.robot.id, name: winner.robot.name, ...getRecordOwner(winner.robot.user),
          eloBefore: winner.eloBefore,
        },
        favorite: {
          id: loser.robot.id, name: loser.robot.name, ...getRecordOwner(loser.robot.user),
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
        omit: BATTLE_LOG_OMIT,
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

  // Most Battles ranks on the all-modes count (a battle is a battle: KotH and
  // Grand Melee matches count too). The ranking query returns the count it
  // ranked on, so the displayed value and the rank come from one read; the
  // robot load only adds name, owner and W/L/D. Two queries, no N+1.
  const mostBattlesRanked = await getTopRobotsByAllModesBattleCount(10);
  const mostBattlesById = new Map(
    (await prisma.robot.findMany({
      where: { id: { in: mostBattlesRanked.map((entry) => entry.robotId) } },
      include: robotUserInclude,
    })).map((robot) => [robot.id, robot]),
  );
  const mostBattlesRows = mostBattlesRanked.flatMap(({ robotId, allModesBattleCount }) => {
    const robot = mostBattlesById.get(robotId);
    return robot ? [{ robot, allModesBattleCount }] : [];
  });

  // Highest win rate — use raw SQL to compute and sort at DB level
  interface WinRateRow {
    id: number;
    name: string;
    wins: number;
    total_battles: number;
    elo: number;
    tier: string | null;
    user_id: number;
    username: string;
    stable_name: string | null;
    stable_type: StableType;
  }
  const winRateRows = await prisma.$queryRaw<WinRateRow[]>`
    SELECT r.id, r.name, r.wins, r."total_battles", r.elo,
           s."tier",
           u.id AS user_id, u.username, u."stable_name", u."stable_type"::text AS stable_type
    FROM "robots" r
    JOIN "users" u ON u.id = r."user_id"
    LEFT JOIN "standings" s ON s."entity_type" = 'robot' AND s."entity_id" = r.id AND s."mode" = 'league_1v1'
    WHERE r."total_battles" >= ${WIN_RATE_MIN_BATTLES}
    ORDER BY (r.wins::float / r."total_battles") DESC, r."total_battles" DESC, r.id ASC
    LIMIT 10
  `;
  const robotsWithWinRate = winRateRows.map(r => ({
    id: r.id, name: r.name, wins: r.wins, totalBattles: r.total_battles,
    elo: r.elo, league: r.tier ?? 'bronze',
    winRate: r.wins / r.total_battles,
    user: { id: r.user_id, username: r.username, stableName: r.stable_name, stableType: r.stable_type },
  }));

  const mostLifetimeDamageRobots = await prisma.robot.findMany({
    where: byeRobotFilter, orderBy: [{ damageDealtLifetime: 'desc' }, { id: 'asc' }], take: 10, include: robotUserInclude,
  });

  const highestEloRobots = await prisma.robot.findMany({
    where: byeRobotFilter, orderBy: [{ elo: 'desc' }, { id: 'asc' }], take: 10, include: robotUserInclude,
  });

  const mostKillsRobots = await prisma.robot.findMany({
    where: byeRobotFilter, orderBy: [{ kills: 'desc' }, { id: 'asc' }], take: 10, include: robotUserInclude,
  });

  // Lifetime damage and destructions cover every mode, so their per-battle
  // figures divide by the all-modes battle count. `totalBattles` leaves out
  // KotH and Grand Melee, which overstated both (a 373% "kill rate" on ACC).
  const allModesCounts = await getAllModesBattleCounts([...mostLifetimeDamageRobots, ...mostKillsRobots]);
  const perBattle = (value: number, robot: { id: number; totalBattles: number }, digits: number): number => {
    const battles = allModesCounts.get(robot.id) ?? robot.totalBattles;
    return battles > 0 ? Number((value / battles).toFixed(digits)) : 0;
  };

  return {
    mostBattles: mostBattlesRows.map(({ robot, allModesBattleCount }) => ({
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      // The ranked value: battles in every mode, from the ranking query.
      allModesBattleCount,
      // W/L/D and win rate stay on the win/loss modes (`totalBattles`).
      totalBattles: robot.totalBattles, wins: robot.wins, losses: robot.losses, draws: robot.draws,
      winRate: robot.totalBattles > 0 ? Number((robot.wins / robot.totalBattles * 100).toFixed(1)) : 0,
      elo: robot.elo,
    })),
    highestWinRate: robotsWithWinRate.map(robot => ({
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      totalBattles: robot.totalBattles, wins: robot.wins,
      winRate: Number((robot.winRate * 100).toFixed(1)),
      elo: robot.elo, league: robot.league,
    })),
    mostLifetimeDamage: mostLifetimeDamageRobots.map(robot => ({
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      damageDealt: robot.damageDealtLifetime, totalBattles: robot.totalBattles,
      allModesBattleCount: allModesCounts.get(robot.id) ?? robot.totalBattles,
      avgDamagePerBattle: perBattle(robot.damageDealtLifetime, robot, 0),
    })),
    highestElo: highestEloRobots.map(robot => ({
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      elo: robot.elo, wins: robot.wins, losses: robot.losses, draws: robot.draws,
    })),
    // `robots.kills` is the all-mode total (`robot_mode_kills` summed), KotH and
    // Grand Melee included.
    mostKills: mostKillsRobots.map(robot => ({
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      kills: robot.kills, totalBattles: robot.totalBattles,
      allModesBattleCount: allModesCounts.get(robot.id) ?? robot.totalBattles,
      killsPerBattle: perBattle(robot.kills, robot, 2),
    })),
  };
}

// ─── Economic Records ───────────────────────────────────────────────

export async function fetchEconomicRecords() {
  const robotUserInclude = { user: { select: userSelect } };

  const highestFameRobots = await prisma.robot.findMany({
    where: byeRobotFilter, orderBy: [{ fame: 'desc' }, { id: 'asc' }], take: 10, include: robotUserInclude,
  });

  // Generated bot stables never spend credits, so their balances only grow and
  // would crowd out the players (4 of the top 10 on ACC, Nov 2026). Automatons
  // do spend and stay ranked (Spec #55 decision 33).
  const richestStables = await prisma.user.findMany({
    where: { stableType: { not: 'generated' } },
    orderBy: [{ currency: 'desc' }, { id: 'asc' }], take: 10,
    select: {
      id: true, username: true, stableName: true, stableType: true, currency: true, prestige: true,
      robots: { where: byeRobotFilter, select: { id: true, name: true } },
    },
  });

  // `mostExpensiveBattle` removed (Nov 2026): it was always an empty list.
  return {
    highestFame: highestFameRobots.map(robot => ({
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      fame: robot.fame, elo: robot.elo,
    })),
    richestStables: richestStables.map(stable => ({
      ...getRecordOwner(stable), userId: stable.id,
      currency: stable.currency, prestige: stable.prestige, robotCount: stable.robots.length,
    })),
  };
}

// ─── Prestige Records ───────────────────────────────────────────────

export async function fetchPrestigeRecords() {
  const stableSelect = {
    id: true, username: true, stableName: true, stableType: true, prestige: true, championshipTitles: true,
    robots: { where: byeRobotFilter, select: { id: true, name: true } },
  };

  const highestPrestigeStables = await prisma.user.findMany({
    orderBy: [{ prestige: 'desc' }, { id: 'asc' }], take: 10, select: stableSelect,
  });

  const mostTitlesStables = await prisma.user.findMany({
    where: { championshipTitles: { gt: 0 } },
    orderBy: [{ championshipTitles: 'desc' }, { id: 'asc' }], take: 10, select: stableSelect,
  });

  return {
    highestPrestige: highestPrestigeStables.map(stable => ({
      ...getRecordOwner(stable), userId: stable.id,
      prestige: stable.prestige, championshipTitles: stable.championshipTitles, robotCount: stable.robots.length,
    })),
    mostTitles: mostTitlesStables.map(stable => ({
      ...getRecordOwner(stable), userId: stable.id,
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

/**
 * KotH robot standings with the highest average zone score per match, best
 * first, among robots with at least `KOTH_AVG_ZONE_SCORE_MIN_MATCHES` matches.
 *
 * Ranked in SQL on the average itself. It used to be ordered by the total zone
 * score, which made it the same list as Zone Dominator with a different number
 * printed beside each robot. Ties: more matches first, then the lower robot id.
 */
async function fetchTopKothAverageZoneScore(limit: number) {
  const ranked = await prisma.$queryRaw<Array<{ entity_id: number }>>`
    SELECT s.entity_id
    FROM standings s
    WHERE s.entity_type = 'robot'
      AND s.mode = 'koth'
      AND s.total_matches >= ${KOTH_AVG_ZONE_SCORE_MIN_MATCHES}
    ORDER BY COALESCE(s.total_zone_score, 0) / s.total_matches DESC, s.total_matches DESC, s.entity_id ASC
    LIMIT ${limit}
  `;
  if (ranked.length === 0) return [];
  const ids = ranked.map((row) => row.entity_id);
  const rows = await prisma.standing.findMany({
    where: { entityType: 'robot', mode: 'koth', entityId: { in: ids } },
  });
  const byId = new Map(rows.map((row) => [row.entityId, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
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
  const robotKoth = { ...kothFilter, entityType: 'robot' };
  const [mostWinsStandings, highestAvgZoneScoreStandings, mostKillsTallies, longestStreakStandings, mostZoneTimeStandings, zoneDominatorStandings] =
    await Promise.all([
      prisma.standing.findMany({ where: robotKoth, orderBy: [{ wins: 'desc' }, { entityId: 'asc' }], take: 10 }),
      fetchTopKothAverageZoneScore(10),
      getTopModeKills('koth', 10),
      prisma.standing.findMany({ where: robotKoth, orderBy: [{ bestWinStreak: 'desc' }, { entityId: 'asc' }], take: 10 }),
      prisma.standing.findMany({ where: robotKoth, orderBy: [{ totalZoneTime: { sort: 'desc', nulls: 'last' } }, { entityId: 'asc' }], take: 10 }),
      prisma.standing.findMany({ where: robotKoth, orderBy: [{ totalZoneScore: { sort: 'desc', nulls: 'last' } }, { entityId: 'asc' }], take: 10 }),
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
  const allStandings = [mostWinsStandings, highestAvgZoneScoreStandings, longestStreakStandings, mostZoneTimeStandings, zoneDominatorStandings];
  const allRobotIds = [...new Set([
    ...allStandings.flat().map(s => s.entityId),
    ...mostKillsTallies.map(k => k.robotId),
  ])];

  // Fetch robot details (name + user) in one query
  const robots = allRobotIds.length > 0
    ? await prisma.robot.findMany({
        where: { id: { in: allRobotIds } },
        select: robotNameSelect,
      })
    : [];
  const robotMap = new Map(robots.map(r => [r.id, r]));

  const mapStanding = (s: typeof mostWinsStandings[number]) => {
    const robot = robotMap.get(s.entityId);
    return {
      robotId: s.entityId,
      robotName: robot?.name ?? 'Unknown',
      ...getRecordOwner(robot?.user),
    };
  };

  return {
    mostWins: mostWinsStandings.map(s => ({
      ...mapStanding(s), kothWins: s.wins, kothMatches: s.totalMatches ?? 0,
      winRate: (s.totalMatches ?? 0) > 0 ? Number((s.wins / (s.totalMatches ?? 1) * 100).toFixed(1)) : 0,
    })),
    highestAvgZoneScore: highestAvgZoneScoreStandings.map(s => ({
      ...mapStanding(s),
      avgZoneScore: (s.totalMatches ?? 0) > 0 ? Number(((s.totalZoneScore ?? 0) / (s.totalMatches ?? 1)).toFixed(1)) : 0,
      kothMatches: s.totalMatches ?? 0,
    })),
    mostKillsCareer: mostKillsTallies.map(k => {
      const robot = robotMap.get(k.robotId);
      return {
        robotId: k.robotId,
        robotName: robot?.name ?? 'Unknown',
        ...getRecordOwner(robot?.user),
        kothKills: k.kills,
        kothMatches: killLeaderMatches.get(k.robotId) ?? 0,
      };
    }),
    longestWinStreak: longestStreakStandings.map(s => ({
      ...mapStanding(s), bestWinStreak: s.bestWinStreak, kothWins: s.wins,
      currentWinStreak: s.currentWinStreak,
      isActive: s.currentWinStreak > 0 && s.currentWinStreak === s.bestWinStreak,
    })),
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

interface TeamBattleDecisiveRow {
  battle_id: number;
  winning_side: number;
  hp_difference: number;
  created_at: Date;
}

/**
 * Team league records for one team size: only Most Decisive Victory remains.
 *
 * Removed in Nov 2026 because they ranked nothing:
 *   - Fastest Victory: the 3v3 top 10 all read 2 s, 2v2 3–4 s.
 *   - Longest Survival and Longest Non-Draw Battle: both pile up at the 300 s
 *     battle limit (252 2v2 survivals of 290 s or more on ACC).
 *   - Most Damage Dealt: the same query as Most Damage in One Battle for
 *     `league_2v2` / `league_3v3`, so it was a duplicate list.
 */
async function fetchTeamBattleRecordsForSize(battleType: 'league_2v2' | 'league_3v3') {
  // Most decisive victory: HP left on the winning side minus the losing side.
  const decisiveRows = await prisma.$queryRaw<TeamBattleDecisiveRow[]>`
    SELECT
      b.id AS battle_id,
      b.winning_side,
      (
        COALESCE(SUM(bp.final_hp) FILTER (WHERE bp.team = b.winning_side), 0) -
        COALESCE(SUM(bp.final_hp) FILTER (WHERE bp.team <> b.winning_side), 0)
      )::int AS hp_difference,
      b.created_at
    FROM battles b
    JOIN battle_participants bp ON bp.battle_id = b.id
    WHERE b.battle_type = ${battleType}
      AND b.winning_side IS NOT NULL
    GROUP BY b.id
    ORDER BY hp_difference DESC, b.id ASC
    LIMIT 10
  `;

  const decisiveBattleIds = decisiveRows.map(r => r.battle_id);
  const decisiveBattles = decisiveBattleIds.length > 0
    ? await prisma.battle.findMany({
        where: { id: { in: decisiveBattleIds } },
        omit: BATTLE_LOG_OMIT,
        include: battleWithParticipantsInclude,
      })
    : [];
  const decisiveBattleMap = new Map<number, BattleWithParticipants>(decisiveBattles.map(b => [b.id, b]));

  return {
    mostDecisiveVictory: decisiveRows.map(row => {
      const participants = decisiveBattleMap.get(row.battle_id)?.participants ?? [];
      return {
        battleId: row.battle_id,
        hpDifference: Number(row.hp_difference),
        winners: participants.filter(p => p.team === row.winning_side).map(mapParticipantDisplay),
        losers: participants.filter(p => p.team !== row.winning_side).map(mapParticipantDisplay),
        date: row.created_at,
      };
    }),
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
  /** The 1v1 champion robot's id (links to its profile); absent for team champions. */
  championRobotId?: number;
  ownerStableName: string;
  /** The owning stable's user id (links to `/stables/:id`); null when unknown. */
  ownerUserId: number | null;
  /** Spec #55 decision 42: Stable_Type of the owning stable (Automaton_Badge). */
  ownerStableType: StableType | null;
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

  // One query for all winners of this type (was one query per tournament).
  const winnerIds = [...new Set(tournaments.map((t) => t.winnerId!))];
  if (participantType === 'robot') {
    const robots = new Map((await prisma.robot.findMany({
      where: { id: { in: winnerIds } },
      select: robotNameSelect,
    })).map((r) => [r.id, r]));
    return tournaments.map((t) => {
      const robot = robots.get(t.winnerId!);
      return {
        tournamentId: t.id,
        tournamentName: t.name,
        championName: robot?.name ?? 'Unknown',
        ...(robot ? { championRobotId: robot.id } : {}),
        ownerStableName: robot?.user ? getUserDisplayName(robot.user) : 'Unknown',
        ownerUserId: robot?.user.id ?? null,
        ownerStableType: robot?.user.stableType ?? null,
        completedAt: t.completedAt!,
        participantType,
      };
    });
  }

  const teams = new Map((await prisma.teamBattle.findMany({
    where: { id: { in: winnerIds } },
    select: {
      id: true,
      teamName: true,
      members: { select: { robot: { select: { name: true } } }, orderBy: { slotIndex: 'asc' } },
      stable: { select: userSelect },
    },
  })).map((team) => [team.id, team]));
  return tournaments.map((t) => {
    const team = teams.get(t.winnerId!);
    return {
      tournamentId: t.id,
      tournamentName: t.name,
      championName: team?.teamName ?? 'Unknown',
      memberRobots: team?.members.map(m => m.robot.name) ?? [],
      ownerStableName: team?.stable ? getUserDisplayName(team.stable) : 'Unknown',
      ownerUserId: team?.stable.id ?? null,
      ownerStableType: team?.stable.stableType ?? null,
      completedAt: t.completedAt!,
      participantType,
    };
  });
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
  // Highest LP removed (Nov 2026): it was the top of the Grand Melee league
  // standings, which the League Standings page already ranks.
  const [mostWinsRobots, mostKillsTallies] = await Promise.all([
    prisma.robot.findMany({
      where: { grandMeleeWins: { gt: 0 } },
      orderBy: [{ grandMeleeWins: 'desc' }, { id: 'asc' }],
      take: 10,
      select: { id: true, name: true, grandMeleeWins: true, user: { select: userSelect } },
    }),
    getTopModeKills('grand_melee', 10),
  ]);

  // No data at all — return undefined
  if (mostWinsRobots.length === 0 && mostKillsTallies.length === 0) {
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

  // Batch-resolve the destruction leaders' names
  const allRobotIds = [...new Set(mostKillsTallies.map(k => k.robotId))];

  const robots = allRobotIds.length > 0
    ? await prisma.robot.findMany({
        where: { id: { in: allRobotIds } },
        select: robotNameSelect,
      })
    : [];
  const robotMap = new Map(robots.map(r => [r.id, r]));

  return {
    mostWins: mostWinsRobots.map(r => ({
      robotId: r.id,
      robotName: r.name,
      ...getRecordOwner(r.user),
      grandMeleeWins: r.grandMeleeWins,
    })),
    mostKillsCareer: mostKillsTallies.map(k => {
      const robot = robotMap.get(k.robotId);
      const matches = killLeaderMatches.get(k.robotId) ?? 0;
      return {
        robotId: k.robotId,
        robotName: robot?.name ?? 'Unknown',
        ...getRecordOwner(robot?.user),
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
  /** Spec #55 decision 42: Stable_Type of the owning stable (Automaton_Badge). */
  stableType: StableType | null;
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
        ...getRecordOwner(team?.stable ?? robot?.user),
        bestWinStreak: row.bestWinStreak,
        currentWinStreak: row.currentWinStreak,
        isActive: row.currentWinStreak === row.bestWinStreak,
        wins: row.wins,
      };
    });
  }

  return result;
}
