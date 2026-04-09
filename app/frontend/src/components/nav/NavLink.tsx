import { useNavigate } from 'react-router-dom';

export interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  isActive: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function NavLink({ to, children, isActive, onClick, disabled = false }: NavLinkProps): React.ReactElement {
  const navigate = useNavigate();
  
  const handleClick = (): void => {
    if (!disabled) {
      navigate(to);
      onClick?.();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`
        px-3 py-2 rounded-md transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-elevated
        ${disabled 
          ? 'text-tertiary cursor-not-allowed opacity-60' 
          : isActive 
            ? 'text-primary bg-primary/15 border-b-2 border-primary font-semibold rounded-t-md' 
            : 'text-secondary hover:text-primary hover:bg-white/5'
        }
      `}
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={disabled}
    >
      {children}
    </button>
  );
}
