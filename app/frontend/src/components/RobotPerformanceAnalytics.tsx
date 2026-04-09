import { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';
import { getKothRobotPerformance, KothRobotPerformance } from '../utils/kothApi';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface RobotPerformanceAnalyticsProps {
  robotId: number;
  lastNCycles?: number;
}

interface PerformanceSummary {
  robotId: number;
  cycleRange: [number, number];
  battlesParticipated: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  damageDealt: number;
  damageReceived: number;
  totalCreditsEarned: number;
  totalFameEarned: number;
  totalRepairCosts: number;
  kills: number;
  destructions: number;
  eloChange: number;
  eloStart: number;
  eloEnd: number;
}

interface MetricProgression {
  robotId: number;
  metric: string;
  cycleRange: [number, number];
  dataPoints: Array<{
    cycleNumber: number;
    value: number;
    change: number;
  }>;
  startValue: number;
  endValue: number;
  totalChange: number;
  averageChange: number;
  movingAverage: number[];
}

function RobotPerformanceAnalytics({ robotId, lastNCycles = 10 }: RobotPerformanceAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [eloProgression, setEloProgression] = useState<MetricProgression | null>(null);
  const [damageProgression, setDamageProgression] = useState<MetricProgression | null>(null);
  const [creditsProgression, setCreditsProgression] = useState<MetricProgression | null>(null);
  const [kothStats, setKothStats] = useState<KothRobotPerformance | null>(null);

  useEffect(() => {
    fetchAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robotId, lastNCycles]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      // Get the latest cycle number
      const latestCycleResponse = await apiClient.get(
        '/api/analytics/cycle/current'
      );

      const currentCycle = latestCycleResponse.data.cycleNumber || 1;
      const startCycle = Math.max(1, currentCycle - lastNCycles + 1);
      const endCycle = currentCycle;
      const cycleRange = `[${startCycle},${endCycle}]`;

      // Fetch performance summary
      const summaryResponse = await apiClient.get(
        `/api/analytics/robot/${robotId}/performance?cycleRange=${cycleRange}`
      );
      setSummary(summaryResponse.data);

      // Fetch ELO progression
      const eloResponse = await apiClient.get(
        `/api/analytics/robot/${robotId}/metric/elo?cycleRange=${cycleRange}&includeMovingAverage=true`
      );
      setEloProgression(eloResponse.data);

      // Fetch damage dealt progression
      const damageResponse = await apiClient.get(
        `/api/analytics/robot/${robotId}/metric/damageDealt?cycleRange=${cycleRange}`
      );
      setDamageProgression(damageResponse.data);

      // Fetch credits earned progression
      const creditsResponse = await apiClient.get(
        `/api/analytics/robot/${robotId}/metric/creditsEarned?cycleRange=${cycleRange}`
      );
      setCreditsProgression(creditsResponse.data);

      // Fetch KotH performance
      try {
        const kothResponse = await getKothRobotPerformance(robotId);
        if (kothResponse && kothResponse.kothMatches > 0) {
          setKothStats(kothResponse);
        } else {
          setKothStats(null);
        }
      } catch {
        setKothStats(null);
      }
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (import.meta.env.DEV) {
        console.error('Failed to fetch analytics:', err);
      }
      setError(err.response?.data?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface p-6 rounded-lg">
        <div className="text-center text-secondary">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface p-6 rounded-lg">
        <div className="text-center text-error">{error}</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-surface p-6 rounded-lg">
        <div className="text-center text-secondary">No analytics data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <div className="bg-surface p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-4">
          Performance Summary (Last {lastNCycles} Cycles)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-elevated p-4 rounded">
            <div className="text-secondary text-sm mb-1">Battles</div>
            <div className="text-2xl font-bold">{summary.battlesParticipated}</div>
          </div>
          <div className="bg-surface-elevated p-4 rounded">
            <div className="text-secondary text-sm mb-1">Win Rate</div>
            <div className="text-2xl font-bold text-success">
              {(summary.winRate ?? 0).toFixed(1)}%
            </div>
          </div>
          <div className="bg-surface-elevated p-4 rounded">
            <div className="text-secondary text-sm mb-1">Record</div>
            <div className="text-lg font-bold">
              {summary.wins}W - {summary.losses}L - {summary.draws}D
            </div>
          </div>
          <div className="bg-surface-elevated p-4 rounded">
            <div className="text-secondary text-sm mb-1">ELO Change</div>
            <div
              className={`text-2xl font-bold ${
                summary.eloChange >= 0 ? 'text-success' : 'text-error'
              }`}
            >
              {summary.eloChange >= 0 ? '+' : ''}
              {summary.eloChange}
            </div>
          </div>
          <div className="bg-surface-elevated p-4 rounded">
            <div className="text-secondary text-sm mb-1">Damage Dealt</div>
            <div className="text-xl font-bold text-orange-400">
              {(summary.damageDealt ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-surface-elevated p-4 rounded">
            <div className="text-secondary text-sm mb-1">Damage Received</div>
            <div className="text-xl font-bold text-error">
              {(summary.damageReceived ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-surface-elevated p-4 rounded">
            <div className="text-secondary text-sm mb-1">Credits Earned</div>
            <div className="text-xl font-bold text-warning">
              ₡{(summary.totalCreditsEarned ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-surface-elevated p-4 rounded">
            <div className="text-secondary text-sm mb-1">Repair Costs</div>
            <div className="text-xl font-bold text-error">
              ₡{(summary.totalRepairCosts ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-surface-elevated p-4 rounded">
            <div className="text-secondary text-sm mb-1">Fame Earned</div>
            <div className="text-xl font-bold text-purple-400">
              {(summary.totalFameEarned ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-surface-elevated p-4 rounded">
            <div className="text-secondary text-sm mb-1">Kills</div>
            <div className="text-xl font-bold text-orange-400">
              {summary.kills ?? 0}
            </div>
          </div>
          <div className="bg-surface-elevated p-4 rounded">
            <div className="text-secondary text-sm mb-1">Destructed</div>
            <div className="text-xl font-bold text-error">
              {summary.destructions ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* KotH Performance */}
      {kothStats && kothStats.kothMatches > 0 && (
        <div className="bg-surface-elevated rounded-lg p-4 mt-6">
          <h3 className="text-lg font-semibold mb-4">👑 King of the Hill Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-orange-500">{kothStats.kothMatches}</div>
              <div className="text-xs text-secondary">KotH Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-orange-500">{kothStats.kothWins}</div>
              <div className="text-xs text-secondary">1st Place Finishes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-orange-500">{(kothStats.podiumRate ?? 0).toFixed(1)}%</div>
              <div className="text-xs text-secondary">Podium Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-orange-500">{(kothStats.avgZoneScore ?? 0).toFixed(1)}</div>
              <div className="text-xs text-secondary">Avg Zone Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-orange-500">{(kothStats.kothTotalZoneTime ?? 0).toFixed(0)}s</div>
              <div className="text-xs text-secondary">Total Zone Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-orange-500">{kothStats.kothKills}</div>
              <div className="text-xs text-secondary">KotH Kills</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-orange-500">{kothStats.kothBestPlacement ? `#${kothStats.kothBestPlacement}` : '—'}</div>
              <div className="text-xs text-secondary">Best Placement</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-orange-500">{kothStats.kothCurrentWinStreak}</div>
              <div className="text-xs text-secondary">Current Win Streak</div>
            </div>
          </div>
        </div>
      )}

      {/* ELO Progression Chart */}
      {eloProgression && eloProgression.dataPoints.length > 0 && (
        <div className="bg-surface p-6 rounded-lg">
          <h3 className="text-xl font-bold mb-4">ELO Progression</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={eloProgression.dataPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="cycleNumber"
                stroke="#9CA3AF"
                label={{ value: 'Cycle', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                stroke="#9CA3AF"
                label={{ value: 'ELO', angle: -90, position: 'insideLeft' }}
                domain={[
                  (dataMin: number) => Math.floor(dataMin * 0.95),
                  (dataMax: number) => Math.ceil(dataMax * 1.05)
                ]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: '#F3F4F6' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3B82F6"
                strokeWidth={2}
                name="ELO"
                dot={{ fill: '#3B82F6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-secondary">Start ELO:</span>{' '}
              <span className="font-bold">{eloProgression.startValue}</span>
            </div>
            <div>
              <span className="text-secondary">End ELO:</span>{' '}
              <span className="font-bold">{eloProgression.endValue}</span>
            </div>
            <div>
              <span className="text-secondary">Avg Change/Cycle:</span>{' '}
              <span
                className={`font-bold ${
                  eloProgression.averageChange >= 0 ? 'text-success' : 'text-error'
                }`}
              >
                {eloProgression.averageChange >= 0 ? '+' : ''}
                {(eloProgression.averageChange ?? 0).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Damage Progression Chart */}
      {damageProgression && damageProgression.dataPoints.length > 0 && (
        <div className="bg-surface p-6 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Damage Dealt Per Cycle</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={damageProgression.dataPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="cycleNumber"
                stroke="#9CA3AF"
                label={{ value: 'Cycle', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                stroke="#9CA3AF"
                label={{ value: 'Damage', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: '#F3F4F6' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="change"
                stroke="#F97316"
                strokeWidth={2}
                name="Damage Dealt"
                dot={{ fill: '#F97316', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm">
            <span className="text-secondary">Total Damage Dealt:</span>{' '}
            <span className="font-bold text-orange-400">
              {damageProgression.totalChange.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Credits Earned Chart */}
      {creditsProgression && creditsProgression.dataPoints.length > 0 && (
        <div className="bg-surface p-6 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Credits Earned Per Cycle</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={creditsProgression.dataPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="cycleNumber"
                stroke="#9CA3AF"
                label={{ value: 'Cycle', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                stroke="#9CA3AF"
                label={{ value: 'Credits', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: '#F3F4F6' }}
                formatter={(value) => `₡${(Number(value) || 0).toLocaleString()}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="change"
                stroke="#EAB308"
                strokeWidth={2}
                name="Credits Earned"
                dot={{ fill: '#EAB308', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm">
            <span className="text-secondary">Total Credits Earned:</span>{' '}
            <span className="font-bold text-warning">
              ₡{creditsProgression.totalChange.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default RobotPerformanceAnalytics;
