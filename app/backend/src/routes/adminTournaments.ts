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
  getTournamentById,
  getCurrentRoundMatches,
  advanceWinnersToNextRound,
  autoCreateNextTournament,
  getEligibleRobotsForTournament,
} from '../services/tournament/tournamentService';
import { processTournamentBattle } from '../services/tournament/tournamentBattleOrchestrator';
import { resolveParticipantsBatch } from '../services/tournament/tournamentParticipantResolver';
import type { ParticipantType } from '../services/tournament/tournamentParticipantResolver';
import { AppError, TournamentError, TournamentErrorCode } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import type { Tournament } from '../../generated/prisma';

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
  participantType: z.enum(['robot', 'team_2v2', 'team_3v3']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

/**
 * POST /api/admin/tournaments/create
 * Create a new single elimination tournament
 */
router.post('/create', authenticateToken, requireAdmin, validateRequest({ body: createTournamentBodySchema }), async (req: Request, res: Response) => {
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
});

/**
 * GET /api/admin/tournaments
 * Get all tournaments with optional filters (status, participantType) and pagination.
 * Ordered by creation date descending.
 */
router.get('/', authenticateToken, requireAdmin, validateRequest({ query: tournamentListQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { status, participantType, page, limit } = req.query as {
      status?: string;
      participantType?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(String(limit)) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (participantType) where.participantType = participantType;

    const [tournaments, totalCount] = await Promise.all([
      prisma.tournament.findMany({
        where,
        include: {
          matches: {
            orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
            take: 100,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.tournament.count({ where }),
    ]);

    res.json({
      success: true,
      tournaments,
      count: tournaments.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Tournament list error:', error);
    res.status(500).json({
      error: 'Failed to fetch tournaments',
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
    const totalRobots = await prisma.robot.count({
      where: {},
    });

    res.json({
      success: true,
      eligibleRobots,
      eligibleCount: eligibleRobots.length,
      totalRobots,
      count: eligibleRobots.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Eligible robots fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch eligible robots',
    });
  }
});

/**
 * GET /api/admin/tournaments/history
 * Get tournament creation history per type (50 most recent per type).
 * Returns participant counts, round counts, and completion timestamps.
 */
router.get('/history', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    const [robot, team2v2, team3v3] = await Promise.all([
      prisma.tournament.findMany({
        where: { participantType: 'robot' },
        select: {
          id: true,
          name: true,
          status: true,
          participantType: true,
          totalParticipants: true,
          maxRounds: true,
          currentRound: true,
          winnerId: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.tournament.findMany({
        where: { participantType: 'team_2v2' },
        select: {
          id: true,
          name: true,
          status: true,
          participantType: true,
          totalParticipants: true,
          maxRounds: true,
          currentRound: true,
          winnerId: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.tournament.findMany({
        where: { participantType: 'team_3v3' },
        select: {
          id: true,
          name: true,
          status: true,
          participantType: true,
          totalParticipants: true,
          maxRounds: true,
          currentRound: true,
          winnerId: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    res.json({
      success: true,
      history: {
        robot,
        team_2v2: team2v2,
        team_3v3: team3v3,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Tournament history error:', error);
    res.status(500).json({
      error: 'Failed to fetch tournament history',
    });
  }
});

/**
 * GET /api/admin/tournaments/:id
 * Get detailed tournament information with resolved participant names.
 */
router.get('/:id', authenticateToken, requireAdmin, validateRequest({ params: tournamentIdParamsSchema }), async (req: Request, res: Response) => {
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

  // Resolve participant names for bracket display
  const participantIds = new Set<number>();
  const tournamentWithMatches = tournament as Tournament & { matches?: Array<{ participant1Id: number | null; participant2Id: number | null }> };
  if (tournamentWithMatches.matches) {
    for (const match of tournamentWithMatches.matches) {
      if (match.participant1Id) participantIds.add(match.participant1Id);
      if (match.participant2Id) participantIds.add(match.participant2Id);
    }
  }
  if (tournament.winnerId) participantIds.add(tournament.winnerId);

  let resolvedParticipants: Record<number, { id: number; displayName: string; leagueTier: string; elo: number; ownerId: number; ownerStableName?: string; members?: { robotId: number; robotName: string; elo: number }[] }> = {};
  if (participantIds.size > 0) {
    const participantType = (tournament.participantType || 'robot') as ParticipantType;
    const resolved = await resolveParticipantsBatch(Array.from(participantIds), participantType);
    resolvedParticipants = Object.fromEntries(resolved);
  }

  res.json({
    success: true,
    tournament,
    currentRoundMatches,
    resolvedParticipants,
    timestamp: new Date().toISOString(),
  });
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
    });
  }
});

export default router;
