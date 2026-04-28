export {
  mapBattleRecord,
  mapTagTeamRecord,
  buildTagTeamWhere,
  fetchTagTeamBattles,
  getAdminBattleList,
  getAdminBattleDetail,
  type BattleQueryParams,
  type BattleWithDetails,
  type TagTeamMatchWithBattle,
} from './adminBattleService';

export {
  getWeaponStats,
  getStanceStats,
  getLoadoutStats,
  getYieldThresholdStats,
  mapRobotAttributes,
  calculateStats,
  getSystemStats,
  getAtRiskUsers,
  getRobotAttributeStats,
  getRecentUserActivity,
  getRepairAuditLog,
  getDashboardKpis,
  classifyChurnRisk,
  getEngagementPlayers,
  getEconomyOverview,
  getLeagueHealth,
  getWeaponAnalytics,
  getAchievementAnalytics,
  getTuningAdoption,
} from './adminStatsService';

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
