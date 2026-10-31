/**
 * Admin Stats Service — Barrel Export
 *
 * Re-exports all admin statistics functions from focused sub-modules.
 * Split for maintainability (original was 1872 lines).
 */

export { getWeaponStats, getStanceStats, getLoadoutStats, getYieldThresholdStats, mapRobotAttributes, calculateStats, getSystemStats, getRepairAuditLog } from './adminSystemStatsService';
export { getDashboardKpis } from './adminDashboardService';
export { getAchievementAnalytics, getTuningAdoption, getRefinementAdoption } from './adminFeatureAnalyticsService';
