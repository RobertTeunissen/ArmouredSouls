import type { MouseEvent } from 'react';
import { getSearchShortcutLabel } from '../../utils/searchShortcut';

export type SearchTriggerVariant = 'desktop' | 'mobile';

export interface SearchTriggerProps {
  /** Opens the Search_Palette without changing the current route. */
  onOpenSearch?: () => void;
  /** Gives the owner the control that opened the palette for focus restoration. */
  onOpeningControl?: (control: HTMLButtonElement) => void;
  variant?: SearchTriggerVariant;
  className?: string;
}

const BASE_TRIGGER_CLASS =
  'shrink-0 rounded-md border border-white/10 bg-surface text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-2 focus-visible:ring-primary/50';

function SearchTrigger({
  onOpenSearch,
  onOpeningControl,
  variant = 'desktop',
  className = '',
}: SearchTriggerProps) {
  const isMobile = variant === 'mobile';
  const triggerClassName = [
    isMobile
      ? 'flex min-h-11 min-w-11 items-center justify-center'
      : 'flex min-h-11 min-w-11 items-center gap-2 whitespace-nowrap px-3 py-2',
    BASE_TRIGGER_CLASS,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    onOpeningControl?.(event.currentTarget);
    onOpenSearch?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={triggerClassName}
      aria-label="Open search"
      aria-keyshortcuts="Meta+K Control+K"
      title={isMobile ? 'Search' : undefined}
    >
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      {!isMobile ? (
        <>
          <span>Search</span>
          <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-xs text-secondary">{getSearchShortcutLabel()}</kbd>
        </>
      ) : null}
    </button>
  );
}

export default SearchTrigger;
