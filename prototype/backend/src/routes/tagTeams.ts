import express, { Response } from 'express';
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

const router = express.Router();

/**
 * POST /api/tag-teams
 * Create a new tag team
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { activeRobotId, reserveRobotId } = req.body;

    // Validate input
    if (!activeRobotId || !reserveRobotId) {
      throw new TagTeamError(TagTeamErrorCode.INVALID_TEAM_COMPOSITION, 'Both activeRobotId and reserveRobotId are required', 400);
    }

    if (typeof activeRobotId !== 'number' || typeof reserveRobotId !== 'number') {
      throw new AppError('INVALID_PARAMETER', 'Robot IDs must be numbers', 400);
    }

    if (activeRobotId === reserveRobotId) {
      throw new TagTeamError(TagTeamErrorCode.INVALID_TEAM_COMPOSITION, 'Active and reserve robots must be different', 400);
    }

    // Verify both robots belong to the user
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

    // Create the team
    const result = await createTeam(req.user.userId, activeRobotId, reserveRobotId);

    if (!result.success) {
      throw new TagTeamError(TagTeamErrorCode.INVALID_TEAM_COMPOSITION, 'Failed to create team', 400, result.errors);
    }

    // Get team with robot details
    const teamWithRobots = await getTeamById(result.team!.id);

    // Console log for cycle logs
    logger.info(`[TagTeam] User ${req.user.userId} | Created team | Active: ${activeRobotId} (${activeRobot.name}) | Reserve: ${reserveRobotId} (${reserveRobot.name})`);

    res.status(201).json({
      team: teamWithRobots,
      message: 'Tag team created successfully',
    });
  } catch (error) {
    logger.error('[TagTeams API] Error creating team:', error);
    throw error;
  }
});

/**
 * GET /api/tag-teams
 * List all teams for the current user's stable
 * Requirements: 9.1, 9.2
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const teams = await getTeamsByStable(req.user.userId);

    // Add readiness status for each team
    const teamsWithReadiness = await Promise.all(
      teams.map(async (team) => {
        const readiness = await checkTeamReadiness(team.id);
        return {
          ...team,
          readiness,
        };
      })
    );

    res.json({
      teams: teamsWithReadiness,
      total: teamsWithReadiness.length,
    });
  } catch (error) {
    logger.error('[TagTeams API] Error fetching teams:', error);
    throw error;
  }
});

/**
 * GET /api/tag-teams/:id
 * Get team details by ID
 * Requirements: 9.1, 9.2
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const teamId = parseInt(String(req.params.id));

    if (isNaN(teamId)) {
      throw new AppError('INVALID_TEAM_ID', 'Invalid team ID', 400);
    }

    const team = await getTeamById(teamId);

    if (!team) {
      throw new TagTeamError(TagTeamErrorCode.TAG_TEAM_NOT_FOUND, 'Team not found', 404);
    }

    // Verify ownership
    if (team.stableId !== req.user.userId) {
      throw new AuthError(AuthErrorCode.FORBIDDEN, 'You do not own this team', 403);
    }

    // Add readiness status
    const readiness = await checkTeamReadiness(team.id);

    res.json({
      team: {
        ...team,
        readiness,
      },
    });
  } catch (error) {
    logger.error('[TagTeams API] Error fetching team:', error);
    throw error;
  }
});

/**
 * DELETE /api/tag-teams/:id
 * Disband a team
 * Requirements: 9.7
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const teamId = parseInt(String(req.params.id));

    if (isNaN(teamId)) {
      throw new AppError('INVALID_TEAM_ID', 'Invalid team ID', 400);
    }

    const success = await disbandTeam(teamId, req.user.userId);

    if (!success) {
      throw new TagTeamError(TagTeamErrorCode.TAG_TEAM_NOT_FOUND, 'Team not found or you do not own this team', 404);
    }

    // Console log for cycle logs
    logger.info(`[TagTeam] User ${req.user.userId} | Disbanded team | Team ID: ${teamId}`);

    res.json({
      message: 'Team disbanded successfully',
    });
  } catch (error) {
    logger.error('[TagTeams API] Error disbanding team:', error);
    throw error;
  }
});

/**
 * GET /api/tag-teams/leagues/:tier/standings
 * Get standings for a specific tag team league tier
 * Requirements: 9.3
 */
router.get('/leagues/:tier/standings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const tier = String(req.params.tier) as TagTeamLeagueTier;

    // Validate tier
    if (!TAG_TEAM_LEAGUE_TIERS.includes(tier)) {
      throw new TagTeamError(TagTeamErrorCode.TAG_TEAM_LEAGUE_NOT_FOUND, 'Invalid league tier', 400, { validTiers: TAG_TEAM_LEAGUE_TIERS });
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 50));

    // Get standings for the tier
    const allStandings = await getStandingsForTier(tier);

    // Apply pagination
    const total = allStandings.length;
    const totalPages = Math.ceil(total / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedStandings = allStandings.slice(startIndex, endIndex);

    // Format response
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
      pagination: {
        page,
        perPage,
        total,
        totalPages,
        hasMore: endIndex < total,
      },
      tier,
    });
  } catch (error) {
    logger.error('[TagTeams API] Error fetching standings:', error);
    throw error;
  }
});

export default router;
