/**
 * Admin Security & Moderation routes: the Security page (`/admin/security`)
 * and the Image Uploads page (`/admin/image-uploads`).
 *
 * Mounted at /api/admin from the main admin router. Every route is admin-only;
 * the two actions (remove an image, clean up storage) are audited by the
 * service in admin_audit_log.
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest, validated } from '../middleware/schemaValidator';
import { positiveIntParam, safeEnum } from '../utils/securityValidation';
import { getSecurityOverview, SECURITY_WINDOWS } from '../services/security/securityOverviewService';
import {
  getImageDetail,
  getImagesOverview,
  listImagesInUse,
  previewCleanup,
  removeImage,
  runCleanup,
} from '../services/moderation/adminImagesService';

const router = express.Router();

// Per-route guards, like the other routers mounted at /api/admin: a
// router-level `use` would also run for every later /api/admin router.
const admin = [authenticateToken, requireAdmin];

const securityQuerySchema = z.object({
  window: safeEnum(SECURITY_WINDOWS).default('7d'),
});

const imagesQuerySchema = z.object({
  filter: safeEnum(['all', 'anyway'] as const).default('all'),
  q: z.string().max(50, 'Search must be 50 characters or less').default(''),
  page: z.coerce.number().int().positive().max(10_000).default(1),
});

const imageParamsSchema = z.object({ id: positiveIntParam });

const removeBodySchema = z.object({
  confirm: z.literal(true, { message: 'Removing an image needs confirm: true' }),
  reason: z.string().trim().min(3, 'Give a reason of at least 3 characters').max(200, 'The reason must be 200 characters or less'),
});

/** Signals per type and bucket, the stables behind them and the sources without an account. */
router.get('/security/overview', ...admin, ...validated({ query: securityQuerySchema }, async (req: AuthRequest, res: Response, { query }) => {
  const { window } = query;
  res.json(await getSecurityOverview(window));
}));

/** Cards, uploads per week, moderation outcomes and storage. */
router.get('/images/overview', ...admin, validateRequest({}), async (_req: AuthRequest, res: Response) => {
  res.json(await getImagesOverview());
});

/** What "Clean up" would delete and clear. Changes nothing. */
router.get('/images/cleanup', ...admin, validateRequest({}), async (_req: AuthRequest, res: Response) => {
  res.json(await previewCleanup());
});

/** Delete orphan files and clear references to files that are gone. */
router.post('/images/cleanup', ...admin, validateRequest({}), async (req: AuthRequest, res: Response) => {
  res.json(await runCleanup(req.user!.userId));
});

/** Images on a robot, newest first. */
router.get('/images', ...admin, ...validated({ query: imagesQuerySchema }, async (req: AuthRequest, res: Response, { query }) => {
  const { filter, q, page } = query;
  res.json(await listImagesInUse(filter, q, page));
}));

/** One image for the slide-over. */
router.get('/images/:id', ...admin, ...validated({ params: imageParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
  res.json(await getImageDetail(params.id));
}));

/**
 * Remove an image that got past the NSFW filter (robots and archived seasons
 * lose it, the file is deleted). Needs `confirm: true` and a reason.
 */
router.delete(
  '/images/:id',
  ...admin,
  ...validated({ params: imageParamsSchema, body: removeBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
    res.json(await removeImage(req.user!.userId, params.id, body.reason));
  }),
);

export default router;
