/**
 * Mobile admin navigation (below `md`): a hamburger button that opens the
 * full, labelled navigation in a modal drawer.
 *
 * Focus moves into the drawer on open, is trapped while open, and returns to
 * the button on close. Escape, the backdrop, the close button and any
 * navigation close it.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AdminNavList } from './AdminNav';
import { ADMIN_FOCUS_RING } from './shared/focusRing';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AdminMobileNav(): ReactNode {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const close = useCallback((): void => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Close when the route changes (covers browser back/forward too).
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Move focus into the drawer when it opens.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen(true)}
        className={`md:hidden -ml-2 flex h-10 w-10 items-center justify-center rounded-md text-white hover:bg-white/10 ${ADMIN_FOCUS_RING}`}
      >
        <span aria-hidden="true" className="flex flex-col gap-1">
          <span className="block h-0.5 w-5 rounded bg-current" />
          <span className="block h-0.5 w-5 rounded bg-current" />
          <span className="block h-0.5 w-5 rounded bg-current" />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" onKeyDown={onKeyDown}>
          <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={close} data-testid="admin-nav-backdrop" />
          <div
            ref={panelRef}
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-surface-elevated border-r border-white/10 animate-slide-in-left motion-reduce:animate-none"
          >
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
              <span id={titleId} className="text-primary font-bold text-lg tracking-tight">Admin Portal</span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={close}
                className={`flex h-10 w-10 items-center justify-center rounded-md text-secondary hover:text-white hover:bg-white/10 ${ADMIN_FOCUS_RING}`}
              >
                <span aria-hidden="true" className="text-xl leading-none">×</span>
              </button>
            </div>
            <AdminNavList onNavigate={close} />
          </div>
        </div>
      )}
    </>
  );
}
