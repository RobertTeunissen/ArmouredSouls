import express, { Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/schemaValidator';
import {
  getFameLeaderboard,
  getLossesLeaderboard,
  getPrestigeLeaderboard,
} from '../services/analytics/leaderboardService';

const router = express.Router();

// Cache leaderboards for 5 minutes — data only changes after battles/cycles
const leaderboardCache = new Map<string, { data: unknown; expiresAt: number }>();
const LEADERBOARD_TTL = 5 * 60 * 1000;
const LEADERBOARD_CACHE_MAX_SIZE = 50; // Prevent unbounded growth

function getCachedOrNull(key: string): unknown | null {
  const entry = leaderboardCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  leaderboardCache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  // Evict expired entries if cache is getting large
  if (leaderboardCache.size >= LEADERBOARD_CACHE_MAX_SIZE) {
    const now = Date.now();
    for (const [k, v] of leaderboardCache) {
      if (now >= v.expiresAt) leaderboardCache.delete(k);
    }
    // If still at max after eviction, remove oldest entry
    if (leaderboardCache.size >= LEADERBOARD_CACHE_MAX_SIZE) {
      const firstKey = leaderboardCache.keys().next().value;
      if (firstKey) leaderboardCache.delete(firstKey);
    }
  }
  leaderboardCache.set(key, { data, expiresAt: Date.now() + LEADERBOARD_TTL });
}

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
  const cacheKey = `fame:${req.query.page || 1}:${req.query.limit || 100}:${req.query.league || ''}:${req.query.minBattles || 10}`;
  const cached = getCachedOrNull(cacheKey);
  if (cached) { res.json(cached); return; }

  const result = await getFameLeaderboard({
    page: parseInt(req.query.page as string) || 1,
    limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
    league: req.query.league as string,
    minBattles: parseInt(req.query.minBattles as string) || 10,
  });

  const response = { ...result, timestamp: new Date().toISOString() };
  setCache(cacheKey, response);
  res.json(response);
});

/**
 * GET /api/leaderboards/losses
 */
router.get('/losses', validateRequest({ query: lossesQuerySchema }), async (req: Request, res: Response) => {
  const cacheKey = `losses:${req.query.page || 1}:${req.query.limit || 100}:${req.query.league || ''}`;
  const cached = getCachedOrNull(cacheKey);
  if (cached) { res.json(cached); return; }

  const result = await getLossesLeaderboard({
    page: parseInt(req.query.page as string) || 1,
    limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
    league: req.query.league as string,
  });

  const response = { ...result, timestamp: new Date().toISOString() };
  setCache(cacheKey, response);
  res.json(response);
});

/**
 * GET /api/leaderboards/prestige
 */
router.get('/prestige', validateRequest({ query: prestigeQuerySchema }), async (req: Request, res: Response) => {
  const cacheKey = `prestige:${req.query.page || 1}:${req.query.limit || 100}:${req.query.minRobots || 1}`;
  const cached = getCachedOrNull(cacheKey);
  if (cached) { res.json(cached); return; }

  const result = await getPrestigeLeaderboard({
    page: parseInt(req.query.page as string) || 1,
    limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
    minRobots: parseInt(req.query.minRobots as string) || 1,
  });

  const response = { ...result, timestamp: new Date().toISOString() };
  setCache(cacheKey, response);
  res.json(response);
});

export default router;
