/**
 * DashboardTab - System statistics grid with integrated System Health section.
 *
 * Displays grouped stat sections (Robots, Matches, Battles, Finances, Facilities,
 * Weapons, Stances, Loadouts, Yield Thresholds) and absorbs the former
 * SystemHealthPage content as a collapsible <details> block at the bottom.
 *
 * Requirements: 2.1, 2.9
 */
import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../utils/apiClient';
import type { SystemStats } from './types';

/* ------------------------------------------------------------------ */
/*  System Health types (absorbed from SystemHealthPage)               */
/* ------------------------------------------------------------------ */

interface CyclePerformanceMetrics {
  cycleNumber: number;
  totalDuration: number;
  stepDurations: Array<{
    stepName: string;
    stepNumber: number;
    duration: number;
  }>;
  degradations: Array<{
    stepName: string;
    degradationPercentage: number;
    severity: 'warning' | 'critical';
  }>;
}

interface IntegrityReport {
  cycleNumber: number;
  isValid: boolean;
  issues: Array<{
    type: string;
    severity: 'warning' | 'error';
    message: string;
  }>;
}

interface EventStatistics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  uniqueUsers: number;
  uniqueRobots: number;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface DashboardTabProps {
  stats: SystemStats | null;
  loading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DashboardTab({ stats, loading }: DashboardTabProps) {
  /* ---------- System Health local state ---------- */
  const [cycleRange, setCycleRange] = useState<[number, number]>([1, 10]);
  const [performanceMetrics, setPerformanceMetrics] = useState<CyclePerformanceMetrics[]>([]);
  const [integrityReports, setIntegrityReports] = useState<IntegrityReport[]>([]);
  const [eventStats, setEventStats] = useState<EventStatistics | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);

  /* ---------- System Health data fetching ---------- */
  const fetchSystemHealth = useCallback(async () => {
    try {
      setHealthLoading(true);
      setHealthError(null);

      const errors: string[] = [];

      try {
        const perfResponse = await apiClient.get(
          `/api/analytics/performance?startCycle=${cycleRange[0]}&endCycle=${cycleRange[1]}`
        );
        setPerformanceMetrics(perfResponse.data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Performance metrics: ${msg}`);
      }

      try {
        const integrityResponse = await apiClient.get(
          `/api/analytics/integrity?startCycle=${cycleRange[0]}&endCycle=${cycleRange[1]}`
        );
        setIntegrityReports(integrityResponse.data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Integrity reports: ${msg}`);
      }

      try {
        const statsResponse = await apiClient.get(
          `/api/analytics/logs/summary?startCycle=${cycleRange[0]}&endCycle=${cycleRange[1]}`
        );
        setEventStats(statsResponse.data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Event statistics: ${msg}`);
      }

      if (errors.length === 3) {
        setHealthError('All data sources failed to load: ' + errors.join('; '));
      } else if (errors.length > 0) {
        setHealthError('Some data sources failed: ' + errors.join('; '));
      }
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setHealthLoading(false);
    }
  }, [cycleRange]);

  // Fetch system health data when the details section is opened
  useEffect(() => {
    if (healthOpen) {
      fetchSystemHealth();
    }
  }, [healthOpen, fetchSystemHealth]);

  const handleCycleRangeChange = (start: number, end: number): void => {
    if (start > 0 && end >= start) {
      setCycleRange([start, end]);
    }
  };

  /* ---------- Derived integrity values ---------- */
  const validCycles = integrityReports.filter(r => r.isValid).length;
  const invalidCycles = integrityReports.filter(r => !r.isValid).length;
  const totalIssues = integrityReports.reduce((sum, r) => sum + r.issues.length, 0);
  const criticalIssues = integrityReports.reduce(
    (sum, r) => sum + r.issues.filter(i => i.severity === 'error').length,
    0
  );

  /* ---------- Render ---------- */
  if (loading && !stats) {
    return (
      <div data-testid="dashboard-tab" className="text-center py-8 text-secondary">
        Loading dashboard statistics...
      </div>
    );
  }

  return (
    <div data-testid="dashboard-tab" className="space-y-8">
      {/* Statistics Grid */}
      {stats && (
        <div className="bg-surface rounded-lg p-6">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
            {/* Robots Section */}
            <div>
              <h3 className="text-xl font-semibold mb-2 text-primary">Robots</h3>
              <p>Total: {stats.robots.total}</p>
              <p>Battle Ready: {stats.robots.battleReady} ({stats.robots.battleReadyPercentage.toFixed(1)}%)</p>
              <div className="mt-2">
                <p className="text-sm text-secondary">By Tier:</p>
                {stats.robots.byTier.map((tier) => (
                  <p key={tier.league} className="text-sm ml-2">
                    {tier.league}: {tier.count}
                  </p>
                ))}
              </div>
            </div>

            {/* Matches Section */}
            <div>
              <h3 className="text-xl font-semibold mb-2 text-success">Matches</h3>
              <p>Scheduled: {stats.matches.scheduled}</p>
              <p>Completed: {stats.matches.completed}</p>
              {stats.matches.byType && (
                <div className="mt-2">
                  <p className="text-sm text-secondary">By Type:</p>
                  <p className="text-sm ml-2">League: {stats.matches.byType.league.scheduled} / {stats.matches.byType.league.completed}</p>
                  <p className="text-sm ml-2">Tournament: {stats.matches.byType.tournament.scheduled} / {stats.matches.byType.tournament.completed}</p>
                  <p className="text-sm ml-2">Tag Team: {stats.matches.byType.tagTeam.scheduled} / {stats.matches.byType.tagTeam.completed}</p>
                  <p className="text-sm ml-2">KotH: {stats.matches.byType.koth.scheduled} / {stats.matches.byType.koth.completed}</p>
                </div>
              )}
            </div>

            {/* Battles Section */}
            <div>
              <h3 className="text-xl font-semibold mb-2 text-purple-400 flex items-center gap-2">
                Battles
                <span className="text-xs text-secondary font-normal" title="Battle statistics including outcomes and durations">ℹ️</span>
              </h3>
              <p>Last 24 Hours: {stats.battles.last24Hours}</p>
              <p>Total: {stats.battles.total}</p>
              <p className="mt-2 text-sm" title="Battles ending with no clear winner">
                Draws: {stats.battles.draws} ({stats.battles.drawPercentage}%)
              </p>
              <p className="text-sm" title="Battles where the loser was reduced to 0 HP">
                Kills: {stats.battles.kills} ({stats.battles.killPercentage}%)
              </p>
              <p className="text-sm text-secondary mt-1">Avg Duration: {stats.battles.avgDuration}s</p>
            </div>

            {/* Financial Section */}
            <div>
              <h3 className="text-xl font-semibold mb-2 text-warning flex items-center gap-2">
                Finances
                <span className="text-xs text-secondary font-normal" title="Total credits in system and user balance statistics">ℹ️</span>
              </h3>
              <p>Total Credits: ₡{stats.finances.totalCredits.toLocaleString()}</p>
              <p>Avg Balance: ₡{stats.finances.avgBalance.toLocaleString()}</p>
              <p>Total Users: {stats.finances.totalUsers}</p>
              <p
                className={`mt-2 text-sm ${stats.finances.usersAtRisk > 0 ? 'text-error' : 'text-success'}`}
                title="Users with balance below ₡10,000 (estimated 3 days of operating costs)"
              >
                {stats.finances.usersAtRisk > 0 ? '⚠️ ' : '✓ '}
                At Risk: {stats.finances.usersAtRisk}
              </p>
            </div>

            {/* Facilities Section */}
            <div>
              <h3 className="text-xl font-semibold mb-2 text-cyan-400 flex items-center gap-2">
                Facilities
                <span className="text-xs text-secondary font-normal" title="Facility purchases across all users">ℹ️</span>
              </h3>
              {stats.facilities.summary.length > 0 ? (
                <>
                  <p>Total Purchases: {stats.facilities.totalPurchases}</p>
                  <p>Most Popular: {stats.facilities.mostPopular === 'None' || stats.facilities.summary.length === 0
                    ? 'No facilities yet'
                    : stats.facilities.mostPopular.replace(/_/g, ' ')}</p>
                  <div className="mt-2">
                    <p className="text-sm text-secondary">Top 3:</p>
                    {stats.facilities.summary.slice(0, 3).map((facility, idx) => (
                      <p key={facility.type} className="text-sm ml-2">
                        {idx + 1}. {facility.type.replace(/_/g, ' ')}: {facility.purchaseCount}
                      </p>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-secondary">No facilities purchased yet</p>
              )}
            </div>

            {/* Weapons Section */}
            <div>
              <h3 className="text-xl font-semibold mb-2 text-orange-400 flex items-center gap-2">
                Weapons
                <span className="text-xs text-secondary font-normal" title="Weapon purchases and equipment">ℹ️</span>
              </h3>
              <p>Total Bought: {stats.weapons.totalBought}</p>
              <p>Equipped: {stats.weapons.equipped}</p>
              <p className="text-sm text-secondary mt-2">
                {stats.weapons.totalBought > 0
                  ? `${Math.round((stats.weapons.equipped / stats.weapons.totalBought) * 100)}% equipped`
                  : 'No weapons yet'}
              </p>
            </div>

            {/* Stances Section */}
            <div>
              <h3 className="text-xl font-semibold mb-2 text-pink-400 flex items-center gap-2">
                Stances
                <span className="text-xs text-secondary font-normal" title="Combat stances used by robots">ℹ️</span>
              </h3>
              {stats.stances.length > 0 ? (
                stats.stances.map((s) => (
                  <p key={s.stance} className="text-sm">
                    {s.stance.charAt(0).toUpperCase() + s.stance.slice(1)}: {s.count}
                  </p>
                ))
              ) : (
                <p className="text-sm text-secondary">No data</p>
              )}
            </div>

            {/* Loadouts Section */}
            <div>
              <h3 className="text-xl font-semibold mb-2 text-teal-400 flex items-center gap-2">
                Loadouts
                <span className="text-xs text-secondary font-normal" title="Equipment configurations">ℹ️</span>
              </h3>
              {stats.loadouts.length > 0 ? (
                stats.loadouts.map((l) => (
                  <p key={l.type} className="text-sm">
                    {l.type.replace(/_/g, ' ')}: {l.count}
                  </p>
                ))
              ) : (
                <p className="text-sm text-secondary">No data</p>
              )}
            </div>

            {/* Yield Thresholds Section */}
            <div>
              <h3 className="text-xl font-semibold mb-2 text-indigo-400 flex items-center gap-2">
                Yield Thresholds
                <span className="text-xs text-secondary font-normal" title="HP % where robots surrender">ℹ️</span>
              </h3>
              {stats.yieldThresholds.distribution.length > 0 ? (
                <>
                  <p className="text-sm">Most Common: {stats.yieldThresholds.mostCommon}%</p>
                  <p className="text-xs text-secondary">({stats.yieldThresholds.mostCommonCount} robots)</p>
                  <div className="mt-2">
                    <p className="text-sm text-secondary">Distribution:</p>
                    {stats.yieldThresholds.distribution.slice(0, 4).map((y) => (
                      <p key={y.threshold} className="text-sm ml-2">
                        {y.threshold}%: {y.count}
                      </p>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-secondary">No data</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* System Health — collapsible section (absorbed from SystemHealthPage) */}
      <details
        data-testid="system-health-section"
        open={healthOpen}
        onToggle={(e) => setHealthOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="bg-surface rounded-lg p-4 cursor-pointer font-semibold text-lg hover:bg-surface-elevated transition-colors list-none flex items-center gap-2">
          <span className="text-sm">{healthOpen ? '▼' : '▶'}</span>
          🏥 System Health
        </summary>

        <div className="bg-surface rounded-b-lg p-6 space-y-6 border-t border-white/10">
          {healthLoading && (
            <div className="text-center py-4 text-secondary">Loading system health data...</div>
          )}

          {healthError && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
              Error: {healthError}
            </div>
          )}

          {/* Cycle Range Selector */}
          <div className="bg-surface-elevated rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Cycle Range</h3>
            <div className="flex gap-4 items-center">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Start Cycle</label>
                <input
                  type="number"
                  min="1"
                  value={cycleRange[0]}
                  onChange={(e) => handleCycleRangeChange(parseInt(e.target.value), cycleRange[1])}
                  className="bg-surface border border-gray-600 text-white rounded px-3 py-2 w-32"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">End Cycle</label>
                <input
                  type="number"
                  min={cycleRange[0]}
                  value={cycleRange[1]}
                  onChange={(e) => handleCycleRangeChange(cycleRange[0], parseInt(e.target.value))}
                  className="bg-surface border border-gray-600 text-white rounded px-3 py-2 w-32"
                />
              </div>
              <button
                onClick={fetchSystemHealth}
                className="mt-6 bg-primary text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Data Integrity Overview */}
          {!healthLoading && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Data Integrity Status</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-green-900 p-4 rounded">
                  <div className="text-2xl font-bold text-success">{validCycles}</div>
                  <div className="text-sm text-secondary">Valid Cycles</div>
                </div>
                <div className="bg-red-900 p-4 rounded">
                  <div className="text-2xl font-bold text-error">{invalidCycles}</div>
                  <div className="text-sm text-secondary">Invalid Cycles</div>
                </div>
                <div className="bg-yellow-900 p-4 rounded">
                  <div className="text-2xl font-bold text-warning">{totalIssues}</div>
                  <div className="text-sm text-secondary">Total Issues</div>
                </div>
                <div className="bg-orange-900 p-4 rounded">
                  <div className="text-2xl font-bold text-orange-400">{criticalIssues}</div>
                  <div className="text-sm text-secondary">Critical Issues</div>
                </div>
              </div>

              {/* Integrity Issues List */}
              {invalidCycles > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-2">Integrity Issues</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {integrityReports
                      .filter(r => !r.isValid)
                      .map(report => (
                        <div key={report.cycleNumber} className="border border-white/10 rounded p-3 bg-gray-750">
                          <div className="font-medium">Cycle {report.cycleNumber}</div>
                          {report.issues.map((issue, idx) => (
                            <div
                              key={idx}
                              className={`text-sm mt-1 ${
                                issue.severity === 'error' ? 'text-error' : 'text-warning'
                              }`}
                            >
                              [{issue.severity.toUpperCase()}] {issue.type}: {issue.message}
                            </div>
                          ))}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cycle Performance Metrics */}
          {!healthLoading && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Cycle Performance</h3>
              {performanceMetrics.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-blue-900 p-4 rounded">
                    <div className="text-2xl font-bold text-primary">
                      {(
                        performanceMetrics.reduce((sum, m) => sum + m.totalDuration, 0) /
                        performanceMetrics.length /
                        1000
                      ).toFixed(2)}s
                    </div>
                    <div className="text-sm text-secondary">Average Cycle Duration</div>
                  </div>

                  {/* Performance Degradations */}
                  {performanceMetrics.some(m => m.degradations && m.degradations.length > 0) && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Performance Degradations</h4>
                      <div className="space-y-2">
                        {performanceMetrics
                          .filter(m => m.degradations && m.degradations.length > 0)
                          .map(metric => (
                            <div key={metric.cycleNumber} className="border border-white/10 rounded p-3 bg-gray-750">
                              <div className="font-medium">Cycle {metric.cycleNumber}</div>
                              {metric.degradations.map((deg, idx) => (
                                <div
                                  key={idx}
                                  className={`text-sm mt-1 ${
                                    deg.severity === 'critical' ? 'text-error' : 'text-warning'
                                  }`}
                                >
                                  [{deg.severity.toUpperCase()}] {deg.stepName}:{' '}
                                  {deg.degradationPercentage.toFixed(1)}% slower
                                </div>
                              ))}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Step Duration Breakdown */}
                  {performanceMetrics[0]?.stepDurations && performanceMetrics[0].stepDurations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Average Step Durations</h4>
                      <div className="space-y-1">
                        {performanceMetrics[0].stepDurations.map(step => {
                          const avgDuration =
                            performanceMetrics.reduce((sum, m) => {
                              const stepData = m.stepDurations.find(s => s.stepName === step.stepName);
                              return sum + (stepData?.duration || 0);
                            }, 0) / performanceMetrics.length;

                          return (
                            <div key={step.stepName} className="flex justify-between text-sm">
                              <span className="text-secondary">{step.stepName}</span>
                              <span className="font-mono text-gray-200">{(avgDuration / 1000).toFixed(2)}s</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-tertiary">No performance data available for this range</div>
              )}
            </div>
          )}

          {/* Event Statistics */}
          {!healthLoading && eventStats && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Event Log Statistics</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-purple-900 p-4 rounded">
                  <div className="text-2xl font-bold text-purple-400">
                    {eventStats.totalEvents.toLocaleString()}
                  </div>
                  <div className="text-sm text-secondary">Total Events</div>
                </div>
                <div className="bg-indigo-900 p-4 rounded">
                  <div className="text-2xl font-bold text-indigo-400">{eventStats.uniqueUsers}</div>
                  <div className="text-sm text-secondary">Active Users</div>
                </div>
                <div className="bg-cyan-900 p-4 rounded">
                  <div className="text-2xl font-bold text-cyan-400">{eventStats.uniqueRobots}</div>
                  <div className="text-sm text-secondary">Active Robots</div>
                </div>
              </div>

              {/* Events by Type */}
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Events by Type</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(eventStats.eventsByType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type} className="flex justify-between border-b border-white/10 py-1">
                        <span className="text-secondary">{type}</span>
                        <span className="font-mono text-gray-200">{count.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
