/**
 * Wire contract pieces of the Hall of Records (`GET /api/records`) shared by the
 * backend queries and the page: the record owner and the league win streak lists.
 */

import type { StableType } from './stable';

/** The stable that holds a record. */
export interface RecordOwnerDisplay {
  /** The owning stable's user id (links to `/stables/:id`); null when unknown. */
  userId: number | null;
  /** Display name of the stable (stable name, or username as fallback). */
  username: string;
  /** Spec #55 decision 42: drives the Automaton_Badge on every Hall of Records record. */
  stableType: StableType | null;
}

/** The league modes with a win streak list (Spec #46 R7). */
export type WinStreakMode = 'league_1v1' | 'league_2v2' | 'league_3v3' | 'tag_team';

/** One entry of a league win streak list. */
export interface WinStreakEntry extends RecordOwnerDisplay {
  /** Players' list only (#595): the place among every stable's entries. */
  place?: number;
  entityId: number;
  /** Robot name for `league_1v1`, team name for the three team modes. */
  entityName: string;
  bestWinStreak: number;
  currentWinStreak: number;
  /** True when the best streak is the one currently running. */
  isActive: boolean;
  wins: number;
}
