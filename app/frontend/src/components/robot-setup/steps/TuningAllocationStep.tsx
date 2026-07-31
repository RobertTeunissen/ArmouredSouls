/**
 * TuningAllocationStep — Step 4 of the robot setup wizard.
 * Shows pool size summary and offers quick navigation to the full TuningPoolEditor.
 *
 * Requirements: 5.5, 6.1
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../utils/api';
import type { StepProps } from '../types';

interface TuningState {
  poolSize: number;
  allocated: number;
  remaining: number;
  facilityLevel: number;
}

function TuningAllocationStep({ robotId, onComplete, onSkip }: StepProps) {
  const navigate = useNavigate();
  const [tuning, setTuning] = useState<TuningState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api.get<TuningState>(`/api/robots/${robotId}/tuning-allocation`)
      .then((data) => {
        if (!cancelled) setTuning(data);
      })
      .catch(() => {
        // If tuning endpoint fails (e.g., no Tuning Bay facility), show skip state
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [robotId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Tuning Allocation</h2>
        <div className="text-secondary text-sm animate-pulse">Loading tuning data...</div>
      </div>
    );
  }

  // No Tuning Bay or pool size is 0
  if (!tuning || tuning.poolSize === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">Tuning Allocation</h2>
          <p className="text-secondary text-sm mt-2">
            The Tuning Bay facility grants free stat bonuses to your robots.
            Upgrade your Tuning Bay to unlock tuning points.
          </p>
        </div>
        <div className="bg-surface border border-gray-700 rounded-lg p-4 text-center">
          <span className="text-3xl block mb-2">⚙️</span>
          <p className="text-secondary text-sm mb-3">No tuning points available yet.</p>
          <button
            onClick={() => navigate('/facilities')}
            className="text-primary hover:text-blue-300 text-sm font-semibold transition-colors min-h-[44px] px-3 py-2"
          >
            Upgrade Tuning Bay →
          </button>
        </div>
        <div className="flex gap-3 pt-2">
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

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">Tuning Allocation</h2>
        <p className="text-secondary text-sm mt-1">
          Distribute free stat bonuses to boost your robot&apos;s combat performance.
        </p>
      </div>

      {/* Pool summary */}
      <div className="bg-surface border border-gray-700 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-secondary text-sm">Tuning Bay Level</span>
          <span className="text-white font-semibold">{tuning.facilityLevel}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-secondary text-sm">Pool Size</span>
          <span className="text-primary font-semibold">{tuning.poolSize} points</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-secondary text-sm">Allocated</span>
          <span className="text-white font-semibold">{tuning.allocated} / {tuning.poolSize}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-secondary text-sm">Remaining</span>
          <span className={`font-semibold ${tuning.remaining > 0 ? 'text-success' : 'text-secondary'}`}>
            {tuning.remaining} points
          </span>
        </div>
      </div>

      {tuning.remaining > 0 && (
        <div className="bg-teal-900/20 border border-teal-700 rounded-lg p-3">
          <p className="text-teal-400 text-sm text-center">
            ⚙️ You have {tuning.remaining} unallocated tuning points — free stat bonuses!
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={() => navigate(`/robots/${robotId}?tab=tuning`)}
          className="bg-primary hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg min-h-[44px] transition-colors"
        >
          Allocate Now →
        </button>
        <button
          onClick={onComplete}
          className="bg-surface-elevated hover:bg-gray-600 text-white px-6 py-3 rounded-lg min-h-[44px] transition-colors"
        >
          {tuning.allocated > 0 ? 'Continue' : 'Allocate Later'}
        </button>
      </div>
    </div>
  );
}

export default TuningAllocationStep;
