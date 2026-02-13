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

    // Fastest Victory
    const fastestVictory = await prisma.battle.findFirst({
      where: {
        winnerId: { not: null },
        durationSeconds: { gt: 0 },
      },
      orderBy: { durationSeconds: 'asc' },
      include: {
        robot1: {
          include: { user: { select: userSelect } }
        },
        robot2: {
          include: { user: { select: userSelect } }
        },
      },
    });

    // Longest Battle
    const longestBattle = await prisma.battle.findFirst({
      where: {
        winnerId: { not: null },
      },
      orderBy: { durationSeconds: 'desc' },
      include: {
        robot1: {
          include: { user: { select: userSelect } }
        },
        robot2: {
          include: { user: { select: userSelect } }
        },
      },
    });

    // Most Damage in Single Battle
    const allBattles = await prisma.battle.findMany({
      select: {
        id: true,
        robot1Id: true,
        robot2Id: true,
        robot1DamageDealt: true,
        robot2DamageDealt: true,
        durationSeconds: true,
        createdAt: true,
      },
    });

    let mostDamageBattle = null;
    let mostDamageRobotId = null;
    let maxDamage = 0;

    for (const battle of allBattles) {
      if (battle.robot1DamageDealt > maxDamage) {
        maxDamage = battle.robot1DamageDealt;
        mostDamageRobotId = battle.robot1Id;
        mostDamageBattle = battle;
      }
      if (battle.robot2DamageDealt > maxDamage) {
        maxDamage = battle.robot2DamageDealt;
        mostDamageRobotId = battle.robot2Id;
        mostDamageBattle = battle;
      }
    }

    let mostDamageData = null;
    if (mostDamageBattle && mostDamageRobotId) {
      const battle = await prisma.battle.findUnique({
        where: { id: mostDamageBattle.id },
        include: {
          robot1: {
            include: { user: { select: userSelect } }
          },
          robot2: {
            include: { user: { select: userSelect } }
          },
        },
      });

      mostDamageData = {
        battle,
        damageDealt: maxDamage,
        robotId: mostDamageRobotId,
        robot: mostDamageRobotId === battle?.robot1Id ? battle?.robot1 : battle?.robot2,
        opponent: mostDamageRobotId === battle?.robot1Id ? battle?.robot2 : battle?.robot1,
      };
    }

    // Narrowest Victory - winner with lowest remaining HP
    const allBattlesForNarrowest = await prisma.battle.findMany({
      where: {
        winnerId: { not: null },
      },
      select: {
        id: true,
        winnerId: true,
        robot1Id: true,
        robot2Id: true,
        robot1FinalHP: true,
        robot2FinalHP: true,
        createdAt: true,
      },
    });

    let narrowestBattleId = null;
    let minWinnerHP = Infinity;

    for (const battle of allBattlesForNarrowest) {
      const winnerHP = battle.winnerId === battle.robot1Id 
        ? battle.robot1FinalHP 
        : battle.robot2FinalHP;
      
      if (winnerHP > 0 && winnerHP < minWinnerHP) {
        minWinnerHP = winnerHP;
        narrowestBattleId = battle.id;
      }
    }

    let narrowestVictory = null;
    if (narrowestBattleId) {
      narrowestVictory = await prisma.battle.findUnique({
        where: { id: narrowestBattleId },
        include: {
          robot1: {
            include: { user: { select: userSelect } }
          },
          robot2: {
            include: { user: { select: userSelect } }
          },
        },
      });
    }

    // =========================
    // UPSET RECORDS
    // =========================

    // Biggest Upset (biggest ELO difference where underdog won)
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

    let biggestUpsetBattleId = null;
    let maxUpsetDiff = 0;

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
        if (upsetDiff > maxUpsetDiff) {
          maxUpsetDiff = upsetDiff;
          biggestUpsetBattleId = battle.id;
        }
      }
    }

    let biggestUpset = null;
    if (biggestUpsetBattleId) {
      biggestUpset = await prisma.battle.findUnique({
        where: { id: biggestUpsetBattleId },
        include: {
          robot1: {
            include: { user: { select: userSelect } }
          },
          robot2: {
            include: { user: { select: userSelect } }
          },
        },
      });
    }

    // Biggest ELO Gain
    const biggestEloGain = await prisma.battle.findFirst({
      where: {
        winnerId: { not: null },
        eloChange: { gt: 0 },
      },
      orderBy: { eloChange: 'desc' },
      include: {
        robot1: {
          include: { user: { select: userSelect } }
        },
        robot2: {
          include: { user: { select: userSelect } }
        },
      },
    });

    // Biggest ELO Loss
    const biggestEloLoss = await prisma.battle.findFirst({
      where: {
        winnerId: { not: null },
        eloChange: { gt: 0 },
      },
      orderBy: { eloChange: 'desc' },
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

    // Most Battles Fought
    const mostBattles = await prisma.robot.findFirst({
      where: {
        NOT: { name: 'Bye Robot' },
      },
      orderBy: { totalBattles: 'desc' },
      include: {
        user: { select: userSelect }
      },
    });

    // Highest Win Rate (min 50 battles)
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

    let highestWinRate = null;
    let maxWinRate = 0;

    for (const robot of highWinRateRobots) {
      const winRate = robot.wins / robot.totalBattles;
      if (winRate > maxWinRate) {
        maxWinRate = winRate;
        highestWinRate = robot;
      }
    }

    // Most Lifetime Damage Dealt
    const mostLifetimeDamage = await prisma.robot.findFirst({
      where: {
        NOT: { name: 'Bye Robot' },
      },
      orderBy: { damageDealtLifetime: 'desc' },
      include: {
        user: { select: userSelect }
      },
    });

    // Highest Current ELO
    const highestElo = await prisma.robot.findFirst({
      where: {
        NOT: { name: 'Bye Robot' },
      },
      orderBy: { elo: 'desc' },
      include: {
        user: { select: userSelect }
      },
    });

    // Most Kills
    const mostKills = await prisma.robot.findFirst({
      where: {
        NOT: { name: 'Bye Robot' },
      },
      orderBy: { kills: 'desc' },
      include: {
        user: { select: userSelect }
      },
    });

    // =========================
    // ECONOMIC RECORDS
    // =========================

    // Most Expensive Battle (total repair costs)
    const allBattlesForCost = await prisma.battle.findMany({
      select: {
        id: true,
        robot1RepairCost: true,
        robot2RepairCost: true,
      },
    });

    let mostExpensiveBattleId = null;
    let maxTotalCost = 0;

    for (const battle of allBattlesForCost) {
      const totalCost = (battle.robot1RepairCost || 0) + (battle.robot2RepairCost || 0);
      if (totalCost > maxTotalCost) {
        maxTotalCost = totalCost;
        mostExpensiveBattleId = battle.id;
      }
    }

    let mostExpensiveBattle = null;
    if (mostExpensiveBattleId) {
      mostExpensiveBattle = await prisma.battle.findUnique({
        where: { id: mostExpensiveBattleId },
        include: {
          robot1: {
            include: { user: { select: userSelect } }
          },
          robot2: {
            include: { user: { select: userSelect } }
          },
        },
      });
    }

    // Highest Fame Robot
    const highestFame = await prisma.robot.findFirst({
      where: {
        NOT: { name: 'Bye Robot' },
      },
      orderBy: { fame: 'desc' },
      include: {
        user: { select: userSelect }
      },
    });

    // Richest Stables
    const richestStable = await prisma.user.findFirst({
      orderBy: { currency: 'desc' },
      include: {
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

    // Highest Prestige Stable
    const highestPrestige = await prisma.user.findFirst({
      orderBy: { prestige: 'desc' },
      include: {
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

    // Most Championship Titles
    const mostTitles = await prisma.user.findFirst({
      where: {
        championshipTitles: { gt: 0 },
      },
      orderBy: { championshipTitles: 'desc' },
      include: {
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
        fastestVictory: fastestVictory ? {
          battleId: fastestVictory.id,
          durationSeconds: fastestVictory.durationSeconds,
          winner: {
            id: fastestVictory.winnerId === fastestVictory.robot1Id ? fastestVictory.robot1.id : fastestVictory.robot2.id,
            name: fastestVictory.winnerId === fastestVictory.robot1Id ? fastestVictory.robot1.name : fastestVictory.robot2.name,
            username: fastestVictory.winnerId === fastestVictory.robot1Id ? getUserDisplayName(fastestVictory.robot1.user) : getUserDisplayName(fastestVictory.robot2.user),
          },
          loser: {
            id: fastestVictory.winnerId === fastestVictory.robot1Id ? fastestVictory.robot2.id : fastestVictory.robot1.id,
            name: fastestVictory.winnerId === fastestVictory.robot1Id ? fastestVictory.robot2.name : fastestVictory.robot1.name,
            username: fastestVictory.winnerId === fastestVictory.robot1Id ? getUserDisplayName(fastestVictory.robot2.user) : getUserDisplayName(fastestVictory.robot1.user),
          },
          date: fastestVictory.createdAt,
        } : null,
        longestBattle: longestBattle ? {
          battleId: longestBattle.id,
          durationSeconds: longestBattle.durationSeconds,
          winner: {
            id: longestBattle.winnerId === longestBattle.robot1Id ? longestBattle.robot1.id : longestBattle.robot2.id,
            name: longestBattle.winnerId === longestBattle.robot1Id ? longestBattle.robot1.name : longestBattle.robot2.name,
            username: longestBattle.winnerId === longestBattle.robot1Id ? getUserDisplayName(longestBattle.robot1.user) : getUserDisplayName(longestBattle.robot2.user),
          },
          loser: {
            id: longestBattle.winnerId === longestBattle.robot1Id ? longestBattle.robot2.id : longestBattle.robot1.id,
            name: longestBattle.winnerId === longestBattle.robot1Id ? longestBattle.robot2.name : longestBattle.robot1.name,
            username: longestBattle.winnerId === longestBattle.robot1Id ? getUserDisplayName(longestBattle.robot2.user) : getUserDisplayName(longestBattle.robot1.user),
          },
          date: longestBattle.createdAt,
        } : null,
        mostDamageInBattle: mostDamageData ? {
          battleId: mostDamageData.battle?.id,
          damageDealt: mostDamageData.damageDealt,
          robot: {
            id: mostDamageData.robot?.id,
            name: mostDamageData.robot?.name,
            username: mostDamageData.robot?.user ? getUserDisplayName(mostDamageData.robot.user) : '',
          },
          opponent: {
            id: mostDamageData.opponent?.id,
            name: mostDamageData.opponent?.name,
            username: mostDamageData.opponent?.user ? getUserDisplayName(mostDamageData.opponent.user) : '',
          },
          durationSeconds: mostDamageData.battle?.durationSeconds,
          date: mostDamageData.battle?.createdAt,
        } : null,
        narrowestVictory: narrowestVictory ? {
          battleId: narrowestVictory.id,
          remainingHP: minWinnerHP,
          winner: {
            id: narrowestVictory.winnerId === narrowestVictory.robot1Id ? narrowestVictory.robot1.id : narrowestVictory.robot2.id,
            name: narrowestVictory.winnerId === narrowestVictory.robot1Id ? narrowestVictory.robot1.name : narrowestVictory.robot2.name,
            username: narrowestVictory.winnerId === narrowestVictory.robot1Id ? getUserDisplayName(narrowestVictory.robot1.user) : getUserDisplayName(narrowestVictory.robot2.user),
          },
          loser: {
            id: narrowestVictory.winnerId === narrowestVictory.robot1Id ? narrowestVictory.robot2.id : narrowestVictory.robot1.id,
            name: narrowestVictory.winnerId === narrowestVictory.robot1Id ? narrowestVictory.robot2.name : narrowestVictory.robot1.name,
            username: narrowestVictory.winnerId === narrowestVictory.robot1Id ? getUserDisplayName(narrowestVictory.robot2.user) : getUserDisplayName(narrowestVictory.robot1.user),
          },
          date: narrowestVictory.createdAt,
        } : null,
      },
      upsets: {
        biggestUpset: biggestUpset ? {
          battleId: biggestUpset.id,
          eloDifference: maxUpsetDiff,
          underdog: {
            id: biggestUpset.winnerId === biggestUpset.robot1Id ? biggestUpset.robot1.id : biggestUpset.robot2.id,
            name: biggestUpset.winnerId === biggestUpset.robot1Id ? biggestUpset.robot1.name : biggestUpset.robot2.name,
            username: biggestUpset.winnerId === biggestUpset.robot1Id ? getUserDisplayName(biggestUpset.robot1.user) : getUserDisplayName(biggestUpset.robot2.user),
            eloBefore: biggestUpset.winnerId === biggestUpset.robot1Id ? biggestUpset.robot1ELOBefore : biggestUpset.robot2ELOBefore,
          },
          favorite: {
            id: biggestUpset.winnerId === biggestUpset.robot1Id ? biggestUpset.robot2.id : biggestUpset.robot1.id,
            name: biggestUpset.winnerId === biggestUpset.robot1Id ? biggestUpset.robot2.name : biggestUpset.robot1.name,
            username: biggestUpset.winnerId === biggestUpset.robot1Id ? getUserDisplayName(biggestUpset.robot2.user) : getUserDisplayName(biggestUpset.robot1.user),
            eloBefore: biggestUpset.winnerId === biggestUpset.robot1Id ? biggestUpset.robot2ELOBefore : biggestUpset.robot1ELOBefore,
          },
          date: biggestUpset.createdAt,
        } : null,
        biggestEloGain: biggestEloGain ? {
          battleId: biggestEloGain.id,
          eloChange: biggestEloGain.eloChange,
          winner: {
            id: biggestEloGain.winnerId === biggestEloGain.robot1Id ? biggestEloGain.robot1.id : biggestEloGain.robot2.id,
            name: biggestEloGain.winnerId === biggestEloGain.robot1Id ? biggestEloGain.robot1.name : biggestEloGain.robot2.name,
            username: biggestEloGain.winnerId === biggestEloGain.robot1Id ? getUserDisplayName(biggestEloGain.robot1.user) : getUserDisplayName(biggestEloGain.robot2.user),
            eloBefore: biggestEloGain.winnerId === biggestEloGain.robot1Id ? biggestEloGain.robot1ELOBefore : biggestEloGain.robot2ELOBefore,
            eloAfter: biggestEloGain.winnerId === biggestEloGain.robot1Id ? biggestEloGain.robot1ELOAfter : biggestEloGain.robot2ELOAfter,
          },
          loser: {
            id: biggestEloGain.winnerId === biggestEloGain.robot1Id ? biggestEloGain.robot2.id : biggestEloGain.robot1.id,
            name: biggestEloGain.winnerId === biggestEloGain.robot1Id ? biggestEloGain.robot2.name : biggestEloGain.robot1.name,
            username: biggestEloGain.winnerId === biggestEloGain.robot1Id ? getUserDisplayName(biggestEloGain.robot2.user) : getUserDisplayName(biggestEloGain.robot1.user),
            eloBefore: biggestEloGain.winnerId === biggestEloGain.robot1Id ? biggestEloGain.robot2ELOBefore : biggestEloGain.robot1ELOBefore,
          },
          date: biggestEloGain.createdAt,
        } : null,
        biggestEloLoss: biggestEloLoss ? {
          battleId: biggestEloLoss.id,
          eloChange: biggestEloLoss.eloChange,
          loser: {
            id: biggestEloLoss.winnerId === biggestEloLoss.robot1Id ? biggestEloLoss.robot2.id : biggestEloLoss.robot1.id,
            name: biggestEloLoss.winnerId === biggestEloLoss.robot1Id ? biggestEloLoss.robot2.name : biggestEloLoss.robot1.name,
            username: biggestEloLoss.winnerId === biggestEloLoss.robot1Id ? getUserDisplayName(biggestEloLoss.robot2.user) : getUserDisplayName(biggestEloLoss.robot1.user),
            eloBefore: biggestEloLoss.winnerId === biggestEloLoss.robot1Id ? biggestEloLoss.robot2ELOBefore : biggestEloLoss.robot1ELOBefore,
            eloAfter: biggestEloLoss.winnerId === biggestEloLoss.robot1Id ? biggestEloLoss.robot2ELOAfter : biggestEloLoss.robot1ELOAfter,
          },
          winner: {
            id: biggestEloLoss.winnerId === biggestEloLoss.robot1Id ? biggestEloLoss.robot1.id : biggestEloLoss.robot2.id,
            name: biggestEloLoss.winnerId === biggestEloLoss.robot1Id ? biggestEloLoss.robot1.name : biggestEloLoss.robot2.name,
            username: biggestEloLoss.winnerId === biggestEloLoss.robot1Id ? getUserDisplayName(biggestEloLoss.robot1.user) : getUserDisplayName(biggestEloLoss.robot2.user),
          },
          date: biggestEloLoss.createdAt,
        } : null,
      },
      career: {
        mostBattles: mostBattles ? {
          robotId: mostBattles.id,
          robotName: mostBattles.name,
          username: getUserDisplayName(mostBattles.user),
          totalBattles: mostBattles.totalBattles,
          wins: mostBattles.wins,
          losses: mostBattles.losses,
          draws: mostBattles.draws,
          winRate: mostBattles.totalBattles > 0 ? Number((mostBattles.wins / mostBattles.totalBattles * 100).toFixed(1)) : 0,
          elo: mostBattles.elo,
        } : null,
        highestWinRate: highestWinRate ? {
          robotId: highestWinRate.id,
          robotName: highestWinRate.name,
          username: getUserDisplayName(highestWinRate.user),
          totalBattles: highestWinRate.totalBattles,
          wins: highestWinRate.wins,
          winRate: Number((maxWinRate * 100).toFixed(1)),
          elo: highestWinRate.elo,
          league: highestWinRate.currentLeague,
        } : null,
        mostLifetimeDamage: mostLifetimeDamage ? {
          robotId: mostLifetimeDamage.id,
          robotName: mostLifetimeDamage.name,
          username: getUserDisplayName(mostLifetimeDamage.user),
          damageDealt: mostLifetimeDamage.damageDealtLifetime,
          totalBattles: mostLifetimeDamage.totalBattles,
          avgDamagePerBattle: mostLifetimeDamage.totalBattles > 0 
            ? Number((mostLifetimeDamage.damageDealtLifetime / mostLifetimeDamage.totalBattles).toFixed(0))
            : 0,
        } : null,
        highestElo: highestElo ? {
          robotId: highestElo.id,
          robotName: highestElo.name,
          username: getUserDisplayName(highestElo.user),
          elo: highestElo.elo,
          league: highestElo.currentLeague,
          wins: highestElo.wins,
          losses: highestElo.losses,
          draws: highestElo.draws,
        } : null,
        mostKills: mostKills ? {
          robotId: mostKills.id,
          robotName: mostKills.name,
          username: getUserDisplayName(mostKills.user),
          kills: mostKills.kills,
          totalBattles: mostKills.totalBattles,
          killRate: mostKills.totalBattles > 0 ? Number((mostKills.kills / mostKills.totalBattles * 100).toFixed(1)) : 0,
        } : null,
      },
      economic: {
        mostExpensiveBattle: mostExpensiveBattle ? {
          battleId: mostExpensiveBattle.id,
          totalRepairCost: maxTotalCost,
          robot1: {
            id: mostExpensiveBattle.robot1.id,
            name: mostExpensiveBattle.robot1.name,
            username: getUserDisplayName(mostExpensiveBattle.robot1.user),
            repairCost: mostExpensiveBattle.robot1RepairCost,
          },
          robot2: {
            id: mostExpensiveBattle.robot2.id,
            name: mostExpensiveBattle.robot2.name,
            username: getUserDisplayName(mostExpensiveBattle.robot2.user),
            repairCost: mostExpensiveBattle.robot2RepairCost,
          },
          winnerId: mostExpensiveBattle.winnerId,
          date: mostExpensiveBattle.createdAt,
        } : null,
        highestFame: highestFame ? {
          robotId: highestFame.id,
          robotName: highestFame.name,
          username: getUserDisplayName(highestFame.user),
          fame: highestFame.fame,
          league: highestFame.currentLeague,
          elo: highestFame.elo,
        } : null,
        richestStables: richestStable ? {
          userId: richestStable.id,
          username: richestStable.username,
          currency: richestStable.currency,
          totalBattles: richestStable.totalBattles,
          prestige: richestStable.prestige,
          robotCount: richestStable.robots.length,
        } : null,
      },
      prestige: {
        highestPrestige: highestPrestige ? {
          userId: highestPrestige.id,
          username: highestPrestige.username,
          prestige: highestPrestige.prestige,
          totalBattles: highestPrestige.totalBattles,
          totalWins: highestPrestige.totalWins,
          championshipTitles: highestPrestige.championshipTitles,
          robotCount: highestPrestige.robots.length,
        } : null,
        mostTitles: mostTitles ? {
          userId: mostTitles.id,
          username: mostTitles.username,
          championshipTitles: mostTitles.championshipTitles,
          prestige: mostTitles.prestige,
          totalBattles: mostTitles.totalBattles,
          robotCount: mostTitles.robots.length,
        } : null,
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
