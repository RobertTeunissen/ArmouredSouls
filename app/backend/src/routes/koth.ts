import express, { Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { getKothStandings } from '../services/koth/kothStandingsService';
import prisma from '../lib/prisma';
import type { StandingsMode } from '../../generated/prisma';

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
router.get('/standings', authenticateToken, validateRequest({ query: kothStandingsQuerySchema }), async (req: AuthRequest, res: Response) => {
  const view = (req.query.view as string) || 'all_time';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const tier = req.query.tier as string | undefined;
  const instance = req.query.instance as string | undefined;

  const result = await getKothStandings({ view, page, limit, tier, instance });
  res.json(result);
});

const kothInstancesParamsSchema = z.object({
  tier: z.string().max(20),
});

/**
 * GET /api/koth/:tier/instances
 * Get all KotH instances for a tier (same pattern as 1v1 league instances)
 */
router.get('/:tier/instances', authenticateToken, validateRequest({ params: kothInstancesParamsSchema }), async (req: AuthRequest, res: Response) => {
  const tier = req.params.tier as string;

  // Query distinct instances from standings
  const instances = await prisma.standing.groupBy({
    by: ['leagueInstanceId'],
    where: { mode: 'koth' as StandingsMode, tier: String(tier), entityType: 'robot' },
    _count: { _all: true },
  });

  const result = instances
    .map(inst => ({
      leagueId: inst.leagueInstanceId,
      leagueTier: tier,
      currentRobots: inst._count._all,
      maxRobots: 100,
    }))
    .sort((a, b) => {
      const numA = parseInt(a.leagueId.split('_')[1] || '1');
      const numB = parseInt(b.leagueId.split('_')[1] || '1');
      return numA - numB;
    });

  res.json(result);
});

export default router;
