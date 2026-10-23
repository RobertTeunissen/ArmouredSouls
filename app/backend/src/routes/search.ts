import express, { type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { searchQuerySchema } from '../schemas/search';
import { AppError } from '../errors';
import {
  getActiveSearchSeasonContext,
  searchAnalyticsService,
} from '../services/search/searchAnalyticsService';
import searchService from '../services/search/searchService';
import { MINIMUM_QUERY_LENGTH } from '../services/search/searchTypes';
import type { ActiveSeasonContext } from '../services/search/searchAnalyticsTypes';
import { searchSelectionBodySchema } from '../schemas/search';
import { recordSearchSelection } from '../services/search/searchSelectionService';
import type { SearchSelectionCategory } from '../services/search/searchTypes';

const router = express.Router();

/**
 * POST /api/search/selection — privacy-light selection telemetry.
 *
 * Body: `{ category }` only. Always 204 with no body, whether or not a recent
 * search was found, so the endpoint reveals nothing. Covered by the per-user
 * limiter mounted on `/api/search`.
 */
router.post(
  '/selection',
  authenticateToken,
  validateRequest({ body: searchSelectionBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const authenticatedUser = req.user;
    if (!authenticatedUser || !Number.isSafeInteger(authenticatedUser.userId) || authenticatedUser.userId <= 0) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const { category } = req.body as { category: SearchSelectionCategory };
    await recordSearchSelection(authenticatedUser.userId, category);
    res.status(204).end();
  },
);

router.get(
  '/',
  authenticateToken,
  validateRequest({ query: searchQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const rawQuery: unknown = req.query.q;
    const authenticatedUser = req.user;
    if (typeof rawQuery !== 'string') {
      throw new AppError('VALIDATION_ERROR', 'Search query must be a string', 400);
    }
    if (!authenticatedUser || !Number.isSafeInteger(authenticatedUser.userId) || authenticatedUser.userId <= 0) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const q = rawQuery;
    const userId = authenticatedUser.userId;
    const response = await searchService.search(q);

    if (q.length < MINIMUM_QUERY_LENGTH) {
      res.json(response);
      return;
    }

    try {
      const activeSeasonContext: ActiveSeasonContext = await getActiveSearchSeasonContext();
      await searchAnalyticsService.recordExecutedSearch({
        response,
        normalizedPhrase: q,
        activeSeasonContext,
        userId,
      });
    } catch {
      // Every failure after the player response has been computed belongs to
      // the telemetry boundary. This includes season-context lookup,
      // persistence, failure-marker writes, and diagnostic logging. None may
      // turn a successful search into an HTTP 500 or expose sensitive details.
      try {
        searchAnalyticsService.recordTelemetryFailure({ response, userId });
      } catch {
        // Telemetry diagnostics are best-effort and must remain response-isolated.
      }
    }

    // Analytics is response-isolated: no telemetry status, phrase, or context
    // is added to the player response, including on any telemetry failure.
    res.json(response);
  },
);

export default router;
