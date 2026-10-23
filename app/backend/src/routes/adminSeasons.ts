/**
 * Admin_Season_Portal routes (Spec #45) — Season Control (`/admin/seasons`).
 *
 * Every route is admin-only and every action is recorded in the admin audit
 * trail. The manual rollover is the only way to close Season_Zero.
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { SeasonError, SeasonErrorCode } from '../errors';
import { recordAction } from '../services/admin/adminAuditLogService';
import {
  getCurrentSeason,
  extendCurrentSeason,
  setRemainingPreparationCycles,
} from '../services/season/seasonService';
import { previewRollover } from '../services/season/seasonPurgeService';
import { getAdminSeasonState } from '../services/season/adminSeasonStateService';
import { runAdminRollover, startAdminRollover } from '../services/season/adminSeasonRolloverRunService';
import { getSeasonRolloverHistory } from '../services/season/seasonRolloverHistoryService';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

/** Typing the season number is required, so a mis-click cannot reset the game. */
const rolloverBodySchema = z.object({
  confirm: z.literal('CONFIRM_ROLLOVER'),
  seasonNumber: z.number().int().min(0),
  /** Start in the background and return the queued run (202). Default: wait for the result. */
  background: z.boolean().optional(),
});

const extendBodySchema = z.object({ additionalCycles: z.number().int().min(1).max(365) });
/** The upper bound is the configured preparation window, checked by the service. */
const preparationBodySchema = z.object({ remainingCycles: z.number().int().min(0).max(365) });

/** Current season state, configuration, timeline anchors and the active rollover. */
router.get('/state', validateRequest({}), async (_req: AuthRequest, res: Response) => {
  return res.json(await getAdminSeasonState());
});

/** Read-only report of what a rollover would archive, delete, and purge. */
router.get('/rollover-preview', validateRequest({}), async (_req: AuthRequest, res: Response) => {
  return res.json(await previewRollover());
});

/** Completed seasons with the rollover that closed each, and failed attempts. */
router.get('/history', validateRequest({}), async (_req: AuthRequest, res: Response) => {
  return res.json(await getSeasonRolloverHistory());
});

/**
 * Roll the current season over. Requires the confirmation phrase and season
 * number. Runs under the scheduler lock; 409 while another rollover is queued
 * or running. With `background: true` it returns 202 and the queued run.
 */
router.post(
  '/rollover',
  validateRequest({ body: rolloverBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const adminUserId = req.user!.userId;
    const body = req.body as z.infer<typeof rolloverBodySchema>;
    const state = await getCurrentSeason();

    if (body.seasonNumber !== state.seasonNumber) {
      throw new SeasonError(
        SeasonErrorCode.SEASON_NUMBER_MISMATCH,
        `Season number mismatch: the current season is ${state.seasonNumber}`,
        400,
      );
    }

    if (body.background) {
      const run = await startAdminRollover(adminUserId, state.seasonNumber);
      // Same shape as POST /api/admin/scheduler/runs.
      return res.status(202).json({
        run: { id: run.runId, jobName: run.jobName, status: 'queued', queuedAt: run.queuedAt.toISOString() },
      });
    }
    return res.json(await runAdminRollover(adminUserId, state.seasonNumber));
  },
);

/** Extend the current Competitive_Phase without changing later seasons. */
router.post(
  '/extend',
  validateRequest({ body: extendBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const state = await extendCurrentSeason(req.body.additionalCycles);
    recordAction(req.user!.userId, 'season_extend', 'success', {
      additionalCycles: req.body.additionalCycles,
      resultingState: { ...state },
    });
    return res.json(state);
  },
);

/** Set how many preparation cycles remain (0 to the configured window) in the current Preparation_Phase. */
router.post(
  '/preparation-cycles',
  validateRequest({ body: preparationBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const state = await setRemainingPreparationCycles(req.body.remainingCycles);
    recordAction(req.user!.userId, 'season_preparation_cycles', 'success', {
      remainingCycles: req.body.remainingCycles,
      resultingState: { ...state },
    });
    return res.json(state);
  },
);

export default router;
