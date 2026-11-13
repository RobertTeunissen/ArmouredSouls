import { useState } from 'react';
import AchievementBadge from '../AchievementBadge';
import type { ProfileAchievement } from './useRobotProfile';

/** Badges shown before "+N more". */
const VISIBLE = 6;

/** Achievements this robot earned, rarest first. */
export function AchievementsSection({ achievements }: { achievements: readonly ProfileAchievement[] }) {
  const [all, setAll] = useState(false);
  if (achievements.length === 0) return null;
  const shown = all ? achievements : achievements.slice(0, VISIBLE);

  return (
    <section aria-labelledby="robot-achievements-heading">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h2 id="robot-achievements-heading" className="text-lg font-semibold">Achievements</h2>
        <span className="text-sm text-secondary">{achievements.length} earned by this robot · rarest first</span>
      </div>
      <div className="rounded-lg border border-white/10 bg-surface p-4 sm:p-5">
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((a) => (
            <li key={a.id} className="flex flex-col items-center text-center" title={`Unlocked ${new Date(a.unlockedAt).toLocaleDateString()}`}>
              <AchievementBadge tier={a.tier} badgeIconFile={a.badgeIconFile} size={48} />
              <span className="mt-1 line-clamp-2 text-xs">{a.name}</span>
              {a.holders !== null && (
                <span className="text-[11px] text-secondary">{a.holders === 0 ? 'No player holds this' : a.holders === 1 ? 'Held by 1 player' : `Held by ${a.holders} players`}</span>
              )}
            </li>
          ))}
        </ul>
        {achievements.length > VISIBLE && (
          <button type="button" onClick={() => setAll(!all)} className="mt-3 min-h-[44px] text-sm text-primary hover:underline" aria-expanded={all}>
            {all ? 'Show fewer' : `+${achievements.length - VISIBLE} more`}
          </button>
        )}
      </div>
    </section>
  );
}

