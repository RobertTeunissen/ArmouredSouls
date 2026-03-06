/**
 * BattleReadinessCheck component
 * Displays battle readiness status and blocks onboarding completion
 * until all readiness conditions are met.
 *
 * Requirements: 23.4, 23.5, 23.6
 */

import { useNavigate } from 'react-router-dom';
import { useBattleReadiness } from '../../hooks/useBattleReadiness';
import type { Robot } from '../../utils/robotApi';

interface BattleReadinessCheckProps {
  robots: Robot[];
  credits: number;
  onComplete?: () => void;
}

const BattleReadinessCheck = ({ robots, credits, onComplete }: BattleReadinessCheckProps) => {
  const { isReady, issues } = useBattleReadiness(robots, credits);
  const navigate = useNavigate();

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6" aria-label="Battle Readiness Check">
      {isReady ? (
        <div className="text-center">
          <span className="text-4xl block mb-3" role="img" aria-label="Green checkmark">✅</span>
          <h3 className="text-xl font-bold text-green-400 mb-2">Battle Ready!</h3>
          <p className="text-gray-400 mb-4">
            Your robot is equipped and you have enough credits to cover repairs.
          </p>
          <button
            onClick={onComplete}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg transition-colors"
            aria-label="Complete Tutorial"
          >
            Complete Tutorial
          </button>
        </div>
      ) : (
        <div>
          <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
            <span role="img" aria-label="Warning">⚠️</span>
            Not Battle Ready
          </h3>
          <p className="text-gray-400 mb-4">
            Fix the following issues before completing the tutorial:
          </p>
          <ul className="space-y-3 mb-6" role="list" aria-label="Readiness issues">
            {issues.map((issue, index) => (
              <li key={index} className="flex items-start gap-3" role="listitem">
                <span className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true">✗</span>
                <div className="flex-1">
                  <p className="text-gray-300">{issue.message}</p>
                  <button
                    onClick={() => navigate(issue.link)}
                    className="text-sm text-blue-400 hover:text-blue-300 underline mt-1"
                  >
                    {issue.action}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            disabled
            className="px-8 py-3 bg-gray-600 text-gray-400 rounded-lg font-semibold text-lg cursor-not-allowed opacity-50"
            aria-label="Complete Tutorial"
            aria-disabled="true"
          >
            Complete Tutorial
          </button>
        </div>
      )}
    </div>
  );
};

export default BattleReadinessCheck;
