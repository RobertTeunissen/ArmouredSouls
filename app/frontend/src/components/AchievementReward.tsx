/**
 * Reward line for an achievement: credits and prestige, or the Trophy marker.
 *
 * Trophies (issue #446) reward placing above other players, so they pay
 * nothing. Every place that shows an achievement's reward uses this component,
 * so a Trophy is never shown with a ₡0 reward line.
 */

interface AchievementRewardProps {
  rewardCredits: number;
  rewardPrestige: number;
  trophy?: boolean;
  /** `listing`: the reward on offer (catalogue). `gain`: just earned (toast, battle report). */
  variant: 'listing' | 'gain';
  /** Listing only: earned rewards show in the success colour. */
  unlocked?: boolean;
  className?: string;
}

export const TROPHY_EXPLANATION = 'Bragging rights only: no credits or prestige';

export default function AchievementReward({
  rewardCredits,
  rewardPrestige,
  trophy = false,
  variant,
  unlocked = false,
  className = '',
}: AchievementRewardProps) {
  if (trophy) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span
          className="inline-flex items-center gap-1 rounded border border-warning/60 bg-warning/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning"
          data-testid="trophy-chip"
        >
          <span aria-hidden="true">🏆</span>
          Trophy
        </span>
        <span className="text-secondary">{TROPHY_EXPLANATION}</span>
      </span>
    );
  }

  const colour = variant === 'gain' || unlocked ? 'text-success' : 'text-secondary';
  const text = variant === 'gain'
    ? `+₡${rewardCredits.toLocaleString()} +${rewardPrestige} prestige`
    : `₡${rewardCredits.toLocaleString()} + ${rewardPrestige} prestige`;
  return <span className={`${colour} ${className}`}>{text}</span>;
}
