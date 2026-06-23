/**
 * Admin Migration Endpoints
 *
 * POST /verify  - Run migration verification and return report
 * POST /execute - Run full deploy orchestration (backfill + verify)
 */
import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../../middleware/auth';
import { validateRequest } from '../../middleware/schemaValidator';
import { migrationVerificationService } from './migrationVerificationService';
import { executeDeploy } from './deployOrchestrator';

const router = Router();

router.post('/verify', authenticateToken, requireAdmin, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const report = await migrationVerificationService.generateFullReport();
  res.json(report);
});

router.post('/execute', authenticateToken, requireAdmin, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const result = await executeDeploy();
  res.json(result);
});

export default router;
