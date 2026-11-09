import express, { Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { validated } from '../middleware/schemaValidator';
import { getKothStandings } from '../services/koth/kothStandingsService';

const router = express.Router();

const kothStandingsQuerySchema = z.object({
  view: z.enum(['all_time', 'last_10']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  tier: z.string().max(20).optional(),
  instance: z.string().max(30).optional(),
});

/**
 * GET /api/koth/standings
 * KotH standings with pagination and time filter
 */
router.get('/standings', authenticateToken, ...validated({ query: kothStandingsQuerySchema }, async (req: AuthRequest, res: Response, { query }) => {
  const view = (query.view as string) || 'all_time';
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 50));
  const tier = query.tier as string | undefined;
  const instance = query.instance as string | undefined;

  const result = await getKothStandings({ view, page, limit, tier, instance });
  res.json(result);
}));

export default router;
