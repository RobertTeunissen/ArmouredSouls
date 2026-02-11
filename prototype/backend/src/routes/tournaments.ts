import express, { Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { getActiveTournaments } from '../services/tournamentService';

const router = express.Router();
const prisma = new PrismaClient();

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
          winner: true,
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
    console.error('[Tournaments] List error:', error);
    res.status(500).json({
      error: 'Failed to fetch tournaments',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/tournaments/:id
 * Get tournament details (public access for all authenticated users)
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tournamentId = parseInt(req.params.id);

    if (isNaN(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        winner: true,
        matches: {
          where: { round: { lte: await getCurrentRound(tournamentId) } },
          include: {
            robot1: true,
            robot2: true,
            winner: true,
          },
          orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json({
      success: true,
      tournament,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Tournaments] Get details error:', error);
    res.status(500).json({
      error: 'Failed to fetch tournament details',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Helper function to get current round of a tournament
 */
async function getCurrentRound(tournamentId: number): Promise<number> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { currentRound: true },
  });
  return tournament?.currentRound || 1;
}

export default router;
