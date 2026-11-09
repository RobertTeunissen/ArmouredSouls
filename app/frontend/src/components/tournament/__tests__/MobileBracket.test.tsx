import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import MobileBracket from '../MobileBracket';
import type { TournamentMatchWithRobots } from '../../../utils/bracketUtils';

function match(id: number, round: number, matchNumber: number, p1: [number, string] | null, p2: [number, string] | null): TournamentMatchWithRobots {
  return {
    id, tournamentId: 1, round, matchNumber, participantType: 'robot',
    participant1Id: p1?.[0] ?? null, participant2Id: p2?.[0] ?? null,
    winnerId: null, battleId: null, status: 'pending', isByeMatch: false, completedAt: null,
    robot1: p1 ? { id: p1[0], name: p1[1], elo: 1200 } : null,
    robot2: p2 ? { id: p2[0], name: p2[1], elo: 1200 } : null,
    winner: null,
  };
}

// 8-robot bracket: rounds 1 (quarter-finals), 2 (semi-finals), 3 (finals).
const MATCHES = [
  match(1, 1, 1, [1, 'Mine'], [2, 'Bravo']),
  match(2, 1, 2, [3, 'Charlie'], [4, 'Delta']),
  match(3, 1, 3, [5, 'Echo'], [6, 'Foxtrot']),
  match(4, 1, 4, [7, 'Golf'], [8, 'Hotel']),
  match(5, 2, 1, null, null),
  match(6, 2, 2, null, null),
  match(7, 3, 1, null, null),
];

type Props = ComponentProps<typeof MobileBracket>;

function renderBracket(props: Partial<Props> = {}) {
  return render(
    <MemoryRouter>
      <MobileBracket
        matches={MATCHES}
        maxRounds={3}
        currentRound={1}
        status="active"
        seedMap={new Map()}
        userParticipantIds={new Set([1])}
        futurePathMatchIds={new Set([5, 7])}
        participantType="robot"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('MobileBracket', () => {
  it('opens on My Path for a participant: own matches plus the path ahead', () => {
    renderBracket();
    expect(screen.getByRole('button', { name: 'My Path' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Mine')).toBeInTheDocument();
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
    expect(screen.getByText('Quarter-finals')).toBeInTheDocument();
    expect(screen.getByText('Semi-finals')).toBeInTheDocument();
    expect(screen.getByText('Finals')).toBeInTheDocument();
  });

  it('points a spectator at the round list', () => {
    renderBracket({ userParticipantIds: new Set(), futurePathMatchIds: new Set() });
    expect(screen.getByRole('button', { name: 'Round List' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('says so when My Path has nothing to show', () => {
    renderBracket({ userParticipantIds: new Set([99]), futurePathMatchIds: new Set(), participantType: 'team' });
    expect(screen.getByText(/No matches found for your teams/)).toBeInTheDocument();
  });

  it('steps through rounds, collapses one, and jumps with the dots', () => {
    renderBracket();
    fireEvent.click(screen.getByRole('button', { name: 'Round List' }));

    expect(screen.getByRole('button', { name: 'Previous round' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
    expect(screen.queryByText('Mine')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Semi-finals' })).toHaveAttribute('aria-current', 'step');

    const roundToggle = screen.getByRole('button', { name: /Semi-finals/, expanded: true });
    fireEvent.click(roundToggle);
    expect(roundToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByText('TBD')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Go to Finals' }));
    expect(screen.getByRole('button', { name: 'Next round' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Go to Quarter-finals' }));
    expect(screen.getByText('Hotel')).toBeInTheDocument();
  });
});
