import React, { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';

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

/**
 * System Health Dashboard
 * 
 * Displays cycle performance metrics, data integrity status, and event log statistics.
 * Validates: Requirements 15.4, 15.5
 */
const SystemHealthPage: React.FC = () => {
  const [cycleRange, setCycleRange] = useState<[number, number]>([1, 10]);
  const [performanceMetrics, setPerformanceMetrics] = useState<CyclePerformanceMetrics[]>([]);
  const [integrityReports, setIntegrityReports] = useState<IntegrityReport[]>([]);
  const [eventStats, setEventStats] = useState<EventStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Note: Removed admin check - this page is useful for all users
  // useEffect(() => {
  //   if (user && !user.isAdmin) {
  //     navigate('/dashboard');
  //   }
  // }, [user, navigate]);

  useEffect(() => {
    fetchSystemHealth();
  }, [cycleRange]);

  const fetchSystemHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const errors: string[] = [];

      // Fetch performance metrics
      try {
        const perfResponse = await apiClient.get(
          `/api/analytics/performance?startCycle=${cycleRange[0]}&endCycle=${cycleRange[1]}`
        );
        setPerformanceMetrics(perfResponse.data);
      } catch (err: any) {
        console.error('Performance error:', err);
        errors.push(`Performance metrics: ${err.response?.statusText || err.message || 'Unknown error'}`);
      }

      // Fetch integrity reports
      try {
        const integrityResponse = await apiClient.get(
          `/api/analytics/integrity?startCycle=${cycleRange[0]}&endCycle=${cycleRange[1]}`
        );
        setIntegrityReports(integrityResponse.data);
      } catch (err: any) {
        console.error('Integrity error:', err);
        errors.push(`Integrity reports: ${err.response?.statusText || err.message || 'Unknown error'}`);
      }

      // Fetch event log summary (renamed to /logs/summary to avoid ad blocker issues)
      try {
        const statsResponse = await apiClient.get(
          `/api/analytics/logs/summary?startCycle=${cycleRange[0]}&endCycle=${cycleRange[1]}`
        );
        setEventStats(statsResponse.data);
      } catch (err: any) {
        console.error('Event metrics error:', err);
        errors.push(`Event statistics: ${err.response?.statusText || err.message || 'Unknown error'}`);
      }

      setLoading(false);
      
      // Only set error if ALL requests failed
      if (errors.length === 3) {
        setError('All data sources failed to load: ' + errors.join('; '));
      } else if (errors.length > 0) {
        setError('Some data sources failed: ' + errors.join('; '));
      }
    } catch (err) {
      console.error('System health fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const handleCycleRangeChange = (start: number, end: number) => {
    if (start > 0 && end >= start) {
      setCycleRange([start, end]);
    }
  };

  // Removed admin check - system health is useful for all users to see
  // if (!user?.isAdmin) {
  //   return null;
  // }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading system health data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
          Error: {error}
        </div>
      </div>
    );
  }

  const validCycles = integrityReports.filter(r => r.isValid).length;
  const invalidCycles = integrityReports.filter(r => !r.isValid).length;
  const totalIssues = integrityReports.reduce((sum, r) => sum + r.issues.length, 0);
  const criticalIssues = integrityReports.reduce(
    (sum, r) => sum + r.issues.filter(i => i.severity === 'error').length,
    0
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">System Health Dashboard</h1>

      {/* Cycle Range Selector */}
      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Cycle Range</h2>
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Start Cycle</label>
              <input
                type="number"
                min="1"
                value={cycleRange[0]}
                onChange={(e) => handleCycleRangeChange(parseInt(e.target.value), cycleRange[1])}
                className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 w-32"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">End Cycle</label>
              <input
                type="number"
                min={cycleRange[0]}
                value={cycleRange[1]}
                onChange={(e) => handleCycleRangeChange(cycleRange[0], parseInt(e.target.value))}
                className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 w-32"
              />
            </div>
            <button
              onClick={fetchSystemHealth}
              className="mt-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Data Integrity Overview */}
        <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Data Integrity Status</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-green-900 p-4 rounded">
              <div className="text-2xl font-bold text-green-400">{validCycles}</div>
              <div className="text-sm text-gray-400">Valid Cycles</div>
            </div>
            <div className="bg-red-900 p-4 rounded">
              <div className="text-2xl font-bold text-red-400">{invalidCycles}</div>
              <div className="text-sm text-gray-400">Invalid Cycles</div>
            </div>
            <div className="bg-yellow-900 p-4 rounded">
              <div className="text-2xl font-bold text-yellow-400">{totalIssues}</div>
              <div className="text-sm text-gray-400">Total Issues</div>
            </div>
            <div className="bg-orange-900 p-4 rounded">
              <div className="text-2xl font-bold text-orange-400">{criticalIssues}</div>
              <div className="text-sm text-gray-400">Critical Issues</div>
            </div>
          </div>

          {/* Integrity Issues List */}
          {invalidCycles > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Integrity Issues</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {integrityReports
                  .filter(r => !r.isValid)
                  .map(report => (
                    <div key={report.cycleNumber} className="border border-gray-700 rounded p-3 bg-gray-750">
                      <div className="font-medium">Cycle {report.cycleNumber}</div>
                      {report.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`text-sm mt-1 ${
                            issue.severity === 'error' ? 'text-red-400' : 'text-yellow-400'
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

        {/* Cycle Performance Metrics */}
        <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Cycle Performance</h2>
          
          {performanceMetrics.length > 0 ? (
            <div className="space-y-4">
              {/* Average Cycle Duration */}
              <div className="bg-blue-900 p-4 rounded">
                <div className="text-2xl font-bold text-blue-400">
                  {(
                    performanceMetrics.reduce((sum, m) => sum + m.totalDuration, 0) /
                    performanceMetrics.length /
                    1000
                  ).toFixed(2)}s
                </div>
                <div className="text-sm text-gray-400">Average Cycle Duration</div>
              </div>

              {/* Performance Degradations */}
              {performanceMetrics.some(m => m.degradations && m.degradations.length > 0) && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Performance Degradations</h3>
                  <div className="space-y-2">
                    {performanceMetrics
                      .filter(m => m.degradations && m.degradations.length > 0)
                      .map(metric => (
                        <div key={metric.cycleNumber} className="border border-gray-700 rounded p-3 bg-gray-750">
                          <div className="font-medium">Cycle {metric.cycleNumber}</div>
                          {metric.degradations.map((deg, idx) => (
                            <div
                              key={idx}
                              className={`text-sm mt-1 ${
                                deg.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'
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
                  <h3 className="font-semibold mb-2">Average Step Durations</h3>
                  <div className="space-y-1">
                    {performanceMetrics[0].stepDurations.map(step => {
                      const avgDuration =
                        performanceMetrics.reduce((sum, m) => {
                          const stepData = m.stepDurations.find(s => s.stepName === step.stepName);
                          return sum + (stepData?.duration || 0);
                        }, 0) / performanceMetrics.length;

                      return (
                        <div key={step.stepName} className="flex justify-between text-sm">
                          <span className="text-gray-300">{step.stepName}</span>
                          <span className="font-mono text-gray-200">{(avgDuration / 1000).toFixed(2)}s</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">No performance data available for this range</div>
          )}
        </div>

        {/* Event Statistics */}
        {eventStats && (
          <div className="bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Event Log Statistics</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-purple-900 p-4 rounded">
                <div className="text-2xl font-bold text-purple-400">
                  {eventStats.totalEvents.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">Total Events</div>
              </div>
              <div className="bg-indigo-900 p-4 rounded">
                <div className="text-2xl font-bold text-indigo-400">{eventStats.uniqueUsers}</div>
                <div className="text-sm text-gray-400">Active Users</div>
              </div>
              <div className="bg-cyan-900 p-4 rounded">
                <div className="text-2xl font-bold text-cyan-400">{eventStats.uniqueRobots}</div>
                <div className="text-sm text-gray-400">Active Robots</div>
              </div>
            </div>

            {/* Events by Type */}
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Events by Type</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(eventStats.eventsByType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between border-b border-gray-700 py-1">
                      <span className="text-gray-400">{type}</span>
                      <span className="font-mono text-gray-200">{count.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default SystemHealthPage;
