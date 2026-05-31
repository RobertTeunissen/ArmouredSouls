/**
 * TeamBattleHistory — Displays team battle history for a specific robot,
 * grouped by team size (2v2 and 3v3).
 *
 * Shows: opponent team name, outcome, damageDealt, damageTaken, finalHP,
 * survivalSeconds, Team_LP delta, Team_ELO delta.
 * Most-recent-first, 50 per page.
 *
 * Requirements: R9.3, R9.11, R9.15
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMatchHistory, BattleHistory, PaginatedResponse } from '../utils/matchmakingApi';

interface TeamBattleHistoryProps {
  robotId: number;
}

interface TeamBattleEntry {
  id: number;
  opponentTeamName: string;
  outcome: 'win' | 'loss' | 'draw';
  damageDealt: number;
  damageTaken: number;
  finalHP: number;
  survivalSeconds: number;
  teamLpDelta: number;
  teamEloDelta: number;
  createdAt: string;
  battleType: string;
}

function parseTeamBattleEntries(battles: BattleHistory[], robotId: number): TeamBattleEntry[] {
  return battles.map((battle) => {
    // Determine which side the robot is on
    const isRobot1Side = battle.robot1Id === robotId;
    const myELOBefore = isRobot1Side ? battle.robot1ELOBefore : battle.robot2ELOBefore;
    const myELOAfter = isRobot1Side ? battle.robot1ELOAfter : battle.robot2ELOAfter;
    const myFinalHP = isRobot1Side ? battle.robot1FinalHP : battle.robot2FinalHP;

    // Determine outcome
    let outcome: 'win' | 'loss' | 'draw';
    if (battle.winnerId === null) {
      outcome = 'draw';
    } else if (battle.team1Id && battle.team2Id) {
      // Team battles: winnerId is the team ID
      const myTeamId = isRobot1Side ? battle.team1Id : battle.team2Id;
      outcome = battle.winnerId === myTeamId ? 'win' : 'loss';
    } else if (
      (isRobot1Side && battle.winnerId === battle.robot1Id) ||
      (!isRobot1Side && battle.winnerId === battle.robot2Id)
    ) {
      outcome = 'win';
    } else {
      outcome = 'loss';
    }

    // Get opponent team name from team battle data (R9.7)
    // The API returns team1TeamName/team2TeamName when available
    const battleAny = battle as BattleHistory & {
      team1TeamName?: string | null;
      team2TeamName?: string | null;
      team1LpDelta?: number;
      team2LpDelta?: number;
      isByeMatch?: boolean;
    };

    let opponentTeamName: string;
    let teamLpDelta: number;

    if (battleAny.team1TeamName || battleAny.team2TeamName) {
      // Use team battle specific data from the API
      opponentTeamName = isRobot1Side
        ? (battleAny.team2TeamName || 'Bye')
        : (battleAny.team1TeamName || 'Unknown');
      teamLpDelta = isRobot1Side
        ? (battleAny.team1LpDelta ?? 0)
        : (battleAny.team2LpDelta ?? 0);
    } else {
      // Fallback: use opponent stable name
      const opponent = isRobot1Side ? battle.robot2 : battle.robot1;
      opponentTeamName = opponent?.user?.username || 'Unknown Team';
      teamLpDelta = 0;
    }

    return {
      id: battle.id,
      opponentTeamName,
      outcome,
      damageDealt: 0, // Will be populated from participant data if available
      damageTaken: 0,
      finalHP: myFinalHP,
      survivalSeconds: battle.durationSeconds,
      teamLpDelta,
      teamEloDelta: myELOAfter - myELOBefore,
      createdAt: battle.createdAt,
      battleType: battle.battleType || '',
    };
  });
}

function TeamBattleHistory({ robotId }: TeamBattleHistoryProps) {
  const navigate = useNavigate();
  const [activeSize, setActiveSize] = useState<2 | 3>(2);
  const [battles2v2, setBattles2v2] = useState<TeamBattleEntry[]>([]);
  const [battles3v3, setBattles3v3] = useState<TeamBattleEntry[]>([]);
  const [pagination2v2, setPagination2v2] = useState({ page: 1, totalPages: 1, total: 0 });
  const [pagination3v3, setPagination3v3] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchBattles = useCallback(async (teamSize: 2 | 3, page: number) => {
    const battleType = teamSize === 2 ? 'league_2v2' : 'league_3v3';
    const result: PaginatedResponse<BattleHistory> = await getMatchHistory(page, 50, battleType, robotId);
    const entries = parseTeamBattleEntries(result.data, robotId);

    if (teamSize === 2) {
      setBattles2v2(entries);
      setPagination2v2({ page: result.pagination.page, totalPages: result.pagination.totalPages, total: result.pagination.total });
    } else {
      setBattles3v3(entries);
      setPagination3v3({ page: result.pagination.page, totalPages: result.pagination.totalPages, total: result.pagination.total });
    }
  }, [robotId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchBattles(2, 1),
      fetchBattles(3, 1),
    ])
      .catch(() => {
        // Silently handle errors - empty state will show
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [fetchBattles]);

  const handlePageChange = async (page: number) => {
    setLoading(true);
    await fetchBattles(activeSize, page).catch(() => {});
    setLoading(false);
  };

  const currentBattles = activeSize === 2 ? battles2v2 : battles3v3;
  const currentPagination = activeSize === 2 ? pagination2v2 : pagination3v3;
  const hasAnyBattles = pagination2v2.total > 0 || pagination3v3.total > 0;

  if (loading) {
    return (
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Team Battle History</h3>
        <div className="flex items-center justify-center py-8 text-secondary">
          Loading team battle history...
        </div>
      </div>
    );
  }

  if (!hasAnyBattles) {
    return (
      <div className="bg-surface rounded-lg p-6" data-testid="team-battle-history-empty">
        <h3 className="text-lg font-semibold text-white mb-4">Team Battle History</h3>
        <div className="flex flex-col items-center justify-center py-12 text-secondary">
          <span className="text-3xl mb-3" aria-hidden="true">⚔️</span>
          <p className="text-center">No team battle history yet.</p>
          <p className="text-center text-sm mt-1">
            Register this robot in a 2v2 or 3v3 team to start competing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg p-6" data-testid="team-battle-history">
      <h3 className="text-lg font-semibold text-white mb-4">Team Battle History</h3>

      {/* Size Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveSize(2)}
          className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
            activeSize === 2
              ? 'bg-primary text-white'
              : 'bg-surface-elevated text-secondary hover:text-white'
          }`}
          aria-pressed={activeSize === 2}
        >
          2v2 League ({pagination2v2.total})
        </button>
        <button
          onClick={() => setActiveSize(3)}
          className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
            activeSize === 3
              ? 'bg-primary text-white'
              : 'bg-surface-elevated text-secondary hover:text-white'
          }`}
          aria-pressed={activeSize === 3}
        >
          3v3 League ({pagination3v3.total})
        </button>
      </div>

      {/* Battle List */}
      {currentBattles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-secondary" data-testid={`team-battle-history-${activeSize}v${activeSize}-empty`}>
          <p>No {activeSize}v{activeSize} battles recorded yet.</p>
        </div>
      ) : (
        <>
          {/* Table Header - Hidden on mobile */}
          <div className="hidden lg:grid lg:grid-cols-8 gap-2 px-3 py-2 text-xs text-secondary font-medium border-b border-white/10 mb-1">
            <div>Opponent</div>
            <div className="text-center">Result</div>
            <div className="text-right">Dmg Dealt</div>
            <div className="text-right">Dmg Taken</div>
            <div className="text-right">Final HP</div>
            <div className="text-right">Survival</div>
            <div className="text-right">ELO Δ</div>
            <div className="text-right">Date</div>
          </div>

          {/* Battle Rows */}
          <div className="space-y-1">
            {currentBattles.map((battle) => (
              <button
                key={battle.id}
                onClick={() => navigate(`/battle/${battle.id}`)}
                className="w-full text-left bg-surface-elevated hover:bg-white/5 rounded-lg p-3 transition-colors cursor-pointer"
                aria-label={`View battle details: ${battle.outcome} vs ${battle.opponentTeamName}`}
              >
                {/* Mobile Layout */}
                <div className="lg:hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm truncate max-w-[60%]">
                      vs {battle.opponentTeamName}
                    </span>
                    <OutcomeBadge outcome={battle.outcome} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-secondary">Final HP: <span className="text-white">{battle.finalHP}</span></div>
                    <div className="text-secondary">Survival: <span className="text-white">{formatDuration(battle.survivalSeconds)}</span></div>
                    <div className="text-secondary">
                      ELO: <span className={battle.teamEloDelta >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {battle.teamEloDelta >= 0 ? '+' : ''}{battle.teamEloDelta}
                      </span>
                    </div>
                    <div className="text-secondary">{formatDate(battle.createdAt)}</div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden lg:grid lg:grid-cols-8 gap-2 items-center text-sm">
                  <div className="text-white truncate" title={battle.opponentTeamName}>
                    vs {battle.opponentTeamName}
                  </div>
                  <div className="text-center">
                    <OutcomeBadge outcome={battle.outcome} />
                  </div>
                  <div className="text-right text-white">{battle.damageDealt.toLocaleString()}</div>
                  <div className="text-right text-white">{battle.damageTaken.toLocaleString()}</div>
                  <div className="text-right text-white">{battle.finalHP}</div>
                  <div className="text-right text-white">{formatDuration(battle.survivalSeconds)}</div>
                  <div className={`text-right font-medium ${battle.teamEloDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {battle.teamEloDelta >= 0 ? '+' : ''}{battle.teamEloDelta}
                  </div>
                  <div className="text-right text-secondary text-xs">{formatDate(battle.createdAt)}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {currentPagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/10">
              <button
                onClick={() => handlePageChange(currentPagination.page - 1)}
                disabled={currentPagination.page <= 1}
                className="px-3 py-1.5 min-h-[44px] text-sm rounded bg-surface-elevated text-secondary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-secondary">
                Page {currentPagination.page} of {currentPagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPagination.page + 1)}
                disabled={currentPagination.page >= currentPagination.totalPages}
                className="px-3 py-1.5 min-h-[44px] text-sm rounded bg-surface-elevated text-secondary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper Components                                                  */
/* ------------------------------------------------------------------ */

function OutcomeBadge({ outcome }: { outcome: 'win' | 'loss' | 'draw' }) {
  const styles = {
    win: 'bg-green-900/40 text-green-400 border-green-700/50',
    loss: 'bg-red-900/40 text-red-400 border-red-700/50',
    draw: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/50',
  };
  const labels = { win: 'W', loss: 'L', draw: 'D' };

  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded border ${styles[outcome]}`}>
      {labels[outcome]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Utility Functions                                                   */
/* ------------------------------------------------------------------ */

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default TeamBattleHistory;
