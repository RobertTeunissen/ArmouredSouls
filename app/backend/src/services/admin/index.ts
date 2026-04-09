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
