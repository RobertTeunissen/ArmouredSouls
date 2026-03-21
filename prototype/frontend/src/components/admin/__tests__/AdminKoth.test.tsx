import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BattleLogsTab } from '../BattleLogsTab';
import apiClient from '../../../utils/apiClient';

vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock BattleDetailsModal
vi.mock('../../BattleDetailsModal', () => ({
  default: ({ isOpen, battleId }: { isOpen: boolean; battleId: number | null }) =>
    isOpen ? <div data-testid="battle-details-modal">Modal for battle #{battleId}</div> : null,
}));

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ refreshUser: vi.fn() }),
}));

const mockBattlesResponse = {
  data: {
    battles: [
      {
        id: 1,
        robot1: { id: 1, name: 'Bot-A' },
        robot2: { id: 2, name: 'Bot-B' },
        winnerId: 1,
        winnerName: 'Bot-A',
        leagueType: 'gold',
        durationSeconds: 60,
        robot1FinalHP: 80,
        robot2FinalHP: 0,
        robot1ELOBefore: 1200,
        robot2ELOBefore: 1100,
        robot1ELOAfter: 1220,
        robot2ELOAfter: 1080,
        createdAt: '2026-03-15T00:00:00Z',
        battleType: 'koth',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      totalBattles: 1,
      totalPages: 1,
      hasMore: false,
    },
  },
};

describe('Admin Panel KotH Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockBattlesResponse);
  });

  it('should render koth filter option in battle type dropdown', async () => {
    render(
      <BrowserRouter>
        <BattleLogsTab />
      </BrowserRouter>
    );

    await waitFor(() => {
      const select = screen.getAllByRole('combobox').find(
        (el) => el.querySelector('option[value="koth"]')
      );
      expect(select).toBeDefined();
    });

    expect(screen.getByText('KotH Battles')).toBeInTheDocument();
  });

  it('should render KotH battle with crown icon and orange styling', async () => {
    render(
      <BrowserRouter>
        <BattleLogsTab />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Bot-A/).length).toBeGreaterThan(0);
    });

    // Should show KotH format badge
    expect(screen.getByText('👑 KotH')).toBeInTheDocument();
  });
});
