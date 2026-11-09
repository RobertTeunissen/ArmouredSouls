import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TournamentDetailPage from '../TournamentDetailPage';
import { ApiError } from '../../utils/ApiError';

vi.mock('../../utils/tournamentApi', () => ({
  getTournamentDetails: vi.fn(),
}));

vi.mock('../../components/tournament/BracketView', () => ({
  default: () => <div data-testid="bracket">Bracket</div>,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'testuser' } }),
}));

const mockFetchRobots = vi.fn();
vi.mock('../../stores', () => ({
  useRobotStore: (selector: (state: { robots: unknown[]; fetchRobots: () => void }) => unknown) =>
    selector({ robots: [], fetchRobots: mockFetchRobots }),
}));

import { getTournamentDetails } from '../../utils/tournamentApi';

const mockedGetTournamentDetails = vi.mocked(getTournamentDetails);

function renderPage(id = '12'): void {
  render(
    <MemoryRouter initialEntries={[`/tournaments/${id}`]}>
      <Routes>
        <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TournamentDetailPage loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Tournament not found" when the API answers 404', async () => {
    mockedGetTournamentDetails.mockRejectedValue(new ApiError('Tournament not found', 'NOT_FOUND', 404));

    renderPage();

    expect(await screen.findByText('Tournament not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Tournaments' })).toHaveAttribute('href', '/tournaments');
    expect(mockedGetTournamentDetails).toHaveBeenCalledWith(12, expect.any(AbortSignal));
  });

  it('shows a retryable error for other failures', async () => {
    mockedGetTournamentDetails.mockRejectedValue(new ApiError('Internal server error', 'INTERNAL_ERROR', 500));

    renderPage();

    expect(await screen.findByText('Failed to load tournament details')).toBeInTheDocument();
    expect(screen.queryByText('Tournament not found')).not.toBeInTheDocument();
  });

  it('loads the robot store for the participant highlight', async () => {
    mockedGetTournamentDetails.mockReturnValue(new Promise(() => {}));

    renderPage();

    await waitFor(() => expect(mockFetchRobots).toHaveBeenCalled());
  });
});
