/**
 * Wire contract for `GET /api/robots/:id/koth-standing` and
 * `GET /api/robots/:id/grand-melee-standing`.
 */

/** A robot's standing in a placement mode (KotH or Grand Melee), with its kills in that mode. */
export interface PlacementStanding {
  tier: string;
  leagueInstanceId: string;
  leaguePoints: number;
  wins: number;
  totalMatches: number | null;
  totalKills: number;
  bestPlacement: number | null;
  currentWinStreak: number;
  bestWinStreak: number;
}

/** `standing` is null when the robot has never entered the mode. */
export interface PlacementStandingResponse {
  standing: PlacementStanding | null;
}
