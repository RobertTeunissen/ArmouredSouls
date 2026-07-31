/**
 * AttributeUpgradeStep — Step 7 of the robot setup wizard.
 * Shows affordable attribute upgrades with current credits. Fully skippable.
 *
 * Requirements: 5.8, 6.1
 */

import { useNavigate } from 'react-router-dom';
import type { StepProps } from '../types';

function AttributeUpgradeStep({ robotId, onComplete, onSkip }: StepProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-white">Attribute Upgrades</h2>
        <p className="text-secondary text-sm mt-1">
          Upgrade your robot&apos;s base attributes to improve combat performance.
          This is optional — your robot can fight without upgrades.
        </p>
      </div>

      <div className="bg-surface border border-gray-700 rounded-lg p-4 text-center">
        <span className="text-3xl block mb-2">⬆️</span>
        <p className="text-white font-semibold mb-2">Ready to Upgrade?</p>
        <p className="text-secondary text-sm mb-4">
          Visit the Upgrades tab on your robot&apos;s page to invest credits in permanent attribute improvements.
          Higher attributes mean more damage, better defense, and faster attacks.
        </p>
        <button
          onClick={() => navigate(`/robots/${robotId}?tab=upgrades`)}
          className="bg-primary hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg min-h-[44px] transition-colors"
        >
          Go to Upgrades →
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onComplete}
          className="bg-surface-elevated hover:bg-gray-600 text-white px-6 py-3 rounded-lg min-h-[44px] transition-colors"
        >
          Finish Setup
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-secondary hover:text-white text-sm min-h-[44px] px-3 py-2 transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

export default AttributeUpgradeStep;
