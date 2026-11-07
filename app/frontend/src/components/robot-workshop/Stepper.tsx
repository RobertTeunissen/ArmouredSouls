interface StepperProps {
  /** What is being stepped, for the button labels ("Weapon Control level"). */
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement: boolean;
  canIncrement: boolean;
  /** Highlights a value that differs from what is saved. */
  changed?: boolean;
}

const BUTTON = 'flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-surface-elevated text-base font-bold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 lg:h-7 lg:w-7 lg:text-sm';

/** − value + with 44px touch targets on small screens. */
export function Stepper({ label, value, onDecrement, onIncrement, canDecrement, canIncrement, changed = false }: StepperProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" className={BUTTON} onClick={onDecrement} disabled={!canDecrement} aria-label={`Decrease ${label}`}>−</button>
      <span className={`min-w-[2.25rem] text-center text-sm tabular-nums ${changed ? 'font-bold text-primary' : 'text-white'}`} aria-live="polite">
        {value}
      </span>
      <button type="button" className={BUTTON} onClick={onIncrement} disabled={!canIncrement} aria-label={`Increase ${label}`}>+</button>
    </span>
  );
}

export default Stepper;
