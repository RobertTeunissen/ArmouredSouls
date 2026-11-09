import { useState } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { ApiError } from '../../utils/ApiError';
import { renameTeamBattle, type TeamBattle } from '../../utils/teamBattleApi';

interface RenameTeamModalProps {
  team: TeamBattle;
  onClose: () => void;
  onComplete: () => void;
}

function RenameTeamModal({ team, onClose, onComplete }: RenameTeamModalProps) {
  const [newName, setNewName] = useState(team.teamName);
  const [submitting, setSubmitting] = useState(false);
  useEscapeKey(onClose, !submitting);
  const [error, setError] = useState<string | null>(null);

  const isNameValid = newName.length >= 3 && newName.length <= 32;
  const hasChanged = newName !== team.teamName;
  const canSubmit = isNameValid && hasChanged && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setError(null);
      await renameTeamBattle(team.id, newName);
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : undefined;
      setError(message || 'Failed to rename team');
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
        aria-labelledby="rename-team-title"
        className="relative bg-surface rounded-lg shadow-2xl max-w-md w-full mx-4 border border-white/10 animate-scale-in"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <h3 id="rename-team-title" className="text-xl font-semibold text-white">Rename Team</h3>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="rename-team-name" className="block text-sm font-medium text-secondary mb-1">
              New Team Name (3–32 characters)
            </label>
            <input
              id="rename-team-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={32}
              className="w-full bg-surface-elevated border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary min-h-[44px]"
            />
            {newName.length > 0 && !isNameValid && (
              <p className="text-error text-xs mt-1">Name must be 3–32 characters</p>
            )}
          </div>
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
            {submitting ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}


export default RenameTeamModal;
