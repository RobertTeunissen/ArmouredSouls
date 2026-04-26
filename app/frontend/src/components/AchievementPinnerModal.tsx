import { useState, useEffect, useCallback } from 'react';
import AchievementBadge from './AchievementBadge';
import apiClient from '../utils/apiClient';
import type { AchievementWithProgress } from '../utils/achievementUtils';
import { getTierLabel } from '../utils/achievementUtils';

interface AchievementPinnerModalProps {
  achievements: AchievementWithProgress[];
  currentPinned: string[];
  onClose: () => void;
  onPinnedChange: (pinned: string[]) => void;
}

export default function AchievementPinnerModal({
  achievements,
  currentPinned,
  onClose,
  onPinnedChange,
}: AchievementPinnerModalProps) {
  const [pinned, setPinned] = useState<string[]>(currentPinned);
  const [saving, setSaving] = useState(false);

  const unlocked = achievements.filter(a => a.unlocked);

  const togglePin = useCallback((id: string) => {
    setPinned(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      }
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await apiClient.put('/api/achievements/pinned', { achievementIds: pinned });
      onPinnedChange(pinned);
      onClose();
    } catch {
      // Silently handle — user can retry
    } finally {
      setSaving(false);
    }
  }, [pinned, onPinnedChange, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-white/10 rounded-lg p-6 max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Pin Achievements ({pinned.length}/6)</h3>
          <button
            onClick={onClose}
            className="text-secondary hover:text-white text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-secondary mb-4">
          Select up to 6 achievements to showcase on your stable page.
        </p>

        <div className="flex-1 overflow-y-auto">
          {unlocked.length === 0 ? (
            <p className="text-secondary text-center py-8">No unlocked achievements yet.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {unlocked.map(a => {
                const isPinned = pinned.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => togglePin(a.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                      isPinned
                        ? 'border-primary bg-primary/10'
                        : 'border-white/10 hover:border-white/30'
                    } ${!isPinned && pinned.length >= 6 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    disabled={!isPinned && pinned.length >= 6}
                    title={`${a.name} (${getTierLabel(a.tier)})`}
                  >
                    <AchievementBadge tier={a.tier} badgeIconFile={a.badgeIconFile} size={48} />
                    <span className="text-xs text-white truncate w-full text-center">{a.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-secondary hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
