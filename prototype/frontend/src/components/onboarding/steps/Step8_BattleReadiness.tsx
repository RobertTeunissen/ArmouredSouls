/**
 * Step8_BattleReadiness component
 * Teaches new players about battle readiness requirements and repair costs.
 *
 * Features:
 * - Navigate to robot detail page with guided overlay
 * - Highlight loadout section
 * - Guide player to equip weapon
 * - Show updated robot stats with weapon bonuses
 * - Explain repair cost mechanics (per HP, attribute scaling, destruction penalty)
 * - Introduce yielding as a cost-saving strategy
 * - Explain HP doesn't regenerate, shields do
 * - Explain battle readiness requirements (HP >0, weapon equipped)
 * - For multi-robot strategies, explain repair costs multiply
 *
 * Requirements: 11.1-11.11, 12.1-12.11
 */

import { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import GuidedUIOverlay from '../GuidedUIOverlay';

interface Step8_BattleReadinessProps {
  onNext?: () => void;
  onPrevious?: () => void;
  playerChoices?: { strategy?: string; [key: string]: unknown };
}

/** Battle readiness checklist items */
const READINESS_CHECKLIST = [
  {
    id: 'hp',
    label: 'HP above 0',
    description: 'Your robot must have hit points remaining to enter battle.',
    icon: '❤️',
  },
  {
    id: 'weapon',
    label: 'Weapon equipped',
    description: 'At least one weapon must be equipped in your loadout.',
    icon: '⚔️',
  },
];

/** Strategy-specific multi-robot repair cost guidance */
const MULTI_ROBOT_REPAIR_GUIDANCE: Record<string, {
  heading: string;
  points: string[];
  robotCount: number;
}> = {
  '2_average': {
    heading: '2 Robot Strategy: Repair Cost Considerations',
    robotCount: 2,
    points: [
      'With 2 robots, your repair costs accumulate across both robots after battles.',
      'Consider yielding one robot if both are taking heavy damage to save on repair costs.',
      'Stagger upgrades — a robot with lower attributes costs less to repair.',
      'If one robot is heavily damaged, consider benching it until you can afford repairs.',
    ],
  },
  '3_flimsy': {
    heading: '3 Robot Strategy: Repair Cost Considerations',
    robotCount: 3,
    points: [
      'With 3 robots, repair costs can add up quickly after battle cycles.',
      'Lower-attribute robots are cheaper to repair — this is an advantage of the flimsy strategy.',
      'Use yielding strategically to minimize repair costs when battles aren\'t going well.',
      'Prioritize repairing robots that are closest to battle-ready over fully repairing all.',
    ],
  },
};

const Step8_BattleReadiness = ({ onNext, onPrevious }: Step8_BattleReadinessProps) => {
  const { tutorialState, advanceStep } = useOnboarding();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const strategy = tutorialState?.strategy || '1_mighty';
  const multiRobotInfo = MULTI_ROBOT_REPAIR_GUIDANCE[strategy];

  const handleNavigateToRobots = () => {
    setShowOverlay(false);
    navigate('/robots?onboarding=true');
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

  const handlePrevious = () => {
    onPrevious?.();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" role="main" aria-label="Battle Readiness and Repair Costs">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 text-gray-100">Battle Readiness & Repair Costs</h1>
        <p className="text-lg text-secondary max-w-3xl mx-auto">
          Before your robot can fight, it needs to meet battle readiness requirements.
          After battles, you'll need to understand repair costs to manage your budget.
        </p>
      </div>

      {/* Battle Readiness Requirements */}
      <section className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto" aria-label="Battle Readiness Requirements">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">🛡️</span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-primary mb-4">
              Battle Readiness Requirements
            </h2>
            <p className="text-gray-200 mb-4">
              Your robot must meet <strong>both</strong> requirements to participate in battles:
            </p>
            <div className="space-y-3" role="list" aria-label="Battle readiness checklist">
              {READINESS_CHECKLIST.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 bg-surface/50 rounded-lg p-3"
                  role="listitem"
                >
                  <span className="text-2xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-100">{item.label}</p>
                    <p className="text-sm text-secondary">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-secondary mt-4">
              That's it! No minimum credit balance required. You can battle even with low credits,
              but you'll need to manage repair costs carefully.
            </p>
          </div>
        </div>
      </section>

      {/* HP vs Shield Regeneration */}
      <section className="bg-surface border border-white/10 rounded-lg p-6 mb-8 max-w-4xl mx-auto" aria-label="HP vs Shield Regeneration">
        <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-2xl">💡</span> HP vs Shield Regeneration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* HP Card */}
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
            <h3 className="font-bold text-error mb-2 flex items-center gap-2">
              <span>❤️</span> Hit Points (HP)
            </h3>
            <p className="text-gray-200 text-sm mb-2">
              HP does <strong className="text-error">NOT</strong> regenerate between battles.
            </p>
            <p className="text-secondary text-sm">
              Once your robot takes damage, you must pay credits to repair it.
              If HP reaches 0, the robot cannot battle until repaired.
            </p>
          </div>

          {/* Shield Card */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
              <span>🛡️</span> Shields
            </h3>
            <p className="text-gray-200 text-sm mb-2">
              Shields <strong className="text-primary">DO</strong> regenerate between battles.
            </p>
            <p className="text-secondary text-sm">
              Shield points fully restore after each battle at no cost.
              Investing in shield attributes can reduce your long-term repair expenses.
            </p>
          </div>
        </div>
      </section>

      {/* Repair Cost Mechanics */}
      <section className="bg-surface border border-white/10 rounded-lg p-6 mb-8 max-w-4xl mx-auto" aria-label="Repair Cost Mechanics">
        <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-2xl">🔧</span> How Repair Costs Work
        </h2>
        <div className="space-y-4">
          <div className="bg-surface-elevated/50 rounded-lg p-4">
            <h3 className="font-semibold text-warning mb-2">💰 Cost Per HP Damage</h3>
            <p className="text-gray-200 text-sm">
              You pay a certain amount of credits for each HP point of damage your robot takes.
              The exact cost depends on your robot's attributes.
            </p>
          </div>

          <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-success mb-2">🏷️ 50% Manual Repair Discount</h3>
            <p className="text-gray-200 text-sm mb-2">
              When you manually repair your robots using the <strong>"Repair All"</strong> button
              on the Robots page, you get a <strong className="text-success">50% discount</strong> on
              repair costs. This stacks with your Repair Bay discount.
            </p>
            <p className="text-secondary text-xs">
              Automatic repairs during battle cycles pay full price. Repairing manually between
              cycles is always cheaper — stay active to save credits.
            </p>
          </div>

          <div className="bg-surface-elevated/50 rounded-lg p-4">
            <h3 className="font-semibold text-orange-400 mb-2">📈 Higher Attributes = Higher Costs</h3>
            <p className="text-gray-200 text-sm mb-2">
              Robots with higher attribute levels cost more to repair per HP.
              This is the trade-off for having a more powerful robot.
            </p>
            <p className="text-secondary text-xs">
              Example: A robot with all attributes at Level 1 costs less to repair than one with
              attributes at Level 5, even for the same amount of HP damage.
            </p>
          </div>

          <div className="bg-surface-elevated/50 rounded-lg p-4">
            <h3 className="font-semibold text-error mb-2">💥 Destruction Penalty</h3>
            <p className="text-gray-200 text-sm mb-2">
              If your robot is <strong>destroyed</strong> (HP reaches 0), repair costs are significantly higher
              than if you had yielded before destruction.
            </p>
            <p className="text-secondary text-xs">
              This is why yielding strategically is important — it can save you a lot of credits.
            </p>
          </div>
        </div>
      </section>

      {/* Yielding Introduction */}
      <section className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-6 mb-8 max-w-4xl mx-auto" aria-label="Yielding Strategy">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">🏳️</span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-warning mb-3">
              Yielding: Your Cost-Saving Strategy
            </h2>
            <p className="text-gray-200 mb-4">
              <strong>Yielding</strong> is when you surrender a battle before your robot is destroyed.
              This is a critical strategy for managing repair costs.
            </p>
            
            <div className="bg-surface/50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-yellow-300 mb-2">Why Yield?</h3>
              <ul className="space-y-2 text-sm text-gray-200">
                <li className="flex items-start gap-2">
                  <span className="text-warning">•</span>
                  <span><strong>Lower repair costs</strong> — Yielding before destruction avoids the destruction penalty</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning">•</span>
                  <span><strong>Preserve HP</strong> — Your robot keeps whatever HP it had when you yielded</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning">•</span>
                  <span><strong>Strategic retreat</strong> — Sometimes losing gracefully is better than losing expensively</span>
                </li>
              </ul>
            </div>

            <div className="bg-surface/50 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-300 mb-2">When to Yield?</h3>
              <ul className="space-y-2 text-sm text-gray-200">
                <li className="flex items-start gap-2">
                  <span className="text-warning">•</span>
                  <span>When your robot is heavily damaged and likely to be destroyed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning">•</span>
                  <span>When you're low on credits and can't afford expensive repairs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning">•</span>
                  <span>When the battle is clearly lost and continuing would only increase costs</span>
                </li>
              </ul>
            </div>

            <p className="text-sm text-secondary mt-4">
              You can set a <strong>yield threshold</strong> on your robot's detail page. When HP drops
              below this percentage, your robot will automatically yield to save on repair costs.
            </p>
          </div>
        </div>
      </section>

      {/* Weapon Equipping Guidance */}
      <section className="bg-surface border border-white/10 rounded-lg p-6 mb-8 max-w-4xl mx-auto" aria-label="Equip Your Weapon">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">⚔️</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-100 mb-2">
              Equip Your Weapon
            </h2>
            <p className="text-gray-200 mb-3">
              Visit your robot's detail page to equip the weapon you purchased.
              The loadout section lets you assign weapons to your robot's slots.
            </p>
            <p className="text-sm text-secondary mb-3">
              Once equipped, your robot's stats will update to reflect weapon attribute bonuses.
              Check the stat changes to see how your weapon improves your robot's combat effectiveness.
            </p>
          </div>
        </div>
      </section>

      {/* Multi-Robot Strategy Guidance */}
      {multiRobotInfo && (
        <section className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto" aria-label="Multi-robot repair costs">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">🤖</span>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-primary mb-3">
                {multiRobotInfo.heading}
              </h2>
              <ul className="space-y-3" role="list">
                {multiRobotInfo.points.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-200" role="listitem">
                    <span className="text-primary flex-shrink-0">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-4">
        <button
          id="go-to-robot-detail-button"
          onClick={() => setShowOverlay(true)}
          className="px-8 py-3 bg-primary hover:bg-blue-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px]"
          aria-label="Go to Robot Detail"
        >
          Go to Robot Detail
        </button>

        <div className="flex gap-4 mt-2">
          <button
            onClick={handlePrevious}
            className="px-6 py-2 bg-surface-elevated hover:bg-gray-600 text-secondary rounded-lg font-medium transition-colors min-h-[44px]"
            aria-label="Previous step"
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            aria-label="Next step"
          >
            {isSubmitting ? 'Loading...' : 'Next'}
          </button>
        </div>

        <p className="text-sm text-secondary text-center max-w-md">
          Visit your robot's detail page to equip your weapon and check battle readiness.
        </p>
      </div>

      {/* Guided UI Overlay */}
      {showOverlay && (
        <GuidedUIOverlay
          targetSelector="#go-to-robot-detail-button"
          tooltipContent={
            <div>
              <p className="font-semibold text-primary mb-2">Visit Robot Detail Page</p>
              <p className="mb-2 text-gray-200">
                Go to your robot's detail page to equip your weapon and check battle readiness status.
                Look for the loadout section to assign your weapon.
              </p>
              <p className="text-sm text-secondary">
                After equipping your weapon, your robot's stats will update with weapon bonuses.
              </p>
            </div>
          }
          position="top"
          onNext={handleNavigateToRobots}
          showNext={true}
          showPrevious={false}
          onClose={() => setShowOverlay(false)}
        />
      )}

      {/* Educational Note */}
      <div className="mt-8 max-w-3xl mx-auto bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-gray-200">
            <strong className="text-primary">Tip:</strong> Shields are your best friend for reducing
            repair costs. Since shields regenerate for free, investing in shield attributes means
            less HP damage and lower repair bills over time. Combine this with smart yielding and
            the 50% manual repair discount (use the Repair All button between cycles) for
            maximum cost efficiency.
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Step8_BattleReadiness);
