import type { TrendDirection } from '../../../utils/trendIndicator';

export interface AdminStatCardProps {
  label: string;
  value: string | number;
  trend?: TrendDirection;
  trendValue?: string;
  /**
   * Whether a rising value is good news. Defaults to `higher-is-better`
   * (up = green). Use `lower-is-better` for counts like inactive players.
   */
  trendIntent?: 'higher-is-better' | 'lower-is-better';
  /** Secondary line under the value (e.g. "vs previous 7 days", "124 of 144 robots"). */
  caption?: string;
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

const TREND_WORD: Record<TrendDirection, string> = {
  up: 'up',
  down: 'down',
  neutral: 'unchanged',
};

function trendColor(trend: TrendDirection, intent: NonNullable<AdminStatCardProps['trendIntent']>): string {
  if (trend === 'neutral') return 'text-secondary';
  const good = intent === 'higher-is-better' ? trend === 'up' : trend === 'down';
  return good ? 'text-success' : 'text-error';
}

export function AdminStatCard({
  label,
  value,
  trend,
  trendValue,
  trendIntent = 'higher-is-better',
  caption,
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
        <span className="text-2xl font-bold text-white tabular-nums">{value}</span>

        {trend && trend !== 'neutral' && (
          <span
            className={`text-xs font-medium ${trendColor(trend, trendIntent)} flex items-center gap-0.5 pb-0.5`}
            aria-label={`Trend: ${TREND_WORD[trend]}${trendValue ? ` ${trendValue}` : ''}`}
          >
            <span aria-hidden="true">{TREND_ICON[trend]}</span>
            {trendValue && <span aria-hidden="true">{trendValue}</span>}
          </span>
        )}
      </div>

      {caption && <span className="text-xs text-secondary">{caption}</span>}
    </div>
  );
}
