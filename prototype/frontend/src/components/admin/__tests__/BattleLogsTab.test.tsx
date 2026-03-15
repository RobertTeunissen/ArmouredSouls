import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
});
