/**
 * Small building blocks of the admin Automatons page (Spec #55, task 10.2):
 * buttons with 44 × 44 px touch targets and a visible focus ring, form
 * fields with label and help text, toggle chips, cards, status pills and an accessible
 * dialog (focus trap, Escape, `aria-modal`).
 */
import { useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

export const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary/80',
  secondary: 'bg-surface-elevated text-white border border-white/15 hover:bg-white/10',
  danger: 'bg-red-700 text-white hover:bg-red-600',
  ghost: 'bg-transparent text-primary border border-primary/40 hover:bg-primary/10',
};

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

/** A button of at least 44 × 44 px. */
export function ActionButton({ variant = 'secondary', className = '', type = 'button', children, ...rest }: ActionButtonProps): ReactNode {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1 min-h-11 min-w-11 px-4 py-2 rounded-md text-sm font-medium transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS_RING} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** An icon-only button (Move up / Move down / Remove) of 44 × 44 px with an accessible name. */
export function IconButton({ label, children, className = '', ref, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  label: string;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}): ReactNode {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center min-h-11 min-w-11 rounded-md bg-surface-elevated border border-white/15 text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS_RING} ${className}`}
      {...rest}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

/**
 * A pressed-state toggle chip (`aria-pressed`) of at least 44 px high. The
 * pressed state is never shown by colour alone: a pressed chip also carries
 * a leading check mark and a 2 px white border (both states have `border-2`,
 * so only the check mark shifts the label). The check mark is `aria-hidden`,
 * so the accessible name stays the label (`{label} · {count}`, `{mode label}`)
 * that RTL and Playwright selectors depend on.
 */
export function ToggleChip({ pressed, onClick, children, className = '' }: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}): ReactNode {
  const state = pressed ? 'bg-primary text-white border-white' : 'bg-surface-elevated text-secondary border-transparent hover:text-white';
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 min-h-11 rounded-full border-2 text-sm font-medium transition-colors motion-reduce:transition-none ${FOCUS_RING} ${state} ${className}`}
    >
      {pressed && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}

export function Card({ title, actions, children, className = '', headingLevel = 3 }: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}): ReactNode {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className={`bg-surface border border-white/10 rounded-lg p-4 min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          {title && <Heading className="text-base font-semibold text-white">{title}</Heading>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function FieldHelp({ id, children }: { id: string; children: ReactNode }): ReactNode {
  return <p id={id} className="mt-1 text-xs text-secondary">{children}</p>;
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }): ReactNode {
  return <p id={id} role="alert" className="mt-1 text-xs text-red-300">{children}</p>;
}

const INPUT_BASE = `min-h-11 rounded-md bg-background border border-white/20 px-3 py-2 text-sm text-white ${FOCUS_RING}`;

export const INPUT_CLASS = `w-full ${INPUT_BASE}`;

/** A short number field (targets, bounds, magnitudes): fixed 80 px, never squeezed below the 44 px touch target. */
export const NARROW_INPUT_CLASS = `w-20 min-w-11 shrink-0 ${INPUT_BASE}`;

/** A select in a wrapping row: grows to share the row, wraps to its own line before it gets narrower than 160 px. */
export const FLEX_INPUT_CLASS = `min-w-40 flex-1 basis-40 ${INPUT_BASE}`;

/** Label + control + help text + error, wired with `aria-describedby`. */
export function Field({ label, help, error, children }: {
  label: string;
  help?: ReactNode;
  error?: string | null;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}): ReactNode {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium text-white mb-1">{label}</label>
      {children({ id, 'aria-describedby': describedBy, ...(error ? { 'aria-invalid': true } : {}) })}
      {help && <FieldHelp id={helpId}>{help}</FieldHelp>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

const PILL: Record<string, string> = {
  done: 'bg-white/10 text-secondary',
  bought: 'bg-green-900/60 text-green-200',
  saving: 'bg-amber-900/60 text-amber-200',
  blocked: 'bg-red-900/60 text-red-200',
  waiting: 'bg-white/5 text-secondary',
  active: 'bg-green-900/60 text-green-200',
  draft: 'bg-white/10 text-secondary',
  warning: 'bg-amber-900/60 text-amber-200',
};

export function Pill({ tone, children }: { tone: keyof typeof PILL | string; children: ReactNode }): ReactNode {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PILL[tone] ?? PILL.draft}`}>{children}</span>;
}

/** Inline result or error line under an action. */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }): ReactNode {
  const colour = tone === 'error' ? 'border-red-500/40 text-red-200' : tone === 'success' ? 'border-green-500/40 text-green-200' : 'border-white/15 text-secondary';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${colour}`}>
      {children}
    </div>
  );
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: `role="dialog"`, `aria-modal`, labelled by its title,
 * focus moves in on open and back on close, Tab is trapped, Escape cancels.
 */
export function Dialog({ title, children, actions, onClose }: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}): ReactNode {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-white/10 bg-surface p-5 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-white mb-3">{title}</h2>
        <div className="text-sm text-secondary space-y-3">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}

/** A two-button confirmation dialog (Cancel · {confirm}). */
export function ConfirmDialog({ title, message, confirmLabel, destructive = false, busy = false, onConfirm, onCancel }: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactNode {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      actions={(
        <>
          <ActionButton onClick={onCancel} disabled={busy}>Cancel</ActionButton>
          <ActionButton variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>{confirmLabel}</ActionButton>
        </>
      )}
    >
      {typeof message === 'string' ? <p>{message}</p> : message}
    </Dialog>
  );
}
