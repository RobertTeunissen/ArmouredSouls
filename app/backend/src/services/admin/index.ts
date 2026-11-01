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
  getRepairAuditLog,
  getDashboardKpis,
} from './adminStatsService';

export { getAchievementAnalytics } from './achievements';
export { getMetaBuilds } from './meta';

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
