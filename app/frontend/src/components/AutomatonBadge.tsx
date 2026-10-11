import type { StableType } from '../types/stable';

/**
 * Automaton_Badge (Spec #55 R12.1, design §18, `review/PLAYER_FACING_TEXT.md` §1).
 *
 * A non-interactive label shown directly after an Automaton_Stable's name. It
 * renders nothing for human and generated stables, so callers can pass the
 * owning stable's `stableType` unconditionally.
 *
 * - `md` (12 px) next to names in headers, banners and table rows; `sm` (10 px,
 *   uppercase) in the dense season-archive tables.
 * - `compact` (default): below 640 px the label is visually hidden and only the
 *   gear shows. Page headers pass `compact={false}` and always show the label.
 * - The accessible name is always the label "Automaton"; the gear is decorative.
 * - Colours: `info` text and icon, a 40% `info` border and a 15% `info` tint
 *   mixed over the page background. The tint is opaque so the text keeps a
 *   contrast of at least 4.5:1 on every card colour (a translucent tint over
 *   `surface` or `surface-elevated` would drop below it).
 */

export const AUTOMATON_BADGE_LABEL = 'Automaton';

/** Opaque 15% `info` tint over the page background (see the contrast note above). */
export const AUTOMATON_BADGE_BACKGROUND_CLASS =
  'bg-[color-mix(in_srgb,var(--color-info)_15%,var(--color-background))]';

export type AutomatonBadgeSize = 'md' | 'sm';

export interface AutomatonBadgeProps {
  stableType: StableType | null | undefined;
  size?: AutomatonBadgeSize;
  compact?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<AutomatonBadgeSize, { pill: string; compactPill: string; icon: string; compactIcon: string }> = {
  md: {
    pill: 'text-xs leading-4 px-2 py-0.5 gap-1',
    compactPill: 'text-xs leading-4 px-1 py-0.5 gap-0 sm:px-2 sm:gap-1',
    icon: 'h-3 w-3',
    compactIcon: 'h-3.5 w-3.5 sm:h-3 sm:w-3',
  },
  sm: {
    pill: 'text-[10px] leading-[14px] px-1 uppercase tracking-[0.02em] gap-1',
    compactPill: 'text-[10px] leading-[14px] px-1 uppercase tracking-[0.02em] gap-0 sm:gap-1',
    icon: 'h-2.5 w-2.5',
    compactIcon: 'h-3 w-3 sm:h-2.5 sm:w-2.5',
  },
};

/** Gear (cog) icon: a ring with eight teeth, drawn on a 16 × 16 grid. */
function GearIcon({ className }: { className: string }) {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg
      viewBox="0 0 16 16"
      className={`flex-none ${className}`}
      aria-hidden="true"
      focusable="false"
      data-testid="automaton-badge-icon"
    >
      <g fill="currentColor" fillRule="evenodd">
        <path d="M8 3.4a4.6 4.6 0 1 1 0 9.2a4.6 4.6 0 1 1 0-9.2Zm0 2.4a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4Z" />
        {teeth.map((angle) => (
          <rect
            key={angle}
            x="6.8"
            y="0.8"
            width="2.4"
            height="3.2"
            rx="0.6"
            transform={angle === 0 ? undefined : `rotate(${angle} 8 8)`}
          />
        ))}
      </g>
    </svg>
  );
}

function AutomatonBadge({ stableType, size = 'md', compact = true, className = '' }: AutomatonBadgeProps) {
  if (stableType !== 'automaton') return null;

  const classes = SIZE_CLASSES[size];
  const pill = compact ? classes.compactPill : classes.pill;
  const icon = compact ? classes.compactIcon : classes.icon;
  const label = compact ? 'sr-only sm:not-sr-only' : '';

  return (
    <span
      className={`inline-flex flex-none items-center whitespace-nowrap rounded border border-info/40 align-middle font-semibold text-info ${AUTOMATON_BADGE_BACKGROUND_CLASS} ${pill} ${className}`}
      data-testid="automaton-badge"
      data-compact={compact ? 'true' : 'false'}
    >
      <GearIcon className={icon} />
      <span className={label} data-testid="automaton-badge-label">
        {AUTOMATON_BADGE_LABEL}
      </span>
    </span>
  );
}

export default AutomatonBadge;
