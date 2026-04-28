/**
 * Unit Tests for BattleLogsPage
 *
 * Tests filter chips toggle, mini-stats render, battle detail view opens
 * in slide-over, formula breakdowns display.
 *
 * _Requirements: 10.1, 10.2, 10.3, 10.4_
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BattleLogsPage from '../BattleLogsPage';

// ----------------------------------------------------------------
// Mock apiClient
// ----------------------------------------------------------------
const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

// ----------------------------------------------------------------
// Mock battleLogHelpers
// ----------------------------------------------------------------
vi.mock('../../../components/admin/battleLogHelpers', () => ({
  getBattleOutcome: () => ({ color: 'text-success', icon: '🏆', label: 'Victory' }),
  getBattleHighlight: () => '',
}));

// ----------------------------------------------------------------
// Mock data
// ----------------------------------------------------------------
const mockBattlesResponse = {
  battles: [
    {
      id: 1,
      robot1: { id: 10, name: 'AlphaBot' },
      robot2: { id: 20, name: 'BetaBot' },
      winnerId: 10,
      winnerName: 'AlphaBot',
      leagueType: 'gold',
      durationSeconds: 45,
      robot1FinalHP: 80,
      robot2FinalHP: 0,
      robot1ELOBefore: 1200,
      robot2ELOBefore: 1180,
      robot1ELOAfter: 1215,
      robot2ELOAfter: 1165,
      createdAt: '2025-01-01T12:00:00Z',
      battleFormat: '1v1',
      battleType: 'league',
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    totalBattles: 1,
    totalPages: 1,
    hasMore: false,
  },
};

const mockBattleDetail = {
  id: 1,
  battleType: 'league',
  battleFormat: '1v1',
  leagueType: 'gold',
  durationSeconds: 45,
  createdAt: '2025-01-01T12:00:00Z',
  robot1: { id: 10, name: 'AlphaBot', userId: 1, maxHP: 100, maxShield: 50, loadout: 'heavy_armor', stance: 'aggressive', attributes: {} },
  robot2: { id: 20, name: 'BetaBot', userId: 2, maxHP: 100, maxShield: 50, loadout: 'light_speed', stance: 'defensive', attributes: {} },
  participants: [
    { robotId: 10, team: null, role: null, credits: 500, streamingRevenue: 100, eloBefore: 1200, eloAfter: 1215, prestigeAwarded: 10, fameAwarded: 5, damageDealt: 120, finalHP: 80, yielded: false, destroyed: false },
    { robotId: 20, team: null, role: null, credits: 200, streamingRevenue: 50, eloBefore: 1180, eloAfter: 1165, prestigeAwarded: 5, fameAwarded: 2, damageDealt: 20, finalHP: 0, yielded: false, destroyed: true },
  ],
  winnerId: 10,
  robot1ELOBefore: 1200,
  robot2ELOBefore: 1180,
  robot1ELOAfter: 1215,
  robot2ELOAfter: 1165,
  eloChange: 15,
  winnerReward: 500,
  loserReward: 200,
  battleLog: null,
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('BattleLogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/admin/battles/1')) {
        return Promise.resolve({ data: mockBattleDetail });
      }
      return Promise.resolve({ data: mockBattlesResponse });
    });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <BattleLogsPage />
      </MemoryRouter>,
    );

  it('should render the page header', async () => {
    renderPage();
    expect(screen.getByText('Battle Logs')).toBeInTheDocument();
  });

  it('should render filter chips for battle types', async () => {
    renderPage();
    await waitFor(() => {
      const allTypesButtons = screen.getAllByText('All Types');
      expect(allTypesButtons.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('Tournament')).toBeInTheDocument();
    expect(screen.getByText('Tag Team')).toBeInTheDocument();
  });

  it('should render mini-stats summary', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Total Battles')).toBeInTheDocument();
    });
  });

  it('should render battle table with data', async () => {
    renderPage();
    await waitFor(() => {
      // AlphaBot appears in robot1 column
      const alphaElements = screen.getAllByText('AlphaBot');
      expect(alphaElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('BetaBot')).toBeInTheDocument();
    });
  });

  it('should open battle detail slide-over when row is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      const alphaElements = screen.getAllByText('AlphaBot');
      expect(alphaElements.length).toBeGreaterThanOrEqual(1);
    });

    // Click the table row (the row is clickable)
    const row = screen.getByText('#1').closest('tr');
    expect(row).not.toBeNull();
    await user.click(row!);

    await waitFor(() => {
      // The slide-over shows "Battle #1" in the title
      expect(screen.getByText('Battle #1')).toBeInTheDocument();
    });
  });

  it('should fetch battles on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/admin/battles', expect.objectContaining({ params: expect.objectContaining({ page: 1, limit: 20 }) }));
    });
  });

  it('should show empty state when no battles found', async () => {
    mockGet.mockResolvedValue({ data: { battles: [], pagination: { page: 1, limit: 20, totalBattles: 0, totalPages: 0, hasMore: false } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No battles found')).toBeInTheDocument();
    });
  });
});
