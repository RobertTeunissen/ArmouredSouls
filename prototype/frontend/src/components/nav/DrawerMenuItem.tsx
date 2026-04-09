export interface DrawerMenuItemProps {
  label: string;
  onClick: () => void;
  isActive: boolean;
  disabled?: boolean;
  indent?: boolean;
}

export function DrawerMenuItem({ label, onClick, isActive, disabled = false, indent = false }: DrawerMenuItemProps): React.ReactElement {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        w-full py-3 text-left transition-colors
        ${indent ? 'pl-8 pr-4' : 'px-4'}
        ${disabled
          ? 'text-tertiary cursor-not-allowed opacity-60'
          : isActive 
            ? 'text-primary bg-primary/10 border-l-2 border-primary' 
            : 'text-primary hover:bg-primary/5'
        }
      `}
      aria-disabled={disabled}
    >
      {label}
    </button>
  );
}
