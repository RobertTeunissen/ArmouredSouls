import type { TrendDirection } from '../../../utils/trendIndicator';

export interface AdminStatCardProps {
  label: string;
  value: string | number;
  trend?: TrendDirection;
  trendValue?: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
}

const COLOR_MAP: Record<NonNullable<AdminStatCardProps['color']>, string> = {
  primary: 'border-primary/40',
  success: 'border-success/40',
  warning: 'border-warning/40',
  error: 'border-error/40',
  info: 'border-info/40',
};

const TREND_ICON: Record<TrendDirection, string> = {
  up: '▲',
  down: '▼',
  neutral: '—',
};

const TREND_COLOR: Record<TrendDirection, string> = {
  up: 'text-success',
  down: 'text-error',
  neutral: 'text-secondary',
};

export function AdminStatCard({
  label,
  value,
  trend,
  trendValue,
  color = 'primary',
  icon,
}: AdminStatCardProps): React.ReactElement {
  return (
    <div
      className={`bg-surface-elevated rounded-lg border-l-4 ${COLOR_MAP[color]} p-4 flex flex-col gap-1`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-secondary">{label}</span>
        {icon && (
          <span className="text-lg text-tertiary" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>

        {trend && trend !== 'neutral' && (
          <span
            className={`text-xs font-medium ${TREND_COLOR[trend]} flex items-center gap-0.5 pb-0.5`}
            aria-label={`Trend: ${trend}${trendValue ? ` ${trendValue}` : ''}`}
          >
            <span aria-hidden="true">{TREND_ICON[trend]}</span>
            {trendValue && <span>{trendValue}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
