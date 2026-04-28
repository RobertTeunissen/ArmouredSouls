export interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: AdminPageHeaderProps): React.ReactElement {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle && (
          <p className="text-sm text-secondary mt-0.5">{subtitle}</p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
