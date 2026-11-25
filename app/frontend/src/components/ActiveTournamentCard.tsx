/**
 * ActiveTournamentCard — Shows active tournament participation on the Dashboard.
 *
 * Shows per-robot/team status within each tournament:
 * - Active participants with their next opponent
 * - Eliminated participants
 * - Links to tournament detail page
 */

import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { getMyTeamBattles } from '../utils/teamBattleApi';
import { useAuth } from '../contexts/AuthContext';
import { useApiQuery } from '../hooks/useApiQuery';
import { createLogger } from '../utils/logger';

import {
  buildActiveTournaments,
  type ActiveTournamentInfo,
  type TournamentsResponse,
} from '../utils/activeTournaments';

const log = createLogger('ActiveTournamentCard');

async function loadActiveTournaments(): Promise<ActiveTournamentInfo[]> {
  const response = await api.get<TournamentsResponse>('/api/tournaments', { params: { status: 'active' } });
  const activeTournaments = response.tournaments || [];
  if (activeTournaments.length === 0) return [];

  const userRobots = await api.get<Array<{ id: number; name: string }>>('/api/robots');
  const hasTeamTournaments = activeTournaments.some(
    t => t.participantType === 'team_2v2' || t.participantType === 'team_3v3'
  );
  let userTeams: Array<{ id: number; teamName: string }> = [];
  if (hasTeamTournaments) {
    try {
      userTeams = await getMyTeamBattles();
    } catch (e) {
      log.warn('Failed to fetch user teams for tournament card', { e });
    }
  }
  return buildActiveTournaments(activeTournaments, userRobots, userTeams, response.participantNames ?? {});
}

function ActiveTournamentCard() {
  const { user } = useAuth();
  const query = useApiQuery(() => loadActiveTournaments(), [], { enabled: Boolean(user) });
  const tournaments = query.data ?? [];
  const loading = query.loading;
  const error = query.error ? 'Failed to load tournament status' : null;

  if (error) {
    return (
      <div className="bg-surface border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-error text-sm">{error}</span>
          <button
            onClick={query.refetch}
            className="text-primary text-sm hover:underline min-h-[44px] min-w-[44px] flex items-center"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || tournaments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {tournaments.map((tournament) => {
        const activeCount = tournament.participants.filter(p => p.status === 'active' || p.status === 'bye').length;
        const eliminatedCount = tournament.participants.filter(p => p.status === 'eliminated').length;

        return (
          <Link
            key={tournament.tournamentId}
            to={`/tournaments/${tournament.tournamentId}`}
            className="block bg-surface border border-white/10 rounded-lg p-4 hover:border-primary/50 transition-colors min-h-[44px]"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl" aria-hidden="true">🏆</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-white truncate">{tournament.tournamentName}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                    (tournament.participantType === 'tournament_1v1' || tournament.participantType === 'robot' as string)
                      ? 'bg-blue-400/20 text-blue-400'
                      : (tournament.participantType === 'tournament_2v2' || tournament.participantType === 'team_2v2' as string)
                      ? 'bg-emerald-400/20 text-emerald-400'
                      : 'bg-violet-400/20 text-violet-400'
                  }`}>
                    {(tournament.participantType === 'tournament_1v1' || tournament.participantType === 'robot' as string) ? '1v1' : (tournament.participantType === 'tournament_2v2' || tournament.participantType === 'team_2v2' as string) ? '2v2' : '3v3'}
                  </span>
                </div>
                <div className="text-sm text-secondary mt-1">
                  Round {tournament.currentRound} / {tournament.maxRounds}
                  {eliminatedCount > 0 && (
                    <span className="text-tertiary ml-2">
                      • {activeCount} active, {eliminatedCount} eliminated
                    </span>
                  )}
                </div>
              </div>
              <span className="text-primary text-sm flex-shrink-0">View →</span>
            </div>

            {/* Per-participant status */}
            <div className="space-y-1 mt-2">
              {tournament.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  {p.status === 'eliminated' ? (
                    <>
                      <span className="text-red-400">✗</span>
                      <span className="text-tertiary line-through">{p.name}</span>
                      <span className="text-tertiary italic">eliminated</span>
                    </>
                  ) : p.status === 'not_registered' ? (
                    <>
                      <span className="text-tertiary">—</span>
                      <span className="text-tertiary">{p.name}</span>
                      <span className="text-tertiary italic">not registered</span>
                    </>
                  ) : (
                    <>
                      <span className="text-green-400">⚔</span>
                      <span className="text-white">{p.name}</span>
                      <span className="text-tertiary">vs</span>
                      <span className="text-secondary">{p.nextOpponent ?? 'TBD'}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default ActiveTournamentCard;
