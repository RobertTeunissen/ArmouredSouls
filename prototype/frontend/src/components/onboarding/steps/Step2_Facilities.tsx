/**
 * Step 3: Strategic Facility Investment
 *
 * Three investment choices with strategy-aware recommendations.
 * Selected facilities are auto-purchased on confirm.
 * "Previous" triggers a full account reset back to step 1.
 *
 * Requirements: 5.1-5.14
 */

import { useState, memo } from 'react';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import apiClient from '../../../utils/apiClient';

type StrategyKey = '1_mighty' | '2_average' | '3_flimsy';

interface InvestmentOption {
  id: string; facilityType: string; title: string; description: string;
  cost: number; benefit: string; icon: string;
}

const WEAPONS: InvestmentOption = { id: 'weapons', facilityType: 'weapons_workshop', title: 'Invest in Weapons', description: 'Get a discount on all weapon purchases. Buy this before shopping for weapons.', cost: 75_000, benefit: '10% discount on weapon purchases', icon: '⚔️' };
const ATTRIBUTES: InvestmentOption = { id: 'attributes', facilityType: 'training_facility', title: 'Invest in Attributes', description: 'Get a discount on all attribute upgrades. Makes your robots stronger for less.', cost: 150_000, benefit: '10% discount on attribute upgrades', icon: '💪' };
const MERCH: InvestmentOption = { id: 'income', facilityType: 'merchandising_hub', title: 'I Want Passive Income', description: 'Earn credits every day from merchandising. Scales with your prestige.', cost: 150_000, benefit: '₡5,000/day base income', icon: '💰' };
const STREAM: InvestmentOption = { id: 'income', facilityType: 'streaming_studio', title: 'Boost My Battle Earnings', description: 'Double the streaming revenue you earn from every battle.', cost: 100_000, benefit: '2× streaming revenue per battle', icon: '📺' };
const REPAIR: InvestmentOption = { id: 'repairs', facilityType: 'repair_bay', title: 'I Want Less Repair Costs', description: 'Reduce the credits you spend fixing your robots after lost battles.', cost: 50_000, benefit: 'Repair cost discount', icon: '🔧' };

function getRecommendation(strategy: StrategyKey) {
  switch (strategy) {
    case '1_mighty': return { options: [WEAPONS, ATTRIBUTES, MERCH, REPAIR], recommended: new Set(['weapons', 'attributes']), note: 'With one robot you have plenty of budget. Discount facilities pay for themselves quickly.' };
    case '2_average': return { options: [WEAPONS, ATTRIBUTES, STREAM, REPAIR], recommended: new Set(['weapons', 'income']), note: 'Two robots means more battles — streaming revenue adds up fast.' };
    case '3_flimsy': return { options: [STREAM, REPAIR], recommended: new Set(['income']), note: 'Your budget is tight after three robots. Streaming studio is the best bang for your buck with maximum battles per day.' };
  }
}

const formatCurrency = (n: number) => `₡${n.toLocaleString()}`;

interface Step3_FacilityTimingProps {
  onNext?: () => void;
  onPrevious?: () => void;
}

const Step3_FacilityTiming = ({ onPrevious: _onPrevious }: Step3_FacilityTimingProps) => {
  const { tutorialState, refreshState } = useOnboarding();

  const strategy = (tutorialState?.strategy || '1_mighty') as StrategyKey;
  const { options, recommended, note } = getRecommendation(strategy);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(recommended));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  const toggleOption = (id: string) => {
    if (isSubmitting) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalCost = options
    .filter(o => selected.has(o.id))
    .reduce((sum, o) => sum + o.cost, 0);

  /** Purchase selected facilities and advance */
  const handleInvest = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const purchased: string[] = [];
      for (const option of options) {
        if (selected.has(option.id)) {
          await apiClient.post('/api/facilities/upgrade', {
            facilityType: option.facilityType,
          });
          purchased.push(option.facilityType);
        }
      }

      // Track choices — append to existing facilitiesPurchased
      const existing = tutorialState?.choices?.facilitiesPurchased || [];
      await apiClient.post('/api/onboarding/state', {
        choices: { facilitiesPurchased: [...existing, ...purchased] },
      });

      await apiClient.post('/api/onboarding/state', { step: 4 });
      await apiClient.post('/api/onboarding/state', { step: 5 });
      await apiClient.post('/api/onboarding/state', { step: 6 });
      await refreshState();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Skip facility investment entirely */
  const handleSkip = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await apiClient.post('/api/onboarding/state', { step: 4 });
      await apiClient.post('/api/onboarding/state', { step: 5 });
      await apiClient.post('/api/onboarding/state', { step: 6 });
      await refreshState();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Full account reset — reverts robots, facilities, credits back to step 1 */
  const handleRevert = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await apiClient.post('/api/onboarding/reset-account', {
        confirmation: 'RESET',
        reason: 'Onboarding: user pressed Previous on step 3',
      });
      await refreshState();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Could not revert. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
      setShowRevertConfirm(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 text-gray-100">
          Where Do You Want to Invest?
        </h1>
        <p className="text-lg text-secondary max-w-2xl mx-auto">
          These facilities give you discounts and income that pay off over time.
        </p>
      </div>

      {/* Strategy-aware recommendation */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">💡</span>
          <p className="text-sm text-secondary">{note}</p>
        </div>
      </div>

      {/* Investment Cards */}
      <div className={`grid grid-cols-1 ${options.length === 4 ? 'md:grid-cols-2' : options.length === 3 ? 'md:grid-cols-3' : options.length === 2 ? 'md:grid-cols-2' : ''} gap-5 mb-8`}>
        {options.map(option => {
          const isSelected = selected.has(option.id);
          const isRecommended = recommended.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleOption(option.id)}
              disabled={isSubmitting}
              className={`
                relative text-left p-5 rounded-lg border-2 transition-all duration-200
                ${isSelected
                  ? 'border-blue-500 ring-4 ring-blue-500/30 bg-blue-900/20'
                  : 'border-white/10 bg-surface hover:border-gray-600'
                }
                ${isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
              `}
              aria-pressed={isSelected}
              aria-label={`${option.title} — ${formatCurrency(option.cost)}`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 bg-primary text-white px-2 py-0.5 rounded-full text-xs font-bold">
                  SELECTED
                </div>
              )}
              {isRecommended && !isSelected && (
                <div className="absolute top-3 right-3 bg-yellow-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                  RECOMMENDED
                </div>
              )}

              <div className="text-3xl mb-3">{option.icon}</div>
              <h3 className="text-lg font-bold text-gray-100 mb-1">{option.title}</h3>
              <p className="text-sm text-secondary mb-4">{option.description}</p>

              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-primary font-semibold">{formatCurrency(option.cost)}</span>
                <span className="text-success text-right">{option.benefit}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Cost summary */}
      {selected.size > 0 && (
        <div className="text-center mb-6">
          <p className="text-secondary">
            Total investment:{' '}
            <span className="font-bold text-primary">{formatCurrency(totalCost)}</span>
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 max-w-lg mx-auto mb-6">
          <p className="text-error text-sm text-center">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-4">
          <button
            onClick={() => setShowRevertConfirm(true)}
            disabled={isSubmitting}
            className="px-6 py-2.5 border border-primary text-primary hover:bg-primary/10 rounded-lg font-medium transition-colors min-h-[44px] disabled:opacity-50"
          >
            Previous
          </button>

          <button
            onClick={handleInvest}
            disabled={selected.size === 0 || isSubmitting}
            className={`
              px-8 py-2.5 rounded-lg font-semibold text-lg transition-all duration-200 min-h-[44px]
              ${selected.size > 0 && !isSubmitting
                ? 'bg-primary hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-surface-elevated text-secondary cursor-not-allowed'
              }
            `}
          >
            {isSubmitting ? 'Purchasing...' : 'Invest'}
          </button>

          <button
            onClick={handleSkip}
            disabled={isSubmitting}
            className="px-6 py-2.5 border border-primary text-primary hover:bg-primary/10 rounded-lg font-medium transition-colors min-h-[44px] disabled:opacity-50"
          >
            Do Not Invest
          </button>
        </div>
      </div>

      {/* Revert Confirmation Modal */}
      {showRevertConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm going back"
        >
          <div className="bg-surface border border-white/10 rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-100 mb-3">Go Back to Strategy Selection?</h2>
            <p className="text-secondary text-sm mb-5">
              This will undo everything from the previous step — your robots will be deleted,
              facilities refunded, and your credits restored to ₡3,000,000. You'll start fresh
              from strategy selection.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRevertConfirm(false)}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-surface-elevated hover:bg-gray-600 text-secondary rounded-lg font-medium transition-colors min-h-[44px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRevert}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors min-h-[44px] disabled:opacity-50"
              >
                {isSubmitting ? 'Reverting...' : 'Yes, Start Over'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(Step3_FacilityTiming);
