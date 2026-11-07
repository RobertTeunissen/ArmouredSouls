import { useEffect, useId, useState, type ReactNode } from 'react';

interface AttributeInfoProps {
  /** Accessible name of the focusable block (label plus current level). */
  ariaLabel: string;
  description?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Wraps an attribute's icon + name. With a description the block is
 * focusable and reveals it on hover, keyboard focus or tap (#572). The
 * tooltip stays in the DOM so `aria-describedby` works for screen readers.
 *
 * Escape dismisses a visible tooltip, whether opened by hover or focus,
 * without moving focus (WCAG 1.4.13). It stays dismissed until the pointer
 * has left and the block has lost focus.
 */
export function AttributeInfo({ ariaLabel, description, className = '', children }: AttributeInfoProps) {
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const visible = (hovered || focused) && !dismissed;

  useEffect(() => {
    if (!hovered && !focused) setDismissed(false);
  }, [hovered, focused]);

  // Listen at the document so Escape also reaches a hover-only tooltip.
  useEffect(() => {
    if (!visible) return undefined;
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setDismissed(true);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  if (!description) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={`relative cursor-help rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      aria-describedby={tooltipId}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children}
      <div
        id={tooltipId}
        role="tooltip"
        data-state={visible ? 'open' : 'closed'}
        className={`${visible ? 'visible opacity-100' : 'invisible opacity-0'} absolute left-0 top-full z-30 w-64 max-w-[80vw] pt-1 transition-opacity duration-150 motion-reduce:transition-none`}
      >
        <div className="rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-xs leading-relaxed text-secondary shadow-lg">
          {description}
        </div>
      </div>
    </div>
  );
}

export default AttributeInfo;
