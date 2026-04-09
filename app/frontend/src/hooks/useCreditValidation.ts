/**
 * useCreditValidation hook
 * Provides credit validation logic for purchase flows during onboarding.
 * 
 * Thresholds:
 * - canAfford: credits >= cost
 * - isLowReserve: credits - cost < 50,000 (advisory warning)
 * - isCriticalBudget: credits < 600,000 (spending warning)
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.6
 */

export const CREDIT_THRESHOLDS = {
  LOW_RESERVE: 50000,
  CRITICAL_BUDGET: 600000,
} as const;

export interface CreditValidationResult {
  canAfford: boolean;
  isLowReserve: boolean;
  isCriticalBudget: boolean;
  remainingAfterPurchase: number;
}

export function useCreditValidation(credits: number, cost: number): CreditValidationResult {
  const remainingAfterPurchase = credits - cost;

  return {
    canAfford: credits >= cost,
    isLowReserve: remainingAfterPurchase < CREDIT_THRESHOLDS.LOW_RESERVE,
    isCriticalBudget: credits < CREDIT_THRESHOLDS.CRITICAL_BUDGET,
    remainingAfterPurchase,
  };
}
