/**
 * Paginated battle history for a stable's robots and teams, one formatted entry
 * per battle (league, tournament, KotH, team modes).
 */
import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import type { KothPlacement } from '../../types';
import { BATTLE_LOG_OMIT, BATTLE_LOG_SELECT, decodeBattleLog } from '../battle/battleLogCodec';
import { getAwardedByeReward } from './byeDisplayService';

// ─── Prisma Payload Types ────────────────────────────────────────────

type BattleWithFullRelations = Prisma.BattleGetPayload<{
  omit: typeof BATTLE_LOG_OMIT;
  include: {
    participants: {
      include: { robot: { include: { user: { select: { id: true; username: true; stableName: true } } } } };
    };
    tournament: { select: { id: true; name: true; maxRounds: true } };
  };
}>;


// ─── Match History ───────────────────────────────────────────────────

export interface HistoryParams {
  page: number;
  perPage: number;
  robotId?: number;
  battleType?: string;
  userId: number;
}

/**
 * Combat-event fields the player battle report never sends: they exist for the
 * admin Battles page (`/api/admin/battles/:id/log`), which reads the stored log
 * directly. Summaries already carry the derived "expected chance" statistics.
 */
export const PLAYER_LOG_HIDDEN_FIELDS: ReadonlySet<string> = new Set(['formulaBreakdown', 'rangePenalty', 'attackAngle']);

/**
 * Fetch paginated battle history with optional robot/type filters.
 * Returns the exact response shape expected by the frontend.
 */
export async function getMatchHistory(params: HistoryParams) {
  const { page, perPage, robotId, battleType, userId } = params;

  const userRobots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
  });
  const userRobotIds = userRobots.map(r => r.id);
  const targetRobotIds = robotId !== undefined ? [robotId] : userRobotIds;

  const whereClause: Prisma.BattleWhereInput = {};

  // Map frontend filter names to database battleType values
  const BATTLE_TYPE_FILTER_MAP: Record<string, string> = {
    league: 'league_1v1',
    tournament: 'tournament_1v1',
    tournament_2v2: 'tournament_2v2',
    tournament_3v3: 'tournament_3v3',
    tag_team: 'tag_team',
    koth: 'koth',
    grand_melee: 'grand_melee',
    league_2v2: 'league_2v2',
    league_3v3: 'league_3v3',
  };

  if (battleType && Object.hasOwn(BATTLE_TYPE_FILTER_MAP, battleType)) {
    whereClause.battleType = BATTLE_TYPE_FILTER_MAP[battleType];
  }

  // Always use BattleParticipant to find the user's battles — works for all modes
  whereClause.participants = { some: { robotId: { in: targetRobotIds } } };

  const [total, battles] = await Promise.all([
    prisma.battle.count({ where: whereClause }),
    prisma.battle.findMany({
      where: whereClause,
      // The history list never reads the combat log (up to ~1 MB compressed per Grand Melee).
      omit: BATTLE_LOG_OMIT,
      include: {
        participants: {
          include: { robot: { include: { user: { select: { id: true, username: true, stableName: true } } } } },
        },
        tournament: { select: { id: true, name: true, maxRounds: true } },
        summary: { select: { kothPlacements: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  const battleIds = battles.map(battle => battle.id);
  const [unifiedByeRows, tournamentByeRows, tournamentForfeitRows] = battleIds.length === 0
    ? [[], [], []]
    : await Promise.all([
        prisma.scheduledMatch.findMany({
          where: { battleId: { in: battleIds }, isByeMatch: true },
          select: { battleId: true, isByeMatch: true },
        }),
        prisma.scheduledTournamentMatch.findMany({
          where: { battleId: { in: battleIds }, isByeMatch: true },
          select: { battleId: true, isByeMatch: true },
        }),
        // A team-tournament forfeit whose forfeiting team was deleted has no
        // `forfeited` participant row; the bracket row is the proper column.
        prisma.scheduledTournamentMatch.findMany({
          where: { battleId: { in: battleIds }, status: 'forfeit' },
          select: { battleId: true },
        }),
      ]);
  const byeMarkers = new Map<number, boolean>();
  for (const row of [...unifiedByeRows, ...tournamentByeRows]) {
    if (row.battleId !== null) byeMarkers.set(row.battleId, row.isByeMatch === true);
  }

  const forfeitTournamentBattleIds = new Set(
    tournamentForfeitRows.map(row => row.battleId).filter((id): id is number => id !== null),
  );

  const formattedBattles = await Promise.all(
    battles.map(battle => formatBattleHistoryEntry(
      battle,
      targetRobotIds,
      byeMarkers.get(battle.id) === true,
      forfeitTournamentBattleIds.has(battle.id),
    )),
  );

  return {
    data: formattedBattles,
    pagination: {
      page,
      pageSize: perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
}

/**
 * The only forfeit classifier (design §2). Reads participants and the
 * tournament bracket status — never the best-effort summary or `battle_log`.
 *
 * A two-sided battle with any forfeiter was never fought (forfeits always write
 * their own battle). A placement battle (KotH, Grand Melee) is forfeit-only when
 * everyone in it forfeited; a fought placement battle with some forfeiters is a
 * normal battle whose forfeiters are tagged in `forfeitedRobotIds`.
 */
export function classifyForfeit(
  battleType: string,
  participants: ReadonlyArray<{ robotId: number; forfeited: boolean }>,
  isForfeitTournamentBattle: boolean,
): { isForfeit: boolean; forfeitedRobotIds: number[] } {
  const forfeitedRobotIds = participants.filter(p => p.forfeited).map(p => p.robotId);
  const isPlacement = battleType === 'koth' || battleType === 'grand_melee';
  const isForfeit = isForfeitTournamentBattle || (
    forfeitedRobotIds.length > 0 && (!isPlacement || forfeitedRobotIds.length === participants.length)
  );
  return { isForfeit, forfeitedRobotIds };
}

export async function formatBattleHistoryEntry(
  battle: BattleWithFullRelations,
  targetRobotIds: number[],
  isByeMatch = false,
  isForfeitTournamentBattle = false,
) {
  // Derive legacy robot1/robot2 from participants by team.
  // These are kept for backward compatibility — new frontend code uses the participants array.
  const isFFA = battle.battleType === 'koth' || battle.battleType === 'grand_melee';
  const team1Participants = battle.participants.filter(p => p.team === 1);
  const team2Participants = battle.participants.filter(p => p.team === 2);
  const userParticipant = battle.participants.find((p) => targetRobotIds.includes(p.robotId));

  let robot1Part: (typeof battle.participants)[number] | undefined, robot2Part: (typeof battle.participants)[number] | undefined;
  if (isByeMatch) {
    // Bye records contain only the real side. Never manufacture an opponent or
    // infer the marker from the transient battle log.
    robot1Part = userParticipant ?? team1Participants[0] ?? team2Participants[0];
    robot2Part = undefined;
  } else if (isFFA) {
    // FFA: user's robot as robot1, winner (or first other) as robot2
    robot1Part = userParticipant ?? team1Participants[0];
    robot2Part = battle.participants.find(p => p.robotId === battle.winnerId && p.robotId !== robot1Part?.robotId) ?? team1Participants.find(p => p.robotId !== robot1Part?.robotId);
  } else {
    robot1Part = team1Participants.find(p => p.role === 'active' || p.role === null || p.role === 'solo') ?? team1Participants[0];
    robot2Part = team2Participants.find(p => p.role === 'active' || p.role === null || p.role === 'solo') ?? team2Participants[0];
  }
  const robot1 = robot1Part?.robot;
  const robot2 = robot2Part?.robot;
  const robot1Id = robot1Part?.robotId ?? 0;
  const robot2Id = isByeMatch ? robot2Part?.robotId ?? null : robot2Part?.robotId ?? 0;

  const byeReward = isByeMatch
    ? await getAwardedByeReward(battle.id, targetRobotIds)
    : null;

  const { isForfeit, forfeitedRobotIds } = classifyForfeit(
    battle.battleType,
    battle.participants,
    isForfeitTournamentBattle,
  );

  const baseData = {
    id: battle.id,
    robot1Id,
    robot2Id,
    isByeMatch,
    isForfeit,
    forfeitedRobotIds,
    winnerId: battle.winnerId,
    winningSide: battle.winningSide,
    createdAt: battle.createdAt,
    durationSeconds: battle.durationSeconds,
    robot1ELOBefore: robot1Part?.eloBefore || 0,
    robot1ELOAfter: robot1Part?.eloAfter || 0,
    robot2ELOBefore: robot2Part?.eloBefore || 0,
    robot2ELOAfter: robot2Part?.eloAfter || 0,
    robot1FinalHP: robot1Part?.finalHP || 0,
    robot2FinalHP: robot2Part?.finalHP || 0,
    winnerReward: battle.winnerReward,
    loserReward: battle.loserReward,
    battleType: battle.battleType,
    leagueType: battle.leagueType,
    tournamentId: battle.tournamentId,
    tournamentRound: battle.tournamentRound,
    tournamentName: battle.tournament?.name,
    tournamentMaxRounds: battle.tournament?.maxRounds,
    prestigeAwarded: userParticipant?.prestigeAwarded ?? 0,
    fameAwarded: userParticipant?.fameAwarded ?? 0,
    streamingRevenue: userParticipant?.streamingRevenue ?? 0,
    ...(byeReward ?? {}),
    // Participants array — the canonical source of per-robot battle data.
    // Frontend should use this + robotId to determine perspective instead of robot1/robot2.
    participants: battle.participants.map((p) => ({
      robotId: p.robotId,
      team: p.team,
      role: p.role,
      eloBefore: p.eloBefore,
      eloAfter: p.eloAfter,
      finalHP: p.finalHP,
      credits: p.credits,
      streamingRevenue: p.streamingRevenue,
      prestigeAwarded: p.prestigeAwarded,
      fameAwarded: p.fameAwarded,
      damageDealt: p.damageDealt,
      placement: p.placement,
      yielded: p.yielded,
      destroyed: p.destroyed,
      robot: p.robot ? {
        id: p.robot.id,
        name: p.robot.name,
        userId: p.robot.userId,
        user: { username: p.robot.user?.stableName || p.robot.user?.username || 'Unknown' },
      } : { id: p.robotId, name: 'Unknown', userId: 0, user: { username: 'Unknown' } },
    })),
    robot1: robot1 ? {
      id: robot1.id,
      name: robot1.name,
      userId: robot1.userId,
      user: { username: robot1.user.stableName || robot1.user.username },
    } : isByeMatch ? null : { id: 0, name: 'Unknown', userId: 0, user: { username: 'Unknown' } },
    robot2: isByeMatch ? null : robot2 ? {
      id: robot2.id,
      name: robot2.name,
      userId: robot2.userId,
      user: { username: robot2.user.stableName || robot2.user.username },
    } : { id: 0, name: 'Unknown', userId: 0, user: { username: 'Unknown' } },
  };

  if (battle.battleType === 'koth' || battle.battleType === 'grand_melee') {
    return formatKothHistoryEntry(battle, baseData, targetRobotIds);
  }

  if (battle.battleType === 'tag_team') {
    return formatTeamBattleHistoryEntry(battle, baseData, isByeMatch);
  }

  if (battle.battleType === 'league_2v2' || battle.battleType === 'league_3v3' || battle.battleType === 'tournament_2v2' || battle.battleType === 'tournament_3v3') {
    return formatTeamBattleHistoryEntry(battle, baseData, isByeMatch);
  }

  return baseData;
}

/** A robot's KotH zone score from the battle's stored log, or null without one. */
async function zoneScoreFromStoredLog(battleId: number, robotId: number): Promise<number | null> {
  const row = await prisma.battle.findUnique({ where: { id: battleId }, select: BATTLE_LOG_SELECT });
  if (!row) return null;
  const stored = (await decodeBattleLog(row, battleId))?.placements;
  const placements = Array.isArray(stored) ? (stored as Array<{ robotId?: unknown; zoneScore?: unknown }>) : [];
  const entry = placements.find((p) => p.robotId === robotId);
  return typeof entry?.zoneScore === 'number' ? entry.zoneScore : null;
}

async function formatKothHistoryEntry(battle: BattleWithFullRelations, baseData: Record<string, unknown>, targetRobotIds: number[]) {
  const userParticipant = battle.participants.find((p) => targetRobotIds.includes(p.robotId));

  // Zone score from the permanent summary (Spec #39). Summary writes are
  // best-effort, so a battle can lack one; then read the stored log, loaded only
  // for that battle (the history query omits the logs).
  let userZoneScore: number | null = null;
  const summary = (battle as unknown as { summary?: { kothPlacements: unknown } | null }).summary;
  if (summary?.kothPlacements && userParticipant) {
    const placements = summary.kothPlacements as unknown as KothPlacement[];
    const entry = placements.find(p => p.robotId === userParticipant.robotId);
    if (entry) userZoneScore = entry.zoneScore;
  }
  if (userZoneScore === null && userParticipant) {
    userZoneScore = await zoneScoreFromStoredLog(battle.id, userParticipant.robotId);
  }

  const kothData: Record<string, unknown> = {
    ...baseData,
    winnerReward: userParticipant?.credits ?? 0,
    loserReward: userParticipant?.credits ?? 0,
    kothPlacement: userParticipant?.placement ?? null,
    kothParticipantCount: battle.participants.length,
    kothZoneScore: userZoneScore,
  };

  if (userParticipant && userParticipant.robotId !== (battle.participants.find(p => p.team === 1)?.robotId) && userParticipant.robotId !== (battle.participants.find(p => p.team === 2)?.robotId)) {
    // The history query already includes every participant's robot and owner;
    // this used to re-read the robot once per KotH entry.
    const userRobot = userParticipant.robot;
    if (userRobot) {
      kothData.robot1Id = userRobot.id;
      kothData.robot1 = {
        id: userRobot.id,
        name: userRobot.name,
        userId: userRobot.userId,
        user: { username: userRobot.user.stableName || userRobot.user.username },
      };
    }
  }

  return kothData;
}

/**
 * Format a team battle (2v2/3v3/tag_team) history entry with team names and LP delta.
 * Looks up the ScheduledTeamBattleMatch to resolve team names and computes
 * LP delta from the battle outcome.
 *
 * Requirements: R9.7 (match notification data: team_size, outcome, opponent team name, Team_LP delta)
 */
async function formatTeamBattleHistoryEntry(
  battle: BattleWithFullRelations,
  baseData: Record<string, unknown>,
  byeMarker = false,
) {
  const isTournamentBattle = battle.battleType === 'tournament_2v2' || battle.battleType === 'tournament_3v3';
  const isTagTeam = battle.battleType === 'tag_team';
  const teamSize = (battle.battleType === 'league_2v2' || battle.battleType === 'tournament_2v2' || battle.battleType === 'tag_team') ? 2 : 3;

  let team1Name: string | null = null;
  let team2Name: string | null = null;
  let team1Id: number | null = null;
  let team2Id: number | null = null;
  let isByeMatch = byeMarker;
  let team1LpDelta = 0;
  let team2LpDelta = 0;

  if (isTournamentBattle) {
    // Tournament battles: look up the ScheduledTournamentMatch and resolve team names
    const tournamentMatch = await prisma.scheduledTournamentMatch.findFirst({
      where: {
        battleId: battle.id,
      },
    });

    if (tournamentMatch?.participant1Id) {
      const team1 = await prisma.teamBattle.findUnique({
        where: { id: tournamentMatch.participant1Id },
        select: { id: true, teamName: true },
      });
      team1Id = team1?.id ?? null;
      team1Name = team1?.teamName ?? null;
    }
    if (tournamentMatch?.participant2Id) {
      const team2 = await prisma.teamBattle.findUnique({
        where: { id: tournamentMatch.participant2Id },
        select: { id: true, teamName: true },
      });
      team2Id = team2?.id ?? null;
      team2Name = team2?.teamName ?? null;
    }
    // No LP delta for tournament battles
  } else {
    // League/tag-team battles: resolve team names from BattleParticipant → TeamBattle
    // Each participant has a team number (1 or 2) and robotId.
    // Find which TeamBattle each robot belongs to.
    const participants = battle.participants || [];
    const team1Robots = participants.filter(p => p.team === 1).map(p => p.robotId);
    const team2Robots = participants.filter(p => p.team === 2).map(p => p.robotId);

    const [team1Match, team2Match] = await Promise.all([
      team1Robots.length > 0
        ? prisma.teamBattle.findFirst({
            where: { members: { some: { robotId: { in: team1Robots } } }, teamSize },
            select: { id: true, teamName: true, stableId: true },
          })
        : null,
      team2Robots.length > 0
        ? prisma.teamBattle.findFirst({
            where: { members: { some: { robotId: { in: team2Robots } } }, teamSize },
            select: { id: true, teamName: true, stableId: true },
          })
        : null,
    ]);

    team1Id = team1Match?.id ?? null;
    team2Id = team2Match?.id ?? null;
    team1Name = team1Match?.teamName ?? null;
    team2Name = team2Match?.teamName ?? null;
    isByeMatch = byeMarker;

    // Calculate LP delta for league battles (not tag team)
    if (!isTagTeam && battle.winnerId !== null && team1Id) {
      const team1Won = battle.winnerId === team1Id;
      team1LpDelta = team1Won ? 3 : -1;
      team2LpDelta = team1Won ? -1 : 3;
    } else if (battle.winnerId === null) {
      team1LpDelta = 1;
      team2LpDelta = 1;
    }
  }

  return {
    ...baseData,
    team1Id,
    team2Id,
    team1TeamName: team1Name,
    team2TeamName: isByeMatch ? 'Bye' : (team2Name ?? 'Unknown'),
    teamSize,
    isByeMatch,
    team1LpDelta,
    team2LpDelta,
  };
}

// ─── Battle Log ──────────────────────────────────────────────────────

