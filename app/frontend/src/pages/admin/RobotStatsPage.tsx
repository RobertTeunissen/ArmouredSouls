/**
 * RobotStatsPage — Summary cards, attribute explorer, and outlier alerts.
 *
 * Migrated from RobotStatsTab.tsx into a standalone page using shared admin
 * UI components.
 *
 * Requirements: 11.1, 11.2, 11.3, 25.1, 25.2, 25.3, 25.4
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AdminPageHeader, AdminStatCard, AdminDataTable } from '../../components/admin/shared';
import apiClient from '../../utils/apiClient';
import type { RobotStats } from '../../components/admin/types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatAttributeName = (attr: string): string =>
  attr.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

const ATTRIBUTE_OPTIONS = [
  { group: 'Combat Systems', attrs: ['combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed'] },
  { group: 'Defensive Systems', attrs: ['armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols'] },
  { group: 'Chassis & Mobility', attrs: ['hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore'] },
  { group: 'AI Processing', attrs: ['combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores'] },
  { group: 'Team Coordination', attrs: ['syncProtocols', 'supportSystems', 'formationTactics'] },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function RobotStatsPage() {
  const [robotStats, setRobotStats] = useState<RobotStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState('combatPower');
  const [error, setError] = useState<string | null>(null);

  const fetchRobotStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<RobotStats>('/api/admin/stats/robots');
      setRobotStats(response.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to fetch robot statistics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRobotStats();
  }, [fetchRobotStats]);

  const attrStats = robotStats?.attributeStats[selectedAttribute];
  const outliers = robotStats?.outliers[selectedAttribute] ?? [];

  return (
    <div data-testid="robot-stats-page" className="space-y-6">
      <AdminPageHeader
        title="Robot Stats"
        subtitle="Attribute analysis, outlier detection, and performance metrics"
        actions={
          <button type="button" onClick={fetchRobotStats} disabled={loading} className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors">
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        }
      />

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">{error}</div>
      )}

      {/* Summary Cards */}
      {robotStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <AdminStatCard label="Total Robots" value={robotStats.summary.totalRobots} color="primary" icon={<span>🤖</span>} />
          <AdminStatCard label="With Battles" value={robotStats.summary.robotsWithBattles} color="info" icon={<span>⚔️</span>} />
          <AdminStatCard label="Total Battles" value={robotStats.summary.totalBattles} color="success" />
          <AdminStatCard label="Win Rate" value={`${robotStats.summary.overallWinRate.toFixed(1)}%`} color="warning" />
          <AdminStatCard label="Avg ELO" value={robotStats.summary.averageElo} color="primary" />
        </div>
      )}

      {/* Attribute Selector */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Select Attribute to Analyze</h3>
        <select
          value={selectedAttribute}
          onChange={(e) => setSelectedAttribute(e.target.value)}
          className="w-full bg-surface-elevated text-white px-4 py-2 rounded"
        >
          {ATTRIBUTE_OPTIONS.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.attrs.map((attr) => (
                <option key={attr} value={attr}>{formatAttributeName(attr)}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Attribute Statistics */}
      {attrStats && (
        <div className="bg-surface rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">{formatAttributeName(selectedAttribute)} — Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            {Object.entries(attrStats).map(([key, value]) => (
              <div key={key} className="bg-surface-elevated rounded p-3">
                <p className="text-secondary text-xs">{key.toUpperCase()}</p>
                <p className="text-lg font-bold">{Number(value).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outlier Alerts */}
      {outliers.length > 0 && (
        <div className="bg-surface rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3 text-warning">⚠️ Outliers Detected ({outliers.length})</h3>
          <AdminDataTable<(typeof outliers)[0] & Record<string, unknown>>
            columns={[
              { key: 'name', label: 'Robot', render: (row) => <Link to={`/robots/${row.id}`} className="text-primary hover:underline">{row.name}</Link> },
              { key: 'value', label: 'Value', align: 'right', render: (row) => <span className="text-warning font-bold">{row.value}</span> },
              { key: 'league', label: 'League', render: (row) => <span className="px-2 py-1 bg-surface-elevated rounded text-xs">{row.league}</span> },
              { key: 'elo', label: 'ELO', align: 'right' },
              { key: 'winRate', label: 'Win Rate', align: 'right', render: (row) => `${row.winRate}%` },
            ]}
            data={outliers as ((typeof outliers)[0] & Record<string, unknown>)[]}
            emptyMessage="No outliers detected"
          />
        </div>
      )}

      {loading && !robotStats && (
        <div className="text-center py-8 text-secondary">Loading robot statistics...</div>
      )}
    </div>
  );
}

export default RobotStatsPage;
