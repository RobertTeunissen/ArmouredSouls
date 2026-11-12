/**
 * Season_API (Spec #45).
 *
 * Player-facing season state and archive reads. Handlers are thin wrappers:
 * parse, call a service, return. Every param and body field is validated by a
 * Zod schema through `validateRequest`.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest, validated } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import { getCurrentSeason } from '../services/season/seasonService';
import {
  getStableSeasonHistory,
  getStableSeasonDetail,
  listSeasonsForBrowsing,
  toSeasonListEntry,
  getSeasonDetail,
  getUnseenSeasonSummary,
  markSeasonSummarySeen,
} from '../services/season/seasonQueryService';

const router = Router();

/** Season numbers include 0 (the legacy season), so this allows zero. */
const seasonNumberParam = z
  .string()
  .regex(/^\d+$/, 'Season number must be a non-negative integer')
  .transform(Number);

const seasonParamsSchema = z.object({ seasonNumber: seasonNumberParam });
const userParamsSchema = z.object({ userId: positiveIntParam });
const userSeasonParamsSchema = z.object({
  userId: positiveIntParam,
  seasonNumber: seasonNumberParam,
});
const summarySeenBodySchema = z.object({ seasonNumber: z.number().int().min(0) });

/** Current season state — read by the nav, Dashboard, banner, and modal. */
router.get(
  '/current',
  authenticateToken,
  validateRequest({}),
  async (_req: AuthRequest, res: Response) => {
    const state = await getCurrentSeason();
    return res.json(state);
  },
);

/** Every completed season, newest first. */
router.get(
  '/',
  authenticateToken,
  validateRequest({}),
  async (_req: AuthRequest, res: Response) => {
    return res.json((await listSeasonsForBrowsing()).map(toSeasonListEntry));
  },
);

/** The unseen season summary for the signed-in player, or null. */
router.get(
  '/summary',
  authenticateToken,
  validateRequest({}),
  async (req: AuthRequest, res: Response) => {
    const summary = await getUnseenSeasonSummary(req.user!.userId);
    return res.json(summary);
  },
);

/** Record that the player has seen a season summary. */
router.post(
  '/summary-seen',
  authenticateToken,
  ...validated({ body: summarySeenBodySchema }, async (req: AuthRequest, res: Response, { body }) => {
    await markSeasonSummarySeen(req.user!.userId, body.seasonNumber);
    return res.status(204).send();
  }),
);

/** A stable's collapsed season history. */
router.get(
  '/stables/:userId',
  authenticateToken,
  ...validated({ params: userParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
    const userId = params.userId;
    // Visibility matches the existing `GET /api/stables/:userId` endpoint,
    // which returns any authenticated user's stable without gating on
    // `profileVisibility` (Spec #45 R20.5 — "the same rules it applies today").
    return res.json(await getStableSeasonHistory(userId));
  }),
);

/** One archived season of one stable, expanded. */
router.get(
  '/stables/:userId/:seasonNumber',
  authenticateToken,
  ...validated({ params: userSeasonParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
    const userId = params.userId;
    return res.json(await getStableSeasonDetail(userId, params.seasonNumber));
  }),
);

/** One completed season's standings, champions, and accolades. */
router.get(
  '/:seasonNumber',
  authenticateToken,
  ...validated({ params: seasonParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
    return res.json(await getSeasonDetail(params.seasonNumber));
  }),
);

export default router;
