import express, { Request, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import prisma from '../lib/prisma';

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
      leagueType: 'tournament', // Use 'tournament' as league type for display
      scheduledFor: new Date().toISOString(), // Tournaments don't have scheduled time
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
    const allMatches = [...formattedLeagueMatches, ...formattedTournamentMatches, ...formattedTagTeamMatches];

    res.json({
      matches: allMatches,
      total: allMatches.length,
      leagueMatches: formattedLeagueMatches.length,
      tournamentMatches: formattedTournamentMatches.length,
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
    const whereClause: any = {
      OR: [
        { robot1Id: { in: robotId !== undefined ? [robotId] : robotIds } },
        { robot2Id: { in: robotId !== undefined ? [robotId] : robotIds } },
      ],
    };

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
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Format response to match frontend BattleHistory interface
    const formattedBattles = await Promise.all(battles.map(async (battle) => {
      const baseData = {
        id: battle.id,
        robot1Id: battle.robot1Id,
        robot2Id: battle.robot2Id,
        winnerId: battle.winnerId,
        createdAt: battle.createdAt,
        durationSeconds: battle.durationSeconds,
        robot1ELOBefore: battle.robot1ELOBefore,
        robot1ELOAfter: battle.robot1ELOAfter,
        robot2ELOBefore: battle.robot2ELOBefore,
        robot2ELOAfter: battle.robot2ELOAfter,
        robot1FinalHP: battle.robot1FinalHP,
        robot2FinalHP: battle.robot2FinalHP,
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

    // Get user's robots to verify access
    const userRobots = await prisma.robot.findMany({
      where: { userId: req.user.userId },
      select: { id: true },
    });

    const robotIds = userRobots.map(r => r.id);

    // Verify user has access to this battle
    if (!robotIds.includes(battleData.robot1Id) && !robotIds.includes(battleData.robot2Id)) {
      // For tag team battles, also check if user owns any of the team robots
      const isTagTeamBattle = battleData.battleType === 'tag_team';
      if (isTagTeamBattle) {
        const hasAccess = 
          (battleData.team1ActiveRobotId && robotIds.includes(battleData.team1ActiveRobotId)) ||
          (battleData.team1ReserveRobotId && robotIds.includes(battleData.team1ReserveRobotId)) ||
          (battleData.team2ActiveRobotId && robotIds.includes(battleData.team2ActiveRobotId)) ||
          (battleData.team2ReserveRobotId && robotIds.includes(battleData.team2ReserveRobotId));
        
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied to battle data' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied to battle data' });
      }
    }

    // Get streaming revenue data from audit log
    const battleCompleteEvent = await prisma.auditLog.findFirst({
      where: {
        eventType: 'battle_complete',
        payload: {
          path: ['battleId'],
          equals: battleId,
        },
      },
      orderBy: { id: 'desc' },
    });

    const payload = battleCompleteEvent?.payload as any;
    const streamingRevenue1 = payload?.streamingRevenue1 || 0;
    const streamingRevenue2 = payload?.streamingRevenue2 || 0;
    const streamingRevenueDetails1 = payload?.streamingRevenueDetails1 || null;
    const streamingRevenueDetails2 = payload?.streamingRevenueDetails2 || null;

    // Build response based on battle type
    const baseResponse: any = {
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
    let robot1IsWinner = false;
    let robot2IsWinner = false;
    
    if (battleData.battleType === 'tag_team' && baseResponse.tagTeam) {
      const team1Id = baseResponse.tagTeam.team1.teamId;
      const team2Id = baseResponse.tagTeam.team2.teamId;
      robot1IsWinner = battleData.winnerId === team1Id;
      robot2IsWinner = battleData.winnerId === team2Id;
      
      // For tag team battles, provide team-level summary (not per-robot)
      baseResponse.team1Summary = {
        reward: robot1IsWinner ? battleData.winnerReward : battleData.loserReward,
        prestige: battleData.robot1PrestigeAwarded,
        totalDamage: battleData.robot1DamageDealt,
        totalFame: battleData.robot1FameAwarded,
        streamingRevenue: streamingRevenue1,
        streamingRevenueDetails: streamingRevenueDetails1,
      };
      
      baseResponse.team2Summary = {
        reward: robot2IsWinner ? battleData.winnerReward : battleData.loserReward,
        prestige: battleData.robot2PrestigeAwarded,
        totalDamage: battleData.robot2DamageDealt,
        totalFame: battleData.robot2FameAwarded,
        streamingRevenue: streamingRevenue2,
        streamingRevenueDetails: streamingRevenueDetails2,
      };
    } else {
      // For 1v1 and tournament battles, provide robot-level details
      robot1IsWinner = battleData.winnerId === battleData.robot1Id;
      robot2IsWinner = battleData.winnerId === battleData.robot2Id;
      
      baseResponse.robot1 = {
        id: battleData.robot1.id,
        name: battleData.robot1.name,
        owner: battleData.robot1.user.username,
        eloBefore: battleData.robot1ELOBefore,
        eloAfter: battleData.robot1ELOAfter,
        finalHP: battleData.robot1FinalHP,
        damageDealt: battleData.robot1DamageDealt,
        reward: robot1IsWinner ? battleData.winnerReward : battleData.loserReward,
        prestige: battleData.robot1PrestigeAwarded,
        fame: battleData.robot1FameAwarded,
        streamingRevenue: streamingRevenue1,
        streamingRevenueDetails: streamingRevenueDetails1,
      };

      baseResponse.robot2 = {
        id: battleData.robot2.id,
        name: battleData.robot2.name,
        owner: battleData.robot2.user.username,
        eloBefore: battleData.robot2ELOBefore,
        eloAfter: battleData.robot2ELOAfter,
        finalHP: battleData.robot2FinalHP,
        damageDealt: battleData.robot2DamageDealt,
        reward: robot2IsWinner ? battleData.winnerReward : battleData.loserReward,
        prestige: battleData.robot2PrestigeAwarded,
        fame: battleData.robot2FameAwarded,
        streamingRevenue: streamingRevenue2,
        streamingRevenueDetails: streamingRevenueDetails2,
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
