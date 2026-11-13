import prisma from '../../lib/prisma';
import { BATTLE_LOG_OMIT } from '../battle/battleLogCodec';
import { Prisma, type StableType } from '../../../generated/prisma';
import {
  cutRanking,
  inIdOrder,
  limitClause,
  placeField,
  RECORD_LIST_SIZE,
  topPlaced,
  type Placed,
  type PlayerSets,
} from './recordScope';
import { getAllModesBattleCounts, getTopRobotsByAllModesBattleCount } from '../robot/all-modes-battle-count';

/** Highest Win Rate only ranks robots with at least this many win/loss-mode battles. */
export const WIN_RATE_MIN_BATTLES = 50;


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
export const byeRobotFilter = {};

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

export interface BattleWithParticipants {
  id: number;
  winnerId: number | null;
  durationSeconds: number;
  battleType: string;
  createdAt: Date;
  participants: ParticipantWithRobot[];
}

// `getWinnerAndLoser()` was removed with Spec #46 R4.1/R4.2 — its only callers
// were the Longest Battle and Fastest Victory mappers.

export function mapParticipantDisplay(p: ParticipantWithRobot) {
  return { id: p.robot.id, name: p.robot.name, ...getRecordOwner(p.robot.user) };
}

/** A robot as a record names it: id, name and owning stable. Never the full robot row. */
export const robotNameSelect = { id: true, name: true, user: { select: userSelect } } as const;

// Standard include for battle queries using participants
export const battleWithParticipantsInclude = {
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

/** Players' Most Damage entries in one mode: participant ids with their place among all. */
async function playerDamagePlaces(battleType: DamageRecordMode, players: PlayerSets): Promise<Map<number, number>> {
  const rows = await prisma.$queryRaw<Array<{ tiebreak: number; place: number }>>(cutRanking(Prisma.sql`
    SELECT bp.id AS tiebreak, bp.damage_dealt AS rank_value, r.user_id AS owner_user_id
    FROM battle_participants bp
    JOIN battles b ON b.id = bp.battle_id
    JOIN robots r ON r.id = bp.robot_id
    WHERE b.battle_type = ${battleType}
  `, players));
  return new Map(rows.map((row) => [row.tiebreak, row.place]));
}

async function fetchMostDamageForMode(battleType: DamageRecordMode, players?: PlayerSets) {
  const namesOpponent = SINGLE_OPPONENT_MODES.has(battleType);
  const places = players ? await playerDamagePlaces(battleType, players) : undefined;
  // Narrow selects: this used to `include` the whole battle, combat log
  // (`battle_log_zst`, ~1.6 MB for the Grand Melee top 10 on ACC) and every
  // participant's full robot row, for six modes on every records build.
  const rows = await prisma.battleParticipant.findMany({
    where: places ? { id: { in: [...places.keys()] } } : { battle: { battleType } },
    orderBy: [{ damageDealt: 'desc' }, { id: 'asc' }],
    take: RECORD_LIST_SIZE,
    select: {
      id: true,
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
      ...placeField(places?.get(participant.id)),
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

export async function fetchCombatRecords(players?: PlayerSets) {
  // Spec #46 R4.1/R4.2: Longest Battle and Fastest Victory removed. Every
  // league battle that reaches the MAX_BATTLE_DURATION cap forces a draw at the
  // same duration, so Longest Battle reported an identical 2:00 for every entry
  // and any duration-derived replacement inherits the same ceiling.

  // Most Damage in Single Battle, scoped per mode (R4.5)
  const damageByModeEntries = await Promise.all(
    DAMAGE_RECORD_MODES.map(async (mode) => [mode, await fetchMostDamageForMode(mode, players)] as const),
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

export async function fetchUpsetRecords(players?: PlayerSets) {
  // Spec #46 R4.6: tournament modes only. League matchmaking scores on LP and
  // scopes to a tier instance, so it deliberately pairs robots of comparable
  // standing — a "biggest upset" drawn from league battles is measuring the
  // matchmaker's tolerance, not an underdog result. Tournament brackets are
  // seeded, so a low-seed win against a high seed is a genuine upset.
  // The underdog (the winner) holds the record.
  const upsetRows = await prisma.$queryRaw<Array<{ tiebreak: number; rank_value: number; place?: number }>>(cutRanking(Prisma.sql`
    SELECT
      w."battle_id" AS tiebreak,
      (l."elo_before" - w."elo_before") AS rank_value,
      r."user_id" AS owner_user_id
    FROM "battle_participants" w
    JOIN "battle_participants" l ON w."battle_id" = l."battle_id" AND w."robot_id" != l."robot_id"
    JOIN "battles" b ON b.id = w."battle_id"
    JOIN "robots" r ON r.id = w."robot_id"
    WHERE b."winner_id" = w."robot_id"
      AND w."elo_before" < l."elo_before"
      AND b."battle_type" = 'tournament_1v1'
  `, players));

  const upsetBattleIds = upsetRows.map(u => u.tiebreak);
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
      const battle = upsetBattleMap.get(upset.tiebreak);
      if (!battle) return null;
      const winner = battle.participants.find(p => p.robotId === battle.winnerId);
      const loser = battle.participants.find(p => p.robotId !== battle.winnerId);
      if (!winner || !loser) return null;
      return {
        ...placeField(upset.place),
        battleId: battle.id,
        eloDifference: Number(upset.rank_value),
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
  // A side is one stable's team, so its owner is any of its robots' stable.
  const teamUpsetRows = await prisma.$queryRaw<
    Array<{ tiebreak: number; rank_value: number; winning_team: number; battle_type: string; created_at: Date; place?: number }>
  >(cutRanking(Prisma.sql`
    WITH team_elo AS (
      SELECT
        bp."battle_id",
        bp."team",
        SUM(bp."elo_before")::float AS team_elo_before,
        MIN(r."user_id") AS owner_user_id
      FROM "battle_participants" bp
      JOIN "battles" b ON b.id = bp."battle_id"
      JOIN "robots" r ON r.id = bp."robot_id"
      WHERE b."battle_type" IN ('tournament_2v2', 'tournament_3v3')
      GROUP BY bp."battle_id", bp."team"
    )
    SELECT
      w."battle_id" AS tiebreak,
      (l.team_elo_before - w.team_elo_before) AS rank_value,
      w.owner_user_id,
      w."team" AS winning_team,
      b."battle_type",
      b."created_at"
    FROM team_elo w
    JOIN team_elo l ON w."battle_id" = l."battle_id" AND w."team" != l."team"
    JOIN "battles" b ON b.id = w."battle_id"
    WHERE b."winning_side" = w."team"
      AND w.team_elo_before < l.team_elo_before
  `, players));

  const teamUpsetBattleIds = teamUpsetRows.map(r => r.tiebreak);
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
      const battle = teamUpsetBattleMap.get(row.tiebreak);
      if (!battle) return null;
      const underdogSide = battle.participants.filter(p => p.team === row.winning_team);
      const favoriteSide = battle.participants.filter(p => p.team !== row.winning_team);
      if (underdogSide.length === 0 || favoriteSide.length === 0) return null;
      const sumElo = (side: typeof underdogSide) => side.reduce((acc, p) => acc + p.eloBefore, 0);
      return {
        ...placeField(row.place),
        battleId: battle.id,
        battleType: row.battle_type,
        eloDifference: Number(row.rank_value),
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

/** A robot counter a record ranks on (highest first, lower id first on ties). */
type RobotCounter = 'elo' | 'kills' | 'damageDealtLifetime' | 'fame' | 'grandMeleeWins';

const robotCounterSelect = {
  id: true, elo: true, kills: true, damageDealtLifetime: true, fame: true, grandMeleeWins: true,
} as const;

/**
 * Robots ranked on one counter, each with its owner: the top 10, or the
 * players' top 10 with their places (#595). `where` narrows the ranking.
 */
export async function topRobotsBy(counter: RobotCounter, players?: PlayerSets, where: Prisma.RobotWhereInput = {}) {
  const orderBy = [{ [counter]: 'desc' } as Prisma.RobotOrderByWithRelationInput, { id: 'asc' as const }];
  const ranked = await topPlaced(
    (take) => prisma.robot.findMany({ where, orderBy, take, select: robotCounterSelect }),
    (row) => row[counter],
    (row, sets) => sets.robotIds.has(row.id),
    players,
  );
  const ids = ranked.map(({ row }) => row.id);
  const places = new Map(ranked.map(({ row, place }) => [row.id, place]));
  const robots = ids.length > 0
    ? await prisma.robot.findMany({ where: { id: { in: ids } }, include: { user: { select: userSelect } } })
    : [];
  return inIdOrder(ids, robots).map((robot) => ({ robot, place: places.get(robot.id) }));
}

export async function fetchCareerRecords(players?: PlayerSets) {
  // Most Battles ranks on the all-modes count (a battle is a battle: KotH and
  // Grand Melee matches count too). The ranking query returns the count it
  // ranked on, so the displayed value and the rank come from one read; the
  // robot load only adds name, owner and W/L/D. Two queries, no N+1.
  const mostBattlesRanked = await topPlaced(
    (take) => getTopRobotsByAllModesBattleCount(take),
    (entry) => entry.allModesBattleCount,
    (entry, sets) => sets.robotIds.has(entry.robotId),
    players,
  );
  const mostBattlesById = new Map(
    (await prisma.robot.findMany({
      where: { id: { in: mostBattlesRanked.map(({ row }) => row.robotId) } },
      include: { user: { select: userSelect } },
    })).map((robot) => [robot.id, robot]),
  );
  const mostBattlesRows = mostBattlesRanked.flatMap(({ row: { robotId, allModesBattleCount }, place }) => {
    const robot = mostBattlesById.get(robotId);
    return robot ? [{ robot, allModesBattleCount, place }] : [];
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
  const winRateRanked: Array<Placed<WinRateRow>> = await topPlaced(
    (take) => prisma.$queryRaw<WinRateRow[]>`
      SELECT r.id, r.name, r.wins, r."total_battles", r.elo,
             s."tier",
             u.id AS user_id, u.username, u."stable_name", u."stable_type"::text AS stable_type
      FROM "robots" r
      JOIN "users" u ON u.id = r."user_id"
      LEFT JOIN "standings" s ON s."entity_type" = 'robot' AND s."entity_id" = r.id AND s."mode" = 'league_1v1'
      WHERE r."total_battles" >= ${WIN_RATE_MIN_BATTLES}
      ORDER BY (r.wins::float / r."total_battles") DESC, r."total_battles" DESC, r.id ASC
      ${limitClause(take)}
    `,
    (row) => row.wins / row.total_battles,
    (row, sets) => sets.userIds.has(row.user_id),
    players,
  );
  const robotsWithWinRate = winRateRanked.map(({ row: r, place }) => ({
    id: r.id, name: r.name, wins: r.wins, totalBattles: r.total_battles,
    elo: r.elo, league: r.tier ?? 'bronze',
    winRate: r.wins / r.total_battles,
    user: { id: r.user_id, username: r.username, stableName: r.stable_name, stableType: r.stable_type },
    place,
  }));

  const [mostLifetimeDamageRobots, highestEloRobots, mostKillsRobots] = await Promise.all([
    topRobotsBy('damageDealtLifetime', players),
    topRobotsBy('elo', players),
    topRobotsBy('kills', players),
  ]);

  // Lifetime damage and destructions cover every mode, so their per-battle
  // figures divide by the all-modes battle count. `totalBattles` leaves out
  // KotH and Grand Melee, which overstated both (a 373% "kill rate" on ACC).
  const allModesCounts = await getAllModesBattleCounts(
    [...mostLifetimeDamageRobots, ...mostKillsRobots].map(({ robot }) => robot),
  );
  const perBattle = (value: number, robot: { id: number; totalBattles: number }, digits: number): number => {
    const battles = allModesCounts.get(robot.id) ?? robot.totalBattles;
    return battles > 0 ? Number((value / battles).toFixed(digits)) : 0;
  };

  return {
    mostBattles: mostBattlesRows.map(({ robot, allModesBattleCount, place }) => ({
      ...placeField(place),
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      // The ranked value: battles in every mode, from the ranking query.
      allModesBattleCount,
      // W/L/D and win rate stay on the win/loss modes (`totalBattles`).
      totalBattles: robot.totalBattles, wins: robot.wins, losses: robot.losses, draws: robot.draws,
      winRate: robot.totalBattles > 0 ? Number((robot.wins / robot.totalBattles * 100).toFixed(1)) : 0,
      elo: robot.elo,
    })),
    highestWinRate: robotsWithWinRate.map(robot => ({
      ...placeField(robot.place),
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      totalBattles: robot.totalBattles, wins: robot.wins,
      winRate: Number((robot.winRate * 100).toFixed(1)),
      elo: robot.elo, league: robot.league,
    })),
    mostLifetimeDamage: mostLifetimeDamageRobots.map(({ robot, place }) => ({
      ...placeField(place),
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      damageDealt: robot.damageDealtLifetime, totalBattles: robot.totalBattles,
      allModesBattleCount: allModesCounts.get(robot.id) ?? robot.totalBattles,
      avgDamagePerBattle: perBattle(robot.damageDealtLifetime, robot, 0),
    })),
    highestElo: highestEloRobots.map(({ robot, place }) => ({
      ...placeField(place),
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      elo: robot.elo, wins: robot.wins, losses: robot.losses, draws: robot.draws,
    })),
    // `robots.kills` is the all-mode total (`robot_mode_kills` summed), KotH and
    // Grand Melee included.
    mostKills: mostKillsRobots.map(({ robot, place }) => ({
      ...placeField(place),
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      kills: robot.kills, totalBattles: robot.totalBattles,
      allModesBattleCount: allModesCounts.get(robot.id) ?? robot.totalBattles,
      killsPerBattle: perBattle(robot.kills, robot, 2),
    })),
  };
}

// ─── Stable rankings (economic and prestige records) ────────────────

/** A stable counter a record ranks on (highest first, lower id first on ties). */
type StableCounter = 'prestige' | 'championshipTitles' | 'currency';

const stableRecordSelect = {
  id: true, username: true, stableName: true, stableType: true,
  currency: true, prestige: true, championshipTitles: true,
  robots: { where: byeRobotFilter, select: { id: true, name: true } },
} as const;

/**
 * Stables ranked on one counter: the top 10, or the players' top 10 with their
 * places (#595). `where` narrows the ranking.
 */
async function topStablesBy(counter: StableCounter, players: PlayerSets | undefined, where: Prisma.UserWhereInput = {}) {
  const orderBy = [{ [counter]: 'desc' } as Prisma.UserOrderByWithRelationInput, { id: 'asc' as const }];
  const ranked = await topPlaced(
    (take) => prisma.user.findMany({
      where, orderBy, take, select: { id: true, prestige: true, championshipTitles: true, currency: true },
    }),
    (row) => row[counter],
    (row, sets) => sets.userIds.has(row.id),
    players,
  );
  const ids = ranked.map(({ row }) => row.id);
  const places = new Map(ranked.map(({ row, place }) => [row.id, place]));
  const stables = ids.length > 0
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: stableRecordSelect })
    : [];
  return inIdOrder(ids, stables).map((stable) => ({ stable, place: places.get(stable.id) }));
}

// ─── Economic Records ───────────────────────────────────────────────

export async function fetchEconomicRecords(players?: PlayerSets) {
  // Generated bot stables never spend credits, so their balances only grow and
  // would crowd out the players (4 of the top 10 on ACC, Nov 2026). Automatons
  // do spend and stay ranked (Spec #55 decision 33).
  const [highestFameRobots, richestStables] = await Promise.all([
    topRobotsBy('fame', players),
    topStablesBy('currency', players, { stableType: { not: 'generated' } }),
  ]);

  // `mostExpensiveBattle` removed (Nov 2026): it was always an empty list.
  return {
    highestFame: highestFameRobots.map(({ robot, place }) => ({
      ...placeField(place),
      robotId: robot.id, robotName: robot.name, ...getRecordOwner(robot.user),
      fame: robot.fame, elo: robot.elo,
    })),
    richestStables: richestStables.map(({ stable, place }) => ({
      ...placeField(place),
      ...getRecordOwner(stable), userId: stable.id,
      currency: stable.currency, prestige: stable.prestige, robotCount: stable.robots.length,
    })),
  };
}

// ─── Prestige Records ───────────────────────────────────────────────

export async function fetchPrestigeRecords(players?: PlayerSets) {
  const [highestPrestigeStables, mostTitlesStables] = await Promise.all([
    topStablesBy('prestige', players),
    topStablesBy('championshipTitles', players, { championshipTitles: { gt: 0 } }),
  ]);

  return {
    highestPrestige: highestPrestigeStables.map(({ stable, place }) => ({
      ...placeField(place),
      ...getRecordOwner(stable), userId: stable.id,
      prestige: stable.prestige, championshipTitles: stable.championshipTitles, robotCount: stable.robots.length,
    })),
    mostTitles: mostTitlesStables.map(({ stable, place }) => ({
      ...placeField(place),
      ...getRecordOwner(stable), userId: stable.id,
      championshipTitles: stable.championshipTitles, prestige: stable.prestige, robotCount: stable.robots.length,
    })),
  };
}

