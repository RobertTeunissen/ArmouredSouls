import { Link } from 'react-router-dom';

export interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  isActive: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const BASE_CLASSES = `
  px-3 py-2 rounded-md transition-all duration-150
  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-elevated
`;

/**
 * Top-bar navigation entry. Enabled entries render a real anchor (react-router
 * `Link`) so Ctrl/Cmd-click, middle-click and "Open in new tab" work (#573).
 * Disabled entries stay a non-interactive button.
 */
export function NavLink({ to, children, isActive, onClick, disabled = false }: NavLinkProps): React.ReactElement {
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className={`${BASE_CLASSES} text-tertiary cursor-not-allowed opacity-60`}
        aria-disabled
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        ${BASE_CLASSES} inline-block
        ${isActive
          ? 'text-primary bg-primary/15 border-b-2 border-primary font-semibold rounded-t-md'
          : 'text-secondary hover:text-primary hover:bg-white/5'
        }
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}
