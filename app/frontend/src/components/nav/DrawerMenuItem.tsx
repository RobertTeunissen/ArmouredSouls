import { Link } from 'react-router-dom';

export interface DrawerMenuItemProps {
  label: string;
  /** Destination path. Rendered as a real anchor so long-press / Ctrl/Cmd-click can open a new tab (#573). */
  to: string;
  /** Called after an in-app navigation, e.g. to close the drawer. */
  onNavigate?: () => void;
  isActive: boolean;
  disabled?: boolean;
  indent?: boolean;
}

export function DrawerMenuItem({ label, to, onNavigate, isActive, disabled = false, indent = false }: DrawerMenuItemProps): React.ReactElement {
  const classes = `
    block w-full py-3 text-left transition-colors
    ${indent ? 'pl-8 pr-4' : 'px-4'}
    ${disabled
      ? 'text-tertiary cursor-not-allowed opacity-60'
      : isActive
        ? 'text-primary bg-primary/10 border-l-2 border-primary'
        : 'text-primary hover:bg-primary/5'
    }
  `;

  if (disabled) {
    return (
      <button type="button" disabled className={classes} aria-disabled>
        {label}
      </button>
    );
  }

  return (
    <Link to={to} onClick={onNavigate} className={classes} aria-current={isActive ? 'page' : undefined}>
      {label}
    </Link>
  );
}
