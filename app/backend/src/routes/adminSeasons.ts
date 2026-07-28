/**
 * Admin_Season_Portal routes (Spec #45).
 *
 * Every route is admin-only and every action is recorded in the admin audit
 * trail. The manual rollover is the only way to close Season_Zero.
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { loadEnvConfig } from '../config/env';
import { SeasonError, SeasonErrorCode } from '../errors';
import { recordAction } from '../services/admin/adminAuditLogService';
import {
  getCurrentSeason,
  extendCurrentSeason,
  setRemainingPreparationCycles,
} from '../services/season/seasonService';
import { previewRollover } from '../services/season/seasonPurgeService';
import {
  executeSeasonRollover,
  isRolloverInProgress,
} from '../services/season/seasonRolloverService';
import prisma from '../lib/prisma';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

/** Typing the season number is required, so a mis-click cannot reset the game. */
const rolloverBodySchema = z.object({
  confirm: z.literal('CONFIRM_ROLLOVER'),
  seasonNumber: z.number().int().min(0),
});

const extendBodySchema = z.object({ additionalCycles: z.number().int().min(1).max(365) });
const preparationBodySchema = z.object({ remainingCycles: z.number().int().min(0).max(7) });

/** Current season state plus whether balance changes are appropriate now. */
router.get('/state', validateRequest({}), async (_req: AuthRequest, res: Response) => {
  const state = await getCurrentSeason();
  const draft = await prisma.changelogEntry.findFirst({
    where: { status: 'draft', category: 'balance', sourceRef: `season-${state.seasonNumber}` },
    select: { id: true, title: true },
  });

  return res.json({
    ...state,
    rolloverInProgress: isRolloverInProgress(),
    // Balance changes belong in a preparation window (convention, not enforced).
    balanceChangesAppropriate: state.phase === 'preparation',
    seasonChangelogDraft: draft,
    config: {
      seasonLengthCycles: loadEnvConfig().seasonLengthCycles,
      preparationLengthCycles: loadEnvConfig().preparationLengthCycles,
      countdownCycles: loadEnvConfig().countdownCycles,
      accoladeDepth: loadEnvConfig().accoladeDepth,
      retainedImagesPerStable: loadEnvConfig().retainedImagesPerStable,
    },
  });
});

/** Read-only report of what a rollover would archive, delete, and purge. */
router.get('/rollover-preview', validateRequest({}), async (_req: AuthRequest, res: Response) => {
  return res.json(await previewRollover());
});

/** Execute a rollover now. Requires the confirmation phrase and season number. */
router.post(
  '/rollover',
  validateRequest({ body: rolloverBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const adminUserId = req.user!.userId;
    const state = await getCurrentSeason();

    if (req.body.seasonNumber !== state.seasonNumber) {
      throw new SeasonError(
        SeasonErrorCode.CONFIRMATION_REQUIRED,
        `Season number mismatch: the current season is ${state.seasonNumber}`,
        400,
      );
    }

    try {
      const result = await executeSeasonRollover({ trigger: 'admin', adminUserId });
      recordAction(adminUserId, 'season_rollover', 'success', { ...result });
      return res.json(result);
    } catch (error) {
      recordAction(adminUserId, 'season_rollover', 'failure', {
        seasonNumber: state.seasonNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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

/** Set how many preparation cycles remain in the current Preparation_Phase. */
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
