import express, { Request, Response } from 'express';
import { validateRequest } from '../middleware/schemaValidator';
import { authenticateToken } from '../middleware/auth';
import { getHallOfRecords } from '../services/records/hallOfRecordsService';

const router = express.Router();

// The Hall of Records is for signed-in players only.
router.use(authenticateToken);

/**
 * GET /api/records
 * Get all Hall of Records statistics (cached; see hallOfRecordsService).
 */
router.get('/', validateRequest({}), async (_req: Request, res: Response) => {
  res.json(await getHallOfRecords());
});

export default router;
