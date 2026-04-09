/**
 * RepairLogTab - Admin tab for viewing manual vs automatic repair activity.
 *
 * Fetches from GET /api/admin/audit-log/repairs with filters for repair type
 * and date range. Shows summary stats, filterable data table, and pagination.
 *
 * Requirements: 7.4, 7.5, 7.6
 */
import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../utils/apiClient';
import type { RepairLogEvent, RepairLogResponse } from './types';

const DEFAULT_LIMIT = 25;

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

function defaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function RepairLogTab() {
  const [data, setData] = useState<RepairLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [repairType, setRepairType] = useState<'all' | 'manual' | 'automatic'>('all');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [page, setPage] = useState(1);

  const fetchRepairLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (repairType !== 'all') params.set('repairType', repairType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('page', String(page));
      params.set('limit', String(DEFAULT_LIMIT));

      const response = await apiClient.get<RepairLogResponse>(
        `/api/admin/audit-log/repairs?${params.toString()}`,
      );
      setData(response.data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch repair log';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [repairType, startDate, endDate, page]);

  useEffect(() => {
    fetchRepairLog();
  }, [fetchRepairLog]);

  // Reset to page 1 when filters change
  const handleRepairTypeChange = (value: 'all' | 'manual' | 'automatic') => {
    setRepairType(value);
    setPage(1);
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setPage(1);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setPage(1);
  };

  /* ---------- Loading state ---------- */
  if (loading && !data) {
    return (
      <div data-testid="repair-log-tab" className="space-y-6">
        <h2 className="text-2xl font-bold">🔧 Repair Log</h2>
        <div className="text-center py-12 text-secondary">
          <div className="animate-pulse">Loading repair log…</div>
        </div>
      </div>
    );
  }

  /* ---------- Error state ---------- */
  if (error && !data) {
    return (
      <div data-testid="repair-log-tab" className="space-y-6">
        <h2 className="text-2xl font-bold">🔧 Repair Log</h2>
        <div className="bg-surface rounded-lg p-6 text-center">
          <p className="text-error mb-4">{error}</p>
          <button
            onClick={fetchRepairLog}
            className="bg-primary hover:bg-primary/80 px-6 py-2 rounded font-semibold transition-colors min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div data-testid="repair-log-tab" className="space-y-6">
      {/* Header with refresh */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">🔧 Repair Log</h2>
        <button
          onClick={fetchRepairLog}
          disabled={loading}
          className="bg-primary hover:bg-primary/80 disabled:bg-surface-elevated px-6 py-2 rounded font-semibold transition-colors min-h-[44px]"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Summary stats */}
      {data && (
        <div className="bg-surface rounded-lg p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-surface-elevated rounded p-3">
              <p className="text-secondary">Total Manual Repairs</p>
              <p className="text-2xl font-bold text-success">
                {data.summary.totalManualRepairs.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-elevated rounded p-3">
              <p className="text-secondary">Total Automatic Repairs</p>
              <p className="text-2xl font-bold">
                {data.summary.totalAutomaticRepairs.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-elevated rounded p-3">
              <p className="text-secondary">Total Savings</p>
              <p className="text-2xl font-bold text-success">
                ₡{data.summary.totalSavings.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-surface rounded-lg p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-secondary mb-1">Repair Type</label>
            <select
              value={repairType}
              onChange={(e) => handleRepairTypeChange(e.target.value as 'all' | 'manual' | 'automatic')}
              className="bg-surface-elevated text-white px-3 py-2 rounded min-h-[44px]"
            >
              <option value="all">All</option>
              <option value="manual">Manual</option>
              <option value="automatic">Automatic</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-secondary mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="bg-surface-elevated text-white px-3 py-2 rounded min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm text-secondary mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="bg-surface-elevated text-white px-3 py-2 rounded min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {/* Data table */}
      {data && data.events.length === 0 && (
        <div className="bg-surface rounded-lg p-6 text-center text-secondary">
          <p>No repair events found for the selected filters.</p>
          <p className="text-sm mt-2">Try adjusting the date range or repair type filter.</p>
        </div>
      )}

      {data && data.events.length > 0 && (
        <div className="bg-surface rounded-lg p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="p-2 lg:p-3 text-left">Player</th>
                  <th className="p-2 lg:p-3 text-left">Robot</th>
                  <th className="p-2 lg:p-3 text-left">Repair Type</th>
                  <th className="p-2 lg:p-3 text-left">Cost</th>
                  <th className="p-2 lg:p-3 text-left">Pre-Discount Cost</th>
                  <th className="p-2 lg:p-3 text-left">Savings</th>
                  <th className="p-2 lg:p-3 text-left">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event, idx) => (
                  <RepairEventRow key={`${event.userId}-${event.robotId}-${event.eventTimestamp}-${idx}`} event={event} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4 text-sm">
            <p className="text-secondary">
              Page {data.pagination.page} of {totalPages} · {data.pagination.totalEvents.toLocaleString()} total events
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="bg-surface-elevated hover:bg-primary/80 disabled:opacity-50 px-4 py-2 rounded transition-colors min-h-[44px]"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.pagination.hasMore || loading}
                className="bg-surface-elevated hover:bg-primary/80 disabled:opacity-50 px-4 py-2 rounded transition-colors min-h-[44px]"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RepairEventRow — single repair event table row                     */
/* ------------------------------------------------------------------ */

function RepairEventRow({ event }: { event: RepairLogEvent }) {
  const isManual = event.repairType === 'manual';
  const savings =
    isManual && event.preDiscountCost != null
      ? event.preDiscountCost - event.cost
      : null;

  return (
    <tr className="border-t border-white/10 hover:bg-surface-elevated">
      <td className="p-2 lg:p-3">{event.stableName}</td>
      <td className="p-2 lg:p-3">{event.robotName}</td>
      <td className="p-2 lg:p-3">
        <span
          className={`px-2 py-1 rounded text-xs font-semibold ${
            isManual
              ? 'bg-green-900 text-green-300'
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {event.repairType}
        </span>
      </td>
      <td className="p-2 lg:p-3">₡{event.cost.toLocaleString()}</td>
      <td className="p-2 lg:p-3">
        {isManual && event.preDiscountCost != null
          ? `₡${event.preDiscountCost.toLocaleString()}`
          : '—'}
      </td>
      <td className="p-2 lg:p-3">
        {savings != null ? (
          <span className="text-success">₡{savings.toLocaleString()}</span>
        ) : (
          '—'
        )}
      </td>
      <td className="p-2 lg:p-3 text-secondary">
        {new Date(event.eventTimestamp).toLocaleString()}
      </td>
    </tr>
  );
}
