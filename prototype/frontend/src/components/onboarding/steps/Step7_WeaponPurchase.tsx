/**
 * Step7_WeaponPurchase component
 * Guides players through purchasing their first weapon with budget-aware recommendations.
 *
 * Features:
 * - Explain robots require weapons to battle
 * - Explain weapon stats (damage, speed, DPS)
 * - Explain shields vs 2H weapons
 * - Warn against expensive weapons (>₡300K) during onboarding
 * - Navigate to weapon shop with guided overlay
 * - Return to onboarding after weapon purchased
 *
 * Requirements: 10.1-10.14
 */

import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import GuidedUIOverlay from '../GuidedUIOverlay';

interface Step7_WeaponPurchaseProps {
  onNext?: () => void;
}

const EXPENSIVE_THRESHOLD = 300_000;

/** Strategy-specific weapon guidance */
const MULTI_ROBOT_WEAPON_GUIDANCE: Record<string, {
  heading: string;
  points: string[];
}> = {
  '2_average': {
    heading: '2 Robot Strategy: Weapon Reminders',
    points: [
      'You\'ll need at least 2 weapons — one for each robot.',
      'Consider buying 2 affordable weapons (e.g., 2× Machine Gun = ₡300K) rather than 1 expensive one.',
      'Each robot needs its own weapon equipped to be battle-ready.',
      'Weapons can be equipped/unequipped, but only one robot can wield a weapon at any given time.',
    ],
  },
  '3_flimsy': {
    heading: '3 Robot Strategy: Weapon Reminders',
    points: [
      'You\'ll need at least 3 weapons — one for each robot.',
      'Budget-friendly options like Combat Knife (₡100K each, ₡300K total) help stretch your credits.',
      'Base storage holds only 5 weapons — consider the Storage Facility if you need more.',
      'Weapons can be equipped/unequipped, but only one robot can wield a weapon at any given time.',
    ],
  },
};

const Step7_WeaponPurchase = ({ onNext }: Step7_WeaponPurchaseProps) => {
  const { tutorialState, advanceStep } = useOnboarding();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [weaponPurchased, setWeaponPurchased] = useState(false);

  const strategy = tutorialState?.strategy || '1_mighty';
  const multiRobotInfo = MULTI_ROBOT_WEAPON_GUIDANCE[strategy];

  // Check if a weapon was already purchased during onboarding
  const weaponsPurchasedDuringOnboarding = tutorialState?.choices?.weaponsPurchased ?? [];
  const hasWeapon = weaponsPurchasedDuringOnboarding.length > 0;

  // Detect when user returns from weapon shop with a new weapon
  const checkForNewWeapon = useCallback(() => {
    if (hasWeapon || weaponPurchased) return;
    if (weaponsPurchasedDuringOnboarding.length > 0) {
      setWeaponPurchased(true);
    }
  }, [hasWeapon, weaponPurchased, weaponsPurchasedDuringOnboarding.length]);

  useEffect(() => {
    checkForNewWeapon();
  }, [checkForNewWeapon, tutorialState]);

  const handleNavigateToShop = () => {
    setShowOverlay(false);
    navigate('/weapon-shop?onboarding=true');
  };

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

  const handleSkipPurchase = async () => {
    await handleNext();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 text-gray-100">Purchase Your First Weapon</h1>
        <p className="text-lg text-secondary max-w-3xl mx-auto">
          Your robot needs a weapon to enter battles. Choose wisely — your loadout type
          and budget should guide your decision.
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

      {/* Loadout Types & Weapon Compatibility */}
      <div className="mb-8 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-100 flex items-center gap-2">
          <span className="text-2xl">⚔️</span> Loadout Types & Weapon Compatibility
        </h2>
        <p className="text-secondary mb-6 text-sm">
          Your loadout choice determines which weapons you can use and what bonuses you get.
          We recommend starting with <strong className="text-success">Single</strong> or{' '}
          <strong className="text-success">Weapon+Shield</strong> for your first robot.
        </p>
        
        <div className="space-y-4">
          {/* Single Loadout */}
          <div className="bg-surface border border-white/10 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-100 text-lg">Single</h3>
              <span className="text-xs bg-green-700 px-3 py-1 rounded text-white font-semibold">
                Recommended
              </span>
            </div>
            <p className="text-sm text-secondary mb-3">
              One weapon, balanced bonuses. Great for beginners.
            </p>
            <div className="bg-surface-elevated/50 rounded p-3 mb-3">
              <p className="text-xs text-warning font-mono mb-2">Bonuses: +10% Gyro, +5% Servo</p>
              <p className="text-xs text-secondary">Compatible weapons: Any one-handed weapon (not shields)</p>
            </div>
          </div>

          {/* Weapon+Shield Loadout */}
          <div className="bg-surface border border-white/10 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-100 text-lg">Weapon+Shield</h3>
              <span className="text-xs bg-green-700 px-3 py-1 rounded text-white font-semibold">
                Recommended
              </span>
            </div>
            <p className="text-sm text-secondary mb-3">
              Defensive setup with a shield in the off hand.
            </p>
            <div className="bg-surface-elevated/50 rounded p-3 mb-3">
              <p className="text-xs text-warning font-mono mb-2">Bonuses: +20% Shield, +15% Armor, -15% Attack Speed</p>
              <p className="text-xs text-secondary mb-2">Main hand: Any one-handed weapon (not shields)</p>
              <p className="text-xs text-secondary">Off hand: Shield only</p>
            </div>
            <div className="bg-cyan-900/30 border border-cyan-700 rounded p-3">
              <p className="text-xs text-cyan-300">
                <strong>Note:</strong> Shields <strong>do not deal damage</strong> — they only provide defensive bonuses.
                You can only use shields in this loadout type.
              </p>
            </div>
          </div>

          {/* Two-Handed Loadout */}
          <div className="bg-surface border border-white/10 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-100 text-lg">Two-Handed</h3>
              <span className="text-xs bg-purple-700 px-3 py-1 rounded text-white">
                High Damage
              </span>
            </div>
            <p className="text-sm text-secondary mb-3">
              Maximum damage output with a large weapon.
            </p>
            <div className="bg-surface-elevated/50 rounded p-3 mb-3">
              <p className="text-xs text-warning font-mono mb-2">Bonuses: +10% Power, +20% Crit, -10% Evasion, 1.10× damage</p>
              <p className="text-xs text-secondary">Compatible weapons: Two-handed weapons only</p>
            </div>
            <div className="bg-purple-900/30 border border-purple-700 rounded p-3">
              <p className="text-xs text-purple-300">
                <strong>Note:</strong> Two-handed weapons require both hands — you cannot use shields or dual-wield with them.
                Best for aggressive, high-damage strategies.
              </p>
            </div>
          </div>

          {/* Dual-Wield Loadout */}
          <div className="bg-surface border border-white/10 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-100 text-lg">Dual-Wield</h3>
              <span className="text-xs bg-orange-700 px-3 py-1 rounded text-white">
                Fast Attacks
              </span>
            </div>
            <p className="text-sm text-secondary mb-3">
              Two one-handed weapons for rapid strikes.
            </p>
            <div className="bg-surface-elevated/50 rounded p-3 mb-3">
              <p className="text-xs text-warning font-mono mb-2">Bonuses: +30% Attack Speed, +15% Control, -20% Penetration, -10% Power</p>
              <p className="text-xs text-secondary">Compatible weapons: Two one-handed weapons (not shields)</p>
            </div>
          </div>
        </div>
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

      {/* Weapon Purchased Success */}
      {(hasWeapon || weaponPurchased) && (
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">✅</span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-success mb-2">Weapon Purchased!</h2>
              <p className="text-gray-200">
                You've purchased a weapon. Next, you'll learn how to equip it on your robot
                and understand battle readiness requirements.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-4">
        {!(hasWeapon || weaponPurchased) ? (
          <>
            <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 mb-4 max-w-2xl">
              <p className="text-yellow-300 text-center font-semibold mb-2">
                💡 Remember: Buy discount facilities BEFORE weapons!
              </p>
              <p className="text-secondary text-sm text-center">
                Visit the Facilities page first to purchase Weapons Workshop (5% discount) and other facilities.
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
              id="visit-weapon-shop-button"
              onClick={() => setShowOverlay(true)}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px]"
            >
              Skip to Weapon Shop
            </button>
            <button
              onClick={handleSkipPurchase}
              disabled={isSubmitting}
              className="text-sm text-secondary hover:text-gray-200 transition-colors min-h-[44px]"
            >
              Skip for now — I'll buy facilities and weapons later
            </button>
          </>
        ) : (
          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSubmitting ? 'Loading...' : 'Next: Battle Readiness & Repair Costs'}
          </button>
        )}

        <p className="text-sm text-secondary text-center max-w-md">
          {hasWeapon || weaponPurchased
            ? 'Your weapon is ready. Let\'s learn about equipping it and battle readiness.'
            : 'Buy facilities first for discounts, then purchase weapons.'}
        </p>
      </div>

      {/* Guided UI Overlay for Visit Weapon Shop button */}
      {showOverlay && (
        <GuidedUIOverlay
          targetSelector="#visit-weapon-shop-button"
          tooltipContent={
            <div>
              <p className="font-semibold text-primary mb-2">Visit the Weapon Shop</p>
              <p className="mb-2 text-gray-200">
                Click to go to the weapon shop where you can browse and purchase weapons.
                Look for budget-friendly options under ₡{EXPENSIVE_THRESHOLD.toLocaleString()}.
              </p>
              <p className="text-sm text-secondary">
                After purchasing a weapon, you'll return here to continue the tutorial.
              </p>
            </div>
          }
          position="top"
          onNext={handleNavigateToShop}
          showNext={true}
          showPrevious={false}
          onClose={() => setShowOverlay(false)}
        />
      )}

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
