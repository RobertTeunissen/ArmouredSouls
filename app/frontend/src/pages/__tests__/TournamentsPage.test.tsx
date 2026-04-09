import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TournamentsPage from '../TournamentsPage';

// Mock dependencies
vi.mock('../../utils/tournamentApi', () => ({
  listTournaments: vi.fn(),
}));

vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

vi.mock('../../utils/bracketUtils', () => ({
  getRoundLabel: (current: number, max: number) => `Round ${current} of ${max}`,
}));

const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser' },
    logout: mockLogout,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { listTournaments } from '../../utils/tournamentApi';

const mockedListTournaments = vi.mocked(listTournaments);

const mockTournaments = [
  {
    id: 1,
    name: 'Grand Arena Championship',
    tournamentType: 'single_elimination',
    status: 'active' as const,
    currentRound: 3,
    maxRounds: 7,
    totalParticipants: 128,
    winnerId: null,
    startedAt: '2026-02-01T00:00:00Z',
    completedAt: null,
    createdAt: '2026-01-30T00:00:00Z',
  },
  {
    id: 2,
    name: 'Rookie Rumble',
    tournamentType: 'single_elimination',
    status: 'completed' as const,
    currentRound: 5,
    maxRounds: 5,
    totalParticipants: 32,
    winnerId: 10,
    startedAt: '2026-01-15T00:00:00Z',
    completedAt: '2026-01-20T00:00:00Z',
    createdAt: '2026-01-14T00:00:00Z',
  },
];

describe('TournamentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue('test-token');
    mockedListTournaments.mockResolvedValue({ tournaments: mockTournaments });
  });

  const renderPage = () => render(<BrowserRouter><TournamentsPage /></BrowserRouter>);

  it('should display tournament list after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Grand Arena Championship')).toBeInTheDocument();
      expect(screen.getByText('Rookie Rumble')).toBeInTheDocument();
    });
  });

  it('should call listTournaments on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockedListTournaments).toHaveBeenCalled();
    });
  });

  it('should display error when tournament fetch fails', async () => {
    mockedListTournaments.mockRejectedValue({ response: { status: 500 } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load tournaments/)).toBeInTheDocument();
    });
  });
});
