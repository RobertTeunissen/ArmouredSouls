/**
 * ActiveTournamentCard — Shows active tournament participation on the Dashboard.
 *
 * Displays tournament name, current round, next opponent (if known from upcoming matches),
 * and scheduled execution time. Links to the tournament detail page.
 *
 * Requirements: R9.18, R9.19
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { createLogger } from '../utils/logger';

const log = createLogger('ActiveTournamentCard');

interface ActiveTournamentInfo {
  tournamentId: number;
  tournamentName: string;
  participantType: 'tournament_2v2' | 'tournament_3v3';
  currentRound: number;
  maxRounds: number;
  nextOpponentName?: string;
  scheduledFor?: string;
}

interface UpcomingMatchResponse {
  matches: Array<{
    matchType?: string;
    tournamentId?: number;
    tournamentName?: string;
    tournamentRound?: number;
    currentRound?: number;
    maxRounds?: number;
    scheduledFor: string;
    teamBattleTeam1?: { teamName: string; members: Array<{ userId: number }> };
    teamBattleTeam2?: { teamName: string; members: Array<{ userId: number }> } | null;
  }>;
}

function ActiveTournamentCard() {
  const [tournaments, setTournaments] = useState<ActiveTournamentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchActiveTournaments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the upcoming matches endpoint which already returns tournament matches
      const data = await api.get<UpcomingMatchResponse>('/api/matches/upcoming');

      // Filter for team tournament matches
      const tournamentMatches = data.matches.filter(
        (m) => m.matchType === 'tournament_2v2' || m.matchType === 'tournament_3v3'
      );

      // Deduplicate by tournamentId
      const seen = new Set<number>();
      const activeTournaments: ActiveTournamentInfo[] = [];

      for (const match of tournamentMatches) {
        if (!match.tournamentId || seen.has(match.tournamentId)) continue;
        seen.add(match.tournamentId);

        // Determine opponent name — figure out which team is ours first
        let nextOpponentName: string | undefined;
        const myUserId = user?.id;
        if (myUserId && match.teamBattleTeam1 && match.teamBattleTeam2) {
          const isMyTeam1 = match.teamBattleTeam1.members.some(m => m.userId === myUserId);
          nextOpponentName = isMyTeam1 ? match.teamBattleTeam2.teamName : match.teamBattleTeam1.teamName;
        } else if (match.teamBattleTeam2) {
          nextOpponentName = match.teamBattleTeam2.teamName;
        }

        activeTournaments.push({
          tournamentId: match.tournamentId,
          tournamentName: match.tournamentName || `Tournament #${match.tournamentId}`,
          participantType: match.matchType as 'tournament_2v2' | 'tournament_3v3',
          currentRound: match.currentRound || match.tournamentRound || 1,
          maxRounds: match.maxRounds || 1,
          nextOpponentName,
          scheduledFor: match.scheduledFor,
        });
      }

      setTournaments(activeTournaments);
    } catch (err) {
      setError('Failed to load tournament status');
      log.error('Active tournament fetch error', { err });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchActiveTournaments();
  }, [fetchActiveTournaments]);

  if (error) {
    return (
      <div className="bg-surface border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-error text-sm">{error}</span>
          <button
            onClick={fetchActiveTournaments}
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
      {tournaments.map((tournament) => (
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
                  tournament.participantType === 'tournament_2v2'
                    ? 'bg-emerald-400/20 text-emerald-400'
                    : 'bg-violet-400/20 text-violet-400'
                }`}>
                  {tournament.participantType === 'tournament_2v2' ? '2v2' : '3v3'}
                </span>
              </div>
              <div className="text-sm text-secondary mt-1">
                Round {tournament.currentRound} / {tournament.maxRounds}
              </div>
            </div>
            <span className="text-primary text-sm flex-shrink-0">View →</span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary">
            {tournament.nextOpponentName && (
              <div>
                <span className="text-tertiary">Next opponent: </span>
                <span className="text-white">{tournament.nextOpponentName}</span>
              </div>
            )}
            {!tournament.nextOpponentName && (
              <div>
                <span className="text-tertiary">Next opponent: </span>
                <span className="text-secondary italic">TBD</span>
              </div>
            )}
            {tournament.scheduledFor && (
              <div>
                <span className="text-tertiary">Scheduled: </span>
                <span className="text-white">
                  {tournament.participantType === 'tournament_2v2' ? '15:00 UTC' : '18:00 UTC'} daily
                </span>
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

export default ActiveTournamentCard;
