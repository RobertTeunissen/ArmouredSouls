/**
 * @module routes/tuningAllocation
 *
 * API endpoints for reading and updating a robot's tuning point allocation.
 * Thin route handlers that delegate to TuningPoolService.
 *
 * GET  /api/robots/:id/tuning-allocation — current allocation state
 * PUT  /api/robots/:id/tuning-allocation — update allocation
 *
 * @see Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.1, 8.2, 8.3, 8.4, 14.2
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { AuthError, AuthErrorCode } from '../errors/authErrors';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import { getTuningAllocation, setTuningAllocation } from '../services/tuning-pool';
import { ROBOT_ATTRIBUTES, type RobotAttribute } from '../services/tuning-pool/tuningPoolConfig';
import { achievementService, type UnlockedAchievement } from '../services/achievement';

const router = express.Router();

// --- Zod schemas ---

const tuningParamsSchema = z.object({
  id: positiveIntParam,
});

/**
 * Body schema for PUT /api/robots/:id/tuning-allocation.
 *
 * Accepts a partial record where keys are valid RobotAttribute names and values
 * are non-negative numbers with at most 2 decimal places, in range 0.00–55.00.
 * Unknown keys are stripped. Only provided attributes are set; omitted attributes
 * default to 0 in the service layer.
 *
 * Uses z.record(z.string(), ...) with a transform to strip unknown keys,
 * because z.record(z.enum(...), ...) requires ALL enum keys to be present.
 */
const tuningValueSchema = z
  .number()
  .min(0, 'Allocation must be ≥ 0')
  .max(55, 'Allocation must be ≤ 55.00')
  .refine(
    (v) => Math.round(v * 100) === v * 100,
    'Allocation must have at most 2 decimal places',
  );

const validAttributeKeys = new Set<string>(ROBOT_ATTRIBUTES);

const tuningBodySchema = z
  .record(z.string(), z.unknown())
  .transform((rec) => {
    // Strip any keys that aren't valid RobotAttribute names BEFORE validation
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rec)) {
      if (validAttributeKeys.has(key)) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  })
  .pipe(z.record(z.string(), tuningValueSchema))
  .transform((rec) => rec as Partial<Record<RobotAttribute, number>>);

// --- Route handlers ---

/**
 * GET /api/robots/:id/tuning-allocation
 *
 * Returns the full tuning allocation state for a robot, including pool
 * metadata (size, allocated, remaining) and per-attribute maximums.
 */
router.get(
  '/:id/tuning-allocation',
  authenticateToken,
  validateRequest({ params: tuningParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const robotId = Number(req.params.id);
    const state = await getTuningAllocation(robotId, req.user.userId);

    res.json(state);
  },
);

/**
 * PUT /api/robots/:id/tuning-allocation
 *
 * Accepts a partial record of attribute → numeric value, validates
 * constraints (pool budget, per-attribute max), persists the allocation,
 * and returns the updated state.
 */
router.put(
  '/:id/tuning-allocation',
  authenticateToken,
  validateRequest({ params: tuningParamsSchema, body: tuningBodySchema }),
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AuthError(AuthErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const robotId = Number(req.params.id);
    const allocations = req.body as Partial<Record<RobotAttribute, number>>;
    const state = await setTuningAllocation(robotId, req.user.userId, allocations);

    let achievementUnlocks: UnlockedAchievement[] = [];
    try {
      achievementUnlocks = await achievementService.checkAndAward(req.user.userId, robotId, {
        type: 'tuning_allocated',
        data: { robotId, allocations },
      });
    } catch { /* achievement failures don't block */ }

    res.json({ ...state, achievementUnlocks });
  },
);

export default router;
