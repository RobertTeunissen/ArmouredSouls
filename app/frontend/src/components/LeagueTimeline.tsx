/**
 * LeagueTimeline — Shared step-chart component for league tier change history.
 *
 * Uses Recharts LineChart with type="stepAfter" to show discrete tier transitions.
 * Used in admin dashboard, robot detail page, and tag team management page.
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface LeagueHistoryEntry {
  cycleNumber: number;
  destinationTier: string;
  changeType: 'promotion' | 'demotion';
  leaguePoints: number;
  mode?: string | null;
}

interface LeagueTimelineProps {
  history: LeagueHistoryEntry[];
  currentTier: string;
  emptyMessage?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TIER_ORDER: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
  champion: 6,
};

const TIER_NAMES: Record<number, string> = {
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Platinum',
  5: 'Diamond',
  6: 'Champion',
};

/* ------------------------------------------------------------------ */
/*  Custom Dot Renderer                                                */
/* ------------------------------------------------------------------ */

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { changeType: string };
}

function CustomDot({ cx, cy, payload }: DotProps): React.ReactElement | null {
  if (cx == null || cy == null || !payload) return null;

  const color = payload.changeType === 'promotion' ? '#22c55e' : '#ef4444';

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={color}
      stroke={color}
      strokeWidth={2}
      data-testid={`dot-${payload.changeType}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */

interface TooltipPayloadItem {
  payload: {
    cycleNumber: number;
    tierValue: number;
    changeType: string;
    leaguePoints: number;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps): React.ReactElement | null {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const tierName = TIER_NAMES[data.tierValue] || 'Unknown';

  return (
    <div className="bg-surface-elevated border border-white/10 rounded-lg p-3 text-sm shadow-lg">
      <div className="font-semibold text-white mb-1">{tierName}</div>
      <div className="text-secondary">Cycle: {data.cycleNumber}</div>
      <div className="text-secondary">LP: {data.leaguePoints}</div>
      <div className={data.changeType === 'promotion' ? 'text-green-400' : 'text-red-400'}>
        {data.changeType === 'promotion' ? '▲ Promotion' : '▼ Demotion'}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function LeagueTimeline({ history, currentTier, emptyMessage }: LeagueTimelineProps): React.ReactElement {
  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-secondary" data-testid="league-timeline-empty">
        {emptyMessage || `Currently in ${currentTier} league. No tier changes recorded yet.`}
      </div>
    );
  }

  // Transform history entries into chart data
  const chartData = history.map((entry) => ({
    cycleNumber: entry.cycleNumber,
    tierValue: TIER_ORDER[entry.destinationTier.toLowerCase()] || 1,
    changeType: entry.changeType,
    leaguePoints: entry.leaguePoints,
  }));

  const tierTickFormatter = (value: number): string => {
    return TIER_NAMES[value] || '';
  };

  return (
    <div className="w-full h-64" data-testid="league-timeline-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
          <XAxis
            dataKey="cycleNumber"
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            label={{ value: 'Cycle', position: 'insideBottom', offset: -5, fill: '#9ca3af' }}
          />
          <YAxis
            domain={[0.5, 6.5]}
            ticks={[1, 2, 3, 4, 5, 6]}
            tickFormatter={tierTickFormatter}
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="stepAfter"
            dataKey="tierValue"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 7, fill: '#3b82f6' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default LeagueTimeline;
