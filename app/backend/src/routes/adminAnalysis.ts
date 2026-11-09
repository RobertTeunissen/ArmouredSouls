/**
 * Admin "what wins" analyses, mounted at /api/admin/analysis. Admin-only and
 * read-only.
 */
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validated } from '../middleware/schemaValidator';
import { ANALYSIS_RANGES, ANALYSIS_STRENGTHS, getAttributeAnalysis, getWeaponAnalysis } from '../services/admin/analysis';

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

const weaponQuerySchema = z.object({
  range: z.enum(ANALYSIS_RANGES).default('7d'),
  strength: z.enum(ANALYSIS_STRENGTHS).default('all'),
});

/** Which attributes, groups and build profiles win, per mode column. */
router.get('/attributes', ...validated({ query: attributeQuerySchema }, async (req: Request, res: Response, { query }) => {
  // validateRequest replaces query with the parsed (transformed) values.
  const { range, ...toggles } = query;
  res.json(await getAttributeAnalysis({ range, toggles }));
}));

/** Which weapons, archetypes and matchups win, per mode column, for all robots or the top 10%. */
router.get('/weapons', ...validated({ query: weaponQuerySchema }, async (req: Request, res: Response, { query }) => {
  const { range, strength } = query;
  res.json(await getWeaponAnalysis({ range, strength }));
}));

export default router;
