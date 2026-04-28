/**
 * Unit Tests for PlayersPage
 *
 * Tests search across username/stable/robot, sub-view tabs switch, detail
 * panel opens in slide-over, password reset triggers API call, filter toggle.
 *
 * _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.8_
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PlayersPage from '../PlayersPage';

// ----------------------------------------------------------------
// Mock apiClient
// ----------------------------------------------------------------
const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

// ----------------------------------------------------------------
// Mock data
// ----------------------------------------------------------------
const mockSearchResults = {
  users: [
    { id: 1, username: 'testplayer', email: 'test@example.com', stableName: 'TestStable' },
    { id: 2, username: 'player2', email: 'p2@example.com', stableName: null },
  ],
};

const mockPlayerDetail = {
  id: 1,
  username: 'testplayer',
  email: 'test@example.com',
  stableName: 'TestStable',
  currency: 50000,
  role: 'user',
  createdAt: '2025-01-01T00:00:00Z',
  robots: [
    { id: 10, name: 'MyBot', elo: 1200, league: 'gold', wins: 10, losses: 5, draws: 2 },
  ],
  facilities: [
    { type: 'repair_bay', level: 3, passiveIncome: 150 },
  ],
};

const mockAtRiskResponse = {
  threshold: 10000,
  currentCycle: 50,
  totalAtRisk: 0,
  users: [],
  timestamp: '2025-01-01T00:00:00Z',
};

const mockRecentResponse = {
  currentCycle: 50,
  cyclesBack: 10,
  cutoffDate: null,
  totalUsers: 5,
  usersWithIssues: 1,
  users: [],
  timestamp: '2025-01-01T00:00:00Z',
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('PlayersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/admin/users/search')) {
        return Promise.resolve({ data: mockSearchResults });
      }
      if (typeof url === 'string' && url.includes('/api/admin/users/at-risk')) {
        return Promise.resolve({ data: mockAtRiskResponse });
      }
      if (typeof url === 'string' && url.includes('/api/admin/users/recent')) {
        return Promise.resolve({ data: mockRecentResponse });
      }
      if (typeof url === 'string' && url.includes('/api/admin/users/1')) {
        return Promise.resolve({ data: mockPlayerDetail });
      }
      return Promise.resolve({ data: {} });
    });
    mockPost.mockResolvedValue({ data: {} });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <PlayersPage />
      </MemoryRouter>,
    );

  it('should render the page header', () => {
    renderPage();
    expect(screen.getByText('Players')).toBeInTheDocument();
  });

  it('should render search input', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/Search by username/)).toBeInTheDocument();
  });

  it('should render sub-view tabs', () => {
    renderPage();
    expect(screen.getByText('👥 New Players')).toBeInTheDocument();
    expect(screen.getByText('⚠️ At-Risk')).toBeInTheDocument();
    expect(screen.getByText('🤖 Auto-Generated')).toBeInTheDocument();
  });

  it('should search for users and display results', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText(/Search by username/), 'test');
    await user.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('testplayer')).toBeInTheDocument();
      expect(screen.getByText('player2')).toBeInTheDocument();
    });
  });

  it('should open player detail slide-over when search result is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText(/Search by username/), 'test');
    await user.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('testplayer')).toBeInTheDocument();
    });

    await user.click(screen.getByText('testplayer'));

    await waitFor(() => {
      expect(screen.getByText('₡50,000')).toBeInTheDocument();
      expect(screen.getByText('MyBot')).toBeInTheDocument();
    });
  });

  it('should render churn risk filter', () => {
    renderPage();
    // The churn risk filter dropdown is present in the new-players tab
    expect(screen.getByText('Churn Risk')).toBeInTheDocument();
  });

  it('should switch to At-Risk sub-view', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('⚠️ At-Risk'));

    await waitFor(() => {
      expect(screen.getByText('No users at risk of bankruptcy')).toBeInTheDocument();
    });
  });

  it('should trigger password reset API call', async () => {
    const user = userEvent.setup();
    renderPage();

    // Search and open player detail
    await user.type(screen.getByPlaceholderText(/Search by username/), 'test');
    await user.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('testplayer')).toBeInTheDocument();
    });

    await user.click(screen.getByText('testplayer'));

    await waitFor(() => {
      expect(screen.getByText('🔑 Password Reset')).toBeInTheDocument();
    });

    // Fill in password fields
    const passwordInputs = screen.getAllByPlaceholderText(/password/i);
    await user.type(passwordInputs[0], 'NewPass123');
    await user.type(passwordInputs[1], 'NewPass123');

    await user.click(screen.getByText('Reset Password'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/admin/users/1/reset-password', { password: 'NewPass123' });
    });
  });
});
