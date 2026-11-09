import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import type { TournamentMatchWithRobots } from '../../../utils/bracketUtils';

const mockIsMobile = vi.fn(() => false);
vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsMobile: () => mockIsMobile(),
}));

import BracketView from '../BracketView';

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

const MATCHES = [
  match(1, 1, 1, [1, 'Mine'], [2, 'Bravo']),
  match(2, 1, 2, [3, 'Charlie'], [4, 'Delta']),
  match(3, 1, 3, [5, 'Echo'], [6, 'Foxtrot']),
  match(4, 1, 4, [7, 'Golf'], [8, 'Hotel']),
  match(5, 2, 1, null, null),
  match(6, 2, 2, null, null),
  match(7, 3, 1, null, null),
];

const SEEDINGS = [1, 2, 3, 4, 5, 6, 7, 8].map((robotId) => ({
  seed: robotId, robotId, robotName: MATCHES.flatMap((m) => [m.robot1, m.robot2]).find((r) => r?.id === robotId)!.name,
  elo: 1200, eliminated: false,
}));

type Props = ComponentProps<typeof BracketView>;

function renderBracket(props: Partial<Props> = {}) {
  return render(
    <MemoryRouter>
      <BracketView
        matches={MATCHES}
        seedings={SEEDINGS as Props['seedings']}
        maxRounds={3}
        currentRound={1}
        status="active"
        participantType="robot"
        userParticipantIds={new Set([1])}
        {...props}
      />
    </MemoryRouter>,
  );
}

const card = (id: number): HTMLElement => screen.getByTestId(`match-card-${id}`);

beforeEach(() => {
  mockIsMobile.mockReturnValue(false);
  Element.prototype.scrollIntoView = vi.fn();
});

describe('BracketView', () => {
  it('says so when the tournament has no matches yet', () => {
    renderBracket({ matches: [] });
    expect(screen.getByText('No matches available')).toBeInTheDocument();
  });

  it('draws every round on desktop with zoom controls', () => {
    renderBracket();
    expect(screen.getByTestId('desktop-bracket')).toBeInTheDocument();
    for (const label of ['Quarter-finals', 'Semi-finals', 'Finals']) expect(screen.getAllByText(label).length).toBeGreaterThan(0);

    expect(screen.getByText('100%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('limits the columns to the chosen round range', () => {
    renderBracket();
    fireEvent.change(screen.getByLabelText('From round'), { target: { value: '2' } });
    expect(screen.queryByTestId('match-card-1')).not.toBeInTheDocument();
    expect(card(5)).toBeInTheDocument();
    // "To" never offers a round before "From".
    expect(Array.from((screen.getByLabelText('To round') as HTMLSelectElement).options).map((o) => o.textContent))
      .toEqual(['Semi-finals', 'Finals']);
  });

  it('dims everything but the viewer\'s path and highlights their match', async () => {
    renderBracket();
    fireEvent.change(screen.getByLabelText('Highlight my robot'), { target: { value: '1' } });

    expect(card(2).className).toContain('opacity-25');
    expect(card(1).className).not.toContain('opacity-25');
    expect(card(5).className).not.toContain('opacity-25'); // the path ahead
    await waitFor(() => expect(card(1).className).toContain('ring-yellow-400'));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Highlight my robot'), { target: { value: '' } });
    expect(card(2).className).not.toContain('opacity-25');
  });

  it('jumps to a robot picked in the seeding list', async () => {
    renderBracket({ userParticipantIds: new Set() });
    expect(screen.queryByLabelText('Highlight my robot')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hotel/ }));
    await waitFor(() => expect(card(4).className).toContain('ring-yellow-400'));
  });

  it('switches to the mobile bracket without the round range filter', () => {
    mockIsMobile.mockReturnValue(true);
    renderBracket();
    expect(screen.queryByTestId('desktop-bracket')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('From round')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Path' })).toBeInTheDocument();
  });
});
