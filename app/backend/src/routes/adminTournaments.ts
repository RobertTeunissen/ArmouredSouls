/**
 * Tournament Admin Routes
 * Endpoints for tournament management and execution
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import logger from '../config/logger';
import { recordAction as recordAuditAction } from '../services/admin/adminAuditLogService';
import {
  createSingleEliminationTournament,
  getActiveTournaments,
  getTournamentById,
  getCurrentRoundMatches,
  advanceWinnersToNextRound,
  autoCreateNextTournament,
  getEligibleRobotsForTournament,
} from '../services/tournament/tournamentService';
import { processTournamentBattle } from '../services/tournament/tournamentBattleOrchestrator';
import { AppError, TournamentError, TournamentErrorCode } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';

const router = express.Router();

// --- Zod schemas for admin tournament routes ---

const tournamentIdParamsSchema = z.object({
  id: positiveIntParam,
});

const createTournamentBodySchema = z.object({
  tournamentType: z.enum(['single_elimination']).optional().default('single_elimination'),
});

const tournamentListQuerySchema = z.object({
  status: z.string().max(30).optional(),
});

/**
 * POST /api/admin/tournaments/create
 * Create a new single elimination tournament
 */
router.post('/create', authenticateToken, requireAdmin, validateRequest({ body: createTournamentBodySchema }), async (req: Request, res: Response) => {
  try {
    const { tournamentType = 'single_elimination' } = req.body;

    if (tournamentType !== 'single_elimination') {
      throw new TournamentError(TournamentErrorCode.INVALID_TOURNAMENT_STATE, 'Only single_elimination is supported currently', 400);
    }

    logger.info('[Admin] Creating tournament...');
    const result = await createSingleEliminationTournament();

    res.json({
      success: true,
      tournament: result.tournament,
      bracket: result.bracket,
      participantCount: result.participantCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Tournament creation error:', error);
    throw error;
  }
});

/**
 * GET /api/admin/tournaments
 * Get all tournaments (or filter by status)
 */
router.get('/', authenticateToken, requireAdmin, validateRequest({ query: tournamentListQuerySchema }), async (req: Request, res: Response) => {
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
    logger.error('[Admin] Tournament list error:', error);
    res.status(500).json({
      error: 'Failed to fetch tournaments',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/tournaments/eligible-robots
 * Get robots eligible for tournament participation
 * NOTE: Must be defined before /:id to avoid Express matching "eligible-robots" as an :id param
 */
router.get('/eligible-robots', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    const eligibleRobots = await getEligibleRobotsForTournament();

    res.json({
      success: true,
      eligibleRobots,
      count: eligibleRobots.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Eligible robots fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch eligible robots',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/tournaments/:id
 * Get detailed tournament information
 */
router.get('/:id', authenticateToken, requireAdmin, validateRequest({ params: tournamentIdParamsSchema }), async (req: Request, res: Response) => {
  try {
    const tournamentId = parseInt(String(req.params.id));

    if (isNaN(tournamentId)) {
      throw new AppError('INVALID_TOURNAMENT_ID', 'Invalid tournament ID', 400);
    }

    const tournament = await getTournamentById(tournamentId);

    if (!tournament) {
      throw new TournamentError(TournamentErrorCode.TOURNAMENT_NOT_FOUND, 'Tournament not found', 404);
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
    logger.error('[Admin] Tournament fetch error:', error);
    throw error;
  }
});

/**
 * POST /api/admin/tournaments/:id/execute-round
 * Execute the current round of a tournament
 */
router.post('/:id/execute-round', authenticateToken, requireAdmin, validateRequest({ params: tournamentIdParamsSchema }), async (req: Request, res: Response) => {
  try {
    const tournamentId = parseInt(String(req.params.id));

    if (isNaN(tournamentId)) {
      throw new AppError('INVALID_TOURNAMENT_ID', 'Invalid tournament ID', 400);
    }

    logger.info(`[Admin] Executing tournament ${tournamentId} round...`);

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new TournamentError(TournamentErrorCode.TOURNAMENT_NOT_FOUND, 'Tournament not found', 404);
    }

    if (tournament.status === 'completed') {
      throw new TournamentError(TournamentErrorCode.TOURNAMENT_ALREADY_COMPLETED, 'Tournament already completed', 400);
    }

    // Get current round matches that need execution
    const currentRoundMatches = await prisma.scheduledTournamentMatch.findMany({
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
        logger.error(`[Admin] Tournament match ${match.id} failed:`, error);
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
          logger.info(`[Admin] Auto-created next tournament: ${nextTournament.name}`);
        }
      } catch (error) {
        logger.error('[Admin] Failed to auto-create next tournament:', error);
      }
    }

    const authReq = req as AuthRequest;
    recordAuditAction(authReq.user!.userId, 'tournament_execute_round', 'success', {
      tournamentId,
      round: summary.round,
      matchesExecuted: summary.matchesExecuted,
      tournamentComplete: summary.tournamentComplete,
    });

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Tournament round execution error:', error);
    res.status(500).json({
      error: 'Failed to execute tournament round',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
