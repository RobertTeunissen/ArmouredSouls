/**
 * ActiveTournamentCard — Shows active tournament participation on the Dashboard.
 *
 * Shows per-robot/team status within each tournament:
 * - Active participants with their next opponent
 * - Eliminated participants
 * - Links to tournament detail page
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { getMyTeamBattles } from '../utils/teamBattleApi';
import { useAuth } from '../contexts/AuthContext';
import { createLogger } from '../utils/logger';

const log = createLogger('ActiveTournamentCard');

interface ParticipantStatus {
  id: number;
  name: string;
  status: 'active' | 'eliminated' | 'bye' | 'not_registered';
  nextOpponent?: string;
}

interface ActiveTournamentInfo {
  tournamentId: number;
  tournamentName: string;
  participantType: string;
  currentRound: number;
  maxRounds: number;
  participants: ParticipantStatus[];
  scheduledFor?: string;
}

interface TournamentDetailResponse {
  id: number;
  name: string;
  participantType: string;
  currentRound: number;
  maxRounds: number;
  status: string;
  matches: Array<{
    round: number;
    status: string;
    participant1Id: number | null;
    participant2Id: number | null;
    winnerId: number | null;
    isByeMatch: boolean;
  }>;
}

function ActiveTournamentCard() {
  const [tournaments, setTournaments] = useState<ActiveTournamentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchActiveTournaments = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch active tournaments
      const response = await api.get<{ success: boolean; tournaments: TournamentDetailResponse[]; participantNames?: Record<string, string> }>('/api/tournaments', { params: { status: 'active' } });
      const activeTournaments = response.tournaments || [];
      const participantNamesFromApi: Record<string, string> = response.participantNames ?? {};

      if (!activeTournaments || activeTournaments.length === 0) {
        setTournaments([]);
        return;
      }

      // Fetch user's robots
      const userRobots = await api.get<Array<{ id: number; name: string }>>('/api/robots');

      const userRobotIds = new Set(userRobots.map(r => r.id));
      const userRobotNames = new Map(userRobots.map(r => [r.id, r.name]));

      // Fetch user's teams (for team tournaments)
      const hasTeamTournaments = activeTournaments.some(
        t => t.participantType === 'team_2v2' || t.participantType === 'team_3v3'
      );
      let userTeamIds = new Set<number>();
      let userTeamNames = new Map<number, string>();
      if (hasTeamTournaments) {
        try {
          const userTeams = await getMyTeamBattles();
          userTeamIds = new Set(userTeams.map(t => t.id));
          userTeamNames = new Map(userTeams.map(t => [t.id, t.teamName]));
        } catch (e) {
          log.warn('Failed to fetch user teams for tournament card', { e });
        }
      }

      // Build participant name lookup maps per type to avoid ID collisions between robots and teams
      // For opponent name resolution, we need a type-aware approach
      const robotNamesMap = new Map<number, string>(userRobotNames);
      const teamNamesMap = new Map<number, string>(userTeamNames);

      // Add API-provided names to the correct type map
      for (const [key, name] of Object.entries(participantNamesFromApi)) {
        const parts = key.split(':');
        const type = parts[0]; // 'robot' or 'team'
        const id = Number(parts[1]);
        if (isNaN(id)) continue;
        if (type === 'robot' && !robotNamesMap.has(id)) {
          robotNamesMap.set(id, name);
        } else if (type === 'team' && !teamNamesMap.has(id)) {
          teamNamesMap.set(id, name);
        }
      }

      const result: ActiveTournamentInfo[] = [];

      for (const tournament of activeTournaments) {
        if (tournament.status !== 'active') continue;

        const participants: ParticipantStatus[] = [];
        const currentRoundMatches = tournament.matches.filter(m => m.round === tournament.currentRound);
        const allCompletedMatches = tournament.matches.filter(m => m.status === 'completed' || m.status === 'forfeit');

        // Find which of my robots/teams are in this tournament
        // Check ALL rounds (round 1 always has every participant listed)
        const allParticipantIds = new Set<number>();
        for (const match of tournament.matches) {
          if (match.participant1Id) allParticipantIds.add(match.participant1Id);
          if (match.participant2Id) allParticipantIds.add(match.participant2Id);
        }

        // Filter to my participants (robot IDs for robot tournaments, team IDs for team tournaments)
        const isTeamTournament = tournament.participantType === 'team_2v2' || tournament.participantType === 'team_3v3';
        const myOwnedIds = isTeamTournament ? userTeamIds : userRobotIds;
        const myNameMap = isTeamTournament ? teamNamesMap : robotNamesMap;
        const participantNamesForType = isTeamTournament ? teamNamesMap : robotNamesMap;
        const myParticipantIds = [...allParticipantIds].filter(id => myOwnedIds.has(id));

        // Only show this tournament if at least one of my robots/teams is registered
        if (myParticipantIds.length === 0) continue;

        // Determine eliminated participants (lost a match and didn't advance)
        const eliminatedIds = new Set<number>();
        for (const match of allCompletedMatches) {
          if (match.winnerId && match.participant1Id && match.participant2Id) {
            const loserId = match.winnerId === match.participant1Id ? match.participant2Id : match.participant1Id;
            eliminatedIds.add(loserId);
          }
        }

        const myParticipantIdSet = new Set(myParticipantIds);

        for (const participantId of myParticipantIds) {
          const name = myNameMap.get(participantId) ?? `#${participantId}`;

          if (eliminatedIds.has(participantId)) {
            participants.push({ id: participantId, name, status: 'eliminated' });
            continue;
          }

          // Find their current round match
          const currentMatch = currentRoundMatches.find(
            m => m.participant1Id === participantId || m.participant2Id === participantId
          );

          if (currentMatch) {
            const opponentId = currentMatch.participant1Id === participantId
              ? currentMatch.participant2Id
              : currentMatch.participant1Id;

            if (currentMatch.isByeMatch || !opponentId) {
              participants.push({ id: participantId, name, status: 'bye', nextOpponent: 'Bye' });
            } else {
              // Resolve opponent name
              const opponentName = participantNamesForType.get(opponentId) ?? (isTeamTournament ? `Team #${opponentId}` : `Robot #${opponentId}`);
              participants.push({ id: participantId, name, status: 'active', nextOpponent: opponentName });
            }
          } else {
            // Not yet assigned to a match in current round (waiting for previous round)
            participants.push({ id: participantId, name, status: 'active', nextOpponent: 'TBD' });
          }
        }

        // Show robots that are NOT registered in this tournament (for 1v1 robot tournaments)
        if (tournament.participantType === 'robot') {
          for (const [robotId, robotName] of userRobotNames) {
            if (!myParticipantIdSet.has(robotId)) {
              participants.push({ id: robotId, name: robotName, status: 'not_registered' });
            }
          }
        }

        if (participants.length > 0) {
          result.push({
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            participantType: tournament.participantType,
            currentRound: tournament.currentRound,
            maxRounds: tournament.maxRounds,
            participants,
          });
        }
      }

      setTournaments(result);
    } catch (err) {
      setError('Failed to load tournament status');
      log.error('Active tournament fetch error', { err });
    } finally {
      setLoading(false);
    }
  }, [user]);

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
