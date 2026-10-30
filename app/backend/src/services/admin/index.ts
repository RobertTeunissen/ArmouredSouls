export {
  getAdminBattleList,
  getAdminBattleDetail,
  getAdminBattleLog,
  exportBattleText,
  exportBattleJson,
} from './battles';

export {
  getWeaponStats,
  getStanceStats,
  getLoadoutStats,
  getYieldThresholdStats,
  mapRobotAttributes,
  calculateStats,
  getSystemStats,
  getAtRiskUsers,
  getRecentUserActivity,
  getRepairAuditLog,
  getDashboardKpis,
  classifyChurnRisk,
  getEngagementPlayers,
  getEconomyOverview,
  getAchievementAnalytics,
  getTuningAdoption,
  getRefinementAdoption,
} from './adminStatsService';

export { getLeagueHealthOverview } from './league-health';

export {
  repairAllRobotsAdmin,
  recalculateAllRobotHP,
  type AdminRepairResult,
  type AdminRecalculateHPResult,
} from './adminMaintenanceService';

export {
  executeBulkCycles,
  backfillCycleSnapshots,
  type BulkCycleOptions,
  type BulkCycleResult,
  type CycleResult,
  type BackfillSnapshotsResult,
} from './adminCycleService';

export {
  recordAction as recordAuditAction,
  getEntries as getAuditEntries,
  type GetEntriesParams,
  type AuditLogEntry,
  type GetEntriesResult,
} from './adminAuditLogService';
