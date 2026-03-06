/**
 * CreditWarning component
 * Displays contextual credit validation warnings during onboarding purchases.
 * 
 * Warning types:
 * - Insufficient funds error (blocks purchase)
 * - Low reserve advisory (credits - cost < ₡50,000)
 * - Critical budget warning (credits < ₡600,000)
 * - Facility block during early onboarding (step < 4)
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 23.1
 */

import { useCreditValidation, CREDIT_THRESHOLDS } from '../../hooks/useCreditValidation';
import { formatCurrency } from '../../utils/formatters';

interface CreditWarningProps {
  currentCredits: number;
  purchaseCost: number;
  onboardingStep?: number;
}

const CreditWarning = ({ currentCredits, purchaseCost, onboardingStep }: CreditWarningProps) => {
  const { canAfford, isLowReserve, isCriticalBudget, remainingAfterPurchase } = useCreditValidation(
    currentCredits,
    purchaseCost
  );

  // Facility block during early onboarding
  if (onboardingStep !== undefined && onboardingStep < 4) {
    return (
      <div
        role="alert"
        className="p-3 rounded bg-blue-900/10 text-blue-400 border border-blue-700 text-sm"
      >
        <span className="font-medium">Facility purchases are locked</span> until you complete the
        budget allocation step (Step 4). Focus on learning about strategies and facilities first.
      </div>
    );
  }

  // Insufficient funds — blocks purchase
  if (!canAfford) {
    return (
      <div
        role="alert"
        className="p-3 rounded bg-red-900/10 text-red-400 border border-red-700 text-sm"
      >
        <span className="font-medium">Insufficient credits.</span> You need{' '}
        {formatCurrency(purchaseCost)} but only have {formatCurrency(currentCredits)}.
      </div>
    );
  }

  const warnings: JSX.Element[] = [];

  // Critical budget warning
  if (isCriticalBudget) {
    warnings.push(
      <div
        key="critical"
        role="alert"
        className="p-3 rounded bg-red-900/10 text-red-400 border border-red-700 text-sm"
      >
        <span className="font-medium">Critical budget warning.</span> Your credits are below{' '}
        {formatCurrency(CREDIT_THRESHOLDS.CRITICAL_BUDGET)}. Consider avoiding additional spending
        to keep funds for repairs and operations.
      </div>
    );
  }

  // Low reserve advisory (only if can afford and remaining is low)
  if (isLowReserve && canAfford) {
    warnings.push(
      <div
        key="low-reserve"
        role="status"
        className="p-3 rounded bg-yellow-900/10 text-yellow-400 border border-yellow-700 text-sm"
      >
        <span className="font-medium">Low reserve warning.</span> After this purchase you will have{' '}
        {formatCurrency(remainingAfterPurchase)} remaining. Keeping at least{' '}
        {formatCurrency(CREDIT_THRESHOLDS.LOW_RESERVE)} is recommended to cover repair costs.
      </div>
    );
  }

  if (warnings.length === 0) return null;

  return <div className="space-y-2">{warnings}</div>;
};

export default CreditWarning;
