import express, { Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { getKothStandings } from '../services/koth/kothStandingsService';

const router = express.Router();

const kothStandingsQuerySchema = z.object({
  view: z.enum(['all_time', 'last_10']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * GET /api/koth/standings
 * KotH standings with pagination and time filter
 */
router.get('/standings', authenticateToken, validateRequest({ query: kothStandingsQuerySchema }), async (req: AuthRequest, res: Response) => {
  const view = (req.query.view as string) || 'all_time';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

  const result = await getKothStandings({ view, page, limit });
  res.json(result);
});

export default router;
