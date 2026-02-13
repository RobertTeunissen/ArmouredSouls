/**
 * Tournament Admin Routes
 * Endpoints for tournament management and execution
 */

import express, { Request, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import prisma from '../lib/prisma';
import {
  createSingleEliminationTournament,
  getActiveTournaments,
  getTournamentById,
  getCurrentRoundMatches,
  advanceWinnersToNextRound,
  autoCreateNextTournament,
  getEligibleRobotsForTournament,
} from '../services/tournamentService';
import { processTournamentBattle } from '../services/tournamentBattleOrchestrator';

const router = express.Router();

/**
 * Middleware to check if user is admin
 */
const requireAdmin = (req: AuthRequest, res: Response, next: express.NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

/**
 * POST /api/admin/tournaments/create
 * Create a new single elimination tournament
 */
router.post('/create', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tournamentType = 'single_elimination' } = req.body;

    if (tournamentType !== 'single_elimination') {
      return res.status(400).json({
        error: 'Invalid tournament type',
        message: 'Only single_elimination is supported currently',
      });
    }

    console.log('[Admin] Creating tournament...');
    const result = await createSingleEliminationTournament();

    res.json({
      success: true,
      tournament: result.tournament,
      bracket: result.bracket,
      participantCount: result.participantCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Tournament creation error:', error);
    res.status(500).json({
      error: 'Failed to create tournament',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/tournaments
 * Get all tournaments (or filter by status)
 */
router.get('/', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let tournaments;
    if (status && (status === 'active' || status === 'pending')) {
      tournaments = await getActiveTournaments();
    } else {
      tournaments = await prisma.tournament.findMany({
        where: status ? { status: String(status) } : undefined,
        include: {
          winner: true,
          matches: {
            orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
            take: 50, // Limit for performance
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    }

    res.json({
      success: true,
      tournaments,
      count: tournaments.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Tournament list error:', error);
    res.status(500).json({
      error: 'Failed to fetch tournaments',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/tournaments/:id
 * Get detailed tournament information
 */
router.get('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tournamentId = parseInt(req.params.id);

    if (isNaN(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    const tournament = await getTournamentById(tournamentId);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Get current round matches separately for better structure
    const currentRoundMatches = await getCurrentRoundMatches(tournamentId);

    res.json({
      success: true,
      tournament,
      currentRoundMatches,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Tournament fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch tournament',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/tournaments/:id/execute-round
 * Execute the current round of a tournament
 */
router.post('/:id/execute-round', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tournamentId = parseInt(req.params.id);

    if (isNaN(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    console.log(`[Admin] Executing tournament ${tournamentId} round...`);

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.status === 'completed') {
      return res.status(400).json({ error: 'Tournament already completed' });
    }

    // Get current round matches that need execution
    const currentRoundMatches = await prisma.tournamentMatch.findMany({
      where: {
        tournamentId,
        round: tournament.currentRound,
        status: { in: ['pending', 'scheduled'] },
        isByeMatch: false, // Bye matches auto-complete on creation
      },
    });

    const summary = {
      tournamentId,
      round: tournament.currentRound,
      matchesExecuted: 0,
      matchesFailed: 0,
      byeMatches: 0,
      winners: [] as number[],
      errors: [] as string[],
      tournamentComplete: false,
      championRobotId: undefined as number | undefined,
    };

    // Execute each match
    for (const match of currentRoundMatches) {
      try {
        const result = await processTournamentBattle(match);
        summary.matchesExecuted++;
        summary.winners.push(result.winnerId);
      } catch (error) {
        summary.matchesFailed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        summary.errors.push(`Match ${match.id}: ${errorMsg}`);
        console.error(`[Admin] Tournament match ${match.id} failed:`, error);
      }
    }

    // Advance to next round if all matches complete
    await advanceWinnersToNextRound(tournamentId);

    // Check if tournament completed
    const updatedTournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (updatedTournament?.status === 'completed') {
      summary.tournamentComplete = true;
      summary.championRobotId = updatedTournament.winnerId || undefined;

      // Auto-create next tournament if configured
      try {
        const nextTournament = await autoCreateNextTournament();
        if (nextTournament) {
          console.log(`[Admin] Auto-created next tournament: ${nextTournament.name}`);
        }
      } catch (error) {
        console.error('[Admin] Failed to auto-create next tournament:', error);
      }
    }

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Tournament round execution error:', error);
    res.status(500).json({
      error: 'Failed to execute tournament round',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/tournaments/eligible-robots
 * Get robots eligible for tournament participation
 */
router.get('/eligible-robots', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const eligibleRobots = await getEligibleRobotsForTournament();

    res.json({
      success: true,
      eligibleRobots,
      count: eligibleRobots.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Eligible robots fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch eligible robots',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
