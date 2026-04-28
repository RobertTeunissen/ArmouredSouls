import prisma from '../../lib/prisma';
import type { BattleParticipant, Prisma } from '../../../generated/prisma';
import { BattleError, BattleErrorCode } from '../../errors';
import { mapRobotAttributes } from './adminStatsService';

// Typed query result for battles with robot selects and participants (used in admin battle listing)
export type BattleWithDetails = Prisma.BattleGetPayload<{
  include: {
    robot1: { select: { id: true; name: true; userId: true } };
    robot2: { select: { id: true; name: true; userId: true } };
    participants: true;
  };
}>;

// Typed query result for tag team matches with battle, team, and robot includes
export type TagTeamMatchWithBattle = Prisma.ScheduledTagTeamMatchGetPayload<{
  include: {
    battle: {
      include: {
        robot1: { select: { id: true; name: true; userId: true } };
        robot2: { select: { id: true; name: true; userId: true } };
        participants: true;
      };
    };
    team1: {
      include: {
        activeRobot: { select: { id: true; name: true } };
        reserveRobot: { select: { id: true; name: true } };
      };
    };
    team2: {
      include: {
        activeRobot: { select: { id: true; name: true } };
        reserveRobot: { select: { id: true; name: true } };
      };
    };
  };
}>;

export interface BattleQueryParams {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  leagueType?: string;
}

/**
 * Build a Prisma where clause for TagTeamMatch queries with optional search/league filters.
 */
export function buildTagTeamWhere(search?: string, leagueType?: string): Prisma.ScheduledTagTeamMatchWhereInput {
  const where: Prisma.ScheduledTagTeamMatchWhereInput = {
    status: 'completed',
    battleId: { not: null },
  };

  if (leagueType && leagueType !== 'all') {
    where.tagTeamLeague = leagueType;
  }

  if (search) {
    where.OR = [
      { team1: { activeRobot: { name: { contains: search, mode: 'insensitive' } } } },
      { team1: { reserveRobot: { name: { contains: search, mode: 'insensitive' } } } },
      { team2: { activeRobot: { name: { contains: search, mode: 'insensitive' } } } },
      { team2: { reserveRobot: { name: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  return where;
}

/**
 * Map a standard Battle record to the API response shape with battleFormat.
 */
export function mapBattleRecord(battle: BattleWithDetails, battleFormat: '1v1' | '2v2') {
  const robot1Participant = battle.participants?.find(
    (p: BattleParticipant) => p.robotId === battle.robot1Id
  );
  const robot2Participant = battle.participants?.find(
    (p: BattleParticipant) => p.robotId === battle.robot2Id
  );

  return {
    id: battle.id,
    robot1: battle.robot1,
    robot2: battle.robot2,
    winnerId: battle.winnerId,
    winnerName:
      battle.winnerId === battle.robot1.id
        ? battle.robot1.name
        : battle.winnerId === battle.robot2.id
        ? battle.robot2.name
        : 'Draw',
    leagueType: battle.leagueType,
    durationSeconds: battle.durationSeconds,
    robot1FinalHP: robot1Participant?.finalHP || 0,
    robot2FinalHP: robot2Participant?.finalHP || 0,
    robot1ELOBefore: robot1Participant?.eloBefore || 0,
    robot2ELOBefore: robot2Participant?.eloBefore || 0,
    robot1ELOAfter: robot1Participant?.eloAfter || 0,
    robot2ELOAfter: robot2Participant?.eloAfter || 0,
    createdAt: battle.createdAt,
    battleFormat,
  };
}

/**
 * Map a TagTeamMatch (with included battle and team data) to the API response shape.
 * Includes team robot names for display in admin portal (Requirements 2.6, 3.8).
 */
export function mapTagTeamRecord(match: TagTeamMatchWithBattle) {
  const battle = match.battle!;
  const base = mapBattleRecord(battle, '2v2');

  // Determine winner name for tag team battles (should be team name, not robot name)
  // winnerId in tag team battles should be team1.id or team2.id (after fix in Task 3)
  let winnerName = base.winnerName;
  if (battle.winnerId === match.team1.id) {
    winnerName = 'Team 1';
  } else if (match.team2 && battle.winnerId === match.team2.id) {
    winnerName = 'Team 2';
  } else if (battle.winnerId === null) {
    winnerName = 'Draw';
  }

  return {
    ...base,
    winnerName,
    // Include team robot names for display (Requirements 2.6)
    team1ActiveName: match.team1.activeRobot?.name,
    team1ReserveName: match.team1.reserveRobot?.name,
    team2ActiveName: match.team2?.activeRobot?.name,
    team2ReserveName: match.team2?.reserveRobot?.name,
    // Include team IDs for winner determination
    team1Id: match.team1.id,
    team2Id: match.team2?.id,
    teams: {
      team1: {
        id: match.team1.id,
        activeRobot: match.team1.activeRobot,
        reserveRobot: match.team1.reserveRobot,
        stableId: match.team1.stableId,
        league: match.tagTeamLeague,
      },
      team2: match.team2
        ? {
            id: match.team2.id,
            activeRobot: match.team2.activeRobot,
            reserveRobot: match.team2.reserveRobot,
            stableId: match.team2.stableId,
            league: match.tagTeamLeague,
          }
        : null,
    },
  };
}

/**
 * Fetch tag team battles with pagination, search, and league filtering.
 */
export async function fetchTagTeamBattles({ page, limit, skip, search, leagueType }: BattleQueryParams) {
  const where = buildTagTeamWhere(search, leagueType);

  const totalBattles = await prisma.scheduledTagTeamMatch.count({ where });

  const tagTeamMatches = await prisma.scheduledTagTeamMatch.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      battle: {
        include: {
          robot1: { select: { id: true, name: true, userId: true } },
          robot2: { select: { id: true, name: true, userId: true } },
          participants: true,
        },
      },
      team1: {
        include: {
          activeRobot: { select: { id: true, name: true } },
          reserveRobot: { select: { id: true, name: true } },
        },
      },
      team2: {
        include: {
          activeRobot: { select: { id: true, name: true } },
          reserveRobot: { select: { id: true, name: true } },
        },
      },
    },
  });

  const battles = tagTeamMatches
    .filter(m => m.battle !== null)
    .map(m => mapTagTeamRecord(m));

  return {
    battles,
    pagination: {
      page,
      limit,
      totalBattles,
      totalPages: Math.ceil(totalBattles / limit),
      hasMore: skip + battles.length < totalBattles,
    },
  };
}

/**
 * Get paginated admin battle list with search, league, and battle type filters.
 * Returns the exact shape that the /battles route handler sends as JSON.
 */
export async function getAdminBattleList(params: {
  page: number;
  limit: number;
  search?: string;
  leagueType?: string;
  battleType?: string;
}) {
  const { page, limit, search, leagueType, battleType } = params;
  const skip = (page - 1) * limit;

  // Tag team only: query TagTeamMatch joined with Battle and TagTeam
  if (battleType === 'tagteam') {
    return fetchTagTeamBattles({ page, limit, skip, search, leagueType });
  }

  // KotH only: query battles with battleType 'koth'
  if (battleType === 'koth') {
    const kothWhere: Prisma.BattleWhereInput = { battleType: 'koth' };
    if (search) {
      kothWhere.OR = [
        { robot1: { name: { contains: search, mode: 'insensitive' } } },
        { robot2: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [totalBattles, kothBattles] = await Promise.all([
      prisma.battle.count({ where: kothWhere }),
      prisma.battle.findMany({
        where: kothWhere,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          robot1: { select: { id: true, name: true, userId: true } },
          robot2: { select: { id: true, name: true, userId: true } },
          participants: true,
        },
      }),
    ]);

    return {
      battles: kothBattles.map(battle => mapBattleRecord(battle, '1v1')),
      pagination: {
        page,
        limit,
        totalBattles,
        totalPages: Math.ceil(totalBattles / limit),
        hasMore: skip + kothBattles.length < totalBattles,
      },
    };
  }

  // Build where clause for standard battle query
  const where: Prisma.BattleWhereInput = {};

  if (search) {
    where.OR = [
      { robot1: { name: { contains: search, mode: 'insensitive' } } },
      { robot2: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (leagueType && leagueType !== 'all') {
    where.leagueType = leagueType;
  }

  if (battleType && battleType !== 'all') {
    if (battleType === 'tournament') {
      where.tournamentId = { not: null };
      where.battleType = { not: 'tag_team' };
    } else if (battleType === 'league') {
      where.tournamentId = null;
      where.battleType = { not: 'tag_team' };
    }
  }

  // For 'all', union 1v1 battles with tag team battles
  if (!battleType || battleType === 'all') {
    const oneVOneWhere = { ...where, battleType: { not: 'tag_team' } };
    const [oneVOneCount, tagTeamCount] = await Promise.all([
      prisma.battle.count({ where: oneVOneWhere }),
      prisma.scheduledTagTeamMatch.count({
        where: buildTagTeamWhere(search, leagueType),
      }),
    ]);
    const totalBattles = oneVOneCount + tagTeamCount;

    const [oneVOneBattles, tagTeamMatches] = await Promise.all([
      prisma.battle.findMany({
        where: oneVOneWhere,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          robot1: { select: { id: true, name: true, userId: true } },
          robot2: { select: { id: true, name: true, userId: true } },
          participants: true,
        },
      }),
      prisma.scheduledTagTeamMatch.findMany({
        where: buildTagTeamWhere(search, leagueType),
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          battle: {
            include: {
              robot1: { select: { id: true, name: true, userId: true } },
              robot2: { select: { id: true, name: true, userId: true } },
              participants: true,
            },
          },
          team1: {
            include: {
              activeRobot: { select: { id: true, name: true } },
              reserveRobot: { select: { id: true, name: true } },
            },
          },
          team2: {
            include: {
              activeRobot: { select: { id: true, name: true } },
              reserveRobot: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    const mappedOneVOne = oneVOneBattles.map(battle => mapBattleRecord(battle, '1v1'));
    const mappedTagTeam = tagTeamMatches
      .filter(m => m.battle !== null)
      .map(m => mapTagTeamRecord(m));

    const allBattles = [...mappedOneVOne, ...mappedTagTeam]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return {
      battles: allBattles,
      pagination: {
        page,
        limit,
        totalBattles,
        totalPages: Math.ceil(totalBattles / limit),
        hasMore: skip + allBattles.length < totalBattles,
      },
    };
  }

  // Standard 1v1 query for league/tournament filters
  const [totalBattles, battles] = await Promise.all([
    prisma.battle.count({ where }),
    prisma.battle.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        robot1: { select: { id: true, name: true, userId: true } },
        robot2: { select: { id: true, name: true, userId: true } },
        participants: true,
      },
    }),
  ]);

  return {
    battles: battles.map(battle => mapBattleRecord(battle, '1v1')),
    pagination: {
      page,
      limit,
      totalBattles,
      totalPages: Math.ceil(totalBattles / limit),
      hasMore: skip + battles.length < totalBattles,
    },
  };
}

/**
 * Get detailed battle information including full combat log.
 * Detects tag team battles via TagTeamMatch and returns team data when present.
 * Returns the exact shape that the /battles/:id route handler sends as JSON.
 */
export async function getAdminBattleDetail(battleId: number) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      robot1: true,
      robot2: true,
    },
  });

  if (!battle) {
    throw new BattleError(BattleErrorCode.BATTLE_NOT_FOUND, 'Battle not found', 404);
  }

  // Check if this battle has an associated TagTeamMatch record
  const tagTeamMatch = await prisma.scheduledTagTeamMatch.findFirst({
    where: { battleId: battle.id },
    include: {
      team1: {
        include: {
          activeRobot: { select: { id: true, name: true, userId: true } },
          reserveRobot: { select: { id: true, name: true, userId: true } },
        },
      },
      team2: {
        include: {
          activeRobot: { select: { id: true, name: true, userId: true } },
          reserveRobot: { select: { id: true, name: true, userId: true } },
        },
      },
    },
  });

  const isTagTeam = tagTeamMatch !== null;

  // Get participant data from BattleParticipant table
  const participants = await prisma.battleParticipant.findMany({
    where: { battleId: battle.id },
    select: {
      robotId: true,
      team: true,
      role: true,
      credits: true,
      streamingRevenue: true,
      eloBefore: true,
      eloAfter: true,
      prestigeAwarded: true,
      fameAwarded: true,
      damageDealt: true,
      finalHP: true,
      yielded: true,
      destroyed: true,
    },
  });

  // Build base response (shared between 1v1 and 2v2)
  const baseResponse = {
    id: battle.id,
    battleType: battle.battleType,
    leagueType: battle.leagueType,
    durationSeconds: battle.durationSeconds,
    createdAt: battle.createdAt,
    battleFormat: isTagTeam ? '2v2' as const : '1v1' as const,

    robot1: {
      id: battle.robot1.id,
      name: battle.robot1.name,
      userId: battle.robot1.userId,
      maxHP: battle.robot1.maxHP,
      maxShield: battle.robot1.maxShield,
      attributes: mapRobotAttributes(battle.robot1),
      loadout: battle.robot1.loadoutType,
      stance: battle.robot1.stance,
    },
    robot2: {
      id: battle.robot2.id,
      name: battle.robot2.name,
      userId: battle.robot2.userId,
      maxHP: battle.robot2.maxHP,
      maxShield: battle.robot2.maxShield,
      attributes: mapRobotAttributes(battle.robot2),
      loadout: battle.robot2.loadoutType,
      stance: battle.robot2.stance,
    },

    participants,

    winnerId: battle.winnerId,

    robot1ELOBefore: battle.robot1ELOBefore,
    robot2ELOBefore: battle.robot2ELOBefore,
    robot1ELOAfter: battle.robot1ELOAfter,
    robot2ELOAfter: battle.robot2ELOAfter,
    eloChange: battle.eloChange,

    winnerReward: battle.winnerReward,
    loserReward: battle.loserReward,

    team1ActiveRobotId: battle.team1ActiveRobotId,
    team1ReserveRobotId: battle.team1ReserveRobotId,
    team2ActiveRobotId: battle.team2ActiveRobotId,
    team2ReserveRobotId: battle.team2ReserveRobotId,
    team1TagOutTime: battle.team1TagOutTime ? Number(battle.team1TagOutTime) / 1000 : null,
    team2TagOutTime: battle.team2TagOutTime ? Number(battle.team2TagOutTime) / 1000 : null,

    battleLog: battle.battleLog,
  };

  // Append tag team data when present
  if (isTagTeam && tagTeamMatch) {
    return {
      ...baseResponse,
      teams: {
        team1: {
          id: tagTeamMatch.team1.id,
          activeRobot: tagTeamMatch.team1.activeRobot,
          reserveRobot: tagTeamMatch.team1.reserveRobot,
          stableId: tagTeamMatch.team1.stableId,
          league: tagTeamMatch.tagTeamLeague,
        },
        team2: tagTeamMatch.team2
          ? {
              id: tagTeamMatch.team2.id,
              activeRobot: tagTeamMatch.team2.activeRobot,
              reserveRobot: tagTeamMatch.team2.reserveRobot,
              stableId: tagTeamMatch.team2.stableId,
              league: tagTeamMatch.tagTeamLeague,
            }
          : null,
      },
    };
  }

  return baseResponse;
}
