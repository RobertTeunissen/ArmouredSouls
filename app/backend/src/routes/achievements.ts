import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { achievementService } from '../services/achievement';

const router = Router();

// Zod schemas
const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  since: z.string().datetime().optional(),
});

const pinnedBodySchema = z.object({
  achievementIds: z.array(z.string().min(1).max(10)).max(6),
});

// GET /api/achievements — Full achievement catalog with player's progress
router.get(
  '/',
  authenticateToken,
  validateRequest({}),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const result = await achievementService.getPlayerAchievements(userId);
    return res.json(result);
  },
);

// GET /api/achievements/recent — Last N unlocked achievements
router.get(
  '/recent',
  authenticateToken,
  validateRequest({ query: recentQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const limit = Number(req.query.limit) || 10;
    const since = req.query.since ? new Date(req.query.since as string) : undefined;
    const result = await achievementService.getRecentUnlocks(userId, limit, since);
    return res.json(result);
  },
);

// PUT /api/achievements/pinned — Update pinned achievement IDs
router.put(
  '/pinned',
  authenticateToken,
  validateRequest({ body: pinnedBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { achievementIds } = req.body;
    await achievementService.updatePinnedAchievements(userId, achievementIds);
    return res.json({ success: true });
  },
);

export default router;
