/**
 * RobotEligibilityChecklist — Persistent banner on Robot Detail Page
 * showing unmet scheduling eligibility gates.
 *
 * Follows the same visual pattern as TeamBattleReadinessWarning.
 * Renders nothing while loading, on error, or when all gates are met.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.2, 9.7
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import type { SchedulingEligibilityReport, SchedulingEligibilityGate } from './types';

interface RobotEligibilityChecklistProps {
  robotId: number;
  showRecommendations?: boolean;
}

const GATE_ACTIONS: Record<string, { label: string; path: (robotId: number) => string }> = {
  weapon_equipped: { label: 'Equip Weapon', path: (id) => `/robots/${id}?tab=battle-config` },
  event_subscribed: { label: 'Subscribe to Events', path: (id) => `/robots/${id}/setup` },
  tuning_allocated: { label: 'Allocate Tuning', path: (id) => `/robots/${id}?tab=tuning` },
};

function RobotEligibilityChecklist({ robotId, showRecommendations = false }: RobotEligibilityChecklistProps) {
  const navigate = useNavigate();
  const [report, setReport] = useState<SchedulingEligibilityReport | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.get<SchedulingEligibilityReport>(`/api/robots/${robotId}/scheduling-eligibility`)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        // Fail silently — don't break the page
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => { cancelled = true; };
  }, [robotId]);

  // Don't render while loading or on error
  if (!loaded || !report) return null;

  // Don't render when fully configured
  if (report.isFullyConfigured) return null;

  // If not showing recommendations and all hard gates are met, hide
  if (!showRecommendations && report.isEligible) return null;

  const hardGates = report.gates.filter((g) => g.severity === 'hard' && !g.met);
  const softGates = showRecommendations
    ? report.gates.filter((g) => g.severity === 'soft' && !g.met)
    : [];

  // Nothing to show
  if (hardGates.length === 0 && softGates.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {/* Hard gates — warning style */}
      {hardGates.length > 0 && (
        <div className="bg-warning/10 border-l-4 border-warning rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-warning text-xl">⚠️</span>
            <span className="text-warning font-semibold">Robot Not Eligible for Battles</span>
          </div>
          <div className="space-y-2">
            {hardGates.map((gate) => (
              <GateItem key={gate.id} gate={gate} robotId={robotId} variant="warning" />
            ))}
          </div>
          <button
            onClick={() => navigate(`/robots/${robotId}/setup`)}
            className="mt-3 w-full sm:w-auto bg-warning hover:bg-warning/90 text-gray-900 font-semibold py-2 px-4 rounded-lg transition-colors min-h-[44px]"
          >
            Complete Setup
          </button>
        </div>
      )}

      {/* Soft gates — info style */}
      {softGates.length > 0 && (
        <div className="bg-primary/10 border-l-4 border-primary rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-primary text-xl">💡</span>
            <span className="text-primary font-semibold">Recommendations</span>
          </div>
          <div className="space-y-2">
            {softGates.map((gate) => (
              <GateItem key={gate.id} gate={gate} robotId={robotId} variant="info" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GateItem({ gate, robotId, variant }: { gate: SchedulingEligibilityGate; robotId: number; variant: 'warning' | 'info' }) {
  const navigate = useNavigate();
  const action = GATE_ACTIONS[gate.id];

  return (
    <div className="flex items-center justify-between gap-3 bg-surface rounded-lg p-3">
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-sm ${variant === 'warning' ? 'text-warning' : 'text-primary'}`}>
          {gate.label}
        </div>
        {gate.detail && (
          <div className="text-xs text-secondary mt-0.5">{gate.detail}</div>
        )}
      </div>
      {action && (
        <button
          onClick={() => navigate(action.path(robotId))}
          className={`
            flex-shrink-0 text-sm font-semibold px-3 py-2 rounded min-h-[44px] transition-colors
            w-full sm:w-auto
            ${variant === 'warning'
              ? 'bg-warning/20 hover:bg-warning/30 text-warning'
              : 'bg-primary/20 hover:bg-primary/30 text-primary'
            }
          `}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default RobotEligibilityChecklist;
