/**
 * Testing tools (collapsed): the bulk cycle runner. It runs the full slot map
 * on this environment's data, in the background and under the scheduler's
 * lock. User generation is off by default; the estimate comes from the last
 * run of every slot here.
 */
import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { BulkCycleOptions, SchedulerRun } from '../../../utils/adminCycleApi';
import { elapsedSince, formatDuration } from '../../../utils/adminCycleFormat';
import { ADMIN_FOCUS_RING } from '../shared';

export interface TestingToolsProps {
  /** Sum of the last run of every slot, or null when unknown. */
  estimatedCycleMs: number | null;
  /** The active bulk run (queued or running), if any. */
  activeBulkRun: SchedulerRun | null;
  now: Date;
  /** The page confirms and starts the run, and reports the outcome. */
  onStart: (options: BulkCycleOptions) => void;
}

const MAX_CYCLES = 100;

const OPTIONS: ReadonlyArray<{ key: keyof Omit<BulkCycleOptions, 'cycles'>; label: string; help: string }> = [
  { key: 'generateUsersPerCycle', label: 'Generate stables each cycle', help: 'Adds N generated stables on cycle N.' },
  { key: 'includeTournaments', label: 'Tournaments', help: 'Run the tournament slots.' },
  { key: 'includeKoth', label: 'King of the Hill', help: 'Run the KotH slot.' },
  { key: 'includeDailyFinances', label: 'Finances', help: 'Passive income and operating costs at settlement.' },
];

export function TestingTools({ estimatedCycleMs, activeBulkRun, now, onStart }: TestingToolsProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [cycles, setCycles] = useState('1');
  const [options, setOptions] = useState<Omit<BulkCycleOptions, 'cycles'>>({
    generateUsersPerCycle: false,
    includeTournaments: true,
    includeKoth: true,
    includeDailyFinances: true,
  });
  const [error, setError] = useState<string | null>(null);
  const contentId = useId();
  const cyclesId = useId();
  const errorId = useId();

  const count = Number(cycles);
  const valid = Number.isInteger(count) && count >= 1 && count <= MAX_CYCLES;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!valid) {
      setError(`Enter a whole number from 1 to ${MAX_CYCLES}.`);
      return;
    }
    setError(null);
    onStart({ cycles: count, ...options });
  };

  return (
    <section className="rounded-lg border border-white/10 bg-surface">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-5 py-4 text-left hover:bg-white/5 ${ADMIN_FOCUS_RING}`}
        >
          <span aria-hidden="true" className="text-secondary">{open ? '▾' : '▸'}</span>
          <span className="text-base font-semibold text-white">Testing tools</span>
          <span className="text-sm font-normal text-secondary">
            Bulk cycle runner: runs the full slot map on this environment&apos;s data
            {estimatedCycleMs !== null ? `. About ${formatDuration(estimatedCycleMs)} per cycle here.` : '.'}
          </span>
        </button>
      </h2>
      <div id={contentId} hidden={!open} className="border-t border-white/10 px-5 py-4">
        {activeBulkRun ? (
          <p role="status" className="text-sm text-warning">
            <span aria-hidden="true">● </span>
            Bulk run {activeBulkRun.status === 'running' ? `running for ${elapsedSince(activeBulkRun.startedAt, now)}` : 'queued behind the running job'}.
            Its result appears in Run history.
          </p>
        ) : (
          <form onSubmit={submit} noValidate aria-label="Bulk cycle runner" className="space-y-4">
            <p className="text-sm text-secondary">
              Every slot in order, then settlement, for each cycle. It waits for the scheduler&apos;s lock, so it never overlaps a
              scheduled job, and real stables take part. In a preparation phase it only advances preparation days.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor={cyclesId} className="text-sm text-secondary">Cycles</label>
                <input
                  id={cyclesId}
                  type="number"
                  min={1}
                  max={MAX_CYCLES}
                  inputMode="numeric"
                  value={cycles}
                  onChange={(event) => setCycles(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className={`min-h-11 w-24 rounded-md border border-white/10 bg-surface-elevated px-3 text-white ${ADMIN_FOCUS_RING}`}
                />
              </div>
              <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
                <legend className="sr-only">Options</legend>
                {OPTIONS.map((option) => (
                  <label key={option.key} className="flex min-h-11 items-center gap-2 text-sm text-white" title={option.help}>
                    <input
                      type="checkbox"
                      checked={options[option.key]}
                      onChange={(event) => setOptions((previous) => ({ ...previous, [option.key]: event.target.checked }))}
                      className={`h-5 w-5 accent-primary ${ADMIN_FOCUS_RING}`}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            </div>
            {valid && estimatedCycleMs !== null && (
              <p className="text-xs text-tertiary">Estimated {formatDuration(estimatedCycleMs * count)} for {count} cycle{count === 1 ? '' : 's'}.</p>
            )}
            {error && <p id={errorId} role="alert" className="text-sm text-error">{error}</p>}
            <button
              type="submit"
              className={`min-h-11 rounded-md bg-warning/90 px-5 text-sm font-semibold text-black hover:bg-warning ${ADMIN_FOCUS_RING}`}
            >
              Run {valid ? count : ''} cycle{count === 1 ? '' : 's'}…
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
