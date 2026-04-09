/**
 * RecentUsersTab - Recent real users with onboarding status, robot details,
 * and issue detection.
 *
 * Self-contained component that fetches from GET /api/admin/users/recent
 * and manages its own cycle-range filter state.
 *
 * Requirements: 2.10
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../utils/apiClient';
import type { RecentUser, RecentUsersResponse, RecentUserRobot } from './types';

export function RecentUsersTab() {
  const [data, setData] = useState<RecentUsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [cyclesBack, setCyclesBack] = useState(10);

  const fetchRecentUsers = useCallback(async (cycles?: number) => {
    setLoading(true);
    try {
      const c = cycles ?? cyclesBack;
      const response = await apiClient.get<RecentUsersResponse>(
        `/api/admin/users/recent?cycles=${c}`,
      );
      setData(response.data);
    } catch {
      // Error is visible via empty state; keep it simple like other tabs
    } finally {
      setLoading(false);
    }
  }, [cyclesBack]);

  useEffect(() => {
    fetchRecentUsers();
  }, [fetchRecentUsers]);

  return (
    <div data-testid="recent-users-tab" className="space-y-6">
      {/* Controls */}
      <div className="bg-surface rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold">👥 Recent Real Users</h2>
            <p className="text-sm text-secondary mt-1">
              Registered users only — excludes auto-generated bots, WimpBots, and seeded test accounts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-secondary">
              Last
              <input
                type="number"
                min="1"
                max="200"
                value={cyclesBack}
                onChange={(e) =>
                  setCyclesBack(Math.max(1, Math.min(200, parseInt(e.target.value) || 10)))
                }
                className="mx-2 bg-surface-elevated text-white px-3 py-1 rounded w-20 text-center min-h-[44px]"
              />
              cycles
            </label>
            <button
              onClick={() => fetchRecentUsers()}
              disabled={loading}
              className="bg-primary hover:bg-blue-700 disabled:bg-surface-elevated px-6 py-2 rounded font-semibold transition-colors min-h-[44px]"
            >
              {loading ? 'Loading...' : data ? 'Refresh' : 'Load Users'}
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-surface-elevated rounded p-3">
              <p className="text-secondary">Total Real Users</p>
              <p className="text-2xl font-bold text-primary">{data.totalUsers}</p>
            </div>
            <div className="bg-surface-elevated rounded p-3">
              <p className="text-secondary">With Issues</p>
              <p
                className={`text-2xl font-bold ${
                  data.usersWithIssues > 0 ? 'text-warning' : 'text-success'
                }`}
              >
                {data.usersWithIssues}
              </p>
            </div>
            <div className="bg-surface-elevated rounded p-3">
              <p className="text-secondary">Current Cycle</p>
              <p className="text-2xl font-bold">{data.currentCycle}</p>
            </div>
            <div className="bg-surface-elevated rounded p-3">
              <p className="text-secondary">Looking Back</p>
              <p className="text-2xl font-bold">{data.cyclesBack} cycles</p>
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="text-center py-8 text-secondary">
          <div className="animate-pulse">Loading recent users...</div>
        </div>
      )}

      {/* Empty initial state */}
      {!data && !loading && (
        <div className="text-center py-8 text-secondary">
          <p>Click &quot;Load Users&quot; to see recently registered real users and their activity</p>
        </div>
      )}

      {/* No users found */}
      {data && data.users.length === 0 && (
        <div className="bg-surface rounded-lg p-6 text-center text-secondary">
          <p>No real users registered in the last {data.cyclesBack} cycles.</p>
          <p className="text-sm mt-2">Try increasing the cycle range.</p>
        </div>
      )}

      {/* User list */}
      {data && data.users.length > 0 && (
        <div className="space-y-4">
          {data.users.map((user) => (
            <UserCard key={user.userId} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  UserCard — single recent user card with robots table               */
/* ------------------------------------------------------------------ */

function UserCard({ user }: { user: RecentUser }) {
  return (
    <div
      className={`bg-surface rounded-lg p-5 ${
        user.issues.length > 0 ? 'border-l-4 border-yellow-500' : ''
      }`}
    >
      {/* User header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">
              {user.stableName || user.username}
            </span>
            {user.stableName && (
              <span className="text-sm text-secondary">@{user.username}</span>
            )}
            {user.role === 'admin' && (
              <span className="px-2 py-0.5 bg-red-800 rounded text-xs">admin</span>
            )}
          </div>
          <p className="text-xs text-secondary mt-1">
            Registered: {new Date(user.createdAt).toLocaleString()} · ID: {user.userId}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm">₡{user.currency.toLocaleString()}</p>
          <p className="text-xs text-secondary">
            {user.summary.totalRobots} robot
            {user.summary.totalRobots !== 1 ? 's' : ''} ·{' '}
            {user.summary.facilitiesPurchased} facilit
            {user.summary.facilitiesPurchased !== 1 ? 'ies' : 'y'}
          </p>
        </div>
      </div>

      {/* Onboarding status */}
      <div className="flex flex-wrap gap-2 mb-3">
        {user.onboarding.completed ? (
          <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-xs">
            ✓ Onboarding complete
          </span>
        ) : user.onboarding.skipped ? (
          <span className="px-2 py-1 bg-surface-elevated text-secondary rounded text-xs">
            ⏭ Onboarding skipped
          </span>
        ) : (
          <span className="px-2 py-1 bg-yellow-900 text-yellow-300 rounded text-xs">
            ⏳ Onboarding step {user.onboarding.currentStep}/9
            {user.onboarding.strategy && ` · ${user.onboarding.strategy}`}
          </span>
        )}
        {user.summary.totalBattles > 0 && (
          <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded text-xs">
            ⚔️ {user.summary.totalBattles} battles · {user.summary.winRate}% win rate
          </span>
        )}
        {user.summary.battleReadyRobots > 0 && (
          <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-xs">
            🤖 {user.summary.battleReadyRobots}/{user.summary.totalRobots} battle ready
          </span>
        )}
      </div>

      {/* Issues */}
      {user.issues.length > 0 && (
        <div className="mb-3 p-2 bg-yellow-900 bg-opacity-30 rounded">
          <p className="text-xs text-warning font-semibold mb-1">⚠️ Potential issues:</p>
          {user.issues.map((issue, idx) => (
            <p key={idx} className="text-xs text-yellow-300 ml-2">
              • {issue}
            </p>
          ))}
        </div>
      )}

      {/* Robots table */}
      {user.robots.length > 0 && <RobotTable robots={user.robots} />}

      {user.robots.length === 0 && (
        <p className="text-sm text-tertiary italic">No robots created yet</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RobotTable — per-user robot details table                          */
/* ------------------------------------------------------------------ */

function RobotTable({ robots }: { robots: RecentUserRobot[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-surface-elevated">
          <tr>
            <th className="p-2 text-left">Robot</th>
            <th className="p-2 text-left">HP</th>
            <th className="p-2 text-left">League</th>
            <th className="p-2 text-left">ELO</th>
            <th className="p-2 text-left">W/L/D</th>
            <th className="p-2 text-left">Win%</th>
            <th className="p-2 text-left">Loadout</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {robots.map((robot) => (
            <tr key={robot.id} className="border-t border-white/10">
              <td className="p-2">
                <Link to={`/robots/${robot.id}`} className="text-primary hover:underline">
                  {robot.name}
                </Link>
              </td>
              <td className="p-2">
                <span
                  className={
                    robot.hpPercent < 50
                      ? 'text-error'
                      : robot.hpPercent < 80
                        ? 'text-warning'
                        : 'text-success'
                  }
                >
                  {robot.hpPercent}%
                </span>
                <span className="text-tertiary ml-1">
                  ({robot.currentHP}/{robot.maxHP})
                </span>
              </td>
              <td className="p-2 capitalize">{robot.league}</td>
              <td className="p-2">{robot.elo}</td>
              <td className="p-2">
                {robot.wins}/{robot.losses}/{robot.draws}
              </td>
              <td className="p-2">
                {robot.totalBattles > 0 ? `${robot.winRate}%` : '-'}
              </td>
              <td className="p-2">
                {robot.hasWeapon ? (
                  <span className="capitalize">{robot.loadout.replace('_', ' ')}</span>
                ) : (
                  <span className="text-error">No weapon</span>
                )}
                {' · '}
                <span className="capitalize text-secondary">{robot.stance}</span>
              </td>
              <td className="p-2">
                {robot.battleReady ? (
                  <span className="text-success">Ready</span>
                ) : (
                  <span className="text-error">Not ready</span>
                )}
              </td>
              <td className="p-2 text-secondary">
                {new Date(robot.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
