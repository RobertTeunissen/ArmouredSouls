import { useState, useEffect } from 'react';
import axios from 'axios';
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

  useEffect(() => {
    fetchAnalytics();
  }, [robotId, lastNCycles]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');

      // Get the latest cycle number
      const latestCycleResponse = await axios.get(
        'http://localhost:3001/api/analytics/cycle/current',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const currentCycle = latestCycleResponse.data.cycleNumber || 1;
      const startCycle = Math.max(1, currentCycle - lastNCycles + 1);
      const endCycle = currentCycle;
      const cycleRange = `[${startCycle},${endCycle}]`;

      // Fetch performance summary
      const summaryResponse = await axios.get(
        `http://localhost:3001/api/analytics/robot/${robotId}/performance?cycleRange=${cycleRange}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSummary(summaryResponse.data);

      // Fetch ELO progression
      const eloResponse = await axios.get(
        `http://localhost:3001/api/analytics/robot/${robotId}/metric/elo?cycleRange=${cycleRange}&includeMovingAverage=true`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setEloProgression(eloResponse.data);

      // Fetch damage dealt progression
      const damageResponse = await axios.get(
        `http://localhost:3001/api/analytics/robot/${robotId}/metric/damageDealt?cycleRange=${cycleRange}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setDamageProgression(damageResponse.data);

      // Fetch credits earned progression
      const creditsResponse = await axios.get(
        `http://localhost:3001/api/analytics/robot/${robotId}/metric/creditsEarned?cycleRange=${cycleRange}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setCreditsProgression(creditsResponse.data);
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.response?.data?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="text-center text-gray-400">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="text-center text-red-400">{error}</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="text-center text-gray-400">No analytics data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-4">
          Performance Summary (Last {lastNCycles} Cycles)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-gray-400 text-sm mb-1">Battles</div>
            <div className="text-2xl font-bold">{summary.battlesParticipated}</div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-gray-400 text-sm mb-1">Win Rate</div>
            <div className="text-2xl font-bold text-green-400">
              {summary.winRate.toFixed(1)}%
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-gray-400 text-sm mb-1">Record</div>
            <div className="text-lg font-bold">
              {summary.wins}W - {summary.losses}L - {summary.draws}D
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-gray-400 text-sm mb-1">ELO Change</div>
            <div
              className={`text-2xl font-bold ${
                summary.eloChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {summary.eloChange >= 0 ? '+' : ''}
              {summary.eloChange}
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-gray-400 text-sm mb-1">Damage Dealt</div>
            <div className="text-xl font-bold text-orange-400">
              {summary.damageDealt.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-gray-400 text-sm mb-1">Damage Received</div>
            <div className="text-xl font-bold text-red-400">
              {summary.damageReceived.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-gray-400 text-sm mb-1">Credits Earned</div>
            <div className="text-xl font-bold text-yellow-400">
              ₡{summary.totalCreditsEarned.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-gray-400 text-sm mb-1">Repair Costs</div>
            <div className="text-xl font-bold text-red-400">
              ₡{(summary.totalRepairCosts ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-gray-400 text-sm mb-1">Fame Earned</div>
            <div className="text-xl font-bold text-purple-400">
              {summary.totalFameEarned.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-gray-400 text-sm mb-1">Kills</div>
            <div className="text-xl font-bold text-orange-400">
              {summary.kills ?? 0}
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <div className="text-gray-400 text-sm mb-1">Destructed</div>
            <div className="text-xl font-bold text-red-400">
              {summary.destructions ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* ELO Progression Chart */}
      {eloProgression && eloProgression.dataPoints.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg">
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
              <span className="text-gray-400">Start ELO:</span>{' '}
              <span className="font-bold">{eloProgression.startValue}</span>
            </div>
            <div>
              <span className="text-gray-400">End ELO:</span>{' '}
              <span className="font-bold">{eloProgression.endValue}</span>
            </div>
            <div>
              <span className="text-gray-400">Avg Change/Cycle:</span>{' '}
              <span
                className={`font-bold ${
                  eloProgression.averageChange >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {eloProgression.averageChange >= 0 ? '+' : ''}
                {eloProgression.averageChange.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Damage Progression Chart */}
      {damageProgression && damageProgression.dataPoints.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg">
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
            <span className="text-gray-400">Total Damage Dealt:</span>{' '}
            <span className="font-bold text-orange-400">
              {damageProgression.totalChange.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Credits Earned Chart */}
      {creditsProgression && creditsProgression.dataPoints.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg">
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
                formatter={(value: number | undefined) => `₡${(value ?? 0).toLocaleString()}`}
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
            <span className="text-gray-400">Total Credits Earned:</span>{' '}
            <span className="font-bold text-yellow-400">
              ₡{creditsProgression.totalChange.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default RobotPerformanceAnalytics;
