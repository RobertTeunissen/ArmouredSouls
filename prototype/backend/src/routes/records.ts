import express, { Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = express.Router();

// Helper to get display name (stableName or username fallback)
const getUserDisplayName = (user: { username: string; stableName?: string | null }) => {
  return user.stableName || user.username;
};

// User select for records (includes stableName)
const userSelect = {
  username: true,
  stableName: true,
};

/**
 * GET /api/records
 * Get all Hall of Records statistics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // =========================
    // COMBAT RECORDS
    // =========================

    // Fastest Victory - Top 10
    const fastestVictories = await prisma.battle.findMany({
      where: {
        winnerId: { not: null },
        durationSeconds: { gt: 0 },
      },
      orderBy: { durationSeconds: 'asc' },
      take: 10,
      include: {
        robot1: {
          include: { user: { select: userSelect } }
        },
        robot2: {
          include: { user: { select: userSelect } }
        },
      },
    });

    // Longest Battle - Top 10
    const longestBattles = await prisma.battle.findMany({
      where: {
        winnerId: { not: null },
      },
      orderBy: { durationSeconds: 'desc' },
      take: 10,
      include: {
        robot1: {
          include: { user: { select: userSelect } }
        },
        robot2: {
          include: { user: { select: userSelect } }
        },
      },
    });

    // Most Damage in Single Battle - Top 10
    const battleParticipants = await prisma.battleParticipant.findMany({
      select: {
        battleId: true,
        robotId: true,
        damageDealt: true,
        battle: {
          select: {
            id: true,
            durationSeconds: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        damageDealt: 'desc',
      },
      take: 10,
    });

    const mostDamageDataList = [];
    for (const participant of battleParticipants) {
      const battle = await prisma.battle.findUnique({
        where: { id: participant.battleId },
        include: {
          robot1: {
            include: { user: { select: userSelect } }
          },
          robot2: {
            include: { user: { select: userSelect } }
          },
        },
      });

      if (battle) {
        const robot = participant.robotId === battle.robot1Id ? battle.robot1 : battle.robot2;
        const opponent = participant.robotId === battle.robot1Id ? battle.robot2 : battle.robot1;
        
        mostDamageDataList.push({
          battle,
          damageDealt: participant.damageDealt,
          robotId: participant.robotId,
          robot,
          opponent,
        });
      }
    }

    // Narrowest Victory - Top 10 winners with lowest remaining HP
    const narrowestParticipants = await prisma.battleParticipant.findMany({
      where: {
        finalHP: { gt: 0 },
        battle: {
          winnerId: { not: null },
        },
      },
      select: {
        battleId: true,
        robotId: true,
        finalHP: true,
        battle: {
          select: {
            winnerId: true,
            robot1Id: true,
            robot2Id: true,
          },
        },
      },
    });

    // Filter to only winners and sort by HP
    const winnerParticipants = narrowestParticipants
      .filter(p => p.battle.winnerId === p.robotId)
      .sort((a, b) => a.finalHP - b.finalHP)
      .slice(0, 10);

    const narrowestVictories = [];
    for (const participant of winnerParticipants) {
      const battle = await prisma.battle.findUnique({
        where: { id: participant.battleId },
        include: {
          robot1: {
            include: { user: { select: userSelect } }
          },
          robot2: {
            include: { user: { select: userSelect } }
          },
        },
      });
      
      if (battle) {
        narrowestVictories.push({
          battle,
          remainingHP: participant.finalHP,
        });
      }
    }

    // =========================
    // UPSET RECORDS
    // =========================

    // Biggest Upset - Top 10 (biggest ELO difference where underdog won)
    const allBattlesForUpset = await prisma.battle.findMany({
      where: {
        winnerId: { not: null },
      },
      select: {
        id: true,
        winnerId: true,
        robot1Id: true,
        robot2Id: true,
        robot1ELOBefore: true,
        robot2ELOBefore: true,
      },
    });

    const upsetBattles = [];
    for (const battle of allBattlesForUpset) {
      const winnerELO = battle.winnerId === battle.robot1Id 
        ? battle.robot1ELOBefore 
        : battle.robot2ELOBefore;
      const loserELO = battle.winnerId === battle.robot1Id 
        ? battle.robot2ELOBefore 
        : battle.robot1ELOBefore;
      
      // Only count if underdog won (lower ELO beat higher ELO)
      if (winnerELO < loserELO) {
        const upsetDiff = loserELO - winnerELO;
        upsetBattles.push({ battleId: battle.id, upsetDiff });
      }
    }

    // Sort by upset difference and take top 10
    upsetBattles.sort((a, b) => b.upsetDiff - a.upsetDiff);
    const top10Upsets = upsetBattles.slice(0, 10);

    const biggestUpsets = [];
    for (const upset of top10Upsets) {
      const battle = await prisma.battle.findUnique({
        where: { id: upset.battleId },
        include: {
          robot1: {
            include: { user: { select: userSelect } }
          },
          robot2: {
            include: { user: { select: userSelect } }
          },
        },
      });
      
      if (battle) {
        biggestUpsets.push({
          battle,
          upsetDiff: upset.upsetDiff,
        });
      }
    }

    // Biggest ELO Gain - Top 10
    const biggestEloGains = await prisma.battle.findMany({
      where: {
        winnerId: { not: null },
        eloChange: { gt: 0 },
      },
      orderBy: { eloChange: 'desc' },
      take: 10,
      include: {
        robot1: {
          include: { user: { select: userSelect } }
        },
        robot2: {
          include: { user: { select: userSelect } }
        },
      },
    });

    // Biggest ELO Loss - Top 10
    const biggestEloLosses = await prisma.battle.findMany({
      where: {
        winnerId: { not: null },
        eloChange: { gt: 0 },
      },
      orderBy: { eloChange: 'desc' },
      take: 10,
      include: {
        robot1: {
          include: { user: { select: userSelect } }
        },
        robot2: {
          include: { user: { select: userSelect } }
        },
      },
    });

    // =========================
    // CAREER RECORDS
    // =========================

    // Most Battles Fought - Top 10
    const mostBattlesRobots = await prisma.robot.findMany({
      where: {
        NOT: { name: 'Bye Robot' },
      },
      orderBy: { totalBattles: 'desc' },
      take: 10,
      include: {
        user: { select: userSelect }
      },
    });

    // Highest Win Rate (min 50 battles) - Top 10
    const highWinRateRobots = await prisma.robot.findMany({
      where: {
        NOT: { name: 'Bye Robot' },
        totalBattles: { gte: 50 },
      },
      select: {
        id: true,
        name: true,
        wins: true,
        totalBattles: true,
        elo: true,
        currentLeague: true,
        user: { select: userSelect },
      },
    });

    // Calculate win rates and sort
    const robotsWithWinRate = highWinRateRobots.map(robot => ({
      ...robot,
      winRate: robot.wins / robot.totalBattles,
    }));
    
    robotsWithWinRate.sort((a, b) => b.winRate - a.winRate);
    const highestWinRates = robotsWithWinRate.slice(0, 10);

    // Most Lifetime Damage Dealt - Top 10
    const mostLifetimeDamageRobots = await prisma.robot.findMany({
      where: {
        NOT: { name: 'Bye Robot' },
      },
      orderBy: { damageDealtLifetime: 'desc' },
      take: 10,
      include: {
        user: { select: userSelect }
      },
    });

    // Highest Current ELO - Top 10
    const highestEloRobots = await prisma.robot.findMany({
      where: {
        NOT: { name: 'Bye Robot' },
      },
      orderBy: { elo: 'desc' },
      take: 10,
      include: {
        user: { select: userSelect }
      },
    });

    // Most Kills - Top 10
    const mostKillsRobots = await prisma.robot.findMany({
      where: {
        NOT: { name: 'Bye Robot' },
      },
      orderBy: { kills: 'desc' },
      take: 10,
      include: {
        user: { select: userSelect }
      },
    });

    // =========================
    // ECONOMIC RECORDS
    // =========================

    // Most Expensive Battle record removed (repair costs no longer tracked on battles)
    const mostExpensiveBattle = null;

    // Highest Fame Robot - Top 10
    const highestFameRobots = await prisma.robot.findMany({
      where: {
        NOT: { name: 'Bye Robot' },
      },
      orderBy: { fame: 'desc' },
      take: 10,
      include: {
        user: { select: userSelect }
      },
    });

    // Richest Stables - Top 10
    const richestStables = await prisma.user.findMany({
      orderBy: { currency: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        stableName: true,
        currency: true,
        prestige: true,
        robots: {
          where: {
            NOT: { name: 'Bye Robot' }
          },
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // =========================
    // PRESTIGE RECORDS
    // =========================

    // Highest Prestige Stable - Top 10
    const highestPrestigeStables = await prisma.user.findMany({
      orderBy: { prestige: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        stableName: true,
        prestige: true,
        championshipTitles: true,
        robots: {
          where: {
            NOT: { name: 'Bye Robot' }
          },
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Most Championship Titles - Top 10
    const mostTitlesStables = await prisma.user.findMany({
      where: {
        championshipTitles: { gt: 0 },
      },
      orderBy: { championshipTitles: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        stableName: true,
        championshipTitles: true,
        prestige: true,
        robots: {
          where: {
            NOT: { name: 'Bye Robot' }
          },
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // =========================
    // RESPONSE
    // =========================

    res.json({
      combat: {
        fastestVictory: fastestVictories.map(battle => ({
          battleId: battle.id,
          durationSeconds: battle.durationSeconds,
          winner: {
            id: battle.winnerId === battle.robot1Id ? battle.robot1.id : battle.robot2.id,
            name: battle.winnerId === battle.robot1Id ? battle.robot1.name : battle.robot2.name,
            username: battle.winnerId === battle.robot1Id ? getUserDisplayName(battle.robot1.user) : getUserDisplayName(battle.robot2.user),
          },
          loser: {
            id: battle.winnerId === battle.robot1Id ? battle.robot2.id : battle.robot1.id,
            name: battle.winnerId === battle.robot1Id ? battle.robot2.name : battle.robot1.name,
            username: battle.winnerId === battle.robot1Id ? getUserDisplayName(battle.robot2.user) : getUserDisplayName(battle.robot1.user),
          },
          date: battle.createdAt,
        })),
        longestBattle: longestBattles.map(battle => ({
          battleId: battle.id,
          durationSeconds: battle.durationSeconds,
          winner: {
            id: battle.winnerId === battle.robot1Id ? battle.robot1.id : battle.robot2.id,
            name: battle.winnerId === battle.robot1Id ? battle.robot1.name : battle.robot2.name,
            username: battle.winnerId === battle.robot1Id ? getUserDisplayName(battle.robot1.user) : getUserDisplayName(battle.robot2.user),
          },
          loser: {
            id: battle.winnerId === battle.robot1Id ? battle.robot2.id : battle.robot1.id,
            name: battle.winnerId === battle.robot1Id ? battle.robot2.name : battle.robot1.name,
            username: battle.winnerId === battle.robot1Id ? getUserDisplayName(battle.robot2.user) : getUserDisplayName(battle.robot1.user),
          },
          date: battle.createdAt,
        })),
        mostDamageInBattle: mostDamageDataList.map(data => ({
          battleId: data.battle?.id,
          damageDealt: data.damageDealt,
          robot: {
            id: data.robot?.id,
            name: data.robot?.name,
            username: data.robot?.user ? getUserDisplayName(data.robot.user) : '',
          },
          opponent: {
            id: data.opponent?.id,
            name: data.opponent?.name,
            username: data.opponent?.user ? getUserDisplayName(data.opponent.user) : '',
          },
          durationSeconds: data.battle?.durationSeconds,
          date: data.battle?.createdAt,
        })),
        narrowestVictory: narrowestVictories.map(data => ({
          battleId: data.battle.id,
          remainingHP: data.remainingHP,
          winner: {
            id: data.battle.winnerId === data.battle.robot1Id ? data.battle.robot1.id : data.battle.robot2.id,
            name: data.battle.winnerId === data.battle.robot1Id ? data.battle.robot1.name : data.battle.robot2.name,
            username: data.battle.winnerId === data.battle.robot1Id ? getUserDisplayName(data.battle.robot1.user) : getUserDisplayName(data.battle.robot2.user),
          },
          loser: {
            id: data.battle.winnerId === data.battle.robot1Id ? data.battle.robot2.id : data.battle.robot1.id,
            name: data.battle.winnerId === data.battle.robot1Id ? data.battle.robot2.name : data.battle.robot1.name,
            username: data.battle.winnerId === data.battle.robot1Id ? getUserDisplayName(data.battle.robot2.user) : getUserDisplayName(data.battle.robot1.user),
          },
          date: data.battle.createdAt,
        })),
      },
      upsets: {
        biggestUpset: biggestUpsets.map(data => ({
          battleId: data.battle.id,
          eloDifference: data.upsetDiff,
          underdog: {
            id: data.battle.winnerId === data.battle.robot1Id ? data.battle.robot1.id : data.battle.robot2.id,
            name: data.battle.winnerId === data.battle.robot1Id ? data.battle.robot1.name : data.battle.robot2.name,
            username: data.battle.winnerId === data.battle.robot1Id ? getUserDisplayName(data.battle.robot1.user) : getUserDisplayName(data.battle.robot2.user),
            eloBefore: data.battle.winnerId === data.battle.robot1Id ? data.battle.robot1ELOBefore : data.battle.robot2ELOBefore,
          },
          favorite: {
            id: data.battle.winnerId === data.battle.robot1Id ? data.battle.robot2.id : data.battle.robot1.id,
            name: data.battle.winnerId === data.battle.robot1Id ? data.battle.robot2.name : data.battle.robot1.name,
            username: data.battle.winnerId === data.battle.robot1Id ? getUserDisplayName(data.battle.robot2.user) : getUserDisplayName(data.battle.robot1.user),
            eloBefore: data.battle.winnerId === data.battle.robot1Id ? data.battle.robot2ELOBefore : data.battle.robot1ELOBefore,
          },
          date: data.battle.createdAt,
        })),
        biggestEloGain: biggestEloGains.map(battle => ({
          battleId: battle.id,
          eloChange: battle.eloChange,
          winner: {
            id: battle.winnerId === battle.robot1Id ? battle.robot1.id : battle.robot2.id,
            name: battle.winnerId === battle.robot1Id ? battle.robot1.name : battle.robot2.name,
            username: battle.winnerId === battle.robot1Id ? getUserDisplayName(battle.robot1.user) : getUserDisplayName(battle.robot2.user),
            eloBefore: battle.winnerId === battle.robot1Id ? battle.robot1ELOBefore : battle.robot2ELOBefore,
            eloAfter: battle.winnerId === battle.robot1Id ? battle.robot1ELOAfter : battle.robot2ELOAfter,
          },
          loser: {
            id: battle.winnerId === battle.robot1Id ? battle.robot2.id : battle.robot1.id,
            name: battle.winnerId === battle.robot1Id ? battle.robot2.name : battle.robot1.name,
            username: battle.winnerId === battle.robot1Id ? getUserDisplayName(battle.robot2.user) : getUserDisplayName(battle.robot1.user),
            eloBefore: battle.winnerId === battle.robot1Id ? battle.robot2ELOBefore : battle.robot1ELOBefore,
          },
          date: battle.createdAt,
        })),
        biggestEloLoss: biggestEloLosses.map(battle => ({
          battleId: battle.id,
          eloChange: battle.eloChange,
          loser: {
            id: battle.winnerId === battle.robot1Id ? battle.robot2.id : battle.robot1.id,
            name: battle.winnerId === battle.robot1Id ? battle.robot2.name : battle.robot1.name,
            username: battle.winnerId === battle.robot1Id ? getUserDisplayName(battle.robot2.user) : getUserDisplayName(battle.robot1.user),
            eloBefore: battle.winnerId === battle.robot1Id ? battle.robot2ELOBefore : battle.robot1ELOBefore,
            eloAfter: battle.winnerId === battle.robot1Id ? battle.robot2ELOAfter : battle.robot1ELOAfter,
          },
          winner: {
            id: battle.winnerId === battle.robot1Id ? battle.robot1.id : battle.robot2.id,
            name: battle.winnerId === battle.robot1Id ? battle.robot1.name : battle.robot2.name,
            username: battle.winnerId === battle.robot1Id ? getUserDisplayName(battle.robot1.user) : getUserDisplayName(battle.robot2.user),
          },
          date: battle.createdAt,
        })),
      },
      career: {
        mostBattles: mostBattlesRobots.map(robot => ({
          robotId: robot.id,
          robotName: robot.name,
          username: getUserDisplayName(robot.user),
          totalBattles: robot.totalBattles,
          wins: robot.wins,
          losses: robot.losses,
          draws: robot.draws,
          winRate: robot.totalBattles > 0 ? Number((robot.wins / robot.totalBattles * 100).toFixed(1)) : 0,
          elo: robot.elo,
        })),
        highestWinRate: highestWinRates.map(robot => ({
          robotId: robot.id,
          robotName: robot.name,
          username: getUserDisplayName(robot.user),
          totalBattles: robot.totalBattles,
          wins: robot.wins,
          winRate: Number((robot.winRate * 100).toFixed(1)),
          elo: robot.elo,
          league: robot.currentLeague,
        })),
        mostLifetimeDamage: mostLifetimeDamageRobots.map(robot => ({
          robotId: robot.id,
          robotName: robot.name,
          username: getUserDisplayName(robot.user),
          damageDealt: robot.damageDealtLifetime,
          totalBattles: robot.totalBattles,
          avgDamagePerBattle: robot.totalBattles > 0 
            ? Number((robot.damageDealtLifetime / robot.totalBattles).toFixed(0))
            : 0,
        })),
        highestElo: highestEloRobots.map(robot => ({
          robotId: robot.id,
          robotName: robot.name,
          username: getUserDisplayName(robot.user),
          elo: robot.elo,
          league: robot.currentLeague,
          wins: robot.wins,
          losses: robot.losses,
          draws: robot.draws,
        })),
        mostKills: mostKillsRobots.map(robot => ({
          robotId: robot.id,
          robotName: robot.name,
          username: getUserDisplayName(robot.user),
          kills: robot.kills,
          totalBattles: robot.totalBattles,
          killRate: robot.totalBattles > 0 ? Number((robot.kills / robot.totalBattles * 100).toFixed(1)) : 0,
        })),
      },
      economic: {
        mostExpensiveBattle: [], // Removed - repair costs no longer tracked on battles
        highestFame: highestFameRobots.map(robot => ({
          robotId: robot.id,
          robotName: robot.name,
          username: getUserDisplayName(robot.user),
          fame: robot.fame,
          league: robot.currentLeague,
          elo: robot.elo,
        })),
        richestStables: richestStables.map(stable => ({
          userId: stable.id,
          username: getUserDisplayName(stable),
          currency: stable.currency,
          prestige: stable.prestige,
          robotCount: stable.robots.length,
        })),
      },
      prestige: {
        highestPrestige: highestPrestigeStables.map(stable => ({
          userId: stable.id,
          username: getUserDisplayName(stable),
          prestige: stable.prestige,
          championshipTitles: stable.championshipTitles,
          robotCount: stable.robots.length,
        })),
        mostTitles: mostTitlesStables.map(stable => ({
          userId: stable.id,
          username: getUserDisplayName(stable),
          championshipTitles: stable.championshipTitles,
          prestige: stable.prestige,
          robotCount: stable.robots.length,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Records] Error fetching records:', error);
    res.status(500).json({
      error: 'Failed to retrieve hall of records',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
