/**
 * Team Coordination Attributes — Solo Combat Bonuses
 *
 * In 1v1 battles, syncProtocols, supportSystems, and formationTactics
 * provide minor solo combat benefits. Full team coordination bonuses
 * (2v2+) are handled in the main simulation loop.
 *
 * All functions are pure with no module-level mutable state.
 *
 * Requirements: 13.1, 13.2, 13.3
 */

import { euclideanDistance } from './vector2d';
import { ArenaConfig, RobotCombatState } from './types';

/** Sync volley window in seconds */
const SYNC_WINDOW = 1.0;

/** Sync volley bonus per syncProtocols point */
const SYNC_BONUS_PER_POINT = 0.002; // 0.2%

/** Support shield boost per supportSystems point per tick */
const SUPPORT_BOOST_PER_POINT = 0.001; // 0.1%

/** Formation defense bonus per formationTactics point */
const FORMATION_BONUS_PER_POINT = 0.003; // 0.3%

/** Distance from arena edge for formation bonus */
const FORMATION_EDGE_DISTANCE = 3;

/**
 * Check if a sync volley bonus applies.
 *
 * In 1v1, when both main and offhand weapons are ready within a 1.0s
 * window, syncProtocols grants a damage bonus.
 *
 * Returns the bonus multiplier (0 if not applicable).
 *
 * Req 13.1
 */
export function checkSyncVolley(state: RobotCombatState, currentTime: number): number {
  const syncProtocols = Number(state.robot.syncProtocols ?? 0);
  if (syncProtocols <= 0) return 0;

  // Need dual-wield loadout
  if (state.robot.loadoutType !== 'dual_wield') return 0;
  if (!state.robot.mainWeapon || !state.robot.offhandWeapon) return 0;

  // Check if both weapons fired within the sync window
  const mainReady = currentTime - state.lastAttackTime;
  const offhandReady = currentTime - state.lastOffhandAttackTime;

  if (mainReady <= SYNC_WINDOW && offhandReady <= SYNC_WINDOW) {
    return syncProtocols * SYNC_BONUS_PER_POINT;
  }

  return 0;
}

/**
 * Get the shield regeneration boost from supportSystems.
 *
 * In 1v1, supportSystems provides a passive self-repair effect:
 * shield regen rate increased by supportSystems × 0.1% per tick.
 *
 * Returns the multiplier to apply to shield regen (e.g., 0.005 for 0.5%).
 *
 * Req 13.2
 */
export function getSupportShieldBoost(state: RobotCombatState): number {
  const supportSystems = Number(state.robot.supportSystems ?? 0);
  return supportSystems * SUPPORT_BOOST_PER_POINT;
}

/**
 * Get the formation defense bonus from formationTactics.
 *
 * In 1v1, when the robot is within 3 grid units of the arena boundary,
 * formationTactics grants a damage reduction bonus (wall-bracing).
 *
 * Returns the damage reduction multiplier (0 if not near edge).
 *
 * Req 13.3
 */
export function getFormationDefenseBonus(
  state: RobotCombatState,
  arena: ArenaConfig,
): number {
  const formationTactics = Number(state.robot.formationTactics ?? 0);
  if (formationTactics <= 0) return 0;

  const distFromCenter = euclideanDistance(state.position, arena.center);
  const distFromEdge = arena.radius - distFromCenter;

  if (distFromEdge <= FORMATION_EDGE_DISTANCE) {
    return formationTactics * FORMATION_BONUS_PER_POINT;
  }

  return 0;
}
