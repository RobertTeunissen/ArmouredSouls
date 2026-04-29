import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import { sanitizeRobotForPublic } from './robots';
import { getStableProfile } from '../services/common/stableViewService';
import { AppError } from '../errors/AppError';

const router = Router();

const stableParamsSchema = z.object({
  userId: positiveIntParam,
});

router.get(
  '/:userId',
  authenticateToken,
  validateRequest({ params: stableParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = Number(req.params.userId);

    const profile = await getStableProfile(userId);

    if (!profile) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    // Sanitize robots for public view
    const robots = profile.robots.map(sanitizeRobotForPublic);

    return res.json({
      ...profile,
      robots,
    });
  },
);

export default router;
