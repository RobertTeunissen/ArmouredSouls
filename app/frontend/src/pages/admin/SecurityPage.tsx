/**
 * SecurityPage — Summary cards, flagged user links, rate limit violations.
 *
 * Migrated from SecurityTab.tsx into a standalone page using shared admin
 * UI components.
 *
 * Requirements: 12.1, 12.2, 12.3, 25.1, 25.2, 25.3, 25.4
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNavigate } from 'react-router-dom';
import { AdminPageHeader, AdminStatCard, AdminDataTable, AdminFilterBar } from '../../components/admin/shared';
import { useAdminStore } from '../../stores/adminStore';
import apiClient from '../../utils/apiClient';
import type { SecurityEvent, SecurityEventsResponse } from '../../components/admin/types';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function SecurityPage() {
  const navigate = useNavigate();
  const { securitySummary, fetchSecuritySummary } = useAdminStore(useShallow((s) => ({
    securitySummary: s.securitySummary,
    fetchSecuritySummary: s.fetchSecuritySummary,
  })));

  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const fetchEvents = useCallback(async (severity?: string) => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (severity) params.set('severity', severity);
      const res = await apiClient.get<SecurityEventsResponse>(`/api/admin/security/events?${params.toString()}`);
      setEvents(res.data?.events ?? []);
    } catch {
      throw new Error('Failed to load security events');
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchSecuritySummary(true), fetchEvents(severityFilter)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security data');
    } finally {
      setLoading(false);
    }
  }, [fetchSecuritySummary, fetchEvents, severityFilter]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSeverityToggle = (key: string) => {
    const newSeverity = key === severityFilter ? '' : key;
    setSeverityFilter(newSeverity);
    setExpandedIndex(null);
    fetchEvents(newSeverity).catch(() => setError('Failed to load events'));
  };

  // Rate limit violations
  const rateLimitEvents = useMemo(
    () => events.filter((e) => e.eventType === 'rate_limit_violation' || e.eventType === 'admin_rate_limit_exceeded'),
    [events],
  );

  const summary = securitySummary;

  return (
    <div data-testid="security-page" className="space-y-6">
      <AdminPageHeader
        title="Security"
        subtitle="Security monitoring, flagged users, and rate limit violations"
        actions={
          <button type="button" onClick={refresh} disabled={loading} className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors">
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        }
      />

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={refresh} className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm">Retry</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <AdminStatCard label="Total Events" value={summary?.totalEvents ?? 0} color="primary" icon={<span>🛡️</span>} />
        <AdminStatCard label="Info" value={summary?.bySeverity?.info ?? 0} color="info" />
        <AdminStatCard label="Warning" value={summary?.bySeverity?.warning ?? 0} color="warning" />
        <AdminStatCard label="Critical" value={summary?.bySeverity?.critical ?? 0} color="error" />
        <AdminStatCard label="Active Alerts" value={summary?.activeAlerts ?? 0} color={(summary?.activeAlerts ?? 0) > 0 ? 'error' : 'success'} icon={<span>🚨</span>} />
      </div>

      {/* Flagged Users */}
      {summary?.flaggedUserIds && summary.flaggedUserIds.length > 0 && (
        <div className="bg-surface rounded-lg p-4">
          <h3 className="text-sm font-semibold text-secondary mb-2">Flagged Users</h3>
          <div className="flex flex-wrap gap-2">
            {summary.flaggedUserIds.map((id) => (
              <button
                key={id}
                onClick={() => navigate(`/admin/players?userId=${id}`)}
                className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30 transition-colors"
              >
                User {id}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Severity Filter */}
      <AdminFilterBar
        filters={[
          { key: 'info', label: 'Info', active: severityFilter === 'info' },
          { key: 'warning', label: 'Warning', active: severityFilter === 'warning' },
          { key: 'critical', label: 'Critical', active: severityFilter === 'critical' },
        ]}
        onFilterToggle={handleSeverityToggle}
        onClearAll={() => { setSeverityFilter(''); fetchEvents('').catch(() => {}); }}
      />

      {/* Rate Limit Violations */}
      {rateLimitEvents.length > 0 && (
        <div className="bg-surface rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3 text-warning">Rate Limit Violations ({rateLimitEvents.length})</h3>
          <AdminDataTable<SecurityEvent & Record<string, unknown>>
            columns={[
              { key: 'timestamp', label: 'Time', render: (row) => new Date(row.timestamp).toLocaleString() },
              { key: 'userId', label: 'User ID', render: (row) => row.userId != null ? String(row.userId) : '—' },
              { key: 'endpoint', label: 'Endpoint', render: (row) => <span className="font-mono text-xs">{row.endpoint ?? '—'}</span> },
              { key: 'sourceIp', label: 'IP', render: (row) => <span className="font-mono text-xs">{row.sourceIp ?? '—'}</span> },
            ]}
            data={rateLimitEvents as (SecurityEvent & Record<string, unknown>)[]}
            emptyMessage="No rate limit violations"
          />
        </div>
      )}

      {/* Events Table */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Security Events</h3>
        {events.length === 0 && !loading ? (
          <div className="text-center py-8 text-secondary">
            <span className="text-3xl block mb-2">ℹ️</span>
            No security events recorded
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-secondary">
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Severity</th>
                  <th className="py-2 px-3">Event Type</th>
                  <th className="py-2 px-3">User ID</th>
                  <th className="py-2 px-3">Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, idx) => (
                  <tr
                    key={`${event.timestamp}-${idx}`}
                    onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                    className="border-b border-white/5 hover:bg-surface-elevated cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-secondary">{new Date(event.timestamp).toLocaleString()}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${event.severity === 'critical' ? 'bg-red-500/20 text-red-400' : event.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {event.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">{event.eventType}</td>
                    <td className="py-2 px-3">{event.userId != null ? String(event.userId) : '—'}</td>
                    <td className="py-2 px-3 font-mono text-xs truncate max-w-[200px]">{event.endpoint ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default SecurityPage;
