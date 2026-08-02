/**
 * Universal prestige gate thresholds for facility upgrades.
 *
 * All facilities share the same curve. Index = level - 1.
 * A value of 0 means no prestige is required for that level.
 *
 * L1–L3: free, L4: 1000, L5: 3000, L6: 5000,
 * L7: 10000, L8: 15000, L9: 25000, L10: 50000
 */
export const PRESTIGE_GATES: number[] = [0, 0, 0, 1000, 3000, 5000, 10000, 15000, 25000, 50000];

/** Alias matching the backend config export name for cross-reference clarity. */
export const PRESTIGE_GATES_10 = PRESTIGE_GATES;

/**
 * Get the maximum facility level unlocked by a given prestige amount.
 * Returns 3–10 (levels 1–3 are always free, so minimum is 3).
 */
export function getUnlockedFacilityLevel(prestige: number): number {
  let unlocked = PRESTIGE_GATES.length; // assume max
  for (let i = PRESTIGE_GATES.length - 1; i >= 0; i--) {
    if (prestige >= PRESTIGE_GATES[i]) {
      unlocked = i + 1;
      break;
    }
  }
  return unlocked;
}

/**
 * Get the next prestige threshold the player hasn't reached yet.
 * Returns null if all levels are unlocked.
 */
export function getNextPrestigeThreshold(prestige: number): { level: number; required: number } | null {
  for (let i = 0; i < PRESTIGE_GATES.length; i++) {
    if (PRESTIGE_GATES[i] > 0 && prestige < PRESTIGE_GATES[i]) {
      return { level: i + 1, required: PRESTIGE_GATES[i] };
    }
  }
  return null;
}
