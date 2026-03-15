/**
 * RobotStatsTab - Attribute selector, statistical analysis, outlier detection,
 * win rate correlation, league comparison, and top/bottom performers.
 *
 * Extracted from AdminPage.tsx. Manages its own robot-stats data fetching
 * and attribute selection state.
 *
 * Requirements: 3.4
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../utils/apiClient';
import type { RobotStats } from './types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Human-readable label for win-rate quintile buckets. */
const getQuintileLabel = (quintileNumber: number): string => {
  switch (quintileNumber) {
    case 1: return 'Bottom 20%';
    case 2: return '2nd 20%';
    case 3: return '3rd 20%';
    case 4: return '4th 20%';
    case 5: return 'Top 20%';
    default: return `Q${quintileNumber}`;
  }
};

/** Convert camelCase attribute key to a readable title. */
const formatAttributeName = (attr: string): string =>
  attr.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RobotStatsTab(): JSX.Element {
  /* ---------- Local state ---------- */
  const [robotStats, setRobotStats] = useState<RobotStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState<string>('combatPower');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string): void => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  /* ---------- Data fetching ---------- */

  const fetchRobotStats = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await apiClient.get<RobotStats>('/api/admin/stats/robots');
      setRobotStats(response.data);
      setShowStats(true);
      sessionStorage.setItem('adminRobotStatsLoaded', 'true');
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to fetch robot statistics';
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Auto-load on first mount if not previously loaded this session */
  useEffect(() => {
    if (!showStats && !loading) {
      const hasLoadedBefore = sessionStorage.getItem('adminRobotStatsLoaded');
      if (!hasLoadedBefore) {
        fetchRobotStats();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Derived data ---------- */
  const attrStats = robotStats?.attributeStats[selectedAttribute];
  const outliers = robotStats?.outliers[selectedAttribute] ?? [];
  const winRateRows = robotStats?.winRateAnalysis[selectedAttribute] ?? [];
  const topPerformers = robotStats?.topPerformers[selectedAttribute] ?? [];
  const bottomPerformers = robotStats?.bottomPerformers[selectedAttribute] ?? [];

  /* ---------- Render ---------- */
  return (
    <div role="tabpanel" id="stats-panel" aria-labelledby="stats-tab" className="bg-surface rounded-lg p-6">
      {/* Status message */}
      {message && (
        <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">🤖 Robot Attribute Statistics</h2>
        <button
          onClick={fetchRobotStats}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-surface-elevated px-6 py-2 rounded font-semibold transition-colors min-h-[44px]"
        >
          {loading ? 'Loading...' : showStats ? 'Refresh Stats' : 'Load Statistics'}
        </button>
      </div>

      {/* Empty state */}
      {!showStats && !loading && (
        <div className="text-center py-8 text-secondary">
          <p className="mb-4">Click &quot;Load Statistics&quot; to analyze robot attributes and find outliers</p>
          <p className="text-sm">This will show:</p>
          <ul className="text-sm mt-2 space-y-1">
            <li>• Statistical analysis of all 23 attributes</li>
            <li>• Outlier detection using IQR method</li>
            <li>• Win rate correlations</li>
            <li>• League-based comparisons</li>
            <li>• Top/bottom performers</li>
          </ul>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8 text-secondary">
          <div className="animate-pulse">Loading robot statistics...</div>
        </div>
      )}

      {/* Main content */}
      {showStats && robotStats && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="bg-surface-elevated rounded-lg p-4">
            <h3 className="text-xl font-semibold mb-3">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-secondary">Total Robots</p>
                <p className="text-2xl font-bold">{robotStats.summary.totalRobots}</p>
              </div>
              <div>
                <p className="text-secondary">With Battles</p>
                <p className="text-2xl font-bold">{robotStats.summary.robotsWithBattles}</p>
              </div>
              <div>
                <p className="text-secondary">Total Battles</p>
                <p className="text-2xl font-bold">{robotStats.summary.totalBattles}</p>
              </div>
              <div>
                <p className="text-secondary">Win Rate</p>
                <p className="text-2xl font-bold">{robotStats.summary.overallWinRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-secondary">Avg ELO</p>
                <p className="text-2xl font-bold">{robotStats.summary.averageElo}</p>
              </div>
            </div>
          </div>

          {/* Attribute Selector */}
          <div className="bg-surface-elevated rounded-lg p-4">
            <h3 className="text-xl font-semibold mb-3">Select Attribute to Analyze</h3>
            <select
              value={selectedAttribute}
              onChange={(e) => setSelectedAttribute(e.target.value)}
              className="w-full bg-surface text-white px-4 py-2 rounded"
            >
              <optgroup label="Combat Systems">
                <option value="combatPower">Combat Power</option>
                <option value="targetingSystems">Targeting Systems</option>
                <option value="criticalSystems">Critical Systems</option>
                <option value="penetration">Penetration</option>
                <option value="weaponControl">Weapon Control</option>
                <option value="attackSpeed">Attack Speed</option>
              </optgroup>
              <optgroup label="Defensive Systems">
                <option value="armorPlating">Armor Plating</option>
                <option value="shieldCapacity">Shield Capacity</option>
                <option value="evasionThrusters">Evasion Thrusters</option>
                <option value="damageDampeners">Damage Dampeners</option>
                <option value="counterProtocols">Counter Protocols</option>
              </optgroup>
              <optgroup label="Chassis & Mobility">
                <option value="hullIntegrity">Hull Integrity</option>
                <option value="servoMotors">Servo Motors</option>
                <option value="gyroStabilizers">Gyro Stabilizers</option>
                <option value="hydraulicSystems">Hydraulic Systems</option>
                <option value="powerCore">Power Core</option>
              </optgroup>
              <optgroup label="AI Processing">
                <option value="combatAlgorithms">Combat Algorithms</option>
                <option value="threatAnalysis">Threat Analysis</option>
                <option value="adaptiveAI">Adaptive AI</option>
                <option value="logicCores">Logic Cores</option>
              </optgroup>
              <optgroup label="Team Coordination">
                <option value="syncProtocols">Sync Protocols</option>
                <option value="supportSystems">Support Systems</option>
                <option value="formationTactics">Formation Tactics</option>
              </optgroup>
            </select>
          </div>

          {/* Attribute Statistics */}
          {attrStats && (
            <div className="bg-surface-elevated rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-3">
                {formatAttributeName(selectedAttribute)} - Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                {Object.entries(attrStats).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-secondary">{key.toUpperCase()}</p>
                    <p className="text-lg font-bold">{Number(value).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outliers */}
          {outliers.length > 0 && (
            <div className="bg-surface-elevated rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-3 text-warning">
                ⚠️ Outliers Detected ({outliers.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface">
                    <tr>
                      <th className="p-2 text-left">Robot</th>
                      <th className="p-2 text-left">Value</th>
                      <th className="p-2 text-left">League</th>
                      <th className="p-2 text-left">ELO</th>
                      <th className="p-2 text-left">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outliers.map((outlier, idx) => (
                      <tr key={idx} className="border-t border-white/10">
                        <td className="p-2">
                          <Link
                            to={`/robots/${outlier.id}`}
                            className="text-primary hover:underline"
                            aria-label={`View robot details for ${outlier.name}`}
                          >
                            {outlier.name}
                          </Link>
                        </td>
                        <td className="p-2 font-bold text-warning">{outlier.value}</td>
                        <td className="p-2">
                          <span className="px-2 py-1 bg-surface rounded text-xs">{outlier.league}</span>
                        </td>
                        <td className="p-2">{outlier.elo}</td>
                        <td className="p-2">{outlier.winRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Win Rate Analysis */}
          {winRateRows.length > 0 && (
            <div className="bg-surface-elevated rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-3">🎯 Win Rate Correlation</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface">
                    <tr>
                      <th className="p-2 text-left">Quintile</th>
                      <th className="p-2 text-left">Avg Value</th>
                      <th className="p-2 text-left">Avg Win Rate</th>
                      <th className="p-2 text-left">Sample Size</th>
                      <th className="p-2 text-left">Visual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winRateRows.map((quintile, idx) => (
                      <tr key={idx} className="border-t border-white/10">
                        <td className="p-2">{getQuintileLabel(quintile.quintile)}</td>
                        <td className="p-2 font-bold">{quintile.avgValue.toFixed(2)}</td>
                        <td className="p-2 font-bold text-success">{quintile.avgWinRate.toFixed(1)}%</td>
                        <td className="p-2">{quintile.sampleSize}</td>
                        <td className="p-2">
                          <div className="bg-surface rounded h-4 overflow-hidden">
                            <div
                              className="bg-green-500 h-full"
                              style={{ width: `${quintile.avgWinRate}%` }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-secondary mt-2">
                💡 Higher win rate in top quintile = attribute strongly impacts success
              </p>
            </div>
          )}

          {/* League Comparison */}
          {robotStats.statsByLeague && Object.keys(robotStats.statsByLeague).length > 0 && (
            <div className="bg-surface-elevated rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-3">🏆 League Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface">
                    <tr>
                      <th className="p-2 text-left">League</th>
                      <th className="p-2 text-left">Robots</th>
                      <th className="p-2 text-left">Avg ELO</th>
                      <th className="p-2 text-left">Mean {selectedAttribute}</th>
                      <th className="p-2 text-left">Median {selectedAttribute}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'].map((league) => {
                      const leagueData = robotStats.statsByLeague[league];
                      if (!leagueData) return null;
                      const attrData = leagueData.attributes[selectedAttribute];
                      return (
                        <tr key={league} className="border-t border-white/10">
                          <td className="p-2 capitalize font-semibold">{league}</td>
                          <td className="p-2">{leagueData.count}</td>
                          <td className="p-2">{leagueData.averageElo}</td>
                          <td className="p-2 font-bold">{attrData?.mean?.toFixed(2) || 'N/A'}</td>
                          <td className="p-2">{attrData?.median?.toFixed(2) || 'N/A'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Performers */}
          {topPerformers.length > 0 && (
            <div className="bg-surface-elevated rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-3 text-success">🌟 Top 5 Performers</h3>
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {topPerformers.map((robot: any, idx: number) => (
                  <div key={idx} className="bg-surface rounded p-3 flex justify-between items-center">
                    <div>
                      <Link
                        to={`/robots/${robot.id}`}
                        className="font-bold text-lg text-success hover:underline"
                        aria-label={`View robot details for ${robot.name}`}
                      >
                        #{idx + 1} {robot.name}
                      </Link>
                      <p className="text-sm text-secondary">
                        {robot.league} | ELO: {robot.elo} | Win Rate: {robot.winRate}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-success">{robot.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Performers */}
          {bottomPerformers.length > 0 && (
            <div className="bg-surface-elevated rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-3 text-error">📉 Bottom 5 Performers</h3>
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {bottomPerformers.map((robot: any, idx: number) => (
                  <div key={idx} className="bg-surface rounded p-3 flex justify-between items-center">
                    <div>
                      <Link
                        to={`/robots/${robot.id}`}
                        className="font-bold text-error hover:underline"
                        aria-label={`View robot details for ${robot.name}`}
                      >
                        {robot.name}
                      </Link>
                      <p className="text-sm text-secondary">
                        {robot.league} | ELO: {robot.elo} | Win Rate: {robot.winRate}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-error">{robot.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
