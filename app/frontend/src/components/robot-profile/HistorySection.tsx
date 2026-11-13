import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { fetchRobotLeagueHistory, fetchRobotTeamBattleLeagueHistory } from '../../utils/robotApi';
import { LEAGUE_TIERS, getTierColor, getTierName } from '../../utils/tierHelpers';
import { MODE_LONG_LABELS, ROSTER_MODES, ordinal } from '../../utils/stableViewFormat';
import { tierBands, type HistoryEntry, type TierBand } from '../../utils/robotProfileFormat';
import { useSeasonStore } from '../../stores/seasonStore';
import type { TieredStandingsMode } from '@shared/utils/automatonStandingsTier';
import type { ProfileStanding } from '@shared/types';

interface HistorySectionProps {
  robotId: number;
  standings: readonly ProfileStanding[] | null;
}

interface TournamentRow {
  tournamentId: number;
  tournamentName: string;
  placement: number;
  wins: number;
  losses: number;
}

interface HistoryData {
  byMode: Partial<Record<TieredStandingsMode, HistoryEntry[]>>;
  tournaments: TournamentRow[];
}

async function loadHistory(robotId: number): Promise<HistoryData> {
  const [robot, teams, context] = await Promise.all([
    fetchRobotLeagueHistory(robotId).then((r) => r.data ?? []).catch(() => []),
    fetchRobotTeamBattleLeagueHistory(robotId).then((r) => r.teams ?? []).catch(() => []),
    api.get<{ tournaments?: TournamentRow[] }>(`/api/robots/${robotId}/performance-context`).then((r) => r.tournaments ?? []).catch(() => []),
  ]);
  const byMode: HistoryData['byMode'] = {};
  const push = (mode: TieredStandingsMode, entries: readonly HistoryEntry[]): void => {
    byMode[mode] = [...(byMode[mode] ?? []), ...entries];
  };
  // Records before Spec #44 have no mode; they were all league 1v1.
  push('league_1v1', robot.filter((h) => !h.mode || h.mode === 'league_1v1'));
  push('koth', robot.filter((h) => h.mode === 'koth'));
  push('grand_melee', robot.filter((h) => h.mode === 'grand_melee'));
  for (const team of teams) {
    push(team.teamSize === 3 ? 'league_3v3' : 'league_2v2', team.history ?? []);
    if (team.teamSize === 2) push('tag_team', team.tagTeamHistory ?? []);
  }
  return { byMode, tournaments: context };
}

/** Tier bands per mode over this season, then tournament results. */
export function HistorySection({ robotId, standings }: HistorySectionProps) {
  const seasonCycle = useSeasonStore((s) => s.season?.seasonCycle ?? 0);
  const [data, setData] = useState<HistoryData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    void loadHistory(robotId).then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, [robotId]);

  const rows = data
    ? ROSTER_MODES.flatMap((mode) => {
        const current = standings?.find((s) => s.mode === mode)?.tier ?? null;
        const entries = data.byMode[mode] ?? [];
        if (!current && entries.length === 0) return [];
        return [{ mode, bands: tierBands(entries, current, seasonCycle + 1), changes: entries.length }];
      })
    : [];
  const end = Math.max(2, ...rows.flatMap((r) => r.bands.map((b) => b.toCycle)));
  const seen = new Set(rows.flatMap((r) => r.bands.map((b) => b.tier.toLowerCase())));
  const legend = LEAGUE_TIERS.filter((t) => seen.has(t));
  const promotions = data ? Object.values(data.byMode).flat().filter((e) => e?.changeType === 'promotion').length : 0;
  const demotions = data ? Object.values(data.byMode).flat().filter((e) => e?.changeType === 'demotion').length : 0;

  return (
    <section aria-labelledby="history-heading">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="history-heading" className="text-lg font-semibold">History</h2>
        {data && <span className="text-sm text-secondary">{promotions} {promotions === 1 ? 'promotion' : 'promotions'} · {demotions} {demotions === 1 ? 'demotion' : 'demotions'} this season</span>}
      </div>
      <div className="rounded-lg border border-white/10 bg-surface p-4 sm:p-5">
        {data === null && <p className="text-sm text-secondary">Loading…</p>}
        {data && rows.length === 0 && <p className="text-sm text-secondary">No league history this season yet.</p>}
        {rows.length > 0 && (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.mode} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-[8rem_1fr]">
                <span className="text-xs text-secondary">{MODE_LONG_LABELS[r.mode]}</span>
                <BandStrip bands={r.bands} end={end} mode={MODE_LONG_LABELS[r.mode]} />
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && (
          <div className="mt-2 grid grid-cols-[6.5rem_1fr] gap-3 text-[11px] text-tertiary sm:grid-cols-[8rem_1fr]">
            <span />
            <span className="flex justify-between"><span>Cycle 1</span><span>Cycle {end - 1}</span></span>
          </div>
        )}
        {legend.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary" aria-label="Tier colours">
            {legend.map((tier) => (
              <li key={tier} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm bg-current opacity-70 ${getTierColor(tier)}`} aria-hidden="true" />
                {getTierName(tier)}
              </li>
            ))}
          </ul>
        )}

        {data && data.tournaments.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="text-sm font-semibold">Tournaments</h3>
            <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {data.tournaments.map((t) => (
                <li key={t.tournamentId} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{t.tournamentName}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className={t.placement === 1 ? 'font-semibold text-warning' : 'text-secondary'}>{t.placement === 1 ? 'Champion' : ordinal(t.placement)}</span>
                    <span className="ml-2 text-xs text-secondary">{t.wins}–{t.losses}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function BandStrip({ bands, end, mode }: { bands: readonly TierBand[]; end: number; mode: string }) {
  const span = Math.max(1, end - 1);
  const label = `${mode}: ${bands.map((b) => `${getTierName(b.tier)} from cycle ${b.fromCycle}`).join(', ')}`;
  return (
    <div className="flex h-4 overflow-hidden rounded bg-surface-elevated" role="img" aria-label={label}>
      {bands.map((b) => (
        <span
          key={`${b.tier}-${b.fromCycle}`}
          className={`h-full bg-current opacity-70 ${getTierColor(b.tier)}`}
          style={{ width: `${((b.toCycle - b.fromCycle) / span) * 100}%` }}
          title={`${getTierName(b.tier)} from cycle ${b.fromCycle}${b.leaguePoints !== null ? ` (${b.leaguePoints} LP at the change)` : ''}`}
        />
      ))}
    </div>
  );
}

