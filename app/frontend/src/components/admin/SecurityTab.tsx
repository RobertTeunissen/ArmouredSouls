/**
 * SecurityTab — Admin portal tab for viewing security monitoring data.
 *
 * Consumes GET /api/admin/security/summary and GET /api/admin/security/events
 * from the backend SecurityMonitor (spec 11). Displays a summary panel with
 * severity counts and flagged users, a filter bar, and an expandable events table.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../../utils/apiClient';
import type { SecurityEvent, SecuritySummary, SecurityEventsResponse } from './types';

interface Filters {
  severity: string;
  eventType: string;
  userId: string;
}

const SEVERITY_OPTIONS = [
  { value: '', label: 'All Severities' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-blue-500/20 text-blue-400',
  warning: 'bg-amber-500/20 text-amber-400',
  critical: 'bg-red-500/20 text-red-400',
};

const SEVERITY_BORDER: Record<string, string> = {
  info: 'border-blue-500',
  warning: 'border-amber-500',
  critical: 'border-red-500',
};

/** Format an ISO timestamp as a relative time string. */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SecurityTab() {
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [filters, setFilters] = useState<Filters>({ severity: '', eventType: '', userId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiClient.get<SecuritySummary>('/api/admin/security/summary');
      setSummary(res.data);
    } catch {
      throw new Error('Failed to load security summary');
    }
  }, []);

  const fetchEvents = useCallback(async (f: Filters = filters) => {
    try {
      const params = new URLSearchParams();
      if (f.severity) params.set('severity', f.severity);
      if (f.eventType) params.set('eventType', f.eventType);
      if (f.userId) params.set('userId', f.userId);
      params.set('limit', '50');
      const res = await apiClient.get<SecurityEventsResponse>(`/api/admin/security/events?${params.toString()}`);
      setEvents(res.data?.events ?? []);
    } catch {
      throw new Error('Failed to load security events');
    }
  }, [filters]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchSummary(), fetchEvents(filters)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security data');
    } finally {
      setLoading(false);
    }
  }, [fetchSummary, fetchEvents, filters]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = useCallback(async (newFilters: Filters) => {
    setFilters(newFilters);
    setExpandedIndex(null);
    setError(null);
    try {
      await fetchEvents(newFilters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security events');
    }
  }, [fetchEvents]);

  const clearFilters = useCallback(() => {
    const empty: Filters = { severity: '', eventType: '', userId: '' };
    handleFilterChange(empty);
  }, [handleFilterChange]);

  const eventTypeOptions = useMemo(() => {
    const types = [...new Set(events.map(e => e.eventType))].sort();
    return [{ value: '', label: 'All Types' }, ...types.map(t => ({ value: t, label: t.replace(/_/g, ' ') }))];
  }, [events]);

  /* ---------- Render ---------- */

  if (loading && !summary) {
    return (
      <div data-testid="security-tab">
        <h2 className="text-2xl font-bold mb-6">Security</h2>
        <p className="text-secondary">Loading security data...</p>
      </div>
    );
  }

  return (
    <div data-testid="security-tab">
      <h2 className="text-2xl font-bold mb-6">Security</h2>

      {/* Error state */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <span className="text-red-400">{error}</span>
          <button onClick={refresh} className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Summary Panel */}
      <div className="mb-6 p-4 bg-surface rounded-lg border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">🛡️ Security Overview</h3>
          <button
            onClick={refresh}
            className="px-3 py-1 text-sm bg-surface-elevated text-secondary rounded hover:text-white transition-colors"
            aria-label="Refresh security data"
          >
            ↻ Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="p-3 bg-surface-elevated rounded-lg text-center">
            <div className="text-2xl font-bold">{summary?.totalEvents ?? 0}</div>
            <div className="text-xs text-secondary">Total Events</div>
          </div>
          <div className={`p-3 bg-surface-elevated rounded-lg text-center border-l-2 ${SEVERITY_BORDER.info}`}>
            <div className="text-2xl font-bold text-blue-400">{summary?.bySeverity?.info ?? 0}</div>
            <div className="text-xs text-secondary">Info</div>
          </div>
          <div className={`p-3 bg-surface-elevated rounded-lg text-center border-l-2 ${SEVERITY_BORDER.warning}`}>
            <div className="text-2xl font-bold text-amber-400">{summary?.bySeverity?.warning ?? 0}</div>
            <div className="text-xs text-secondary">Warning</div>
          </div>
          <div className={`p-3 bg-surface-elevated rounded-lg text-center border-l-2 ${SEVERITY_BORDER.critical}`}>
            <div className="text-2xl font-bold text-red-400">{summary?.bySeverity?.critical ?? 0}</div>
            <div className="text-xs text-secondary">Critical</div>
          </div>
          <div className="p-3 bg-surface-elevated rounded-lg text-center">
            <div className={`text-2xl font-bold ${(summary?.activeAlerts ?? 0) > 0 ? 'text-red-400' : 'text-secondary'}`}>
              {summary?.activeAlerts ?? 0}
            </div>
            <div className="text-xs text-secondary">Active Alerts</div>
          </div>
        </div>

        {/* Flagged Users */}
        <div className="text-sm">
          <span className="text-secondary mr-2">Flagged Users:</span>
          {summary?.flaggedUserIds && summary.flaggedUserIds.length > 0 ? (
            summary.flaggedUserIds.map(id => (
              <button
                key={id}
                onClick={() => handleFilterChange({ ...filters, userId: String(id) })}
                className="inline-block mr-2 mb-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors"
                aria-label={`Filter events for user ${id}`}
              >
                User {id}
              </button>
            ))
          ) : (
            <span className="text-secondary/60">No flagged users</span>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="severity-filter" className="block text-xs text-secondary mb-1">Severity</label>
          <select
            id="severity-filter"
            value={filters.severity}
            onChange={e => handleFilterChange({ ...filters, eventType: '', severity: e.target.value })}
            className="bg-surface-elevated text-white text-sm rounded px-3 py-1.5 border border-white/10"
          >
            {SEVERITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="event-type-filter" className="block text-xs text-secondary mb-1">Event Type</label>
          <select
            id="event-type-filter"
            value={filters.eventType}
            onChange={e => handleFilterChange({ ...filters, eventType: e.target.value })}
            className="bg-surface-elevated text-white text-sm rounded px-3 py-1.5 border border-white/10"
          >
            {eventTypeOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="user-id-filter" className="block text-xs text-secondary mb-1">User ID</label>
          <input
            id="user-id-filter"
            type="text"
            inputMode="numeric"
            placeholder="Filter by user ID"
            value={filters.userId}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '');
              setFilters(prev => ({ ...prev, userId: val }));
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleFilterChange(filters);
            }}
            onBlur={() => handleFilterChange(filters)}
            className="bg-surface-elevated text-white text-sm rounded px-3 py-1.5 border border-white/10 w-36"
          />
        </div>
        <button
          onClick={clearFilters}
          className="px-3 py-1.5 text-sm text-secondary hover:text-white bg-surface-elevated rounded border border-white/10 transition-colors"
        >
          Clear Filters
        </button>
      </div>

      {/* Events Table */}
      {events.length === 0 && !loading ? (
        <div data-testid="no-events-message" className="text-center py-12 text-secondary">
          <span className="text-3xl block mb-2">ℹ️</span>
          No security events recorded
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-white/10 text-left text-secondary">
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Severity</th>
                <th className="py-2 px-3">Event Type</th>
                <th className="py-2 px-3">User ID</th>
                <th className="py-2 px-3">Source IP</th>
                <th className="py-2 px-3">Endpoint</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, idx) => (
                <EventRow
                  key={`${event.timestamp}-${idx}`}
                  event={event}
                  expanded={expandedIndex === idx}
                  onToggle={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Event Row Sub-component ---------- */

function EventRow({ event, expanded, onToggle }: { event: SecurityEvent; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-white/5 hover:bg-surface-elevated cursor-pointer transition-colors"
        role="row"
      >
        <td className="py-2 px-3 whitespace-nowrap" title={event.timestamp}>
          {formatRelativeTime(event.timestamp)}
        </td>
        <td className="py-2 px-3">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${SEVERITY_STYLES[event.severity] ?? ''}`}>
            {event.severity.toUpperCase()}
          </span>
        </td>
        <td className="py-2 px-3 font-mono text-xs">{event.eventType}</td>
        <td className="py-2 px-3">{event.userId != null ? (
          <span>{event.userId}{event.stableName ? <span className="text-secondary ml-1">({event.stableName})</span> : ''}</span>
        ) : '—'}</td>
        <td className="py-2 px-3 font-mono text-xs">{event.sourceIp ?? '—'}</td>
        <td className="py-2 px-3 font-mono text-xs truncate max-w-[200px]">{event.endpoint ?? '—'}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-surface p-4">
            <div className="text-xs space-y-1" data-testid="event-details">
              {Object.entries(event.details).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-secondary font-semibold min-w-[120px]">{key}:</span>
                  <span className="text-blue-400 break-all">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
