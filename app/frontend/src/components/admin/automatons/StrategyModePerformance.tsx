/**
 * Strategies tab — Comparison, "Performance by mode": per strategy (and the
 * human reference row) this season's standings in one tiered mode, played
 * rows only, with the sample size. Head-to-head modes show W–L–D and win %;
 * King of the Hill and Grand Melee record no losses, so they show matches,
 * first places, the first-place rate and the best placement. A row below the
 * low-sample rule carries a visible "Low sample" pill. The selected mode is
 * local state (default 1v1 League). A table from 768 px, cards below.
 */
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { ComparisonRow, ModePerformance, TieredStandingsMode } from '../../../utils/automatonAdminApi';
import {
  LOW_SAMPLE_MIN_MATCHES,
  LOW_SAMPLE_MIN_STABLES,
  PLACEMENT_STANDINGS_MODES,
  TEAM_STANDINGS_MODES,
  TIERED_STANDINGS_MODES,
} from '@shared/utils/automatonStandingsTier';
import { FOCUS_RING, Pill } from './ui';
import { EVENT_LABELS, formatNumber, ordinal } from './automatonText';

export interface StrategyModePerformanceProps {
  rows: ComparisonRow[];
}

interface Metric {
  label: string;
  value: (perf: ModePerformance, row: ComparisonRow) => ReactNode;
}

const percentText = (value: number | null): string => (value === null ? '—' : `${formatNumber(value)}%`);

/** The sample size with the "Low sample" pill next to it. */
function sampleCell(perf: ModePerformance): ReactNode {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1 md:justify-start">
      <span>{formatNumber(perf.matches)}</span>
      {perf.lowSample && <Pill tone="warning">Low sample</Pill>}
    </span>
  );
}

function metricsFor(mode: TieredStandingsMode): Metric[] {
  const stablesPlayed: Metric = { label: 'Stables played', value: (perf, row) => `${perf.stablesPlayed} / ${row.stables}` };
  if (PLACEMENT_STANDINGS_MODES.includes(mode)) {
    return [
      stablesPlayed,
      { label: 'Robots played', value: (perf) => formatNumber(perf.entitiesPlayed) },
      { label: 'Matches (n)', value: sampleCell },
      { label: '1st places', value: (perf) => formatNumber(perf.wins) },
      { label: '1st-place rate', value: (perf) => percentText(perf.winPercentage) },
      { label: 'Best placement', value: (perf) => (perf.bestPlacement === null ? '—' : ordinal(perf.bestPlacement)) },
    ];
  }
  return [
    stablesPlayed,
    { label: TEAM_STANDINGS_MODES.includes(mode) ? 'Teams played' : 'Robots played', value: (perf) => formatNumber(perf.entitiesPlayed) },
    { label: 'W–L–D', value: (perf) => `${perf.wins}–${perf.losses}–${perf.draws}` },
    { label: 'Win %', value: (perf) => percentText(perf.winPercentage) },
    { label: 'Battles (n)', value: sampleCell },
  ];
}

function strategyName(row: ComparisonRow): ReactNode {
  return row.reference || row.strategyKey === null
    ? <span><b className="text-white">Human stables</b> <span className="text-secondary">(reference)</span></span>
    : <span className="font-medium text-white">{row.displayName}</span>;
}

export function StrategyModePerformance({ rows }: StrategyModePerformanceProps): ReactNode {
  const [mode, setMode] = useState<TieredStandingsMode>('league_1v1');
  const headingId = useId();
  const metrics = metricsFor(mode);
  const modeLabel = EVENT_LABELS[mode] ?? mode;
  const entries = rows.flatMap((row) => {
    const perf = row.modes.find((m) => m.mode === mode);
    return perf ? [{ row, perf }] : [];
  });

  return (
    <section aria-labelledby={headingId} className="space-y-3 min-w-0 pt-2">
      <h3 id={headingId} className="text-base font-semibold text-white">Performance by mode</h3>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Mode">
        {TIERED_STANDINGS_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-11 px-4 rounded-full text-sm font-medium ${FOCUS_RING} ${mode === m ? 'bg-primary text-white' : 'bg-surface-elevated text-secondary hover:text-white'}`}
          >
            {EVENT_LABELS[m] ?? m}
          </button>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{`Performance in ${modeLabel}`}</caption>
          <thead>
            <tr className="text-left text-secondary border-b border-white/10">
              {['Strategy', ...metrics.map((metric) => metric.label)].map((h) => (
                <th key={h} scope="col" className="py-2 pr-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(({ row, perf }) => (
              <tr key={row.strategyKey ?? 'reference'} className="border-b border-white/5">
                <th scope="row" className="py-2 pr-3 text-left font-normal">{strategyName(row)}</th>
                {metrics.map((metric) => (
                  <td key={metric.label} className="py-2 pr-3 whitespace-nowrap">{metric.value(perf, row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden space-y-3" aria-label={`Performance in ${modeLabel}`}>
        {entries.map(({ row, perf }) => (
          <li key={row.strategyKey ?? 'reference'} className="rounded-lg border border-white/10 bg-surface p-3 text-sm">
            {strategyName(row)}
            <dl className="mt-2 space-y-1">
              {metrics.map((metric) => (
                <div key={metric.label} className="flex justify-between gap-2">
                  <dt className="text-secondary">{metric.label}</dt>
                  <dd className="text-right">{metric.value(perf, row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <p className="text-xs text-secondary">
        Per mode: this season&apos;s standings, counting only robots and teams that have played the mode. The numbers include battles between Automatons and mirror matches between stables of the same strategy, which pull the win % toward 50%. Byes count as wins. King of the Hill and Grand Melee record no losses: their rate is first places ÷ matches, which is not comparable with a head-to-head win %. Low sample: fewer than {LOW_SAMPLE_MIN_STABLES} stables or fewer than {LOW_SAMPLE_MIN_MATCHES} battles or matches.
      </p>
    </section>
  );
}
