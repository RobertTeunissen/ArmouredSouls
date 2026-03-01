/**
 * Shared battle math utilities used across all battle orchestrators.
 * Centralizes ELO, prestige, fame, and league point calculations.
 *
 * Used by:
 *  - battleOrchestrator.ts (1v1)
 *  - tagTeamBattleOrchestrator.ts (tag team)
 */



// ELO K-factor (shared across all battle types)
export const ELO_K_FACTOR = 32;

// Prestige values by league tier
export const PRESTIGE_BY_LEAGUE: Record<string, number> = {
  bronze: 5,
  silver: 10,
  gold: 20,
  platinum: 30,
  diamond: 50,
  champion: 75,
};

// Base fame values by league tier
export const FAME_BY_LEAGUE: Record<string, number> = {
  bronze: 2,
  silver: 5,
  gold: 10,
  platinum: 15,
  diamond: 25,
  champion: 40,
};

/**
 * Calculate expected ELO score using the standard formula.
 * Used by 1v1, tag team, and tournament battle orchestrators.
 */
export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate ELO changes for a match between two ratings.
 * Works for both 1v1 (individual ELO) and tag team (combined ELO).
 */
export function calculateELOChange(
  winnerELO: number,
  loserELO: number,
  isDraw: boolean = false,
  kFactor: number = ELO_K_FACTOR
): { winnerChange: number; loserChange: number } {
  const expectedWinner = calculateExpectedScore(winnerELO, loserELO);
  const expectedLoser = calculateExpectedScore(loserELO, winnerELO);

  if (isDraw) {
    const winnerChange = Math.round(kFactor * (0.5 - expectedWinner));
    const loserChange = Math.round(kFactor * (0.5 - expectedLoser));
    return { winnerChange, loserChange };
  } else {
    const winnerChange = Math.round(kFactor * (1 - expectedWinner));
    const loserChange = Math.round(kFactor * (0 - expectedLoser));
    return { winnerChange, loserChange };
  }
}
