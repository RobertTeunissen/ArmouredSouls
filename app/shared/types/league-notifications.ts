/**
 * Wire contract for `GET /api/leagues/tier-changes/unseen`: the stable's
 * promotions and demotions from the last 24 hours.
 */

export type TierChangeType = 'promotion' | 'demotion';

export interface TierChange {
  id: number;
  /** `robot`, `tag_team` or `team_battle`. */
  entityType: string;
  entityId: number;
  entityName: string;
  changeType: TierChangeType;
  sourceTier: string;
  destinationTier: string;
  /** League points at the moment of the change. */
  leaguePoints: number;
  /** Standings mode, e.g. `league_1v1`, `koth`, `tag_team`. */
  mode: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface TierChangesResponse {
  changes: TierChange[];
}
