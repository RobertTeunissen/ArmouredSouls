/**
 * Admin Tournaments routes, mounted at /api/admin/tournaments.
 *
 * Read-only: the overview of the admin Tournaments page. Tournament rounds run
 * from the scheduler (Cycle Controls can start a job by hand); brackets live on
 * the player tournament pages.
 */

import express, { Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { getTournamentOverview } from '../services/admin/tournaments';

const router = express.Router();

/**
 * GET /api/admin/tournaments/overview
 * The running tournament of each type (round, schedule state, expected finish)
 * and this season's completed tournaments with their champions.
 */
router.get('/overview', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  res.json(await getTournamentOverview());
});

export default router;
