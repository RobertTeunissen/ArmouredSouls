import express, { Request, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { executeScheduledBattles } from '../services/battleOrchestrator';
import { runMatchmaking } from '../services/matchmakingService';
import { rebalanceLeagues } from '../services/leagueRebalancingService';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

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
      },
    });

    const repairs = [];
    const REPAIR_COST_PER_HP = 50; // 50 credits per HP

    for (const robot of robots) {
      const hpToRestore = robot.maxHP - robot.currentHP;
      const repairCost = hpToRestore * REPAIR_COST_PER_HP;

      // Update robot HP
      await prisma.robot.update({
        where: { id: robot.id },
        data: { currentHP: robot.maxHP },
      });

      // Deduct costs if requested
      if (deductCosts) {
        await prisma.user.update({
          where: { id: robot.userId },
          data: {
            currency: {
              decrement: repairCost,
            },
          },
        });
      }

      repairs.push({
        robotId: robot.id,
        robotName: robot.name,
        hpRestored: hpToRestore,
        cost: repairCost,
        costDeducted: deductCosts,
      });
    }

    res.json({
      success: true,
      robotsRepaired: robots.length,
      totalCost: repairs.reduce((sum, r) => sum + r.cost, 0),
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
 * POST /api/admin/cycles/bulk
 * Run multiple complete cycles (matchmaking → battles → rebalancing)
 */
router.post('/cycles/bulk', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cycles = 1, autoRepair = false } = req.body;
    const maxCycles = 100;
    const cycleCount = Math.min(Math.max(1, cycles), maxCycles);

    console.log(`[Admin] Running ${cycleCount} bulk cycles (autoRepair: ${autoRepair})...`);

    const cycleResults = [];
    const startTime = Date.now();

    for (let i = 1; i <= cycleCount; i++) {
      const cycleStart = Date.now();
      console.log(`\n[Admin] === Cycle ${i}/${cycleCount} ===`);

      try {
        // Step 1: Auto-repair if enabled
        let repairSummary = null;
        if (autoRepair) {
          const robots = await prisma.robot.findMany({
            where: {
              currentHP: { lt: prisma.robot.fields.maxHP },
              NOT: { name: 'Bye Robot' },
            },
          });

          for (const robot of robots) {
            await prisma.robot.update({
              where: { id: robot.id },
              data: { currentHP: robot.maxHP },
            });
          }

          repairSummary = { robotsRepaired: robots.length };
        }

        // Step 2: Matchmaking
        const scheduledFor = new Date(Date.now() + 1000); // 1 second ahead
        const matchesCreated = await runMatchmaking(scheduledFor);
        const matchmakingSummary = { matchesCreated };

        // Small delay to ensure time passes
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Step 3: Execute battles
        const battleSummary = await executeScheduledBattles(new Date());

        // Step 4: Rebalance leagues (every 5 cycles or last cycle)
        let rebalancingSummary = null;
        if (i % 5 === 0 || i === cycleCount) {
          rebalancingSummary = await rebalanceLeagues();
        }

        cycleResults.push({
          cycle: i,
          repair: repairSummary,
          matchmaking: matchmakingSummary,
          battles: battleSummary,
          rebalancing: rebalancingSummary,
          duration: Date.now() - cycleStart,
        });
      } catch (error) {
        console.error(`[Admin] Error in cycle ${i}:`, error);
        cycleResults.push({
          cycle: i,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - cycleStart,
        });
      }
    }

    const totalDuration = Date.now() - startTime;

    res.json({
      success: true,
      cyclesCompleted: cycleCount,
      autoRepairEnabled: autoRepair,
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
      },
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

export default router;
