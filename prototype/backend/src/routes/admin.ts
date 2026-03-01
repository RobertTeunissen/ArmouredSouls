import express, { Request, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { executeScheduledBattles } from '../services/battleOrchestrator';
import { runMatchmaking } from '../services/matchmakingService';
import { rebalanceLeagues } from '../services/leagueRebalancingService';
import { rebalanceTagTeamLeagues } from '../services/tagTeamLeagueRebalancingService';
import { shouldRunTagTeamMatchmaking as _shouldRunTagTeamMatchmaking, runTagTeamMatchmaking } from '../services/tagTeamMatchmakingService';
import { executeScheduledTagTeamBattles } from '../services/tagTeamBattleOrchestrator';
import { processAllDailyFinances } from '../utils/economyCalculations';
import { generateBattleReadyUsers } from '../utils/userGeneration';
import { calculateMaxHP, calculateRepairCost, calculateAttributeSum } from '../utils/robotCalculations';
import { repairAllRobots } from '../services/repairService';
import { cycleLogger } from '../utils/cycleLogger';
import prisma from '../lib/prisma';
import tournamentRoutes from './adminTournaments';
import { 
  getActiveTournaments, 
  getCurrentRoundMatches,
  autoCreateNextTournament 
} from '../services/tournamentService';
import { processTournamentBattle } from '../services/tournamentBattleOrchestrator';
import { advanceWinnersToNextRound } from '../services/tournamentService';
import { EventLogger } from '../services/eventLogger';
import { getSchedulerState } from '../services/cycleScheduler';

const router = express.Router();
const eventLogger = new EventLogger();

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

    // Group robots by user to apply facility discounts
    const robotsByUser = new Map<number, typeof robots>();
    for (const robot of robots) {
      if (!robotsByUser.has(robot.userId)) {
        robotsByUser.set(robot.userId, []);
      }
      robotsByUser.get(robot.userId)!.push(robot);
    }

    for (const [userId, userRobots] of robotsByUser.entries()) {
      // Get repair bay and medical bay facilities for discounts
      const facilities = await prisma.facility.findMany({
        where: {
          userId,
          facilityType: {
            in: ['repair_bay', 'medical_bay'],
          },
        },
      });

      const repairBay = facilities.find(f => f.facilityType === 'repair_bay');
      const medicalBay = facilities.find(f => f.facilityType === 'medical_bay');
      
      const repairBayLevel = repairBay?.level || 0;
      const medicalBayLevel = medicalBay?.level || 0;
      
      // Query active robot count for multi-robot discount
      const activeRobotCount = await prisma.robot.count({
        where: {
          userId,
          NOT: { name: 'Bye Robot' }
        }
      });

      let totalUserRepairCost = 0;

      for (const robot of userRobots) {
        // Fetch full robot data for attribute calculation
        const fullRobot = await prisma.robot.findUnique({
          where: { id: robot.id },
        });
        
        if (!fullRobot) continue;
        
        // Use the SAME calculation as repairService.ts
        const sumOfAllAttributes = calculateAttributeSum(fullRobot);
        const damageTaken = fullRobot.maxHP - fullRobot.currentHP;
        const damagePercent = (damageTaken / fullRobot.maxHP) * 100;
        const hpPercent = (fullRobot.currentHP / fullRobot.maxHP) * 100;
        
        const repairCost = calculateRepairCost(
          sumOfAllAttributes,
          damagePercent,
          hpPercent,
          repairBayLevel,
          medicalBayLevel,
          activeRobotCount
        );
        
        const hpToRestore = robot.maxHP - robot.currentHP;

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
          baseCost: repairCost,
          discount: 0, // Discount already included in calculation
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
      _includeDailyFinances = false, // Deprecated, kept for backwards compatibility
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
      
      // Start cycle logging
      cycleLogger.startCycle(currentCycleNumber);
      cycleLogger.log('INFO', `Cycle ${currentCycleNumber} (${i}/${cycleCount})`);

      console.log(`\n[Admin] === Cycle ${currentCycleNumber} (${i}/${cycleCount}) ===`);

      try {
        // Log cycle start
        await eventLogger.logCycleStart(currentCycleNumber, 'manual');

        // Step 1: Execute League Battles (1v1) - matches scheduled in previous cycle
        console.log(`[Admin] Step 1: Execute League Battles (1v1)`);
        const step1Start = Date.now();
        const battleSummary = await executeScheduledBattles(new Date());
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'execute_league_battles',
          1,
          Date.now() - step1Start,
          { battlesExecuted: battleSummary.totalBattles }
        );

        // Step 2: Repair All Robots (costs deducted) - after league battles
        console.log(`[Admin] Step 2: Repair All Robots (post-league)`);
        const step2Start = Date.now();
        const repair1Summary = await repairAllRobots(true, currentCycleNumber);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'repair_post_league',
          2,
          Date.now() - step2Start,
          { robotsRepaired: repair1Summary.robotsRepaired, totalCost: repair1Summary.totalFinalCost }
        );

        // Step 3: Execute Tag Team Battles (odd cycles only, after 1v1)
        // Requirement 11.4: Process 1v1 matches before tag team matches
        let tagTeamBattleSummary = null;
        const shouldRunTagTeam = currentCycleNumber % 2 === 1; // Odd cycles only
        if (shouldRunTagTeam) {
          console.log(`[Admin] Step 3: Execute Tag Team Battles (Cycle ${currentCycleNumber})`);
          const step3Start = Date.now();
          tagTeamBattleSummary = await executeScheduledTagTeamBattles(new Date());
          await eventLogger.logCycleStepComplete(
            currentCycleNumber,
            'execute_tag_team_battles',
            3,
            Date.now() - step3Start,
            { battlesExecuted: tagTeamBattleSummary?.totalBattles || 0 }
          );
        } else {
          console.log(`[Admin] Step 3: Skipping Tag Team Battles (even cycle ${currentCycleNumber})`);
        }

        // Step 4: Repair All Robots (costs deducted) - after tag team battles
        console.log(`[Admin] Step 4: Repair All Robots (post-tag-team)`);
        const step4Start = Date.now();
        const repair2Summary = await repairAllRobots(true, currentCycleNumber);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'repair_post_tag_team',
          4,
          Date.now() - step4Start,
          { robotsRepaired: repair2Summary.robotsRepaired, totalCost: repair2Summary.totalFinalCost }
        );

        // Step 5: Tournament Execution / Scheduling
        console.log(`[Admin] Step 5: Tournament Execution / Scheduling`);
        const step5Start = Date.now();
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
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'tournament_execution',
          5,
          Date.now() - step5Start,
          { 
            tournamentsExecuted: tournamentSummary?.tournamentsExecuted || 0,
            matchesExecuted: tournamentSummary?.matchesExecuted || 0
          }
        );

        // Step 6: Repair All Robots (costs deducted) - after tournaments
        console.log(`[Admin] Step 6: Repair All Robots (post-tournament)`);
        const step6Start = Date.now();
        const repair3Summary = await repairAllRobots(true, currentCycleNumber);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'repair_post_tournament',
          6,
          Date.now() - step6Start,
          { robotsRepaired: repair3Summary.robotsRepaired, totalCost: repair3Summary.totalFinalCost }
        );

        // Step 7: Rebalance Leagues
        console.log(`[Admin] Step 7: Rebalance Leagues`);
        const step7Start = Date.now();
        const rebalancingSummary = await rebalanceLeagues();
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'rebalance_leagues',
          7,
          Date.now() - step7Start,
          { promotions: rebalancingSummary.totalPromoted, demotions: rebalancingSummary.totalDemoted }
        );

        // Step 7.5: Rebalance Tag Team Leagues (odd cycles only)
        let tagTeamRebalancingSummary = null;
        if (shouldRunTagTeam) {
          console.log(`[Admin] Step 7.5: Rebalance Tag Team Leagues (Cycle ${currentCycleNumber})`);
          const step7_5Start = Date.now();
          tagTeamRebalancingSummary = await rebalanceTagTeamLeagues();
          await eventLogger.logCycleStepComplete(
            currentCycleNumber,
            'rebalance_tag_team_leagues',
            8,
            Date.now() - step7_5Start,
            { promotions: tagTeamRebalancingSummary.totalPromoted, demotions: tagTeamRebalancingSummary.totalDemoted }
          );
        } else {
          console.log(`[Admin] Step 7.5: Skipping Tag Team Rebalancing (even cycle ${currentCycleNumber})`);
        }

        // Step 8: Auto Generate New Users (battle ready)
        console.log(`[Admin] Step 8: Auto Generate New Users`);
        const step8Start = Date.now();
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
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'auto_generate_users',
          9,
          Date.now() - step8Start,
          { usersCreated: userGenerationSummary?.usersCreated || 0 }
        );

        // Step 9: Matchmaking for Leagues (1v1) - schedule for next cycle
        console.log(`[Admin] Step 9: Matchmaking for Leagues (1v1)`);
        const step9Start = Date.now();
        const scheduledFor = new Date(Date.now() + 1000); // 1 second ahead
        const matchesCreated = await runMatchmaking(scheduledFor);
        const matchmakingSummary = { matchesCreated };
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'matchmaking_leagues',
          10,
          Date.now() - step9Start,
          { matchesCreated }
        );

        // Step 9.5: Matchmaking for Tag Teams (odd cycles only)
        let tagTeamMatchmakingSummary = null;
        if (shouldRunTagTeam) {
          console.log(`[Admin] Step 9.5: Matchmaking for Tag Teams (Cycle ${currentCycleNumber})`);
          const step9_5Start = Date.now();
          const tagTeamMatchesCreated = await runTagTeamMatchmaking(scheduledFor);
          tagTeamMatchmakingSummary = { matchesCreated: tagTeamMatchesCreated };
          await eventLogger.logCycleStepComplete(
            currentCycleNumber,
            'matchmaking_tag_teams',
            11,
            Date.now() - step9_5Start,
            { matchesCreated: tagTeamMatchesCreated }
          );
        } else {
          console.log(`[Admin] Step 9.5: Skipping Tag Team Matchmaking (even cycle ${currentCycleNumber})`);
        }

        // Step 10: Increment Cycle Counters
        console.log(`[Admin] Step 10: Increment Cycle Counters`);
        const step10Start = Date.now();
        
        // Update cycle metadata with current cycle number
        await prisma.cycleMetadata.update({
          where: { id: 1 },
          data: {
            totalCycles: currentCycleNumber,
            lastCycleAt: new Date(),
          },
        });

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

        // Increment cyclesInTagTeamLeague for all tag teams (after rebalancing)
        await prisma.tagTeam.updateMany({
          data: {
            cyclesInTagTeamLeague: {
              increment: 1,
            },
          },
        });
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'increment_cycle_counters',
          12,
          Date.now() - step10Start,
          {}
        );

        // Step 11: Calculate and Log Passive Income & Operating Costs
        console.log(`[Admin] Step 11: Calculate Passive Income & Operating Costs`);
        const step11Start = Date.now();
        const { calculateDailyPassiveIncome, calculateFacilityOperatingCost } = await import('../utils/economyCalculations');
        
        // Get all users
        const allUsers = await prisma.user.findMany({
          where: {
            NOT: { username: 'bye_robot_user' }, // Exclude system users
          },
          select: { id: true, prestige: true },
        });

        let totalPassiveIncome = 0;
        let totalOperatingCosts = 0;

        for (const user of allUsers) {
          // Calculate passive income
          const passiveIncome = await calculateDailyPassiveIncome(user.id);
          
          // Get user's facilities for operating costs
          const facilities = await prisma.facility.findMany({
            where: { userId: user.id },
          });

          // Get user's robots to calculate roster costs
          const userRobots = await prisma.robot.findMany({
            where: { userId: user.id },
            select: { totalBattles: true, fame: true },
          });

          const facilityCosts = facilities.map(f => ({
            facilityType: f.facilityType,
            level: f.level,
            cost: calculateFacilityOperatingCost(f.facilityType, f.level),
          }));

          let totalCost = facilityCosts.reduce((sum, f) => sum + f.cost, 0);

          // Add roster expansion cost: ₡500/day per robot beyond first
          if (userRobots.length > 1) {
            const rosterCost = (userRobots.length - 1) * 500;
            facilityCosts.push({
              facilityType: 'roster_expansion',
              level: 0, // Not level-based
              cost: rosterCost,
            });
            totalCost += rosterCost;
          }

          const totalBattles = userRobots.reduce((sum, r) => sum + r.totalBattles, 0);
          const totalFame = userRobots.reduce((sum, r) => sum + r.fame, 0);

          const incomeGenerator = await prisma.facility.findUnique({
            where: {
              userId_facilityType: {
                userId: user.id,
                facilityType: 'merchandising_hub',
              },
            },
          });

          // Log passive income event and credit user account
          if (passiveIncome.total > 0) {
            await eventLogger.logPassiveIncome(
              currentCycleNumber,
              user.id,
              passiveIncome.merchandising,
              0, // Streaming revenue is now per-battle, not passive income
              incomeGenerator?.level || 0,
              user.prestige,
              totalBattles,
              totalFame
            );
            
            // Credit the passive income to user's account
            await prisma.user.update({
              where: { id: user.id },
              data: {
                currency: {
                  increment: passiveIncome.total,
                },
              },
            });
            
            totalPassiveIncome += passiveIncome.total;
          }

          // Log operating costs event and debit user account
          if (totalCost > 0) {
            await eventLogger.logOperatingCosts(
              currentCycleNumber,
              user.id,
              facilityCosts.filter(f => f.cost > 0),
              totalCost
            );
            
            // Deduct operating costs from user's account
            const _userBeforeDeduction = await prisma.user.findUnique({
              where: { id: user.id },
              select: { currency: true },
            });
            
            await prisma.user.update({
              where: { id: user.id },
              data: {
                currency: {
                  decrement: totalCost,
                },
              },
            });
            
            // Console log for cycle logs
            const facilityList = facilityCosts.filter(f => f.cost > 0).map(f => `${f.facilityType}(L${f.level}): ₡${f.cost}`).join(', ');
            console.log(`[OperatingCosts] User ${user.id} | Total: ₡${totalCost.toLocaleString()} | Facilities: ${facilityList}`);
            
            totalOperatingCosts += totalCost;
          }
        }

        console.log(`[Admin] Passive income: ₡${totalPassiveIncome.toLocaleString()}, Operating costs: ₡${totalOperatingCosts.toLocaleString()}`);
        
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'calculate_passive_income_and_costs',
          11,
          Date.now() - step11Start,
          { 
            usersProcessed: allUsers.length,
            totalPassiveIncome,
            totalOperatingCosts,
          }
        );

        // Step 12: Wait (1.1 second delay)
        console.log(`[Admin] Step 12: Wait (1.1 second delay)`);
        const step12Start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 1100));
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'wait_delay',
          12,
          Date.now() - step12Start,
          {}
        );

        // Log cycle complete
        const cycleDuration = Date.now() - cycleStart;
        await eventLogger.logCycleComplete(currentCycleNumber, cycleDuration);

        // Step 13: Log End-of-Cycle Balances
        console.log(`[Admin] Step 13: Log End-of-Cycle Balances`);
        console.log(`[Admin] === End of Cycle ${currentCycleNumber} Balances ===`);
        const step13Start = Date.now();
        const endOfCycleUsers = await prisma.user.findMany({
          where: {
            NOT: { username: 'bye_robot_user' },
          },
          select: {
            id: true,
            username: true,
            stableName: true,
            currency: true,
          },
          orderBy: { id: 'asc' },
        });

        for (const user of endOfCycleUsers) {
          console.log(`[Balance] User ${user.id} | Stable: ${user.stableName || user.username} | Balance: ₡${user.currency.toLocaleString()}`);
          
          // Log end-of-cycle balance to audit log
          await eventLogger.logCycleEndBalance(
            currentCycleNumber,
            user.id,
            user.username,
            user.stableName,
            user.currency
          );
        }
        console.log(`[Admin] ===================================`);
        await eventLogger.logCycleStepComplete(
          currentCycleNumber,
          'log_end_of_cycle_balances',
          13,
          Date.now() - step13Start,
          { usersLogged: endOfCycleUsers.length }
        );

        // Step 14: Create Cycle Snapshot for analytics (LAST STEP - aggregates all data including balances)
        console.log(`[Admin] Step 14: Create Cycle Snapshot`);
        const step14Start = Date.now();
        try {
          const { cycleSnapshotService } = await import('../services/cycleSnapshotService');
          await cycleSnapshotService.createSnapshot(currentCycleNumber);
          console.log(`[Admin] Cycle snapshot created for cycle ${currentCycleNumber}`);
          await eventLogger.logCycleStepComplete(
            currentCycleNumber,
            'create_cycle_snapshot',
            14,
            Date.now() - step14Start,
            {}
          );
        } catch (snapshotError) {
          console.error(`[Admin] Failed to create cycle snapshot:`, snapshotError);
          // Don't fail the entire cycle if snapshot creation fails
        }

        // Display Cycle Summary
        console.log(`[Admin] === Cycle ${currentCycleNumber} Summary ===`);
        console.log(`[Admin] Battles: ${battleSummary.totalBattles}`);
        const totalStreamingRevenue = (battleSummary.totalStreamingRevenue || 0) + (tagTeamBattleSummary?.totalStreamingRevenue || 0);
        if (totalStreamingRevenue > 0) {
          console.log(`[Admin] Streaming Revenue: ₡${totalStreamingRevenue.toLocaleString()}`);
        }
        console.log(`[Admin] ===================================`);

        cycleResults.push({
          cycle: currentCycleNumber,
          battles: battleSummary,
          repair1: repair1Summary,
          tagTeamBattles: tagTeamBattleSummary,
          repair2: repair2Summary,
          tournaments: tournamentSummary,
          repair3: repair3Summary,
          rebalancing: rebalancingSummary,
          tagTeamRebalancing: tagTeamRebalancingSummary,
          userGeneration: userGenerationSummary,
          matchmaking: matchmakingSummary,
          tagTeamMatchmaking: tagTeamMatchmakingSummary,
          totalStreamingRevenue,
          duration: Date.now() - cycleStart,
        });

        // End cycle logging
        cycleLogger.endCycle();
      } catch (error) {
        console.error(`[Admin] Error in cycle ${currentCycleNumber}:`, error);
        cycleLogger.log('ERROR', `Cycle ${currentCycleNumber} failed`, { error: error instanceof Error ? error.message : String(error) });
        cycleLogger.endCycle();
        
        cycleResults.push({
          cycle: currentCycleNumber,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - cycleStart,
        });
      }
    }

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
 * POST /api/admin/snapshots/backfill
 * Backfill cycle snapshots for cycles that don't have them
 */
router.post('/snapshots/backfill', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[Admin] Backfilling cycle snapshots...');
    
    const { cycleSnapshotService } = await import('../services/cycleSnapshotService');
    
    // Get current cycle number
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    if (!cycleMetadata || cycleMetadata.totalCycles === 0) {
      return res.json({
        success: true,
        message: 'No cycles to backfill',
        snapshotsCreated: 0,
      });
    }

    const totalCycles = cycleMetadata.totalCycles;
    const snapshotsCreated = [];
    const errors = [];

    // Check which cycles already have snapshots
    const existingSnapshots = await prisma.cycleSnapshot.findMany({
      select: { cycleNumber: true },
    });
    const existingCycles = new Set(existingSnapshots.map(s => s.cycleNumber));

    // Create snapshots for missing cycles
    for (let cycle = 1; cycle <= totalCycles; cycle++) {
      if (existingCycles.has(cycle)) {
        console.log(`[Admin] Snapshot already exists for cycle ${cycle}, skipping`);
        continue;
      }

      try {
        console.log(`[Admin] Creating snapshot for cycle ${cycle}`);
        await cycleSnapshotService.createSnapshot(cycle);
        snapshotsCreated.push(cycle);
      } catch (error) {
        console.error(`[Admin] Failed to create snapshot for cycle ${cycle}:`, error);
        errors.push({
          cycle,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    res.json({
      success: true,
      totalCycles,
      snapshotsCreated: snapshotsCreated.length,
      cycles: snapshotsCreated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Admin] Backfill snapshots error:', error);
    res.status(500).json({
      error: 'Failed to backfill snapshots',
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
        participants: true, // Get BattleParticipant data
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
      // Check if the loser has 0 HP from BattleParticipant data
      const loserParticipant = b.participants.find(p => p.robotId !== b.winnerId);
      return loserParticipant?.finalHP === 0;
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

/**
 * GET /api/admin/users/at-risk
 * Get list of users at risk of bankruptcy with financial history
 */
router.get('/users/at-risk', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get current cycle number
    const cycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });
    const currentCycle = cycleMetadata?.totalCycles || 0;

    // Get users below bankruptcy threshold
    const atRiskUsers = await prisma.user.findMany({
      where: {
        currency: {
          lt: BANKRUPTCY_RISK_THRESHOLD,
        },
      },
      select: {
        id: true,
        username: true,
        stableName: true,
        currency: true,
        createdAt: true,
        robots: {
          select: {
            id: true,
            name: true,
            currentHP: true,
            maxHP: true,
            repairCost: true,
            battleReadiness: true,
          },
        },
      },
      orderBy: {
        currency: 'asc', // Most at risk first
      },
    });

    // For each user, get their financial history from audit logs
    const usersWithHistory = await Promise.all(
      atRiskUsers.map(async (user) => {
        // Get all financial events from audit logs
        const financialEvents = await prisma.auditLog.findMany({
          where: {
            userId: user.id,
            eventType: {
              in: ['credit_change', 'operating_costs', 'passive_income', 'robot_repair'],
            },
            cycleNumber: {
              gte: Math.max(1, currentCycle - 30), // Last 30 cycles
            },
          },
          select: {
            cycleNumber: true,
            eventTimestamp: true,
            eventType: true,
            payload: true,
            sequenceNumber: true,
          },
          orderBy: [
            { cycleNumber: 'desc' },
            { sequenceNumber: 'desc' },
          ],
        });

        // Calculate balance for each cycle by working backwards from current balance
        const cycleMap = new Map<number, { costs: number; income: number; repairs: number }>();
        
        for (const event of financialEvents) {
          const cycle = event.cycleNumber;
          if (!cycleMap.has(cycle)) {
            cycleMap.set(cycle, { costs: 0, income: 0, repairs: 0 });
          }
          
          const cycleData = cycleMap.get(cycle)!;
          
          if (event.eventType === 'operating_costs') {
            cycleData.costs += (event.payload as Record<string, number>)?.totalCost || 0;
          } else if (event.eventType === 'passive_income') {
            cycleData.income += (event.payload as Record<string, number>)?.totalIncome || 0;
          } else if (event.eventType === 'robot_repair') {
            cycleData.repairs += (event.payload as Record<string, number>)?.cost || 0;
          } else if (event.eventType === 'credit_change') {
            // Track credit changes (battle rewards, etc.)
            const amount = (event.payload as Record<string, number>)?.amount || 0;
            if (amount > 0) {
              cycleData.income += amount;
            } else {
              cycleData.costs += Math.abs(amount);
            }
          }
        }

        // Build balance history by working backwards from current balance
        const cycles = Array.from(cycleMap.keys()).sort((a, b) => b - a); // Descending order
        const balanceHistory: Array<{
          cycle: number;
          timestamp: Date;
          balance: number;
          dailyCost: number;
          dailyIncome: number;
        }> = [];
        
        let runningBalance = user.currency; // Start with current balance (end of most recent cycle)
        
        for (const cycle of cycles) {
          const data = cycleMap.get(cycle)!;
          const totalCosts = data.costs + data.repairs;
          const netChange = data.income - totalCosts;
          
          // Store the balance at the END of this cycle
          balanceHistory.push({
            cycle,
            timestamp: financialEvents.find(e => e.cycleNumber === cycle)?.eventTimestamp || new Date(),
            balance: runningBalance,
            dailyCost: totalCosts,
            dailyIncome: data.income,
          });
          
          // Work backwards: subtract the net change to get balance at END of previous cycle
          runningBalance -= netChange;
        }
        
        // Sort by cycle descending (most recent first) and limit to 10
        balanceHistory.sort((a, b) => b.cycle - a.cycle);
        const recentHistory = balanceHistory.slice(0, 10);

        // Determine when they first went below threshold
        let cyclesAtRisk = 0;
        let firstAtRiskCycle = null;
        
        // Check balance history in reverse chronological order
        for (let i = 0; i < balanceHistory.length; i++) {
          if (balanceHistory[i].balance < BANKRUPTCY_RISK_THRESHOLD) {
            cyclesAtRisk++;
            firstAtRiskCycle = balanceHistory[i].cycle;
          } else {
            // Found a cycle where they were above threshold, stop counting
            break;
          }
        }

        // Calculate total repair costs needed
        const totalRepairCost = user.robots.reduce((sum, robot) => sum + robot.repairCost, 0);

        // Calculate days of runway (assuming average daily cost)
        const avgDailyCost = recentHistory.length > 0
          ? recentHistory.reduce((sum, h) => sum + h.dailyCost, 0) / recentHistory.length
          : 0;
        const daysOfRunway = avgDailyCost > 0 ? Math.floor(user.currency / avgDailyCost) : 999;

        return {
          userId: user.id,
          username: user.username,
          stableName: user.stableName || user.username,
          currentBalance: user.currency,
          totalRepairCost,
          netBalance: user.currency - totalRepairCost,
          cyclesAtRisk,
          firstAtRiskCycle,
          daysOfRunway,
          robotCount: user.robots.length,
          damagedRobots: user.robots.filter(r => r.battleReadiness < 100).length,
          balanceHistory: recentHistory,
          createdAt: user.createdAt,
        };
      })
    );

    res.json({
      threshold: BANKRUPTCY_RISK_THRESHOLD,
      currentCycle,
      totalAtRisk: usersWithHistory.length,
      users: usersWithHistory,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] At-risk users error:', error);
    res.status(500).json({
      error: 'Failed to retrieve at-risk users',
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        participants: true, // Include BattleParticipant data
      },
    });

    res.json({
      battles: battles.map(battle => {
        const robot1Participant = battle.participants.find(p => p.robotId === battle.robot1Id);
        const robot2Participant = battle.participants.find(p => p.robotId === battle.robot2Id);
        
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
        };
      }),
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
      
      // Get participant data from BattleParticipant table
      participants: await prisma.battleParticipant.findMany({
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
      }),
      
      // Battle results (kept for backward compatibility)
      winnerId: battle.winnerId,
      
      // ELO changes (from Battle table for now)
      robot1ELOBefore: battle.robot1ELOBefore,
      robot2ELOBefore: battle.robot2ELOBefore,
      robot1ELOAfter: battle.robot1ELOAfter,
      robot2ELOAfter: battle.robot2ELOAfter,
      eloChange: battle.eloChange,
      
      // Economic (from Battle table for now)
      winnerReward: battle.winnerReward,
      loserReward: battle.loserReward,
      
      // Tag Team specific fields (null for non-tag-team battles)
      team1ActiveRobotId: battle.team1ActiveRobotId,
      team1ReserveRobotId: battle.team1ReserveRobotId,
      team2ActiveRobotId: battle.team2ActiveRobotId,
      team2ReserveRobotId: battle.team2ReserveRobotId,
      team1TagOutTime: battle.team1TagOutTime ? Number(battle.team1TagOutTime) / 1000 : null, // Convert to seconds
      team2TagOutTime: battle.team2TagOutTime ? Number(battle.team2TagOutTime) / 1000 : null, // Convert to seconds
      
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

/**
 * POST /api/admin/tag-teams/matchmaking
 * Manually trigger tag team matchmaking
 */
router.post('/tag-teams/matchmaking', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { scheduledFor } = req.body;
    const targetTime = scheduledFor ? new Date(scheduledFor) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    console.log('[Admin] Triggering tag team matchmaking...');
    const totalMatches = await runTagTeamMatchmaking(targetTime);

    res.json({
      success: true,
      matchesCreated: totalMatches,
      scheduledFor: targetTime.toISOString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Tag team matchmaking error:', error);
    res.status(500).json({
      error: 'Failed to run tag team matchmaking',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/tag-teams/battles
 * Manually execute scheduled tag team battles
 */
router.post('/tag-teams/battles', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { scheduledFor } = req.body;
    const targetTime = scheduledFor ? new Date(scheduledFor) : undefined;

    console.log('[Admin] Executing tag team battles...');
    const summary = await executeScheduledTagTeamBattles(targetTime);

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Tag team battle execution error:', error);
    res.status(500).json({
      error: 'Failed to execute tag team battles',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/tag-teams/rebalance
 * Manually trigger tag team league rebalancing
 */
router.post('/tag-teams/rebalance', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[Admin] Triggering tag team league rebalancing...');
    const summary = await rebalanceTagTeamLeagues();

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Tag team rebalancing error:', error);
    res.status(500).json({
      error: 'Failed to rebalance tag team leagues',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/scheduler/status
 * Return the current state of the Cycle Scheduler
 */
router.get('/scheduler/status', authenticateToken, requireAdmin, (_req: Request, res: Response) => {
  const state = getSchedulerState();
  res.json(state);
});

export default router;
