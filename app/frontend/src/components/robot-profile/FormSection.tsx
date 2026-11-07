import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import UpcomingMatches from '../UpcomingMatches';
import { api } from '../../utils/api';
import { getTierName } from '../../utils/tierHelpers';
import { battleTypeLabel } from '../../utils/stableViewFormat';
import type { FormItem } from '../../utils/robotProfileFormat';
import type { BattleReadiness } from '../../utils/robot-battle-readiness';

interface FormSectionProps {
  robotId: number;
  form: readonly FormItem[] | null;
  isOwner: boolean;
  battleReadiness?: BattleReadiness;
}

interface EloPoint {
  cycleNumber: number;
  value: number;
}

/** Cycles shown in the ELO chart. */
const ELO_CYCLES = 10;

const RESULT_TONE: Record<FormItem['kind'], string> = {
  win: 'text-success', first: 'text-warning', loss: 'text-error', draw: 'text-secondary', placement: 'text-secondary', unknown: 'text-secondary',
};

function EloChart({ robotId }: { robotId: number }) {
  const [points, setPoints] = useState<EloPoint[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = await api.get<{ cycleNumber?: number }>('/api/analytics/cycle/current');
        const end = current.cycleNumber || 1;
        const cycleRange = `[${Math.max(1, end - ELO_CYCLES + 1)},${end}]`;
        const data = await api.get<{ dataPoints: EloPoint[] }>(`/api/analytics/robot/${robotId}/metric/elo`, { params: { cycleRange } });
        if (!cancelled) setPoints(data.dataPoints ?? []);
      } catch {
        if (!cancelled) setPoints([]);
      }
    })();
    return () => { cancelled = true; };
  }, [robotId]);

  return (
    <div className="rounded-lg border border-white/10 bg-surface p-4 sm:p-5">
      <h3 className="text-sm font-semibold">ELO, last {ELO_CYCLES} cycles</h3>
      {points === null && <p className="mt-6 text-sm text-secondary">Loading…</p>}
      {points?.length === 0 && <p className="mt-6 text-sm text-secondary">No ELO history this season yet.</p>}
      {points && points.length > 0 && (
        <div className="mt-3 h-52" role="img" aria-label={`ELO from ${points[0].value} to ${points[points.length - 1].value} over the last ${points.length} cycles`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" vertical={false} />
              <XAxis dataKey="cycleNumber" stroke="#8b949e" tick={{ fontSize: 11 }} />
              <YAxis stroke="#8b949e" tick={{ fontSize: 11 }} domain={[(min: number) => Math.floor((min - 10) / 10) * 10, (max: number) => Math.ceil((max + 10) / 10) * 10]} tickCount={4} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#252b38', border: '1px solid #ffffff1a', borderRadius: 8 }} labelFormatter={(c) => `Cycle ${c}`} />
              <Line type="monotone" dataKey="value" name="ELO" stroke="#58a6ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/** ELO trend, recent matches and what is scheduled next. */
export function FormSection({ robotId, form, isOwner, battleReadiness }: FormSectionProps) {
  const recent = (form ?? []).slice(0, 6);
  return (
    <section aria-labelledby="form-heading">
      <h2 id="form-heading" className="mb-3 text-lg font-semibold">Form</h2>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3"><EloChart robotId={robotId} /></div>
        <div className="rounded-lg border border-white/10 bg-surface p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Recent matches</h3>
            {isOwner && <Link to="/battle-history" className="text-xs text-primary hover:underline">Battle history →</Link>}
          </div>
          {form === null ? (
            <p className="mt-3 text-sm text-secondary">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="mt-3 text-sm text-secondary">No battles yet this season.</p>
          ) : (
            <ul className="mt-2 divide-y divide-white/5">
              {recent.map((f) => (
                <li key={f.battleId}>
                  <Link
                    to={`/battle/${f.battleId}`}
                    aria-label={`${battleTypeLabel(f.battleType)}${f.tier ? `, ${getTierName(f.tier)}` : ''}: ${f.label}${f.eloChange !== 0 ? `, ELO ${f.eloChange > 0 ? '+' : '−'}${Math.abs(f.eloChange)}` : ''}`}
                    className="flex min-h-[44px] items-center justify-between gap-3 py-2 text-sm hover:text-primary"
                  >
                    <span className="min-w-0 truncate">
                      {battleTypeLabel(f.battleType)}
                      {f.tier && <span className="text-secondary"> · {getTierName(f.tier)}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className={`font-semibold ${RESULT_TONE[f.kind]}`}>{f.label}</span>
                      {f.eloChange !== 0 && <span className="ml-2 text-xs text-secondary">{f.eloChange > 0 ? '+' : '−'}{Math.abs(f.eloChange)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-4">
        <UpcomingMatches robotId={robotId} battleReadiness={battleReadiness} />
      </div>
    </section>
  );
}

export default FormSection;
