import express, { Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import prisma from '../lib/prisma';
import {
  createTeam,
  getTeamById,
  getTeamsByStable,
  disbandTeam,
  checkTeamReadiness,
} from '../services/tag-team/tagTeamService';
import {
  getStandingsForTier,
  TAG_TEAM_LEAGUE_TIERS,
  TagTeamLeagueTier,
} from '../services/tag-team/tagTeamLeagueInstanceService';
import logger from '../config/logger';
import { AuthError, AuthErrorCode, TagTeamError, TagTeamErrorCode, RobotError, RobotErrorCode, AppError } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';

const router = express.Router();

// --- Zod schemas for tag team routes ---

const tagTeamIdParamsSchema = z.object({
  id: positiveIntParam,
});

const createTagTeamBodySchema = z.object({
  activeRobotId: z.number().int().positive(),
  reserveRobotId: z.number().int().positive(),
});

const tierParamsSchema = z.object({
  tier: z.string().min(1).max(30),
});

/**
 * POST /api/tag-teams
 * Create a new tag team
 */
router.post('/', authenticateToken, validateRequest({ body: createTagTeamBodySchema }), async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }

  const { activeRobotId, reserveRobotId } = req.body;

  if (!activeRobotId || !reserveRobotId) {
    throw new TagTeamError(TagTeamErrorCode.INVALID_TEAM_COMPOSITION, 'Both activeRobotId and reserveRobotId are required', 400);
  }

  if (typeof activeRobotId !== 'number' || typeof reserveRobotId !== 'number') {
    throw new AppError('INVALID_PARAMETER', 'Robot IDs must be numbers', 400);
  }

  if (activeRobotId === reserveRobotId) {
    throw new TagTeamError(TagTeamErrorCode.INVALID_TEAM_COMPOSITION, 'Active and reserve robots must be different', 400);
  }

  const [activeRobot, reserveRobot] = await Promise.all([
    prisma.robot.findUnique({ where: { id: activeRobotId } }),
    prisma.robot.findUnique({ where: { id: reserveRobotId } }),
  ]);

  if (!activeRobot || activeRobot.userId !== req.user.userId) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_OWNED, 'You do not own the active robot', 403);
  }

  if (!reserveRobot || reserveRobot.userId !== req.user.userId) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_OWNED, 'You do not own the reserve robot', 403);
  }

  const result = await createTeam(req.user.userId, activeRobotId, reserveRobotId);

  if (!result.success) {
    throw new TagTeamError(TagTeamErrorCode.INVALID_TEAM_COMPOSITION, 'Failed to create team', 400, result.errors);
  }

  const teamWithRobots = await getTeamById(result.team!.id);

  logger.info(`[TagTeam] User ${req.user.userId} | Created team | Active: ${activeRobotId} (${activeRobot.name}) | Reserve: ${reserveRobotId} (${reserveRobot.name})`);

  res.status(201).json({
    team: teamWithRobots,
    message: 'Tag team created successfully',
  });
});

/**
 * GET /api/tag-teams
 * List all teams for the current user's stable
 */
router.get('/', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }

  const teams = await getTeamsByStable(req.user.userId);

  const teamsWithReadiness = await Promise.all(
    teams.map(async (team) => {
      const readiness = await checkTeamReadiness(team.id);
      return { ...team, readiness };
    })
  );

  res.json({
    teams: teamsWithReadiness,
    total: teamsWithReadiness.length,
  });
});

/**
 * GET /api/tag-teams/:id
 * Get team details by ID
 */
router.get('/:id', authenticateToken, validateRequest({ params: tagTeamIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }

  const teamId = parseInt(String(req.params.id));

  const team = await getTeamById(teamId);

  if (!team) {
    throw new TagTeamError(TagTeamErrorCode.TAG_TEAM_NOT_FOUND, 'Team not found', 404);
  }

  if (team.stableId !== req.user.userId) {
    throw new AuthError(AuthErrorCode.FORBIDDEN, 'You do not own this team', 403);
  }

  const readiness = await checkTeamReadiness(team.id);

  res.json({
    team: { ...team, readiness },
  });
});

/**
 * DELETE /api/tag-teams/:id
 * Disband a team
 */
router.delete('/:id', authenticateToken, validateRequest({ params: tagTeamIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }

  const teamId = parseInt(String(req.params.id));

  const success = await disbandTeam(teamId, req.user.userId);

  if (!success) {
    throw new TagTeamError(TagTeamErrorCode.TAG_TEAM_NOT_FOUND, 'Team not found or you do not own this team', 404);
  }

  logger.info(`[TagTeam] User ${req.user.userId} | Disbanded team | Team ID: ${teamId}`);

  res.json({ message: 'Team disbanded successfully' });
});

/**
 * GET /api/tag-teams/leagues/:tier/standings
 * Get standings for a specific tag team league tier
 */
router.get('/leagues/:tier/standings', authenticateToken, validateRequest({ params: tierParamsSchema }), async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }

  const tier = String(req.params.tier) as TagTeamLeagueTier;

  if (!TAG_TEAM_LEAGUE_TIERS.includes(tier)) {
    throw new TagTeamError(TagTeamErrorCode.TAG_TEAM_LEAGUE_NOT_FOUND, 'Invalid league tier', 400, { validTiers: TAG_TEAM_LEAGUE_TIERS });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 50));

  const allStandings = await getStandingsForTier(tier);

  const total = allStandings.length;
  const totalPages = Math.ceil(total / perPage);
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedStandings = allStandings.slice(startIndex, endIndex);

  const formattedStandings = paginatedStandings.map(team => ({
    rank: team.rank,
    teamId: team.id,
    stableId: team.stableId,
    tagTeamLeagueId: team.tagTeamLeagueId,
    tagTeamLeaguePoints: team.tagTeamLeaguePoints,
    combinedELO: team.combinedELO,
    wins: team.totalTagTeamWins,
    losses: team.totalTagTeamLosses,
    draws: team.totalTagTeamDraws,
    totalMatches: team.totalTagTeamWins + team.totalTagTeamLosses + team.totalTagTeamDraws,
    stableName: team.stable?.stableName || null,
    activeRobot: {
      id: team.activeRobot.id,
      name: team.activeRobot.name,
      elo: team.activeRobot.elo,
    },
    reserveRobot: {
      id: team.reserveRobot.id,
      name: team.reserveRobot.name,
      elo: team.reserveRobot.elo,
    },
  }));

  res.json({
    standings: formattedStandings,
    pagination: { page, perPage, total, totalPages, hasMore: endIndex < total },
    tier,
  });
});

export default router;
