/**
 * BattleConfigStep — Step 3 of the robot setup wizard.
 * Combines StanceSelector and YieldThresholdSlider on one screen.
 *
 * Requirements: 5.4, 6.1, 6.2
 */

import { useState } from 'react';
import StanceSelector from '../../StanceSelector';
import YieldThresholdSlider from '../../YieldThresholdSlider';
import type { StepProps } from '../types';

function BattleConfigStep({ robotId, onComplete, onSkip }: StepProps) {
  const [stanceSet, setStanceSet] = useState(false);
  const [yieldSet, setYieldSet] = useState(false);

  const handleStanceChange = (_newStance: string): void => {
    setStanceSet(true);
  };

  const handleThresholdChange = (_newThreshold: number): void => {
    setYieldSet(true);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-white">Battle Configuration</h2>
        <p className="text-secondary text-sm mt-1">
          Set your robot&apos;s combat strategy. These can be changed before every battle.
        </p>
      </div>

      {/* Stance Selection */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Combat Stance</h3>
        <p className="text-secondary text-sm mb-3">
          Your stance determines attribute bonuses in combat. Offensive boosts damage but reduces defense; Defensive does the opposite.
        </p>
        <StanceSelector
          robotId={robotId}
          currentStance="balanced"
          onStanceChange={handleStanceChange}
        />
      </div>

      {/* Yield Threshold */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Yield Threshold</h3>
        <p className="text-secondary text-sm mb-3">
          When your robot&apos;s HP drops below this percentage, it yields instead of fighting to destruction. Lower = cheaper repairs but fewer wins; higher = more fighting spirit but higher repair bills.
        </p>
        <YieldThresholdSlider
          robotId={robotId}
          currentThreshold={10}
          robotAttributes={{}}
          repairBayLevel={0}
          activeRobotCount={1}
          onThresholdChange={handleThresholdChange}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onComplete}
          className="bg-primary hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg min-h-[44px] transition-colors"
        >
          {stanceSet || yieldSet ? 'Continue' : 'Keep Defaults'}
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            className="bg-surface-elevated hover:bg-gray-600 text-white px-6 py-3 rounded-lg min-h-[44px] transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

export default BattleConfigStep;
