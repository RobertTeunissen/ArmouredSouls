import express, { Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { KeyedCache } from '../lib/keyedCache';
import {
  financeReportPeriodQuerySchema,
  financeRobotDetailParamsSchema,
  financeRobotEventsQuerySchema,
  type FinanceReportPeriodQuery,
  type FinanceRobotEventsQuery,
} from '../schemas/financeReportSchemas';
import { financeReportQueryService } from '../services/financial/financeReportQueryService';
import { financeReportTrendService } from '../services/financial/financeReportTrendService';
import { robotDeploymentQueryService } from '../services/financial/robotDeploymentQueryService';
import { resolveCanonicalCycleIdentity } from '../services/cycle/canonicalCycleIdentity';
import { securityMonitor } from '../services/security/securityMonitor';
import { getFinancialSummary } from '../services/economy/financialSummaryService';

const router = express.Router();

// Finance responses contain only player-safe projections. Keep the cache private
// and key it by the authenticated stable plus canonical active-season identity so
// a repeated cycle number after rollover can never reuse a prior season response.
const financeReportCache = new KeyedCache<unknown>(15_000, 500);

const FINANCE_REFRESH_WINDOW_MS = 60_000;
const FINANCE_REFRESH_MAX_REQUESTS = 30;

type FinanceResource = 'overview' | 'history' | 'robots' | 'robot-events';

function selectionCacheFragment(selection: FinanceReportPeriodQuery): string {
  return selection.scope ?? `${selection.fromCycle}-${selection.toCycle}`;
}

function hasNoCacheDirective(headerValue: string | undefined): boolean {
  return headerValue?.split(',').some((directive) => directive.trim().toLowerCase() === 'no-cache') ?? false;
}

function shouldRefreshCurrentReport(req: AuthRequest): boolean {
  const selection = req.query as unknown as FinanceReportPeriodQuery;
  return selection.scope === 'current' && hasNoCacheDirective(req.get('Cache-Control'));
}

const financeRefreshRateLimiter = rateLimit({
  windowMs: FINANCE_REFRESH_WINDOW_MS,
  max: FINANCE_REFRESH_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `finance-refresh:${authReq.user?.userId?.toString() || req.ip || 'unknown'}`;
  },
  skip: (req) => !shouldRefreshCurrentReport(req as AuthRequest),
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.userId) {
      securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
    }
    res.status(429).json({
      error: 'Too many Finance Center refresh requests. Try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: FINANCE_REFRESH_WINDOW_MS / 1000,
    });
  },
});

async function financeCacheKey(
  userId: number,
  resource: FinanceResource,
  selection: FinanceReportPeriodQuery,
  detail = '',
): Promise<string> {
  const identity = await resolveCanonicalCycleIdentity();
  return [
    'finance-v1',
    userId,
    identity.seasonNumber,
    identity.activeCycle,
    resource,
    selectionCacheFragment(selection),
    detail,
  ].join(':');
}

async function respondWithCachedFinanceReport(
  res: Response,
  cacheKey: string,
  load: () => Promise<unknown>,
  bypassCache: boolean,
): Promise<void> {
  if (!bypassCache) {
    const cached = financeReportCache.get(cacheKey);
    if (cached !== null) {
      res.set('Cache-Control', 'private, max-age=15');
      res.json(cached);
      return;
    }
  }
  const response = await load();
  financeReportCache.set(cacheKey, response);
  res.set('Cache-Control', 'private, max-age=15');
  res.json(response);
}

// --- Versioned Finance Center routes ---

/** GET /api/finances/report — reconciled overview for the JWT stable. */
router.get(
  '/report',
  authenticateToken,
  validateRequest({ query: financeReportPeriodQuerySchema }),
  financeRefreshRateLimiter,
  async (req: AuthRequest, res: Response) => {
    const selection = req.query as unknown as FinanceReportPeriodQuery;
    const key = await financeCacheKey(req.user!.userId, 'overview', selection);
    await respondWithCachedFinanceReport(
      res,
      key,
      () => financeReportQueryService.getOverview(req.user!.userId, selection),
      shouldRefreshCurrentReport(req),
    );
  },
);

/** GET /api/finances/history — selected cycle trend and evidence-backed drivers. */
router.get(
  '/history',
  authenticateToken,
  validateRequest({ query: financeReportPeriodQuerySchema }),
  financeRefreshRateLimiter,
  async (req: AuthRequest, res: Response) => {
    const selection = req.query as unknown as FinanceReportPeriodQuery;
    const key = await financeCacheKey(req.user!.userId, 'history', selection);
    await respondWithCachedFinanceReport(
      res,
      key,
      () => financeReportTrendService.getHistory(req.user!.userId, selection),
      shouldRefreshCurrentReport(req),
    );
  },
);

/** GET /api/finances/robots — set-based direct financial summaries. */
router.get(
  '/robots',
  authenticateToken,
  validateRequest({ query: financeReportPeriodQuerySchema }),
  financeRefreshRateLimiter,
  async (req: AuthRequest, res: Response) => {
    const selection = req.query as unknown as FinanceReportPeriodQuery;
    const key = await financeCacheKey(req.user!.userId, 'robots', selection);
    await respondWithCachedFinanceReport(
      res,
      key,
      () => robotDeploymentQueryService.getSummaries(req.user!.userId, selection),
      shouldRefreshCurrentReport(req),
    );
  },
);

/** GET /api/finances/robots/:robotId/events — owned robot evidence, paginated. */
router.get(
  '/robots/:robotId/events',
  authenticateToken,
  validateRequest({
    params: financeRobotDetailParamsSchema,
    query: financeRobotEventsQuerySchema,
  }),
  financeRefreshRateLimiter,
  async (req: AuthRequest, res: Response) => {
    const { robotId } = req.params as unknown as { robotId: number };
    const query = req.query as unknown as FinanceRobotEventsQuery;
    const selection: FinanceReportPeriodQuery = {
      scope: query.scope,
      fromCycle: query.fromCycle,
      toCycle: query.toCycle,
    };
    const page = query.page;
    const pageSize = query.pageSize;
    const key = await financeCacheKey(req.user!.userId, 'robot-events', selection, `${robotId}:${page}:${pageSize}:occurred_at_desc_source_reference_asc`);
    await respondWithCachedFinanceReport(
      res,
      key,
      () => robotDeploymentQueryService.getEvents(req.user!.userId, robotId, selection, page, pageSize),
      shouldRefreshCurrentReport(req),
    );
  },
);


/**
 * GET /api/finances/summary
 * Get quick financial summary for dashboard
 */
router.get('/summary', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
    res.json(await getFinancialSummary(req.user!.userId));
});

export default router;
