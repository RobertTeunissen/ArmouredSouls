/**
 * Repair pricing — the ONE place under `app/` that declares the repair cost
 * formula, the Repair Bay discount, the manual repair discount and the rounding
 * rules. Imported by both the backend and the frontend.
 *
 * Spec #48 Requirement 15. Before that spec the formula existed three times: here,
 * again in `app/backend/src/utils/robotCalculations.ts`
 * (the copy both repair paths actually executed), and inline in
 * `app/frontend/src/components/YieldThresholdSlider.tsx`. Nothing enforced that
 * the three agreed, and the header of this file had been asking for the migration
 * since it was written. The other two are gone; this is the survivor.
 *
 * NOTE ON PATHS: `app/backend/src/shared/utils` is a SYMLINK to `app/shared/utils`.
 * A backend import of `../../shared/utils/repairCost` resolves to this very file —
 * it is not a copy. Do not "delete the duplicate" you think you see there.
 *
 * Formula (Requirement 15 criteria 4 and 5):
 *   quote = round(attributeTotal × 100
 *                 × (damagePercent / 100)
 *                 × damageMultiplier
 *                 × (1 − repairBayDiscount))
 *
 *   damageMultiplier  = 2.0 at exactly 0% HP, 1.5 below 10% HP, 1.0 otherwise
 *   repairBayDiscount = min(90, repairBayLevel × (5 + activeRobotCount)) / 100
 *
 * The rounding split is deliberate and pins pre-consolidation behaviour:
 * `Math.round` on the quote, `Math.floor` on the manual discount (criterion 10).
 * `tests/unit/repairCostParity.test.ts` holds literals captured from the old
 * implementation so a change to either is caught.
 */

import { ROBOT_ATTRIBUTES } from './robotAttributes';

/** Credits per attribute point before any multiplier. */
const ATTRIBUTE_COST_MULTIPLIER = 100;

/** Damage_Multiplier at exactly 0% HP (total destruction). */
const DESTRUCTION_MULTIPLIER = 2.0;

/** Damage_Multiplier below 10% HP (heavily damaged). */
const HEAVY_DAMAGE_MULTIPLIER = 1.5;

/** Repair Bay discount ceiling, as a percentage. Requirement 15 criterion 5. */
export const MAX_REPAIR_BAY_DISCOUNT_PERCENT = 90;

/**
 * The reduction a player receives for repairing a robot before its next
 * scheduled match rather than letting the pre-battle cron repair it.
 *
 * Declared exactly once under `app/`. Requirement 15 criterion 9 forbids any
 * call site multiplying by this directly — go through `applyManualRepairDiscount`
 * so the discount is applied in one place, with one rounding rule.
 */
export const MANUAL_REPAIR_DISCOUNT = 0.5;

/**
 * Minimal robot shape needed to price a repair. Works with Prisma model objects
 * and with plain API response objects; attribute values may be numbers or Prisma
 * Decimals, which `sumAttributes` coerces.
 */
export interface RepairCostRobot {
  currentHP: number;
  maxHP: number;
}

/** The two inputs to the Repair Bay discount. */
export interface RepairBayContext {
  repairBayLevel: number;
  activeRobotCount: number;
}

/**
 * What is being priced.
 *
 * The robot form derives the damage percentage, HP percentage and attribute total
 * from the robot itself. The explicit form prices a hypothetical, which is what
 * the yield-threshold scenario table needs — it asks "what would this cost at 30%
 * HP?" about a robot that is currently undamaged.
 */
export type RepairQuoteSubject =
  | { robot: RepairCostRobot }
  | { attributeTotal: number; damagePercent: number; hpPercent: number };

/** Round to 2 decimal places — mirrors the backend's `roundToTwo`. */
function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Reject input that would produce a negative or non-finite quote.
 *
 * A plain `RangeError` is thrown rather than an `AppError` subclass because this
 * module is imported by the frontend and must not depend on `src/errors/`. Each
 * backend repair path catches it and rethrows as
 * `RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, …, 400)`.
 *
 * Requirement 15 criterion 17.
 */
function assertFiniteNonNegative(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`repairCost: ${label} must be a finite number >= 0, received ${value}`);
  }
}

/**
 * Sum all 23 attribute values on a robot object.
 *
 * Handles numeric values and Prisma Decimals via `Number()`, and applies
 * `roundToTwo` to match the backend's `calculateAttributeSum`.
 */
export function sumAttributes(robot: RepairCostRobot): number {
  let sum = 0;
  const rec = robot as unknown as Record<string, unknown>;
  for (const key of ROBOT_ATTRIBUTES) {
    const val = rec[key];
    if (val != null) {
      sum += Number(val);
    }
  }
  return roundToTwo(sum);
}

/**
 * The Repair Bay discount as a whole percentage:
 *   min(90, repairBayLevel × (5 + activeRobotCount))
 *
 * Exported for display and for the value `repairAllRobots` returns as `discount`.
 * It neither produces a quote nor applies the manual discount, so Requirement 15
 * criterion 1's one-function-each rule is unaffected.
 *
 * @throws RangeError if either input is negative or not finite
 */
export function calculateRepairBayDiscountPercent(context: RepairBayContext): number {
  assertFiniteNonNegative('repairBayLevel', context.repairBayLevel);
  assertFiniteNonNegative('activeRobotCount', context.activeRobotCount);

  return Math.min(
    MAX_REPAIR_BAY_DISCOUNT_PERCENT,
    context.repairBayLevel * (5 + context.activeRobotCount),
  );
}

/**
 * The Repair_Quote: credits to repair one robot to full at its current damage,
 * AFTER the Repair Bay discount and BEFORE the manual repair discount.
 *
 * This is the figure an automatic pre-battle repair charges, the figure the
 * frontend shows as an estimate, and the input to `applyManualRepairDiscount`.
 *
 * Returns 0 for an undamaged robot, in which case the caller must deduct no
 * credits, record no audit row and write no ledger entry (criterion 16).
 *
 * @throws RangeError if any input is negative or not finite (criterion 17)
 */
export function calculateRepairQuote(
  subject: RepairQuoteSubject,
  context: RepairBayContext,
): number {
  let attributeTotal: number;
  let damagePercent: number;
  let hpPercent: number;

  if ('robot' in subject) {
    const { robot } = subject;
    assertFiniteNonNegative('maxHP', robot.maxHP);
    assertFiniteNonNegative('currentHP', robot.currentHP);

    if (robot.maxHP === 0) {
      throw new RangeError('repairCost: maxHP must be greater than 0');
    }

    const damageTaken = robot.maxHP - robot.currentHP;
    if (damageTaken <= 0) return 0;

    attributeTotal = sumAttributes(robot);
    damagePercent = (damageTaken / robot.maxHP) * 100;
    hpPercent = (robot.currentHP / robot.maxHP) * 100;
  } else {
    attributeTotal = subject.attributeTotal;
    damagePercent = subject.damagePercent;
    hpPercent = subject.hpPercent;
  }

  assertFiniteNonNegative('attributeTotal', attributeTotal);
  assertFiniteNonNegative('damagePercent', damagePercent);
  assertFiniteNonNegative('hpPercent', hpPercent);

  if (damagePercent <= 0) return 0;

  const baseRepairCost = attributeTotal * ATTRIBUTE_COST_MULTIPLIER;

  let damageMultiplier = 1.0;
  if (hpPercent === 0) {
    damageMultiplier = DESTRUCTION_MULTIPLIER;
  } else if (hpPercent < 10) {
    damageMultiplier = HEAVY_DAMAGE_MULTIPLIER;
  }

  const rawCost = baseRepairCost * (damagePercent / 100) * damageMultiplier;
  const discountPercent = calculateRepairBayDiscountPercent(context);
  const finalCost = rawCost * (1 - discountPercent / 100);

  return Math.round(finalCost);
}

/**
 * The Charged_Repair_Cost on the manual repair path: a Repair_Quote reduced by
 * the manual repair discount, rounded DOWN.
 *
 * The only place under `app/` that applies the discount (Requirement 15
 * criterion 9). Where a manual repair covers several robots, call this per robot
 * and then sum — never sum the quotes and discount the total. Criteria 11 and 12
 * make the per-robot figure authoritative because it is the one that reconciles
 * with the per-robot audit, lifetime and ledger records; the batch-level
 * alternative can sit up to N−1 credits higher for N robots.
 *
 * @throws RangeError if `quote` is negative or not finite
 */
export function applyManualRepairDiscount(quote: number): number {
  assertFiniteNonNegative('quote', quote);
  return Math.floor(quote * MANUAL_REPAIR_DISCOUNT);
}
