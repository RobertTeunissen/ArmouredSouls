/**
 * Wire contract pieces of the League Standings API (`/api/leagues/*`): the
 * viewer's own entries (`GET /api/leagues/my-standings`), the status chip of an
 * entry at the next rebalance, and page metadata.
 */

import type { TieredLeagueMode } from './admin-league-health';

export type StandingStatusKind =
  | 'promotes'
  | 'demotes'
  /** Promotion place, enough cycles, below the tier's LP minimum. */
  | 'held_lp'
  /** Promotion or demotion place, not yet enough cycles in the tier. */
  | 'held_cycles'
  /** Promotion place and qualifying, but the empty tier above needs a larger cohort. */
  | 'held_cohort';

export interface StandingStatus {
  kind: StandingStatusKind;
  /** Which zone the entity's place is in. */
  zone: 'promotion' | 'demotion';
  /** `held_cycles`: cycles still needed in this tier. */
  cyclesToGo?: number;
  /** `held_lp`: the LP minimum for promotion out of this tier. */
  minLP?: number;
}

export interface MyStandingEntry {
  mode: TieredLeagueMode;
  entityType: 'robot' | 'team';
  entityId: number;
  name: string;
  tier: string;
  leagueInstanceId: string;
  /** Place in its instance (1 = most LP; entity id breaks ties, as in the planner). */
  place: number;
  instanceSize: number;
  leaguePoints: number;
  cyclesInTier: number;
  /** Cycles in a tier before the rebalance may move it (5; KotH and Grand Melee 10). */
  minCycles: number;
  status: StandingStatus | null;
}

export interface MyStandings {
  entries: MyStandingEntry[];
}

export interface StandingsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
