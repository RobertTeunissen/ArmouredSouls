/**
 * Turning fitted coefficients into reported effects: a linear contrast of the
 * coefficients, scaled to percentage points of win chance at even odds, with
 * its standard error. Shared by the Attributes and Weapons analyses.
 */
import { combinationVariance, type FitResult } from './logisticFit';
import type { EffectEstimate } from './analysisTypes';

/** Percentage points of win chance per unit of logit at even odds (slope of the logistic at p = 0.5). */
export const PP_PER_LOGIT = 100 / 4;
/** "10% more points than the opponent", on the log-total control. */
export const INVESTMENT_STEP = Math.log(1.1);

export const NO_ESTIMATE: EffectEstimate = { effect: null, se: null, significant: false };

export function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** cᵀβ × scale with its standard error; significant at |effect| ≥ 2 SE. */
export function estimate(fit: FitResult | null, contrast: Float64Array, scale: number, enough: boolean): EffectEstimate {
  if (!fit || !enough) return NO_ESTIMATE;
  let value = 0;
  for (let j = 0; j < contrast.length; j++) value += contrast[j] * fit.beta[j];
  const se = Math.sqrt(combinationVariance(fit.covariance, contrast.length, contrast)) * scale;
  const effect = value * scale;
  if (!Number.isFinite(effect) || !Number.isFinite(se)) return NO_ESTIMATE;
  return { effect: round(effect, 2), se: round(se, 2), significant: Math.abs(effect) >= 2 * se && se > 0 };
}

/** Contrast "+1 on member k of a block, −1/(n−1) on the others". */
export function blockContrast(d: number, offset: number, size: number, k: number): Float64Array {
  const c = new Float64Array(d);
  for (let j = 0; j < size; j++) c[offset + j] = j === k ? 1 : -1 / (size - 1);
  return c;
}

/** Contrast "+1 on member k of a block, minus the weighted average of the block" (weights sum to 1). */
export function weightedContrast(d: number, offset: number, weights: ArrayLike<number>, k: number): Float64Array {
  const c = new Float64Array(d);
  for (let j = 0; j < weights.length; j++) c[offset + j] = -weights[j];
  c[offset + k] += 1;
  return c;
}

export function unitContrast(d: number, index: number): Float64Array {
  const c = new Float64Array(d);
  c[index] = 1;
  return c;
}
