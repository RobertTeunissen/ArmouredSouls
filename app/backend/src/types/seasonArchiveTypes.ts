/**
 * Season archive JSON payload types (Spec #45).
 *
 * These describe the structures stored in the `Json` columns of
 * `stable_season_archives` and `robot_season_archives`. Every value is a
 * denormalized copy held as text or numbers so that archive rows survive the
 * Season_Rollover purge with no foreign key to a deleted row.
 *
 * Json was chosen over child tables because these payloads are read as a block
 * when a player expands one season row and are never filtered or aggregated
 * across rows. If a feature ever needs to query inside them, they become child
 * tables — see the Migration Strategy section of the spec design.
 */

/** One mode's final standing for a team the robot belonged to. */
export interface ArchivedTeamStanding {
  mode: string;
  tier: string;
  leagueInstanceId: string;
  leaguePoints: number;
  instanceRank: number;
}

/** A facility owned at the end of the season. */
export interface ArchivedFacility {
  facilityType: string;
  level: number;
}

/** Unlocked achievement identifiers held by `StableSeasonArchive.achievementIds`. */
export type ArchivedAchievementIds = string[];
