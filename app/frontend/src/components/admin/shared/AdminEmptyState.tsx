export interface AdminEmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
}: AdminEmptyStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <span className="text-4xl mb-3" role="img" aria-hidden="true">
          {icon}
        </span>
      )}

      <h3 className="text-lg font-semibold text-white">{title}</h3>

      {description && (
        <p className="text-sm text-secondary mt-1 max-w-md">{description}</p>
      )}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
