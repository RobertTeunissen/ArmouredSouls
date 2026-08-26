/**
 * Dashboard Cycle_Progress_Summary route — Spec #48 Requirement 8.
 *
 * Mounted at `/api/dashboard`, deliberately NOT under `/api/robots`: that router is
 * registered first and its `GET /:id` handler captures single-segment collection
 * paths through `positiveIntParam`, which is why the tuning-allocation endpoint
 * needed a two-segment path. A fresh base path avoids the shadowing entirely
 * (criterion 2).
 *
 * @module routes/dashboardCycle
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { getCycleProgressSummary } from '../services/dashboard/cycleProgressService';

const router = express.Router();

/**
 * No path parameter, no body, no required query field.
 *
 * Zod's default `.strip()` removes an unknown query field rather than rejecting the
 * request (criterion 3), so a stale bookmark carrying a dead query string still
 * works. The schema is present because the `custom-routes/require-validate-request`
 * ESLint rule requires every route to declare one.
 */
const currentCycleQuerySchema = z.object({});

router.get(
  '/current-cycle',
  authenticateToken,
  validateRequest({ query: currentCycleQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    // Identity from the token only. Any user identifier in params, query or body is
    // ignored rather than trusted (criterion 4).
    const summary = await getCycleProgressSummary(req.user!.userId);
    res.json(summary);
  },
);

export default router;
