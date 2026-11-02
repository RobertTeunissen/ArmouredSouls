/**
 * Admin Operations Routes
 *
 * Bulk cycles, scheduler status and the Practice Arena overview. Manual job
 * runs are `POST /scheduler/runs` (adminScheduler.ts). The legacy one-off
 * maintenance triggers (repair/all, recalculate-hp, daily-finances/process,
 * snapshots/backfill, scheduler/trigger/:jobName) were removed with the
 * Maintenance redesign: nothing called them.
 * Mounted at /api/admin/ from the main admin router.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import logger from '../config/logger';
import { getSchedulerState } from '../services/cycle/cycleScheduler';
import { recordAction as recordAuditAction } from '../services/admin/adminAuditLogService';
import { runBulkCycles, startBulkCycles } from '../services/admin/adminBulkCycleRunService';
import { SchedulerError } from '../errors/schedulerErrors';
import { getLegacyPracticeArenaStats, getPracticeArenaOverview } from '../services/practice-arena/practiceArenaUsageService';

const router = express.Router();

// --- Zod schemas ---

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
 * GET /api/admin/scheduler/status
 * Return the current state of the Cycle Scheduler
 */
router.get('/scheduler/status', authenticateToken, requireAdmin, validateRequest({}), (_req: Request, res: Response) => {
  const state = getSchedulerState();
  res.json(state);
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
