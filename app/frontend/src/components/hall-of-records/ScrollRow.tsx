import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ScrollRowProps {
  children: ReactNode;
  /** Accessible name of the group (e.g. "Record groups"). */
  label: string;
  /** `group` for a set of buttons, `navigation` for a set of links. */
  as?: 'group' | 'navigation';
  /** Wrap onto several lines from this breakpoint up instead of scrolling. */
  wrapFrom?: 'sm' | 'md' | 'never';
  className?: string;
}

const WRAP_CLASSES: Record<NonNullable<ScrollRowProps['wrapFrom']>, string> = {
  sm: 'sm:flex-wrap sm:overflow-visible',
  md: 'md:flex-wrap md:overflow-visible',
  never: '',
};

/**
 * A single row of chips that scrolls sideways on narrow screens, with a fade
 * on each edge that still has chips beyond it, so a cut-off chip reads as
 * "there is more" rather than as a layout fault.
 */
export function ScrollRow({ children, label, as = 'group', wrapFrom = 'never', className = '' }: ScrollRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const overflowing = el.scrollWidth - el.clientWidth > 1;
    const start = overflowing && el.scrollLeft > 1;
    const end = overflowing && el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade((current) => (current.start === start && current.end === end ? current : { start, end }));
  }, []);

  // Keep the selected chip in view (on a phone it can sit past the right edge),
  // but only when the selection changes, so a player scrolling by hand is never
  // pulled back.
  const lastActive = useRef<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    const active = el?.querySelector<HTMLElement>('[aria-current], [aria-pressed="true"]');
    const activeKey = active?.textContent ?? null;
    if (activeKey === lastActive.current) return;
    lastActive.current = activeKey;
    if (el && active && el.scrollWidth > el.clientWidth) {
      const left = active.offsetLeft - el.offsetLeft;
      if (left < el.scrollLeft || left + active.offsetWidth > el.scrollLeft + el.clientWidth) {
        el.scrollLeft = Math.max(0, left - 16);
      }
    }
    measure();
  });

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        role={as}
        aria-label={label}
        onScroll={measure}
        className={`flex flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] ${WRAP_CLASSES[wrapFrom]}`}
      >
        {children}
      </div>
      {fade.start && (
        <span
          aria-hidden="true"
          data-testid="scroll-fade-start"
          className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent"
        />
      )}
      {fade.end && (
        <span
          aria-hidden="true"
          data-testid="scroll-fade-end"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent"
        />
      )}
    </div>
  );
}
