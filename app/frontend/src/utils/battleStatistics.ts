/**
 * Battle Statistics — Re-export from shared module.
 *
 * The computation logic lives in app/shared/utils/battleStatistics.ts (single source of truth).
 * This file preserves the existing import paths for all frontend consumers.
 * New code can import directly from '@shared/utils/battleStatistics'.
 */

export {
  computeBattleStatistics,
  createRobotStats,
  type BattleLogEvent,
  type BattleStatistics,
  type RobotCombatStats,
  type TeamCombatStats,
  type DamageFlow,
  type HandStats,
  type CounterStats,
  type HitGrades,
} from '@shared/utils/battleStatistics';
