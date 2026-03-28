/**
 * Step7_WeaponPurchase component
 * Guides players through purchasing their first weapon with budget-aware recommendations.
 *
 * Features:
 * - Explain robots require weapons to battle
 * - Explain weapon stats (damage, speed, DPS)
 * - Warn against expensive weapons (>₡250K) during onboarding
 * - Navigate to weapon shop
 * - Return to onboarding after weapon purchased
 *
 * Requirements: 10.1-10.14
 */

import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import apiClient from '../../../utils/apiClient';

interface Step7_WeaponPurchaseProps {
  onNext?: () => void;
  onPrevious?: () => void;
}

const EXPENSIVE_THRESHOLD = 250_000;

/** Strategy-specific weapon guidance */
const MULTI_ROBOT_WEAPON_GUIDANCE: Record<string, {
  heading: string;
  points: string[];
}> = {
  '2_average': {
    heading: '2 Robot Strategy: Weapon Reminders',
    points: [
      'You\'ll need at least 2 weapons — one for each robot.',
      'Consider buying 2 affordable weapons (e.g., 2× Machine Gun = ₡250K) rather than 1 expensive one.',
      'Each robot needs its own weapon equipped to be battle-ready.',
      'Weapons can be equipped/unequipped, but only one robot can wield a weapon at any given time.',
    ],
  },
  '3_flimsy': {
    heading: '3 Robot Strategy: Weapon Reminders',
    points: [
      'You\'ll need at least 3 weapons — one for each robot.',
      'Budget-friendly options like Combat Knife (₡100K each, ₡250K total) help stretch your credits.',
      'Base storage holds only 5 weapons — consider the Storage Facility if you need more.',
      'Weapons can be equipped/unequipped, but only one robot can wield a weapon at any given time.',
    ],
  },
};

const Step7_WeaponPurchase = ({ onNext, onPrevious }: Step7_WeaponPurchaseProps) => {
  const { tutorialState, advanceStep } = useOnboarding();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actualWeaponCount, setActualWeaponCount] = useState<number | null>(null);

  const strategy = tutorialState?.strategy || '1_mighty';
  const multiRobotInfo = MULTI_ROBOT_WEAPON_GUIDANCE[strategy];

  // Fetch actual weapon count from API (accounts for weapons bought outside onboarding)
  useEffect(() => {
    const fetchWeaponCount = async () => {
      try {
        const response = await apiClient.get('/api/weapon-inventory');
        const weapons = response.data;
        setActualWeaponCount(Array.isArray(weapons) ? weapons.length : 0);
      } catch {
        // Fall back to onboarding state if API fails
        setActualWeaponCount(tutorialState?.choices?.weaponsPurchased?.length ?? 0);
      }
    };
    fetchWeaponCount();
  }, [tutorialState?.choices?.weaponsPurchased]);

  // Use actual weapon count for accurate tracking
  const weaponCount = actualWeaponCount ?? (tutorialState?.choices?.weaponsPurchased?.length ?? 0);
  const hasWeapon = weaponCount > 0;

  const handleNext = async () => {
    try {
      setIsSubmitting(true);
      await advanceStep();
      onNext?.();
    } catch {
      // Error is handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic header based on weapon ownership
  const headerTitle = hasWeapon ? 'Weapons Acquired!' : 'Purchase Your First Weapon';
  const headerDescription = hasWeapon
    ? `You have ${weaponCount} weapon${weaponCount > 1 ? 's' : ''} in your inventory. You're ready to continue!`
    : 'Your robot needs a weapon to enter battles. Choose wisely — your loadout type and budget should guide your decision.';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 text-gray-100">{headerTitle}</h1>
        <p className="text-lg text-secondary max-w-3xl mx-auto">
          {headerDescription}
        </p>
      </div>

      {/* Why Weapons Matter */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">⚔️</span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-primary mb-2">
              Why Weapons Are Essential
            </h2>
            <p className="text-gray-200 mb-3">
              Robots <strong>cannot participate in battles</strong> without a weapon equipped.
              A weapon is one of the core battle readiness requirements.
            </p>
            <p className="text-secondary text-sm">
              Remember from Step 6: weapon type (Energy, Ballistic, Melee) doesn't matter yet.
              What matters is the <strong className="text-primary">loadout configuration</strong> and{' '}
              <strong className="text-primary">attribute bonuses</strong> each weapon provides.
            </p>
          </div>
        </div>
      </div>

      {/* What Matters for Weapons */}
      <div className="bg-surface border border-white/10 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-2xl">🎯</span> What Actually Matters for Weapons
        </h2>
        <ul className="space-y-3 text-gray-200">
          <li className="flex items-start gap-2">
            <span className="text-primary flex-shrink-0 font-bold">1.</span>
            <span>
              <strong className="text-primary">Loadout Type</strong> — Determines combat bonuses
              (Single, Weapon+Shield, Two-Handed, Dual-Wield)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary flex-shrink-0 font-bold">2.</span>
            <span>
              <strong className="text-primary">Attribute Bonuses</strong> — Weapons increase your
              robot's effective stats beyond base limits
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary flex-shrink-0 font-bold">3.</span>
            <span>
              <strong className="text-primary">Weapon Stats</strong> — Damage, speed (cooldown), and DPS
              (damage per second) determine combat effectiveness
            </span>
          </li>
        </ul>
      </div>

      {/* Weapon Stats Explained */}
      <div className="bg-surface border border-white/10 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-2xl">📊</span> Understanding Weapon Stats
        </h2>
        <div className="space-y-4 text-gray-200">
          <div>
            <h3 className="font-semibold text-primary mb-1">Damage</h3>
            <p className="text-sm text-secondary">
              The base damage dealt per hit. Higher damage means more HP removed per attack.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-primary mb-1">Speed (Cooldown)</h3>
            <p className="text-sm text-secondary">
              How many seconds between attacks. Lower cooldown = faster attacks.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-primary mb-1">DPS (Damage Per Second)</h3>
            <p className="text-sm text-secondary">
              Calculated as Damage ÷ Cooldown. This is the most important stat for comparing weapons.
              Higher DPS = more effective in battle.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Loadout Reminder */}
      <div className="bg-surface border border-white/10 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <h2 className="text-lg font-bold text-gray-100 mb-3 flex items-center gap-2">
          <span className="text-2xl">⚔️</span> Quick Loadout Reminder
        </h2>
        <p className="text-secondary text-sm mb-4">
          You learned about loadouts in the previous step. For your first weapon, we recommend:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
            <h3 className="font-bold text-success mb-1">Single Loadout</h3>
            <p className="text-xs text-secondary">One weapon, balanced bonuses. Buy any one-handed weapon.</p>
          </div>
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
            <h3 className="font-bold text-success mb-1">Weapon+Shield</h3>
            <p className="text-xs text-secondary">Defensive setup. Buy a one-handed weapon + a shield.</p>
          </div>
        </div>
        <p className="text-xs text-tertiary mt-3 text-center">
          Two-Handed and Dual-Wield are also options — see Step 6 for full details.
        </p>
      </div>

      {/* Expensive Weapon Warning */}
      <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-warning mb-2">
              Avoid Expensive Weapons During Onboarding
            </h2>
            <p className="text-gray-200 mb-2">
              Weapons costing more than{' '}
              <strong className="text-yellow-300">₡{EXPENSIVE_THRESHOLD.toLocaleString()}</strong>{' '}
              are not recommended right now. You still need credits for attribute upgrades,
              facilities, and repairs.
            </p>
            <p className="text-sm text-secondary">
              You can always buy better weapons later once your economy is established.
              Start affordable, upgrade later.
            </p>
          </div>
        </div>
      </div>

      {/* Multi-Robot Strategy Guidance */}
      {multiRobotInfo && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">🤖</span>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-primary mb-3">
                {multiRobotInfo.heading}
              </h2>
              <ul className="space-y-3">
                {multiRobotInfo.points.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-200">
                    <span className="text-primary flex-shrink-0">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Weapon Owned Success */}
      {hasWeapon && (
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">✅</span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-success mb-2">
                {weaponCount} Weapon{weaponCount > 1 ? 's' : ''} in Inventory!
              </h2>
              <p className="text-gray-200">
                You have weapons ready. Next, you'll learn how to equip them on your robot
                and understand battle readiness requirements.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-4">
        {!hasWeapon ? (
          <>
            <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 mb-4 max-w-2xl">
              <p className="text-yellow-300 text-center font-semibold mb-2">
                💡 Remember: Buy discount facilities BEFORE weapons!
              </p>
              <p className="text-secondary text-sm text-center">
                Visit the Facilities page first to purchase Weapons Workshop (10% discount) and other facilities.
                Then come back here to buy weapons at a discounted price.
              </p>
            </div>
            
            <button
              onClick={() => navigate('/facilities?onboarding=true')}
              className="px-8 py-3 bg-primary hover:bg-blue-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px]"
            >
              Go to Facilities Page First
            </button>
            
            <div className="text-tertiary text-sm">— or —</div>
            
            <button
              onClick={() => navigate('/weapon-shop?onboarding=true')}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px]"
            >
              Go to Weapon Shop
            </button>
            <div className="flex gap-4">
              {onPrevious && (
                <button
                  onClick={onPrevious}
                  className="px-6 py-2 bg-surface-elevated hover:bg-gray-600 text-secondary rounded-lg font-medium transition-colors min-h-[44px]"
                  aria-label="Previous step"
                >
                  Previous
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={isSubmitting}
                className="text-sm text-tertiary hover:text-secondary transition-colors min-h-[44px]"
              >
                Skip for now — I'll buy weapons later
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-4">
              {onPrevious && (
                <button
                  onClick={onPrevious}
                  className="px-6 py-2 bg-surface-elevated hover:bg-gray-600 text-secondary rounded-lg font-medium transition-colors min-h-[44px]"
                  aria-label="Previous step"
                >
                  Previous
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={isSubmitting}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                {isSubmitting ? 'Loading...' : 'Continue to Next Step'}
              </button>
            </div>
            <button
              onClick={() => navigate('/weapon-shop?onboarding=true')}
              className="text-sm text-secondary hover:text-gray-200 transition-colors min-h-[44px]"
            >
              Buy more weapons first
            </button>
          </>
        )}

        <p className="text-sm text-tertiary text-center max-w-md">
          {hasWeapon
            ? 'Ready to continue! You can always buy more weapons later.'
            : 'Buy facilities first for discounts, then purchase weapons.'}
        </p>
      </div>

      {/* Educational Note */}
      <div className="mt-8 max-w-3xl mx-auto bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-gray-200">
            <strong className="text-primary">Tip:</strong> Don't stress about picking the
            "perfect" weapon. You can buy more weapons later and change your loadout at any time.
            The goal right now is to get your robot battle-ready.
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Step7_WeaponPurchase);
