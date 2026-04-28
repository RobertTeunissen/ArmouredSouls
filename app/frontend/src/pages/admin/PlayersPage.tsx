/**
 * PlayersPage — Unified player management: new players, auto-generated bots,
 * at-risk users, engagement data, search, and player detail.
 *
 * Replaces the separate Engagement page by including churn risk and last login
 * directly in the player list.
 *
 * Requirements: 9.1–9.8, 13.1–13.5, 25.1–25.6
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminPageHeader, AdminStatCard, AdminDataTable, AdminFilterBar, AdminSlideOver } from '../../components/admin/shared';
import apiClient from '../../utils/apiClient';
import type { AtRiskUser, AtRiskUsersResponse, RecentUser, RecentUsersResponse } from '../../components/admin/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Tab = 'new-players' | 'auto-generated' | 'at-risk';

interface SearchUser {
  id: number;
  username: string;
  email: string;
  stableName: string | null;
  [key: string]: unknown;
}

interface PlayerDetail {
  id: number;
  username: string;
  email: string;
  stableName: string | null;
  currency: number;
  role: string;
  createdAt: string;
  onboarding?: { completed: boolean; currentStep: number };
  robots: { id: number; name: string; elo: number; league: string; wins: number; losses: number; draws: number; equippedWeapon?: string }[];
  facilities: { type: string; level: number; passiveIncome: number }[];
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Must contain an uppercase letter';
  if (!/[a-z]/.test(password)) return 'Must contain a lowercase letter';
  if (!/[0-9]/.test(password)) return 'Must contain a number';
  return undefined;
}

const CHURN_COLORS: Record<string, string> = {
  low: 'bg-green-500/20 text-green-400',
  medium: 'bg-amber-500/20 text-amber-400',
  high: 'bg-red-500/20 text-red-400',
};

function ChurnBadge({ risk }: { risk: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${CHURN_COLORS[risk] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {risk}
    </span>
  );
}

function daysSince(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function PlayersPage() {
  const [tab, setTab] = useState<Tab>('new-players');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[] | null>(null);
  const [searching, setSearching] = useState(false);

  // New players (real users)
  const [playersData, setPlayersData] = useState<RecentUsersResponse | null>(null);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [cyclesBack, setCyclesBack] = useState(10);

  // Auto-generated users
  const [autoData, setAutoData] = useState<RecentUsersResponse | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoCyclesBack, setAutoCyclesBack] = useState(10);

  // At-risk
  const [atRiskData, setAtRiskData] = useState<AtRiskUsersResponse | null>(null);
  const [atRiskLoading, setAtRiskLoading] = useState(false);

  // Churn risk filter (client-side, applies to both new-players and auto-generated)
  const [churnFilter, setChurnFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Slide-over
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetail | null>(null);
  const [selectedListUser, setSelectedListUser] = useState<RecentUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Password reset
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  /* ---------- Data fetching ---------- */

  const fetchPlayers = useCallback(async () => {
    setPlayersLoading(true);
    try {
      const response = await apiClient.get<RecentUsersResponse>(`/api/admin/users/recent?cycles=${cyclesBack}&filter=real`);
      setPlayersData(response.data);
    } catch {
      // handled by empty state
    } finally {
      setPlayersLoading(false);
    }
  }, [cyclesBack]);

  const fetchAutoUsers = useCallback(async () => {
    setAutoLoading(true);
    try {
      const response = await apiClient.get<RecentUsersResponse>(`/api/admin/users/recent?cycles=${autoCyclesBack}&filter=auto`);
      setAutoData(response.data);
    } catch {
      // handled by empty state
    } finally {
      setAutoLoading(false);
    }
  }, [autoCyclesBack]);

  const fetchAtRisk = useCallback(async () => {
    setAtRiskLoading(true);
    try {
      const response = await apiClient.get<AtRiskUsersResponse>('/api/admin/users/at-risk');
      setAtRiskData(response.data);
    } catch {
      // handled by empty state
    } finally {
      setAtRiskLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setSearching(true);
    try {
      const response = await apiClient.get<{ users: SearchUser[] }>('/api/admin/users/search', { params: { q: trimmed } });
      setSearchResults(response.data.users);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);
  useEffect(() => { if (tab === 'auto-generated') fetchAutoUsers(); }, [tab, fetchAutoUsers]);
  useEffect(() => { if (tab === 'at-risk' && !atRiskData) fetchAtRisk(); }, [tab, atRiskData, fetchAtRisk]);

  const openPlayerDetail = async (userId: number, listUser?: RecentUser) => {
    setDetailLoading(true);
    setSlideOverOpen(true);
    setSelectedListUser(listUser ?? null);
    setResetSuccess(null);
    setResetError(null);
    setPassword('');
    setConfirmPassword('');
    try {
      const response = await apiClient.get<PlayerDetail>(`/api/admin/users/${userId}`);
      setSelectedPlayer(response.data);
    } catch {
      setSelectedPlayer(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedPlayer) return;
    const pwErr = validatePassword(password);
    setPasswordError(pwErr);
    if (pwErr) return;
    if (password !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    setResetting(true);
    setResetError(null);
    setResetSuccess(null);
    try {
      await apiClient.post(`/api/admin/users/${selectedPlayer.id}/reset-password`, { password });
      setResetSuccess(`Password reset for ${selectedPlayer.username}`);
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to reset password';
      setResetError(msg);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div data-testid="players-page" className="space-y-6">
      <AdminPageHeader title="Players" subtitle="Player accounts, auto-generated bots, engagement, and at-risk users" />

      {/* Search */}
      <div className="bg-surface rounded-lg p-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by username, stable name, or robot name..."
            className="flex-1 bg-surface-elevated text-white px-4 py-2 rounded"
          />
          <button onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="bg-primary hover:bg-blue-700 disabled:bg-surface-elevated px-6 py-2 rounded font-semibold transition-colors">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {searchResults !== null && searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((user) => (
              <button key={user.id} type="button" onClick={() => openPlayerDetail(user.id)} className="w-full text-left px-4 py-3 rounded bg-surface-elevated hover:bg-white/10 transition-colors">
                <span className="font-semibold">{user.username}</span>
                {user.stableName && <span className="text-secondary ml-2">({user.stableName})</span>}
                <span className="text-tertiary ml-2">· ID: {user.id}</span>
              </button>
            ))}
          </div>
        )}
        {searchResults !== null && searchResults.length === 0 && (
          <p className="mt-4 text-secondary text-sm">No users found</p>
        )}
      </div>

      {/* Tab filter — unified pill style via AdminFilterBar */}
      <AdminFilterBar
        filters={[
          { key: 'new-players', label: '👥 New Players', active: tab === 'new-players' },
          { key: 'auto-generated', label: '🤖 Auto-Generated', active: tab === 'auto-generated' },
          { key: 'at-risk', label: '⚠️ At-Risk', active: tab === 'at-risk' },
        ]}
        onFilterToggle={(key) => setTab(key as Tab)}
      />

      {/* New Players Tab */}
      {tab === 'new-players' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-secondary">Cycles</label>
              <select value={cyclesBack} onChange={(e) => setCyclesBack(Number(e.target.value))} className="bg-surface-elevated text-white px-3 py-1.5 rounded text-sm">
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>All</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-secondary">Churn Risk</label>
              <select value={churnFilter} onChange={(e) => setChurnFilter(e.target.value as typeof churnFilter)} className="bg-surface-elevated text-white px-3 py-1.5 rounded text-sm">
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <PlayersListView data={playersData} loading={playersLoading} onSelectUser={(id, u) => openPlayerDetail(id, u)} label="real" churnFilter={churnFilter} />
        </div>
      )}

      {/* Auto-Generated Tab */}
      {tab === 'auto-generated' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-secondary">Cycles</label>
              <select value={autoCyclesBack} onChange={(e) => setAutoCyclesBack(Number(e.target.value))} className="bg-surface-elevated text-white px-3 py-1.5 rounded text-sm">
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>All</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-secondary">Churn Risk</label>
              <select value={churnFilter} onChange={(e) => setChurnFilter(e.target.value as typeof churnFilter)} className="bg-surface-elevated text-white px-3 py-1.5 rounded text-sm">
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <PlayersListView data={autoData} loading={autoLoading} onSelectUser={(id, u) => openPlayerDetail(id, u)} label="auto-generated" churnFilter={churnFilter} />
        </div>
      )}

      {/* At-Risk Tab */}
      {tab === 'at-risk' && (
        <AtRiskView data={atRiskData} loading={atRiskLoading} onSelectUser={(id) => openPlayerDetail(id)} />
      )}

      {/* Player Detail Slide-Over */}
      <AdminSlideOver open={slideOverOpen} onClose={() => { setSlideOverOpen(false); setSelectedListUser(null); }} title={selectedPlayer ? selectedPlayer.username : 'Player Detail'} width="xl">
        {detailLoading ? (
          <div className="text-center py-8 text-secondary">Loading player details...</div>
        ) : selectedPlayer ? (
          <div className="space-y-6">
            <div className="bg-surface-elevated rounded-lg p-4 text-sm space-y-1">
              <p><span className="text-secondary">ID:</span> {selectedPlayer.id}</p>
              <p><span className="text-secondary">Username:</span> {selectedPlayer.username}</p>
              {selectedPlayer.stableName && <p><span className="text-secondary">Stable:</span> {selectedPlayer.stableName}</p>}
              <p><span className="text-secondary">Balance:</span> ₡{selectedPlayer.currency.toLocaleString()}</p>
              <p><span className="text-secondary">Role:</span> {selectedPlayer.role}</p>
              <p><span className="text-secondary">Joined:</span> {new Date(selectedPlayer.createdAt).toLocaleDateString()}</p>
              {selectedPlayer.onboarding && (
                <p>
                  <span className="text-secondary">Onboarding:</span>{' '}
                  {selectedPlayer.onboarding.completed
                    ? <span className="text-success">Completed</span>
                    : <span className="text-warning">Step {selectedPlayer.onboarding.currentStep}</span>}
                </p>
              )}
              {selectedListUser && (
                <>
                  <p><span className="text-secondary">Last Login:</span> {daysSince(selectedListUser.lastLoginAt)}</p>
                  <p><span className="text-secondary">Churn Risk:</span> <ChurnBadge risk={selectedListUser.churnRisk} /></p>
                </>
              )}
            </div>

            {selectedListUser && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniStat label="Robots" value={selectedListUser.summary.totalRobots} />
                <MiniStat label="Battle Ready" value={selectedListUser.summary.battleReadyRobots} />
                <MiniStat label="Win Rate" value={`${selectedListUser.summary.winRate}%`} />
                <MiniStat label="Facilities" value={selectedListUser.summary.facilitiesPurchased} />
              </div>
            )}

            {selectedListUser && selectedListUser.issues.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-warning mb-2">⚠️ Issues ({selectedListUser.issues.length})</h4>
                <ul className="space-y-1">
                  {selectedListUser.issues.map((issue, idx) => (
                    <li key={idx} className="bg-yellow-900/20 border border-yellow-700/30 rounded px-3 py-2 text-sm text-warning">{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedPlayer.robots.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-secondary mb-2">Robots ({selectedPlayer.robots.length})</h4>
                <div className="space-y-2">
                  {selectedPlayer.robots.map((robot) => {
                    const listRobot = selectedListUser?.robots.find(r => r.id === robot.id);
                    return (
                      <div key={robot.id} className="bg-surface-elevated rounded p-3 text-sm">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold">{robot.name}</p>
                          {listRobot && (
                            <span className={`text-xs px-2 py-0.5 rounded ${listRobot.battleReady ? 'bg-green-900/30 text-success' : 'bg-red-900/30 text-error'}`}>
                              {listRobot.battleReady ? 'Battle Ready' : 'Not Ready'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary mt-1">
                          {robot.league} · ELO: {robot.elo} · W/L/D: {robot.wins}/{robot.losses}/{robot.draws}
                          {robot.equippedWeapon && <span> · Weapon: {robot.equippedWeapon}</span>}
                        </p>
                        {listRobot && (
                          <p className="text-xs text-tertiary mt-0.5">
                            HP: {listRobot.currentHP}/{listRobot.maxHP} ({listRobot.hpPercent}%)
                            {listRobot.winRate > 0 && <span> · Win Rate: {listRobot.winRate}%</span>}
                            {listRobot.stance && <span> · Stance: {listRobot.stance}</span>}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedPlayer.facilities.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-secondary mb-2">Facilities ({selectedPlayer.facilities.length})</h4>
                <div className="space-y-1">
                  {selectedPlayer.facilities.map((f, idx) => (
                    <div key={idx} className="bg-surface-elevated rounded p-2 text-sm flex justify-between">
                      <span className="capitalize">{f.type.replace(/_/g, ' ')}</span>
                      <span className="text-secondary">Lv.{f.level}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-white/10 pt-4">
              <h4 className="text-sm font-semibold text-secondary mb-3">🔑 Password Reset</h4>
              {resetSuccess && <div className="bg-green-900/30 border border-green-700 rounded p-3 mb-3 text-success text-sm">{resetSuccess}</div>}
              {resetError && <div className="bg-red-900/30 border border-red-700 rounded p-3 mb-3 text-error text-sm">{resetError}</div>}
              <div className="space-y-3">
                <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setPasswordError(undefined); }} placeholder="New password" className="w-full bg-surface-elevated text-white px-4 py-2 rounded" />
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="w-full bg-surface-elevated text-white px-4 py-2 rounded" />
                {passwordError && <p className="text-error text-sm">{passwordError}</p>}
                <button onClick={handlePasswordReset} disabled={resetting} className="bg-red-600 hover:bg-red-700 disabled:bg-surface-elevated px-4 py-2 rounded font-semibold text-sm transition-colors">
                  {resetting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-secondary">Failed to load player details.</p>
        )}
      </AdminSlideOver>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini stat                                                          */
/* ------------------------------------------------------------------ */

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-elevated rounded p-2 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-secondary">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sort helper                                                        */
/* ------------------------------------------------------------------ */

const CHURN_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PAGE_SIZE = 25;

function getSortValue(row: RecentUser, key: string): string | number {
  switch (key) {
    case 'username': return (row.stableName || row.username).toLowerCase();
    case 'currency': return row.currency;
    case 'robots': return row.summary.totalRobots;
    case 'battles': return row.summary.totalBattles;
    case 'winRate': return row.summary.winRate;
    case 'lastLoginAt': return row.lastLoginAt ? new Date(row.lastLoginAt).getTime() : 0;
    case 'churnRisk': return CHURN_ORDER[row.churnRisk] ?? 3;
    case 'issues': return row.issues.length;
    case 'createdAt': return new Date(row.createdAt).getTime();
    default: return 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Players List (shared between New Players and Auto-Generated)       */
/* ------------------------------------------------------------------ */

function PlayersListView({ data, loading, onSelectUser, label, churnFilter = 'all' }: {
  data: RecentUsersResponse | null;
  loading: boolean;
  onSelectUser: (id: number, listUser?: RecentUser) => void;
  label: string;
  churnFilter?: 'all' | 'high' | 'medium' | 'low';
}) {
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Reset page when filter or data changes
  useEffect(() => { setPage(1); }, [churnFilter, data]);

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const sortedAndFiltered = useMemo(() => {
    if (!data) return [];
    let users = churnFilter === 'all' ? data.users : data.users.filter(u => u.churnRisk === churnFilter);
    users = [...users].sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return users;
  }, [data, churnFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedAndFiltered.length / PAGE_SIZE);
  const pageData = sortedAndFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading && !data) return <div className="text-center py-8 text-secondary">Loading {label} users...</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminStatCard label={label === 'real' ? 'Real Players' : 'Auto-Generated'} value={data.totalUsers} color="primary" icon={<span>{label === 'real' ? '👥' : '🤖'}</span>} />
        <AdminStatCard label="Showing" value={sortedAndFiltered.length} color={churnFilter !== 'all' ? 'info' : 'primary'} icon={<span>👁️</span>} />
        <AdminStatCard label="With Issues" value={data.usersWithIssues} color={data.usersWithIssues > 0 ? 'warning' : 'success'} icon={<span>⚠️</span>} />
        <AdminStatCard label="Current Cycle" value={data.currentCycle} color="info" icon={<span>🔄</span>} />
      </div>
      {sortedAndFiltered.length === 0 ? (
        <div className="bg-surface rounded-lg p-8 text-center">
          <p className="text-3xl mb-2">{churnFilter !== 'all' ? '🔍' : label === 'real' ? '👥' : '🤖'}</p>
          <p className="text-lg font-semibold text-secondary">
            {churnFilter !== 'all'
              ? `No ${churnFilter}-risk players found`
              : label === 'real' ? 'No real players yet' : 'No auto-generated users found'}
          </p>
          <p className="text-sm text-tertiary mt-1">
            {churnFilter !== 'all'
              ? 'Try a different churn risk filter or cycle range'
              : label === 'real' ? 'Only test and auto-generated users exist' : 'No auto-generated bots in the selected range'}
          </p>
        </div>
      ) : (
        <AdminDataTable<RecentUser & Record<string, unknown>>
          columns={[
            { key: 'username', label: 'Player', sortable: true, render: (row) => (
              <div>
                <span className="font-semibold">{row.stableName || row.username}</span>
                {row.stableName && <span className="text-secondary text-xs ml-1">@{row.username}</span>}
              </div>
            )},
            { key: 'currency', label: 'Balance', sortable: true, align: 'right', render: (row) => `₡${row.currency.toLocaleString()}` },
            { key: 'robots', label: 'Robots', sortable: true, align: 'right', render: (row) => `${row.summary.totalRobots}` },
            { key: 'battles', label: 'Battles', sortable: true, align: 'right', render: (row) => `${row.summary.totalBattles}` },
            { key: 'winRate', label: 'Win %', sortable: true, align: 'right', render: (row) => row.summary.totalBattles > 0 ? `${row.summary.winRate}%` : '—' },
            { key: 'lastLoginAt', label: 'Last Login', sortable: true, render: (row) => <span className="text-xs">{daysSince(row.lastLoginAt)}</span> },
            { key: 'churnRisk', label: 'Churn', sortable: true, render: (row) => <ChurnBadge risk={row.churnRisk} /> },
            { key: 'issues', label: 'Issues', sortable: true, align: 'right', render: (row) => row.issues.length > 0 ? <span className="text-warning">{row.issues.length}</span> : <span className="text-success">0</span> },
          ]}
          data={pageData as (RecentUser & Record<string, unknown>)[]}
          onRowClick={(row) => onSelectUser(row.userId, row as unknown as RecentUser)}
          emptyMessage={`No ${label} users found`}
          sortState={{ key: sortKey, direction: sortDir }}
          onSort={handleSort}
          pagination={totalPages > 1 ? { page, totalPages, onPageChange: setPage } : undefined}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  At-Risk View                                                       */
/* ------------------------------------------------------------------ */

function AtRiskView({ data, loading, onSelectUser }: { data: AtRiskUsersResponse | null; loading: boolean; onSelectUser: (id: number) => void }) {
  const [sortKey, setSortKey] = useState('currentBalance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data.users].sort((a, b) => {
      const va = (a as unknown as Record<string, unknown>)[sortKey];
      const vb = (b as unknown as Record<string, unknown>)[sortKey];
      const na = typeof va === 'number' ? va : typeof va === 'string' ? va.toLowerCase() : 0;
      const nb = typeof vb === 'number' ? vb : typeof vb === 'string' ? vb.toLowerCase() : 0;
      if (na < nb) return sortDir === 'asc' ? -1 : 1;
      if (na > nb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading && !data) return <div className="text-center py-8 text-secondary">Loading at-risk users...</div>;

  if (data && data.totalAtRisk === 0) {
    return (
      <div className="bg-surface rounded-lg p-8 text-center">
        <p className="text-3xl mb-2">✓</p>
        <p className="text-xl font-semibold text-success">No users at risk of bankruptcy</p>
        <p className="text-sm text-secondary mt-2">Threshold: ₡{data.threshold.toLocaleString()}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminStatCard label="At Risk" value={data.totalAtRisk} color="error" icon={<span>⚠️</span>} />
        <AdminStatCard label="Threshold" value={`₡${data.threshold.toLocaleString()}`} color="warning" />
        <AdminStatCard label="Current Cycle" value={data.currentCycle} color="info" />
        <AdminStatCard label="Checked" value={new Date(data.timestamp).toLocaleTimeString()} color="info" />
      </div>
      <AdminDataTable<AtRiskUser & Record<string, unknown>>
        columns={[
          { key: 'stableName', label: 'Stable', sortable: true },
          { key: 'currentBalance', label: 'Balance', sortable: true, align: 'right', render: (row) => <span className={row.currentBalance < 5000 ? 'text-error font-bold' : 'text-warning'}>₡{row.currentBalance.toLocaleString()}</span> },
          { key: 'totalRepairCost', label: 'Repair Cost', sortable: true, align: 'right', render: (row) => `₡${row.totalRepairCost.toLocaleString()}` },
          { key: 'daysOfRunway', label: 'Runway', sortable: true, align: 'right', render: (row) => <span className={row.daysOfRunway < 3 ? 'text-error font-bold' : row.daysOfRunway < 7 ? 'text-warning' : 'text-success'}>{row.daysOfRunway < 999 ? `${row.daysOfRunway}d` : '∞'}</span> },
          { key: 'cyclesAtRisk', label: 'Cycles At Risk', sortable: true, align: 'right' },
          { key: 'robotCount', label: 'Robots', sortable: true, align: 'right' },
        ]}
        data={pageData as (AtRiskUser & Record<string, unknown>)[]}
        onRowClick={(row) => onSelectUser(row.userId)}
        emptyMessage="No at-risk users"
        sortState={{ key: sortKey, direction: sortDir }}
        onSort={handleSort}
        pagination={totalPages > 1 ? { page, totalPages, onPageChange: setPage } : undefined}
      />
    </div>
  );
}

export default PlayersPage;
