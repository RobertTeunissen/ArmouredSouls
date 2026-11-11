import express, { Request, Response } from 'express';
import { z } from 'zod';
import { validated } from '../middleware/schemaValidator';
import { authenticateToken } from '../middleware/auth';
import { getHallOfRecords } from '../services/records/hallOfRecordsService';
import { STABLE_FILTERS } from '../services/standings/playerStables';

const router = express.Router();

// The Hall of Records is for signed-in players only.
router.use(authenticateToken);

const recordsQuerySchema = z.object({
  /** 'players': the players' top 10 per record, each with its place among all stables (#595). */
  stables: z.enum(STABLE_FILTERS).default('all'),
});

/**
 * GET /api/records
 * Get all Hall of Records statistics (cached; see hallOfRecordsService).
 */
router.get(
  '/',
  ...validated({ query: recordsQuerySchema }, async (_req: Request, res: Response, { query }) => {
    res.json(await getHallOfRecords(query.stables));
  }),
);

export default router;
