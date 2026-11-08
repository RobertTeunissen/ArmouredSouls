import { Link } from 'react-router-dom';
import { ScrollRow } from '../hall-of-records/ScrollRow';
import {
  LEAGUE_MODES,
  entityCount,
  instanceLabel,
  summariseLeagues,
  type LeagueModeKey,
  type MyStandingEntry,
  type StatusTone,
} from '../../utils/leagueStandings';

const TONE_TEXT: Record<StatusTone, string> = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  neutral: 'text-tertiary',
};

export interface LeagueCardsProps {
  entries: readonly MyStandingEntry[];
  active: LeagueModeKey;
  stableName: string;
  /** `?mode=` link of a league card. */
  hrefFor: (mode: LeagueModeKey) => string;
}

/**
 * One card per league: where the viewer's stable stands in it, and the league
 * picker. Leagues without an entry still get a card, so every league is
 * reachable. On phones the cards scroll sideways.
 */
export function LeagueCards({ entries, active, stableName, hrefFor }: LeagueCardsProps) {
  const summaries = new Map(summariseLeagues(entries).map((s) => [s.mode.key, s]));
  const leagues = summaries.size;

  return (
    <section aria-labelledby="league-cards-heading" data-testid="league-cards">
      <h2 id="league-cards-heading" className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary">
        Your stable · {stableName}
        {entries.length > 0 && ` · ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} in ${leagues} ${leagues === 1 ? 'league' : 'leagues'}`}
      </h2>
      <ScrollRow as="navigation" label="Leagues" wrapFrom="never" className="xl:[&>div]:grid xl:[&>div]:grid-cols-6 xl:[&>div]:overflow-visible">
        {LEAGUE_MODES.map((mode) => {
          const summary = summaries.get(mode.key);
          const selected = mode.key === active;
          return (
            <Link
              key={mode.key}
              to={hrefFor(mode.key)}
              aria-current={selected ? 'page' : undefined}
              data-testid={`league-card-${mode.key}`}
              className={`flex min-h-[44px] w-44 shrink-0 flex-col rounded-lg border bg-surface p-3 text-left transition-colors hover:bg-surface-elevated sm:w-48 xl:w-auto ${
                selected ? 'border-primary ring-1 ring-primary' : 'border-white/10'
              }`}
            >
              <span className="text-sm font-semibold text-white">{mode.label}</span>
              {summary ? (
                <>
                  <span className="mt-1 text-xs text-secondary">
                    {entityCount(mode, summary.count)} in {summary.tierCount} {summary.tierCount === 1 ? 'tier' : 'tiers'}
                  </span>
                  {summary.best && (
                    <span className="mt-0.5 text-xs text-white">
                      Best: #{summary.best.place}, {instanceLabel(summary.best.leagueInstanceId)}
                    </span>
                  )}
                  {summary.movement && (
                    <span className={`mt-1.5 text-xs ${TONE_TEXT[summary.movement.tone]}`}>{summary.movement.text}</span>
                  )}
                </>
              ) : (
                <span className="mt-1 text-xs text-tertiary">No {mode.entity === 'robot' ? 'robots' : 'teams'} entered</span>
              )}
            </Link>
          );
        })}
      </ScrollRow>
    </section>
  );
}
