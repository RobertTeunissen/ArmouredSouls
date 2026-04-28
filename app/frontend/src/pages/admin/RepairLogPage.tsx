/**
 * RepairLogPage — Retains existing RepairLogTab functionality with shared
 * admin UI components.
 *
 * Requirements: 22.1, 25.1, 25.2, 25.3, 25.4
 */
import { useState, useEffect, useCallback } from 'react';
import { AdminPageHeader, AdminStatCard, AdminDataTable, AdminFilterBar } from '../../components/admin/shared';
import apiClient from '../../utils/apiClient';
import type { RepairLogEvent, RepairLogResponse } from '../../components/admin/types';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_LIMIT = 25;

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

function defaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function RepairLogPage() {
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
      if (endDate) {
        // Send end-of-day so the selected date is fully included
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        params.set('endDate', nextDay.toISOString().split('T')[0]);
      }
      params.set('page', String(page));
      params.set('limit', String(DEFAULT_LIMIT));

      const response = await apiClient.get<RepairLogResponse>(`/api/admin/audit-log/repairs?${params.toString()}`);
      setData(response.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch repair log';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [repairType, startDate, endDate, page]);

  useEffect(() => {
    fetchRepairLog();
  }, [fetchRepairLog]);

  const handleRepairTypeToggle = (key: string) => {
    setRepairType(key as 'all' | 'manual' | 'automatic');
    setPage(1);
  };

  const totalPages = data?.pagination.totalPages ?? 1;

  if (loading && !data) {
    return (
      <div data-testid="repair-log-page" className="space-y-6">
        <AdminPageHeader title="Repair Log" subtitle="Manual vs automatic repair activity" />
        <div className="text-center py-12 text-secondary">Loading repair log…</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div data-testid="repair-log-page" className="space-y-6">
        <AdminPageHeader title="Repair Log" subtitle="Manual vs automatic repair activity" />
        <div className="bg-surface rounded-lg p-6 text-center">
          <p className="text-error mb-4">{error}</p>
          <button onClick={fetchRepairLog} className="bg-primary hover:bg-primary/80 px-6 py-2 rounded font-semibold transition-colors">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="repair-log-page" className="space-y-6">
      <AdminPageHeader
        title="Repair Log"
        subtitle="Manual vs automatic repair activity"
        actions={
          <button type="button" onClick={fetchRepairLog} disabled={loading} className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors">
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        }
      />

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AdminStatCard label="Total Manual Repairs" value={data.summary.totalManualRepairs.toLocaleString()} color="success" icon={<span>🔧</span>} />
          <AdminStatCard label="Total Automatic Repairs" value={data.summary.totalAutomaticRepairs.toLocaleString()} color="info" icon={<span>⚙️</span>} />
          <AdminStatCard label="Total Savings" value={`₡${data.summary.totalSavings.toLocaleString()}`} color="success" icon={<span>💰</span>} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <AdminFilterBar
          filters={[
            { key: 'all', label: 'All', active: repairType === 'all' },
            { key: 'manual', label: 'Manual', active: repairType === 'manual' },
            { key: 'automatic', label: 'Automatic', active: repairType === 'automatic' },
          ]}
          onFilterToggle={handleRepairTypeToggle}
        >
          <div className="flex gap-3 items-end">
            <div>
              <label className="block text-sm text-secondary mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="bg-surface-elevated text-white px-3 py-2 rounded" />
            </div>
            <div>
              <label className="block text-sm text-secondary mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="bg-surface-elevated text-white px-3 py-2 rounded" />
            </div>
          </div>
        </AdminFilterBar>
      </div>

      {/* Data Table */}
      {data && (
        <AdminDataTable<RepairLogEvent & Record<string, unknown>>
          columns={[
            { key: 'stableName', label: 'Player' },
            { key: 'robotName', label: 'Robot' },
            { key: 'repairType', label: 'Type', render: (row) => (
              <span className={`px-2 py-1 rounded text-xs font-semibold ${row.repairType === 'manual' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
                {row.repairType}
              </span>
            )},
            { key: 'cost', label: 'Cost', align: 'right', render: (row) => `₡${row.cost.toLocaleString()}` },
            { key: 'preDiscountCost', label: 'Pre-Discount', align: 'right', render: (row) => row.repairType === 'manual' && row.preDiscountCost != null ? `₡${row.preDiscountCost.toLocaleString()}` : '—' },
            { key: 'savings', label: 'Savings', align: 'right', render: (row) => {
              if (row.repairType === 'manual' && row.preDiscountCost != null) {
                const savings = row.preDiscountCost - row.cost;
                return <span className="text-success">₡{savings.toLocaleString()}</span>;
              }
              return '—';
            }},
            { key: 'eventTimestamp', label: 'Timestamp', render: (row) => new Date(row.eventTimestamp).toLocaleString() },
          ]}
          data={(data.events ?? []) as (RepairLogEvent & Record<string, unknown>)[]}
          emptyMessage="No repair events found for the selected filters"
          pagination={totalPages > 1 ? { page, totalPages, onPageChange: setPage } : undefined}
        />
      )}
    </div>
  );
}

export default RepairLogPage;
