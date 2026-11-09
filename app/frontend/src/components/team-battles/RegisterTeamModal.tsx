import { useState } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { ApiError } from '../../utils/ApiError';
import { registerTeamBattle, type TeamBattle } from '../../utils/teamBattleApi';
import type { TeamCandidateRobot } from './types';

interface RegisterTeamModalProps {
  teamSize: 2 | 3;
  candidateRobots: TeamCandidateRobot[];
  existingTeams: TeamBattle[];
  onClose: () => void;
  onComplete: () => void;
}

function RegisterTeamModal({ teamSize, candidateRobots, existingTeams, onClose, onComplete }: RegisterTeamModalProps) {
  const [teamName, setTeamName] = useState('');
  const [selectedRobotIds, setSelectedRobotIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  useEscapeKey(onClose, !submitting);
  const [error, setError] = useState<string | null>(null);

  const modeLabel = `${teamSize}v${teamSize}`;

  // Filter out robots already on a team of this size
  const robotsOnTeams = new Set(
    existingTeams.flatMap((t) => t.members.map((m) => m.robotId)),
  );
  const availableRobots = candidateRobots.filter(
    (r) => !robotsOnTeams.has(r.robotId),
  );

  const toggleRobot = (robotId: number) => {
    setSelectedRobotIds((prev) => {
      if (prev.includes(robotId)) {
        return prev.filter((id) => id !== robotId);
      }
      if (prev.length >= teamSize) return prev;
      return [...prev, robotId];
    });
  };

  const isNameValid = teamName.length >= 3 && teamName.length <= 32;
  const canSubmit = isNameValid && selectedRobotIds.length === teamSize && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setError(null);
      await registerTeamBattle(selectedRobotIds, teamName, teamSize);
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : undefined;
      setError(message || `Failed to register ${modeLabel} team`);
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
        aria-labelledby="register-team-title"
        className="relative bg-surface rounded-lg shadow-2xl max-w-lg w-full mx-4 border border-white/10 animate-scale-in max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <h3 id="register-team-title" className="text-xl font-semibold text-white">Register {modeLabel} Team</h3>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Team Name */}
          <div>
            <label htmlFor="register-team-name" className="block text-sm font-medium text-secondary mb-1">
              Team Name (3–32 characters)
            </label>
            <input
              id="register-team-name"
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={32}
              placeholder="Enter team name..."
              className="w-full bg-surface-elevated border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary min-h-[44px]"
            />
            {teamName.length > 0 && !isNameValid && (
              <p className="text-error text-xs mt-1">Name must be 3–32 characters</p>
            )}
          </div>

          {/* Robot Picker */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Select {teamSize} Robots ({selectedRobotIds.length}/{teamSize})
            </label>
            {availableRobots.length === 0 ? (
              <p className="text-warning text-sm">
                No available robots. All your robots are already on a {modeLabel} team, or you need to purchase more robots.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableRobots.map((robot) => {
                  const isSelected = selectedRobotIds.includes(robot.robotId);
                  const isDisabled = !isSelected && selectedRobotIds.length >= teamSize;
                  return (
                    <button
                      key={robot.robotId}
                      type="button"
                      onClick={() => toggleRobot(robot.robotId)}
                      disabled={isDisabled}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all min-h-[44px] ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-white'
                          : isDisabled
                          ? 'border-white/5 bg-surface-elevated text-gray-500 cursor-not-allowed'
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
          </div>

          {/* Error */}
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
            {submitting ? 'Registering...' : 'Register Team'}
          </button>
        </div>
      </div>
    </div>
  );
}


export default RegisterTeamModal;
