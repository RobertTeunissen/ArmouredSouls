/**
 * BankruptcyMonitorTab - Dedicated at-risk users monitoring tab.
 *
 * Always renders status — shows a green confirmation when no users are at risk,
 * or a detailed list with balance history, runway days, and robot damage info
 * when users are at risk.
 *
 * Fetches from GET /api/admin/users/at-risk on mount and on manual refresh.
 *
 * Requirements: 2.2
 */
import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../utils/apiClient';
import type { AtRiskUser, AtRiskUsersResponse } from './types';

export function BankruptcyMonitorTab(): JSX.Element {
  const [data, setData] = useState<AtRiskUsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAtRiskUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<AtRiskUsersResponse>('/api/admin/users/at-risk');
      setData(response.data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch at-risk users';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAtRiskUsers();
  }, [fetchAtRiskUsers]);

  /* ---------- Loading state ---------- */
  if (loading && !data) {
    return (
      <div data-testid="bankruptcy-monitor-tab" className="space-y-6">
        <h2 className="text-2xl font-bold">Bankruptcy Monitor</h2>
        <div className="text-center py-12 text-secondary">Loading at-risk user data…</div>
      </div>
    );
  }

  /* ---------- Error state ---------- */
  if (error && !data) {
    return (
      <div data-testid="bankruptcy-monitor-tab" className="space-y-6">
        <h2 className="text-2xl font-bold">Bankruptcy Monitor</h2>
        <div className="bg-surface rounded-lg p-6 text-center">
          <p className="text-error mb-4">{error}</p>
          <button
            onClick={fetchAtRiskUsers}
            className="bg-primary hover:bg-primary/80 px-6 py-2 rounded font-semibold transition-colors min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalAtRisk = data?.totalAtRisk ?? 0;

  return (
    <div data-testid="bankruptcy-monitor-tab" className="space-y-6">
      {/* Header with refresh */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Bankruptcy Monitor</h2>
        <button
          onClick={fetchAtRiskUsers}
          disabled={loading}
          className="bg-primary hover:bg-primary/80 disabled:bg-surface-elevated px-6 py-2 rounded font-semibold transition-colors min-h-[44px]"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Zero-state: no users at risk */}
      {totalAtRisk === 0 && data && (
        <div className="bg-surface rounded-lg p-8 text-center" data-testid="no-risk-message">
          <p className="text-3xl mb-2">✓</p>
          <p className="text-xl font-semibold text-success">No users at risk of bankruptcy</p>
          <p className="text-sm text-secondary mt-2">
            Threshold: ₡{data.threshold.toLocaleString()} · Cycle {data.currentCycle}
          </p>
        </div>
      )}

      {/* At-risk users present */}
      {totalAtRisk > 0 && data && (
        <>
          {/* Summary cards */}
          <div className="bg-surface rounded-lg p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-secondary">Total At Risk</p>
                <p className="text-2xl font-bold text-error">{data.totalAtRisk}</p>
              </div>
              <div>
                <p className="text-secondary">Threshold</p>
                <p className="text-2xl font-bold">₡{data.threshold.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-secondary">Current Cycle</p>
                <p className="text-2xl font-bold">{data.currentCycle}</p>
              </div>
              <div>
                <p className="text-secondary">Checked At</p>
                <p className="text-2xl font-bold">{new Date(data.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          </div>

          {/* User table */}
          <div className="bg-surface rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-error">⚠️ Users At Risk of Bankruptcy</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-elevated">
                  <tr>
                    <th className="p-2 lg:p-3 text-left">Stable</th>
                    <th className="p-2 lg:p-3 text-left">Balance</th>
                    <th className="p-2 lg:p-3 text-left">Repair Costs</th>
                    <th className="p-2 lg:p-3 text-left">Net Balance</th>
                    <th className="p-2 lg:p-3 text-left">Days of Runway</th>
                    <th className="p-2 lg:p-3 text-left">Cycles At Risk</th>
                    <th className="p-2 lg:p-3 text-left">Robots</th>
                    <th className="p-2 lg:p-3 text-left">History</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user: AtRiskUser) => (
                    <UserRow key={user.userId} user={user} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  UserRow — single at-risk user table row                            */
/* ------------------------------------------------------------------ */

function UserRow({ user }: { user: AtRiskUser }): JSX.Element {
  return (
    <tr className="border-t border-white/10 hover:bg-surface-elevated">
      <td className="p-2 lg:p-3">
        <div>
          <p className="font-semibold">{user.stableName}</p>
          <p className="text-xs text-secondary">@{user.username}</p>
        </div>
      </td>
      <td className="p-2 lg:p-3">
        <span className={user.currentBalance < 5000 ? 'text-error font-bold' : 'text-warning'}>
          ₡{user.currentBalance.toLocaleString()}
        </span>
      </td>
      <td className="p-2 lg:p-3">
        <span className="text-orange-400">
          ₡{user.totalRepairCost.toLocaleString()}
        </span>
        {user.damagedRobots > 0 && (
          <p className="text-xs text-secondary">
            {user.damagedRobots} damaged
          </p>
        )}
      </td>
      <td className="p-2 lg:p-3">
        <span className={user.netBalance < 0 ? 'text-red-500 font-bold' : 'text-secondary'}>
          ₡{user.netBalance.toLocaleString()}
        </span>
      </td>
      <td className="p-2 lg:p-3">
        <span className={
          user.daysOfRunway < 3 ? 'text-red-500 font-bold' :
          user.daysOfRunway < 7 ? 'text-warning' :
          'text-success'
        }>
          {user.daysOfRunway < 999 ? `${user.daysOfRunway} days` : '∞'}
        </span>
      </td>
      <td className="p-2 lg:p-3">
        <div>
          <span className="font-semibold">{user.cyclesAtRisk}</span>
          {user.firstAtRiskCycle && (
            <p className="text-xs text-secondary">
              Since cycle {user.firstAtRiskCycle}
            </p>
          )}
        </div>
      </td>
      <td className="p-2 lg:p-3">
        <span>{user.robotCount} robots</span>
      </td>
      <td className="p-2 lg:p-3">
        {user.balanceHistory.length > 0 ? (
          <details className="cursor-pointer">
            <summary className="text-primary hover:underline min-h-[44px] flex items-center">
              View ({user.balanceHistory.length})
            </summary>
            <div className="mt-2 space-y-1 text-xs bg-surface p-2 rounded">
              {user.balanceHistory.map((h) => (
                <div key={h.cycle} className="flex justify-between gap-2">
                  <span className="text-secondary">Cycle {h.cycle}:</span>
                  <span>₡{h.balance.toLocaleString()}</span>
                  {h.dailyIncome > 0 && (
                    <span className="text-success">+₡{h.dailyIncome.toLocaleString()}</span>
                  )}
                  {h.dailyCost > 0 && (
                    <span className="text-error">-₡{h.dailyCost.toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          </details>
        ) : (
          <span className="text-tertiary">No history</span>
        )}
      </td>
    </tr>
  );
}
