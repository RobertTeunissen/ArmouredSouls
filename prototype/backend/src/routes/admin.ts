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
 * POST /api/admin/recalculate-hp
 * Recalculate HP for all robots using the new formula: 30 + (hullIntegrity × 8)
 */
router.post('/recalculate-hp', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[Admin] Recalculating HP for all robots using new formula...');

    // Import calculateMaxHP function
    const { calculateMaxHP } = require('../utils/robotCalculations');

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
