/**
 * Admin Analytics & Dashboard Routes
 *
 * System stats, KPIs, engagement, economy, league health, achievement/tuning analytics.
 * (Weapons moved to the "what wins" analyses: GET /api/admin/analysis/weapons.)
 * Mounted at /api/admin/ from the main admin router.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import logger from '../config/logger';
import { buildUserFilter, USER_FILTER_TYPES } from '../utils/buildUserFilter';
import type { UserFilterType } from '../utils/buildUserFilter';
import {
  getSystemStats,
  getDashboardKpis,
  getAchievementAnalytics,
  getTuningAdoption,
  getRefinementAdoption,
} from '../services/admin/adminStatsService';
import {
  getLeagueHealthOverview,
  getLeagueSeason,
  LEAGUE_SEASON_STABLE_FILTERS,
} from '../services/admin/league-health';
import { TIERED_LEAGUE_MODES } from '../services/league/league-rules';
import { ECONOMY_STABLE_SCOPES, ECONOMY_WINDOWS, getEconomyOverview } from '../services/admin/adminEconomyService';
import { getDashboardStatus } from '../services/admin/adminDashboardStatusService';
import { getBattleActivity } from '../services/admin/adminBattleActivityService';
import {
  getSearchAnalyticsReport,
  SEARCH_ANALYTICS_REPORT_DEFAULT_LIMIT,
  SEARCH_ANALYTICS_REPORT_DEFAULT_PAGE,
  SEARCH_ANALYTICS_REPORT_MAX_CYCLE,
  SEARCH_ANALYTICS_REPORT_MAX_LIMIT,
  SEARCH_ANALYTICS_REPORT_MAX_PAGE,
} from '../services/search/searchAnalyticsReportService';
import {
  exportSearchAnalyticsPhrasesCsv,
  getSearchAnalyticsPhrases,
  SEARCH_PHRASES_DEFAULT_LIMIT,
  SEARCH_PHRASES_MAX_LIMIT,
  SEARCH_PHRASES_MAX_PAGE,
} from '../services/search/searchAnalyticsPhraseService';
import { MAXIMUM_QUERY_LENGTH } from '../services/search/searchTypes';

const router = express.Router();

// --- Zod schemas ---

const statsQuerySchema = z.object({
  filter: z.enum(USER_FILTER_TYPES).optional().default('real'),
});

const dashboardKpisQuerySchema = z.object({
  filter: z.enum(USER_FILTER_TYPES).optional().default('real'),
});

const dashboardBattleActivityQuerySchema = z.object({
  filter: z.enum(USER_FILTER_TYPES).optional().default('real'),
  /** `true` bypasses the 60 s cache (the dashboard's Refresh button). */
  fresh: z.enum(['true', 'false']).optional().default('false'),
});

const economyQuerySchema = z.object({
  stables: z.enum(ECONOMY_STABLE_SCOPES).optional().default('players'),
  window: z.enum(ECONOMY_WINDOWS).optional().default('7'),
  fresh: z.enum(['true', 'false']).optional(),
});

const achievementAnalyticsQuerySchema = z.object({
  filter: z.enum(USER_FILTER_TYPES).optional().default('real'),
});

const tuningAdoptionQuerySchema = z.object({
  filter: z.enum(USER_FILTER_TYPES).optional().default('real'),
});

const leagueSeasonQuerySchema = z.object({
  mode: z.enum(TIERED_LEAGUE_MODES).optional().default('league_1v1'),
  stable: z.enum(LEAGUE_SEASON_STABLE_FILTERS).optional().default('all'),
});

const refinementAdoptionQuerySchema = z.object({
  filter: z.enum(USER_FILTER_TYPES).optional().default('real'),
});

const searchAnalyticsCycleRange = (value: { cycleFrom?: number; cycleTo?: number; lastCycles?: number }, context: z.RefinementCtx): void => {
  if (value.lastCycles !== undefined && (value.cycleFrom !== undefined || value.cycleTo !== undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lastCycles'],
      message: 'lastCycles cannot be combined with cycleFrom or cycleTo',
    });
  }
  if (value.cycleFrom !== undefined && value.cycleTo !== undefined && value.cycleFrom > value.cycleTo) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cycleFrom'],
      message: 'cycleFrom cannot be greater than cycleTo',
    });
  }
};

const searchAnalyticsCycleField = z.coerce.number().int().min(0).max(SEARCH_ANALYTICS_REPORT_MAX_CYCLE).optional();
const searchAnalyticsModeField = z.enum(['settled', 'all']).optional().default('settled');
/** "This cycle" (1) / "Last 7 cycles" (7) presets, resolved on the server. */
const searchAnalyticsLastCyclesField = z.coerce.number().int().min(1).max(SEARCH_ANALYTICS_REPORT_MAX_CYCLE).optional();

const searchAnalyticsReportQuerySchema = z.object({
  cycleFrom: searchAnalyticsCycleField,
  cycleTo: searchAnalyticsCycleField,
  lastCycles: searchAnalyticsLastCyclesField,
  page: z.coerce.number().int().positive().max(SEARCH_ANALYTICS_REPORT_MAX_PAGE).default(SEARCH_ANALYTICS_REPORT_DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(SEARCH_ANALYTICS_REPORT_MAX_LIMIT).default(SEARCH_ANALYTICS_REPORT_DEFAULT_LIMIT),
  mode: searchAnalyticsModeField,
}).strict().superRefine(searchAnalyticsCycleRange);

const searchAnalyticsPhraseFilterFields = {
  cycleFrom: searchAnalyticsCycleField,
  cycleTo: searchAnalyticsCycleField,
  lastCycles: searchAnalyticsLastCyclesField,
  mode: searchAnalyticsModeField,
  tab: z.enum(['all', 'noResult']).optional().default('all'),
  q: z.string().trim().max(MAXIMUM_QUERY_LENGTH).optional(),
};

const searchAnalyticsPhrasesQuerySchema = z.object({
  ...searchAnalyticsPhraseFilterFields,
  page: z.coerce.number().int().positive().max(SEARCH_PHRASES_MAX_PAGE).default(1),
  limit: z.coerce.number().int().positive().max(SEARCH_PHRASES_MAX_LIMIT).default(SEARCH_PHRASES_DEFAULT_LIMIT),
}).strict().superRefine(searchAnalyticsCycleRange);

const searchAnalyticsPhrasesExportQuerySchema = z.object(searchAnalyticsPhraseFilterFields)
  .strict()
  .superRefine(searchAnalyticsCycleRange);

// --- Routes ---

/**
 * GET /api/admin/stats
 * Get system statistics
 */
router.get('/stats', authenticateToken, requireAdmin, validateRequest({ query: statsQuerySchema }), async (req: Request, res: Response) => {
  try {
    const filter = (req.query.filter as UserFilterType) || 'real';
    const userFilter = buildUserFilter(filter);
    const stats = await getSystemStats(userFilter);
    res.json(stats);
  } catch (error) {
    logger.error('[Admin] Stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve stats',
    });
  }
});

/**
 * GET /api/admin/dashboard/kpis
 * Get high-level KPI metrics for the admin dashboard.
 */
router.get('/dashboard/kpis', authenticateToken, requireAdmin, validateRequest({ query: dashboardKpisQuerySchema }), async (req: Request, res: Response) => {
  const filter = (req.query.filter as UserFilterType) || 'real';
  const userFilter = buildUserFilter(filter);
  const kpis = await getDashboardKpis(userFilter);
  res.json(kpis);
});

/**
 * GET /api/admin/dashboard/status
 * Status strip and "Needs attention" facts. System-wide: takes no filter.
 */
router.get('/dashboard/status', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  res.json(await getDashboardStatus());
});

/**
 * GET /api/admin/dashboard/battle-activity
 * Battles per mode (last cycle, season, walkovers, queued, rates).
 */
router.get('/dashboard/battle-activity', authenticateToken, requireAdmin, validateRequest({ query: dashboardBattleActivityQuerySchema }), async (req: Request, res: Response) => {
  const filter = (req.query.filter as UserFilterType) || 'real';
  const fresh = req.query.fresh === 'true';
  res.json(await getBattleActivity(filter, { fresh }));
});

/**
 * GET /api/admin/economy
 * Credit flows (sources and sinks from the ledger), earned vs spent per
 * cycle, balance bands and the per-stable-type table (Economy page).
 */
router.get('/economy', authenticateToken, requireAdmin, validateRequest({ query: economyQuerySchema }), async (req: Request, res: Response) => {
  const query = req.query as unknown as z.infer<typeof economyQuerySchema>;
  res.json(await getEconomyOverview(query.stables, query.window, { fresh: query.fresh === 'true' }));
});
/**
 * GET /api/admin/league-health
 * Every tiered league (1v1, 2v2, 3v3, Tag Team, KotH, Grand Melee): tiers,
 * instances, stable mix, and what the next rebalance would do, plus a
 * "Needs attention" list. Read-only.
 */
router.get('/league-health', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  const result = await getLeagueHealthOverview();
  res.json(result);
});

/**
 * GET /api/admin/league-health/season
 * This season's promotions and demotions of one mode (`mode`, default
 * league_1v1) for one stable type (`stable`: all | human | automaton |
 * generated): per cycle, quiet cycles, and per tier boundary with the
 * bounce-back share. Read-only, from `league_history`.
 */
router.get('/league-health/season', authenticateToken, requireAdmin, validateRequest({ query: leagueSeasonQuerySchema }), async (req: Request, res: Response) => {
  const query = leagueSeasonQuerySchema.parse(req.query);
  res.json(await getLeagueSeason(query.mode, query.stable));
});

/**
 * GET /api/admin/achievements/analytics
 * Get achievement analytics data.
 */
router.get('/achievements/analytics', authenticateToken, requireAdmin, validateRequest({ query: achievementAnalyticsQuerySchema }), async (req: Request, res: Response) => {
  const filter = (req.query.filter as UserFilterType) || 'real';
  const userFilter = buildUserFilter(filter);
  const result = await getAchievementAnalytics(userFilter);
  res.json(result);
});

/**
 * GET /api/admin/tuning/adoption
 * Get tuning system adoption metrics.
 */
router.get('/tuning/adoption', authenticateToken, requireAdmin, validateRequest({ query: tuningAdoptionQuerySchema }), async (req: Request, res: Response) => {
  const filter = (req.query.filter as UserFilterType) || 'real';
  const userFilter = buildUserFilter(filter);
  const result = await getTuningAdoption(userFilter);
  res.json(result);
});

/**
 * GET /api/admin/refinement/adoption
 * Get weapon refinement adoption metrics (Spec #34).
 */
router.get('/refinement/adoption', authenticateToken, requireAdmin, validateRequest({ query: refinementAdoptionQuerySchema }), async (req: Request, res: Response) => {
  const filter = (req.query.filter as UserFilterType) || 'real';
  const userFilter = buildUserFilter(filter);
  const result = await getRefinementAdoption(userFilter);
  res.json(result);
});

router.get('/search-analytics/report', authenticateToken, requireAdmin, validateRequest({ query: searchAnalyticsReportQuerySchema }), async (req: Request, res: Response) => {
  const query = searchAnalyticsReportQuerySchema.parse(req.query);
  const report = await getSearchAnalyticsReport(query);
  res.json(report);
});

/**
 * GET /api/admin/search-analytics/phrases
 * Paginated phrase table (settled searches by default).
 */
router.get('/search-analytics/phrases', authenticateToken, requireAdmin, validateRequest({ query: searchAnalyticsPhrasesQuerySchema }), async (req: Request, res: Response) => {
  const query = searchAnalyticsPhrasesQuerySchema.parse(req.query);
  res.json(await getSearchAnalyticsPhrases(query));
});

/**
 * GET /api/admin/search-analytics/phrases/export
 * The same phrase table as CSV (capped at 5,000 rows; spreadsheet formulas neutralised).
 */
router.get('/search-analytics/phrases/export', authenticateToken, requireAdmin, validateRequest({ query: searchAnalyticsPhrasesExportQuerySchema }), async (req: Request, res: Response) => {
  const query = searchAnalyticsPhrasesExportQuerySchema.parse(req.query);
  const csv = await exportSearchAnalyticsPhrasesCsv(query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="search-phrases.csv"');
  res.setHeader('Cache-Control', 'no-store');
  res.send(csv);
});

export default router;
