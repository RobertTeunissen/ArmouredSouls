/**
 * Season_Summary_Modal (Spec #45 R15).
 *
 * Shown once per season to a returning player after a rollover, so the reset is
 * acknowledged rather than silent — a player who logs in to an empty stable
 * with no explanation would reasonably think something broke.
 *
 * Fits a 320×568 viewport with its own scroll area and a dismiss control that
 * stays reachable without scrolling.
 *
 * Follows the site's modal pattern (docs/design_ux, Modal Component): theme
 * surface and borders, scale-in, close button top-right and Escape. Labels come
 * from the same formatters as the stable page's Season History, and the
 * preparation notice is the site's `DashboardNotification`.
 */

import { useCallback, useEffect, useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import {
  getSeasonSummary,
  markSeasonSummarySeen,
} from '../../utils/seasonApi';
import { useSeasonStore, selectSeason } from '../../stores/seasonStore';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { createLogger } from '../../utils/logger';
import { getTierName } from '../../utils/tierHelpers';
import { MODE_LONG_LABELS } from '../../utils/stableViewFormat';
import { categoryLabel, modeLabel, rankBadge } from '../../utils/seasonFormat';
import { formatCount } from '../../utils/hallOfRecords';
import DashboardNotification from '../DashboardNotification';
import type { SeasonSummary } from '@shared/types';

const log = createLogger('SeasonSummaryModal');

/** "King of the Hill", "League 1v1"; unknown modes fall back to a title-cased form. */
function bestTierLabel(bestTier: SeasonSummary['bestTier']): string {
  if (!bestTier) return '—';
  const mode = (MODE_LONG_LABELS as Readonly<Record<string, string>>)[bestTier.mode] ?? modeLabel(bestTier.mode);
  return `${getTierName(bestTier.tier)} · ${mode}`;
}

/** "27,339 prestige"; tournament wins carry their name in the label and a 0 value. */
function accoladeValue(accolade: SeasonSummary['accolades'][number]): string {
  return accolade.value !== 0 ? `${formatCount(accolade.value)} ${accolade.valueLabel}` : accolade.valueLabel;
}

function preparationText(remaining: number): string {
  if (remaining === 0) return 'Competitive battles resume at the next settlement.';
  return `Competitive battles resume in ${remaining} ${remaining === 1 ? 'cycle' : 'cycles'}.`;
}

function Figure({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-secondary">{label}</dt>
      <dd className="font-semibold tabular-nums text-white">{value}</dd>
    </div>
  );
}

export function SeasonSummaryModal(): JSX.Element | null {
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [open, setOpen] = useState(false);
  const season = useSeasonStore(selectSeason);

  useEffect(() => {
    // Same reasoning as the season store: the endpoint is authenticated, so
    // skip it entirely without a token rather than firing a doomed request from
    // the app shell on every mount.
    if (typeof localStorage !== 'undefined' && !localStorage.getItem('token')) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await getSeasonSummary();
        if (!cancelled && result) {
          setSummary(result);
          setOpen(true);
        }
      } catch (error) {
        // No modal is better than a broken one.
        log.error('Failed to load season summary', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback((): void => {
    setOpen(false);
    if (!summary) return;
    markSeasonSummarySeen(summary.seasonNumber).catch((error: unknown) => {
      log.error('Failed to record season summary as seen', error);
    });
  }, [summary]);

  useEscapeKey(dismiss, open);

  if (!open || !summary) return null;

  const record = `${formatCount(summary.wins)}W / ${formatCount(summary.losses)}L / ${formatCount(summary.draws)}D`;

  return (
    <div
      // Above the fixed navigation (z-[1000]), on the overlay layer the mobile
      // drawer and search palette use, or the header and tab bar cover it.
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-2 sm:p-4"
      data-testid="season-summary-modal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="season-summary-title"
        className="flex max-h-[95vh] w-full max-w-lg flex-col rounded-lg border border-white/10 bg-surface shadow-2xl animate-scale-in"
      >
        {/* Header stays fixed so the dismiss control is always reachable. */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="season-summary-title" className="text-xl font-semibold text-white">
            {summary.isLegacy ? 'Season 0 archived' : `Season ${summary.seasonNumber} archived`}
          </h2>
          <button
            type="button"
            onClick={dismiss}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close season summary"
          >
            ✕
          </button>
        </div>

        {/* Body scrolls, so a 568px-tall viewport never clips the footer. */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm sm:px-6">
          {summary.isLegacy && (
            <p className="rounded-lg bg-surface-elevated p-3 text-xs text-secondary">
              Season 0 covers everything before the season system existed, so these are
              career totals rather than one season&apos;s figures.
            </p>
          )}

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Figure label="Final credits" value={`₡${formatCount(summary.finalCredits)}`} />
            <Figure label="Prestige" value={formatCount(summary.prestigeEarned)} />
            <Figure label="Record" value={record} />
            <Figure label="Best tier" value={bestTierLabel(summary.bestTier)} />
            <Figure
              label="Achievements"
              value={`${formatCount(summary.achievementsUnlocked)} / ${formatCount(summary.achievementsAvailable)}`}
            />
          </dl>

          {summary.accolades.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs uppercase tracking-wide text-secondary">Notable placements</h3>
              <ul className="space-y-1.5">
                {summary.accolades.map((a) => (
                  <li key={`${a.category}-${a.rank}-${a.subjectName}`} className="text-secondary">
                    <span className="text-white">
                      {rankBadge(a.rank)} {categoryLabel(a.category).label}
                    </span>
                    {' · '}
                    {a.subjectName} · <span className="tabular-nums">{accoladeValue(a)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {season?.phase === 'preparation' && (
            <DashboardNotification
              variant="info"
              icon="🛠️"
              message={`Season ${season.seasonNumber} is being prepared`}
              detail={`${preparationText(season.remainingPreparationCycles)} Build your stable now.`}
            />
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-white/10 px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <Link
            to="/changelog"
            onClick={dismiss}
            className="flex min-h-[44px] items-center justify-center rounded-lg bg-surface-elevated px-4 font-medium text-secondary transition-colors hover:text-white"
          >
            What changed this season
          </Link>
          <button
            type="button"
            onClick={dismiss}
            // Moving focus into an opened dialog is required, so this autoFocus is deliberate.
            // eslint-disable-next-line jsx-a11y-x/no-autofocus
            autoFocus
            className="min-h-[44px] rounded-lg bg-primary px-4 font-medium text-white transition-colors hover:bg-primary-dark"
          >
            Start building
          </button>
        </div>
      </div>
    </div>
  );
}

export default SeasonSummaryModal;
