/**
 * Last 30 UTC days: battles and refusals (stacked bars) with players (line),
 * and the same numbers as a table, the first three days shown and the rest
 * behind "Show all". Days before recording started this season read "—".
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PracticeDayStats } from '../../../utils/adminPracticeArenaApi';
import { dayLabel, formatCount, formatUnavailable, shortDate } from '../../../utils/adminPracticeArenaFormat';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { ADMIN_FOCUS_RING, AdminPanel } from '../shared';

export interface PracticeDailyTrendProps {
  days: PracticeDayStats[] | null;
  windowDays: number;
  now: Date;
  loading: boolean;
}

const PRIMARY = '#58a6ff';
const WARNING = '#d29922';
const SUCCESS = '#3fb950';
const GRID = 'rgba(255,255,255,0.06)';
const AXIS = '#8b949e';
const COLLAPSED_ROWS = 3;

const cell = (day: PracticeDayStats, value: number): string => (day.recorded ? formatCount(value) : '—');
const plural = (count: number, noun: string): string => `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`;

export function PracticeDailyTrend({ days, windowDays, now, loading }: PracticeDailyTrendProps): ReactNode {
  const [showAll, setShowAll] = useState(false);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const chartData = days ? [...days].reverse().map((day) => ({
    label: shortDate(day.date),
    battles: day.recorded ? day.battles : null,
    refused: day.recorded ? day.rateLimited + day.cycleBusy : null,
    players: day.recorded ? day.players : null,
  })) : [];
  const rows = days ? (showAll ? days : days.slice(0, COLLAPSED_ROWS)) : [];

  return (
    <AdminPanel title={`Last ${windowDays} days`} loading={loading && !days} skeletonRows={6}>
      {days && (
        <div className="space-y-4 p-4 sm:p-5">
          <div className="h-56" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis stroke={AXIS} tick={{ fontSize: 11 }} allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#1a1f29', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 12, color: AXIS }} />
                <Bar dataKey="battles" name="Battles" stackId="day" fill={PRIMARY} fillOpacity={0.75} isAnimationActive={!reduceMotion} />
                <Bar dataKey="refused" name="Refused" stackId="day" fill={WARNING} radius={[3, 3, 0, 0]} isAnimationActive={!reduceMotion} />
                <Line dataKey="players" name="Players" stroke={SUCCESS} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={!reduceMotion} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <ul className="divide-y divide-white/10 md:hidden" aria-label="Practice Arena usage per UTC day, newest first">
            {rows.map((day) => (
              <li key={day.date} className="py-2.5 text-sm">
                <p className="font-medium text-white">{dayLabel(day.date, now)}</p>
                {day.recorded ? (
                  <>
                    <p className="text-secondary">
                      {plural(day.battles, 'battle')} · {plural(day.requests, 'request')} · {plural(day.players, 'player')}
                    </p>
                    <p className={day.cycleBusy + day.rateLimited > 0 ? 'text-warning' : 'text-secondary'}>
                      Refused {day.rateLimited} rate limit · {day.cycleBusy} during a job · unavailable {formatUnavailable(day.unavailableMs)}
                    </p>
                  </>
                ) : (
                  <p className="text-tertiary">Not recorded · unavailable {formatUnavailable(day.unavailableMs)}</p>
                )}
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Practice Arena usage per UTC day, newest first</caption>
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-secondary">
                  <th scope="col" className="py-2 text-left font-semibold">Day</th>
                  <th scope="col" className="py-2 text-right font-semibold">Battles</th>
                  <th scope="col" className="py-2 text-right font-semibold">Requests</th>
                  <th scope="col" className="py-2 text-right font-semibold">Players</th>
                  <th scope="col" className="py-2 text-right font-semibold">Rate limited</th>
                  <th scope="col" className="py-2 text-right font-semibold">During a job</th>
                  <th scope="col" className="py-2 text-right font-semibold">Unavailable</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((day) => (
                  <tr key={day.date} className="border-b border-white/5">
                    <th scope="row" className="py-1.5 text-left font-normal text-white">{dayLabel(day.date, now)}</th>
                    <td className="py-1.5 text-right text-white">{cell(day, day.battles)}</td>
                    <td className="py-1.5 text-right text-white">{cell(day, day.requests)}</td>
                    <td className="py-1.5 text-right text-white">{cell(day, day.players)}</td>
                    <td className="py-1.5 text-right text-white">{cell(day, day.rateLimited)}</td>
                    <td className={`py-1.5 text-right ${day.recorded && day.cycleBusy > 0 ? 'text-warning' : 'text-white'}`}>{cell(day, day.cycleBusy)}</td>
                    <td className="py-1.5 text-right text-white">{formatUnavailable(day.unavailableMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((value) => !value)}
              className={`min-h-11 rounded px-1 text-sm text-primary hover:underline ${ADMIN_FOCUS_RING}`}
            >
              {showAll ? 'Show fewer days' : `Show all ${days.length} days`}
            </button>
            <p className="text-xs text-tertiary">
              “—”: before recording started this season. Unavailable: time scheduler jobs held the lock (practice is refused meanwhile).
            </p>
          </div>
        </div>
      )}
    </AdminPanel>
  );
}
