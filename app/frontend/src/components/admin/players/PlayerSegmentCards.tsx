/**
 * The five segment cards above the Players list: Active, Inactive, Dormant
 * (they add up to every human stable) and the issue filters Stuck in
 * onboarding and Low balance. A card filters the list; pressing it again
 * shows every stable.
 */
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import type { PlayersOverview } from '../../../utils/adminPlayersApi';
import { SEGMENT_LABELS, creditsText, type PlayersSegmentFilter } from '../../../utils/adminPlayersFormat';

export interface PlayerSegmentCardsProps {
  overview: PlayersOverview;
  segment: PlayersSegmentFilter;
  onSegment: (segment: PlayersSegmentFilter) => void;
}

interface Card {
  key: Exclude<PlayersSegmentFilter, 'all'>;
  count: number;
  hint: string;
  dot: string;
}

export function PlayerSegmentCards({ overview, segment, onSegment }: PlayerSegmentCardsProps): ReactNode {
  const { counts, thresholds } = overview;
  const cards: Card[] = [
    { key: 'active', count: counts.active, hint: `logged in within ${thresholds.inactiveAfterDays} days`, dot: 'bg-success' },
    { key: 'inactive', count: counts.inactive, hint: `${thresholds.inactiveAfterDays}+ days, but this season`, dot: 'bg-warning' },
    { key: 'dormant', count: counts.dormant, hint: 'no login this season', dot: 'bg-secondary' },
    { key: 'onboarding', count: counts.onboardingStuck, hint: 'never finished setup', dot: 'bg-warning' },
    { key: 'low-balance', count: counts.lowBalance, hint: `below ${creditsText(thresholds.lowBalance)}`, dot: 'bg-error' },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Filter human stables">
        {cards.map((card) => {
          const pressed = segment === card.key;
          return (
            <button
              key={card.key}
              type="button"
              aria-pressed={pressed}
              onClick={() => onSegment(pressed ? 'all' : card.key)}
              className={`min-h-11 rounded-lg border bg-surface px-4 py-3 text-left transition-colors motion-reduce:transition-none hover:bg-surface-elevated ${pressed ? 'border-primary ring-1 ring-primary' : 'border-white/10'} ${ADMIN_FOCUS_RING}`}
            >
              <span className="flex items-center gap-2 text-xs text-secondary">
                <span className={`h-2 w-2 rounded-full ${card.dot}`} aria-hidden="true" />
                {SEGMENT_LABELS[card.key]}
              </span>
              <span className="mt-1 block text-2xl font-bold tabular-nums text-white">{card.count.toLocaleString('en-US')}</span>
              <span className="block text-xs text-secondary">{card.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-secondary">
        {counts.all.toLocaleString('en-US')} human stables · Active + Inactive + Dormant = {counts.all.toLocaleString('en-US')} (the dashboard&apos;s definitions; last login, or sign-up without one).
        Dormant stables are deleted when the season ends. The last two cards are issue filters.
      </p>
    </div>
  );
}
