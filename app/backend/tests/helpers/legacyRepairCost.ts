/**
 * Adapter from the pre-Spec-#48 six-argument `calculateRepairCost` signature onto
 * the Shared_Repair_Module's `calculateRepairQuote`.
 *
 * Several regression suites were written against the old positional signature and
 * carry expected values that are worth keeping as coverage. Rewriting every call
 * by hand risked transcribing a number wrong, which would have quietly weakened
 * the very tests that guard what players are charged. This adapter reshapes
 * arguments and nothing else — it performs no arithmetic, so it is not a second
 * declaration of the formula.
 *
 * It lives under `tests/` deliberately: Spec #48 Verification criterion 16 requires
 * the name `calculateRepairCost` to be gone from `app/backend/src`,
 * `app/frontend/src` and `app/shared`, and this is none of those.
 *
 * New tests should call `calculateRepairQuote` directly.
 */

import { calculateRepairQuote } from '../../src/shared/utils/repairCost';

export function calculateRepairCost(
  sumOfAllAttributes: number,
  damagePercent: number,
  hpPercent: number,
  repairBayLevel: number = 0,
  _medicalBayLevel: number = 0,
  activeRobotCount: number = 0,
): number {
  return calculateRepairQuote(
    { attributeTotal: sumOfAllAttributes, damagePercent, hpPercent },
    { repairBayLevel, activeRobotCount },
  );
}
