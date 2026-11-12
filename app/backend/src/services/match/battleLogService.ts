/**
 * The detailed battle log of one battle (`GET /api/matches/battles/:id/log`),
 * with the player-facing fields only.
 */
import prisma from '../../lib/prisma';
import { Prisma, BattleParticipant, type StableType } from '../../../generated/prisma';
import { decodeBattleLog } from '../battle/battleLogCodec';
import { PLAYER_LOG_HIDDEN_FIELDS, classifyForfeit } from './matchHistoryService';
import type {
  BattleLogPayload,
  BattleLogResponse,
  BattleLogRobot,
  BattleSummaryView,
  KothLogParticipant,
  KothPlaybackMetadata,
  TagTeamLogRobot,
  TagTeamLogSide,
  TagTeamLogSummary,
} from '../../shared/types';

// ─── Prisma Payload Types ────────────────────────────────────────────


type TagTeamRobot = Prisma.RobotGetPayload<{
  include: { user: { select: { id: true; username: true; stableName: true; stableType: true } } };
}> | null;


/**
 * Fetch and format a detailed battle log for a specific battle.
 * Returns the full response shape expected by the frontend.
 */
export async function getBattleLog(battleId: number): Promise<BattleLogResponse | null> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        include: {
          robot: {
            include: {
              user: { select: { id: true, username: true, stableName: true, stableType: true } },
              mainWeapon: { include: { weapon: { select: { name: true, rangeBand: true } } } },
              offhandWeapon: { include: { weapon: { select: { name: true, rangeBand: true } } } },
            },
          },
        },
      },
    },
  });

  if (!battle) return null;

  // Derive robot1/robot2 from participants (prefer active/solo over reserve)
  const team1Parts = battle.participants.filter(p => p.team === 1);
  const team2Parts = battle.participants.filter(p => p.team === 2);
  const robot1Participant = team1Parts.find(p => p.role === null || p.role === 'active' || p.role === 'solo') ?? team1Parts[0];
  const robot2Participant = team2Parts.find(p => p.role === null || p.role === 'active' || p.role === 'solo') ?? team2Parts[0]
    // KotH/bye fallback: use second participant if no team 2 exists
    ?? battle.participants.find(p => p.robotId !== robot1Participant?.robotId);

  const { battleLogZst, legacyBattleLog, ...battleColumns } = battle;
  const battleData = {
    ...battleColumns,
    battleLog: await decodeBattleLog({ battleLogZst, legacyBattleLog }, battle.id),
    robot1: robot1Participant?.robot ?? null,
    robot2: robot2Participant?.robot ?? null,
  };

  const battleParticipants = battle.participants;

  const participantMap = new Map(battleParticipants.map(p => [p.robotId, p]));
  const robot1Part = participantMap.get(robot1Participant?.robotId ?? 0);
  const robot2Part = participantMap.get(robot2Participant?.robotId ?? 0);

  const streamingRevenue1 = robot1Part?.streamingRevenue || 0;
  const streamingRevenue2 = robot2Part?.streamingRevenue || 0;

  // Admin-only debug fields (formula breakdowns with every roll) are stripped:
  // no player view reads them, and they are the bulk of large logs.
  const playerLog: BattleLogPayload | null =
    battleData.battleLog !== null
      ? (JSON.parse(
          JSON.stringify(battleData.battleLog, (key, value) =>
            PLAYER_LOG_HIDDEN_FIELDS.has(key) ? undefined : typeof value === 'bigint' ? Number(value) : value,
          ),
        ) as BattleLogPayload)
      : null;

  // Pre-computed summary (Spec #39) and the bracket forfeit marker, which the
  // forfeit classifier reads instead of the summary or battle_log.
  const [summary, tournamentForfeit] = await Promise.all([
    prisma.battleSummary.findUnique({ where: { battleId: battleData.id } }),
    prisma.scheduledTournamentMatch.findFirst({
      where: { battleId: battleData.id, status: 'forfeit' },
      select: { id: true },
    }),
  ]);
  const forfeit = classifyForfeit(battleData.battleType, battleParticipants, tournamentForfeit !== null);

  const baseResponse: BattleLogResponse = {
    battleId: battleData.id,
    createdAt: battleData.createdAt.toISOString(),
    battleType: battleData.battleType,
    leagueType: battleData.leagueType,
    leagueInstanceId: battleData.leagueInstanceId ?? null,
    tournamentId: battleData.tournamentId ?? null,
    duration: battleData.durationSeconds,
    playbackAvailable: battleData.battleLog !== null,
    battleLog: playerLog,
    isForfeit: forfeit.isForfeit,
    forfeitedRobotIds: forfeit.forfeitedRobotIds,
    participants: [],
    winner: null,
  };
  if (summary) {
    // Stored JSON written by battleSummaryComputer in these shapes.
    baseResponse.summary = {
      perRobot: summary.perRobot as unknown as BattleSummaryView['perRobot'],
      perTeam: summary.perTeam as unknown as BattleSummaryView['perTeam'],
      damageFlows: summary.damageFlows as unknown as BattleSummaryView['damageFlows'],
      participants: summary.participants as unknown as BattleSummaryView['participants'],
      kothPlacements: summary.kothPlacements as unknown as BattleSummaryView['kothPlacements'],
      kothData: summary.kothData as unknown as BattleSummaryView['kothData'],
      startingPositions: summary.startingPositions as unknown as BattleSummaryView['startingPositions'],
      endingPositions: summary.endingPositions as unknown as BattleSummaryView['endingPositions'],
      arenaRadius: summary.arenaRadius,
      battleDuration: summary.battleDuration,
      totalEvents: summary.totalEvents,
      hasData: summary.hasData,
    };
  }

  // Build unified participants array from BattleParticipant records
  // This is the single source of truth — same shape for all battle types
  baseResponse.participants = battleParticipants.map(p => ({
    robotId: p.robotId,
    robotName: p.robot.name,
    owner: p.robot.user.stableName || p.robot.user.username,
    ownerId: p.robot.user.id,
    // Spec #55 R1.7: drives the Automaton_Badge.
    ownerStableType: p.robot.user.stableType,
    imageUrl: p.robot.imageUrl ?? null,
    teamIndex: p.team - 1, // DB uses 1-based, frontend uses 0-based
    team: p.team,
    role: p.role,
    placement: p.placement,
    // Combat outcome
    finalHP: p.finalHP,
    maxHP: p.robot.maxHP,
    maxShield: p.robot.maxShield,
    destroyed: p.destroyed,
    yielded: p.yielded,
    damageDealt: p.damageDealt,
    // Economy
    eloBefore: p.eloBefore,
    eloAfter: p.eloAfter,
    credits: p.credits,
    streamingRevenue: p.streamingRevenue,
    prestigeAwarded: p.prestigeAwarded,
    fameAwarded: p.fameAwarded,
    // Loadout
    stance: p.robot.stance,
    loadoutType: p.robot.loadoutType,
    mainWeaponName: p.robot.mainWeapon?.weapon?.name ?? null,
    mainWeaponRangeBand: p.robot.mainWeapon?.weapon?.rangeBand ?? null,
    offhandWeaponName: p.robot.offhandWeapon?.weapon?.name ?? null,
    offhandWeaponRangeBand: p.robot.offhandWeapon?.weapon?.rangeBand ?? null,
  }));

  if (battleData.battleType === 'tag_team') {
    // Derive tag-team robot IDs from BattleParticipant records (replaces deprecated Battle columns)
    const team1Active = battleParticipants.find(p => p.team === 1 && p.role === 'active');
    const team2Active = battleParticipants.find(p => p.team === 2 && p.role === 'active');
    if (team1Active && team2Active) {
      Object.assign(baseResponse, await buildTagTeamLogResponse(battleData, battleParticipants));
    }
  } else if (battleData.battleType === 'koth' || battleData.battleType === 'grand_melee') {
    Object.assign(baseResponse, await buildKothLogResponse(battleData, battleId));
  } else {
    baseResponse.robot1 = mapRobotForLog(battleData.robot1, robot1Part, streamingRevenue1);
    baseResponse.robot2 = mapRobotForLog(battleData.robot2, robot2Part, streamingRevenue2);
  }

  // Determine winner
  const derivedRobot1Id = robot1Participant?.robotId ?? 0;
  const derivedRobot2Id = robot2Participant?.robotId ?? 0;
  if (battleData.battleType === 'koth' || battleData.battleType === 'grand_melee') {
    // Set by buildKothLogResponse.
  } else if (battleData.battleType === 'tag_team' && baseResponse.tagTeam) {
    const team1Id = baseResponse.tagTeam.team1.teamId;
    const team2Id = baseResponse.tagTeam.team2.teamId;
    baseResponse.winner = battleData.winnerId === team1Id ? 'robot1' : battleData.winnerId === team2Id ? 'robot2' : null;
  } else if (battleData.battleType === 'league_2v2' || battleData.battleType === 'league_3v3' || battleData.battleType === 'tournament_2v2' || battleData.battleType === 'tournament_3v3') {
    // For team battles, winnerId stores the winning team ID (not a robot ID).
    // Use the permanent winning_side column (populated at battle creation, Spec #39).
    const winningSide = battleData.winningSide ?? null;
    if (winningSide === 1) {
      baseResponse.winner = 'robot1';
    } else if (winningSide === 2) {
      baseResponse.winner = 'robot2';
    } else {
      baseResponse.winner = null;
    }
  } else {
    baseResponse.winner = battleData.winnerId === derivedRobot1Id ? 'robot1' : battleData.winnerId === derivedRobot2Id ? 'robot2' : null;
  }

  return baseResponse;
}

async function buildTagTeamLogResponse(
  battleData: { battleLog: unknown; winnerId: number | null },
  battleParticipants: BattleParticipant[],
): Promise<Pick<BattleLogResponse, 'tagTeam' | 'team1Summary' | 'team2Summary'>> {
  // Derive robot IDs from BattleParticipant records (replaces deprecated Battle columns)
  const team1ActivePart = battleParticipants.find(p => p.team === 1 && p.role === 'active');
  const team1ReservePart = battleParticipants.find(p => p.team === 1 && p.role === 'reserve');
  const team2ActivePart = battleParticipants.find(p => p.team === 2 && p.role === 'active');
  const team2ReservePart = battleParticipants.find(p => p.team === 2 && p.role === 'reserve');

  const tagTeamUserSelect = { select: { id: true, username: true, stableName: true, stableType: true } };
  const [team1Active, team1Reserve, team2Active, team2Reserve] = await Promise.all([
    team1ActivePart
      ? prisma.robot.findUnique({ where: { id: team1ActivePart.robotId }, include: { user: tagTeamUserSelect } })
      : null,
    team1ReservePart
      ? prisma.robot.findUnique({ where: { id: team1ReservePart.robotId }, include: { user: tagTeamUserSelect } })
      : null,
    team2ActivePart
      ? prisma.robot.findUnique({ where: { id: team2ActivePart.robotId }, include: { user: tagTeamUserSelect } })
      : null,
    team2ReservePart
      ? prisma.robot.findUnique({ where: { id: team2ReservePart.robotId }, include: { user: tagTeamUserSelect } })
      : null,
  ]);

  // Look up team details from TeamBattle via member robot IDs
  const [team1Details, team2Details] = await Promise.all([
    team1ActivePart
      ? prisma.teamBattle.findFirst({
          where: { members: { some: { robotId: team1ActivePart.robotId } }, teamSize: 2 },
          include: { stable: { select: { stableName: true, stableType: true } } },
          orderBy: { updatedAt: 'desc' },
        })
      : null,
    team2ActivePart
      ? prisma.teamBattle.findFirst({
          where: { members: { some: { robotId: team2ActivePart.robotId } }, teamSize: 2 },
          include: { stable: { select: { stableName: true, stableType: true } } },
          orderBy: { updatedAt: 'desc' },
        })
      : null,
  ]);

  const formatTagRobot = (robot: TagTeamRobot, participant: typeof team1ActivePart): TagTeamLogRobot | null =>
    robot
      ? {
          id: robot.id,
          name: robot.name,
          owner: robot.user.stableName || robot.user.username,
          ownerStableType: robot.user.stableType,
          maxHP: robot.maxHP,
          maxShield: robot.maxShield,
          damageDealt: participant?.damageDealt ?? 0,
          fameAwarded: participant?.fameAwarded ?? 0,
          imageUrl: robot.imageUrl ?? null,
        }
      : null;

  // Tag-out times: read from BattleParticipant.tagOutTimeMs (populated for new battles),
  // fall back to battleLog JSON for historical data (pre-migration battles have NULL tagOutTimeMs)
  const battleLogData = battleData.battleLog as unknown as { team1TagOutTime?: number; team2TagOutTime?: number } | null;
  const getTagOutTime = (participant: typeof team1ActivePart, team: 1 | 2): number | null => {
    if (participant?.tagOutTimeMs != null) return Number(participant.tagOutTimeMs) / 1000;
    // Fallback: read from battleLog JSON (for historical battles before tagOutTimeMs was populated)
    if (battleLogData) {
      const logTime = team === 1 ? battleLogData.team1TagOutTime : battleLogData.team2TagOutTime;
      if (logTime != null) return logTime / 1000;
    }
    return null;
  };

  const team1: TagTeamLogSide = {
    teamId: team1Details?.id || null,
    stableName: team1Details?.stable?.stableName || null,
    stableType: team1Details?.stable?.stableType ?? null,
    activeRobot: formatTagRobot(team1Active, team1ActivePart),
    reserveRobot: formatTagRobot(team1Reserve, team1ReservePart),
    tagOutTime: getTagOutTime(team1ActivePart, 1),
  };
  const team2: TagTeamLogSide = {
    teamId: team2Details?.id || null,
    stableName: team2Details?.stable?.stableName || null,
    stableType: team2Details?.stable?.stableType ?? null,
    activeRobot: formatTagRobot(team2Active, team2ActivePart),
    reserveRobot: formatTagRobot(team2Reserve, team2ReservePart),
    tagOutTime: getTagOutTime(team2ActivePart, 2),
  };

  // Team-level summaries from BattleParticipant
  const team1Participants = battleParticipants.filter(p => p.team === 1);
  const team2Participants = battleParticipants.filter(p => p.team === 2);

  const sumField = (arr: BattleParticipant[], field: keyof BattleParticipant) => arr.reduce((sum, p) => sum + (Number(p[field]) || 0), 0);

  const teamSummary = (participants: BattleParticipant[]): TagTeamLogSummary => ({
    reward: sumField(participants, 'credits'),
    prestige: sumField(participants, 'prestigeAwarded'),
    totalDamage: sumField(participants, 'damageDealt'),
    totalFame: sumField(participants, 'fameAwarded'),
    streamingRevenue: sumField(participants, 'streamingRevenue'),
  });

  return {
    tagTeam: { team1, team2 },
    team1Summary: teamSummary(team1Participants),
    team2Summary: teamSummary(team2Participants),
  };
}

async function buildKothLogResponse(
  battleData: { battleLog: unknown; winnerId: number | null },
  battleId: number,
): Promise<Pick<BattleLogResponse, 'kothParticipants' | 'kothData' | 'winner'>> {
  const allParticipants = await prisma.battleParticipant.findMany({
    where: { battleId },
    include: {
      robot: {
        include: { user: { select: { id: true, username: true, stableName: true, stableType: true } } },
      },
    },
    orderBy: { placement: 'asc' },
  });

  const battleLogData = (typeof battleData.battleLog === 'object' && battleData.battleLog !== null) ? battleData.battleLog as Record<string, unknown> : {};
  const logPlacements = (battleLogData.placements || []) as Array<{ robotId: number; zoneScore: number; zoneTime: number; kills: number; destroyed: boolean }>;

  const kothParticipants: KothLogParticipant[] = allParticipants.map(p => {
    const logEntry = logPlacements.find(lp => lp.robotId === p.robotId);
    return {
      robotId: p.robot.id,
      robotName: p.robot.name,
      owner: p.robot.user.stableName || p.robot.user.username,
      ownerId: p.robot.user.id,
      ownerStableType: p.robot.user.stableType,
      placement: p.placement ?? p.team,
      zoneScore: logEntry?.zoneScore ?? 0,
      zoneTime: logEntry?.zoneTime ?? 0,
      kills: logEntry?.kills ?? 0,
      damageDealt: p.damageDealt,
      finalHP: p.finalHP,
      destroyed: p.destroyed,
      credits: p.credits,
      fame: p.fameAwarded,
      prestige: p.prestigeAwarded,
      streamingRevenue: p.streamingRevenue || 0,
      imageUrl: p.robot.imageUrl ?? null,
    };
  });

  return {
    kothParticipants,
    winner: battleData.winnerId === allParticipants[0]?.robotId ? 'robot1' : null,
    // Stored by the KotH event converter in this shape.
    ...(battleLogData.kothData ? { kothData: battleLogData.kothData as KothPlaybackMetadata } : {}),
  };
}

/** Robot data shape expected by buildStandardLogResponse */
interface RobotForLog {
  id: number;
  name: string;
  user: { id: number; username: string; stableName: string | null; stableType: StableType };
  maxHP: number;
  maxShield: number;
  imageUrl: string | null;
  loadoutType: string;
  stance: string;
  mainWeapon: { weapon: { name: string; rangeBand: string } | null } | null;
  offhandWeapon: { weapon: { name: string; rangeBand: string } | null } | null;
}

/**
 * Build the `robot1` / `robot2` blocks of a standard (two-participant) battle
 * log response.
 *
 * Spec #46 R4.18: `robot1` and `robot2` are nullable. Migration
 * `20260611120000_drop_legacy_scheduling_tables` deleted `battle_participants`
 * rows and `battles` rows through two different keys, which left behind battles
 * with one participant or none. Every field access here was unguarded, so
 * opening one of those battles threw and the Hall of Records link appeared
 * broken. A missing participant now yields `null` for that side, which
 * `BattleDetailPage.tsx` already handles via optional chaining, so the battle
 * renders with the resolvable side intact instead of failing outright.
 *
 * No data remediation accompanies this: Spec #45 deletes battle history at the
 * season boundary, and the orphaned rows cannot be reconstructed.
 */
function mapRobotForLog(
  robot: RobotForLog | null,
  participant: BattleParticipant | undefined,
  streamingRevenue: number,
): BattleLogRobot | null {
  if (!robot) return null;
  return {
    id: robot.id,
    name: robot.name,
    owner: robot.user.stableName || robot.user.username,
    ownerId: robot.user.id,
    ownerStableType: robot.user.stableType,
    maxHP: robot.maxHP,
    maxShield: robot.maxShield,
    eloBefore: participant?.eloBefore || 0,
    eloAfter: participant?.eloAfter || 0,
    finalHP: participant?.finalHP ?? 0,
    damageDealt: participant?.damageDealt ?? 0,
    reward: participant?.credits ?? 0,
    prestige: participant?.prestigeAwarded ?? 0,
    fame: participant?.fameAwarded ?? 0,
    streamingRevenue,
    yielded: participant?.yielded ?? false,
    destroyed: participant?.destroyed ?? false,
    imageUrl: robot.imageUrl ?? null,
    loadoutType: robot.loadoutType,
    rangeBand: robot.mainWeapon?.weapon?.rangeBand ?? null,
    stance: robot.stance,
    mainWeaponName: robot.mainWeapon?.weapon?.name ?? null,
    offhandWeaponName: robot.offhandWeapon?.weapon?.name ?? null,
    offhandRangeBand: robot.offhandWeapon?.weapon?.rangeBand ?? null,
  };
}
