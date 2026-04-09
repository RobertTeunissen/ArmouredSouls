import express, { Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { AuthError, AuthErrorCode } from '../errors/authErrors';
import { BattleError, BattleErrorCode } from '../errors/battleErrors';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import {
  resolveRobotAndTeamIds,
  getUpcomingMatches,
  getMatchHistory,
  getBattleLog,
} from '../services/match';

const router = express.Router();

// --- Zod schemas for matches routes ---

const battleIdParamsSchema = z.object({
  id: positiveIntParam,
});

const matchHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().max(100).optional(),
  robotId: z.coerce.number().int().positive().optional(),
  battleType: z.string().max(30).optional(),
});

const upcomingQuerySchema = z.object({
  robotId: z.coerce.number().int().positive().optional(),
});

/**
 * GET /api/matches/upcoming
 * Get upcoming scheduled matches and tournament matches.
 * If ?robotId=X is provided, returns matches for that specific robot (public).
 * Otherwise returns matches for the current user's robots.
 */
router.get('/upcoming', authenticateToken, validateRequest({ query: upcomingQuerySchema }), async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const queryRobotId = req.query.robotId ? parseInt(req.query.robotId as string) : undefined;
    const { robotIds, teamIds } = await resolveRobotAndTeamIds(req.user.userId, queryRobotId);
    const result = await getUpcomingMatches(robotIds, teamIds);

    res.json(result);
});

/**
 * GET /api/matches/history
 * Get paginated battle history for the current user's robots
 */
router.get('/history', authenticateToken, validateRequest({ query: matchHistoryQuerySchema }), async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 20));
    const robotId = req.query.robotId ? parseInt(req.query.robotId as string) : undefined;
    const battleType = req.query.battleType as string | undefined;

    const result = await getMatchHistory({
      page,
      perPage,
      robotId,
      battleType,
      userId: req.user.userId,
    });

    res.json(result);
});

/**
 * GET /api/matches/battles/:id/log
 * Get detailed battle log with combat messages for a specific battle
 */
router.get('/battles/:id/log', authenticateToken, validateRequest({ params: battleIdParamsSchema }), async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const battleId = parseInt(String(req.params.id));
    const result = await getBattleLog(battleId);

    if (!result) {
      throw new BattleError(BattleErrorCode.BATTLE_NOT_FOUND, 'Battle not found', 404, { battleId });
    }

    res.json(result);
});

export default router;
