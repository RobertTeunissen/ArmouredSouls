/**
 * Step5_RobotCreation component
 * Guides players through creating their first robot with context from their chosen strategy.
 *
 * Features:
 * - Display explanation of robot purpose and cost (₡500,000)
 * - Remind player of chosen strategy
 * - Highlight "Create New Robot" button with GuidedUIOverlay
 * - Show remaining budget after creation
 * - Explain attribute upgrades should wait until after Training Facility
 * - Advance to Step 6 when robot created
 *
 * Requirements: 9.1-9.10
 */

import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useAuth } from '../../../contexts/AuthContext';
import GuidedUIOverlay from '../GuidedUIOverlay';

interface Step5_RobotCreationProps {
  onNext?: () => void;
}

const ROBOT_COST = 500000;
const STARTING_BUDGET = 3_000_000;

/** Strategy-specific robot creation guidance */
const STRATEGY_ROBOT_INFO: Record<string, {
  name: string;
  totalRobots: number;
  totalRobotCost: number;
  description: string;
  tip: string;
}> = {
  '1_mighty': {
    name: '1 Mighty Robot',
    totalRobots: 1,
    totalRobotCost: 500000,
    description: 'You only need one robot — pour all your resources into making it powerful.',
    tip: 'This is your only robot, so choose a name you love. All future upgrades and weapons go to this one.',
  },
  '2_average': {
    name: '2 Average Robots',
    totalRobots: 2,
    totalRobotCost: 1000000,
    description: 'You\'ll create 2 robots total. Start with your first one now — you\'ll create the second after purchasing Roster Expansion.',
    tip: 'Consider giving your robots complementary names or themes. You\'ll split upgrades between them.',
  },
  '3_flimsy': {
    name: '3 Flimsy Robots',
    totalRobots: 3,
    totalRobotCost: 1500000,
    description: 'You\'ll create 3 robots total. Start with your first one now — you\'ll need Roster Expansion Level 2 for all three.',
    tip: 'With 3 robots, each one gets fewer upgrades. Focus on quantity and battle participation over raw power.',
  },
};

const Step5_RobotCreation = ({ onNext }: Step5_RobotCreationProps) => {
  const { tutorialState, advanceStep } = useOnboarding();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [robotCreated, setRobotCreated] = useState(false);

  const strategy = tutorialState?.strategy || '1_mighty';
  const info = STRATEGY_ROBOT_INFO[strategy] || STRATEGY_ROBOT_INFO['1_mighty'];
  const credits = user?.currency ?? STARTING_BUDGET;
  const remainingAfterCreation = credits - ROBOT_COST;

  // Check if a robot was already created during onboarding
  const robotsCreatedDuringOnboarding = tutorialState?.choices?.robotsCreated ?? [];
  const hasCreatedRobot = robotsCreatedDuringOnboarding.length > 0;
  const robotsCreated = robotsCreatedDuringOnboarding.length;
  const robotsNeeded = info.totalRobots;
  const needsMoreRobots = robotsCreated < robotsNeeded;

  // Detect when user returns from robot creation page with a new robot
  const checkForNewRobot = useCallback(async () => {
    if (robotCreated) return;

    try {
      // We rely on the onboarding choices being updated by the robot creation flow
      if (robotsCreatedDuringOnboarding.length > 0 && robotsCreatedDuringOnboarding.length !== robotsCreated) {
        setRobotCreated(true);
      }
    } catch {
      // Silently handle - user may not have created a robot yet
    }
  }, [robotCreated, robotsCreatedDuringOnboarding.length, robotsCreated]);

  useEffect(() => {
    checkForNewRobot();
  }, [checkForNewRobot, tutorialState]);

  const handleNavigateToCreate = () => {
    setShowOverlay(false);
    navigate('/robots/create?onboarding=true');
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

  const handleSkipCreation = async () => {
    // Allow advancing even without creating a robot (they can create later)
    await handleNext();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 text-gray-100">Create Your First Robot</h1>
        <p className="text-lg text-gray-400 max-w-3xl mx-auto">
          Time to build your first combat robot! Each robot costs{' '}
          <strong className="text-yellow-400">₡{ROBOT_COST.toLocaleString()}</strong> and starts
          with all 23 attributes at Level 1.
        </p>
      </div>

      {/* Strategy Reminder */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">🎯</span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-blue-400 mb-2">
              Your Strategy: {info.name}
            </h2>
            <p className="text-gray-300 mb-2">{info.description}</p>
            <p className="text-sm text-gray-400">
              Total robot investment for this strategy:{' '}
              <strong className="text-yellow-400">
                ₡{info.totalRobotCost.toLocaleString()}
              </strong>{' '}
              ({info.totalRobots} robot{info.totalRobots > 1 ? 's' : ''} × ₡{ROBOT_COST.toLocaleString()})
            </p>
          </div>
        </div>
      </div>

      {/* Robot Cost & Budget Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-4xl mx-auto">
        {/* Robot Cost Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
            <span className="text-2xl">🤖</span> Robot Frame
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Frame Cost:</span>
              <span className="text-2xl font-bold text-yellow-400">
                ₡{ROBOT_COST.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Your Balance:</span>
              <span className={`text-xl font-semibold ${credits >= ROBOT_COST ? 'text-green-400' : 'text-red-400'}`}>
                ₡{credits.toLocaleString()}
              </span>
            </div>
            <div className="border-t border-gray-600 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">After Creation:</span>
                <span className={`text-lg font-semibold ${remainingAfterCreation >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ₡{remainingAfterCreation.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* What You Get Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
            <span className="text-2xl">📋</span> What You Get
          </h3>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400 flex-shrink-0">✓</span>
              All 23 attributes starting at Level 1
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 flex-shrink-0">✓</span>
              Ready for weapon equipping and customization
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 flex-shrink-0">✓</span>
              Unique name of your choice (1-50 characters)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-500 flex-shrink-0">○</span>
              <span className="text-gray-400">No weapon equipped yet (next step)</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Attribute Upgrade Warning */}
      <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-yellow-400 mb-2">
              Don't Upgrade Attributes Yet!
            </h2>
            <p className="text-gray-300 mb-2">
              Wait until you've purchased the <strong className="text-yellow-300">Training Facility</strong> before
              upgrading any attributes. The Training Facility provides 10-90% discount on all attribute upgrades.
            </p>
            <p className="text-sm text-gray-400">
              Upgrading attributes without the Training Facility means paying full price — you'd waste
              credits that could be saved with the discount.
            </p>
          </div>
        </div>
      </div>

      {/* Strategy Tip */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">💡</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-100 mb-2">Strategy Tip</h2>
            <p className="text-gray-300">{info.tip}</p>
          </div>
        </div>
      </div>

      {/* Robot Created Success */}
      {hasCreatedRobot && (
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">✅</span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-green-400 mb-2">
                {needsMoreRobots 
                  ? `Robot ${robotsCreated} of ${robotsNeeded} Created!`
                  : `All ${robotsNeeded} Robot${robotsNeeded > 1 ? 's' : ''} Created!`
                }
              </h2>
              <p className="text-gray-300">
                {needsMoreRobots 
                  ? `You've created ${robotsCreated} robot${robotsCreated > 1 ? 's' : ''}. Create ${robotsNeeded - robotsCreated} more to complete your ${info.name} strategy.`
                  : `Your ${robotsNeeded} robot${robotsNeeded > 1 ? 's have' : ' has'} been created. Next, you'll learn about weapon types and loadouts before purchasing weapons.`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-4">
        {!hasCreatedRobot ? (
          <>
            <button
              id="create-robot-button"
              onClick={() => setShowOverlay(true)}
              disabled={credits < ROBOT_COST}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse"
            >
              Create Robot #{robotsCreated + 1} (₡{ROBOT_COST.toLocaleString()})
            </button>
            {credits < ROBOT_COST && (
              <p className="text-red-400 text-sm">
                Insufficient credits. You need ₡{(ROBOT_COST - credits).toLocaleString()} more.
              </p>
            )}
            <button
              onClick={handleSkipCreation}
              disabled={isSubmitting}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Skip for now — I'll create robots later
            </button>
          </>
        ) : needsMoreRobots ? (
          <>
            <button
              id="create-robot-button"
              onClick={() => {
                setRobotCreated(false);
                setShowOverlay(true);
              }}
              disabled={credits < ROBOT_COST}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse"
            >
              Create Robot #{robotsCreated + 1} (₡{ROBOT_COST.toLocaleString()})
            </button>
            {credits < ROBOT_COST && (
              <p className="text-red-400 text-sm">
                Insufficient credits. You need ₡{(ROBOT_COST - credits).toLocaleString()} more.
              </p>
            )}
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Continue with {robotsCreated} robot{robotsCreated > 1 ? 's' : ''} — I'll create more later
            </button>
          </>
        ) : (
          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Loading...' : 'Next: Weapon Types & Loadouts'}
          </button>
        )}

        <p className="text-sm text-gray-500 text-center max-w-md">
          {!hasCreatedRobot
            ? 'You\'ll name your robot and confirm the purchase on the next screen.'
            : needsMoreRobots
            ? `Create ${robotsNeeded - robotsCreated} more robot${robotsNeeded - robotsCreated > 1 ? 's' : ''} to complete your strategy.`
            : 'All robots created. Let\'s learn about weapons next.'}
        </p>
      </div>

      {/* Guided UI Overlay for Create Robot button */}
      {showOverlay && (
        <GuidedUIOverlay
          targetSelector="#create-robot-button"
          tooltipContent={
            <div>
              <p className="font-semibold text-blue-400 mb-2">Create Your Robot</p>
              <p className="mb-2">
                Click this button to go to the robot creation page. You'll choose a name
                for your robot and confirm the ₡{ROBOT_COST.toLocaleString()} purchase.
              </p>
              <p className="text-sm text-gray-400">
                Your robot will start with all attributes at Level 1 — don't worry,
                you'll upgrade them later after getting the Training Facility discount.
              </p>
            </div>
          }
          position="top"
          onNext={handleNavigateToCreate}
          showNext={true}
          showPrevious={false}
          onClose={() => setShowOverlay(false)}
        />
      )}

      {/* Educational Note */}
      <div className="mt-8 max-w-3xl mx-auto bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-gray-300">
            <strong className="text-blue-400">Remember:</strong> Don't worry if you make a mistake —
            you can always reset your account and start over from the settings page.
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Step5_RobotCreation);
