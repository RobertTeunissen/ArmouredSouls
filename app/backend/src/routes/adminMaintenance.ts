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
// Imported from the constants module, not from cycleScheduler: a test that mocks
// the scheduler must not be able to turn this into `z.enum(undefined)`.
import {
  SCHEDULER_JOB_NAMES,
  type SchedulerJobName,
} from '../services/cycle/schedulerJobNames';
import { recordAction as recordAuditAction } from '../services/admin/adminAuditLogService';
import {
  repairAllRobotsAdmin,
  recalculateAllRobotHP,
} from '../services/admin/adminMaintenanceService';
import { backfillCycleSnapshots } from '../services/admin/adminCycleService';
import { runBulkCycles, startBulkCycles } from '../services/admin/adminBulkCycleRunService';
import { SchedulerError } from '../errors/schedulerErrors';
import { getLegacyPracticeArenaStats, getPracticeArenaOverview } from '../services/practice-arena/practiceArenaUsageService';

const router = express.Router();

// --- Zod schemas ---

const repairAllBodySchema = z.object({
  deductCosts: z.boolean().optional().default(false),
});

/**
 * Job names come from the scheduler's own tuple, so a name can only reach
 * `triggerJob` if it is one the scheduler actually registers.
 */
const schedulerJobParamSchema = z.object({
  jobName: z.enum(SCHEDULER_JOB_NAMES),
});

const bulkCyclesBodySchema = z.object({
  cycles: z.number().int().nonnegative().max(100).optional().default(1),
  generateUsersPerCycle: z.boolean().optional().default(false),
  includeTournaments: z.boolean().optional().default(true),
  includeKoth: z.boolean().optional().default(true),
  includeDailyFinances: z.boolean().optional().default(true),
  /** Return 202 with the queued run at once instead of waiting for the result. */
  background: z.boolean().optional().default(false),
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
 * Run multiple complete cycles under the scheduler lock, recorded in the run
 * history. By default waits for the result (200). With `background: true`
 * returns 202 with the queued run at once (Cycle Controls); 409 when a bulk
 * run is already queued or running.
 */
router.post('/cycles/bulk', authenticateToken, requireAdmin, validateRequest({ body: bulkCyclesBodySchema }), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { background, ...options } = req.body as z.infer<typeof bulkCyclesBodySchema>;
  if (background) {
    const run = await startBulkCycles(options, authReq.user!.userId);
    recordAuditAction(authReq.user!.userId, 'cycles_bulk', 'success', { cyclesRequested: options.cycles, runId: run.runId, background: true });
    res.status(202).json({ run: { id: run.runId, jobName: run.jobName, status: 'queued', queuedAt: run.queuedAt.toISOString() } });
    return;
  }
  try {
    const result = await runBulkCycles(options, authReq.user!.userId);

    recordAuditAction(authReq.user!.userId, 'cycles_bulk', 'success', { cyclesRequested: options.cycles, cyclesCompleted: result.cyclesCompleted });

    res.json(result);
  } catch (error) {
    if (error instanceof SchedulerError) throw error;
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
 * Manually trigger a scheduler job by name and wait for it. Runs the exact same code
 * path as the cron: repair → execute → notify → track state. Uses the scheduler's
 * mutex lock and is recorded in the run history.
 *
 * Deprecated for the admin UI: a slot outlasts the proxy's 30 s response timeout.
 * Cycle Controls uses `POST /api/admin/scheduler/runs` (202, background).
 */
router.post('/scheduler/trigger/:jobName', authenticateToken, requireAdmin, validateRequest({ params: schedulerJobParamSchema }), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const jobName = req.params.jobName as SchedulerJobName;
  try {
    const { triggerJob } = await import('../services/cycle/cycleScheduler');
    await triggerJob(jobName, authReq.user!.userId);
    recordAuditAction(authReq.user!.userId, 'scheduler_trigger', 'success', { jobName });
    res.json({ success: true, jobName, timestamp: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isUnknownJob = message.includes('Unknown job name');
    const statusCode = isUnknownJob ? 400 : 500;
    recordAuditAction(authReq.user!.userId, 'scheduler_trigger', 'failure', { jobName, error: message });
    logger.error(`[Admin] Scheduler trigger error for "${jobName}":`, error);
    res.status(statusCode).json({ error: `Failed to trigger job "${jobName}"`, details: message });
  }
});

/**
 * GET /api/admin/practice-arena/overview
 * The admin Practice Arena page: UTC days, season totals, top practitioners,
 * usage and unavailable time (persisted, survives restarts).
 */
router.get('/practice-arena/overview', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  res.json(await getPracticeArenaOverview());
});

/**
 * GET /api/admin/practice-arena/stats
 * The original shape (`current` + daily `history`), computed from the
 * persisted events. `totalBattlesSinceStart` is this season's battles.
 */
router.get('/practice-arena/stats', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  res.json(await getLegacyPracticeArenaStats());
});

export default router;
