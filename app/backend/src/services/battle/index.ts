// Battle domain barrel file — re-exports the public API

// Base orchestrator (shared utilities for all battle modes)
export { getCurrentCycleNumber } from './baseOrchestrator';
export type { BattleContext, BattleRecordRef } from './baseOrchestrator';

// Combat simulation
export {
  simulateBattle,
  simulateBattleMulti,
  clamp,
  random,
  getEffectiveAttribute,
  calculateHitChance,
  calculateCritChance,
  calculateMalfunctionChance,
  calculateBaseDamage,
  applyDamage,
  getWeaponInfo,
  BASE_WEAPON_COOLDOWN,
  ARMOR_EFFECTIVENESS,
  PENETRATION_BONUS,
} from './combatSimulator';
export type {
  RobotWithWeapons,
  CombatEvent,
  FormulaBreakdown,
  CombatResult,
  BattleConfig,
} from './combatSimulator';

// Battle strategy (processor pattern)
export { BattleProcessor } from './battleStrategy';
export type {
  BattleStrategy,
  LoadedParticipant,
  SimulationResult,
  ParticipantReward,
  ExtraBattleFields,
  ExtraParticipantFields,
} from './battleStrategy';

// Post-combat processing
export {
  awardStreamingRevenueForParticipant,
  logBattleAuditEvent,
  updateRobotCombatStats,
  awardCreditsToUser,
  awardPrestigeToUser,
  awardFameToRobot,
} from './battlePostCombat';
export type {
  ParticipantOutcome,
  AuditEventExtras,
  RobotStatUpdateOptions,
} from './battlePostCombat';

// Combat message generation
export { CombatMessageGenerator } from './combatMessageGenerator';
export type {
  BattleStartEvent,
  AttackEvent,
  BattleEndEvent,
  ELOChangeEvent,
  RewardEvent,
  TagOutEvent,
  TagInEvent,
} from './combatMessageGenerator';
