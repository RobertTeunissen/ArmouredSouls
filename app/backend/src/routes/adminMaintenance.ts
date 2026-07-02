/**
 * Admin Maintenance & Operations Routes
 *
 * Repair, recalculation, cycle management, scheduler, and practice arena endpoints.
 * Mounted at /api/admin/ from the main admin router.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import logger from '../config/logger';
import { processAllDailyFinances } from '../utils/economyCalculations';
import { getSchedulerState } from '../services/cycle/cycleScheduler';
import { recordAction as recordAuditAction } from '../services/admin/adminAuditLogService';
import {
  repairAllRobotsAdmin,
  recalculateAllRobotHP,
} from '../services/admin/adminMaintenanceService';
import {
  executeBulkCycles,
  backfillCycleSnapshots,
} from '../services/admin/adminCycleService';
import { practiceArenaMetrics } from '../services/practice-arena/practiceArenaMetrics';

const router = express.Router();

// --- Zod schemas ---

const repairAllBodySchema = z.object({
  deductCosts: z.boolean().optional().default(false),
});

const bulkCyclesBodySchema = z.object({
  cycles: z.number().int().nonnegative().max(100).optional().default(1),
  generateUsersPerCycle: z.boolean().optional().default(false),
  includeTournaments: z.boolean().optional().default(true),
  includeKoth: z.boolean().optional().default(true),
  includeDailyFinances: z.boolean().optional().default(true),
}).refine(
  (data) => data.cycles !== 0 || data.includeTournaments,
  { message: 'cycles=0 requires includeTournaments=true', path: ['cycles'] }
);

// --- Routes ---

/**
 * POST /api/admin/repair/all
 * Auto-repair all robots to 100% HP
 */
router.post('/repair/all', authenticateToken, requireAdmin, validateRequest({ body: repairAllBodySchema }), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { deductCosts = false } = req.body;
    const result = await repairAllRobotsAdmin(deductCosts);
    recordAuditAction(authReq.user!.userId, 'repair_all', 'success', { deductCosts, robotsRepaired: result.robotsRepaired });
    res.json(result);
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'repair_all', 'failure', { error: error instanceof Error ? error.message : String(error) });
    logger.error('[Admin] Auto-repair error:', error);
    res.status(500).json({
      error: 'Failed to auto-repair robots',
    });
  }
});

/**
 * POST /api/admin/recalculate-hp
 * Recalculate HP for all robots using the new formula: 30 + (hullIntegrity × 8)
 */
router.post('/recalculate-hp', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    const result = await recalculateAllRobotHP();
    res.json(result);
  } catch (error) {
    logger.error('[Admin] HP recalculation error:', error);
    res.status(500).json({
      error: 'Failed to recalculate HP',
    });
  }
});

/**
 * POST /api/admin/daily-finances/process
 * Process daily financial obligations (operating costs) for all users
 */
router.post('/daily-finances/process', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    logger.info('[Admin] Processing daily finances for all users...');
    
    const summary = await processAllDailyFinances();
    
    logger.info(`[Admin] Processed ${summary.usersProcessed} users, ` +
      `deducted ₡${summary.totalCostsDeducted.toLocaleString()}, ` +
      `${summary.bankruptUsers} bankruptcies`);
    
    recordAuditAction(authReq.user!.userId, 'daily_finances_process', 'success', { usersProcessed: summary.usersProcessed, totalCostsDeducted: summary.totalCostsDeducted });

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'daily_finances_process', 'failure', { error: error instanceof Error ? error.message : String(error) });
    logger.error('[Admin] Daily finances error:', error);
    res.status(500).json({
      error: 'Failed to process daily finances',
    });
  }
});

/**
 * POST /api/admin/cycles/bulk
 * Run multiple complete cycles — delegates to adminCycleService.
 */
router.post('/cycles/bulk', authenticateToken, requireAdmin, validateRequest({ body: bulkCyclesBodySchema }), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const result = await executeBulkCycles(req.body);

    recordAuditAction(authReq.user!.userId, 'cycles_bulk', 'success', { cyclesRequested: req.body.cycles, cyclesCompleted: result.cyclesCompleted });

    res.json(result);
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'cycles_bulk', 'failure', { error: error instanceof Error ? error.message : String(error) });
    logger.error('[Admin] Bulk cycles error:', error);
    res.status(500).json({
      error: 'Failed to run bulk cycles',
    });
  }
});

/**
 * POST /api/admin/snapshots/backfill
 * Backfill cycle snapshots for cycles that don't have them — delegates to adminCycleService.
 */
router.post('/snapshots/backfill', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    const result = await backfillCycleSnapshots();
    if (result.totalCycles === 0) {
      return res.json({
        success: true,
        message: 'No cycles to backfill',
        snapshotsCreated: 0,
      });
    }
    res.json(result);
  } catch (error) {
    logger.error('[Admin] Backfill snapshots error:', error);
    res.status(500).json({
      error: 'Failed to backfill snapshots',
    });
  }
});

/**
 * GET /api/admin/scheduler/status
 * Return the current state of the Cycle Scheduler
 */
router.get('/scheduler/status', authenticateToken, requireAdmin, validateRequest({}), (_req: Request, res: Response) => {
  const state = getSchedulerState();
  res.json(state);
});

/**
 * POST /api/admin/scheduler/trigger/:jobName
 * Manually trigger a scheduler job by name. Runs the exact same code path as the cron:
 * repair → execute → notify → track state. Uses the scheduler's mutex lock.
 */
router.post('/scheduler/trigger/:jobName', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { jobName } = req.params;
  try {
    const { triggerJob } = await import('../services/cycle/cycleScheduler');
    await triggerJob(jobName as Parameters<typeof triggerJob>[0]);
    recordAuditAction(authReq.user!.userId, 'scheduler_trigger', 'success', { jobName });
    res.json({ success: true, jobName, timestamp: new Date().toISOString() });
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'scheduler_trigger', 'failure', { jobName, error: error instanceof Error ? error.message : String(error) });
    logger.error(`[Admin] Scheduler trigger error for "${jobName}":`, error);
    res.status(500).json({ error: `Failed to trigger job "${jobName}"`, details: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/admin/practice-arena/stats
 * Returns current in-memory practice arena metrics and historical daily stats.
 */
router.get('/practice-arena/stats', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  res.json({
    current: practiceArenaMetrics.getStats(),
    history: await practiceArenaMetrics.getHistory(),
  });
});

export default router;
