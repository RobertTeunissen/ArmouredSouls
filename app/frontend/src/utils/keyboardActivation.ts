import type { KeyboardEvent } from 'react';

/**
 * `onKeyDown` handler that runs `action` on Enter or Space, the keys a native
 * button responds to. Use it with `role="button"` (or another interactive role)
 * and `tabIndex={0}` on an element that is clickable but cannot be a <button>,
 * e.g. a card whose block content is not valid inside one.
 */
export function onActivationKey(action: () => void): (event: KeyboardEvent<HTMLElement>) => void {
  return (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };
}
