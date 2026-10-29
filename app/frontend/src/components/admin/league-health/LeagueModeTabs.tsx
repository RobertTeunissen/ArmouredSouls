/**
 * Mode switch of the League Health detail: a row of buttons on desktop,
 * chips that scroll sideways below md.
 */
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import type { LeagueHealthMode } from '../../../utils/adminLeagueHealthApi';
import { LEAGUE_HEALTH_MODES, modeLabel } from '../../../utils/adminLeagueHealthFormat';

export interface LeagueModeTabsProps {
  selected: LeagueHealthMode;
  onSelect: (mode: LeagueHealthMode) => void;
}

export function LeagueModeTabs({ selected, onSelect }: LeagueModeTabsProps): ReactNode {
  return (
    <div role="group" aria-label="League mode" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {LEAGUE_HEALTH_MODES.map((mode) => {
        const active = mode === selected;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            aria-pressed={active}
            className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-sm transition-colors motion-reduce:transition-none md:rounded-md ${active ? 'bg-primary/20 font-semibold text-primary' : 'bg-surface-elevated text-secondary hover:bg-white/10 hover:text-white'} ${ADMIN_FOCUS_RING}`}
          >
            {modeLabel(mode)}
          </button>
        );
      })}
    </div>
  );
}
