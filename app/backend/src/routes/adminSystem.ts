/**
 * Admin System Routes
 *
 * GET /api/admin/system/overview — the System page: disk, memory, database,
 * backup, backend starts, failed and slow requests, scheduler job durations.
 * Read-only, admin-only. Mounted at /api/admin/system from the admin router.
 */
import express, { Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { getSystemOverview } from '../services/admin/system';

const router = express.Router();

router.get('/overview', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  res.json(await getSystemOverview());
});

export default router;
