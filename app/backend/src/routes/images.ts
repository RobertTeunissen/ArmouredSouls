/**
 * Image_Library routes (Spec #45 R30).
 *
 * Scoped strictly to the signed-in user: a player never lists, selects, or
 * deletes another player's upload. Ownership is asserted in the service layer
 * so the check cannot be bypassed by a different caller.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { loadEnvConfig } from '../config/env';
import {
  listImages,
  deleteImage,
  getImpact,
  uploadUrlPrefix,
} from '../services/moderation/imageLibraryService';

const router = Router();

/** Stored filenames are UUID + `.webp`; nothing else is addressable. */
const filenameParamSchema = z.object({
  filename: z
    .string()
    .regex(
      /^[0-9a-f-]{36}\.webp$/i,
      'Filename must be a stored image identifier',
    ),
});

const deleteQuerySchema = z.object({
  confirm: z.enum(['true', 'false']).optional(),
});

/** The caller's own retained images, with the cap for context. */
router.get(
  '/',
  authenticateToken,
  validateRequest({}),
  async (req: AuthRequest, res: Response) => {
    const images = await listImages(req.user!.userId);
    return res.json({
      images,
      retained: images.length,
      limit: loadEnvConfig().retainedImagesPerStable,
    });
  },
);

/** What deleting an image would affect — drives the confirmation prompt. */
router.get(
  '/:filename/impact',
  authenticateToken,
  validateRequest({ params: filenameParamSchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const path = `${uploadUrlPrefix()}/${userId}/${req.params.filename}`;
    return res.json(await getImpact(userId, path));
  },
);

/** Delete one of the caller's own images. Requires explicit confirmation. */
router.delete(
  '/:filename',
  authenticateToken,
  validateRequest({ params: filenameParamSchema, query: deleteQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const path = `${uploadUrlPrefix()}/${userId}/${req.params.filename}`;
    const impact = await deleteImage(userId, path, req.query.confirm === 'true');
    return res.json(impact);
  },
);

export default router;
