/**
 * T22 — MatchCard terminal states beyond `completed` (design §9.3).
 *
 * A `forfeit` row is decided like a completed one and badges the loser. A
 * `cancelled` row (an errored match, product-owner R1) advanced the higher
 * seed without a battle: it is styled with that seed as the winner and carries
 * a neutral badge.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import MatchCard from '../MatchCard';
import type { TournamentMatchWithRobots } from '../../../utils/bracketUtils';

afterEach(() => {
  cleanup();
});

function makeMatch(overrides: Partial<TournamentMatchWithRobots>): TournamentMatchWithRobots {
  return {
    id: 7,
    tournamentId: 1,
    round: 1,
    matchNumber: 1,
    participantType: 'robot',
    participant1Id: 10,
    participant2Id: 20,
    winnerId: null,
    battleId: null,
    status: 'pending',
    isByeMatch: false,
    completedAt: null,
    robot1: { id: 10, name: 'Alpha', elo: 1500 },
    robot2: { id: 20, name: 'Bravo', elo: 1400 },
    winner: null,
    ...overrides,
  };
}

function renderCard(match: TournamentMatchWithRobots) {
  render(
    <MemoryRouter>
      <MatchCard
        match={match}
        seedMap={new Map([[10, 1], [20, 2]])}
        userParticipantIds={new Set<number>()}
        isUserFuturePath={false}
      />
    </MemoryRouter>,
  );
  return screen.getByTestId(`match-card-${match.id}`);
}

describe('MatchCard forfeit state', () => {
  it('styles the winner and loser and badges the loser with FORFEIT', () => {
    const card = renderCard(makeMatch({ status: 'forfeit', winnerId: 10, battleId: 99 }));
    expect(within(card).getByText('Alpha')).toHaveClass('text-success');
    expect(within(card).getByText('Bravo')).toHaveClass('line-through');
    const badge = within(card).getByText('FORFEIT');
    // The badge sits on the loser's row.
    expect(badge.closest('div')).toHaveTextContent('Bravo');
    expect(badge.closest('div')).not.toHaveTextContent('Alpha');
  });
});

describe('MatchCard cancelled state', () => {
  it('styles the advanced higher seed as the winner and shows a CANCELLED badge', () => {
    const card = renderCard(makeMatch({ status: 'cancelled', winnerId: 10 }));
    expect(within(card).getByText('Alpha')).toHaveClass('text-success');
    expect(within(card).getByText('Bravo')).toHaveClass('line-through');
    expect(within(card).getByText('CANCELLED')).toBeInTheDocument();
    expect(within(card).queryByText('FORFEIT')).toBeNull();
  });

  it('has no battle link', () => {
    const card = renderCard(makeMatch({ status: 'cancelled', winnerId: 10 }));
    expect(within(card).queryByRole('link')).toBeNull();
  });

  it('shows no badge on an ordinary completed match', () => {
    const card = renderCard(makeMatch({ status: 'completed', winnerId: 20, battleId: 5 }));
    expect(within(card).queryByText('FORFEIT')).toBeNull();
    expect(within(card).queryByText('CANCELLED')).toBeNull();
    expect(within(card).getByText('Bravo')).toHaveClass('text-success');
  });
});
