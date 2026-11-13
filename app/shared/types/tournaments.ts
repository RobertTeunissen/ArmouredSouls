/**
 * Wire contracts of the tournament pages: the seedings view
 * (`GET /api/tournaments/:id/seedings`) and resolved bracket participants.
 */

/**
 * Seed entry representing a robot's seeding in a tournament bracket
 */
export interface SeedEntry {
  seed: number;       // 1-based seed number
  robotId: number;
  robotName: string;
  elo: number;
  eliminated: boolean; // true if robot has lost a match
}

export interface ResolvedParticipant {
  id: number;
  displayName: string;
  leagueTier: string;
  elo: number;
  ownerId: number;
  ownerStableName?: string;
  members?: { robotId: number; robotName: string; elo: number }[];
}
