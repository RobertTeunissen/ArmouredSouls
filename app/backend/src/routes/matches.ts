import express, { Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { AuthError, AuthErrorCode } from '../errors/authErrors';
import { BattleError, BattleErrorCode } from '../errors/battleErrors';
import { validated } from '../middleware/schemaValidator';
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
router.get('/upcoming', authenticateToken, ...validated({ query: upcomingQuerySchema }, async (req: AuthRequest, res: Response, { query }) => {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const queryRobotId = query.robotId;
    const { robotIds, teamIds, teamBattleIds } = await resolveRobotAndTeamIds(req.user.userId, queryRobotId);
    const result = await getUpcomingMatches(robotIds, teamIds, teamBattleIds);

    res.json(result);
}));

/**
 * GET /api/matches/history
 * Get paginated battle history for the current user's robots
 */
router.get('/history', authenticateToken, ...validated({ query: matchHistoryQuerySchema }, async (req: AuthRequest, res: Response, { query }) => {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const robotId = query.robotId;
    const battleType = query.battleType as string | undefined;

    const result = await getMatchHistory({
      page,
      perPage,
      robotId,
      battleType,
      userId: req.user.userId,
    });

    res.json(result);
}));

/**
 * GET /api/matches/battles/:id/log
 * Get detailed battle log with combat messages for a specific battle
 */
router.get('/battles/:id/log', authenticateToken, ...validated({ params: battleIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const battleId = params.id;
    const result = await getBattleLog(battleId);

    if (!result) {
      throw new BattleError(BattleErrorCode.BATTLE_NOT_FOUND, 'Battle not found', 404, { battleId });
    }

    res.json(result);
}));

export default router;
