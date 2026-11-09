import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validated } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import { getTournamentDetailView, listTournamentsForPlayers } from '../services/tournament/tournamentQueryService';

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
router.get('/', authenticateToken, ...validated({ query: tournamentListQuerySchema }, async (_req: AuthRequest, res: Response, { query }) => {
  const { tournaments, participantNames } = await listTournamentsForPlayers(query);

  res.json({
    success: true,
    tournaments,
    participantNames,
    count: tournaments.length,
    timestamp: new Date().toISOString(),
  });
}));

/**
 * GET /api/tournaments/:id
 * Get tournament details with all matches and seedings
 */
router.get('/:id', authenticateToken, ...validated({ params: tournamentIdParamsSchema }, async (_req: AuthRequest, res: Response, { params }) => {
  const { tournament, seedings } = await getTournamentDetailView(params.id);

  res.json({
    success: true,
    tournament,
    seedings,
    timestamp: new Date().toISOString(),
  });
}));

export default router;
