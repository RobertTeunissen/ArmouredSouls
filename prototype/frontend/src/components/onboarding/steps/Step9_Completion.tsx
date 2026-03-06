/**
 * Step9_Completion component
 * Final step of the onboarding tutorial — shows summary, recommendations, and next steps.
 *
 * Features:
 * - Display summary of player's choices (strategy, robots, weapons)
 * - Explain daily cycle system with visual diagram
 * - Explain league progression and tournaments
 * - Guide to facilities page
 * - Guide to robot attributes
 * - Provide links to key pages
 * - Display "Complete Tutorial" button
 *
 * Requirements: 13.1-13.15, 15.1-15.11
 */

import { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../../contexts/OnboardingContext';

interface Step9_CompletionProps {
  onNext: () => void;
  onPrevious: () => void;
  playerChoices?: { strategy?: string; [key: string]: unknown };
}

/** Strategy display names */
const STRATEGY_NAMES: Record<string, string> = {
  '1_mighty': '1 Mighty Robot',
  '2_average': '2 Average Robots',
  '3_flimsy': '3 Flimsy Robots',
};

/** Strategy descriptions for the summary */
const STRATEGY_SUMMARIES: Record<string, string> = {
  '1_mighty': 'You chose to focus all resources on a single powerful robot. This gives you the strongest individual fighter with the best attributes.',
  '2_average': 'You chose a balanced approach with two robots. This gives you flexibility and a backup if one robot is damaged.',
  '3_flimsy': 'You chose to spread resources across three robots. This maximizes your battle participation and league coverage.',
};

/** Attribute categories with descriptions */
const ATTRIBUTE_CATEGORIES = [
  {
    category: 'Offensive',
    icon: '⚔️',
    color: 'text-red-400',
    attributes: [
      { name: 'Combat Power', effect: 'Increases damage dealt' },
      { name: 'Targeting Systems', effect: 'Improves hit accuracy' },
      { name: 'Critical Systems', effect: 'Increases critical hit chance' },
      { name: 'Penetration', effect: 'Bypasses enemy armor' },
      { name: 'Weapon Control', effect: 'Improves weapon effectiveness' },
      { name: 'Attack Speed', effect: 'Reduces time between attacks' },
    ],
  },
  {
    category: 'Defensive',
    icon: '🛡️',
    color: 'text-blue-400',
    attributes: [
      { name: 'Armor Plating', effect: 'Increases HP (hit points)' },
      { name: 'Shield Capacity', effect: 'Increases shield points' },
      { name: 'Evasion Thrusters', effect: 'Chance to dodge attacks' },
      { name: 'Damage Dampeners', effect: 'Reduces damage taken' },
      { name: 'Counter Protocols', effect: 'Chance to counter-attack' },
      { name: 'Hull Integrity', effect: 'Increases overall durability' },
    ],
  },
  {
    category: 'Mobility',
    icon: '⚡',
    color: 'text-yellow-400',
    attributes: [
      { name: 'Servo Motors', effect: 'Improves movement speed' },
      { name: 'Gyro Stabilizers', effect: 'Improves balance and stability' },
      { name: 'Hydraulic Systems', effect: 'Increases power output' },
    ],
  },
  {
    category: 'Systems',
    icon: '🧠',
    color: 'text-purple-400',
    attributes: [
      { name: 'Power Core', effect: 'Increases energy capacity' },
      { name: 'Combat Algorithms', effect: 'Improves tactical decisions' },
      { name: 'Threat Analysis', effect: 'Better target prioritization' },
      { name: 'Adaptive AI', effect: 'Learns from battles' },
      { name: 'Logic Cores', effect: 'Improves processing speed' },
    ],
  },
  {
    category: 'Team Support',
    icon: '🤝',
    color: 'text-green-400',
    attributes: [
      { name: 'Sync Protocols', effect: 'Better team coordination' },
      { name: 'Support Systems', effect: 'Assists teammates' },
      { name: 'Formation Tactics', effect: 'Improves team positioning' },
    ],
  },
];

const Step9_Completion = ({ onNext, onPrevious }: Step9_CompletionProps) => {
  const { tutorialState, completeTutorial, setStep, error: contextError } = useOnboarding();
  const navigate = useNavigate();
  const [isCompleting, setIsCompleting] = useState(false);
  const completionAttempted = useRef(false);

  const strategy = tutorialState?.strategy || '1_mighty';
  const strategyName = STRATEGY_NAMES[strategy] || STRATEGY_NAMES['1_mighty'];
  const strategySummary = STRATEGY_SUMMARIES[strategy] || STRATEGY_SUMMARIES['1_mighty'];

  // Navigate to dashboard after successful completion
  useEffect(() => {
    if (completionAttempted.current && tutorialState?.hasCompletedOnboarding) {
      navigate('/dashboard');
      onNext();
    }
  }, [tutorialState?.hasCompletedOnboarding, navigate, onNext]);

  // Derive completion error from context error when a completion was attempted
  const completionError = completionAttempted.current && contextError ? contextError : null;

  const handleCompleteTutorial = async () => {
    setIsCompleting(true);
    completionAttempted.current = true;
    await completeTutorial();
    setIsCompleting(false);
  };

  const handleReplayTutorial = async () => {
    try {
      await setStep(1);
    } catch {
      // Error is handled by context
    }
  };

  const handlePrevious = () => {
    onPrevious();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" role="main" aria-label="Tutorial Completion">
      {/* Congratulations Header */}
      <div className="text-center mb-8">
        <span className="text-5xl mb-4 block" role="img" aria-label="Trophy">🏆</span>
        <h1 className="text-3xl font-bold mb-3 text-gray-100">Congratulations, Commander!</h1>
        <p className="text-lg text-gray-200 max-w-3xl mx-auto">
          You've completed the Armoured Souls onboarding tutorial.
          You now have the knowledge to build, equip, and battle your way to the top.
        </p>
      </div>

      {/* Strategy Summary */}
      <section
        className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto"
        aria-label="Your Strategy Summary"
      >
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">🤖</span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-blue-400 mb-2">Your Strategy Summary</h2>
            <p className="text-gray-200 mb-3">
              <strong className="text-gray-100">Chosen Strategy:</strong>{' '}
              <span data-testid="strategy-name">{strategyName}</span>
            </p>
            <p className="text-gray-300 text-sm">{strategySummary}</p>
          </div>
        </div>
      </section>

      {/* Daily Cycle System with Diagram */}
      <section
        className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto"
        aria-label="Daily Cycle System"
      >
        <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-2xl">🔄</span> Daily Cycle System
        </h2>
        <p className="text-gray-200 mb-4">
          Armoured Souls runs on an <strong className="text-blue-400">automated daily cycle</strong>.
          Each day at specific times, the game processes battles, updates standings, and distributes rewards.
        </p>
        
        {/* Cycle Schedule Diagram */}
        <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
          <img 
            src="/assets/onboarding/diagrams/cycle-schedule.svg" 
            alt="Daily cycle schedule showing league battles at 8 PM, tournaments at 8 AM, tag team at 12 PM, and settlement at 11 PM"
            className="w-full max-w-2xl mx-auto"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-100 mb-2 flex items-center gap-2">
              <span>⚔️</span> League Battles (8 PM UTC)
            </h3>
            <p className="text-sm text-gray-200">
              Your battle-ready robots automatically fight in their leagues.
              Win to earn League Points and climb the rankings.
            </p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-100 mb-2 flex items-center gap-2">
              <span>🏆</span> Tournaments (8 AM UTC)
            </h3>
            <p className="text-sm text-gray-200">
              Special competitive events with bracket-style elimination.
              Higher rewards but more challenging opponents.
            </p>
          </div>
        </div>
      </section>

      {/* League Progression */}
      <section
        className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto"
        aria-label="League Progression"
      >
        <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-2xl">📈</span> League Progression
        </h2>
        <p className="text-gray-200 mb-4">
          Your robots compete in leagues based on their performance. Here's how progression works:
        </p>
        
        <div className="space-y-3">
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
            <h3 className="font-semibold text-green-400 mb-2">🔼 Promotion</h3>
            <p className="text-sm text-gray-200">
              Finish in the <strong>top positions</strong> of your league to get promoted to a higher league.
              Higher leagues mean tougher competition but better rewards.
            </p>
          </div>
          
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <h3 className="font-semibold text-blue-400 mb-2">↔️ Stay</h3>
            <p className="text-sm text-gray-200">
              Finish in the <strong>middle positions</strong> to remain in your current league.
              Keep improving to push for promotion next cycle.
            </p>
          </div>
          
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <h3 className="font-semibold text-red-400 mb-2">🔽 Relegation</h3>
            <p className="text-sm text-gray-200">
              Finish in the <strong>bottom positions</strong> to get relegated to a lower league.
              Don't worry — you can always climb back up!
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-300 mt-4">
          Check the <strong>League Standings</strong> page to see your current position and promotion/relegation zones.
        </p>
      </section>

      {/* Facilities Guide */}
      <section
        className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto"
        aria-label="Facilities"
      >
        <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-2xl">🏭</span> Facilities: Your Economic Engine
        </h2>
        <p className="text-gray-200 mb-4">
          Facilities provide passive income, discounts, and other benefits. Visit the{' '}
          <strong className="text-blue-400">Facilities page</strong> to:
        </p>
        
        <ul className="space-y-2 mb-4">
          <li className="flex items-start gap-2 text-gray-200">
            <span className="text-green-400">•</span>
            <span><strong>Build facilities</strong> like Training Facility, Weapons Workshop, Repair Bay</span>
          </li>
          <li className="flex items-start gap-2 text-gray-200">
            <span className="text-green-400">•</span>
            <span><strong>Upgrade facilities</strong> to increase their benefits</span>
          </li>
          <li className="flex items-start gap-2 text-gray-200">
            <span className="text-green-400">•</span>
            <span><strong>Earn passive income</strong> from Merchandising Hub and Streaming Studio</span>
          </li>
          <li className="flex items-start gap-2 text-gray-200">
            <span className="text-green-400">•</span>
            <span><strong>Get discounts</strong> on weapons, training, and repairs</span>
          </li>
        </ul>

        <button
          onClick={() => navigate('/facilities')}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
        >
          Go to Facilities Page
        </button>
      </section>

      {/* Robot Attributes Guide */}
      <section
        className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto"
        aria-label="Robot Attributes"
      >
        <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-2xl">⚙️</span> Robot Attributes: Power Up Your Robots
        </h2>
        <p className="text-gray-200 mb-4">
          Your robots have 23 different attributes that affect their combat performance.
          Visit your <strong className="text-blue-400">Robot Detail page</strong> to upgrade them.
        </p>

        <div className="space-y-4 mb-4">
          {ATTRIBUTE_CATEGORIES.map((category) => (
            <div key={category.category} className="bg-gray-900/50 rounded-lg p-4">
              <h3 className={`font-semibold ${category.color} mb-3 flex items-center gap-2`}>
                <span>{category.icon}</span> {category.category} Attributes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {category.attributes.map((attr) => (
                  <div key={attr.name} className="text-sm">
                    <span className="text-gray-200 font-medium">{attr.name}:</span>{' '}
                    <span className="text-gray-300">{attr.effect}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-200">
            <strong className="text-yellow-400">Remember:</strong> Higher attributes mean higher repair costs.
            Balance power with affordability based on your strategy.
          </p>
        </div>

        <button
          onClick={() => navigate('/robots')}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
        >
          Go to Robots Page
        </button>
      </section>

      {/* Recommended Next Steps */}
      <section
        className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto"
        aria-label="Recommended Next Steps"
      >
        <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-2xl">💡</span> Recommended Next Steps
        </h2>
        <p className="text-gray-200 mb-4">
          Here's what we suggest doing next (but you're free to do whatever you want!):
        </p>
        <ol className="space-y-3 mb-4 list-decimal list-inside">
          <li className="text-gray-200">
            <strong>Build your first facility</strong> — Start with Training Facility or Repair Bay for immediate benefits
          </li>
          <li className="text-gray-200">
            <strong>Upgrade robot attributes</strong> — Focus on offensive or defensive stats based on your strategy
          </li>
          <li className="text-gray-200">
            <strong>Check battle readiness</strong> — Make sure your robots are ready for the next cycle
          </li>
          <li className="text-gray-200">
            <strong>Monitor your finances</strong> — Keep enough credits for repairs and upgrades
          </li>
        </ol>
      </section>

      {/* Player Control Emphasis */}
      <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 mb-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🎮</span>
          <div className="text-sm text-gray-200">
            <strong className="text-yellow-400">Remember:</strong> Everything in this tutorial
            was guidance, not rules. You have full control over how you play Armoured Souls.
            Experiment, adapt, and find the strategy that works best for you.
          </div>
        </div>
      </div>

      {/* Error Message */}
      {completionError && (
        <div
          className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6 max-w-4xl mx-auto text-center"
          role="alert"
        >
          <p className="text-red-400">{completionError}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={handleCompleteTutorial}
          disabled={isCompleting}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Complete Tutorial"
        >
          {isCompleting ? 'Completing...' : 'Complete Tutorial & Start Playing'}
        </button>

        <div className="flex gap-4 mt-2">
          <button
            onClick={handlePrevious}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors"
            aria-label="Previous step"
          >
            Previous
          </button>
          <button
            onClick={handleReplayTutorial}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors"
            aria-label="Replay Tutorial"
          >
            Replay Tutorial
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(Step9_Completion);
