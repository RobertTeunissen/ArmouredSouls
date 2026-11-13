/**
 * Wire contract pieces of `GET /api/stables/:userId` (public stable page) that the
 * backend builds in `stable-view-sections.ts`: per-robot standings, recent results
 * and season accolades.
 */

import type { TieredStandingsMode } from '../utils/automatonStandingsTier';

export type ResultOutcome = 'win' | 'loss' | 'draw';

/** One tiered mode a robot has played this season. */
export interface PublicRobotStanding {
  mode: TieredStandingsMode;
  tier: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  draws: number;
  /** Placement modes only: matches entered (`wins` counts first places). */
  totalMatches: number | null;
  /** Team modes: the team this standing belongs to. */
  teamName: string | null;
  /** Team modes: the team's id; null for robot standings. */
  teamId: number | null;
  /** League instance, e.g. `champion_2`; ranks are computed within it. */
  leagueInstanceId: string;
}

/** One of the stable's robots in a recent battle. */
export interface RecentResultEntry {
  robotId: number;
  robotName: string;
  /** Head-to-head modes; null for KotH and Grand Melee. */
  outcome: ResultOutcome | null;
  /** KotH and Grand Melee finishing position; null otherwise. */
  placement: number | null;
  /** ELO after minus ELO before; 0 for modes that do not move ELO. */
  eloChange: number;
}

export interface RecentResult {
  battleId: number;
  battleType: string;
  /** League tier the battle ran in; null for tournaments. */
  tier: string | null;
  tournamentRound: number | null;
  createdAt: string;
  entries: RecentResultEntry[];
}

/** A Hall of Records placement from any completed season. */
export interface StableAccolade {
  seasonNumber: number;
  category: string;
  rank: number;
  subjectName: string;
  value: number;
  valueLabel: string;
  mode: string | null;
}
