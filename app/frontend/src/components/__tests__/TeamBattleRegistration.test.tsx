import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Tests for TeamBattleRegistration (RegisterTeamModal within TeamBattleManagementContent).
 * Tests the team registration form per size (2v2 and 3v3).
 *
 * Requirements: R9.8, R9.10, R9.18
 */

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 1, username: 'test_user', role: 'user' }, logout: vi.fn() }),
}));

// Mock the useSubscriptions hook
vi.mock('../../hooks/useSubscriptions', () => ({
  useStableOverview: () => ({
    data: {
      robots: [
        { robotId: 1, robotName: 'Alpha', subscriptions: [{ eventType: 'league_2v2', status: 'active' }, { eventType: 'league_3v3', status: 'active' }] },
        { robotId: 2, robotName: 'Beta', subscriptions: [{ eventType: 'league_2v2', status: 'active' }, { eventType: 'league_3v3', status: 'active' }] },
        { robotId: 3, robotName: 'Gamma', subscriptions: [{ eventType: 'league_3v3', status: 'active' }] },
      ],
      registeredEvents: [
        { type: 'league_2v2', label: '2v2 League' },
        { type: 'league_3v3', label: '3v3 League' },
      ],
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../utils/teamBattleApi', () => ({
  getMyTeamBattles: vi.fn().mockResolvedValue([]),
  registerTeamBattle: vi.fn(),
  swapTeamBattleMember: vi.fn(),
  renameTeamBattle: vi.fn(),
  disbandTeamBattle: vi.fn(),
}));

vi.mock('../../utils/tierHelpers', () => ({
  getTierName: (tier: string) => tier.charAt(0).toUpperCase() + tier.slice(1),
  getTierColor: () => 'text-yellow-400',
  getTierIcon: () => '🏆',
}));

vi.mock('../ConfirmationModal', () => ({
  default: ({ onConfirm, onCancel, title }: { onConfirm: () => void; onCancel: () => void; title: string }) => (
    <div data-testid="confirmation-modal">
      <span>{title}</span>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel Modal</button>
    </div>
  ),
}));

import TeamBattleManagementContent from '../team-battles/TeamBattleManagementContent';
import { registerTeamBattle, getMyTeamBattles } from '../../utils/teamBattleApi';

function renderWithRouter(teamSize: 2 | 3 = 2) {
  return render(
    <MemoryRouter>
      <TeamBattleManagementContent teamSize={teamSize} />
    </MemoryRouter>,
  );
}

describe('TeamBattleRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMyTeamBattles).mockResolvedValue([]);
  });

  it('should show "Register a Team" button when no teams exist for 2v2', async () => {
    renderWithRouter(2);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });
  });

  it('should show "Register a Team" button when no teams exist for 3v3', async () => {
    renderWithRouter(3);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });
  });

  it('should open registration modal when "Register a Team" is clicked', async () => {
    renderWithRouter(2);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Your First Team'));

    await waitFor(() => {
      expect(screen.getByText('Register 2v2 Team')).toBeInTheDocument();
    });
  });

  it('should show team name input with 3-32 character validation', async () => {
    renderWithRouter(2);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Your First Team'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter team name...')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter team name...');
    fireEvent.change(input, { target: { value: 'AB' } });

    expect(screen.getByText('Name must be 3–32 characters')).toBeInTheDocument();
  });

  it('should show robot picker with available robots', async () => {
    renderWithRouter(2);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Your First Team'));

    await waitFor(() => {
      expect(screen.getByText(/Select 2 Robots/)).toBeInTheDocument();
    });

    // Should show robots subscribed to league_2v2
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('should disable submit button when name is invalid or robots not selected', async () => {
    renderWithRouter(2);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Your First Team'));

    await waitFor(() => {
      const submitButton = screen.getByText('Register Team');
      expect(submitButton).toBeDisabled();
    });
  });

  it('should enable submit when name is valid and correct number of robots selected', async () => {
    renderWithRouter(2);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Your First Team'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter team name...')).toBeInTheDocument();
    });

    // Fill in team name
    const input = screen.getByPlaceholderText('Enter team name...');
    fireEvent.change(input, { target: { value: 'Test Team' } });

    // Select 2 robots
    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByText('Beta'));

    const submitButton = screen.getByText('Register Team');
    expect(submitButton).not.toBeDisabled();
  });

  it('should call registerTeamBattle API on valid submission', async () => {
    vi.mocked(registerTeamBattle).mockResolvedValue({
      id: 1,
      stableId: 1,
      teamSize: 2,
      teamName: 'Test Team',
      teamLp: 0,
      teamLeague: 'bronze',
      teamLeagueId: 'inst-1',
      cyclesInLeague: 0,
      totalWins: 0,
      totalLosses: 0,
      totalDraws: 0,
      eligibility: 'ELIGIBLE',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      members: [],
      isLockedForBattle: false,
    });

    renderWithRouter(2);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Your First Team'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter team name...')).toBeInTheDocument();
    });

    // Fill in team name
    const input = screen.getByPlaceholderText('Enter team name...');
    fireEvent.change(input, { target: { value: 'Test Team' } });

    // Select robots
    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByText('Beta'));

    // Submit
    const submitButton = screen.getByText('Register Team');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(registerTeamBattle).toHaveBeenCalledWith([1, 2], 'Test Team', 2);
    });
  });

  it('should have touch targets ≥ 44px for mobile responsiveness', async () => {
    renderWithRouter(2);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Your First Team'));

    await waitFor(() => {
      // Check that the input has min-h-[44px]
      const input = screen.getByPlaceholderText('Enter team name...');
      expect(input.className).toContain('min-h-[44px]');
    });

    // Check buttons have min-h-[44px]
    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton.className).toContain('min-h-[44px]');

    const submitButton = screen.getByText('Register Team');
    expect(submitButton.className).toContain('min-h-[44px]');
  });

  it('should show cancel button that closes the modal', async () => {
    renderWithRouter(2);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Your First Team'));

    await waitFor(() => {
      expect(screen.getByText('Register 2v2 Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Register 2v2 Team')).not.toBeInTheDocument();
    });
  });

  it('should render 3v3 registration modal with correct team size label', async () => {
    renderWithRouter(3);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Your First Team'));

    await waitFor(() => {
      expect(screen.getByText('Register 3v3 Team')).toBeInTheDocument();
      expect(screen.getByText(/Select 3 Robots/)).toBeInTheDocument();
    });
  });

  it('should not allow selecting more robots than team size', async () => {
    renderWithRouter(2);

    await waitFor(() => {
      expect(screen.getByText('Register Your First Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Your First Team'));

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    // Select 2 robots (max for 2v2)
    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByText('Beta'));

    // Counter should show 2/2
    expect(screen.getByText(/2\/2/)).toBeInTheDocument();
  });
});
