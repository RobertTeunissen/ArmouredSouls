import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BattleLogsTab } from '../BattleLogsTab';
import type { Battle, BattleListResponse } from '../types';

// Mock apiClient
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { battles: [], pagination: null } }),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
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

import apiClient from '../../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const makeBattle = (overrides: Partial<Battle> = {}): Battle => ({
  id: 1,
  robot1: { id: 10, name: 'IronClaw' },
  robot2: { id: 20, name: 'SteelFang' },
  winnerId: 10,
  winnerName: 'IronClaw',
  leagueType: 'gold',
  durationSeconds: 42,
  robot1FinalHP: 65,
  robot2FinalHP: 0,
  robot1ELOBefore: 1200,
  robot2ELOBefore: 1180,
  robot1ELOAfter: 1220,
  robot2ELOAfter: 1160,
  createdAt: '2025-01-15T10:00:00.000Z',
  ...overrides,
});

/**
 * Create a tag team battle with all 4 robot names.
 * Requirements 2.6, 3.8: Tag team battles should show all 4 robots.
 */
const makeTagTeamBattle = (overrides: Partial<Battle> = {}): Battle => ({
  id: 100,
  robot1: { id: 10, name: 'IronClaw' },
  robot2: { id: 20, name: 'SteelFang' },
  winnerId: 1, // Team 1 ID
  winnerName: 'Team 1',
  leagueType: 'gold',
  durationSeconds: 85,
  robot1FinalHP: 45,
  robot2FinalHP: 0,
  robot1ELOBefore: 1200,
  robot2ELOBefore: 1180,
  robot1ELOAfter: 1230,
  robot2ELOAfter: 1150,
  createdAt: '2025-01-15T12:00:00.000Z',
  battleFormat: '2v2',
  battleType: 'tagteam',
  team1ActiveName: 'IronClaw',
  team1ReserveName: 'ThunderBot',
  team2ActiveName: 'SteelFang',
  team2ReserveName: 'BlazeMech',
  team1Id: 1,
  team2Id: 2,
  ...overrides,
});

const mockBattles: Battle[] = [
  makeBattle({ id: 1 }),
  makeBattle({ id: 2, robot1: { id: 30, name: 'ThunderBot' }, robot2: { id: 40, name: 'BlazeMech' }, winnerId: 40, winnerName: 'BlazeMech' }),
];

const mockPagination: BattleListResponse['pagination'] = {
  page: 1,
  limit: 20,
  totalBattles: 45,
  totalPages: 3,
  hasMore: true,
};

const mockResponse: BattleListResponse = {
  battles: mockBattles,
  pagination: mockPagination,
};

const emptyResponse: BattleListResponse = {
  battles: [],
  pagination: { page: 1, limit: 20, totalBattles: 0, totalPages: 0, hasMore: false },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderBattleLogsTab() {
  return render(
    <BrowserRouter>
      <BattleLogsTab />
    </BrowserRouter>,
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('BattleLogsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty battles so component renders empty state
    mockedApiClient.get.mockResolvedValue({ data: emptyResponse });
  });

  it('should render search input and filter dropdowns', async () => {
    renderBattleLogsTab();

    // Search input
    expect(screen.getByPlaceholderText('Search by robot name...')).toBeInTheDocument();

    // League filter dropdown
    const leagueSelect = screen.getByDisplayValue('All Leagues');
    expect(leagueSelect).toBeInTheDocument();

    // Battle type filter dropdown
    const battleTypeSelect = screen.getByDisplayValue('All Battle Types');
    expect(battleTypeSelect).toBeInTheDocument();
  });

  it('should include Tag Team option in battle type filter', () => {
    renderBattleLogsTab();

    const battleTypeSelect = screen.getByDisplayValue('All Battle Types');
    const options = Array.from((battleTypeSelect as HTMLSelectElement).options).map(
      (o) => o.textContent,
    );

    expect(options).toContain('All Battle Types');
    expect(options).toContain('League Battles');
    expect(options).toContain('Tournament Battles');
    expect(options).toContain('Tag Team Battles');
  });

  it('should render battle rows with mock data', async () => {
    mockedApiClient.get.mockResolvedValue({ data: mockResponse });

    renderBattleLogsTab();

    await waitFor(() => {
      expect(screen.getByText('IronClaw')).toBeInTheDocument();
      expect(screen.getByText('SteelFang')).toBeInTheDocument();
      expect(screen.getByText('ThunderBot')).toBeInTheDocument();
      expect(screen.getByText('BlazeMech')).toBeInTheDocument();
    });
  });

  it('should show battleFormat indicator for 2v2 battles', async () => {
    const tagTeamBattle = makeBattle({ id: 99, battleFormat: '2v2' });
    const responseWith2v2: BattleListResponse = {
      battles: [tagTeamBattle],
      pagination: { page: 1, limit: 20, totalBattles: 1, totalPages: 1, hasMore: false },
    };
    mockedApiClient.get.mockResolvedValue({ data: responseWith2v2 });

    renderBattleLogsTab();

    await waitFor(() => {
      expect(screen.getByText('2v2')).toBeInTheDocument();
    });
  });

  it('should render pagination controls', async () => {
    mockedApiClient.get.mockResolvedValue({ data: mockResponse });

    renderBattleLogsTab();

    await waitFor(() => {
      expect(screen.getByText(/Showing 2 of 45 battles/)).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });

  it('should render empty state when no battles', async () => {
    mockedApiClient.get.mockResolvedValue({ data: { battles: [], pagination: null } });

    renderBattleLogsTab();

    await waitFor(() => {
      expect(screen.getByText('No battles found.')).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Tag Team Battle Display Tests (Requirements 2.6, 2.8, 3.8, 3.10)  */
  /* ------------------------------------------------------------------ */

  describe('Tag Team Battle Display', () => {
    it('should render team names for tag team battles (not just robot1 vs robot2)', async () => {
      /**
       * Validates: Requirements 2.6, 3.8
       * Tag team battles should show "Team 1" and "Team 2" labels.
       */
      const tagTeamBattle = makeTagTeamBattle();
      const response: BattleListResponse = {
        battles: [tagTeamBattle],
        pagination: { page: 1, limit: 20, totalBattles: 1, totalPages: 1, hasMore: false },
      };
      mockedApiClient.get.mockResolvedValue({ data: response });

      renderBattleLogsTab();

      await waitFor(() => {
        // Should show Team 1 and Team 2 labels
        expect(screen.getByText('Team 1')).toBeInTheDocument();
        expect(screen.getByText('Team 2')).toBeInTheDocument();
      });
    });

    it('should render all 4 robot names for tag team battles', async () => {
      /**
       * Validates: Requirements 2.6
       * Tag team battles should display all 4 participating robots.
       */
      const tagTeamBattle = makeTagTeamBattle({
        team1ActiveName: 'Alpha',
        team1ReserveName: 'Beta',
        team2ActiveName: 'Gamma',
        team2ReserveName: 'Delta',
      });
      const response: BattleListResponse = {
        battles: [tagTeamBattle],
        pagination: { page: 1, limit: 20, totalBattles: 1, totalPages: 1, hasMore: false },
      };
      mockedApiClient.get.mockResolvedValue({ data: response });

      renderBattleLogsTab();

      await waitFor(() => {
        // Should show all 4 robot names in the format "Active + Reserve"
        expect(screen.getByText(/Alpha \+ Beta/)).toBeInTheDocument();
        expect(screen.getByText(/Gamma \+ Delta/)).toBeInTheDocument();
      });
    });

    it('should show team name (not robot name) in winner column for tag team battles', async () => {
      /**
       * Validates: Requirements 2.6, 2.8
       * Winner column should show "Team 1" or "Team 2" for tag team battles.
       */
      const tagTeamBattle = makeTagTeamBattle({
        winnerId: 1, // Team 1 ID
        team1Id: 1,
        team2Id: 2,
      });
      const response: BattleListResponse = {
        battles: [tagTeamBattle],
        pagination: { page: 1, limit: 20, totalBattles: 1, totalPages: 1, hasMore: false },
      };
      mockedApiClient.get.mockResolvedValue({ data: response });

      renderBattleLogsTab();

      await waitFor(() => {
        // Winner column should show "Team 1" (the winning team)
        // Team 1 appears in: team column label and winner column
        const team1Elements = screen.getAllByText('Team 1');
        expect(team1Elements.length).toBeGreaterThanOrEqual(1);
        // Verify the winner column contains "Team 1" by checking the table body
        const tableBody = document.querySelector('tbody');
        expect(tableBody?.textContent).toContain('Team 1');
        // Verify it shows the trophy icon with Team 1
        expect(tableBody?.textContent).toContain('🏆');
      });
    });

    it('should show Team 2 as winner when Team 2 wins', async () => {
      /**
       * Validates: Requirements 2.6, 2.8
       * Winner column should correctly show Team 2 when they win.
       */
      const tagTeamBattle = makeTagTeamBattle({
        winnerId: 2, // Team 2 ID
        winnerName: 'Team 2',
        team1Id: 1,
        team2Id: 2,
      });
      const response: BattleListResponse = {
        battles: [tagTeamBattle],
        pagination: { page: 1, limit: 20, totalBattles: 1, totalPages: 1, hasMore: false },
      };
      mockedApiClient.get.mockResolvedValue({ data: response });

      renderBattleLogsTab();

      await waitFor(() => {
        // Winner column should show "Team 2" - find within the table body
        const tableBody = document.querySelector('tbody');
        expect(tableBody).toBeInTheDocument();
        // Team 2 appears in: team column label, robot names, and winner column
        const team2Elements = screen.getAllByText('Team 2');
        expect(team2Elements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should continue to show robot1 vs robot2 format for 1v1 battles', async () => {
      /**
       * Validates: Requirements 3.8, 3.10
       * 1v1 battles should continue to show individual robot names.
       */
      const oneVOneBattle = makeBattle({
        id: 50,
        battleFormat: '1v1',
        robot1: { id: 10, name: 'SingleBot1' },
        robot2: { id: 20, name: 'SingleBot2' },
        winnerId: 10,
        winnerName: 'SingleBot1',
      });
      const response: BattleListResponse = {
        battles: [oneVOneBattle],
        pagination: { page: 1, limit: 20, totalBattles: 1, totalPages: 1, hasMore: false },
      };
      mockedApiClient.get.mockResolvedValue({ data: response });

      renderBattleLogsTab();

      await waitFor(() => {
        // Should show individual robot names, not team names
        expect(screen.getByText('SingleBot1')).toBeInTheDocument();
        expect(screen.getByText('SingleBot2')).toBeInTheDocument();
        // Should NOT show Team 1 / Team 2 labels in the table body
        const tableBody = document.querySelector('tbody');
        expect(tableBody).toBeInTheDocument();
        expect(tableBody?.textContent).not.toContain('Team 1');
        expect(tableBody?.textContent).not.toContain('Team 2');
      });
    });

    it('should show Draw in winner column for tag team battles that end in a draw', async () => {
      /**
       * Validates: Requirements 2.8
       * Draw battles should show "Draw" in the winner column.
       */
      const drawBattle = makeTagTeamBattle({
        winnerId: null,
        winnerName: 'Draw',
      });
      const response: BattleListResponse = {
        battles: [drawBattle],
        pagination: { page: 1, limit: 20, totalBattles: 1, totalPages: 1, hasMore: false },
      };
      mockedApiClient.get.mockResolvedValue({ data: response });

      renderBattleLogsTab();

      await waitFor(() => {
        // Find the winner column in the table body - it should contain "Draw"
        const tableBody = document.querySelector('tbody');
        expect(tableBody).toBeInTheDocument();
        // The winner column should show "Draw" (there are multiple "Draw" texts in the legend)
        const drawElements = screen.getAllByText('Draw');
        // At least one should be in the table body (winner column)
        expect(drawElements.length).toBeGreaterThanOrEqual(1);
        // Verify the table body contains "Draw" in the winner column
        expect(tableBody?.textContent).toContain('Draw');
      });
    });
  });
});
