/**
 * Admin Tournaments Page
 *
 * Displays all tournaments (1v1, 2v2, 3v3) with type filtering, bracket rendering
 * with team names and member robots, per-robot combat statistics grouped by team,
 * and tournament creation history per type.
 *
 * Requirements: R8.1, R8.2, R8.4, R8.6
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AdminPageHeader, AdminStatCard, AdminFilterBar } from '../../components/admin/shared';
import { api } from '../../utils/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type ParticipantTypeFilter = 'all' | 'robot' | 'team_2v2' | 'team_3v3';

interface TournamentMatch {
  id: number;
  tournamentId: number;
  round: number;
  matchNumber: number;
  participantType: string;
  participant1Id: number | null;
  participant2Id: number | null;
  winnerId: number | null;
  battleId: number | null;
  status: string;
  isByeMatch: boolean;
  createdAt: string;
  completedAt: string | null;
}

interface Tournament {
  id: number;
  name: string;
  tournamentType: string;
  participantType: string;
  status: string;
  currentRound: number;
  maxRounds: number;
  totalParticipants: number;
  winnerId: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  matches: TournamentMatch[];
}

interface ResolvedParticipant {
  id: number;
  displayName: string;
  leagueTier: string;
  elo: number;
  ownerId: number;
  ownerStableName?: string;
  members?: { robotId: number; robotName: string; elo: number }[];
}

interface TournamentListResponse {
  success: boolean;
  tournaments: Tournament[];
  count: number;
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

interface TournamentDetailResponse {
  success: boolean;
  tournament: Tournament;
  currentRoundMatches: TournamentMatch[];
  resolvedParticipants: Record<number, ResolvedParticipant>;
}

interface TournamentHistoryEntry {
  id: number;
  name: string;
  status: string;
  participantType: string;
  totalParticipants: number;
  maxRounds: number;
  currentRound: number;
  winnerId: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface TournamentHistoryResponse {
  success: boolean;
  history: {
    robot: TournamentHistoryEntry[];
    team_2v2: TournamentHistoryEntry[];
    team_3v3: TournamentHistoryEntry[];
  };
}

interface BattleParticipantStats {
  robotId: number;
  robotName: string;
  team: number;
  damageDealt: number;
  damageReceived: number;
  finalHP: number;
  criticalHits: number;
}

interface BattleDetail {
  id: number;
  battleType: string;
  participants: BattleParticipantStats[];
}

// ─── Helper Components ───────────────────────────────────────────────────────

function TypeBadge({ participantType }: { participantType: string }): React.ReactElement {
  const labels: Record<string, string> = {
    robot: '1v1',
    team_2v2: '2v2',
    team_3v3: '3v3',
  };
  const colors: Record<string, string> = {
    robot: 'bg-blue-900/50 text-blue-300',
    team_2v2: 'bg-green-900/50 text-green-300',
    team_3v3: 'bg-purple-900/50 text-purple-300',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[participantType] || 'bg-surface-elevated text-secondary'}`}>
      {labels[participantType] || participantType}
    </span>
  );
}

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const colors: Record<string, string> = {
    active: 'bg-green-900/50 text-green-300',
    completed: 'bg-gray-700/50 text-gray-300',
    pending: 'bg-yellow-900/50 text-yellow-300',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-surface-elevated text-secondary'}`}>
      {status}
    </span>
  );
}


function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Bracket Rendering ───────────────────────────────────────────────────────

function BracketNode({
  participantId,
  participants,
  isWinner,
  participantType,
}: {
  participantId: number | null;
  participants: Record<number, ResolvedParticipant>;
  isWinner: boolean;
  participantType: string;
}): React.ReactElement {
  if (!participantId) {
    return <span className="text-tertiary italic text-xs">BYE</span>;
  }

  const participant = participants[participantId];
  if (!participant) {
    return <span className="text-secondary text-xs">#{participantId}</span>;
  }

  const isTeam = participantType === 'team_2v2' || participantType === 'team_3v3';

  return (
    <div className={`flex flex-col ${isWinner ? 'text-green-300' : 'text-white'}`}>
      <span className="text-sm font-medium truncate max-w-[180px]">
        {isWinner && <span className="mr-1">🏆</span>}
        {participant.displayName}
      </span>
      {isTeam && participant.members && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {participant.members.map((m) => (
            <span key={m.robotId} className="text-xs text-tertiary">
              {m.robotName}
            </span>
          ))}
        </div>
      )}
      <span className="text-xs text-tertiary">
        ELO: {participant.elo} • {participant.leagueTier}
      </span>
    </div>
  );
}

function TournamentBracketView({
  tournament,
  participants,
}: {
  tournament: Tournament;
  participants: Record<number, ResolvedParticipant>;
}): React.ReactElement {
  // Group matches by round
  const matchesByRound: Record<number, TournamentMatch[]> = {};
  for (const match of tournament.matches) {
    if (!matchesByRound[match.round]) matchesByRound[match.round] = [];
    matchesByRound[match.round].push(match);
  }

  const rounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b);

  if (rounds.length === 0) {
    return <p className="text-secondary text-sm">No bracket data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 min-w-max py-4">
        {rounds.map((round) => (
          <div key={round} className="flex flex-col gap-3 min-w-[220px]">
            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
              Round {round}{round === tournament.maxRounds ? ' (Final)' : ''}
            </h4>
            {matchesByRound[round]
              .sort((a, b) => a.matchNumber - b.matchNumber)
              .map((match) => (
                <div
                  key={match.id}
                  className="bg-surface-elevated rounded-lg p-3 border border-white/5"
                >
                  <div className="flex flex-col gap-2">
                    <BracketNode
                      participantId={match.participant1Id}
                      participants={participants}
                      isWinner={match.winnerId === match.participant1Id && match.winnerId !== null}
                      participantType={tournament.participantType}
                    />
                    <div className="border-t border-white/10 my-1" />
                    <BracketNode
                      participantId={match.participant2Id}
                      participants={participants}
                      isWinner={match.winnerId === match.participant2Id && match.winnerId !== null}
                      participantType={tournament.participantType}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusBadge status={match.status} />
                    {match.isByeMatch && (
                      <span className="text-xs text-tertiary">bye</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Per-Robot Combat Stats ──────────────────────────────────────────────────

function TeamCombatStats({ battle }: { battle: BattleDetail }): React.ReactElement {
  const team1 = battle.participants.filter((p) => p.team === 1);
  const team2 = battle.participants.filter((p) => p.team === 2);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TeamStatsGroup label="Team 1" participants={team1} />
      <TeamStatsGroup label="Team 2" participants={team2} />
    </div>
  );
}

function TeamStatsGroup({
  label,
  participants,
}: {
  label: string;
  participants: BattleParticipantStats[];
}): React.ReactElement {
  return (
    <div className="bg-surface-elevated rounded-lg p-3">
      <h5 className="text-sm font-semibold text-secondary mb-2">{label}</h5>
      <div className="space-y-2">
        {participants.map((p) => (
          <div key={p.robotId} className="flex items-center justify-between text-xs">
            <span className="text-white font-medium truncate max-w-[120px]">{p.robotName}</span>
            <div className="flex gap-3 text-tertiary">
              <span title="Damage Dealt">⚔️ {p.damageDealt}</span>
              <span title="Damage Received">🛡️ {p.damageReceived}</span>
              <span title="HP Remaining">❤️ {p.finalHP}</span>
              <span title="Critical Hits">💥 {p.criticalHits}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tournament History Table ────────────────────────────────────────────────

function TournamentHistoryTable({
  entries,
  typeLabel,
}: {
  entries: TournamentHistoryEntry[];
  typeLabel: string;
}): React.ReactElement {
  if (entries.length === 0) {
    return (
      <p className="text-secondary text-sm py-2">No {typeLabel} tournaments yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-elevated">
          <tr>
            <th className="p-2 text-left text-secondary">Name</th>
            <th className="p-2 text-left text-secondary">Status</th>
            <th className="p-2 text-left text-secondary">Participants</th>
            <th className="p-2 text-left text-secondary">Rounds</th>
            <th className="p-2 text-left text-secondary">Created</th>
            <th className="p-2 text-left text-secondary">Completed</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-t border-white/5 hover:bg-white/5">
              <td className="p-2 text-white">{entry.name}</td>
              <td className="p-2"><StatusBadge status={entry.status} /></td>
              <td className="p-2 text-secondary">{entry.totalParticipants}</td>
              <td className="p-2 text-secondary">{entry.currentRound}/{entry.maxRounds}</td>
              <td className="p-2 text-secondary text-xs">{formatDate(entry.createdAt)}</td>
              <td className="p-2 text-secondary text-xs">{formatDate(entry.completedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ─── Main Page Component ─────────────────────────────────────────────────────

function TournamentsPage(): React.ReactElement {
  // Filter and pagination state
  const [typeFilter, setTypeFilter] = useState<ParticipantTypeFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Tournament list state
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [pagination, setPagination] = useState<TournamentListResponse['pagination'] | null>(null);

  // Detail view state
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [resolvedParticipants, setResolvedParticipants] = useState<Record<number, ResolvedParticipant>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  // Battle detail state (for per-robot stats)
  const [selectedBattle, setSelectedBattle] = useState<BattleDetail | null>(null);
  const [battleLoading, setBattleLoading] = useState(false);

  // History state
  const [history, setHistory] = useState<TournamentHistoryResponse['history'] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'list' | 'history'>('list');

  // Refs for stable callbacks
  const filterRef = useRef(typeFilter);
  filterRef.current = typeFilter;

  /* ---------- Data fetching ---------- */

  const fetchTournaments = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (filterRef.current !== 'all') params.participantType = filterRef.current;

      const response = await api.get<TournamentListResponse>('/api/admin/tournaments', { params });
      setTournaments(response.tournaments);
      setPagination(response.pagination);
      setCurrentPage(page);
    } catch {
      // Error handled by empty state
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTournamentDetail = async (tournamentId: number) => {
    setDetailLoading(true);
    setSelectedBattle(null);
    try {
      const response = await api.get<TournamentDetailResponse>(`/api/admin/tournaments/${tournamentId}`);
      setSelectedTournament(response.tournament);
      setResolvedParticipants(response.resolvedParticipants);
    } catch {
      setSelectedTournament(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchBattleDetail = async (battleId: number) => {
    setBattleLoading(true);
    try {
      const response = await api.get<BattleDetail>(`/api/admin/battles/${battleId}`);
      setSelectedBattle(response);
    } catch {
      setSelectedBattle(null);
    } finally {
      setBattleLoading(false);
    }
  };

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await api.get<TournamentHistoryResponse>('/api/admin/tournaments/history');
      setHistory(response.history);
    } catch {
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTournaments(1);
  }, [fetchTournaments]);

  useEffect(() => {
    if (activeTab === 'history' && !history) {
      fetchHistory();
    }
  }, [activeTab, history, fetchHistory]);

  /* ---------- Handlers ---------- */

  const handleFilterToggle = (key: string) => {
    const validFilters: ParticipantTypeFilter[] = ['all', 'robot', 'team_2v2', 'team_3v3'];
    if (!validFilters.includes(key as ParticipantTypeFilter)) return;
    setTypeFilter(key as ParticipantTypeFilter);
    filterRef.current = key as ParticipantTypeFilter;
    setSelectedTournament(null);
    fetchTournaments(1);
  };

  const handlePageChange = (page: number) => {
    fetchTournaments(page);
  };

  /* ---------- Computed values ---------- */

  const totalTournaments = pagination?.totalCount ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  /* ---------- Render ---------- */

  return (
    <div data-testid="admin-tournaments-page" className="space-y-6">
      <AdminPageHeader
        title="Tournament Management"
        subtitle="View and manage all tournament types (1v1, 2v2, 3v3)"
        actions={
          <button
            type="button"
            onClick={() => fetchTournaments(currentPage)}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors"
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        }
      />

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 text-sm font-medium rounded-t transition-colors min-h-[44px] ${
            activeTab === 'list'
              ? 'bg-surface-elevated text-white border-b-2 border-primary'
              : 'text-secondary hover:text-white'
          }`}
        >
          Tournaments
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium rounded-t transition-colors min-h-[44px] ${
            activeTab === 'history'
              ? 'bg-surface-elevated text-white border-b-2 border-primary'
              : 'text-secondary hover:text-white'
          }`}
        >
          History
        </button>
      </div>

      {activeTab === 'list' && (
        <>
          {/* Type Filter */}
          <AdminFilterBar
            filters={[
              { key: 'all', label: 'All Types', active: typeFilter === 'all' },
              { key: 'robot', label: '1v1', active: typeFilter === 'robot' },
              { key: 'team_2v2', label: '2v2', active: typeFilter === 'team_2v2' },
              { key: 'team_3v3', label: '3v3', active: typeFilter === 'team_3v3' },
            ]}
            onFilterToggle={handleFilterToggle}
          />

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AdminStatCard label="Total" value={totalTournaments} color="primary" icon={<span>🏆</span>} />
            <AdminStatCard label="Page" value={`${currentPage}/${totalPages}`} color="info" icon={<span>📄</span>} />
            <AdminStatCard label="Showing" value={tournaments.length} color="info" />
            <AdminStatCard
              label="Filter"
              value={typeFilter === 'all' ? 'All Types' : typeFilter === 'robot' ? '1v1' : typeFilter === 'team_2v2' ? '2v2' : '3v3'}
              color="success"
            />
          </div>

          {/* Tournament List + Detail Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Tournament List */}
            <div className="space-y-3">
              {loading && tournaments.length === 0 ? (
                <p className="text-secondary text-sm py-8 text-center">Loading tournaments...</p>
              ) : tournaments.length === 0 ? (
                <p className="text-secondary text-sm py-8 text-center">No tournaments found.</p>
              ) : (
                tournaments.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => fetchTournamentDetail(t.id)}
                    className={`w-full text-left bg-surface rounded-lg p-4 border transition-colors min-h-[44px] ${
                      selectedTournament?.id === t.id
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium text-sm truncate max-w-[200px]">
                        {t.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <TypeBadge participantType={t.participantType} />
                        <StatusBadge status={t.status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-tertiary">
                      <span>{t.totalParticipants} participants</span>
                      <span>Round {t.currentRound}/{t.maxRounds}</span>
                      <span>{formatDate(t.createdAt)}</span>
                    </div>
                  </button>
                ))
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded disabled:opacity-50 min-h-[44px] min-w-[44px]"
                  >
                    ← Prev
                  </button>
                  <span className="text-sm text-secondary">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded disabled:opacity-50 min-h-[44px] min-w-[44px]"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>

            {/* Right: Tournament Detail */}
            <div className="bg-surface rounded-lg p-4 border border-white/5 min-h-[300px]">
              {detailLoading ? (
                <p className="text-secondary text-sm py-8 text-center">Loading tournament details...</p>
              ) : selectedTournament ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{selectedTournament.name}</h3>
                    <div className="flex items-center gap-2">
                      <TypeBadge participantType={selectedTournament.participantType} />
                      <StatusBadge status={selectedTournament.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-tertiary">Participants:</span>{' '}
                      <span className="text-white">{selectedTournament.totalParticipants}</span>
                    </div>
                    <div>
                      <span className="text-tertiary">Round:</span>{' '}
                      <span className="text-white">{selectedTournament.currentRound}/{selectedTournament.maxRounds}</span>
                    </div>
                    <div>
                      <span className="text-tertiary">Created:</span>{' '}
                      <span className="text-white text-xs">{formatDate(selectedTournament.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-tertiary">Completed:</span>{' '}
                      <span className="text-white text-xs">{formatDate(selectedTournament.completedAt)}</span>
                    </div>
                  </div>

                  {/* Bracket View */}
                  <div>
                    <h4 className="text-sm font-semibold text-secondary mb-2">Bracket</h4>
                    <TournamentBracketView
                      tournament={selectedTournament}
                      participants={resolvedParticipants}
                    />
                  </div>

                  {/* Match list with battle detail links */}
                  {selectedTournament.participantType !== 'robot' && (
                    <div>
                      <h4 className="text-sm font-semibold text-secondary mb-2">Match Results (Per-Robot Stats)</h4>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {selectedTournament.matches
                          .filter((m) => m.status === 'completed' && m.battleId)
                          .map((match) => (
                            <button
                              key={match.id}
                              type="button"
                              onClick={() => match.battleId && fetchBattleDetail(match.battleId)}
                              className={`w-full text-left bg-surface-elevated rounded p-2 text-xs border transition-colors min-h-[44px] ${
                                selectedBattle?.id === match.battleId
                                  ? 'border-primary/50'
                                  : 'border-white/5 hover:border-white/20'
                              }`}
                            >
                              <span className="text-secondary">
                                R{match.round} M{match.matchNumber}
                              </span>
                              {' — '}
                              <span className="text-white">
                                {resolvedParticipants[match.participant1Id!]?.displayName || `#${match.participant1Id}`}
                              </span>
                              {' vs '}
                              <span className="text-white">
                                {resolvedParticipants[match.participant2Id!]?.displayName || `#${match.participant2Id}`}
                              </span>
                            </button>
                          ))}
                      </div>

                      {/* Battle detail panel */}
                      {battleLoading && (
                        <p className="text-secondary text-xs mt-2">Loading battle stats...</p>
                      )}
                      {selectedBattle && !battleLoading && (
                        <div className="mt-3">
                          <TeamCombatStats battle={selectedBattle} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-secondary text-sm">Select a tournament to view details</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          {historyLoading ? (
            <p className="text-secondary text-sm py-8 text-center">Loading history...</p>
          ) : history ? (
            <>
              <div className="bg-surface rounded-lg p-4 border border-white/5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <TypeBadge participantType="robot" /> 1v1 Tournaments
                  <span className="text-xs text-tertiary ml-2">({history.robot.length} most recent)</span>
                </h3>
                <TournamentHistoryTable entries={history.robot} typeLabel="1v1" />
              </div>

              <div className="bg-surface rounded-lg p-4 border border-white/5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <TypeBadge participantType="team_2v2" /> 2v2 Tournaments
                  <span className="text-xs text-tertiary ml-2">({history.team_2v2.length} most recent)</span>
                </h3>
                <TournamentHistoryTable entries={history.team_2v2} typeLabel="2v2" />
              </div>

              <div className="bg-surface rounded-lg p-4 border border-white/5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <TypeBadge participantType="team_3v3" /> 3v3 Tournaments
                  <span className="text-xs text-tertiary ml-2">({history.team_3v3.length} most recent)</span>
                </h3>
                <TournamentHistoryTable entries={history.team_3v3} typeLabel="3v3" />
              </div>
            </>
          ) : (
            <p className="text-secondary text-sm py-8 text-center">Failed to load history.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default TournamentsPage;
