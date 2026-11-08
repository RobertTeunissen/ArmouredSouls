import express, { Request, Response } from 'express';
import { validateRequest } from '../middleware/schemaValidator';
import { getHallOfRecords } from '../services/records/hallOfRecordsService';

const router = express.Router();

/**
 * GET /api/records
 * Get all Hall of Records statistics (cached; see hallOfRecordsService).
 */
router.get('/', validateRequest({}), async (_req: Request, res: Response) => {
  res.json(await getHallOfRecords());
});

export default router;
