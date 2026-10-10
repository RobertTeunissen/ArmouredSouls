/**
 * Strategies tab — Comparison (Spec #55, R11.13, R11.14, PLAYER_FACING_TEXT
 * §6.4, design §17.3, task 10.4): per strategy with active stables, averages
 * over its active stables and the win rate against humans, with the human
 * reference row. Clicking a strategy opens the Stables tab filtered on it.
 * A table from 768 px, one card per strategy below.
 */
import type { ReactNode } from 'react';
import type { ComparisonRow, StrategyComparison } from '../../../utils/automatonAdminApi';
import { FOCUS_RING } from './ui';
import { formatCredits, formatNumber, tierLabel } from './automatonText';

export interface StrategyComparisonTableProps {
  comparison: StrategyComparison | null;
  error: string | null;
  onOpenStrategy: (strategyKey: string) => void;
}

function robotsText(row: ComparisonRow): string {
  const average = formatNumber(row.robots.average);
  if (row.reference || row.robots.targetAverage === null) return average;
  return `${average} / ${formatNumber(row.robots.targetAverage)}`;
}

function bestTierText(row: ComparisonRow): string {
  return row.bestTier ? `${tierLabel(row.bestTier.tier)} (${row.bestTier.stables})` : '—';
}

function winRateText(row: ComparisonRow, short = false): string {
  const rate = row.winRate;
  if (!rate || rate.percentage === null || rate.total === 0) return '—';
  const percent = `${formatNumber(rate.percentage)}%`;
  return short ? `${percent} · ${rate.total} battles` : `${percent} · ${rate.wins}–${rate.losses}–${rate.draws} of ${rate.total}`;
}

export function StrategyComparisonTable({ comparison, error, onOpenStrategy }: StrategyComparisonTableProps): ReactNode {
  if (error) return <p role="alert" className="text-sm text-red-300">{error}</p>;
  if (!comparison) return <p className="text-sm text-secondary">Loading…</p>;
  const { season, rows } = comparison;

  const name = (row: ComparisonRow): ReactNode => (row.reference || row.strategyKey === null ? (
    <span><b className="text-white">Human stables</b> <span className="text-secondary">(reference)</span></span>
  ) : (
    <button type="button" onClick={() => onOpenStrategy(row.strategyKey as string)} className={`min-h-11 min-w-11 text-left font-medium text-primary hover:underline ${FOCUS_RING}`}>
      {row.displayName}
    </button>
  ));

  return (
    <div className="space-y-3 min-w-0">
      <p className="text-sm text-secondary">Season {season.seasonNumber} · cycle {season.cycle} of {season.lengthCycles} · averages over active stables</p>
      {rows.length === 0 ? (
        <p className="text-sm text-secondary">—</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-secondary border-b border-white/10">
                  {['Strategy', 'Stables', 'Robots (avg / target)', 'Prestige (avg)', 'Best tier reached', 'Credits (avg)', 'Win rate vs humans'].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.strategyKey ?? 'reference'} className="border-b border-white/5">
                    <td className="py-1 pr-3">{name(row)}</td>
                    <td className="py-2 pr-3">{row.stables}</td>
                    <td className="py-2 pr-3">{robotsText(row)}</td>
                    <td className="py-2 pr-3">{formatNumber(Math.round(row.prestigeAverage))}</td>
                    <td className="py-2 pr-3">{bestTierText(row)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatCredits(row.creditsAverage)}</td>
                    <td className="py-2 pr-3">{row.reference ? '—' : winRateText(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden space-y-3">
            {rows.map((row) => (
              <li key={row.strategyKey ?? 'reference'} className="rounded-lg border border-white/10 bg-surface p-3 text-sm">
                <div className="flex items-center justify-between gap-2">{name(row)}<span className="text-secondary">{row.stables} stables</span></div>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Robots (avg / target)</dt><dd>{robotsText(row)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Prestige (avg)</dt><dd>{formatNumber(Math.round(row.prestigeAverage))}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Best tier</dt><dd>{bestTierText(row)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Credits (avg)</dt><dd>{formatCredits(row.creditsAverage)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Win rate vs humans</dt><dd>{row.reference ? '—' : winRateText(row, true)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-secondary">
        Best tier reached: the highest league tier any robot or team of the strategy currently holds in any mode, with the number of stables at that tier. Win rate: wins ÷ all head-to-head battles against humans this season (1v1, 2v2 and 3v3 leagues and tournaments, Tag Team); byes, King of the Hill and Grand Melee are not counted.
      </p>
    </div>
  );
}
