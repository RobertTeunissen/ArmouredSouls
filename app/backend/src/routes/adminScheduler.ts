/**
 * Admin scheduler routes for Cycle Controls (`/admin/cycles`).
 *
 * - GET  /api/admin/scheduler/overview   status strip, daily schedule, missed runs
 * - GET  /api/admin/scheduler/runs       run history (runs, restarts, missed)
 * - GET  /api/admin/scheduler/runs/:id   one run
 * - POST /api/admin/scheduler/runs       start a job by hand in the background (202)
 *
 * Mounted at /api/admin/ from the main admin router. Thin: validate, call a
 * service, respond. Services throw `SchedulerError`; `errorHandler` formats it.
 */
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
// The constants module, not cycleScheduler: a test that mocks the scheduler
// must not be able to turn this into `z.enum(undefined)`.
import { SCHEDULER_JOB_NAMES, type SchedulerJobName } from '../services/cycle/schedulerJobNames';
import { BULK_CYCLES_JOB_NAME } from '../types/schedulerTypes';
import { startManualRun } from '../services/cycle/cycleScheduler';
import {
  MAX_HISTORY_DAYS,
  getSchedulerOverview,
  getSchedulerRun,
  listSchedulerRuns,
} from '../services/cycle/schedulerHistoryService';
import { recordAction as recordAuditAction } from '../services/admin/adminAuditLogService';

const router = express.Router();

const historyQuerySchema = z.object({
  jobName: z.enum([...SCHEDULER_JOB_NAMES, BULK_CYCLES_JOB_NAME]).optional(),
  problemsOnly: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
  days: z.coerce.number().int().min(1).max(MAX_HISTORY_DAYS).default(7),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
}).strict();

const runIdParamSchema = z.object({ id: positiveIntParam });

const startRunBodySchema = z.object({ jobName: z.enum(SCHEDULER_JOB_NAMES) }).strict();

router.get('/scheduler/overview', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  res.json(await getSchedulerOverview());
});

router.get('/scheduler/runs', authenticateToken, requireAdmin, validateRequest({ query: historyQuerySchema }), async (req: Request, res: Response) => {
  const query = req.query as unknown as z.infer<typeof historyQuerySchema>;
  res.json(await listSchedulerRuns(query));
});

router.get('/scheduler/runs/:id', authenticateToken, requireAdmin, validateRequest({ params: runIdParamSchema }), async (req: Request, res: Response) => {
  res.json(await getSchedulerRun(Number(req.params.id)));
});

/**
 * Start a job by hand. Returns 202 with the queued run as soon as it is
 * recorded; the job itself waits for the scheduler lock and runs in the
 * background (a slot can take 20 minutes, the proxy cuts responses at 30 s).
 * 409 when that job is already queued or running.
 */
router.post('/scheduler/runs', authenticateToken, requireAdmin, validateRequest({ body: startRunBodySchema }), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const jobName = req.body.jobName as SchedulerJobName;
  const run = await startManualRun(jobName, authReq.user!.userId);
  recordAuditAction(authReq.user!.userId, 'scheduler_trigger', 'success', { jobName, runId: run.runId, background: true });
  res.status(202).json({ run: { id: run.runId, jobName: run.jobName, status: 'queued', queuedAt: run.queuedAt.toISOString() } });
});

export default router;
