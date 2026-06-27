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

// Note: TagTeamMatchWithBattle type and mapTagTeamRecord function removed.
// Tag team battles are now queried directly from the Battle table (battleType='tag_team')
// and mapped using mapBattleRecord. Team data resolved via TeamBattle members.

export interface BattleQueryParams {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  leagueType?: string;
}

/**
 * Build a Prisma where clause for tag team battle queries on the Battle table.
 */
export function buildTagTeamWhere(search?: string, leagueType?: string): Prisma.BattleWhereInput {
  const where: Prisma.BattleWhereInput = {
    battleType: 'tag_team',
  };

  if (leagueType && leagueType !== 'all') {
    where.leagueType = leagueType;
  }

  if (search) {
    where.OR = [
      { robot1: { name: { contains: search, mode: 'insensitive' } } },
      { robot2: { name: { contains: search, mode: 'insensitive' } } },
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
    battleType: battle.battleType,
    teamSize: battle.battleType === 'league_2v2' ? 2 : battle.battleType === 'league_3v3' ? 3 : undefined,
  };
}

/**
 * Fetch tag team battles with pagination, search, and league filtering.
 */
export async function fetchTagTeamBattles({ page, limit, skip, search, leagueType }: BattleQueryParams) {
  const where = buildTagTeamWhere(search, leagueType);

  const totalBattles = await prisma.battle.count({ where });

  const tagTeamBattles = await prisma.battle.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      robot1: { select: { id: true, name: true, userId: true } },
      robot2: { select: { id: true, name: true, userId: true } },
      participants: true,
    },
  });

  const battles = tagTeamBattles.map(battle => mapBattleRecord(battle, '2v2'));

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
      where.battleType = { notIn: ['tag_team', 'tournament_1v1'] };
    } else if (battleType === 'league_2v2') {
      where.battleType = 'league_2v2';
    } else if (battleType === 'league_3v3') {
      where.battleType = 'league_3v3';
    }
  }

  // For 'all', union 1v1 battles with tag team battles
  if (!battleType || battleType === 'all') {
    const oneVOneWhere = { ...where, battleType: { not: 'tag_team' } };
    const [oneVOneCount, tagTeamCount] = await Promise.all([
      prisma.battle.count({ where: oneVOneWhere }),
      prisma.battle.count({ where: buildTagTeamWhere(search, leagueType) }),
    ]);
    const totalBattles = oneVOneCount + tagTeamCount;

    const [oneVOneBattles, tagTeamBattles] = await Promise.all([
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
      prisma.battle.findMany({
        where: buildTagTeamWhere(search, leagueType),
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

    const mappedOneVOne = oneVOneBattles.map(battle => {
      const format = battle.battleType === 'league_2v2' || battle.battleType === 'league_3v3' ? '2v2' : '1v1';
      return mapBattleRecord(battle, format as '1v1' | '2v2');
    });
    const mappedTagTeam = tagTeamBattles.map(battle => mapBattleRecord(battle, '2v2'));

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
    battles: battles.map(battle => {
      const format = battle.battleType === 'league_2v2' || battle.battleType === 'league_3v3' ? '2v2' : '1v1';
      return mapBattleRecord(battle, format as '1v1' | '2v2');
    }),
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

  // Check if this is a tag team battle and resolve team data from participants
  const isTagTeam = battle.battleType === 'tag_team';
  let tagTeamData: { team1: unknown; team2: unknown } | null = null;

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
      tagOutTimeMs: true,
    },
  });

  // Derive tag-team robot IDs from participants (replaces deprecated Battle columns)
  const team1ActiveParticipant = participants.find(p => p.team === 1 && p.role === 'active');
  const team1ReserveParticipant = participants.find(p => p.team === 1 && p.role === 'reserve');
  const team2ActiveParticipant = participants.find(p => p.team === 2 && p.role === 'active');
  const team2ReserveParticipant = participants.find(p => p.team === 2 && p.role === 'reserve');

  if (isTagTeam && team1ActiveParticipant) {
    // Find teams via their member robots
    const [team1, team2] = await Promise.all([
      prisma.teamBattle.findFirst({
        where: {
          teamSize: 2,
          members: { some: { robotId: team1ActiveParticipant.robotId } },
        },
        include: {
          members: {
            include: { robot: { select: { id: true, name: true, userId: true } } },
            orderBy: { slotIndex: 'asc' },
          },
        },
      }),
      team2ActiveParticipant
        ? prisma.teamBattle.findFirst({
            where: {
              teamSize: 2,
              members: { some: { robotId: team2ActiveParticipant.robotId } },
            },
            include: {
              members: {
                include: { robot: { select: { id: true, name: true, userId: true } } },
                orderBy: { slotIndex: 'asc' },
              },
            },
          })
        : null,
    ]);

    if (team1) {
      // Read league from standings
      const [team1Standing, team2Standing] = await Promise.all([
        prisma.standing.findFirst({ where: { entityType: 'team', entityId: team1.id, mode: 'tag_team' as any }, select: { tier: true } }),
        team2 ? prisma.standing.findFirst({ where: { entityType: 'team', entityId: team2.id, mode: 'tag_team' as any }, select: { tier: true } }) : null,
      ]);

      tagTeamData = {
        team1: {
          id: team1.id,
          activeRobot: team1.members[0]?.robot,
          reserveRobot: team1.members[1]?.robot,
          stableId: team1.stableId,
          league: team1Standing?.tier ?? 'bronze',
        },
        team2: team2
          ? {
              id: team2.id,
              activeRobot: team2.members[0]?.robot,
              reserveRobot: team2.members[1]?.robot,
              stableId: team2.stableId,
              league: team2Standing?.tier ?? 'bronze',
            }
          : null,
      };
    }
  }

  const isTagTeamBattle = isTagTeam && tagTeamData !== null;

  // Derive ELO data from participants (replaces deprecated Battle ELO columns)
  const robot1Participant = participants.find(p => p.robotId === battle.robot1Id);
  const robot2Participant = participants.find(p => p.robotId === battle.robot2Id);

  // Build base response (shared between 1v1 and 2v2)
  const baseResponse = {
    id: battle.id,
    battleType: battle.battleType,
    leagueType: battle.leagueType,
    durationSeconds: battle.durationSeconds,
    createdAt: battle.createdAt,
    battleFormat: isTagTeamBattle ? '2v2' as const : '1v1' as const,

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

    robot1ELOBefore: robot1Participant?.eloBefore ?? 0,
    robot2ELOBefore: robot2Participant?.eloBefore ?? 0,
    robot1ELOAfter: robot1Participant?.eloAfter ?? 0,
    robot2ELOAfter: robot2Participant?.eloAfter ?? 0,
    eloChange: robot1Participant ? Math.abs(robot1Participant.eloAfter - robot1Participant.eloBefore) : 0,

    winnerReward: battle.winnerReward,
    loserReward: battle.loserReward,

    team1ActiveRobotId: team1ActiveParticipant?.robotId ?? null,
    team1ReserveRobotId: team1ReserveParticipant?.robotId ?? null,
    team2ActiveRobotId: team2ActiveParticipant?.robotId ?? null,
    team2ReserveRobotId: team2ReserveParticipant?.robotId ?? null,
    team1TagOutTime: team1ActiveParticipant?.tagOutTimeMs
      ? Number(team1ActiveParticipant.tagOutTimeMs) / 1000
      : ((battle.battleLog as unknown as { team1TagOutTime?: number } | null)?.team1TagOutTime ?? null) != null
        ? (battle.battleLog as unknown as { team1TagOutTime: number }).team1TagOutTime / 1000
        : null,
    team2TagOutTime: team2ActiveParticipant?.tagOutTimeMs
      ? Number(team2ActiveParticipant.tagOutTimeMs) / 1000
      : ((battle.battleLog as unknown as { team2TagOutTime?: number } | null)?.team2TagOutTime ?? null) != null
        ? (battle.battleLog as unknown as { team2TagOutTime: number }).team2TagOutTime / 1000
        : null,

    battleLog: battle.battleLog ?? { pruned: true },
  };

  // Append tag team data when present
  if (isTagTeamBattle && tagTeamData) {
    return {
      ...baseResponse,
      teams: tagTeamData,
    };
  }

  return baseResponse;
}
