import { useState } from 'react';
import { Link } from 'react-router-dom';
import AchievementBadge from '../AchievementBadge';
import AchievementPinnerModal from '../AchievementPinnerModal';
import { api } from '../../utils/api';
import { categoryLabel, rankBadge } from '../../utils/seasonFormat';
import type { AchievementWithProgress, AchievementsResponse } from '../../utils/achievementUtils';
import type { StableAccolade, StableAchievements } from './types';

interface TrophyCabinetProps {
  achievements: StableAchievements | undefined;
  accolades: readonly StableAccolade[];
  isOwner: boolean;
  /** Called after the owner saved new pins, so the page can reload. */
  onPinnedChange: () => void;
}

/** Hall of Records placements listed under the badges. */
const CABINET_ACCOLADE_LIMIT = 3;

function holdersText(holders: number | null): string | null {
  if (holders === null) return null;
  if (holders === 0) return 'No player holds this';
  return holders === 1 ? 'Held by 1 player' : `Held by ${holders} players`;
}

/**
 * Showcase badges and the best Hall of Records placements. The badges are
 * the owner's pins followed by the stable's rarest other achievements, so a
 * stable that never pinned anything still shows its best work.
 */
export function TrophyCabinet({ achievements, accolades, isOwner, onPinnedChange }: TrophyCabinetProps) {
  const [pinnerAchievements, setPinnerAchievements] = useState<AchievementWithProgress[] | null>(null);
  const [pinnerError, setPinnerError] = useState(false);

  const showcase = achievements?.showcase ?? achievements?.pinned.map((p) => ({ ...p, pinned: true, holders: null })) ?? [];
  const placements = accolades.slice(0, CABINET_ACCOLADE_LIMIT);

  const openPinner = async (): Promise<void> => {
    setPinnerError(false);
    try {
      const data = await api.get<AchievementsResponse>('/api/achievements');
      setPinnerAchievements(data.achievements);
    } catch {
      setPinnerError(true);
    }
  };

  return (
    <section className="rounded-lg border border-white/10 bg-surface p-5 sm:p-6" aria-labelledby="trophy-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="trophy-heading" className="text-lg font-semibold">Trophy cabinet</h3>
          {achievements && (
            <p className="text-xs text-secondary">
              {achievements.totalUnlocked} of {achievements.totalAvailable} achievements · {achievements.pinned.length > 0 ? 'pinned, then rarest' : 'rarest first'}
            </p>
          )}
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={() => void openPinner()}
            className="min-h-[44px] rounded-md bg-surface-elevated px-3 text-sm text-primary hover:bg-primary/10"
          >
            Customise
          </button>
        )}
      </div>
      {pinnerError && (
        <p role="alert" className="mt-2 text-sm text-error">Could not load your achievements. Please try again.</p>
      )}

      {showcase.length === 0 ? (
        <p className="mt-4 text-sm text-secondary">No achievements unlocked yet.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-3">
          {showcase.map((a) => (
            <li key={a.id} className="flex flex-col items-center text-center" title={`Unlocked ${new Date(a.unlockedAt).toLocaleDateString()}`}>
              <AchievementBadge tier={a.tier} badgeIconFile={a.badgeIconFile} size={48} />
              <span className="mt-1 line-clamp-2 text-xs text-white">{a.name}</span>
              {a.pinned ? (
                <span className="text-[11px] text-primary">Pinned</span>
              ) : (
                holdersText(a.holders) && <span className="text-[11px] text-secondary">{holdersText(a.holders)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {placements.length > 0 && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <h4 className="text-xs uppercase tracking-wide text-secondary">Best Hall of Records placements</h4>
          <ul className="mt-2 space-y-1.5 text-sm">
            {placements.map((a) => (
              <li key={`${a.seasonNumber}-${a.category}-${a.mode ?? ''}-${a.rank}`} className="flex gap-2">
                <span className="w-6 shrink-0 text-center" aria-hidden="true">{rankBadge(a.rank)}</span>
                <span className="min-w-0">
                  #{a.rank} {categoryLabel(a.category).label}
                  <span className="text-secondary"> · {a.subjectName} · Season {a.seasonNumber}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOwner && (
        <Link to="/achievements" className="mt-4 inline-block text-sm text-primary hover:underline">All achievements →</Link>
      )}

      {pinnerAchievements && (
        <AchievementPinnerModal
          achievements={pinnerAchievements}
          currentPinned={achievements?.pinned.map((p) => p.id) ?? []}
          onClose={() => setPinnerAchievements(null)}
          onPinnedChange={onPinnedChange}
        />
      )}
    </section>
  );
}

