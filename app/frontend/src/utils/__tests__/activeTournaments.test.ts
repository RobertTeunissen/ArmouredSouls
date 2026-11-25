import { describe, it, expect } from 'vitest';
import { buildActiveTournaments, type TournamentDetailResponse } from '../activeTournaments';

const match = (round: number, p1: number | null, p2: number | null, extra: Partial<TournamentDetailResponse['matches'][number]> = {}) => ({
  round, status: 'scheduled', participant1Id: p1, participant2Id: p2, winnerId: null, isByeMatch: false, ...extra,
});

function soloTournament(matches: TournamentDetailResponse['matches'], currentRound = 2): TournamentDetailResponse {
  return { id: 5, name: 'Iron Cup', participantType: 'robot', currentRound, maxRounds: 3, status: 'active', matches };
}

describe('buildActiveTournaments', () => {
  const myRobots = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Bravo' }, { id: 3, name: 'Idle' }];

  it('reports next opponents, byes, eliminations and unregistered robots', () => {
    const tournament = soloTournament([
      match(1, 1, 10, { status: 'completed', winnerId: 1 }),
      match(1, 2, 11, { status: 'completed', winnerId: 11 }),
      match(2, 1, 12),
    ]);
    const [info] = buildActiveTournaments([tournament], myRobots, [], { 'robot:12': 'Crusher' });

    expect(info.tournamentName).toBe('Iron Cup');
    expect(info.participants).toEqual([
      { id: 1, name: 'Alpha', status: 'active', nextOpponent: 'Crusher' },
      { id: 2, name: 'Bravo', status: 'eliminated' },
      { id: 3, name: 'Idle', status: 'not_registered' },
    ]);
  });

  it('shows a bye and a not-yet-drawn match', () => {
    const tournament = soloTournament([match(1, 1, null, { isByeMatch: true }), match(1, 2, 11)], 1);
    const [info] = buildActiveTournaments([tournament], myRobots.slice(0, 2), [], {});
    expect(info.participants[0]).toMatchObject({ id: 1, status: 'bye', nextOpponent: 'Bye' });
    expect(info.participants[1]).toMatchObject({ id: 2, status: 'active', nextOpponent: 'Robot #11' });
  });

  it('skips tournaments without any of the user\'s entrants', () => {
    const tournament = soloTournament([match(1, 20, 21)], 1);
    expect(buildActiveTournaments([tournament], myRobots, [], {})).toEqual([]);
  });

  it('uses team ids and names for team tournaments', () => {
    const tournament: TournamentDetailResponse = {
      ...soloTournament([match(1, 7, 8)], 1),
      participantType: 'team_2v2',
    };
    const [info] = buildActiveTournaments([tournament], myRobots, [{ id: 7, teamName: 'Duo' }], { 'team:8': 'Rivals' });
    expect(info.participants).toEqual([{ id: 7, name: 'Duo', status: 'active', nextOpponent: 'Rivals' }]);
  });
});
