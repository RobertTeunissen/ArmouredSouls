import { isPlacementMode } from '@shared/utils/automatonStandingsTier';
import { getTierColor, getTierName } from '../../utils/tierHelpers';
import { MODE_LONG_LABELS, ROSTER_MODES } from '../../utils/stableViewFormat';
import { successRate } from '../../utils/robotProfileFormat';
import type { ProfileStanding } from './useRobotProfile';

interface SeasonModeCardsProps {
  standings: readonly ProfileStanding[] | null;
  failed: boolean;
}

function instanceLabel(id: string | undefined): string {
  if (!id) return '';
  const [tier, n] = id.split('_');
  return `in ${getTierName(tier)} ${n ?? ''}`.trim();
}

/** One card per mode played this season: tier, rank in its league, LP, record. */
export function SeasonModeCards({ standings, failed }: SeasonModeCardsProps) {
  const played = new Set((standings ?? []).map((s) => s.mode));
  const notEntered = ROSTER_MODES.filter((m) => !played.has(m)).map((m) => MODE_LONG_LABELS[m]);

  return (
    <section aria-labelledby="season-heading">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="season-heading" className="text-lg font-semibold">This season</h2>
        {standings && (
          <span className="text-sm text-secondary">
            {standings.length} of {ROSTER_MODES.length} modes{notEntered.length > 0 ? ` · not entered: ${notEntered.join(', ')}` : ''}
          </span>
        )}
      </div>
      {failed && <p className="rounded-lg bg-surface p-4 text-sm text-error" role="alert">Could not load this season&apos;s standings.</p>}
      {!failed && standings === null && <p className="rounded-lg bg-surface p-4 text-sm text-secondary">Loading…</p>}
      {standings && standings.length === 0 && (
        <p className="rounded-lg bg-surface p-4 text-sm text-secondary">No league or event matches played yet this season.</p>
      )}
      {standings && standings.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {standings.map((s) => {
            const placement = isPlacementMode(s.mode);
            const rate = successRate(s);
            const tierColour = getTierColor(s.tier);
            return (
              <li key={s.mode} className="rounded-lg border border-white/10 bg-surface p-4" data-testid={`mode-card-${s.mode}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">{MODE_LONG_LABELS[s.mode]}</h3>
                  <span className={`shrink-0 rounded-full bg-current/10 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-current/30 ${tierColour}`}>
                    {getTierName(s.tier)}
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-2xl font-bold tabular-nums">
                      #{s.rank} <span className="text-sm font-normal text-secondary">of {s.instanceSize}{s.teamName ? ' teams' : ''}</span>
                    </div>
                    <div className="text-xs text-secondary">{instanceLabel(s.leagueInstanceId)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold tabular-nums">{s.leaguePoints}</div>
                    <div className="text-xs text-secondary">LP</div>
                  </div>
                </div>
                {s.teamName && (
                  <div className="mt-1 truncate text-xs text-secondary" title={s.teamName}>with {s.teamName}</div>
                )}
                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="flex items-baseline justify-between text-sm">
                    {placement ? (
                      <span><span className="font-bold text-warning">{s.wins}</span> first {s.wins === 1 ? 'place' : 'places'} in {s.totalMatches ?? 0}</span>
                    ) : (
                      <span>
                        <span className="font-bold text-success">{s.wins}</span> W · <span className="font-bold text-error">{s.losses}</span> L · {s.draws} D
                      </span>
                    )}
                    <span className="tabular-nums">{Math.round(rate * 100)}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated" aria-hidden="true">
                    <div className={`h-full ${placement ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.round(rate * 100)}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default SeasonModeCards;
