export interface MobileTabProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export function MobileTab({ icon, label, isActive, onClick }: MobileTabProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center flex-1 h-16
        transition-all duration-150
        ${isActive 
          ? 'text-primary bg-primary/10 font-semibold' 
          : 'text-secondary active:bg-primary/5 active:scale-95'
        }
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className="w-6 h-6 mb-1">
        {icon}
      </div>
      <span className="text-xs leading-tight">{label}</span>
    </button>
  );
}
