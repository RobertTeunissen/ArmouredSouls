/**
 * Unlock rate per achievement, one row per tier: a dot per achievement on a
 * 0–100% axis and a bar at the tier median. Shows at a glance whether a
 * tier's difficulty holds up. The numbers are in a screen-reader table.
 */
import type { ReactNode } from 'react';
import { AdminPanel } from '../shared';
import type { AchievementTier } from '../../../utils/adminAchievementsApi';
import { formatRate, tierLabel, type TierStrip } from '../../../utils/adminAchievementsFormat';

const TIER_DOT: Record<AchievementTier, string> = {
  easy: 'bg-success',
  medium: 'bg-primary',
  hard: 'bg-warning',
  very_hard: 'bg-error',
  secret: 'bg-info',
};

const TICKS = [0, 25, 50, 75, 100] as const;

/** Vertical offset per dot so equal rates do not hide each other (−6, 0, +6 px). */
function jitter(rates: number[], index: number): number {
  const bucket = Math.round(rates[index] / 2);
  const before = rates.slice(0, index).filter((rate) => Math.round(rate / 2) === bucket).length;
  return ((before % 3) - 1) * 6;
}

export function TierStripChart({ strips, population }: { strips: TierStrip[]; population: string }): ReactNode {
  return (
    <AdminPanel
      title="Unlock rate per achievement, by tier"
      actions={<span className="text-xs text-secondary">One dot per achievement · bar = tier median · rate of {population}</span>}
    >
      <div className="px-5 py-4" aria-hidden="true">
        <div className="relative">
          {strips.map((strip) => (
            <div key={strip.tier} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 py-2">
              <div>
                <p className="text-sm font-semibold text-white">{tierLabel(strip.tier)}</p>
                <p className="text-xs text-secondary">{strip.count} achievements</p>
              </div>
              <div className="relative h-8 border-l border-white/10">
                {TICKS.map((tick) => (
                  <span key={tick} className="absolute inset-y-0 border-l border-dashed border-white/10" style={{ left: `${tick}%` }} />
                ))}
                {strip.rates.map((rate, index) => (
                  <span
                    key={index}
                    className={`absolute top-1/2 h-2 w-2 -translate-x-1/2 rounded-full opacity-80 ${TIER_DOT[strip.tier]}`}
                    style={{ left: `${Math.min(rate, 100)}%`, marginTop: `${jitter(strip.rates, index) - 4}px` }}
                  />
                ))}
                {strip.median !== null && (
                  <span className="absolute inset-y-1 w-0.5 -translate-x-1/2 bg-white" style={{ left: `${Math.min(strip.median, 100)}%` }} />
                )}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
            <span />
            <div className="relative h-4 text-[10px] tabular-nums text-tertiary">
              {TICKS.map((tick) => (
                <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${tick}%` }}>{tick}%</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* sr-only on a <table> does not clip it; the wrapper does. */}
      <div className="sr-only">
        <table>
          <caption>Unlock rate per tier</caption>
          <thead>
            <tr><th scope="col">Tier</th><th scope="col">Achievements</th><th scope="col">Median rate</th><th scope="col">Lowest</th><th scope="col">Highest</th></tr>
          </thead>
          <tbody>
            {strips.map((strip) => (
              <tr key={strip.tier}>
                <th scope="row">{tierLabel(strip.tier)}</th>
                <td>{strip.count}</td>
                <td>{strip.median === null ? '—' : formatRate(strip.median)}</td>
                <td>{strip.rates.length ? formatRate(strip.rates[0]) : '—'}</td>
                <td>{strip.rates.length ? formatRate(strip.rates[strip.rates.length - 1]) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPanel>
  );
}
