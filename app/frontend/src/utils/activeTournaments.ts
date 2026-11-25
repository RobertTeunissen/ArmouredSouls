/**
 * Dashboard tournament card: the status of the user's robots and teams in
 * every active tournament (next opponent, bye, eliminated, not registered).
 */

export interface ParticipantStatus {
  id: number;
  name: string;
  status: 'active' | 'eliminated' | 'bye' | 'not_registered';
  nextOpponent?: string;
}

export interface ActiveTournamentInfo {
  tournamentId: number;
  tournamentName: string;
  participantType: string;
  currentRound: number;
  maxRounds: number;
  participants: ParticipantStatus[];
  scheduledFor?: string;
}

export interface TournamentDetailResponse {
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

export interface TournamentsResponse {
  success: boolean;
  tournaments: TournamentDetailResponse[];
  participantNames?: Record<string, string>;
}

/** Status of each of the user's robots and teams in every active tournament they are in. */
export function buildActiveTournaments(
  activeTournaments: TournamentDetailResponse[],
  userRobots: Array<{ id: number; name: string }>,
  userTeams: Array<{ id: number; teamName: string }>,
  participantNamesFromApi: Record<string, string>,
): ActiveTournamentInfo[] {
  const userRobotIds = new Set(userRobots.map(r => r.id));
  const userRobotNames = new Map(userRobots.map(r => [r.id, r.name]));
  const userTeamIds = new Set(userTeams.map(t => t.id));
  const userTeamNames = new Map(userTeams.map(t => [t.id, t.teamName]));

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
    const allCompletedMatches = tournament.matches.filter(m => m.status === 'completed' || m.status === 'forfeit' || m.status === 'cancelled');

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

  return result;
}
