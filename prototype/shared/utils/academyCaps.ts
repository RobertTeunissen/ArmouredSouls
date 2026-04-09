/**
 * Academy level → attribute cap mapping
 *
 * Each Training Academy facility (Combat, Defense, Mobility, AI) controls
 * the maximum attribute level for its category. Level 0 (no academy) caps
 * attributes at 10; each academy level raises the cap per the map below.
 *
 * See docs/prd_core/STABLE_SYSTEM.md for authoritative specification.
 */

export const ACADEMY_CAP_MAP: Readonly<Record<number, number>> = {
  0: 10, 1: 15, 2: 20, 3: 25, 4: 30,
  5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50,
};

/** Get the attribute cap for a given academy level. Returns 10 for unknown levels. */
export function getCapForLevel(level: number): number {
  return ACADEMY_CAP_MAP[level] ?? 10;
}
