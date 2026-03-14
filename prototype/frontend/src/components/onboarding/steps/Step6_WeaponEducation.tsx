/**
 * Step6_WeaponEducation component
 * Educates players about weapon types, loadout configurations, bonuses/penalties,
 * weapon slot configuration, and loadout restrictions.
 *
 * Features:
 * - Explain 4 weapon types (Energy, Ballistic, Melee, Shield)
 * - Display LoadoutDiagram for each loadout type
 * - Explain loadout bonuses and penalties
 * - Show weapon slot configuration (main + offhand)
 * - Explain loadout restrictions (shields, two-handed, dual-wield)
 * - For 2-3 robot strategies, explain weapon sharing and storage
 *
 * Requirements: 7.1-7.13, 10.1-10.14
 */

import { useState, memo } from 'react';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import LoadoutDiagram from '../LoadoutDiagram';
import type { LoadoutType } from '../LoadoutDiagram';

interface Step6_WeaponEducationProps {
  onNext?: () => void;
}

/** All four loadout types */
const LOADOUT_TYPES: LoadoutType[] = ['single', 'weapon_shield', 'two_handed', 'dual_wield'];

/** Strategy-specific weapon/storage guidance */
const MULTI_ROBOT_GUIDANCE: Record<string, {
  heading: string;
  points: string[];
}> = {
  '2_average': {
    heading: '2 Robot Strategy: Weapon Considerations',
    points: [
      'Each robot needs its own weapon(s) — weapons cannot be shared between robots simultaneously.',
      'You\'ll need at least 2 weapons (one per robot), possibly 3-4 depending on loadout choices.',
      'Consider the Storage Facility if you plan to keep spare weapons for different strategies.',
      'You can give each robot a different loadout type for strategic variety.',
    ],
  },
  '3_flimsy': {
    heading: '3 Robot Strategy: Weapon Considerations',
    points: [
      'Each robot needs its own weapon(s) — you\'ll need at least 3 weapons, possibly 6 for dual-wield.',
      'The Storage Facility is essential — base storage only holds 5 weapons.',
      'Budget-friendly weapons like Combat Knife (₡100K) help stretch your credits across 3 robots.',
      'Consider mixing loadout types: one defensive (Weapon+Shield), one offensive (Two-Handed), one balanced (Single).',
    ],
  },
};

const Step6_WeaponEducation = ({ onNext }: Step6_WeaponEducationProps) => {
  const { tutorialState, advanceStep } = useOnboarding();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedLoadout, setExpandedLoadout] = useState<LoadoutType | null>(null);

  const strategy = tutorialState?.strategy || '1_mighty';
  const multiRobotInfo = MULTI_ROBOT_GUIDANCE[strategy];

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

  const toggleLoadout = (loadout: LoadoutType) => {
    setExpandedLoadout(expandedLoadout === loadout ? null : loadout);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 text-gray-100">Weapon Types & Loadouts</h1>
        <p className="text-lg text-secondary max-w-3xl mx-auto">
          Before purchasing weapons, learn about the four weapon types and how loadout
          configurations affect your robot's combat performance.
        </p>
      </div>

      {/* Weapon Type Overview */}
      <div className="mb-10 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4 text-gray-100">Understanding Weapons</h2>
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">ℹ️</span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-primary mb-2">
                Weapon Flexibility
              </h3>
              <p className="text-secondary">
                Any weapon can be equipped and unequipped at any time. However,{' '}
                <strong className="text-warning">only one robot can wield a weapon at any given time</strong>.
                If you want multiple robots to fight simultaneously, each needs its own weapon.
              </p>
            </div>
          </div>
        </div>
        <p className="text-secondary mb-6">
          What matters most for weapons is the <strong className="text-primary">loadout configuration</strong> and{' '}
          <strong className="text-primary">attribute bonuses</strong> each weapon provides. These determine
          your robot's combat effectiveness.
        </p>
      </div>

      {/* Weapon Slot Explanation */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-10 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">🔧</span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-primary mb-2">
              Weapon Slots: Main Hand & Off Hand
            </h2>
            <p className="text-secondary mb-3">
              Every robot has two weapon slots: a <strong>main hand</strong> and an{' '}
              <strong>off hand</strong>. How these slots are used depends on your chosen loadout type.
            </p>
            <ul className="space-y-2 text-sm text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-primary flex-shrink-0">•</span>
                <span><strong>Single:</strong> Main hand holds one weapon, off hand is empty</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary flex-shrink-0">•</span>
                <span><strong>Weapon+Shield:</strong> Main hand holds a weapon, off hand holds a shield</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary flex-shrink-0">•</span>
                <span><strong>Two-Handed:</strong> A large weapon occupies both slots</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary flex-shrink-0">•</span>
                <span><strong>Dual-Wield:</strong> Each hand holds a one-handed weapon</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Loadout Configurations */}
      <div className="mb-10 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-2 text-gray-100">Loadout Configurations</h2>
        <p className="text-secondary mb-6">
          Your loadout type determines combat bonuses and penalties. Each has trade-offs —
          choose based on your preferred playstyle.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {LOADOUT_TYPES.map((loadout) => (
            <div key={loadout}>
              <button
                onClick={() => toggleLoadout(loadout)}
                className="w-full text-left mb-2"
                aria-expanded={expandedLoadout === loadout}
                aria-controls={`loadout-details-${loadout}`}
              >
                <LoadoutDiagram
                  loadoutType={loadout}
                  showDetails={expandedLoadout === loadout}
                  compact={expandedLoadout !== loadout}
                />
              </button>
            </div>
          ))}
        </div>

        <p className="text-sm text-tertiary mt-4 text-center">
          Click any loadout card to expand or collapse its details.
        </p>
      </div>

      {/* Loadout Restrictions Summary */}
      <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-6 mb-10 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-warning mb-3">
              Loadout Restrictions
            </h2>
            <ul className="space-y-2 text-secondary text-sm">
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 flex-shrink-0">•</span>
                <span>Shields can <strong>only</strong> be equipped in the off hand with the Weapon+Shield loadout</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 flex-shrink-0">•</span>
                <span>Two-handed weapons occupy <strong>both</strong> slots — no off hand weapon allowed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 flex-shrink-0">•</span>
                <span>Dual-wield requires <strong>two one-handed</strong> weapons — no shields or two-handed weapons</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 flex-shrink-0">•</span>
                <span>Weapon attribute bonuses <strong>stack</strong> with your robot's base attributes, effectively raising caps</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Attribute Bonus Stacking */}
      <div className="bg-surface border border-white/10 rounded-lg p-6 mb-10 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">📈</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-100 mb-2">
              How Weapon Bonuses Stack
            </h2>
            <p className="text-secondary mb-3">
              Weapons provide attribute bonuses that add to your robot's base stats. Combined with
              loadout percentage bonuses, this can significantly boost your combat effectiveness.
            </p>
            <div className="bg-background/50 rounded-lg p-4 text-sm space-y-2">
              <p className="text-secondary">
                <strong className="text-primary">Example:</strong> A robot with base Combat Power 10
                equips a weapon with +3 Combat Power bonus using Two-Handed loadout (+10% Combat Power):
              </p>
              <p className="text-yellow-300 font-mono">
                Effective = (10 + 3) × 1.10 = 14.3 → 14 Combat Power
              </p>
              <p className="text-secondary">
                Choosing complementary weapons and loadouts maximizes your robot's total attribute scores.
              </p>
            </div>
            <img
              src="/assets/onboarding/loadouts/attribute-bonus-stacking.svg"
              alt="Diagram showing how weapon attribute bonuses stack with robot base attributes and loadout multipliers"
              className="mt-4 w-full max-w-[500px] mx-auto rounded-lg"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      {/* Multi-Robot Strategy Guidance */}
      {multiRobotInfo && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-10 max-w-4xl mx-auto">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">🤖</span>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-primary mb-3">
                {multiRobotInfo.heading}
              </h2>
              <ul className="space-y-3">
                {multiRobotInfo.points.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-secondary">
                    <span className="text-primary flex-shrink-0">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={handleNext}
          disabled={isSubmitting}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {isSubmitting ? 'Loading...' : 'Next: Facility & Weapon Planning'}
        </button>

        <p className="text-sm text-tertiary text-center max-w-md">
          Remember: Buy discount facilities (Weapons Workshop, Training Facility) BEFORE purchasing weapons and upgrading attributes.
        </p>
      </div>

      {/* Educational Note */}
      <div className="mt-8 max-w-3xl mx-auto bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-secondary">
            <strong className="text-primary">Tip:</strong> You don't need to memorize all loadout
            details now. You can change your loadout at any time from the robot detail page.
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Step6_WeaponEducation);
