/**
 * Pressed-state toggle chip shared by the admin pages' filters (stable type,
 * window, area, result).
 */
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING } from './focusRing';

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
      className={`inline-flex items-center gap-1.5 min-h-11 rounded-full border-2 text-sm font-medium transition-colors motion-reduce:transition-none ${ADMIN_FOCUS_RING} ${state} ${className}`}
    >
      {pressed && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}
