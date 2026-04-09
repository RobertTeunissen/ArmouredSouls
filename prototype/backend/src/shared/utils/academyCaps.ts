/**
 * Academy level → attribute cap mapping
 *
 * ⚠️  MIRRORED from prototype/shared/utils/academyCaps.ts
 * Keep both files in sync. The frontend imports from shared/utils/ directly.
 * The backend needs this copy inside src/ due to the rootDir constraint.
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
