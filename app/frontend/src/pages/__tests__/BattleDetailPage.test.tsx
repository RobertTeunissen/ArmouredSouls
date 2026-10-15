import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * Tests for BattleDetailPage with team battle (N-robot grouped display).
 *
 * The TeamBattleMetrics component (which handles the N-robot grouped display,
 * per-robot stats, and team coordination metrics) is tested comprehensively
 * in its own test file at:
 *   src/components/battle-detail/__tests__/TeamBattleMetrics.test.tsx
 *
 * This test file focuses on the page-level behavior: loading states,
 * error handling, and correct rendering of the page shell.
 *
 * Requirements: R9.4, R9.20
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 1, username: 'test_user', role: 'user' } }),
}));

// Mock the entire BattleDetailPage to test page-level behavior
// without triggering the internal useMemo TDZ issue
vi.mock('../../utils/matchmakingApi', () => ({
  getBattleLog: vi.fn(),
  formatDateTime: (d: string) => d,
  isTeamBattleType: (type?: string) => type === 'league_2v2' || type === 'league_3v3',
  getLeagueTierName: (tier: string) => tier.charAt(0).toUpperCase() + tier.slice(1),
  getLeagueTierColor: () => 'text-yellow-400',
  getLeagueTierIcon: () => '🏆',
  formatDuration: (seconds: number) => `${seconds}s`,
  getTournamentRoundName: (round: number) => `Round ${round}`,
}));

// The forfeit tests below render a full battle report. Keep the result banner
// real (it carries the Forfeit placement tag) and stub the heavy sections.
vi.mock('../../hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('../../components/battle-detail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/battle-detail')>();
  return {
    ...actual,
    StableRewards: () => null,
    ArenaSummary: () => null,
    CombatMessages: () => null,
    BattleStatisticsSummary: () => null,
    DamageFlowDiagram: () => null,
    TeamBattleMetrics: () => null,
    useBattlePlaybackData: () => ({
      showPlaybackViewer: false,
      playbackResult: null,
      robot1PlaybackInfo: null,
      robot2PlaybackInfo: null,
      extraPlaybackRobots: [],
      narrativePlaybackEvents: [],
      isTagTeam: false,
      kothPlaybackData: undefined,
    }),
  };
});

import { getBattleLog } from '../../utils/matchmakingApi';
import type { BattleLogParticipant, BattleLogResponse } from '../../utils/matchmakingApi';

// Since BattleDetailPage has complex internal state, we test the page shell behavior
// by testing error/loading states directly.

// For error/loading tests, we import the real page but catch the error
import BattleDetailPage from '../BattleDetailPage';

function renderPage(battleId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/battles/${battleId}`]}>
      <Routes>
        <Route path="/battles/:id" element={<BattleDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BattleDetailPage - Team Battle page-level behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state while fetching battle data', () => {
    vi.mocked(getBattleLog).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should show error state when battle not found (404)', async () => {
    const axiosError = new Error('Not found') as Error & { isAxiosError: boolean; response: { status: number } };
    axiosError.isAxiosError = true;
    axiosError.response = { status: 404 };
    vi.mocked(getBattleLog).mockRejectedValue(axiosError);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Battle not found')).toBeInTheDocument();
    });
  });

  it('should show error state when access denied (403)', async () => {
    const axiosError = new Error('Forbidden') as Error & { isAxiosError: boolean; response: { status: number } };
    axiosError.isAxiosError = true;
    axiosError.response = { status: 403 };
    vi.mocked(getBattleLog).mockRejectedValue(axiosError);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Access denied to this battle')).toBeInTheDocument();
    });
  });

  it('should show generic error state for network failures', async () => {
    vi.mocked(getBattleLog).mockRejectedValue(new Error('Network Error'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load battle details')).toBeInTheDocument();
    });
  });

  it('should call getBattleLog with the battle ID from URL params', () => {
    vi.mocked(getBattleLog).mockReturnValue(new Promise(() => {}));
    renderPage('42');
    expect(getBattleLog).toHaveBeenCalledWith(42);
  });

  it('should render page with min-h-screen class for proper viewport handling', () => {
    vi.mocked(getBattleLog).mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    const pageContainer = container.firstChild as HTMLElement;
    expect(pageContainer.className).toContain('min-h-screen');
  });
});

// T22 — forfeits on the battle report (design §9.3).
function participant(robotId: number, robotName: string, overrides: Partial<BattleLogParticipant> = {}): BattleLogParticipant {
  return {
    robotId,
    robotName,
    owner: `${robotName} Stable`,
    ownerId: robotId * 10,
    imageUrl: null,
    teamIndex: 0,
    team: robotId,
    role: null,
    placement: null,
    finalHP: 100,
    maxHP: 100,
    maxShield: 20,
    destroyed: false,
    yielded: false,
    damageDealt: 0,
    eloBefore: 1500,
    eloAfter: 1500,
    credits: 0,
    streamingRevenue: 0,
    prestigeAwarded: 0,
    fameAwarded: 0,
    stance: 'balanced',
    loadoutType: 'single',
    mainWeaponName: null,
    mainWeaponRangeBand: null,
    ...overrides,
  } as BattleLogParticipant;
}

function battleLogFixture(overrides: Partial<BattleLogResponse>): BattleLogResponse {
  return {
    battleId: 1,
    createdAt: '2026-10-15T12:00:00Z',
    battleType: 'league_1v1',
    leagueType: 'bronze',
    duration: 15,
    playbackAvailable: false,
    winner: 'robot1',
    battleLog: { events: [] },
    ...overrides,
  } as BattleLogResponse;
}

describe('BattleDetailPage - forfeits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should explain that no battle was fought and who forfeited', async () => {
    vi.mocked(getBattleLog).mockResolvedValue(battleLogFixture({
      isForfeit: true,
      forfeitedRobotIds: [2],
      participants: [participant(1, 'Alpha'), participant(2, 'Bravo')],
      robot1: { id: 1, name: 'Alpha', owner: 'A', eloBefore: 1500, eloAfter: 1510, finalHP: 100, damageDealt: 0 },
      robot2: { id: 2, name: 'Bravo', owner: 'B', eloBefore: 1500, eloAfter: 1490, finalHP: 100, damageDealt: 0 },
    }));
    renderPage();
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('No battle was fought: Bravo forfeited (no main weapon equipped)');
  });

  it('should show no forfeit notice on a fought battle', async () => {
    vi.mocked(getBattleLog).mockResolvedValue(battleLogFixture({
      isForfeit: false,
      forfeitedRobotIds: [],
      participants: [participant(1, 'Alpha'), participant(2, 'Bravo')],
    }));
    renderPage();
    await screen.findByTestId('battle-result-banner');
    expect(screen.queryByText(/No battle was fought/)).toBeNull();
    expect(screen.queryByText('Forfeit')).toBeNull();
  });

  it('should tag a forfeiter in a fought KotH placement list', async () => {
    vi.mocked(getBattleLog).mockResolvedValue(battleLogFixture({
      battleType: 'koth',
      winner: null,
      isForfeit: false,
      forfeitedRobotIds: [3],
      participants: [
        participant(1, 'Alpha', { placement: 1 }),
        participant(2, 'Bravo', { placement: 2 }),
        participant(3, 'Charlie', { placement: 3 }),
      ],
    }));
    renderPage();
    await screen.findByTestId('battle-result-banner');
    const tags = screen.getAllByText('Forfeit');
    expect(tags).toHaveLength(1);
    expect(tags[0].parentElement).toHaveTextContent('Charlie');
    expect(screen.queryByText(/No battle was fought/)).toBeNull();
  });
});
