/**
 * Dashboard_Tile — the single presentational component behind all three tiles in the
 * Overview_Row.
 *
 * Spec #48 Requirements 11 and 12. Container styling, padding, heading scale, the
 * stat-value colour rules, the loading and error states and the click-through
 * behaviour are declared HERE and nowhere else, so a change to the type scale or a
 * colour rule takes effect in all three tiles and cannot drift between them.
 *
 * The props interface deliberately has no `className`, no `style`, no `variant` and
 * no colour, padding, size or typography member of any kind (Requirement 12
 * criterion 5). An instance supplies content and nothing else.
 */

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

/**
 * Which direction of movement is good for a figure.
 *
 * The tile — not the caller — turns this plus the sign of (current − comparison)
 * into a colour, which is what keeps class names out of the tiles.
 */
export type SignMeaning = 'higher-is-better' | 'lower-is-better' | 'no-meaning';

/** The two period labels Requirement 2 criterion 5 permits. */
export type PeriodLabel = 'current-cycle' | 'last-completed-cycle';

const PERIOD_TEXT: Record<PeriodLabel, string> = {
  'current-cycle': 'this cycle',
  'last-completed-cycle': 'last cycle',
};

// ── The one declaration of container, heading and reserved height ──
// Requirement 11 criteria 1, 2, 3 and 9. `bg-surface-elevated` with
// `border border-gray-700` is the Card Component pattern from
// docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md; `text-xl font-medium` is its H3
// step. All three states use the same geometry, so nothing reflows as data arrives.
const TILE_CONTAINER = 'bg-surface-elevated border border-gray-700 rounded-lg p-4';
const TILE_HEADING = 'text-xl font-medium text-white mb-3';
const TILE_CONTENT = 'min-h-[11rem] flex flex-col gap-2';

/**
 * The only stat-value colour map in the module, kept private so `text-success` and
 * `text-error` appear in exactly one file (Verification criterion 7).
 */
const STAT_COLOUR = {
  neutral: 'text-white',
  favourable: 'text-success',
  unfavourable: 'text-error',
} as const;

/**
 * Requirement 11 criteria 7 and 8: a colour is applied ONLY when a comparison exists
 * and the direction is meaningful. No comparison, no meaning, or an equal figure all
 * yield the neutral treatment — so a rising repair bill is never green, and nothing
 * flips colour at an arbitrary threshold.
 */
function statColour(signMeaning: SignMeaning, delta: number | undefined): string {
  if (delta === undefined || delta === 0 || signMeaning === 'no-meaning') {
    return STAT_COLOUR.neutral;
  }
  const favourable = signMeaning === 'higher-is-better' ? delta > 0 : delta < 0;
  return favourable ? STAT_COLOUR.favourable : STAT_COLOUR.unfavourable;
}

export interface DashboardTileProps {
  /** Rendered by the tile as its H3 heading. */
  title: string;
  /** Absent means no interactive click-through element at all. */
  clickThrough?: { label: string; to: string };
  isLoading: boolean;
  /** Non-null puts the tile in its error state. */
  error: string | null;
  /** Assembled from the primitives exported alongside this component. */
  content: React.ReactNode;
  /** How many placeholder rows the loading state should reserve. */
  loadingRows?: number;
}

export function DashboardTile({
  title,
  clickThrough,
  isLoading,
  error,
  content,
  loadingRows = 3,
}: DashboardTileProps): React.ReactElement {
  const navigate = useNavigate();

  // A native button gives Enter and Space activation and a focus ring for free, and
  // tab order follows DOM order, which is tile order (Requirement 14 criterion 4).
  // `min-h-11 min-w-11` is the 44px activation region (Requirement 13 criteria 4, 5).
  const action = clickThrough ? (
    <button
      type="button"
      onClick={() => navigate(clickThrough.to)}
      className="mt-auto min-h-11 min-w-11 inline-flex items-center text-primary hover:underline text-sm self-start"
    >
      {clickThrough.label}
    </button>
  ) : null;

  return (
    <section className={TILE_CONTAINER} aria-label={title}>
      <h3 className={TILE_HEADING}>{title}</h3>

      <div className={TILE_CONTENT}>
        {isLoading ? (
          // Requirement 12 criterion 6: the title plus a placeholder per expected row.
          // No stat value and, crucially, no zero — a zero would read as a real figure.
          <div className="flex flex-col gap-2" data-testid="dashboard-tile-loading">
            {Array.from({ length: loadingRows }).map((_, index) => (
              <div key={index} className="h-6 bg-gray-700/40 rounded animate-pulse" />
            ))}
          </div>
        ) : error !== null ? (
          // Requirement 12 criterion 7: one message, no partial stat value.
          <p className="text-secondary text-sm" data-testid="dashboard-tile-error">
            {error}
          </p>
        ) : (
          content
        )}
        {!isLoading && error === null ? action : null}
      </div>
    </section>
  );
}

// ── Content primitives ──
// Exported so a tile never writes a layout or typography class of its own
// (Requirement 12 criterion 3).

export interface DashboardTileStatProps {
  label: string;
  /** Already formatted for display. The tile applies colour, never formatting. */
  value: string;
  period: PeriodLabel;
  /** Absent when no Comparison_Figure exists, which forces the neutral treatment. */
  comparison?: { value: string };
  /** Numeric delta, used only to pick a colour. Never rendered. */
  delta?: number;
  signMeaning: SignMeaning;
}

export function DashboardTileStat({
  label,
  value,
  period,
  comparison,
  delta,
  signMeaning,
}: DashboardTileStatProps): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-secondary text-sm">
        {label} <span className="text-tertiary">({PERIOD_TEXT[period]})</span>
      </span>
      <span className="flex items-baseline gap-2">
        <span className={`font-semibold ${statColour(signMeaning, delta)}`}>{value}</span>
        {comparison ? (
          <span className="text-tertiary text-xs">
            vs {comparison.value} {PERIOD_TEXT['last-completed-cycle']}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export interface DashboardTileProgressProps {
  label: string;
  /** Whole percentage, already clamped to 0–100 by the caller. */
  percent: number;
  /** The same value as text, so the bar is not the only carrier (Req 3 criterion 5). */
  valueText: string;
}

export function DashboardTileProgress({
  label,
  percent,
  valueText,
}: DashboardTileProgressProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-secondary text-sm">{label}</span>
        <span className="text-white text-sm">{valueText}</span>
      </div>
      <div
        className="h-2 bg-gray-700 rounded overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-tertiary text-xs">{percent}%</span>
    </div>
  );
}

/**
 * A wrapping list of short strings — the Battle_Slot times and the `+N more`
 * indicator. `flex-wrap` with no `truncate` and no `text-ellipsis`, so nothing is
 * clipped on a narrow viewport (Requirement 13 criterion 6).
 */
export function DashboardTileLines({
  label,
  items,
}: {
  label: string;
  items: string[];
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-secondary text-sm">{label}</span>
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {items.map((item) => (
          <span key={item} className="text-white text-sm">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Explanatory sentence plus one in-content router link.
 *
 * The link is tile CONTENT, not the tile-level click-through target, so
 * Requirement 14 criterion 5's focus-order rule does not reach it.
 */
export function DashboardTilePrompt({
  message,
  linkLabel,
  to,
}: {
  message: string;
  linkLabel: string;
  to: string;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-secondary text-sm">{message}</p>
      <Link to={to} className="text-primary hover:underline text-sm min-h-11 inline-flex items-center">
        {linkLabel}
      </Link>
    </div>
  );
}

/** Plain explanatory sentence with no figure — comparison unavailable, Preparation_Phase. */
export function DashboardTileNote({ message }: { message: string }): React.ReactElement {
  return <p className="text-tertiary text-sm">{message}</p>;
}
