/**
 * KotH Matchmaking Service
 *
 * Groups eligible robots into LP-banded groups of 5-6 for King of the Hill
 * matches within each tier/instance. The pipeline is shared with Grand Melee
 * in `matchmaking/placementMatchmaking`.
 *
 * Spec #41: Unified Match Scheduling
 * Requirements: 1.1–1.4, 2.1–2.4, 3.1–3.6, 4.1–4.4, 8.4, 23.1–23.3
 */

import { KOTH_MATCH_DEFAULTS } from '../arena/koth/kothConfig';
import {
  getEligiblePlacementRobots,
  groupPlacementRobotsByLP,
  runPlacementMatchmaking,
  type EligibleRobot,
  type PlacementMatchGroup,
  type PlacementMatchmakingMode,
} from '../matchmaking/placementMatchmaking';

export type { EligibleRobot, PlacementMatchGroup as KothMatchGroup };

const KOTH_MATCHMAKING: PlacementMatchmakingMode = {
  mode: 'koth',
  label: 'KotH',
  minGroupSize: 5,
  idealGroupSize: 6,
  zoneRadius: KOTH_MATCH_DEFAULTS.zoneRadius,
};

export const MIN_GROUP_SIZE = KOTH_MATCHMAKING.minGroupSize;

/** Eligible KotH robots in one instance (standing, ready, subscribed, not yet scheduled). */
export function getEligibleRobots(leagueInstanceId: string): Promise<EligibleRobot[]> {
  return getEligiblePlacementRobots(KOTH_MATCHMAKING, leagueInstanceId);
}

/** Group robots into LP-banded groups of 5-6. Pure. */
export function groupByLPBanding(
  robots: EligibleRobot[],
  standingsLPMap: Map<number, number>,
  recentOpponentsMap: Map<number, number[]>,
): PlacementMatchGroup[] {
  return groupPlacementRobotsByLP(KOTH_MATCHMAKING, robots, standingsLPMap, recentOpponentsMap);
}

/** Run KotH matchmaking for all tier/instances; returns matches plus byes created. */
export function runKothMatchmaking(scheduledFor?: Date): Promise<number> {
  return runPlacementMatchmaking(KOTH_MATCHMAKING, scheduledFor);
}
