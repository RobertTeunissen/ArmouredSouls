import express, { Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/schemaValidator';
import {
  getFameLeaderboard,
  getLossesLeaderboard,
  getPrestigeLeaderboard,
} from '../services/analytics/leaderboardService';
import { leaderboardService, type LeaderboardCategory } from '../services/leaderboard/leaderboardService';

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

// Spec #46 R5: the fame leaderboard no longer accepts `league` or `minBattles`.
// Both suppressed entrants rather than filtering them — `robots.total_battles`
// is never incremented for KotH or Grand Melee (both orchestrators pass
// skipBattleCounters), so a minimum-battles default hid robots whose fame came
// from those modes, and the league filter joined standings on league_1v1 only.
// Zod's default .strip() means an old client sending either is ignored, not rejected.
const fameQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const lossesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  league: z.string().max(30).optional(),
});

// Spec #46 R5: the prestige leaderboard no longer accepts `minRobots`, which
// suppressed single-robot stables from a ranking of stable prestige.
const prestigeQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * GET /api/leaderboards/fame
 */
router.get('/fame', validateRequest({ query: fameQuerySchema }), async (req: Request, res: Response) => {
  // Cache key carries only the surviving parameters (Spec #46 R5.15) — a stale
  // fragment for a removed filter would fragment the cache and could serve a
  // filtered payload to an unfiltered request.
  const cacheKey = `fame:${req.query.page || 1}:${req.query.limit || 100}`;
  const cached = getCachedOrNull(cacheKey);
  if (cached) { res.set('Cache-Control', 'public, max-age=300'); res.json(cached); return; }

  const result = await getFameLeaderboard({
    page: parseInt(req.query.page as string) || 1,
    limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
  });

  const response = { ...result, timestamp: new Date().toISOString() };
  setCache(cacheKey, response);
  res.set('Cache-Control', 'public, max-age=300');
  res.json(response);
});

/**
 * GET /api/leaderboards/losses
 */
router.get('/losses', validateRequest({ query: lossesQuerySchema }), async (req: Request, res: Response) => {
  const cacheKey = `losses:${req.query.page || 1}:${req.query.limit || 100}:${req.query.league || ''}`;
  const cached = getCachedOrNull(cacheKey);
  if (cached) { res.set('Cache-Control', 'public, max-age=300'); res.json(cached); return; }

  const result = await getLossesLeaderboard({
    page: parseInt(req.query.page as string) || 1,
    limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
    league: req.query.league as string,
  });

  const response = { ...result, timestamp: new Date().toISOString() };
  setCache(cacheKey, response);
  res.set('Cache-Control', 'public, max-age=300');
  res.json(response);
});

/**
 * GET /api/leaderboards/prestige
 */
router.get('/prestige', validateRequest({ query: prestigeQuerySchema }), async (req: Request, res: Response) => {
  const cacheKey = `prestige:${req.query.page || 1}:${req.query.limit || 100}`;
  const cached = getCachedOrNull(cacheKey);
  if (cached) { res.set('Cache-Control', 'public, max-age=300'); res.json(cached); return; }

  const result = await getPrestigeLeaderboard({
    page: parseInt(req.query.page as string) || 1,
    limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
  });

  const response = { ...result, timestamp: new Date().toISOString() };
  setCache(cacheKey, response);
  res.set('Cache-Control', 'public, max-age=300');
  res.json(response);
});

// ─── Unified Leaderboard Cache Endpoint (Spec #40) ───────────────────────────

const cacheQuerySchema = z.object({
  category: z.enum(['fame', 'prestige', 'losses', 'koth_wins', 'koth_zone_score', 'career_wins', 'team_wins']),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

/**
 * GET /api/leaderboards/cache
 * Serves pre-computed leaderboard data from the leaderboard_cache table.
 * Includes `updatedAt` for cache freshness display on the frontend.
 * Uses rank-based pagination (offset = (page-1) * limit).
 */
router.get('/cache', validateRequest({ query: cacheQuerySchema }), async (req: Request, res: Response) => {
  const { category, page, limit } = req.query as unknown as { category: LeaderboardCategory; page: number; limit: number };

  const result = await leaderboardService.getLeaderboard(category, page, limit);

  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    ...result,
    category,
    timestamp: new Date().toISOString(),
  });
});

export default router;
