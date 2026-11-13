/**
 * "Stables: All | Players" on the player overviews (#595). The same joined,
 * single-choice control (and the same words) as the admin portal's Stables
 * filter, so both sides of the game name human stables the same way.
 */
import { useId } from 'react';
import { STABLE_FILTER_OPTIONS, type StableFilter } from '../utils/stableFilter';

export interface StableFilterControlProps {
  value: StableFilter;
  onChange: (next: StableFilter) => void;
}

/** Full width on phones, its own width from `sm`, like the admin portal's segmented filters. */
export function StableFilterControl({ value, onChange }: StableFilterControlProps) {
  const labelId = useId();
  return (
    <div className="flex w-full items-center gap-3 sm:w-auto" data-testid="stable-filter">
      <span id={labelId} className="shrink-0 text-sm text-secondary">Stables</span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-1 rounded-md border border-white/10 bg-surface p-0.5 sm:flex-none"
      >
        {STABLE_FILTER_OPTIONS.map((option) => {
          const active = option.key === value;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              title={option.description}
              onClick={() => { if (!active) onChange(option.key); }}
              className={`min-h-11 flex-1 whitespace-nowrap rounded px-4 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-none ${
                active ? 'bg-primary text-white' : 'text-secondary hover:bg-white/5 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

