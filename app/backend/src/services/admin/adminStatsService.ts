/**
 * Admin Stats Service — Barrel Export
 *
 * Re-exports all admin statistics functions from focused sub-modules.
 * Split for maintainability (original was 1872 lines).
 */

export { getWeaponStats, getStanceStats, getLoadoutStats, getYieldThresholdStats, mapRobotAttributes, calculateStats, getSystemStats, getAtRiskUsers, getRobotAttributeStats, getRecentUserActivity, getRepairAuditLog } from './adminSystemStatsService';
export { getDashboardKpis, classifyChurnRisk, getEngagementPlayers, getEconomyOverview } from './adminDashboardService';
export { getLeagueHealth, getTeamBattleLeagueHealth, getTagTeamLeagueHealth } from './adminLeagueHealthService';
export { getWeaponAnalytics, getAchievementAnalytics, getTuningAdoption, getRefinementAdoption } from './adminFeatureAnalyticsService';
