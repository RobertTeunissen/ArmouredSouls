// Arena domain barrel file — re-exports the public API

// Types
export type {
  RangeBand,
  ArenaConfig,
  ArenaZone,
  MovementIntent,
  ThreatScore,
  WeaponRangeMapping,
  RobotCombatState,
  CombatEvent,
  CombatResult,
  GameModeState,
  GameModeConfig,
  TargetPriorityStrategy,
  MovementIntentModifier,
  WinConditionEvaluator,
} from './types';
export { RANGE_BAND_BOUNDARIES, RANGE_PENALTY } from './types';

// Vector math
export type { Position, Vector2D } from './vector2d';
export {
  euclideanDistance,
  normalizeVector,
  rotateVector,
  lerp,
  clampMagnitude,
  angleBetween,
  normalizeAngle,
  sign,
} from './vector2d';

// Arena layout
export { createArena, calculateArenaRadius, calculateSpawnPositions, clampToArena } from './arenaLayout';

// Range bands
export { classifyRangeBand, getRangePenalty, getWeaponOptimalRange, canAttack } from './rangeBands';
export type { WeaponLike } from './rangeBands';

// Position tracking
export { checkBackstab, updateFacing, calculateTurnSpeed } from './positionTracker';

// Movement AI
export {
  calculateMovementIntent,
  applyMovement,
  getPreferredRange,
  getPatienceLimit,
  enforceTeamSeparation,
  RANGE_BAND_MIDPOINTS,
} from './movementAI';

// Adaptation tracking
export { updateAdaptation, getEffectiveAdaptation } from './adaptationTracker';
export type { AdaptationState, AdaptationEvent } from './adaptationTracker';

// Pressure system
export { calculatePressureEffects, calculatePressureThreshold } from './pressureSystem';
export type { PressureState, PressureEffects } from './pressureSystem';

// Servo strain
export { calculateBaseSpeed, calculateEffectiveSpeed, updateServoStrain } from './servoStrain';

// Threat scoring
export { selectTarget } from './threatScoring';

// Counter-attack
export { resolveCounter } from './counterAttack';
export type { CounterResult } from './counterAttack';

// Team coordination
export { checkSyncVolley, getSupportShieldBoost, getFormationDefenseBonus } from './teamCoordination';

// Hydraulic bonus
export { calculateHydraulicBonus } from './hydraulicBonus';
