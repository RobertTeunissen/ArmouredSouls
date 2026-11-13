/**
 * Hall of Records queries for the mode-specific sections: King of the Hill,
 * team battles, tournament champions, Grand Melee and league win streaks.
 * The shared owner/participant helpers and the cross-mode sections (combat,
 * upsets, career, economic, prestige) live in `recordsQueryService`.
 *
 * @module services/records/modeRecordsQueries
 */

import prisma from '../../lib/prisma';
import { BATTLE_LOG_OMIT } from '../battle/battleLogCodec';
import { Prisma, type StableType, type Standing } from '../../../generated/prisma';
import { getTopModeKills } from '../battle/modeKillsQueries';
import {
  cutRanking,
  limitClause,
  placeField,
  topPlaced,
  type Placed,
  type PlayerSets,
} from './recordScope';
import {
  battleWithParticipantsInclude,
  getRecordOwner,
  getUserDisplayName,
  mapParticipantDisplay,
  robotNameSelect,
  topRobotsBy,
  userSelect,
  type BattleWithParticipants,
} from './recordsQueryService';
import type { WinStreakEntry, WinStreakMode } from '../../shared/types';

/**
 * Highest Avg Zone Score only ranks robots with at least this many KotH matches,
 * so one lucky match cannot top the list (the frontend states the same floor).
 */
const KOTH_AVG_ZONE_SCORE_MIN_MATCHES = 10;

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
async function fetchTopKothAverageZoneScore(limit: number | undefined) {
  const ranked = await prisma.$queryRaw<Array<{ entity_id: number }>>`
    SELECT s.entity_id
    FROM standings s
    WHERE s.entity_type = 'robot'
      AND s.mode = 'koth'
      AND s.total_matches >= ${KOTH_AVG_ZONE_SCORE_MIN_MATCHES}
    ORDER BY COALESCE(s.total_zone_score, 0) / s.total_matches DESC, s.total_matches DESC, s.entity_id ASC
    ${limitClause(limit)}
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

/** A robot-scoped standing (or kill tally) owned by a player stable. */
const isPlayerStanding = (row: { entityId: number }, sets: PlayerSets): boolean => sets.robotIds.has(row.entityId);
const isPlayerTally = (row: { robotId: number }, sets: PlayerSets): boolean => sets.robotIds.has(row.robotId);

export async function fetchKothRecords(players?: PlayerSets): Promise<Record<string, unknown> | undefined> {
  // Query standings for KotH records (source of truth since Spec #40).
  // Destructions are the exception — see getTopModeKills.
  const kothFilter = { mode: 'koth' as const, totalMatches: { gt: 0 } };

  // Spec #46 R4.3: Best Placement removed. Any robot that has ever won a KotH
  // match has a bestPlacement of 1, so the category ranked every winner as
  // joint first and carried no information.
  // Destructions are ranked from the per-mode tally; every other category still
  // ranks on a standings column.
  const robotKoth = { ...kothFilter, entityType: 'robot' };
  const standingsBy = (
    orderBy: Prisma.StandingOrderByWithRelationInput[],
    value: (row: Standing) => number,
  ) => topPlaced(
    (take) => prisma.standing.findMany({ where: robotKoth, orderBy, take }),
    value,
    isPlayerStanding,
    players,
  );
  const [mostWinsStandings, highestAvgZoneScoreStandings, mostKillsTallies, longestStreakStandings, mostZoneTimeStandings, zoneDominatorStandings] =
    await Promise.all([
      standingsBy([{ wins: 'desc' }, { entityId: 'asc' }], (s) => s.wins),
      topPlaced(
        (take) => fetchTopKothAverageZoneScore(take),
        (s) => (s.totalZoneScore ?? 0) / (s.totalMatches ?? 1),
        isPlayerStanding,
        players,
      ),
      topPlaced((take) => getTopModeKills('koth', take), (k) => k.kills, isPlayerTally, players),
      standingsBy([{ bestWinStreak: 'desc' }, { entityId: 'asc' }], (s) => s.bestWinStreak),
      standingsBy([{ totalZoneTime: { sort: 'desc', nulls: 'last' } }, { entityId: 'asc' }], (s) => s.totalZoneTime ?? -Infinity),
      standingsBy([{ totalZoneScore: { sort: 'desc', nulls: 'last' } }, { entityId: 'asc' }], (s) => s.totalZoneScore ?? -Infinity),
    ]);

  // Match counts for the destruction leaders, which the tally does not carry.
  const killLeaderMatches = new Map(
    (mostKillsTallies.length > 0
      ? await prisma.standing.findMany({
          where: { mode: 'koth', entityType: 'robot', entityId: { in: mostKillsTallies.map(({ row }) => row.robotId) } },
          select: { entityId: true, totalMatches: true },
        })
      : []
    ).map(s => [s.entityId, s.totalMatches ?? 0]),
  );

  // Collect all unique robot IDs across all categories
  const allStandings = [mostWinsStandings, highestAvgZoneScoreStandings, longestStreakStandings, mostZoneTimeStandings, zoneDominatorStandings];
  const allRobotIds = [...new Set([
    ...allStandings.flat().map(({ row }) => row.entityId),
    ...mostKillsTallies.map(({ row }) => row.robotId),
  ])];

  // Fetch robot details (name + user) in one query
  const robots = allRobotIds.length > 0
    ? await prisma.robot.findMany({
        where: { id: { in: allRobotIds } },
        select: robotNameSelect,
      })
    : [];
  const robotMap = new Map(robots.map(r => [r.id, r]));

  const mapStanding = ({ row: s, place }: Placed<Standing>) => {
    const robot = robotMap.get(s.entityId);
    return {
      ...placeField(place),
      robotId: s.entityId,
      robotName: robot?.name ?? 'Unknown',
      ...getRecordOwner(robot?.user),
    };
  };

  return {
    mostWins: mostWinsStandings.map((entry) => {
      const s = entry.row;
      return {
        ...mapStanding(entry), kothWins: s.wins, kothMatches: s.totalMatches ?? 0,
        winRate: (s.totalMatches ?? 0) > 0 ? Number((s.wins / (s.totalMatches ?? 1) * 100).toFixed(1)) : 0,
      };
    }),
    highestAvgZoneScore: highestAvgZoneScoreStandings.map((entry) => {
      const s = entry.row;
      return {
        ...mapStanding(entry),
        avgZoneScore: (s.totalMatches ?? 0) > 0 ? Number(((s.totalZoneScore ?? 0) / (s.totalMatches ?? 1)).toFixed(1)) : 0,
        kothMatches: s.totalMatches ?? 0,
      };
    }),
    mostKillsCareer: mostKillsTallies.map(({ row: k, place }) => {
      const robot = robotMap.get(k.robotId);
      return {
        ...placeField(place),
        robotId: k.robotId,
        robotName: robot?.name ?? 'Unknown',
        ...getRecordOwner(robot?.user),
        kothKills: k.kills,
        kothMatches: killLeaderMatches.get(k.robotId) ?? 0,
      };
    }),
    longestWinStreak: longestStreakStandings.map((entry) => {
      const s = entry.row;
      return {
        ...mapStanding(entry), bestWinStreak: s.bestWinStreak, kothWins: s.wins,
        currentWinStreak: s.currentWinStreak,
        isActive: s.currentWinStreak > 0 && s.currentWinStreak === s.bestWinStreak,
      };
    }),
    mostZoneTime: mostZoneTimeStandings.map((entry) => ({
      ...mapStanding(entry),
      totalZoneTime: roundToZonePrecision(entry.row.totalZoneTime ?? 0),
      kothMatches: entry.row.totalMatches ?? 0,
    })),
    zoneDominator: zoneDominatorStandings.map((entry) => ({
      ...mapStanding(entry),
      totalZoneScore: roundToZonePrecision(entry.row.totalZoneScore ?? 0),
      kothMatches: entry.row.totalMatches ?? 0,
    })),
  };
}

// ─── Team Battle Records ────────────────────────────────────────────

interface TeamBattleDecisiveRow {
  /** The battle id. */
  tiebreak: number;
  winning_side: number;
  /** HP margin. */
  rank_value: number;
  created_at: Date;
  place?: number;
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
async function fetchTeamBattleRecordsForSize(battleType: 'league_2v2' | 'league_3v3', players?: PlayerSets) {
  // Most decisive victory: HP left on the winning side minus the losing side.
  // The winning side holds it; a side is one stable's team.
  const decisiveRows = await prisma.$queryRaw<TeamBattleDecisiveRow[]>(cutRanking(Prisma.sql`
    SELECT
      b.id AS tiebreak,
      b.winning_side,
      (
        COALESCE(SUM(bp.final_hp) FILTER (WHERE bp.team = b.winning_side), 0) -
        COALESCE(SUM(bp.final_hp) FILTER (WHERE bp.team <> b.winning_side), 0)
      )::int AS rank_value,
      b.created_at,
      MIN(r.user_id) FILTER (WHERE bp.team = b.winning_side) AS owner_user_id
    FROM battles b
    JOIN battle_participants bp ON bp.battle_id = b.id
    JOIN robots r ON r.id = bp.robot_id
    WHERE b.battle_type = ${battleType}
      AND b.winning_side IS NOT NULL
    GROUP BY b.id
  `, players));

  const decisiveBattleIds = decisiveRows.map(r => r.tiebreak);
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
      const participants = decisiveBattleMap.get(row.tiebreak)?.participants ?? [];
      return {
        ...placeField(row.place),
        battleId: row.tiebreak,
        hpDifference: Number(row.rank_value),
        winners: participants.filter(p => p.team === row.winning_side).map(mapParticipantDisplay),
        losers: participants.filter(p => p.team !== row.winning_side).map(mapParticipantDisplay),
        date: row.created_at,
      };
    }),
  };
}

export async function fetchTeamBattleRecords(players?: PlayerSets) {
  const [records2v2, records3v3] = await Promise.all([
    fetchTeamBattleRecordsForSize('league_2v2', players),
    fetchTeamBattleRecordsForSize('league_3v3', players),
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

async function fetchChampionsByType(participantType: string, players?: PlayerSets): Promise<TournamentChampionEntry[]> {
  // Players: the latest tournaments a player's robot (1v1) or team won. The
  // log is not a ranking, so its entries carry no place.
  const playerWinners = players ? (participantType === 'robot' ? players.robotIds : players.teamIds) : undefined;
  const tournaments = await prisma.tournament.findMany({
    where: {
      participantType, status: 'completed',
      winnerId: playerWinners ? { in: [...playerWinners] } : { not: null },
    },
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

export async function fetchTournamentChampions(players?: PlayerSets): Promise<{
  champions1v1: TournamentChampionEntry[];
  champions2v2: TournamentChampionEntry[];
  champions3v3: TournamentChampionEntry[];
}> {
  const [champions1v1, champions2v2, champions3v3] = await Promise.all([
    fetchChampionsByType('robot', players),
    fetchChampionsByType('team_2v2', players),
    fetchChampionsByType('team_3v3', players),
  ]);

  return { champions1v1, champions2v2, champions3v3 };
}

// ─── Grand Melee Records ────────────────────────────────────────────

export async function fetchGrandMeleeRecords(players?: PlayerSets): Promise<Record<string, unknown> | undefined> {
  // Highest LP removed (Nov 2026): it was the top of the Grand Melee league
  // standings, which the League Standings page already ranks.
  const [mostWinsRobots, mostKillsTallies] = await Promise.all([
    topRobotsBy('grandMeleeWins', players, { grandMeleeWins: { gt: 0 } }),
    topPlaced((take) => getTopModeKills('grand_melee', take), (k) => k.kills, isPlayerTally, players),
  ]);

  // No data at all — return undefined
  if (mostWinsRobots.length === 0 && mostKillsTallies.length === 0) {
    return undefined;
  }

  // Match counts for the destruction leaders, which the tally does not carry.
  const killLeaderMatches = new Map(
    (mostKillsTallies.length > 0
      ? await prisma.standing.findMany({
          where: { mode: 'grand_melee', entityType: 'robot', entityId: { in: mostKillsTallies.map(({ row }) => row.robotId) } },
          select: { entityId: true, totalMatches: true },
        })
      : []
    ).map(s => [s.entityId, s.totalMatches ?? 0]),
  );

  // Batch-resolve the destruction leaders' names
  const allRobotIds = [...new Set(mostKillsTallies.map(({ row }) => row.robotId))];

  const robots = allRobotIds.length > 0
    ? await prisma.robot.findMany({
        where: { id: { in: allRobotIds } },
        select: robotNameSelect,
      })
    : [];
  const robotMap = new Map(robots.map(r => [r.id, r]));

  return {
    mostWins: mostWinsRobots.map(({ robot: r, place }) => ({
      ...placeField(place),
      robotId: r.id,
      robotName: r.name,
      ...getRecordOwner(r.user),
      grandMeleeWins: r.grandMeleeWins,
    })),
    mostKillsCareer: mostKillsTallies.map(({ row: k, place }) => {
      const robot = robotMap.get(k.robotId);
      const matches = killLeaderMatches.get(k.robotId) ?? 0;
      return {
        ...placeField(place),
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
export const WIN_STREAK_MODES = ['league_1v1', 'league_2v2', 'league_3v3', 'tag_team'] as const satisfies readonly WinStreakMode[];

/** Modes whose `standings.entity_id` references a `TeamBattle` rather than a `Robot`. */
const TEAM_STREAK_MODES = new Set<string>(['league_2v2', 'league_3v3', 'tag_team']);

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
export async function fetchWinStreakRecords(players?: PlayerSets): Promise<Record<WinStreakMode, WinStreakEntry[]>> {
  const standingsByMode = await Promise.all(
    WIN_STREAK_MODES.map(async (mode) => {
      const isTeamMode = TEAM_STREAK_MODES.has(mode);
      const rows = await topPlaced(
        (take) => prisma.standing.findMany({
          where: { mode, bestWinStreak: { gt: 0 } },
          // entityId ascending is the deterministic tiebreak, so equal streaks
          // always render in the same order across requests and cache refreshes.
          orderBy: [{ bestWinStreak: 'desc' }, { entityId: 'asc' }],
          take,
        }),
        (row) => row.bestWinStreak,
        (row, sets) => (isTeamMode ? sets.teamIds : sets.robotIds).has(row.entityId),
        players,
      );
      return [mode, rows] as const;
    }),
  );

  const robotIds = new Set<number>();
  const teamIds = new Set<number>();
  for (const [mode, rows] of standingsByMode) {
    for (const { row } of rows) {
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
    result[mode] = rows.map(({ row, place }) => {
      const isTeamMode = TEAM_STREAK_MODES.has(mode);
      const team = isTeamMode ? teamMap.get(row.entityId) : undefined;
      const robot = isTeamMode ? undefined : robotMap.get(row.entityId);
      return {
        ...placeField(place),
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
