/**
 * Admin Analytics & Dashboard Routes
 *
 * System stats, KPIs, engagement, economy, league health, weapon/achievement/tuning analytics,
 * and league history endpoints.
 * Mounted at /api/admin/ from the main admin router.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import logger from '../config/logger';
import { buildUserFilter } from '../utils/buildUserFilter';
import type { UserFilterType } from '../utils/buildUserFilter';
import {
  getSystemStats,
  getRobotAttributeStats,
  getDashboardKpis,
  getEngagementPlayers,
  getEconomyOverview,
  getLeagueHealth,
  getTeamBattleLeagueHealth,
  getTagTeamLeagueHealth,
  getWeaponAnalytics,
  getAchievementAnalytics,
  getTuningAdoption,
  getRefinementAdoption,
} from '../services/admin/adminStatsService';
import {
  getHistoryByCycleRange,
  getAggregates,
  getEntityHistory,
  detectYoYoCandidates,
} from '../services/league/leagueHistoryService';

const router = express.Router();

// --- Zod schemas ---

const statsQuerySchema = z.object({
  filter: z.enum(['all', 'real', 'auto']).optional().default('real'),
});

const dashboardKpisQuerySchema = z.object({
  filter: z.enum(['all', 'real', 'auto']).optional().default('real'),
});

const engagementPlayersQuerySchema = z.object({
  filter: z.enum(['all', 'real', 'auto']).optional().default('real'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

const weaponAnalyticsQuerySchema = z.object({
  filter: z.enum(['all', 'real', 'auto']).optional().default('real'),
});

const achievementAnalyticsQuerySchema = z.object({
  filter: z.enum(['all', 'real', 'auto']).optional().default('real'),
});

const tuningAdoptionQuerySchema = z.object({
  filter: z.enum(['all', 'real', 'auto']).optional().default('real'),
});

const refinementAdoptionQuerySchema = z.object({
  filter: z.enum(['all', 'real', 'auto']).optional().default('real'),
});

const leagueHistoryQuerySchema = z.object({
  startCycle: z.coerce.number().int().positive(),
  endCycle: z.coerce.number().int().positive(),
  entityType: z.enum(['robot', 'tag_team']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  perPage: z.coerce.number().int().positive().max(100).optional().default(50),
});

const leagueHistoryAggregatesSchema = z.object({
  startCycle: z.coerce.number().int().positive(),
  endCycle: z.coerce.number().int().positive(),
  entityType: z.enum(['robot', 'tag_team']).optional(),
});

const leagueHistoryEntitySchema = z.object({
  entityType: z.enum(['robot', 'tag_team']),
  entityId: positiveIntParam,
});

const leagueHistoryYoYoSchema = z.object({
  cycleWindow: z.coerce.number().int().positive().optional().default(20),
  minChanges: z.coerce.number().int().min(2).optional().default(3),
});

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
 * GET /api/admin/stats/robots
 * Get comprehensive statistics about robot attributes for debugging and outlier detection
 */
router.get('/stats/robots', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    const result = await getRobotAttributeStats();
    res.json(result);
  } catch (error) {
    logger.error('[Admin] Robot stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve robot statistics',
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
 * GET /api/admin/engagement/players
 * Get player engagement data with churn risk classification.
 */
router.get('/engagement/players', authenticateToken, requireAdmin, validateRequest({ query: engagementPlayersQuerySchema }), async (req: Request, res: Response) => {
  const filter = (req.query.filter as UserFilterType) || 'real';
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const userFilter = buildUserFilter(filter);
  const result = await getEngagementPlayers(userFilter, page, limit);
  res.json(result);
});

/**
 * GET /api/admin/economy/overview
 * Get economy overview metrics.
 */
router.get('/economy/overview', authenticateToken, requireAdmin, validateRequest({ query: dashboardKpisQuerySchema }), async (req: Request, res: Response) => {
  const filter = (req.query.filter as UserFilterType) || 'real';
  const userFilter = buildUserFilter(filter);
  const result = await getEconomyOverview(userFilter);
  res.json(result);
});

/**
 * GET /api/admin/league-health
 * Get league health metrics.
 */
router.get('/league-health', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  const result = await getLeagueHealth();
  res.json(result);
});

/**
 * GET /api/admin/team-battle-league-health
 * Get team battle (2v2 and 3v3) league health metrics.
 */
router.get('/team-battle-league-health', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  const result = await getTeamBattleLeagueHealth();
  res.json(result);
});

/**
 * GET /api/admin/tag-team-league-health
 * Get tag team league health metrics for 2v2 teams.
 */
router.get('/tag-team-league-health', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  const result = await getTagTeamLeagueHealth();
  res.json(result);
});

/**
 * GET /api/admin/weapons/analytics
 * Get weapon analytics data.
 */
router.get('/weapons/analytics', authenticateToken, requireAdmin, validateRequest({ query: weaponAnalyticsQuerySchema }), async (req: Request, res: Response) => {
  const filter = (req.query.filter as UserFilterType) || 'real';
  const userFilter = buildUserFilter(filter);
  const result = await getWeaponAnalytics(userFilter);
  res.json(result);
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

/**
 * GET /api/admin/league-history
 * Paginated tier changes by cycle range.
 */
router.get('/league-history', authenticateToken, requireAdmin, validateRequest({ query: leagueHistoryQuerySchema }), async (req: Request, res: Response) => {
  const startCycle = Number(req.query.startCycle);
  const endCycle = Number(req.query.endCycle);
  const entityType = req.query.entityType as string | undefined;
  const page = req.query.page ? Number(req.query.page) : 1;
  const perPage = req.query.perPage ? Number(req.query.perPage) : 50;
  const result = await getHistoryByCycleRange({ startCycle, endCycle, entityType: entityType as 'robot' | 'tag_team' | undefined, page, perPage });
  res.json(result);
});

/**
 * GET /api/admin/league-history/aggregates
 * Promotion/demotion counts by tier for a cycle range.
 */
router.get('/league-history/aggregates', authenticateToken, requireAdmin, validateRequest({ query: leagueHistoryAggregatesSchema }), async (req: Request, res: Response) => {
  const startCycle = Number(req.query.startCycle);
  const endCycle = Number(req.query.endCycle);
  const entityType = req.query.entityType as string | undefined;
  const result = await getAggregates(startCycle, endCycle, entityType as 'robot' | 'tag_team' | undefined);
  res.json(result);
});

/**
 * GET /api/admin/league-history/entity/:entityType/:entityId
 * Full history for one entity.
 */
router.get('/league-history/entity/:entityType/:entityId', authenticateToken, requireAdmin, validateRequest({ params: leagueHistoryEntitySchema }), async (req: Request, res: Response) => {
  const entityType = req.params.entityType as 'robot' | 'tag_team';
  const entityId = Number(req.params.entityId);
  const data = await getEntityHistory(entityType, entityId);
  res.json({ data });
});

/**
 * GET /api/admin/league-history/yo-yo
 * Yo-yo detection candidates.
 */
router.get('/league-history/yo-yo', authenticateToken, requireAdmin, validateRequest({ query: leagueHistoryYoYoSchema }), async (req: Request, res: Response) => {
  const cycleWindow = req.query.cycleWindow ? Number(req.query.cycleWindow) : 20;
  const minChanges = req.query.minChanges ? Number(req.query.minChanges) : 3;
  const result = await detectYoYoCandidates(cycleWindow, minChanges);
  res.json(result);
});

export default router;
