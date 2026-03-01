import express, { Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import prisma from '../lib/prisma';
import { getConfig } from '../config/env';
import { getNextCronOccurrence } from '../utils/scheduleUtils';

const router = express.Router();

/**
 * GET /api/matches/upcoming
 * Get upcoming scheduled matches and tournament matches for the current user's robots
 */
router.get('/upcoming', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's robots
    const userRobots = await prisma.robot.findMany({
      where: { userId: req.user.userId },
      select: { id: true },
    });

    const robotIds = userRobots.map(r => r.id);

    // Get user's tag teams
    const userTeams = await prisma.tagTeam.findMany({
      where: { stableId: req.user.userId },
      select: { id: true },
    });

    const teamIds = userTeams.map(t => t.id);

    // Get scheduled league matches involving user's robots
    const leagueMatches = await prisma.scheduledMatch.findMany({
      where: {
        status: 'scheduled',
        OR: [
          { robot1Id: { in: robotIds } },
          { robot2Id: { in: robotIds } },
        ],
      },
      include: {
        robot1: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        robot2: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        scheduledFor: 'asc',
      },
    });

    // Get tournament matches involving user's robots (pending or scheduled status, not completed)
    const tournamentMatches = await prisma.tournamentMatch.findMany({
      where: {
        status: { in: ['pending', 'scheduled'] },
        OR: [
          { robot1Id: { in: robotIds } },
          { robot2Id: { in: robotIds } },
        ],
      },
      include: {
        robot1: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        robot2: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            currentRound: true,
            maxRounds: true,
          },
        },
      },
      orderBy: {
        round: 'asc',
      },
    });

    // Get recently completed bye matches for user's robots in active tournaments
    // These are auto-completed at tournament creation and the user never sees them
    const tournamentByeMatches = await prisma.tournamentMatch.findMany({
      where: {
        isByeMatch: true,
        status: 'completed',
        robot1Id: { in: robotIds },
        tournament: {
          status: 'active',
        },
      },
      include: {
        robot1: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        robot2: true,
        tournament: {
          select: {
            id: true,
            name: true,
            currentRound: true,
            maxRounds: true,
          },
        },
      },
      orderBy: {
        round: 'asc',
      },
    });

    // Format league matches
    const formattedLeagueMatches = leagueMatches.map(match => ({
      id: match.id,
      matchType: 'league',
      robot1Id: match.robot1Id,
      robot2Id: match.robot2Id,
      leagueType: match.leagueType,
      scheduledFor: match.scheduledFor,
      status: match.status,
      robot1: {
        id: match.robot1.id,
        name: match.robot1.name,
        elo: match.robot1.elo,
        currentHP: match.robot1.currentHP,
        maxHP: match.robot1.maxHP,
        userId: match.robot1.userId,
        user: {
          username: match.robot1.user.username,
        },
      },
      robot2: {
        id: match.robot2.id,
        name: match.robot2.name,
        elo: match.robot2.elo,
        currentHP: match.robot2.currentHP,
        maxHP: match.robot2.maxHP,
        userId: match.robot2.userId,
        user: {
          username: match.robot2.user.username,
        },
      },
    }));

    // Format tournament matches
    const formattedTournamentMatches = tournamentMatches.map(match => ({
      id: `tournament-${match.id}`,
      matchType: 'tournament',
      tournamentId: match.tournamentId,
      tournamentName: match.tournament.name,
      tournamentRound: match.round,
      currentRound: match.tournament.currentRound,
      maxRounds: match.tournament.maxRounds,
      robot1Id: match.robot1Id,
      robot2Id: match.robot2Id,
      isByeMatch: match.isByeMatch,
      leagueType: 'tournament', // Use 'tournament' as league type for display
      scheduledFor: getNextCronOccurrence(getConfig().tournamentSchedule).toISOString(),
      status: match.status,
      robot1: match.robot1 ? {
        id: match.robot1.id,
        name: match.robot1.name,
        elo: match.robot1.elo,
        currentHP: match.robot1.currentHP,
        maxHP: match.robot1.maxHP,
        userId: match.robot1.userId,
        user: {
          username: match.robot1.user.username,
        },
      } : null,
      robot2: match.robot2 ? {
        id: match.robot2.id,
        name: match.robot2.name,
        elo: match.robot2.elo,
        currentHP: match.robot2.currentHP,
        maxHP: match.robot2.maxHP,
        userId: match.robot2.userId,
        user: {
          username: match.robot2.user.username,
        },
      } : null,
    }));

    // Format tournament bye matches
    const formattedByeMatches = tournamentByeMatches.map(match => ({
      id: `tournament-bye-${match.id}`,
      matchType: 'tournament',
      tournamentId: match.tournamentId,
      tournamentName: match.tournament.name,
      tournamentRound: match.round,
      currentRound: match.tournament.currentRound,
      maxRounds: match.tournament.maxRounds,
      robot1Id: match.robot1Id,
      robot2Id: null,
      isByeMatch: true,
      leagueType: 'tournament',
      scheduledFor: getNextCronOccurrence(getConfig().tournamentSchedule).toISOString(),
      status: 'bye',
      robot1: match.robot1 ? {
        id: match.robot1.id,
        name: match.robot1.name,
        elo: match.robot1.elo,
        currentHP: match.robot1.currentHP,
        maxHP: match.robot1.maxHP,
        userId: match.robot1.userId,
        user: {
          username: match.robot1.user.username,
        },
      } : null,
      robot2: null,
    }));

    // Get scheduled tag team matches involving user's teams
    const tagTeamMatches = await prisma.tagTeamMatch.findMany({
      where: {
        status: 'scheduled',
        OR: [
          { team1Id: { in: teamIds } },
          { team2Id: { in: teamIds } },
        ],
      },
      include: {
        team1: {
          include: {
            activeRobot: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
            reserveRobot: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
            stable: {
              select: {
                stableName: true,
              },
            },
          },
        },
        team2: {
          include: {
            activeRobot: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
            reserveRobot: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
            stable: {
              select: {
                stableName: true,
              },
            },
          },
        },
      },
      orderBy: {
        scheduledFor: 'asc',
      },
    });

    // Format tag team matches
    const formattedTagTeamMatches = tagTeamMatches
      .filter(match => match.team2 !== null) // Filter out bye matches for upcoming matches
      .map(match => ({
      id: `tag-team-${match.id}`,
      matchType: 'tag_team',
      team1Id: match.team1Id,
      team2Id: match.team2Id,
      tagTeamLeague: match.tagTeamLeague,
      scheduledFor: match.scheduledFor,
      status: match.status,
      team1: {
        id: match.team1.id,
        stableName: match.team1.stable?.stableName || null,
        activeRobot: {
          id: match.team1.activeRobot.id,
          name: match.team1.activeRobot.name,
          elo: match.team1.activeRobot.elo,
          currentHP: match.team1.activeRobot.currentHP,
          maxHP: match.team1.activeRobot.maxHP,
          userId: match.team1.activeRobot.userId,
          user: {
            username: match.team1.activeRobot.user.username,
          },
        },
        reserveRobot: {
          id: match.team1.reserveRobot.id,
          name: match.team1.reserveRobot.name,
          elo: match.team1.reserveRobot.elo,
          currentHP: match.team1.reserveRobot.currentHP,
          maxHP: match.team1.reserveRobot.maxHP,
          userId: match.team1.reserveRobot.userId,
          user: {
            username: match.team1.reserveRobot.user.username,
          },
        },
        combinedELO: match.team1.activeRobot.elo + match.team1.reserveRobot.elo,
      },
      team2: {
        id: match.team2!.id,
        stableName: match.team2!.stable?.stableName || null,
        activeRobot: {
          id: match.team2!.activeRobot.id,
          name: match.team2!.activeRobot.name,
          elo: match.team2!.activeRobot.elo,
          currentHP: match.team2!.activeRobot.currentHP,
          maxHP: match.team2!.activeRobot.maxHP,
          userId: match.team2!.activeRobot.userId,
          user: {
            username: match.team2!.activeRobot.user.username,
          },
        },
        reserveRobot: {
          id: match.team2!.reserveRobot.id,
          name: match.team2!.reserveRobot.name,
          elo: match.team2!.reserveRobot.elo,
          currentHP: match.team2!.reserveRobot.currentHP,
          maxHP: match.team2!.reserveRobot.maxHP,
          userId: match.team2!.reserveRobot.userId,
          user: {
            username: match.team2!.reserveRobot.user.username,
          },
        },
        combinedELO: match.team2!.activeRobot.elo + match.team2!.reserveRobot.elo,
      },
    }));

    // Combine all types of matches
    const allMatches = [...formattedLeagueMatches, ...formattedTournamentMatches, ...formattedByeMatches, ...formattedTagTeamMatches];

    res.json({
      matches: allMatches,
      total: allMatches.length,
      leagueMatches: formattedLeagueMatches.length,
      tournamentMatches: formattedTournamentMatches.length + formattedByeMatches.length,
      tagTeamMatches: formattedTagTeamMatches.length,
    });
  } catch (error) {
    console.error('[Matches API] Error fetching upcoming matches:', error);
    res.status(500).json({
      error: 'Failed to fetch upcoming matches',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/matches/history
 * Get paginated battle history for the current user's robots
 */
router.get('/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 20));
    const robotId = req.query.robotId ? parseInt(req.query.robotId as string) : undefined;
    const battleType = req.query.battleType as string | undefined;

    // Get user's robots
    const userRobots = await prisma.robot.findMany({
      where: { userId: req.user.userId },
      select: { id: true },
    });

    const robotIds = userRobots.map(r => r.id);

    // If robotId filter is provided, verify ownership
    if (robotId !== undefined && !robotIds.includes(robotId)) {
      return res.status(403).json({ error: 'Access denied to robot data' });
    }

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: Record<string, any> = {
      OR: [
        { robot1Id: { in: robotId !== undefined ? [robotId] : robotIds } },
        { robot2Id: { in: robotId !== undefined ? [robotId] : robotIds } },
      ],
    };

    // Add battle type filter if specified
    if (battleType === 'league') {
      whereClause.AND = [
        { battleType: { notIn: ['tournament', 'tag_team'] } }
      ];
    } else if (battleType === 'tournament') {
      whereClause.battleType = 'tournament';
    } else if (battleType === 'tag_team') {
      whereClause.battleType = 'tag_team';
    }

    // Get total count
    const total = await prisma.battle.count({ where: whereClause });

    // Get battles with pagination
    const battles = await prisma.battle.findMany({
      where: whereClause,
      include: {
        robot1: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        robot2: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            maxRounds: true,
          },
        },
        participants: true, // Include BattleParticipant data
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Format response to match frontend BattleHistory interface
    const formattedBattles = await Promise.all(battles.map(async (battle) => {
      const robot1Participant = battle.participants.find(p => p.robotId === battle.robot1Id);
      const robot2Participant = battle.participants.find(p => p.robotId === battle.robot2Id);
      
      const baseData = {
        id: battle.id,
        robot1Id: battle.robot1Id,
        robot2Id: battle.robot2Id,
        winnerId: battle.winnerId,
        createdAt: battle.createdAt,
        durationSeconds: battle.durationSeconds,
        robot1ELOBefore: robot1Participant?.eloBefore || 0,
        robot1ELOAfter: robot1Participant?.eloAfter || 0,
        robot2ELOBefore: robot2Participant?.eloBefore || 0,
        robot2ELOAfter: robot2Participant?.eloAfter || 0,
        robot1FinalHP: robot1Participant?.finalHP || 0,
        robot2FinalHP: robot2Participant?.finalHP || 0,
        winnerReward: battle.winnerReward,
        loserReward: battle.loserReward,
        battleType: battle.battleType,
        leagueType: battle.leagueType, // League at time of battle
        tournamentId: battle.tournamentId,
        tournamentRound: battle.tournamentRound,
        tournamentName: battle.tournament?.name,
        tournamentMaxRounds: battle.tournament?.maxRounds,
        robot1: {
          id: battle.robot1.id,
          name: battle.robot1.name,
          userId: battle.robot1.userId,
          currentLeague: battle.robot1.currentLeague,
          leagueId: battle.robot1.leagueId,
          user: {
            username: battle.robot1.user.username,
          },
        },
        robot2: {
          id: battle.robot2.id,
          name: battle.robot2.name,
          userId: battle.robot2.userId,
          currentLeague: battle.robot2.currentLeague,
          leagueId: battle.robot2.leagueId,
          user: {
            username: battle.robot2.user.username,
          },
        },
      };

      // Add tag team specific data if it's a tag team battle
      if (battle.battleType === 'tag_team') {
        const tagTeamMatch = await prisma.tagTeamMatch.findFirst({
          where: { battleId: battle.id },
          include: {
            team1: {
              include: {
                stable: {
                  select: { stableName: true },
                },
                activeRobot: {
                  select: { id: true, name: true },
                },
                reserveRobot: {
                  select: { id: true, name: true },
                },
              },
            },
            team2: {
              include: {
                stable: {
                  select: { stableName: true },
                },
                activeRobot: {
                  select: { id: true, name: true },
                },
                reserveRobot: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        });

        return {
          ...baseData,
          team1Id: tagTeamMatch?.team1Id || null,
          team2Id: tagTeamMatch?.team2Id || null,
          team1StableName: tagTeamMatch?.team1?.stable?.stableName || null,
          team2StableName: tagTeamMatch?.team2?.stable?.stableName || null,
          team1ActiveRobotId: battle.team1ActiveRobotId,
          team1ReserveRobotId: battle.team1ReserveRobotId,
          team2ActiveRobotId: battle.team2ActiveRobotId,
          team2ReserveRobotId: battle.team2ReserveRobotId,
          team1ActiveRobotName: tagTeamMatch?.team1?.activeRobot?.name || null,
          team1ReserveRobotName: tagTeamMatch?.team1?.reserveRobot?.name || null,
          team2ActiveRobotName: tagTeamMatch?.team2?.activeRobot?.name || null,
          team2ReserveRobotName: tagTeamMatch?.team2?.reserveRobot?.name || null,
        };
      }

      return baseData;
    }));

    res.json({
      data: formattedBattles,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error('[Matches API] Error fetching battle history:', error);
    res.status(500).json({
      error: 'Failed to fetch battle history',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/matches/battles/:id/log
 * Get detailed battle log with combat messages for a specific battle
 */
router.get('/battles/:id/log', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const battleId = parseInt(req.params.id);

    // Get battle with full details
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        robot1: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
        robot2: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    // Convert BigInt fields to numbers immediately after fetching
    // Tag out times are stored in milliseconds, convert to seconds for display
    const battleData = {
      ...battle,
      team1TagOutTime: battle.team1TagOutTime ? Number(battle.team1TagOutTime) / 1000 : null,
      team2TagOutTime: battle.team2TagOutTime ? Number(battle.team2TagOutTime) / 1000 : null,
    };

    // All battles are public - no access restriction needed for Hall of Records

    // Get streaming revenue data from BattleParticipant table
    const battleParticipants = await prisma.battleParticipant.findMany({
      where: { battleId },
    });

    // Map participants by robotId for easy lookup
    const participantMap = new Map(
      battleParticipants.map(p => [p.robotId, p])
    );

    const robot1Participant = participantMap.get(battle.robot1Id);
    const robot2Participant = participantMap.get(battle.robot2Id);
    
    const streamingRevenue1 = robot1Participant?.streamingRevenue || 0;
    const streamingRevenue2 = robot2Participant?.streamingRevenue || 0;

    // Build response based on battle type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseResponse: Record<string, any> = {
      battleId: battleData.id,
      createdAt: battleData.createdAt,
      battleType: battleData.battleType,
      leagueType: battleData.leagueType,
      duration: battleData.durationSeconds,
      battleLog: typeof battleData.battleLog === 'object' && battleData.battleLog !== null 
        ? JSON.parse(JSON.stringify(battleData.battleLog, (key, value) =>
            typeof value === 'bigint' ? Number(value) : value
          ))
        : battleData.battleLog,
    };

    // Add tag team specific fields if it's a tag team battle
    if (battleData.battleType === 'tag_team' && battleData.team1ActiveRobotId && battleData.team2ActiveRobotId) {
      // Fetch tag team robots separately since they're scalar fields
      const [team1Active, team1Reserve, team2Active, team2Reserve] = await Promise.all([
        battleData.team1ActiveRobotId ? prisma.robot.findUnique({
          where: { id: battleData.team1ActiveRobotId },
          include: { user: { select: { id: true, username: true } } },
        }) : null,
        battleData.team1ReserveRobotId ? prisma.robot.findUnique({
          where: { id: battleData.team1ReserveRobotId },
          include: { user: { select: { id: true, username: true } } },
        }) : null,
        battleData.team2ActiveRobotId ? prisma.robot.findUnique({
          where: { id: battleData.team2ActiveRobotId },
          include: { user: { select: { id: true, username: true } } },
        }) : null,
        battleData.team2ReserveRobotId ? prisma.robot.findUnique({
          where: { id: battleData.team2ReserveRobotId },
          include: { user: { select: { id: true, username: true } } },
        }) : null,
      ]);

      // Get the tag team match to find team IDs
      const tagTeamMatch = await prisma.tagTeamMatch.findFirst({
        where: { battleId: battleData.id },
        select: { team1Id: true, team2Id: true },
      });

      // Get team details including stable names
      const [team1Details, team2Details] = await Promise.all([
        tagTeamMatch?.team1Id ? prisma.tagTeam.findUnique({
          where: { id: tagTeamMatch.team1Id },
          include: {
            stable: {
              select: { stableName: true },
            },
          },
        }) : null,
        tagTeamMatch?.team2Id ? prisma.tagTeam.findUnique({
          where: { id: tagTeamMatch.team2Id },
          include: {
            stable: {
              select: { stableName: true },
            },
          },
        }) : null,
      ]);

      baseResponse.tagTeam = {
        team1: {
          teamId: tagTeamMatch?.team1Id || null,
          stableName: team1Details?.stable?.stableName || null,
          activeRobot: team1Active ? {
            id: team1Active.id,
            name: team1Active.name,
            owner: team1Active.user.username,
            damageDealt: battleData.team1ActiveDamageDealt,
            fameAwarded: battleData.team1ActiveFameAwarded,
          } : null,
          reserveRobot: team1Reserve ? {
            id: team1Reserve.id,
            name: team1Reserve.name,
            owner: team1Reserve.user.username,
            damageDealt: battleData.team1ReserveDamageDealt,
            fameAwarded: battleData.team1ReserveFameAwarded,
          } : null,
          tagOutTime: battleData.team1TagOutTime, // Already converted to seconds
        },
        team2: {
          teamId: tagTeamMatch?.team2Id || null,
          stableName: team2Details?.stable?.stableName || null,
          activeRobot: team2Active ? {
            id: team2Active.id,
            name: team2Active.name,
            owner: team2Active.user.username,
            damageDealt: battleData.team2ActiveDamageDealt,
            fameAwarded: battleData.team2ActiveFameAwarded,
          } : null,
          reserveRobot: team2Reserve ? {
            id: team2Reserve.id,
            name: team2Reserve.name,
            owner: team2Reserve.user.username,
            damageDealt: battleData.team2ReserveDamageDealt,
            fameAwarded: battleData.team2ReserveFameAwarded,
          } : null,
          tagOutTime: battleData.team2TagOutTime, // Already converted to seconds
        },
      };
    }

    // Add standard robot fields (for 1v1 and tournament battles)
    // For tag team battles, these represent team-level aggregates
    if (battleData.battleType === 'tag_team' && baseResponse.tagTeam) {
      const _team1Id = baseResponse.tagTeam.team1.teamId;
      const _team2Id = baseResponse.tagTeam.team2.teamId;
      
      // For tag team battles, provide team-level summary (not per-robot)
      // For tag teams, sum up data from all team members using BattleParticipant
      const team1Participants = battleParticipants.filter(p => p.team === 1);
      const team2Participants = battleParticipants.filter(p => p.team === 2);
      
      const team1StreamingRevenue = team1Participants.reduce((sum, p) => sum + (p.streamingRevenue || 0), 0);
      const team2StreamingRevenue = team2Participants.reduce((sum, p) => sum + (p.streamingRevenue || 0), 0);
      
      const team1Credits = team1Participants.reduce((sum, p) => sum + (p.credits || 0), 0);
      const team2Credits = team2Participants.reduce((sum, p) => sum + (p.credits || 0), 0);
      
      const team1Prestige = team1Participants.reduce((sum, p) => sum + (p.prestigeAwarded || 0), 0);
      const team2Prestige = team2Participants.reduce((sum, p) => sum + (p.prestigeAwarded || 0), 0);
      
      const team1Fame = team1Participants.reduce((sum, p) => sum + (p.fameAwarded || 0), 0);
      const team2Fame = team2Participants.reduce((sum, p) => sum + (p.fameAwarded || 0), 0);
      
      const team1Damage = team1Participants.reduce((sum, p) => sum + (p.damageDealt || 0), 0);
      const team2Damage = team2Participants.reduce((sum, p) => sum + (p.damageDealt || 0), 0);
      
      baseResponse.team1Summary = {
        reward: team1Credits,
        prestige: team1Prestige,
        totalDamage: team1Damage,
        totalFame: team1Fame,
        streamingRevenue: team1StreamingRevenue,
      };
      
      baseResponse.team2Summary = {
        reward: team2Credits,
        prestige: team2Prestige,
        totalDamage: team2Damage,
        totalFame: team2Fame,
        streamingRevenue: team2StreamingRevenue,
      };
    } else {
      // For 1v1 and tournament battles, provide robot-level details from BattleParticipant
      
      baseResponse.robot1 = {
        id: battleData.robot1.id,
        name: battleData.robot1.name,
        owner: battleData.robot1.user.username,
        eloBefore: robot1Participant?.eloBefore || 0,
        eloAfter: robot1Participant?.eloAfter || 0,
        finalHP: robot1Participant?.finalHP ?? 0,
        damageDealt: robot1Participant?.damageDealt ?? 0,
        reward: robot1Participant?.credits ?? 0,
        prestige: robot1Participant?.prestigeAwarded ?? 0,
        fame: robot1Participant?.fameAwarded ?? 0,
        streamingRevenue: streamingRevenue1,
      };

      baseResponse.robot2 = {
        id: battleData.robot2.id,
        name: battleData.robot2.name,
        owner: battleData.robot2.user.username,
        eloBefore: robot2Participant?.eloBefore || 0,
        eloAfter: robot2Participant?.eloAfter || 0,
        finalHP: robot2Participant?.finalHP ?? 0,
        damageDealt: robot2Participant?.damageDealt ?? 0,
        reward: robot2Participant?.credits ?? 0,
        prestige: robot2Participant?.prestigeAwarded ?? 0,
        fame: robot2Participant?.fameAwarded ?? 0,
        streamingRevenue: streamingRevenue2,
      };
    }

    // Determine winner based on battle type
    if (battleData.battleType === 'tag_team' && baseResponse.tagTeam) {
      // For tag team battles, winnerId is the team ID, not robot ID
      const team1Id = baseResponse.tagTeam.team1.teamId;
      const team2Id = baseResponse.tagTeam.team2.teamId;
      baseResponse.winner = battleData.winnerId === team1Id ? 'robot1' : battleData.winnerId === team2Id ? 'robot2' : null;
    } else {
      // For 1v1 battles, winnerId is the robot ID
      baseResponse.winner = battleData.winnerId === battleData.robot1Id ? 'robot1' : battleData.winnerId === battleData.robot2Id ? 'robot2' : null;
    }

    // Format battle log response
    res.json(baseResponse);
  } catch (error) {
    console.error('[Matches API] Error fetching battle log:', error);
    res.status(500).json({
      error: 'Failed to fetch battle log',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
