import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BattleHistoryPage from '../BattleHistoryPage';
import type { BattleHistory, BattleParticipantData } from '../../utils/matchmakingApi';

const mockGetMatchHistory = vi.hoisted(() => vi.fn());

vi.mock('../../utils/matchmakingApi', async () => {
  const actual = await vi.importActual<typeof import('../../utils/matchmakingApi')>('../../utils/matchmakingApi');
  return {
    ...actual,
    getMatchHistory: mockGetMatchHistory,
  };
});

vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

vi.mock('../../components/BattleHistorySummary', () => ({
  default: () => <div data-testid="battle-history-summary">Summary</div>,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, username: 'owner' }, logout: vi.fn() }),
}));

function participant(
  robotId: number,
  userId: number,
  team: number,
  credits: number,
  streamingRevenue: number,
): BattleParticipantData {
  return {
    robotId,
    team,
    role: null,
    eloBefore: 1200,
    eloAfter: 1210,
    finalHP: 100,
    credits,
    streamingRevenue,
    prestigeAwarded: 7,
    fameAwarded: 2,
    damageDealt: 10,
    placement: null,
    yielded: false,
    destroyed: false,
    robot: {
      id: robotId,
      name: `Robot ${robotId}`,
      userId,
      user: { username: `user-${userId}` },
    },
  };
}

function battle(participants: BattleParticipantData[]): BattleHistory {
  return {
    id: 777,
    battleType: 'league_3v3',
    createdAt: '2026-06-01T12:00:00Z',
    winnerId: participants[0].robotId,
    robot1Id: participants[0].robotId,
    robot2Id: participants[1]?.robotId ?? null,
    robot1: participants[0].robot,
    robot2: participants[1]?.robot ?? null,
    robot1ELOBefore: 1200,
    robot1ELOAfter: 1210,
    robot2ELOBefore: 1200,
    robot2ELOAfter: 1190,
    robot1FinalHP: 100,
    robot2FinalHP: 0,
    winnerReward: 100,
    loserReward: 20,
    durationSeconds: 30,
    participants,
  } as BattleHistory;
}

function makeByeBattle(): BattleHistory {
  return {
    ...battle([participant(10, 7, 1, 100, 10)]),
    isByeMatch: true,
    robot2Id: null,
    robot2: null,
  };
}

function renderPage(initialEntry = '/battle-history'): void {
  (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <BattleHistoryPage />
    </MemoryRouter>,
  );
}

describe('BattleHistoryPage display instances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => (
      key === 'token' ? 'test-token' : null
    ));
  });

  it('should render one side-scoped card for a same-side 3v3 battle', async () => {
    mockGetMatchHistory.mockResolvedValue({
      data: [battle([
        participant(10, 7, 1, 100, 10),
        participant(11, 7, 1, 200, 20),
        participant(12, 7, 1, 300, 30),
        participant(20, 8, 2, 900, 90),
      ])],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      const cards = screen.getAllByRole('button', { name: /battle result/i });
      expect(cards).toHaveLength(1);
      expect(cards[0].textContent).toContain('660');
      expect(cards[0].textContent).not.toContain('990');
    });
  });

  it('should render separate opposite-side instances for one raw battle', async () => {
    mockGetMatchHistory.mockResolvedValue({
      data: [battle([
        participant(10, 7, 1, 100, 10),
        participant(20, 7, 2, 300, 30),
        participant(30, 8, 1, 900, 90),
      ])],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      const cards = screen.getAllByRole('button', { name: /battle result/i });
      expect(cards).toHaveLength(2);
      expect(cards.map(card => card.textContent)).toEqual(expect.arrayContaining([
        expect.stringContaining('110'),
        expect.stringContaining('330'),
      ]));
    });
  });

  it('should search a bye by the owned robot without requiring an opponent', async () => {
    mockGetMatchHistory.mockResolvedValue({
      data: [makeByeBattle()],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    renderPage('/battle-history?q=Robot%2010');

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /bye result/i })).toHaveLength(1);
    });
    expect(screen.queryByText('No Battles Found')).not.toBeInTheDocument();
  });

  it('should not match a bye by an opponent search term', async () => {
    mockGetMatchHistory.mockResolvedValue({
      data: [makeByeBattle()],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    renderPage('/battle-history?q=Opponent');

    await waitFor(() => {
      expect(screen.getByText('No Battles Found')).toBeInTheDocument();
    });
    expect(screen.queryAllByRole('button', { name: /bye result/i })).toHaveLength(0);
  });
});
