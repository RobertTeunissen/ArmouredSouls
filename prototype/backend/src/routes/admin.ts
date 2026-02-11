import express, { Request, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { executeScheduledBattles } from '../services/battleOrchestrator';
import { runMatchmaking } from '../services/matchmakingService';
import { rebalanceLeagues } from '../services/leagueRebalancingService';
import { processAllDailyFinances } from '../utils/economyCalculations';
import { generateBattleReadyUsers } from '../utils/userGeneration';
import { calculateMaxHP } from '../utils/robotCalculations';
import { repairAllRobots } from '../services/repairService';
import { PrismaClient } from '@prisma/client';
import tournamentRoutes from './adminTournaments';
import { 
  getActiveTournaments, 
  getCurrentRoundMatches,
  autoCreateNextTournament 
} from '../services/tournamentService';
import { processTournamentBattle } from '../services/tournamentBattleOrchestrator';
import { advanceWinnersToNextRound } from '../services/tournamentService';

const router = express.Router();
const prisma = new PrismaClient();

// Mount tournament routes
router.use('/tournaments', tournamentRoutes);

// Configuration constants
const BANKRUPTCY_RISK_THRESHOLD = 10000; // Credits below which a user is considered at risk

/**
 * Middleware to check if user is admin
 */
const requireAdmin = (req: AuthRequest, res: Response, next: express.NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

/**
 * POST /api/admin/matchmaking/run
 * Trigger matchmaking for all leagues
 */
router.post('/matchmaking/run', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { scheduledFor } = req.body;
    const targetTime = scheduledFor ? new Date(scheduledFor) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    console.log('[Admin] Triggering matchmaking...');
    const totalMatches = await runMatchmaking(targetTime);

    res.json({
      success: true,
      matchesCreated: totalMatches,
      scheduledFor: targetTime.toISOString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Matchmaking error:', error);
    res.status(500).json({
      error: 'Failed to run matchmaking',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/battles/run
 * Execute scheduled battles
 */
router.post('/battles/run', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { scheduledFor } = req.body;
    // Only pass a date if scheduledFor is explicitly provided
    // If not provided, pass undefined to execute ALL scheduled matches
    const targetTime = scheduledFor ? new Date(scheduledFor) : undefined;

    console.log('[Admin] Executing battles...');
    const summary = await executeScheduledBattles(targetTime);

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Battle execution error:', error);
    res.status(500).json({
      error: 'Failed to execute battles',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/leagues/rebalance
 * Trigger league rebalancing (promotions/demotions)
 */
router.post('/leagues/rebalance', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[Admin] Triggering league rebalancing...');
    const summary = await rebalanceLeagues();

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Rebalancing error:', error);
    res.status(500).json({
      error: 'Failed to rebalance leagues',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/repair/all
 * Auto-repair all robots to 100% HP
 */
router.post('/repair/all', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { deductCosts = false } = req.body;

    console.log('[Admin] Auto-repairing all robots...');

    // Get all robots that need repair
    const robots = await prisma.robot.findMany({
      where: {
        currentHP: {
          lt: prisma.robot.fields.maxHP,
        },
        NOT: {
          name: 'Bye Robot',
        },
      },
      select: {
        id: true,
        name: true,
        userId: true,
        currentHP: true,
        maxHP: true,
        maxShield: true,
      },
    });

    const repairs = [];
    const REPAIR_COST_PER_HP = 50; // 50 credits per HP

    // Group robots by user to apply facility discounts
    const robotsByUser = new Map<number, typeof robots>();
    for (const robot of robots) {
      if (!robotsByUser.has(robot.userId)) {
        robotsByUser.set(robot.userId, []);
      }
      robotsByUser.get(robot.userId)!.push(robot);
    }

    for (const [userId, userRobots] of robotsByUser.entries()) {
      // Get repair bay facility for discount
      const repairBay = await prisma.facility.findUnique({
        where: {
          userId_facilityType: {
            userId,
            facilityType: 'repair_bay',
          },
        },
      });

      const repairBayLevel = repairBay?.level || 0;
      const discount = repairBayLevel * 5; // 5% per level

      let totalUserRepairCost = 0;

      for (const robot of userRobots) {
        const hpToRestore = robot.maxHP - robot.currentHP;
        const baseCost = hpToRestore * REPAIR_COST_PER_HP;
        const repairCost = Math.floor(baseCost * (1 - discount / 100));

        // Update robot HP and set battle ready
        await prisma.robot.update({
          where: { id: robot.id },
          data: { 
            currentHP: robot.maxHP,
            currentShield: robot.maxShield,
            repairCost: 0,
            battleReadiness: 100,
          },
        });

        totalUserRepairCost += repairCost;

        repairs.push({
          robotId: robot.id,
          robotName: robot.name,
          userId: robot.userId,
          hpRestored: hpToRestore,
          baseCost,
          discount,
          finalCost: repairCost,
          costDeducted: deductCosts,
        });
      }

      // Deduct costs if requested
      if (deductCosts && totalUserRepairCost > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            currency: {
              decrement: totalUserRepairCost,
            },
          },
        });
      }
    }

    res.json({
      success: true,
      robotsRepaired: robots.length,
      totalBaseCost: repairs.reduce((sum, r) => sum + r.baseCost, 0),
      totalFinalCost: repairs.reduce((sum, r) => sum + r.finalCost, 0),
      costsDeducted: deductCosts,
      repairs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Auto-repair error:', error);
    res.status(500).json({
      error: 'Failed to auto-repair robots',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/recalculate-hp
 * Recalculate HP for all robots using the new formula: 30 + (hullIntegrity × 8)
 */
router.post('/recalculate-hp', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[Admin] Recalculating HP for all robots using new formula...');

    // Get all robots
    const robots = await prisma.robot.findMany({
      include: {
        mainWeapon: {
          include: {
            weapon: true,
          },
        },
        offhandWeapon: {
          include: {
            weapon: true,
          },
        },
      },
    });

    const updates = [];

    for (const robot of robots) {
      const oldMaxHP = robot.maxHP;
      
      // Calculate new maxHP using the formula
      const newMaxHP = calculateMaxHP(robot);
      
      // Calculate currentHP proportionally
      const hpPercentage = robot.maxHP > 0 ? robot.currentHP / robot.maxHP : 1;
      const newCurrentHP = Math.round(newMaxHP * hpPercentage);

      // Update robot
      await prisma.robot.update({
        where: { id: robot.id },
        data: {
          maxHP: newMaxHP,
          currentHP: Math.min(newCurrentHP, newMaxHP), // Cap at maxHP
        },
      });

      updates.push({
        robotId: robot.id,
        robotName: robot.name,
        hullIntegrity: Number(robot.hullIntegrity),
        oldMaxHP,
        newMaxHP,
        change: newMaxHP - oldMaxHP,
      });
    }

    res.json({
      success: true,
      robotsUpdated: robots.length,
      updates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] HP recalculation error:', error);
    res.status(500).json({
      error: 'Failed to recalculate HP',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/daily-finances/process
 * Process daily financial obligations (operating costs) for all users
 */
router.post('/daily-finances/process', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[Admin] Processing daily finances for all users...');
    
    const summary = await processAllDailyFinances();
    
    console.log(`[Admin] Processed ${summary.usersProcessed} users, ` +
      `deducted ₡${summary.totalCostsDeducted.toLocaleString()}, ` +
      `${summary.bankruptUsers} bankruptcies`);
    
    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Daily finances error:', error);
    res.status(500).json({
      error: 'Failed to process daily finances',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/cycles/bulk
 * Run multiple complete cycles with the following flow:
 * 1. Repair All Robots (costs deducted)
 * 2. Tournament Execution / Scheduling
 * 3. Repair All Robots (costs deducted)
 * 4. Execute League Battles
 * 5. Rebalance Leagues
 * 6. Auto Generate New Users (battle ready)
 * 7. Repair All Robots (costs deducted)
 * 8. Matchmaking for Leagues
 */
router.post('/cycles/bulk', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      cycles = 1, 
      includeDailyFinances = false, // Deprecated, kept for backwards compatibility
      generateUsersPerCycle = false,
      includeTournaments = true
    } = req.body;
    const maxCycles = 100;
    const cycleCount = Math.min(Math.max(1, cycles), maxCycles);

    console.log(`[Admin] Running ${cycleCount} bulk cycles (includeTournaments: ${includeTournaments}, generateUsersPerCycle: ${generateUsersPerCycle})...`);

    // Get or create cycle metadata (singleton pattern)
    // Note: This initialization is also in seed.ts. Both locations create the same
    // record (id=1, totalCycles=0) to ensure the singleton exists regardless of
    // whether the database was seeded or if cycles are run after a fresh migration.
    let cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    if (!cycleMetadata) {
      cycleMetadata = await prisma.cycleMetadata.create({
        data: { id: 1, totalCycles: 0 },
      });
    }

    let currentCycleNumber = cycleMetadata.totalCycles;
    const cycleResults = [];
    const startTime = Date.now();

    for (let i = 1; i <= cycleCount; i++) {
      const cycleStart = Date.now();
      currentCycleNumber++;
      console.log(`\n[Admin] === Cycle ${currentCycleNumber} (${i}/${cycleCount}) ===`);

      try {
        // Step 1: Repair All Robots (costs deducted)
        console.log(`[Admin] Step 1: Repair All Robots (pre-tournament)`);
        const repair1Summary = await repairAllRobots(true);

        // Step 2: Tournament Execution / Scheduling
        console.log(`[Admin] Step 2: Tournament Execution / Scheduling`);
        let tournamentSummary = null;
        if (includeTournaments) {
          try {
            tournamentSummary = {
              tournamentsExecuted: 0,
              roundsExecuted: 0,
              matchesExecuted: 0,
              tournamentsCompleted: 0,
              tournamentsCreated: 0,
              errors: [] as string[],
            };

            // Get all active tournaments
            const activeTournaments = await getActiveTournaments();

            for (const tournament of activeTournaments) {
              try {
                // Get current round matches
                const currentRoundMatches = await getCurrentRoundMatches(tournament.id);
                
                if (currentRoundMatches.length > 0) {
                  // Execute matches
                  for (const match of currentRoundMatches) {
                    try {
                      await processTournamentBattle(match);
                      tournamentSummary.matchesExecuted++;
                    } catch (error) {
                      const errorMsg = error instanceof Error ? error.message : String(error);
                      tournamentSummary.errors.push(`Tournament ${tournament.id} Match ${match.id}: ${errorMsg}`);
                    }
                  }

                  // Advance winners
                  await advanceWinnersToNextRound(tournament.id);
                  tournamentSummary.roundsExecuted++;
                }

                tournamentSummary.tournamentsExecuted++;

                // Check if tournament completed
                const updatedTournament = await prisma.tournament.findUnique({
                  where: { id: tournament.id },
                });

                if (updatedTournament?.status === 'completed') {
                  tournamentSummary.tournamentsCompleted++;
                }
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                tournamentSummary.errors.push(`Tournament ${tournament.id}: ${errorMsg}`);
              }
            }

            // Auto-create next tournament if none active
            try {
              const nextTournament = await autoCreateNextTournament();
              if (nextTournament) {
                tournamentSummary.tournamentsCreated++;
                console.log(`[Admin] Auto-created tournament: ${nextTournament.name}`);
              }
            } catch (error) {
              console.error('[Admin] Failed to auto-create tournament:', error);
            }

            console.log(`[Admin] Tournaments: ${tournamentSummary.tournamentsExecuted} executed, ${tournamentSummary.roundsExecuted} rounds, ${tournamentSummary.matchesExecuted} matches`);
          } catch (error) {
            console.error('[Admin] Tournament execution error:', error);
            tournamentSummary = {
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }

        // Step 3: Repair All Robots (costs deducted)
        console.log(`[Admin] Step 3: Repair All Robots (post-tournament)`);
        const repair2Summary = await repairAllRobots(true);

        // Step 4: Execute League Battles
        console.log(`[Admin] Step 4: Execute League Battles`);
        const battleSummary = await executeScheduledBattles(new Date());

        // Step 5: Rebalance Leagues
        console.log(`[Admin] Step 5: Rebalance Leagues`);
        const rebalancingSummary = await rebalanceLeagues();

        // Step 6: Auto Generate New Users (battle ready)
        console.log(`[Admin] Step 6: Auto Generate New Users`);
        let userGenerationSummary = null;
        if (generateUsersPerCycle) {
          try {
            userGenerationSummary = await generateBattleReadyUsers(currentCycleNumber);
            console.log(`[Admin] Generated ${userGenerationSummary.usersCreated} users for cycle ${currentCycleNumber}`);
          } catch (error) {
            console.error(`[Admin] Error generating users:`, error);
            userGenerationSummary = {
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }

        // Step 7: Repair All Robots (costs deducted)
        console.log(`[Admin] Step 7: Repair All Robots (post-league)`);
        const repair3Summary = await repairAllRobots(true);

        // Step 8: Matchmaking for Leagues
        console.log(`[Admin] Step 8: Matchmaking for Leagues`);
        const scheduledFor = new Date(Date.now() + 1000); // 1 second ahead
        const matchesCreated = await runMatchmaking(scheduledFor);
        const matchmakingSummary = { matchesCreated };

        // Small delay to ensure time passes for next cycle
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Increment cyclesInCurrentLeague for all robots (after rebalancing)
        await prisma.robot.updateMany({
          where: {
            NOT: { name: 'Bye Robot' },
          },
          data: {
            cyclesInCurrentLeague: {
              increment: 1,
            },
          },
        });

        cycleResults.push({
          cycle: currentCycleNumber,
          repair1: repair1Summary,
          tournaments: tournamentSummary,
          repair2: repair2Summary,
          battles: battleSummary,
          rebalancing: rebalancingSummary,
          userGeneration: userGenerationSummary,
          repair3: repair3Summary,
          matchmaking: matchmakingSummary,
          duration: Date.now() - cycleStart,
        });
      } catch (error) {
        console.error(`[Admin] Error in cycle ${currentCycleNumber}:`, error);
        cycleResults.push({
          cycle: currentCycleNumber,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - cycleStart,
        });
      }
    }

    // Update cycle metadata with total cycles completed
    await prisma.cycleMetadata.update({
      where: { id: 1 },
      data: {
        totalCycles: currentCycleNumber,
        lastCycleAt: new Date(),
      },
    });

    const totalDuration = Date.now() - startTime;

    res.json({
      success: true,
      cyclesCompleted: cycleCount,
      totalCyclesInSystem: currentCycleNumber,
      includeTournaments,
      generateUsersPerCycleEnabled: generateUsersPerCycle,
      totalDuration,
      averageCycleDuration: Math.round(totalDuration / cycleCount),
      results: cycleResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Bulk cycles error:', error);
    res.status(500).json({
      error: 'Failed to run bulk cycles',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/stats
 * Get system statistics
 */
router.get('/stats', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Total robots by tier
    const robotsByTier = await prisma.robot.groupBy({
      by: ['currentLeague'],
      where: {
        NOT: { name: 'Bye Robot' },
      },
      _count: { id: true },
      _avg: { elo: true },
    });

    // Battle readiness
    const totalRobots = await prisma.robot.count({
      where: { NOT: { name: 'Bye Robot' } },
    });

    const readyRobots = await prisma.robot.count({
      where: {
        NOT: { name: 'Bye Robot' },
        currentHP: {
          gte: prisma.robot.fields.maxHP,
        },
        mainWeaponId: {
          not: null,
        },
      },
    });

    // Scheduled matches
    const scheduledMatches = await prisma.scheduledMatch.count({
      where: { status: 'scheduled' },
    });

    const completedMatches = await prisma.scheduledMatch.count({
      where: { status: 'completed' },
    });

    // Recent battles
    const recentBattles = await prisma.battle.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    // Total battles
    const totalBattles = await prisma.battle.count();

    // Battle statistics - draw count and duration
    const battles = await prisma.battle.findMany({
      select: {
        winnerId: true,
        robot1Id: true,
        robot2Id: true,
        durationSeconds: true,
        robot1FinalHP: true,
        robot2FinalHP: true,
      },
    });

    const drawCount = battles.filter(b => b.winnerId === null).length;
    const drawPercentage = totalBattles > 0 ? (drawCount / totalBattles) * 100 : 0;
    const avgDuration = battles.length > 0 
      ? battles.reduce((sum, b) => sum + b.durationSeconds, 0) / battles.length 
      : 0;

    // Count kill outcomes (where loser has 0 HP - not including draws)
    const killCount = battles.filter(b => {
      if (!b.winnerId) return false; // Not a draw
      // Check if the loser has 0 HP
      const loserHP = b.winnerId === b.robot1Id ? b.robot2FinalHP : b.robot1FinalHP;
      return loserHP === 0;
    }).length;

    // Financial statistics
    const users = await prisma.user.findMany({
      select: {
        currency: true,
        facilities: {
          select: {
            facilityType: true,
            level: true,
          },
        },
      },
    });

    const totalCredits = users.reduce((sum, u) => sum + u.currency, 0);
    const avgBalance = users.length > 0 ? totalCredits / users.length : 0;
    
    // Users at risk of bankruptcy (using configured threshold)
    const bankruptcyRisk = users.filter(u => u.currency < BANKRUPTCY_RISK_THRESHOLD).length;

    // Facility statistics
    const facilityStats: Record<string, { count: number; totalLevel: number }> = {};
    users.forEach(user => {
      user.facilities.forEach(facility => {
        if (facility.level > 0) { // Only count purchased facilities
          if (!facilityStats[facility.facilityType]) {
            facilityStats[facility.facilityType] = { count: 0, totalLevel: 0 };
          }
          facilityStats[facility.facilityType].count++;
          facilityStats[facility.facilityType].totalLevel += facility.level;
        }
      });
    });

    const facilitySummary = Object.entries(facilityStats)
      .map(([type, stats]) => ({
        type,
        purchaseCount: stats.count,
        avgLevel: stats.count > 0 ? stats.totalLevel / stats.count : 0,
      }))
      .sort((a, b) => b.purchaseCount - a.purchaseCount);

    res.json({
      robots: {
        total: totalRobots,
        byTier: robotsByTier.map(tier => ({
          league: tier.currentLeague,
          count: tier._count.id,
          averageElo: Math.round(tier._avg.elo || 0),
        })),
        battleReady: readyRobots,
        battleReadyPercentage: Math.round((readyRobots / totalRobots) * 100),
      },
      matches: {
        scheduled: scheduledMatches,
        completed: completedMatches,
      },
      battles: {
        last24Hours: recentBattles,
        total: totalBattles,
        draws: drawCount,
        drawPercentage: Math.round(drawPercentage * 10) / 10,
        avgDuration: Math.round(avgDuration * 10) / 10,
        kills: killCount,
        killPercentage: totalBattles > 0 ? Math.round((killCount / totalBattles) * 1000) / 10 : 0,
      },
      finances: {
        totalCredits,
        avgBalance: Math.round(avgBalance),
        usersAtRisk: bankruptcyRisk,
        totalUsers: users.length,
      },
      facilities: {
        summary: facilitySummary,
        totalPurchases: facilitySummary.reduce((sum, f) => sum + f.purchaseCount, 0),
        mostPopular: facilitySummary[0]?.type || 'None',
      },
      weapons: await getWeaponStats(),
      stances: await getStanceStats(),
      loadouts: await getLoadoutStats(),
      yieldThresholds: await getYieldThresholdStats(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve stats',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Helper function to get weapon statistics
async function getWeaponStats() {
  const totalWeapons = await prisma.weapon.count();
  const equippedWeapons = await prisma.robot.count({
    where: {
      NOT: { name: 'Bye Robot' },
      mainWeaponId: { not: null },
    },
  });
  
  return {
    totalBought: totalWeapons,
    equipped: equippedWeapons,
  };
}

// Helper function to get stance statistics
async function getStanceStats() {
  const stances = await prisma.robot.groupBy({
    by: ['stance'],
    where: {
      NOT: { name: 'Bye Robot' },
    },
    _count: { id: true },
  });
  
  return stances.map(s => ({
    stance: s.stance,
    count: s._count.id,
  }));
}

// Helper function to get loadout statistics
async function getLoadoutStats() {
  const loadouts = await prisma.robot.groupBy({
    by: ['loadoutType'],
    where: {
      NOT: { name: 'Bye Robot' },
    },
    _count: { id: true },
  });
  
  return loadouts.map(l => ({
    type: l.loadoutType,
    count: l._count.id,
  }));
}

// Helper function to get yield threshold statistics
async function getYieldThresholdStats() {
  const yieldThresholds = await prisma.robot.groupBy({
    by: ['yieldThreshold'],
    where: {
      NOT: { name: 'Bye Robot' },
    },
    _count: { id: true },
  });
  
  const distribution = yieldThresholds
    .map(y => ({
      threshold: y.yieldThreshold,
      count: y._count.id,
    }))
    .sort((a, b) => a.threshold - b.threshold);
  
  // Find most common threshold
  const mostCommon = distribution.length > 0
    ? distribution.reduce((max, curr) => curr.count > max.count ? curr : max)
    : { threshold: 10, count: 0 };
  
  return {
    distribution,
    mostCommon: mostCommon.threshold,
    mostCommonCount: mostCommon.count,
  };
}

/**
 * GET /api/admin/battles
 * Get paginated list of battles with filtering and search
 */
router.get('/battles', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 per page
    const search = req.query.search as string;
    const leagueType = req.query.leagueType as string;
    const battleType = req.query.battleType as string; // Add battle type filter
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Search by robot name
    if (search) {
      where.OR = [
        {
          robot1: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          robot2: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    // Filter by league type
    if (leagueType && leagueType !== 'all') {
      where.leagueType = leagueType;
    }

    // Filter by battle type (league vs tournament)
    if (battleType && battleType !== 'all') {
      if (battleType === 'tournament') {
        where.tournamentId = { not: null };
      } else if (battleType === 'league') {
        where.tournamentId = null;
      }
    }

    // Get total count for pagination
    const totalBattles = await prisma.battle.count({ where });

    // Get battles with related data
    const battles = await prisma.battle.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        robot1: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
        robot2: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
      },
    });

    res.json({
      battles: battles.map(battle => ({
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
        robot1FinalHP: battle.robot1FinalHP,
        robot2FinalHP: battle.robot2FinalHP,
        robot1ELOBefore: battle.robot1ELOBefore,
        robot2ELOBefore: battle.robot2ELOBefore,
        robot1ELOAfter: battle.robot1ELOAfter,
        robot2ELOAfter: battle.robot2ELOAfter,
        createdAt: battle.createdAt,
      })),
      pagination: {
        page,
        limit,
        totalBattles,
        totalPages: Math.ceil(totalBattles / limit),
        hasMore: skip + battles.length < totalBattles,
      },
    });
  } catch (error) {
    console.error('[Admin] Battles list error:', error);
    res.status(500).json({
      error: 'Failed to retrieve battles',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/battles/:id
 * Get detailed battle information including full combat log
 */
router.get('/battles/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const battleId = parseInt(req.params.id);

    if (isNaN(battleId)) {
      return res.status(400).json({ error: 'Invalid battle ID' });
    }

    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        robot1: true,
        robot2: true,
      },
    });

    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    // Return complete battle data including detailed combat events
    res.json({
      id: battle.id,
      battleType: battle.battleType,
      leagueType: battle.leagueType,
      durationSeconds: battle.durationSeconds,
      createdAt: battle.createdAt,
      
      // Robot data
      robot1: {
        id: battle.robot1.id,
        name: battle.robot1.name,
        userId: battle.robot1.userId,
        maxHP: battle.robot1.maxHP,
        maxShield: battle.robot1.maxShield,
        attributes: {
          combatPower: battle.robot1.combatPower,
          targetingSystems: battle.robot1.targetingSystems,
          criticalSystems: battle.robot1.criticalSystems,
          penetration: battle.robot1.penetration,
          weaponControl: battle.robot1.weaponControl,
          attackSpeed: battle.robot1.attackSpeed,
          armorPlating: battle.robot1.armorPlating,
          shieldCapacity: battle.robot1.shieldCapacity,
          evasionThrusters: battle.robot1.evasionThrusters,
          damageDampeners: battle.robot1.damageDampeners,
          counterProtocols: battle.robot1.counterProtocols,
          hullIntegrity: battle.robot1.hullIntegrity,
          servoMotors: battle.robot1.servoMotors,
          gyroStabilizers: battle.robot1.gyroStabilizers,
          hydraulicSystems: battle.robot1.hydraulicSystems,
          powerCore: battle.robot1.powerCore,
          combatAlgorithms: battle.robot1.combatAlgorithms,
          threatAnalysis: battle.robot1.threatAnalysis,
          adaptiveAI: battle.robot1.adaptiveAI,
          logicCores: battle.robot1.logicCores,
          syncProtocols: battle.robot1.syncProtocols,
          supportSystems: battle.robot1.supportSystems,
          formationTactics: battle.robot1.formationTactics,
        },
        loadout: battle.robot1.loadoutType,
        stance: battle.robot1.stance,
      },
      robot2: {
        id: battle.robot2.id,
        name: battle.robot2.name,
        userId: battle.robot2.userId,
        maxHP: battle.robot2.maxHP,
        maxShield: battle.robot2.maxShield,
        attributes: {
          combatPower: battle.robot2.combatPower,
          targetingSystems: battle.robot2.targetingSystems,
          criticalSystems: battle.robot2.criticalSystems,
          penetration: battle.robot2.penetration,
          weaponControl: battle.robot2.weaponControl,
          attackSpeed: battle.robot2.attackSpeed,
          armorPlating: battle.robot2.armorPlating,
          shieldCapacity: battle.robot2.shieldCapacity,
          evasionThrusters: battle.robot2.evasionThrusters,
          damageDampeners: battle.robot2.damageDampeners,
          counterProtocols: battle.robot2.counterProtocols,
          hullIntegrity: battle.robot2.hullIntegrity,
          servoMotors: battle.robot2.servoMotors,
          gyroStabilizers: battle.robot2.gyroStabilizers,
          hydraulicSystems: battle.robot2.hydraulicSystems,
          powerCore: battle.robot2.powerCore,
          combatAlgorithms: battle.robot2.combatAlgorithms,
          threatAnalysis: battle.robot2.threatAnalysis,
          adaptiveAI: battle.robot2.adaptiveAI,
          logicCores: battle.robot2.logicCores,
          syncProtocols: battle.robot2.syncProtocols,
          supportSystems: battle.robot2.supportSystems,
          formationTactics: battle.robot2.formationTactics,
        },
        loadout: battle.robot2.loadoutType,
        stance: battle.robot2.stance,
      },
      
      // Battle results
      winnerId: battle.winnerId,
      robot1FinalHP: battle.robot1FinalHP,
      robot2FinalHP: battle.robot2FinalHP,
      robot1FinalShield: battle.robot1FinalShield,
      robot2FinalShield: battle.robot2FinalShield,
      robot1DamageDealt: battle.robot1DamageDealt,
      robot2DamageDealt: battle.robot2DamageDealt,
      robot1Yielded: battle.robot1Yielded,
      robot2Yielded: battle.robot2Yielded,
      robot1Destroyed: battle.robot1Destroyed,
      robot2Destroyed: battle.robot2Destroyed,
      
      // ELO changes
      robot1ELOBefore: battle.robot1ELOBefore,
      robot2ELOBefore: battle.robot2ELOBefore,
      robot1ELOAfter: battle.robot1ELOAfter,
      robot2ELOAfter: battle.robot2ELOAfter,
      eloChange: battle.eloChange,
      
      // Economic
      winnerReward: battle.winnerReward,
      loserReward: battle.loserReward,
      robot1RepairCost: battle.robot1RepairCost,
      robot2RepairCost: battle.robot2RepairCost,
      robot1PrestigeAwarded: battle.robot1PrestigeAwarded,
      robot2PrestigeAwarded: battle.robot2PrestigeAwarded,
      robot1FameAwarded: battle.robot1FameAwarded,
      robot2FameAwarded: battle.robot2FameAwarded,
      
      // Combat log with detailed events
      battleLog: battle.battleLog,
    });
  } catch (error) {
    console.error('[Admin] Battle detail error:', error);
    res.status(500).json({
      error: 'Failed to retrieve battle details',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/stats/robots
 * Get comprehensive statistics about robot attributes for debugging and outlier detection
 * 
 * Security Note: This endpoint is protected by authentication and admin-role authorization.
 * Rate limiting not implemented as admin endpoints are used for debugging/analysis only.
 * Future: Consider adding rate limiting for production deployments.
 */
router.get('/stats/robots', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get all robots (excluding bye robots)
    const robots = await prisma.robot.findMany({
      where: {
        NOT: { name: 'Bye Robot' },
      },
      select: {
        id: true,
        name: true,
        userId: true,
        currentLeague: true,
        elo: true,
        totalBattles: true,
        wins: true,
        losses: true,
        draws: true,
        // Combat Systems (6 attributes)
        combatPower: true,
        targetingSystems: true,
        criticalSystems: true,
        penetration: true,
        weaponControl: true,
        attackSpeed: true,
        // Defensive Systems (5 attributes)
        armorPlating: true,
        shieldCapacity: true,
        evasionThrusters: true,
        damageDampeners: true,
        counterProtocols: true,
        // Chassis & Mobility (5 attributes)
        hullIntegrity: true,
        servoMotors: true,
        gyroStabilizers: true,
        hydraulicSystems: true,
        powerCore: true,
        // AI Processing (4 attributes)
        combatAlgorithms: true,
        threatAnalysis: true,
        adaptiveAI: true,
        logicCores: true,
        // Team Coordination (3 attributes)
        syncProtocols: true,
        supportSystems: true,
        formationTactics: true,
      },
    });

    if (robots.length === 0) {
      return res.json({
        message: 'No robots found',
        totalRobots: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Define all 23 attributes to analyze
    const attributes = [
      'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
      'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
      'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
      'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
      'syncProtocols', 'supportSystems', 'formationTactics'
    ];

    // Helper function to calculate statistics for an attribute
    const calculateStats = (values: number[]) => {
      if (values.length === 0) return null;
      
      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((acc, val) => acc + val, 0);
      const mean = sum / values.length;
      
      // Calculate median
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
      
      // Calculate quartiles
      const q1Index = Math.floor(sorted.length * 0.25);
      const q3Index = Math.floor(sorted.length * 0.75);
      const q1 = sorted[q1Index];
      const q3 = sorted[q3Index];
      const iqr = q3 - q1;
      
      // Calculate standard deviation
      const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      // Identify outliers using IQR method (values beyond 1.5 * IQR from quartiles)
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      
      return {
        mean: Number(mean.toFixed(2)),
        median: Number(median.toFixed(2)),
        stdDev: Number(stdDev.toFixed(2)),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        q1: Number(q1.toFixed(2)),
        q3: Number(q3.toFixed(2)),
        iqr: Number(iqr.toFixed(2)),
        lowerBound: Number(lowerBound.toFixed(2)),
        upperBound: Number(upperBound.toFixed(2)),
      };
    };

    // Calculate statistics for each attribute
    const attributeStats: any = {};
    const outliers: any = {};

    for (const attr of attributes) {
      const values = robots.map(r => Number((r as any)[attr]));
      const stats = calculateStats(values);
      
      if (stats) {
        attributeStats[attr] = stats;
        
        // Find outliers for this attribute
        const robotsWithOutliers = robots
          .map(r => ({
            id: r.id,
            name: r.name,
            value: Number((r as any)[attr]),
            league: r.currentLeague,
            elo: r.elo,
            winRate: r.totalBattles > 0 ? Number((r.wins / r.totalBattles * 100).toFixed(1)) : 0,
          }))
          .filter(r => r.value < stats.lowerBound || r.value > stats.upperBound)
          .sort((a, b) => Math.abs(b.value - stats.mean) - Math.abs(a.value - stats.mean))
          .slice(0, 10); // Top 10 outliers
        
        if (robotsWithOutliers.length > 0) {
          outliers[attr] = robotsWithOutliers;
        }
      }
    }

    // Calculate statistics by league tier
    const leagues = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
    const statsByLeague: any = {};

    for (const league of leagues) {
      const leagueRobots = robots.filter(r => r.currentLeague === league);
      if (leagueRobots.length === 0) continue;

      statsByLeague[league] = {
        count: leagueRobots.length,
        averageElo: Number((leagueRobots.reduce((sum, r) => sum + r.elo, 0) / leagueRobots.length).toFixed(0)),
        attributes: {} as any,
      };

      for (const attr of attributes) {
        const values = leagueRobots.map(r => Number((r as any)[attr]));
        const stats = calculateStats(values);
        if (stats) {
          statsByLeague[league].attributes[attr] = {
            mean: stats.mean,
            median: stats.median,
            min: stats.min,
            max: stats.max,
          };
        }
      }
    }

    // Calculate win rate correlations
    // For each attribute, group robots into ranges and calculate average win rate
    const winRateAnalysis: any = {};
    
    for (const attr of attributes) {
      const robotsWithWinRate = robots
        .filter(r => r.totalBattles >= 5) // Only consider robots with at least 5 battles
        .map(r => ({
          value: Number((r as any)[attr]),
          winRate: r.wins / r.totalBattles,
        }));

      if (robotsWithWinRate.length === 0) continue;

      // Sort by attribute value and divide into 5 quintiles
      robotsWithWinRate.sort((a, b) => a.value - b.value);
      const quintileSize = Math.floor(robotsWithWinRate.length / 5);
      
      const quintiles = [];
      for (let i = 0; i < 5; i++) {
        const start = i * quintileSize;
        const end = i === 4 ? robotsWithWinRate.length : (i + 1) * quintileSize;
        const quintileRobots = robotsWithWinRate.slice(start, end);
        
        if (quintileRobots.length > 0) {
          const avgValue = quintileRobots.reduce((sum, r) => sum + r.value, 0) / quintileRobots.length;
          const avgWinRate = quintileRobots.reduce((sum, r) => sum + r.winRate, 0) / quintileRobots.length;
          
          quintiles.push({
            quintile: i + 1,
            avgValue: Number(avgValue.toFixed(2)),
            avgWinRate: Number((avgWinRate * 100).toFixed(1)),
            sampleSize: quintileRobots.length,
          });
        }
      }
      
      winRateAnalysis[attr] = quintiles;
    }

    // Find top and bottom performers by each attribute
    const topPerformers: any = {};
    const bottomPerformers: any = {};

    for (const attr of attributes) {
      const sorted = [...robots].sort((a, b) => Number((b as any)[attr]) - Number((a as any)[attr]));
      
      topPerformers[attr] = sorted.slice(0, 5).map(r => ({
        id: r.id,
        name: r.name,
        value: Number((r as any)[attr]),
        league: r.currentLeague,
        elo: r.elo,
        winRate: r.totalBattles > 0 ? Number((r.wins / r.totalBattles * 100).toFixed(1)) : 0,
      }));

      bottomPerformers[attr] = sorted.slice(-5).reverse().map(r => ({
        id: r.id,
        name: r.name,
        value: Number((r as any)[attr]),
        league: r.currentLeague,
        elo: r.elo,
        winRate: r.totalBattles > 0 ? Number((r.wins / r.totalBattles * 100).toFixed(1)) : 0,
      }));
    }

    // Overall summary statistics
    const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0);
    const robotsWithBattles = robots.filter(r => r.totalBattles > 0);
    const overallWinRate = totalBattles > 0
      ? robots.reduce((sum, r) => sum + r.wins, 0) / totalBattles * 100
      : 0;

    res.json({
      summary: {
        totalRobots: robots.length,
        robotsWithBattles: robotsWithBattles.length,
        totalBattles,
        overallWinRate: Number(overallWinRate.toFixed(2)),
        averageElo: Number((robots.reduce((sum, r) => sum + r.elo, 0) / robots.length).toFixed(0)),
      },
      attributeStats,
      outliers,
      statsByLeague,
      winRateAnalysis,
      topPerformers,
      bottomPerformers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Robot stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve robot statistics',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
