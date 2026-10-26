/**
 * Admin "what wins" analyses, mounted at /api/admin/analysis. Admin-only and
 * read-only.
 */
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { ANALYSIS_RANGES, getAttributeAnalysis } from '../services/admin/analysis';

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

/** Layer toggle: `true`/`false` (default on). */
const layerFlag = z.enum(['true', 'false']).optional().default('true').transform((value) => value === 'true');

const attributeQuerySchema = z.object({
  range: z.enum(ANALYSIS_RANGES).default('7d'),
  tuning: layerFlag,
  weapons: layerFlag,
  refinements: layerFlag,
  loadout: layerFlag,
  stance: layerFlag,
});

/** Which attributes, groups and build profiles win, per mode column. */
router.get('/attributes', validateRequest({ query: attributeQuerySchema }), async (req: Request, res: Response) => {
  // validateRequest replaces req.query with the parsed (transformed) values.
  const { range, ...toggles } = req.query as unknown as z.infer<typeof attributeQuerySchema>;
  res.json(await getAttributeAnalysis({ range, toggles }));
});

export default router;
