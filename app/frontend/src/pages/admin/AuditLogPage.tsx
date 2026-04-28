/**
 * AuditLogPage — Paginated audit trail entries with filters.
 *
 * Fetches from GET /api/admin/audit-log with pagination, operation type,
 * and date range filters.
 *
 * Requirements: 19.3, 19.4, 19.5
 */
import { useState, useEffect, useCallback } from 'react';
import {
  AdminPageHeader,
  AdminDataTable,
  AdminFilterBar,
} from '../../components/admin/shared';
import apiClient from '../../utils/apiClient';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AuditEntry {
  id: number;
  adminUserId: number;
  adminUsername?: string;
  operationType: string;
  operationResult: 'success' | 'failure';
  resultSummary: Record<string, unknown>;
  createdAt: string;
  [key: string]: unknown;
}

interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const OPERATION_TYPES = [
  'matchmaking_run',
  'battles_run',
  'rebalancing_run',
  'repair_run',
  'finances_run',
  'bulk_cycles',
  'koth_run',
  'tournament_run',
  'settlement_run',
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function AuditLogPage() {
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [operationType, setOperationType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (operationType) params.set('operationType', operationType);
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) params.set('endDate', new Date(endDate).toISOString());

      const res = await apiClient.get<AuditLogResponse>(`/api/admin/audit-log?${params.toString()}`);
      setData(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load audit log';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, operationType, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOperationToggle = (key: string) => {
    setOperationType((prev) => (prev === key ? '' : key));
    setPage(1);
  };

  const operationFilters = OPERATION_TYPES.map((op) => ({
    key: op,
    label: op.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    active: operationType === op,
  }));

  return (
    <div data-testid="audit-log-page" className="space-y-6">
      <AdminPageHeader
        title="Audit Log"
        subtitle="Admin action audit trail"
        actions={
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors"
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        }
      />

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchData} className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm">
            Retry
          </button>
        </div>
      )}

      {/* Operation Type Filter */}
      <AdminFilterBar
        filters={operationFilters}
        onFilterToggle={handleOperationToggle}
        onClearAll={() => { setOperationType(''); setPage(1); }}
      >
        {/* Date Range Filters */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-secondary">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="bg-surface-elevated text-white text-sm rounded px-2 py-1 border border-white/10"
            data-testid="start-date-input"
          />
          <label className="text-xs text-secondary">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="bg-surface-elevated text-white text-sm rounded px-2 py-1 border border-white/10"
            data-testid="end-date-input"
          />
        </div>
      </AdminFilterBar>

      {/* Total count */}
      {data && (
        <div className="text-sm text-secondary">
          {data.total} audit log {data.total === 1 ? 'entry' : 'entries'} found
        </div>
      )}

      {/* Audit Entries Table */}
      <AdminDataTable<AuditEntry>
        columns={[
          {
            key: 'createdAt',
            label: 'Timestamp',
            render: (row) => new Date(row.createdAt).toLocaleString(),
          },
          {
            key: 'adminUserId',
            label: 'Admin',
            render: (row) => row.adminUsername ?? `User ${row.adminUserId}`,
          },
          {
            key: 'operationType',
            label: 'Operation',
            render: (row) => (
              <span className="font-mono text-xs">
                {row.operationType.replace(/_/g, ' ')}
              </span>
            ),
          },
          {
            key: 'operationResult',
            label: 'Result',
            render: (row) => (
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  row.operationResult === 'success'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {row.operationResult.toUpperCase()}
              </span>
            ),
          },
          {
            key: 'resultSummary',
            label: 'Summary',
            render: (row) => (
              <span className="text-xs text-secondary truncate max-w-[200px] block">
                {JSON.stringify(row.resultSummary)}
              </span>
            ),
          },
        ]}
        data={data?.entries ?? []}
        loading={loading}
        emptyMessage="No audit log entries found"
        pagination={
          data && data.totalPages > 1
            ? { page: data.page, totalPages: data.totalPages, onPageChange: setPage }
            : undefined
        }
      />
    </div>
  );
}

export default AuditLogPage;
