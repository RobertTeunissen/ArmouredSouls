/**
 * Toolbar: period presets (This cycle / Last 7 cycles / Whole season /
 * Custom…), the resolved season and cycles, "Last updated" and Refresh.
 */
import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AdminFilterBar, ADMIN_FOCUS_RING } from '../shared';
import { formatUtcTime } from '../../../utils/adminDashboardFormat';
import { validateCustomRange, type SearchPeriod } from '../../../utils/adminSearchAnalyticsFormat';

export interface SearchAnalyticsToolbarProps {
  period: SearchPeriod;
  from: number | null;
  to: number | null;
  /** "Season 2 · cycles 32–38", once the report is loaded. */
  periodCaption: string | null;
  currentCycle: number | null;
  lastUpdated: string | null;
  refreshing: boolean;
  onPresetChange: (period: Exclude<SearchPeriod, 'custom'>) => void;
  onCustomRange: (from: number | null, to: number | null) => void;
  onRefresh: () => void;
}

const PRESETS: ReadonlyArray<{ key: SearchPeriod; label: string; shortLabel?: string }> = [
  { key: 'this', label: 'This cycle' },
  { key: 'last7', label: 'Last 7 cycles', shortLabel: 'Last 7' },
  { key: 'season', label: 'Whole season', shortLabel: 'Season' },
  { key: 'custom', label: 'Custom…', shortLabel: 'Custom' },
];

const INPUT = `min-h-11 w-28 rounded border border-white/10 bg-surface-elevated px-3 text-white ${ADMIN_FOCUS_RING}`;

export function SearchAnalyticsToolbar({
  period,
  from,
  to,
  periodCaption,
  currentCycle,
  lastUpdated,
  refreshing,
  onPresetChange,
  onCustomRange,
  onRefresh,
}: SearchAnalyticsToolbarProps): ReactNode {
  const [customOpen, setCustomOpen] = useState(period === 'custom');
  const [fromText, setFromText] = useState(from === null ? '' : String(from));
  const [toText, setToText] = useState(to === null ? '' : String(to));
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const choose = (key: string): void => {
    if (key === 'custom') {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    setError(null);
    onPresetChange(key as Exclude<SearchPeriod, 'custom'>);
  };

  const apply = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const message = validateCustomRange(fromText, toText, currentCycle);
    setError(message);
    if (message) return;
    onCustomRange(fromText.trim() === '' ? null : Number(fromText), toText.trim() === '' ? null : Number(toText));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <AdminFilterBar
          variant="segmented"
          groupLabel="Period"
          filters={PRESETS.map((preset) => ({
            ...preset,
            active: customOpen ? preset.key === 'custom' : preset.key === period,
          }))}
          onFilterToggle={choose}
        >
          {periodCaption && <span className="text-xs text-tertiary">{periodCaption}</span>}
        </AdminFilterBar>

        <div className="flex items-center justify-between gap-3 xl:mb-4 xl:justify-end">
          <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
            {refreshing ? 'Refreshing…' : lastUpdated ? `Last updated ${formatUtcTime(lastUpdated, true)}` : 'Not loaded yet'}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 py-1.5 text-sm text-white transition-colors motion-reduce:transition-none hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
          >
            <span aria-hidden="true">↻ </span>Refresh
          </button>
        </div>
      </div>

      {customOpen && (
        <form
          onSubmit={apply}
          aria-label="Custom cycle range"
          className="flex flex-wrap items-end gap-3 rounded-lg border border-white/10 bg-surface p-4"
        >
          <label className="flex flex-col gap-1 text-sm text-secondary">
            From cycle
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={fromText}
              onChange={(event) => setFromText(event.target.value)}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-secondary">
            To cycle
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={toText}
              onChange={(event) => setToText(event.target.value)}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              className={INPUT}
            />
          </label>
          <button type="submit" className={`min-h-11 rounded bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark ${ADMIN_FOCUS_RING}`}>
            Apply
          </button>
          {error && <p id={errorId} role="alert" className="basis-full text-sm text-error">{error}</p>}
        </form>
      )}
    </div>
  );
}
