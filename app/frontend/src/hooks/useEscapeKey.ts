import { useEffect } from 'react';

/**
 * Runs `onEscape` when Escape is pressed anywhere in the window, while
 * `enabled`. Dialogs use it so the keyboard can dismiss what a backdrop click
 * dismisses (pass `enabled = false` while an action is in progress).
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onEscape, enabled]);
}
