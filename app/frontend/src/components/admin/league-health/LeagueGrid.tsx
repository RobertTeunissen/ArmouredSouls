/**
 * "All leagues": every mode × tier with its active count and status.
 *
 * md and up: a table whose cells open that mode and tier below.
 * Below md: one strip per mode (short counts in tinted squares); the whole
 * strip is one button that selects the mode, so every target is 44 px tall.
 */
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING, AdminPanel } from '../shared';
import type { LeagueHealthMode, LeagueHealthModeSummary } from '../../../utils/adminLeagueHealthApi';
import {
  LEAGUE_TIER_ORDER,
  activeOfTotal,
  formatShortCount,
  gridStatusText,
  modeLabel,
  modeStripLabel,
  tierLabel,
} from '../../../utils/adminLeagueHealthFormat';
import { STATUS_BAR, STATUS_TEXT, STATUS_TINT, STATUS_WORD } from './leagueHealthTones';

export interface LeagueGridProps {
  modes: readonly LeagueHealthModeSummary[] | null;
  selectedMode: LeagueHealthMode;
  loading: boolean;
  onSelect: (mode: LeagueHealthMode, tier: string | null) => void;
}

function Legend(): ReactNode {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary" aria-label="Status colours">
      {(['ok', 'warning', 'blocked', 'empty'] as const).map((level) => (
        <li key={level} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_BAR[level]}`} aria-hidden="true" />
          {STATUS_WORD[level]}
        </li>
      ))}
    </ul>
  );
}

function DesktopGrid({ modes, selectedMode, onSelect }: Required<Omit<LeagueGridProps, 'loading'>> & { modes: readonly LeagueHealthModeSummary[] }): ReactNode {
  return (
    <div className="hidden overflow-x-auto px-3 pb-3 md:block">
      <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
        <caption className="sr-only">Active entities and status per league and tier. Select a cell to open that tier below.</caption>
        <thead>
          <tr>
            <th scope="col" className="w-36 px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-secondary">Mode</th>
            {LEAGUE_TIER_ORDER.map((tier) => (
              <th key={tier} scope="col" className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-secondary">{tierLabel(tier)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modes.map((mode) => {
            const selected = mode.mode === selectedMode;
            return (
              <tr key={mode.mode} className={selected ? 'bg-primary/5' : undefined} aria-current={selected || undefined}>
                <th scope="row" className={`rounded-l-md px-2 text-left font-medium ${selected ? 'text-primary' : 'text-white'}`}>
                  {modeLabel(mode.mode)}
                </th>
                {mode.tiers.map((tier) => {
                  const status = gridStatusText(tier, mode);
                  return (
                    <td key={tier.tier} className="p-0">
                      <button
                        type="button"
                        onClick={() => onSelect(mode.mode, tier.tier)}
                        aria-label={`${modeLabel(mode.mode)} ${tierLabel(tier.tier)}: ${activeOfTotal(tier)} active. ${status}`}
                        className={`relative flex w-full flex-col overflow-hidden rounded bg-surface-elevated py-1.5 pl-4 pr-2 text-left transition-colors motion-reduce:transition-none hover:bg-white/10 ${tier.status.level === 'empty' ? 'opacity-60' : ''} ${ADMIN_FOCUS_RING}`}
                      >
                        <span className={`absolute inset-y-0 left-0 w-[3px] ${STATUS_BAR[tier.status.level]}`} aria-hidden="true" />
                        <span className="truncate font-semibold tabular-nums text-white">
                          {formatCountCell(tier.active, tier.total)}
                        </span>
                        <span className={`truncate text-xs ${tier.status.code === 'ok' && (tier.unsubscribedNotice || tier.lowDemotionNotice) ? 'text-secondary' : STATUS_TEXT[tier.status.level]}`}>
                          {status}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatCountCell(active: number, total: number): ReactNode {
  if (active === total) return total.toLocaleString('en-US');
  return (
    <>
      {active.toLocaleString('en-US')}
      <span className="text-xs font-normal text-secondary"> / {total.toLocaleString('en-US')}</span>
    </>
  );
}

function MobileStrips({ modes, selectedMode, onSelect }: Required<Omit<LeagueGridProps, 'loading'>> & { modes: readonly LeagueHealthModeSummary[] }): ReactNode {
  return (
    <div className="px-3 pb-3 md:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(6,2.25rem)] gap-1 px-2 pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-secondary" aria-hidden="true">
        <span />
        {LEAGUE_TIER_ORDER.map((tier) => <span key={tier}>{tier.charAt(0)}</span>)}
      </div>
      <ul className="space-y-1">
        {modes.map((mode) => {
          const selected = mode.mode === selectedMode;
          const summary = mode.tiers.map((tier) => `${tierLabel(tier.tier)} ${activeOfTotal(tier)} ${gridStatusText(tier, mode)}`).join('; ');
          return (
            <li key={mode.mode}>
              <button
                type="button"
                onClick={() => onSelect(mode.mode, null)}
                aria-pressed={selected}
                aria-label={`${modeLabel(mode.mode)}. ${summary}`}
                className={`grid min-h-11 w-full grid-cols-[minmax(0,1fr)_repeat(6,2.25rem)] items-center gap-1 rounded-md px-2 py-1 text-left ${selected ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-white/5'} ${ADMIN_FOCUS_RING}`}
              >
                <span className={`truncate text-sm ${selected ? 'font-semibold text-primary' : 'text-white'}`}>{modeStripLabel(mode.mode)}</span>
                {mode.tiers.map((tier) => (
                  <span
                    key={tier.tier}
                    className={`flex h-8 items-center justify-center rounded text-[11px] font-bold tabular-nums ${STATUS_TINT[tier.status.level]}`}
                    aria-hidden="true"
                  >
                    {formatShortCount(tier.active)}
                  </span>
                ))}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LeagueGrid({ modes, selectedMode, loading, onSelect }: LeagueGridProps): ReactNode {
  return (
    <AdminPanel title="All leagues" actions={<Legend />} loading={loading && !modes} skeletonRows={6}>
      {modes && (
        <>
          <p className="px-5 pb-1 pt-3 text-xs text-secondary">
            Active entities per tier, with the total when some rows are unsubscribed.
            <span className="hidden md:inline"> Select a cell for its detail.</span>
            <span className="md:hidden"> Tap a mode for its tiers.</span>
          </p>
          <DesktopGrid modes={modes} selectedMode={selectedMode} onSelect={onSelect} />
          <MobileStrips modes={modes} selectedMode={selectedMode} onSelect={onSelect} />
        </>
      )}
    </AdminPanel>
  );
}
