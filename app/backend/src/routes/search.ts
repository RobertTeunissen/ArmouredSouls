import express, { type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { searchQuerySchema, type SearchQuery } from '../schemas/search';
import {
  getActiveSearchSeasonContext,
  searchAnalyticsService,
} from '../services/search/searchAnalyticsService';
import searchService from '../services/search/searchService';
import { MINIMUM_QUERY_LENGTH } from '../services/search/searchTypes';

const router = express.Router();

router.get(
  '/',
  authenticateToken,
  validateRequest({ query: searchQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const { q } = req.query as unknown as SearchQuery;
    const response = await searchService.search(q);

    if (q.length < MINIMUM_QUERY_LENGTH) {
      res.json(response);
      return;
    }

    const activeSeasonContext = await getActiveSearchSeasonContext();
    const analyticsResult = await searchAnalyticsService.recordExecutedSearch({
      response,
      normalizedPhrase: q,
      activeSeasonContext,
      userId: req.user!.userId,
    });

    // Analytics is response-isolated: no telemetry status, phrase, or context
    // is added to the player response, including on persistence failure.
    res.json(analyticsResult.response);
  },
);

export default router;
