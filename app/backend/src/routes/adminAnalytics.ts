/**
 * Admin Analytics & Dashboard Routes
 *
 * Dashboard KPIs and battle activity, economy, league health, achievements, and
 * the Meta page (choices; build sections: tuning, refinements, event entry).
 * Pages that split by stable type take `stables=players|automatons|generated|all`
 * (`utils/stableScope.ts`).
 * (Weapons moved to the "what wins" analyses: GET /api/admin/analysis/weapons.)
 * Mounted at /api/admin/ from the main admin router.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateRequest, validated } from '../middleware/schemaValidator';
import { buildStableScopeFilter, STABLE_SCOPES } from '../utils/stableScope';
import { getDashboardKpis } from '../services/admin/adminDashboardService';
import { ACHIEVEMENT_STABLE_SCOPES, getAchievementAnalytics } from '../services/admin/achievements';
import { getMetaBuilds, getMetaChoices } from '../services/admin/meta';
import {
  getLeagueHealthOverview,
  getLeagueSeason,
  type LeagueSeasonStableFilter,
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

const stableScopeQuerySchema = z.object({
  stables: z.enum(STABLE_SCOPES).optional().default('players'),
});

const dashboardBattleActivityQuerySchema = z.object({
  stables: z.enum(STABLE_SCOPES).optional().default('players'),
  /** `true` bypasses the 60 s cache (the dashboard's Refresh button). */
  fresh: z.enum(['true', 'false']).optional().default('false'),
});

const economyQuerySchema = z.object({
  stables: z.enum(ECONOMY_STABLE_SCOPES).optional().default('players'),
  window: z.enum(ECONOMY_WINDOWS).optional().default('7'),
  fresh: z.enum(['true', 'false']).optional(),
});

const achievementAnalyticsQuerySchema = z.object({
  stables: z.enum(ACHIEVEMENT_STABLE_SCOPES).optional().default('players'),
});

const leagueSeasonQuerySchema = z.object({
  mode: z.enum(TIERED_LEAGUE_MODES).optional().default('league_1v1'),
  stables: z.enum(STABLE_SCOPES).optional().default('all'),
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

/** League history splits by `users.stable_type`; Players = human stables. */
const LEAGUE_SEASON_STABLE_OF: Readonly<Record<(typeof STABLE_SCOPES)[number], LeagueSeasonStableFilter>> = {
  players: 'human',
  automatons: 'automaton',
  generated: 'generated',
  all: 'all',
};

// --- Routes ---

/**
 * GET /api/admin/dashboard/kpis
 * Get high-level KPI metrics for the admin dashboard.
 */
router.get('/dashboard/kpis', authenticateToken, requireAdmin, ...validated({ query: stableScopeQuerySchema }, async (req: Request, res: Response, { query }) => {
  res.json(await getDashboardKpis(buildStableScopeFilter(query.stables)));
}));

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
router.get('/dashboard/battle-activity', authenticateToken, requireAdmin, ...validated({ query: dashboardBattleActivityQuerySchema }, async (req: Request, res: Response, { query }) => {
  res.json(await getBattleActivity(query.stables, { fresh: query.fresh === 'true' }));
}));

/**
 * GET /api/admin/economy
 * Credit flows (sources and sinks from the ledger), earned vs spent per
 * cycle, balance bands and the per-stable-type table (Economy page).
 */
router.get('/economy', authenticateToken, requireAdmin, ...validated({ query: economyQuerySchema }, async (req: Request, res: Response, { query }) => {
  res.json(await getEconomyOverview(query.stables, query.window, { fresh: query.fresh === 'true' }));
}));
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
 * league_1v1) for one stable type (`stables`: all (default) | players |
 * automatons | generated): per cycle, quiet cycles, and per tier boundary with the
 * bounce-back share. Read-only, from `league_history`.
 */
router.get('/league-health/season', authenticateToken, requireAdmin, ...validated({ query: leagueSeasonQuerySchema }, async (req: Request, res: Response, { query }) => {
  res.json(await getLeagueSeason(query.mode, LEAGUE_SEASON_STABLE_OF[query.stables]));
}));

/**
 * GET /api/admin/achievements/analytics
 * This season's unlocks per achievement for one stable type (`stables`:
 * players | automatons | generated, default players). Player rates are out of
 * the players who logged in since the season started. Read-only.
 */
router.get('/achievements/analytics', authenticateToken, requireAdmin, ...validated({ query: achievementAnalyticsQuerySchema }, async (req: Request, res: Response, { query }) => {
  res.json(await getAchievementAnalytics(query.stables));
}));

/**
 * GET /api/admin/meta/choices
 * The choice sections of the Meta page (stances, loadouts, yield thresholds,
 * weapon totals, facility ownership) for the selected stable type. Replaced
 * `GET /api/admin/stats`. Read-only.
 */
router.get('/meta/choices', authenticateToken, requireAdmin, ...validated({ query: stableScopeQuerySchema }, async (req: Request, res: Response, { query }) => {
  res.json(await getMetaChoices(buildStableScopeFilter(query.stables)));
}));

/**
 * GET /api/admin/meta/builds
 * The Tuning, Refinements and Event entry sections of the Meta page for the
 * selected stable type (`stables`, default players). Read-only.
 */
router.get('/meta/builds', authenticateToken, requireAdmin, ...validated({ query: stableScopeQuerySchema }, async (req: Request, res: Response, { query }) => {
  res.json(await getMetaBuilds(buildStableScopeFilter(query.stables)));
}));

router.get('/search-analytics/report', authenticateToken, requireAdmin, ...validated({ query: searchAnalyticsReportQuerySchema }, async (req: Request, res: Response, { query }) => {
  const report = await getSearchAnalyticsReport(query);
  res.json(report);
}));

/**
 * GET /api/admin/search-analytics/phrases
 * Paginated phrase table (settled searches by default).
 */
router.get('/search-analytics/phrases', authenticateToken, requireAdmin, ...validated({ query: searchAnalyticsPhrasesQuerySchema }, async (req: Request, res: Response, { query }) => {
  res.json(await getSearchAnalyticsPhrases(query));
}));

/**
 * GET /api/admin/search-analytics/phrases/export
 * The same phrase table as CSV (capped at 5,000 rows; spreadsheet formulas neutralised).
 */
router.get('/search-analytics/phrases/export', authenticateToken, requireAdmin, ...validated({ query: searchAnalyticsPhrasesExportQuerySchema }, async (req: Request, res: Response, { query }) => {
  const csv = await exportSearchAnalyticsPhrasesCsv(query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="search-phrases.csv"');
  res.setHeader('Cache-Control', 'no-store');
  res.send(csv);
}));

export default router;
