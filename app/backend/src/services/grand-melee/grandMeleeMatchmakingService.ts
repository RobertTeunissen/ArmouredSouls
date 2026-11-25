/**
 * Grand Melee Matchmaking Service
 *
 * Groups eligible robots into LP-banded groups of 8-20 for Grand Melee
 * matches within each tier/instance. The pipeline is shared with KotH in
 * `matchmaking/placementMatchmaking`.
 *
 * Spec #44: Grand Melee
 * Requirements: 1.1–1.4, 2.1–2.4, 3.1–3.6, 4.1–4.4
 */

import {
  getEligiblePlacementRobots,
  groupPlacementRobotsByLP,
  runPlacementMatchmaking,
  type EligibleRobot,
  type PlacementMatchGroup,
  type PlacementMatchmakingMode,
} from '../matchmaking/placementMatchmaking';

export type { EligibleRobot, PlacementMatchGroup as GrandMeleeMatchGroup };

const GRAND_MELEE_MATCHMAKING: PlacementMatchmakingMode = {
  mode: 'grand_melee',
  label: 'Grand Melee',
  minGroupSize: 8,
  idealGroupSize: 20,
};

export const MIN_GROUP_SIZE = GRAND_MELEE_MATCHMAKING.minGroupSize;

/** Eligible Grand Melee robots in one instance (standing, ready, subscribed, not yet scheduled). */
export function getEligibleRobots(leagueInstanceId: string): Promise<EligibleRobot[]> {
  return getEligiblePlacementRobots(GRAND_MELEE_MATCHMAKING, leagueInstanceId);
}

/** Group robots into LP-banded groups of 8-20. Pure. */
export function groupByLPBanding(
  robots: EligibleRobot[],
  standingsLPMap: Map<number, number>,
  recentOpponentsMap: Map<number, number[]>,
): PlacementMatchGroup[] {
  return groupPlacementRobotsByLP(GRAND_MELEE_MATCHMAKING, robots, standingsLPMap, recentOpponentsMap);
}

/** Run Grand Melee matchmaking for all tier/instances; returns matches plus byes created. */
export function runGrandMeleeMatchmaking(scheduledFor?: Date): Promise<number> {
  return runPlacementMatchmaking(GRAND_MELEE_MATCHMAKING, scheduledFor);
}
