import express, { Request, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import prisma from '../lib/prisma';
import {
  createTeam,
  getTeamById,
  getTeamsByStable,
  disbandTeam,
  checkTeamReadiness,
} from '../services/tagTeamService';
import {
  getStandingsForTier,
  TAG_TEAM_LEAGUE_TIERS,
  TagTeamLeagueTier,
} from '../services/tagTeamLeagueInstanceService';

const router = express.Router();

/**
 * POST /api/tag-teams
 * Create a new tag team
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { activeRobotId, reserveRobotId } = req.body;

    // Validate input
    if (!activeRobotId || !reserveRobotId) {
      return res.status(400).json({ error: 'Both activeRobotId and reserveRobotId are required' });
    }

    if (typeof activeRobotId !== 'number' || typeof reserveRobotId !== 'number') {
      return res.status(400).json({ error: 'Robot IDs must be numbers' });
    }

    if (activeRobotId === reserveRobotId) {
      return res.status(400).json({ error: 'Active and reserve robots must be different' });
    }

    // Verify both robots belong to the user
    const [activeRobot, reserveRobot] = await Promise.all([
      prisma.robot.findUnique({ where: { id: activeRobotId } }),
      prisma.robot.findUnique({ where: { id: reserveRobotId } }),
    ]);

    if (!activeRobot || activeRobot.userId !== req.user.userId) {
      return res.status(403).json({ error: 'You do not own the active robot' });
    }

    if (!reserveRobot || reserveRobot.userId !== req.user.userId) {
      return res.status(403).json({ error: 'You do not own the reserve robot' });
    }

    // Create the team
    const result = await createTeam(req.user.userId, activeRobotId, reserveRobotId);

    if (!result.success) {
      return res.status(400).json({ 
        error: 'Failed to create team',
        details: result.errors,
      });
    }

    // Get team with robot details
    const teamWithRobots = await getTeamById(result.team!.id);

    res.status(201).json({
      team: teamWithRobots,
      message: 'Tag team created successfully',
    });
  } catch (error) {
    console.error('[TagTeams API] Error creating team:', error);
    res.status(500).json({
      error: 'Failed to create team',
      message: error instanceof Error ? error.message : String(error),
    });
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
      return res.status(401).json({ error: 'Authentication required' });
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
    console.error('[TagTeams API] Error fetching teams:', error);
    res.status(500).json({
      error: 'Failed to fetch teams',
      message: error instanceof Error ? error.message : String(error),
    });
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
      return res.status(401).json({ error: 'Authentication required' });
    }

    const teamId = parseInt(req.params.id);

    if (isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID' });
    }

    const team = await getTeamById(teamId);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Verify ownership
    if (team.stableId !== req.user.userId) {
      return res.status(403).json({ error: 'You do not own this team' });
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
    console.error('[TagTeams API] Error fetching team:', error);
    res.status(500).json({
      error: 'Failed to fetch team',
      message: error instanceof Error ? error.message : String(error),
    });
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
      return res.status(401).json({ error: 'Authentication required' });
    }

    const teamId = parseInt(req.params.id);

    if (isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID' });
    }

    const success = await disbandTeam(teamId, req.user.userId);

    if (!success) {
      return res.status(404).json({ error: 'Team not found or you do not own this team' });
    }

    res.json({
      message: 'Team disbanded successfully',
    });
  } catch (error) {
    console.error('[TagTeams API] Error disbanding team:', error);
    res.status(500).json({
      error: 'Failed to disband team',
      message: error instanceof Error ? error.message : String(error),
    });
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
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tier = req.params.tier as TagTeamLeagueTier;

    // Validate tier
    if (!TAG_TEAM_LEAGUE_TIERS.includes(tier)) {
      return res.status(400).json({ 
        error: 'Invalid league tier',
        validTiers: TAG_TEAM_LEAGUE_TIERS,
      });
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 50));

    // Get standings for the tier
    const allStandings = await getStandingsForTier(tier);
    
    // Debug: Log first team to see if stable is included
    if (allStandings.length > 0) {
      console.log('[TagTeams API] Sample standing:', {
        id: allStandings[0].id,
        stableId: allStandings[0].stableId,
        stable: allStandings[0].stable,
        hasStable: !!allStandings[0].stable,
        stableName: allStandings[0].stable?.stableName,
      });
    }

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
    console.error('[TagTeams API] Error fetching standings:', error);
    res.status(500).json({
      error: 'Failed to fetch standings',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
