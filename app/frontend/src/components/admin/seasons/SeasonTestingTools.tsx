/**
 * Testing tools (collapsed): extend the current season, and set how many
 * preparation cycles remain. Each shows its effect before the page asks for
 * confirmation. Remaining preparation cycles go from 0 to the configured
 * preparation window; out-of-range values are refused here and by the server.
 */
import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { AdminSeasonState } from '../../../utils/seasonApi';
import { extendEffect } from '../../../utils/adminSeasonFormat';
import { ActionButton, NARROW_INPUT_CLASS } from '../automatons/ui';
import { ADMIN_FOCUS_RING } from '../shared';

export interface SeasonTestingToolsProps {
  state: AdminSeasonState;
  now: Date;
  onExtend: (cycles: number) => void;
  onSetPreparation: (remaining: number) => void;
}

const MAX_EXTENSION = 365;

function wholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  return Number(value);
}

function ExtendForm({ state, now, onExtend }: Pick<SeasonTestingToolsProps, 'state' | 'now' | 'onExtend'>): ReactNode {
  const [value, setValue] = useState('5');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const cycles = wholeNumber(value);
  const valid = cycles !== null && cycles >= 1 && cycles <= MAX_EXTENSION;
  const disabled = state.isLegacy;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!valid) {
      setError(`Enter a whole number from 1 to ${MAX_EXTENSION}.`);
      return;
    }
    setError(null);
    onExtend(cycles);
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Extend the season" className="min-w-0 space-y-2 rounded-lg border border-white/10 bg-surface-elevated p-4">
      <h3 className="text-sm font-semibold text-white">Extend Season {state.seasonNumber}</h3>
      <p id={helpId} className="text-xs text-secondary">
        {disabled
          ? 'Season 0 has no fixed length, so there is nothing to extend.'
          : 'Adds cycles to this season only; later seasons keep the configured length.'}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={inputId} className="text-xs text-secondary">Cycles to add</label>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_EXTENSION}
            value={value}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={[helpId, error ? errorId : null].filter(Boolean).join(' ')}
            className={NARROW_INPUT_CLASS}
          />
        </div>
        <ActionButton type="submit" disabled={disabled}>Extend…</ActionButton>
      </div>
      {!disabled && valid && <p className="text-xs text-tertiary">{extendEffect(state, cycles, now)}</p>}
      {error && <p id={errorId} role="alert" className="text-xs text-error">{error}</p>}
    </form>
  );
}

function PreparationForm({ state, onSetPreparation }: Pick<SeasonTestingToolsProps, 'state' | 'onSetPreparation'>): ReactNode {
  const max = state.config.preparationLengthCycles;
  const [value, setValue] = useState(String(Math.min(state.remainingPreparationCycles, max)));
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const preparing = state.phase === 'preparation';

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const remaining = wholeNumber(value);
    if (remaining === null || remaining > max) {
      setError(`Enter a whole number from 0 to ${max} (the preparation window).`);
      return;
    }
    setError(null);
    onSetPreparation(remaining);
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Set remaining preparation cycles" className="min-w-0 space-y-2 rounded-lg border border-white/10 bg-surface-elevated p-4">
      <h3 className="text-sm font-semibold text-white">Remaining preparation cycles</h3>
      <p id={helpId} className="text-xs text-secondary">
        {preparing
          ? `${state.remainingPreparationCycles} of ${max} remain. 0 starts the competitive phase at the next settlement.`
          : 'Only available during a preparation phase.'}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={inputId} className="text-xs text-secondary">Remaining (0–{max})</label>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            value={value}
            disabled={!preparing}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={[helpId, error ? errorId : null].filter(Boolean).join(' ')}
            className={NARROW_INPUT_CLASS}
          />
        </div>
        <ActionButton type="submit" disabled={!preparing}>Set…</ActionButton>
      </div>
      {error && <p id={errorId} role="alert" className="text-xs text-error">{error}</p>}
    </form>
  );
}

export function SeasonTestingTools({ state, now, onExtend, onSetPreparation }: SeasonTestingToolsProps): ReactNode {
  const [open, setOpen] = useState(false);
  const contentId = useId();
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
          <span className="text-sm font-normal text-secondary">Extend the season, set the remaining preparation cycles</span>
        </button>
      </h2>
      <div id={contentId} hidden={!open} className="grid grid-cols-1 gap-4 border-t border-white/10 px-5 py-4 md:grid-cols-2">
        <ExtendForm state={state} now={now} onExtend={onExtend} />
        <PreparationForm key={`${state.seasonNumber}-${state.phase}`} state={state} onSetPreparation={onSetPreparation} />
      </div>
    </section>
  );
}
