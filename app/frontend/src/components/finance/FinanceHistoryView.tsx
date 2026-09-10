import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { formatFinanceInstant } from '../../utils/financeTime';
import type { FinanceHistoryResponse, FinanceHistoryPoint } from '../../utils/financeApi';
import { ActionEffectTrend } from './ActionEffectTrend';
import { FinanceStatement } from './FinanceStatement';
import { RevenueGrowthForecast } from './RevenueGrowthForecast';

interface ChartPoint {
  point: FinanceHistoryPoint;
  x: number;
  y: number;
}

function chartPoints(points: FinanceHistoryPoint[]): ChartPoint[] {
  if (points.length === 0) return [];
  const values = points.map((point) => point.statement.netCashMovement);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum || 1;

  return points.map((point, index) => ({
    point,
    x: points.length === 1 ? 50 : 6 + (index / (points.length - 1)) * 88,
    y: 10 + ((maximum - point.statement.netCashMovement) / span) * 76,
  }));
}

function isProvisionalPoint(point: FinanceHistoryPoint): boolean {
  return point.statement.provenance.finality === 'current_provisional';
}

function signedCurrency(amount: number): string {
  if (amount === 0) return formatCurrency(0);
  return `${amount > 0 ? '+' : '−'}${formatCurrency(Math.abs(amount))}`;
}

export function FinanceHistoryView({ response }: { response: FinanceHistoryResponse }): React.ReactElement {
  const { points } = response.data;
  const defaultCycle = response.data.selectedCycle?.cycleNumber ?? points.at(-1)?.cycleNumber ?? null;
  const [selectedCycleNumber, setSelectedCycleNumber] = useState<number | null>(defaultCycle);

  useEffect(() => {
    setSelectedCycleNumber(defaultCycle);
  }, [defaultCycle, response.period.asOf, response.period.fromCycle, response.period.toCycle]);

  const selected = points.find((point) => point.cycleNumber === selectedCycleNumber)
    ?? response.data.selectedCycle
    ?? points.at(-1)
    ?? null;
  const selectedIndex = selected === null
    ? -1
    : points.findIndex((point) => point.cycleNumber === selected.cycleNumber);
  const previousPoint = selectedIndex > 0 ? points[selectedIndex - 1] : null;
  const plotted = useMemo(() => chartPoints(points), [points]);
  const path = plotted.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

  if (points.length === 0 || selected === null) {
    return (
      <section className="rounded-lg border border-gray-700 bg-surface-elevated p-4">
        <h2 className="text-xl font-medium">Financial history</h2>
        <p className="mt-3 text-secondary">No completed or current-cycle financial history is available yet. Use Current cycle now, or return after Cycle 1 closes for completed history.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-700 bg-surface-elevated p-4" aria-labelledby="history-chart-heading">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="history-chart-heading" className="text-xl font-medium">Net cash movement by cycle</h2>
            <p className="text-sm text-secondary">Select a point to inspect its complete statement and recorded changes.</p>
          </div>
          <p className="text-sm text-secondary">As of <time dateTime={response.period.asOf}>{formatFinanceInstant(response.period.asOf)}</time></p>
        </div>

        <div className="relative mt-5 h-72 w-full" data-testid="finance-history-chart">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-labelledby="history-svg-title history-svg-description">
            <title id="history-svg-title">Net cash movement line graph</title>
            <desc id="history-svg-description">Net cash movement for Cycles {points.map((point) => point.cycleNumber).join(', ')}. A complete table follows.</desc>
            <line x1="6" y1="88" x2="94" y2="88" stroke="currentColor" className="text-white/20" vectorEffect="non-scaling-stroke" />
            <path d={path} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {plotted.map(({ point, x, y }) => (
              <circle
                key={point.cycleNumber}
                cx={x}
                cy={y}
                r={isProvisionalPoint(point) ? 2 : 1.5}
                fill="currentColor"
                className={isProvisionalPoint(point) ? 'text-warning' : 'text-primary'}
                stroke={point.cycleNumber === selected.cycleNumber ? 'white' : 'none'}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {plotted.map(({ point, x, y }) => (
            <button
              key={point.cycleNumber}
              type="button"
              aria-label={`Cycle ${point.cycleNumber}: ${formatCurrency(point.statement.netCashMovement)} net cash movement${isProvisionalPoint(point) ? ', partial and provisional' : ''}`}
              aria-pressed={point.cycleNumber === selected.cycleNumber}
              onClick={() => setSelectedCycleNumber(point.cycleNumber)}
              className="absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="rounded bg-background/90 px-1">C{point.cycleNumber}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 hidden lg:block">
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">Complete tabular equivalent of the net cash movement chart</caption>
            <thead><tr className="border-b border-white/10 text-left text-secondary"><th className="p-2">Cycle</th><th className="p-2">State</th><th className="p-2 text-right">Earned Credits</th><th className="p-2 text-right">Net movement</th></tr></thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.cycleNumber} className="border-b border-white/5">
                  <td className="p-2">Cycle {point.cycleNumber}</td>
                  <td className="p-2">{isProvisionalPoint(point) ? 'Partial through as-of · Provisional' : 'Completed'}</td>
                  <td className="p-2 text-right tabular-nums">{formatCurrency(point.statement.earnedCredits)}</td>
                  <td className="p-2 text-right tabular-nums">{formatCurrency(point.statement.netCashMovement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-2 lg:hidden" aria-label="Complete history values">
          {points.map((point) => (
            <button
              type="button"
              key={point.cycleNumber}
              onClick={() => setSelectedCycleNumber(point.cycleNumber)}
              className="grid min-h-11 w-full grid-cols-2 gap-2 rounded-md border border-white/10 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="font-medium">Cycle {point.cycleNumber}</span>
              <span className="text-right text-xs text-secondary">{isProvisionalPoint(point) ? 'Partial · Provisional' : 'Completed'}</span>
              <span className="text-sm text-secondary">Earned {formatCurrency(point.statement.earnedCredits)}</span>
              <span className="text-right text-sm tabular-nums">Net {formatCurrency(point.statement.netCashMovement)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-700 bg-surface-elevated p-4" aria-labelledby="selected-net-movement-heading">
        <h2 id="selected-net-movement-heading" className="text-xl font-medium">Selected cycle net cash movement</h2>
        <p className="mt-3 text-2xl font-bold tabular-nums">{signedCurrency(selected.statement.netCashMovement)}</p>
        {previousPoint === null ? (
          <p className="mt-2 text-sm text-secondary">An immediately prior cycle is not available for a net-movement comparison.</p>
        ) : (() => {
          const delta = selected.statement.netCashMovement - previousPoint.statement.netCashMovement;
          const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged';
          return (
            <p className="mt-2 text-sm text-secondary">
              Net cash movement is {direction}{delta === 0 ? '' : ` ${signedCurrency(delta)}`} versus Cycle {previousPoint.cycleNumber}.
            </p>
          );
        })()}
        {isProvisionalPoint(selected) ? (
          <p className="mt-2 text-sm text-warning">Cycle {selected.cycleNumber} is partial through the report as-of time and remains provisional.</p>
        ) : null}
      </section>

      <div aria-live="polite" className="sr-only">Selected Cycle {selected.cycleNumber}</div>
      <RevenueGrowthForecast growth={selected.revenueGrowth} />
      <FinanceStatement
        statement={selected.statement}
        reconciliation={selected.reconciliation}
        limitations={selected.limitations}
        heading={`Cycle ${selected.cycleNumber} statement`}
      />
      <ActionEffectTrend drivers={selected.drivers} />
    </div>
  );
}

export default FinanceHistoryView;
