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

const router = express.Router();

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

    let activeSeasonContext: ActiveSeasonContext;
    try {
      activeSeasonContext = await getActiveSearchSeasonContext();
    } catch {
      searchAnalyticsService.recordTelemetryFailure({
        response,
        userId,
      });
      res.json(response);
      return;
    }

    const analyticsResult = await searchAnalyticsService.recordExecutedSearch({
      response,
      normalizedPhrase: q,
      activeSeasonContext,
      userId,
    });

    // Analytics is response-isolated: no telemetry status, phrase, or context
    // is added to the player response, including on persistence failure.
    res.json(analyticsResult.response);
  },
);

export default router;
