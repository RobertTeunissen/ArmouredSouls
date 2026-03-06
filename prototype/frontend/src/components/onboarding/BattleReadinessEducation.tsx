/**
 * BattleReadinessEducation component
 * Educational component that integrates HPBar and BattleReadinessBadge
 * to teach players about robot health status and battle readiness requirements.
 * 
 * Features:
 * - Reuse HPBar for showing robot health status
 * - Reuse BattleReadinessBadge for battle readiness indicators
 * - Explain battle readiness requirements
 * - Show examples of different readiness states
 * 
 * Requirements: 12.1-12.11
 */

import HPBar from '../HPBar';
import BattleReadinessBadge from '../BattleReadinessBadge';

interface RobotHealthExample {
  name: string;
  currentHP: number;
  maxHP: number;
  hasWeapon: boolean;
  status: 'ready' | 'needs-repair' | 'no-weapon';
  explanation: string;
}

interface BattleReadinessEducationProps {
  compact?: boolean;
  showExamples?: boolean;
  currentRobotHP?: number;
  currentRobotMaxHP?: number;
  currentRobotHasWeapon?: boolean;
}

// Example robot states for education
const ROBOT_EXAMPLES: RobotHealthExample[] = [
  {
    name: 'Fully Ready Robot',
    currentHP: 100,
    maxHP: 100,
    hasWeapon: true,
    status: 'ready',
    explanation: 'This robot is battle-ready! HP is full and weapon is equipped.',
  },
  {
    name: 'Slightly Damaged Robot',
    currentHP: 75,
    maxHP: 100,
    hasWeapon: true,
    status: 'ready',
    explanation: 'This robot can still battle. HP above 0 and weapon equipped.',
  },
  {
    name: 'Heavily Damaged Robot',
    currentHP: 15,
    maxHP: 100,
    hasWeapon: true,
    status: 'ready',
    explanation: 'Risky but battle-ready. Consider repairing before next battle.',
  },
  {
    name: 'Knocked Out Robot',
    currentHP: 0,
    maxHP: 100,
    hasWeapon: true,
    status: 'needs-repair',
    explanation: 'Cannot battle! HP is 0. Must repair before entering battles.',
  },
  {
    name: 'Robot Without Weapon',
    currentHP: 100,
    maxHP: 100,
    hasWeapon: false,
    status: 'no-weapon',
    explanation: 'Cannot battle! No weapon equipped. Equip a weapon to battle.',
  },
];

/**
 * BattleReadinessRequirements component
 * Displays the requirements for battle readiness.
 */
const BattleReadinessRequirements = () => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
        Battle Readiness Requirements
      </h4>
      
      <div className="space-y-2 pl-6">
        <div className="flex items-start gap-2">
          <span className="text-green-400 mt-0.5">✓</span>
          <div className="flex-1">
            <div className="text-sm text-gray-300 font-medium">HP Greater Than 0</div>
            <div className="text-xs text-gray-400">Robot must have health remaining to battle</div>
          </div>
        </div>
        
        <div className="flex items-start gap-2">
          <span className="text-green-400 mt-0.5">✓</span>
          <div className="flex-1">
            <div className="text-sm text-gray-300 font-medium">Weapon Equipped</div>
            <div className="text-xs text-gray-400">At least one weapon must be equipped in loadout</div>
          </div>
        </div>
        
        <div className="flex items-start gap-2">
          <span className="text-green-400 mt-0.5">✓</span>
          <div className="flex-1">
            <div className="text-sm text-gray-300 font-medium">Sufficient Credits</div>
            <div className="text-xs text-gray-400">Recommended ₡50,000+ for potential repairs</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * HPBarExplanation component
 * Explains how HP works and what the colors mean.
 */
const HPBarExplanation = () => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
        <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
        </svg>
        Understanding HP (Health Points)
      </h4>
      
      <div className="space-y-2 pl-6">
        <div className="flex items-start gap-2">
          <div className="w-3 h-3 bg-success rounded-full mt-1" />
          <div className="flex-1">
            <div className="text-sm text-gray-300 font-medium">Green (70-100%)</div>
            <div className="text-xs text-gray-400">Healthy - robot is in good condition</div>
          </div>
        </div>
        
        <div className="flex items-start gap-2">
          <div className="w-3 h-3 bg-warning rounded-full mt-1" />
          <div className="flex-1">
            <div className="text-sm text-gray-300 font-medium">Yellow (30-69%)</div>
            <div className="text-xs text-gray-400">Damaged - consider repairing soon</div>
          </div>
        </div>
        
        <div className="flex items-start gap-2">
          <div className="w-3 h-3 bg-error rounded-full mt-1" />
          <div className="flex-1">
            <div className="text-sm text-gray-300 font-medium">Red (0-29%)</div>
            <div className="text-xs text-gray-400">Critical - repair before next battle</div>
          </div>
        </div>
      </div>
      
      <div className="p-3 bg-blue-900 bg-opacity-20 border border-blue-700 rounded text-xs text-blue-300">
        <strong>Important:</strong> HP does NOT regenerate automatically. You must repair your robot to restore HP.
      </div>
    </div>
  );
};

/**
 * RobotExampleCard component
 * Displays a single robot example with HP bar and readiness badge.
 */
const RobotExampleCard = ({ example }: { example: RobotHealthExample }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-sm font-semibold text-gray-300">{example.name}</h5>
        <BattleReadinessBadge status={example.status} size="sm" />
      </div>
      
      {/* HP Bar */}
      <div className="mb-3">
        <HPBar 
          current={example.currentHP} 
          max={example.maxHP}
          size="md"
          showPercentage
        />
      </div>
      
      {/* Status details */}
      <div className="space-y-1 text-xs">
        <div className="flex justify-between text-gray-400">
          <span>HP:</span>
          <span className="font-medium">{example.currentHP} / {example.maxHP}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Weapon:</span>
          <span className={`font-medium ${example.hasWeapon ? 'text-green-400' : 'text-red-400'}`}>
            {example.hasWeapon ? 'Equipped ✓' : 'Not Equipped ✗'}
          </span>
        </div>
      </div>
      
      {/* Explanation */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-400">{example.explanation}</p>
      </div>
    </div>
  );
};

/**
 * CurrentRobotStatus component
 * Shows the player's current robot status.
 */
const CurrentRobotStatus = ({
  currentHP,
  maxHP,
  hasWeapon,
}: {
  currentHP: number;
  maxHP: number;
  hasWeapon: boolean;
}) => {
  // Determine status
  let status: 'ready' | 'needs-repair' | 'no-weapon' = 'ready';
  if (currentHP <= 0) {
    status = 'needs-repair';
  } else if (!hasWeapon) {
    status = 'no-weapon';
  }
  
  return (
    <div className="bg-blue-900 bg-opacity-20 border-2 border-blue-500 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-blue-300">Your Robot's Status</h4>
        <BattleReadinessBadge status={status} size="md" />
      </div>
      
      <div className="mb-3">
        <HPBar 
          current={currentHP} 
          max={maxHP}
          size="lg"
          showPercentage
        />
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-300">
          <span>Health Points:</span>
          <span className="font-semibold">{currentHP} / {maxHP}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>Weapon Status:</span>
          <span className={`font-semibold ${hasWeapon ? 'text-green-400' : 'text-red-400'}`}>
            {hasWeapon ? 'Equipped ✓' : 'Not Equipped ✗'}
          </span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>Battle Ready:</span>
          <span className={`font-semibold ${status === 'ready' ? 'text-green-400' : 'text-red-400'}`}>
            {status === 'ready' ? 'Yes ✓' : 'No ✗'}
          </span>
        </div>
      </div>
      
      {status !== 'ready' && (
        <div className="mt-3 pt-3 border-t border-blue-700">
          <p className="text-xs text-blue-300">
            {status === 'needs-repair' && '⚠️ Repair your robot to restore HP before battling.'}
            {status === 'no-weapon' && '⚠️ Equip a weapon in your loadout to enable battles.'}
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * BattleReadinessEducation component
 * Main educational component for battle readiness.
 */
const BattleReadinessEducation = ({
  compact = false,
  showExamples = true,
  currentRobotHP,
  currentRobotMaxHP,
  currentRobotHasWeapon,
}: BattleReadinessEducationProps) => {
  const hasCurrentRobotData = 
    currentRobotHP !== undefined && 
    currentRobotMaxHP !== undefined && 
    currentRobotHasWeapon !== undefined;

  if (compact) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-200">Battle Readiness</h3>
        
        {hasCurrentRobotData && (
          <CurrentRobotStatus
            currentHP={currentRobotHP}
            maxHP={currentRobotMaxHP}
            hasWeapon={currentRobotHasWeapon}
          />
        )}
        
        <BattleReadinessRequirements />
        
        <div className="p-3 bg-gray-800 bg-opacity-50 rounded-lg text-xs text-gray-400">
          <p>Robots automatically participate in battles during cycle times if they are battle-ready.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-200 mb-2">Understanding Battle Readiness</h3>
        <p className="text-sm text-gray-400">
          Learn how to keep your robots ready for battle
        </p>
      </div>

      {/* Current robot status (if provided) */}
      {hasCurrentRobotData && (
        <CurrentRobotStatus
          currentHP={currentRobotHP}
          maxHP={currentRobotMaxHP}
          hasWeapon={currentRobotHasWeapon}
        />
      )}

      {/* Requirements */}
      <div className="p-4 bg-gray-800 bg-opacity-50 rounded-lg">
        <BattleReadinessRequirements />
      </div>

      {/* HP Explanation */}
      <div className="p-4 bg-gray-800 bg-opacity-50 rounded-lg">
        <HPBarExplanation />
      </div>

      {/* Examples */}
      {showExamples && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Example Robot States</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROBOT_EXAMPLES.map((example) => (
              <RobotExampleCard key={example.name} example={example} />
            ))}
          </div>
        </div>
      )}

      {/* Important notes */}
      <div className="p-4 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg">
        <h4 className="text-sm font-semibold text-yellow-300 mb-2 flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Important Reminders
        </h4>
        <ul className="space-y-1 text-xs text-yellow-200">
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>HP does NOT regenerate automatically - you must repair</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>Shields DO regenerate automatically (no repair cost)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>Repair costs increase with damage percentage</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>Keep ₡50,000+ in reserve for unexpected repairs</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>Robots only battle if they meet ALL readiness requirements</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default BattleReadinessEducation;
export { ROBOT_EXAMPLES };
export type { RobotHealthExample };
