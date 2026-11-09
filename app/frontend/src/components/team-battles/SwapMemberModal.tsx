import { useState } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { ApiError } from '../../utils/ApiError';
import { swapTeamBattleMember, type TeamBattle, type TeamBattleMember } from '../../utils/teamBattleApi';
import type { TeamCandidateRobot } from './types';

interface SwapMemberModalProps {
  team: TeamBattle;
  memberToSwap: TeamBattleMember;
  candidateRobots: TeamCandidateRobot[];
  existingTeams: TeamBattle[];
  onClose: () => void;
  onComplete: () => void;
}

function SwapMemberModal({ team, memberToSwap, candidateRobots, existingTeams, onClose, onComplete }: SwapMemberModalProps) {
  const [selectedRobotId, setSelectedRobotId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEscapeKey(onClose, !submitting);
  const [error, setError] = useState<string | null>(null);

  // Filter: robots not already on a team of this size
  const robotsOnTeams = new Set(
    existingTeams.flatMap((t) => t.members.map((m) => m.robotId)),
  );
  // Also exclude current team members (except the one being swapped)
  const currentTeamRobotIds = new Set(
    team.members.filter((m) => m.id !== memberToSwap.id).map((m) => m.robotId),
  );

  const availableRobots = candidateRobots.filter(
    (r) =>
      r.robotId !== memberToSwap.robotId &&
      !currentTeamRobotIds.has(r.robotId) &&
      !robotsOnTeams.has(r.robotId),
  );

  const canSubmit = selectedRobotId !== null && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedRobotId) return;
    try {
      setSubmitting(true);
      setError(null);
      await swapTeamBattleMember(team.id, memberToSwap.robotId, selectedRobotId);
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : undefined;
      setError(message || 'Failed to swap team member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-75" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-member-title"
        className="relative bg-surface rounded-lg shadow-2xl max-w-lg w-full mx-4 border border-white/10 animate-scale-in max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <h3 id="swap-member-title" className="text-xl font-semibold text-white">Swap Team Member</h3>
          <p className="text-secondary text-sm mt-1">
            Replace <span className="text-primary font-semibold">{memberToSwap.robot.name}</span> with another robot
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {availableRobots.length === 0 ? (
            <p className="text-warning text-sm">
              {`No other robots available. Every other robot is already on a ${team.teamSize}v${team.teamSize} team or on this team.`}
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableRobots.map((robot) => {
                const isSelected = selectedRobotId === robot.robotId;
                return (
                  <button
                    key={robot.robotId}
                    type="button"
                    onClick={() => setSelectedRobotId(robot.robotId)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all min-h-[44px] ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-white'
                        : 'border-white/10 bg-surface-elevated text-secondary hover:border-primary/50 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{robot.robotName}</span>
                      {isSelected && <span className="text-primary">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="bg-error/10 border border-error rounded-lg p-3">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-surface-elevated text-secondary hover:bg-gray-600 transition-colors font-medium min-h-[44px] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white transition-colors font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Swapping...' : 'Swap Member'}
          </button>
        </div>
      </div>
    </div>
  );
}


export default SwapMemberModal;
