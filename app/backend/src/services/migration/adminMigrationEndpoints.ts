/**
 * Admin Migration Endpoints
 *
 * POST /verify  - Run migration verification and return report
 * POST /execute - Run full deploy orchestration (backfill + verify)
 */
import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireAdmin, AuthRequest } from '../../middleware/auth';
import { validateRequest } from '../../middleware/schemaValidator';
import { migrationVerificationService } from './migrationVerificationService';
import { executeDeploy } from './deployOrchestrator';

const router = Router();

const adminMigrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/verify', authenticateToken, requireAdmin, adminMigrationLimiter, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const report = await migrationVerificationService.generateFullReport();
  res.json(report);
});

router.post('/execute', authenticateToken, requireAdmin, adminMigrationLimiter, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const result = await executeDeploy();
  res.json(result);
});

export default router;
