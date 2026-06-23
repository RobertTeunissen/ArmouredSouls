import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { computeSeedings } from '../services/tournament/tournamentService';
import prisma from '../lib/prisma';
import logger from '../config/logger';
import { AppError, TournamentError, TournamentErrorCode } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';

const router = express.Router();

// --- Zod schemas for tournament routes ---

const tournamentIdParamsSchema = z.object({
  id: positiveIntParam,
});

const tournamentListQuerySchema = z.object({
  status: z.string().max(30).optional(),
  participantType: z.enum(['robot', 'team_2v2', 'team_3v3']).optional(),
});

/**
 * GET /api/tournaments
 * Get all tournaments (public access for all authenticated users)
 * Supports optional participantType filter.
 */
router.get('/', authenticateToken, validateRequest({ query: tournamentListQuerySchema }), async (req: AuthRequest, res: Response) => {
  const { status, participantType } = req.query;

  let tournaments;
  if (status && (status === 'active' || status === 'pending')) {
    const where: Record<string, unknown> = { status: { in: ['active', 'pending'] } };
    if (participantType) where.participantType = String(participantType);
    tournaments = await prisma.tournament.findMany({
      where,
      include: {
        matches: {
          orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  } else {
    const where: Record<string, unknown> = {};
    if (status) where.status = String(status);
    if (participantType) where.participantType = String(participantType);
    tournaments = await prisma.tournament.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        matches: {
          orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
          take: 50,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // Resolve winners for completed tournaments
  const tournamentsWithWinners = await Promise.all(
    tournaments.map(async (tournament) => {
      if (!tournament.winnerId || tournament.status !== 'completed') {
        return { ...tournament, winner: null };
      }

      let winner = null;
      if (tournament.participantType === 'robot') {
        const robot = await prisma.robot.findUnique({
          where: { id: tournament.winnerId },
          select: { id: true, name: true, elo: true, user: { select: { id: true, username: true, stableName: true } } },
        });
        if (robot) {
          winner = { id: robot.id, name: robot.name, user: robot.user };
        }
      } else if (tournament.participantType === 'team_2v2' || tournament.participantType === 'team_3v3') {
        const team = await prisma.teamBattle.findUnique({
          where: { id: tournament.winnerId },
          include: { stable: { select: { id: true, username: true, stableName: true } } },
        });
        if (team) {
          winner = {
            id: team.id,
            name: team.teamName,
            user: team.stable ? { id: team.stable.id, username: team.stable.username, stableName: team.stable.stableName } : undefined,
          };
        }
      }

      return { ...tournament, winner };
    })
  );

  res.json({
    success: true,
    tournaments: tournamentsWithWinners,
    count: tournamentsWithWinners.length,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/tournaments/:id
 * Get tournament details with all matches and seedings
 */
router.get('/:id', authenticateToken, validateRequest({ params: tournamentIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const tournamentId = parseInt(String(req.params.id));

  if (isNaN(tournamentId)) {
    throw new AppError('INVALID_TOURNAMENT_ID', 'Invalid tournament ID', 400);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      matches: {
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
    const round1MatchesRaw = tournament.matches
      .filter((m) => m.round === 1)
      .sort((a, b) => a.matchNumber - b.matchNumber);

    const participantIds = round1MatchesRaw.flatMap(m => [m.participant1Id, m.participant2Id]).filter((id): id is number => id !== null);

    // Resolve participants based on tournament type
    let participantMap: Map<number, { id: number; name: string; elo: number }>;

    if (tournament.participantType === 'robot') {
      // 1v1: resolve as robots
      const robots = participantIds.length > 0
        ? await prisma.robot.findMany({ where: { id: { in: participantIds } }, select: { id: true, name: true, elo: true } })
        : [];
      participantMap = new Map(robots.map(r => [r.id, r]));
    } else {
      // Team tournaments: resolve as teams with combined ELO
      const teams = participantIds.length > 0
        ? await prisma.teamBattle.findMany({
            where: { id: { in: participantIds } },
            include: { members: { include: { robot: { select: { elo: true } } } } },
          })
        : [];
      participantMap = new Map(teams.map(t => [t.id, {
        id: t.id,
        name: t.teamName,
        elo: t.members.reduce((sum, m) => sum + m.robot.elo, 0),
      }]));
    }

    const round1Matches = round1MatchesRaw.map(m => ({
      matchNumber: m.matchNumber,
      participant1Id: m.participant1Id,
      participant2Id: m.participant2Id,
      robot1: m.participant1Id ? participantMap.get(m.participant1Id) ?? null : null,
      robot2: m.participant2Id ? participantMap.get(m.participant2Id) ?? null : null,
    }));

    const bracketSize = Math.pow(2, tournament.maxRounds);
    const completedMatches = tournament.matches
      .filter((m) => m.status === 'completed')
      .map(m => ({ winnerId: m.winnerId, participant1Id: m.participant1Id, participant2Id: m.participant2Id, status: m.status }));

    seedings = computeSeedings(round1Matches, bracketSize, completedMatches);
  } catch (seedError) {
    logger.error(`[Tournaments] Failed to compute seedings for tournament ${tournamentId}:`, seedError);
  }

  // Resolve winner for response (if tournament is completed)
  let winner = null;
  if (tournament.winnerId && tournament.participantType === 'robot') {
    winner = await prisma.robot.findUnique({
      where: { id: tournament.winnerId },
      select: { id: true, name: true, elo: true, user: { select: { id: true, username: true, stableName: true } } },
    });
  } else if (tournament.winnerId && (tournament.participantType === 'team_2v2' || tournament.participantType === 'team_3v3')) {
    const team = await prisma.teamBattle.findUnique({
      where: { id: tournament.winnerId },
      include: { stable: { select: { id: true, username: true, stableName: true } } },
    });
    if (team) {
      winner = {
        id: team.id,
        name: team.teamName,
        user: team.stable ? { id: team.stable.id, username: team.stable.username, stableName: team.stable.stableName } : undefined,
      };
    }
  }

  // Resolve participants for all tournament types
  let resolvedParticipants: Record<number, { id: number; displayName: string; leagueTier: string; elo: number; ownerId: number; ownerStableName?: string; members?: { robotId: number; robotName: string; elo: number }[] }> = {};
  const participantIds = new Set<number>();
  for (const m of tournament.matches) {
    if (m.participant1Id) participantIds.add(m.participant1Id);
    if (m.participant2Id) participantIds.add(m.participant2Id);
  }
  if (participantIds.size > 0) {
    try {
      const { resolveParticipantsBatch } = await import('../services/tournament/tournamentParticipantResolver');
      const resolved = await resolveParticipantsBatch(Array.from(participantIds), tournament.participantType as 'robot' | 'team_2v2' | 'team_3v3');
      resolvedParticipants = Object.fromEntries(resolved);
    } catch (resolveErr) {
      logger.error(`[Tournaments] Failed to resolve participants for tournament ${tournamentId}:`, resolveErr);
    }
  }

  res.json({
    success: true,
    tournament: {
      id: tournament.id,
      name: tournament.name,
      tournamentType: tournament.tournamentType,
      participantType: tournament.participantType,
      status: tournament.status,
      currentRound: tournament.currentRound,
      maxRounds: tournament.maxRounds,
      totalParticipants: tournament.totalParticipants,
      winnerId: tournament.winnerId,
      createdAt: tournament.createdAt,
      startedAt: tournament.startedAt,
      completedAt: tournament.completedAt,
      winner,
      matches: tournament.matches,
      resolvedParticipants,
    },
    seedings,
    timestamp: new Date().toISOString(),
  });
});

export default router;
