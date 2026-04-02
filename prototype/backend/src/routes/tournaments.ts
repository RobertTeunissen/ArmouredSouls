import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getActiveTournaments, computeSeedings } from '../services/tournament/tournamentService';
import prisma from '../lib/prisma';
import logger from '../config/logger';
import { AppError, TournamentError, TournamentErrorCode } from '../errors';

const router = express.Router();

/**
 * GET /api/tournaments
 * Get all tournaments (public access for all authenticated users)
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;

    let tournaments;
    if (status && (status === 'active' || status === 'pending')) {
      tournaments = await getActiveTournaments();
    } else {
      tournaments = await prisma.tournament.findMany({
        where: status ? { status: String(status) } : undefined,
        include: {
          winner: {
            include: {
              user: { select: { id: true, username: true, stableName: true } },
            },
          },
          matches: {
            orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
            take: 50,
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
    logger.error('[Tournaments] List error:', error);
    res.status(500).json({
      error: 'Failed to fetch tournaments',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/tournaments/:id
 * Get tournament details with all matches and seedings (public access for all authenticated users)
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tournamentId = parseInt(String(req.params.id));

    if (isNaN(tournamentId)) {
      throw new AppError('INVALID_TOURNAMENT_ID', 'Invalid tournament ID', 400);
    }

    const robotSelect = { id: true, name: true, elo: true, user: { select: { id: true, username: true, stableName: true } } };

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        winner: { select: robotSelect },
        matches: {
          include: {
            robot1: { select: robotSelect },
            robot2: { select: robotSelect },
            winner: { select: robotSelect },
          },
          orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
        },
      },
    });

    if (!tournament) {
      throw new TournamentError(TournamentErrorCode.TOURNAMENT_NOT_FOUND, 'Tournament not found', 404);
    }

    // Compute seedings with graceful degradation
    let seedings: ReturnType<typeof computeSeedings> = [];
    try {
      const round1Matches = tournament.matches
        .filter((m) => m.round === 1)
        .sort((a, b) => a.matchNumber - b.matchNumber);

      const bracketSize = Math.pow(2, tournament.maxRounds);

      const completedMatches = tournament.matches.filter(
        (m) => m.status === 'completed'
      );

      seedings = computeSeedings(round1Matches, bracketSize, completedMatches);
    } catch (seedError) {
      logger.error(`[Tournaments] Failed to compute seedings for tournament ${tournamentId}:`, seedError);
    }

    res.json({
      success: true,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        tournamentType: tournament.tournamentType,
        status: tournament.status,
        currentRound: tournament.currentRound,
        maxRounds: tournament.maxRounds,
        totalParticipants: tournament.totalParticipants,
        winnerId: tournament.winnerId,
        createdAt: tournament.createdAt,
        startedAt: tournament.startedAt,
        completedAt: tournament.completedAt,
        winner: tournament.winner,
        matches: tournament.matches,
      },
      seedings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Tournaments] Get details error:', error);
    res.status(500).json({
      error: 'Failed to fetch tournament details',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
