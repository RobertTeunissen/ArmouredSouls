import express, { Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/schemaValidator';
import {
  getFameLeaderboard,
  getLossesLeaderboard,
  getPrestigeLeaderboard,
} from '../services/analytics/leaderboardService';

const router = express.Router();

// --- Zod schemas ---

const fameQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  league: z.string().max(30).optional(),
  minBattles: z.coerce.number().int().nonnegative().optional(),
});

const lossesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  league: z.string().max(30).optional(),
});

const prestigeQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  minRobots: z.coerce.number().int().nonnegative().optional(),
});

/**
 * GET /api/leaderboards/fame
 */
router.get('/fame', validateRequest({ query: fameQuerySchema }), async (req: Request, res: Response) => {
  const result = await getFameLeaderboard({
    page: parseInt(req.query.page as string) || 1,
    limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
    league: req.query.league as string,
    minBattles: parseInt(req.query.minBattles as string) || 10,
  });

  res.json({ ...result, timestamp: new Date().toISOString() });
});

/**
 * GET /api/leaderboards/losses
 */
router.get('/losses', validateRequest({ query: lossesQuerySchema }), async (req: Request, res: Response) => {
  const result = await getLossesLeaderboard({
    page: parseInt(req.query.page as string) || 1,
    limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
    league: req.query.league as string,
  });

  res.json({ ...result, timestamp: new Date().toISOString() });
});

/**
 * GET /api/leaderboards/prestige
 */
router.get('/prestige', validateRequest({ query: prestigeQuerySchema }), async (req: Request, res: Response) => {
  const result = await getPrestigeLeaderboard({
    page: parseInt(req.query.page as string) || 1,
    limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
    minRobots: parseInt(req.query.minRobots as string) || 1,
  });

  res.json({ ...result, timestamp: new Date().toISOString() });
});

export default router;
