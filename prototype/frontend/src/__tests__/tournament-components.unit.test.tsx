/**
 * Unit tests for tournament bracket components — Task 10.2
 * Feature: tournament-bracket-seeding
 *
 * Tests:
 * - MatchCard: TBD/placeholder, Bye, Pending, Completed states
 * - MatchCard: Seed number display (yellow, top 32 only)
 * - MatchCard: User robot highlighting (blue border, ring, YOU badge)
 * - MatchCard: Dimmed and highlighted states
 * - TournamentDetailPage: Error + retry, Champion banner, 404 state
 * - SeedingList: Top 32 limit, click-to-scroll, user robots section
 * - BracketView: Round filter controls, bot picker dropdown
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { TournamentMatchWithRobots } from '../utils/bracketUtils';
import type { SeedEntry } from '../utils/tournamentApi';

// ── Helpers ──────────────────────────────────────────────────

function makeMatch(
  overrides: Partial<TournamentMatchWithRobots> & {
    id: number;
    round: number;
    matchNumber: number;
  },
): TournamentMatchWithRobots {
  return {
    tournamentId: 1,
    robot1Id: null,
    robot2Id: null,
    winnerId: null,
    battleId: null,
    status: 'pending',
    isByeMatch: false,
    completedAt: null,
    robot1: null,
    robot2: null,
    winner: null,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
//  MatchCard Tests
// ══════════════════════════════════════════════════════════════

import MatchCard from '../components/tournament/MatchCard';

describe('MatchCard', () => {
  const emptySeedMap = new Map<number, number>();
  const emptyUserIds = new Set<number>();

  // ── Placeholder / TBD state ──

  describe('placeholder state (no robots assigned)', () => {
    it('should render "TBD" for both slots when no robots are assigned', () => {
      const match = makeMatch({ id: 1, round: 2, matchNumber: 1 });
      const { container } = render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      const tbdElements = container.querySelectorAll('.italic');
      expect(tbdElements.length).toBe(2);
      expect(tbdElements[0].textContent).toBe('TBD');
      expect(tbdElements[1].textContent).toBe('TBD');
    });

    it('should use gray border for placeholder matches', () => {
      const match = makeMatch({ id: 2, round: 2, matchNumber: 1 });
      const { container } = render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      const card = container.querySelector('[data-testid="match-card-2"]');
      expect(card?.className).toContain('border-white/10');
    });
  });

  // ── Bye state ──

  describe('bye state', () => {
    it('should render BYE badge with yellow styling', () => {
      const match = makeMatch({
        id: 3, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        isByeMatch: true, status: 'completed', winnerId: 10,
      });
      render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      const byeBadge = screen.getByText('BYE');
      expect(byeBadge).toBeTruthy();
      expect(byeBadge.className).toContain('bg-yellow-500/20');
      expect(byeBadge.className).toContain('text-warning');
    });

    it('should show the advancing robot name in the first slot', () => {
      const match = makeMatch({
        id: 4, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        isByeMatch: true, status: 'completed', winnerId: 10,
      });
      render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      expect(screen.getByText('AlphaBot')).toBeTruthy();
    });

    it('should not render TBD for the second slot in a bye match', () => {
      const match = makeMatch({
        id: 5, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        isByeMatch: true, status: 'completed', winnerId: 10,
      });
      const { container } = render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      // The second slot should show BYE, not TBD
      const italicElements = container.querySelectorAll('.italic');
      const tdbTexts = Array.from(italicElements).filter((el) => el.textContent === 'TBD');
      expect(tdbTexts.length).toBe(0);
    });

    it('should use yellow border for bye matches without user robot', () => {
      const match = makeMatch({
        id: 6, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        isByeMatch: true, status: 'completed', winnerId: 10,
      });
      const { container } = render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      const card = container.querySelector('[data-testid="match-card-6"]');
      expect(card?.className).toContain('border-yellow-600/40');
    });
  });

  // ── Pending state ──

  describe('pending state (two robots, not yet fought)', () => {
    it('should render both robot names', () => {
      const match = makeMatch({
        id: 7, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        robot2Id: 20, robot2: { id: 20, name: 'BetaBot', elo: 1400 },
        status: 'pending',
      });
      render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      expect(screen.getByText('AlphaBot')).toBeTruthy();
      expect(screen.getByText('BetaBot')).toBeTruthy();
    });

    it('should not show any "Pending" text indicator', () => {
      const match = makeMatch({
        id: 8, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        robot2Id: 20, robot2: { id: 20, name: 'BetaBot', elo: 1400 },
        status: 'pending',
      });
      render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      expect(screen.queryByText('Pending')).toBeNull();
    });
  });

  // ── Completed state ──

  describe('completed state', () => {
    it('should show winner in green and loser with line-through', () => {
      const match = makeMatch({
        id: 9, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        robot2Id: 20, robot2: { id: 20, name: 'BetaBot', elo: 1400 },
        status: 'completed', winnerId: 10,
        winner: { id: 10, name: 'AlphaBot' },
      });
      render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      const alpha = screen.getByText('AlphaBot');
      expect(alpha.className).toContain('text-success');
      expect(alpha.className).toContain('font-semibold');

      const beta = screen.getByText('BetaBot');
      expect(beta.className).toContain('line-through');
      expect(beta.className).toContain('text-tertiary');
    });
  });

  // ── Seed number display ──

  describe('seed number display', () => {
    it('should render seed number in yellow for seeds ≤ 32', () => {
      const match = makeMatch({
        id: 10, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        robot2Id: 20, robot2: { id: 20, name: 'BetaBot', elo: 1400 },
        status: 'pending',
      });
      const seedMap = new Map<number, number>([[10, 1], [20, 16]]);
      const { container } = render(
        <MatchCard match={match} seedMap={seedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      const seedSpans = container.querySelectorAll('.text-warning.font-mono');
      expect(seedSpans.length).toBe(2);
      expect(seedSpans[0].textContent).toBe('#1');
      expect(seedSpans[1].textContent).toBe('#16');
    });

    it('should not render seed number for seeds > 32', () => {
      const match = makeMatch({
        id: 11, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        robot2Id: 20, robot2: { id: 20, name: 'BetaBot', elo: 1400 },
        status: 'pending',
      });
      const seedMap = new Map<number, number>([[10, 33], [20, 64]]);
      const { container } = render(
        <MatchCard match={match} seedMap={seedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      const seedSpans = container.querySelectorAll('.text-warning.font-mono');
      expect(seedSpans.length).toBe(0);
    });
  });

  // ── User robot highlighting ──

  describe('user robot highlighting', () => {
    it('should apply blue border and ring when match contains user robot', () => {
      const match = makeMatch({
        id: 12, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        robot2Id: 20, robot2: { id: 20, name: 'BetaBot', elo: 1400 },
        status: 'pending',
      });
      const userIds = new Set([10]);
      const { container } = render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={userIds} isUserFuturePath={false} />,
      );
      const card = container.querySelector('[data-testid="match-card-12"]');
      expect(card?.className).toContain('border-blue-500');
      expect(card?.className).toContain('ring-1');
      expect(card?.className).toContain('bg-blue-900/20');
    });

    it('should render YOU badge next to user robot name', () => {
      const match = makeMatch({
        id: 13, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        robot2Id: 20, robot2: { id: 20, name: 'BetaBot', elo: 1400 },
        status: 'pending',
      });
      const userIds = new Set([10]);
      render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={userIds} isUserFuturePath={false} />,
      );
      expect(screen.getByText('YOU')).toBeTruthy();
    });

    it('should render user robot name in blue', () => {
      const match = makeMatch({
        id: 14, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        robot2Id: 20, robot2: { id: 20, name: 'BetaBot', elo: 1400 },
        status: 'pending',
      });
      const userIds = new Set([10]);
      render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={userIds} isUserFuturePath={false} />,
      );
      const alpha = screen.getByText('AlphaBot');
      expect(alpha.className).toContain('text-blue-300');
    });
  });

  // ── Dimmed and highlighted states ──

  describe('dimmed and highlighted states', () => {
    it('should apply opacity-25 when dimmed', () => {
      const match = makeMatch({
        id: 15, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        robot2Id: 20, robot2: { id: 20, name: 'BetaBot', elo: 1400 },
      });
      const { container } = render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds}
          isUserFuturePath={false} dimmed={true} />,
      );
      const card = container.querySelector('[data-testid="match-card-15"]');
      expect(card?.className).toContain('opacity-25');
    });

    it('should apply yellow border and ring when highlighted', () => {
      const match = makeMatch({
        id: 16, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        robot2Id: 20, robot2: { id: 20, name: 'BetaBot', elo: 1400 },
      });
      const { container } = render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds}
          isUserFuturePath={false} highlighted={true} />,
      );
      const card = container.querySelector('[data-testid="match-card-16"]');
      expect(card?.className).toContain('border-yellow-400');
      expect(card?.className).toContain('ring-2');
      expect(card?.className).toContain('bg-yellow-900/30');
    });
  });

  // ── data attributes for DOM querying ──

  describe('data attributes', () => {
    it('should set data-robot1-id and data-robot2-id attributes', () => {
      const match = makeMatch({
        id: 17, round: 1, matchNumber: 1,
        robot1Id: 10, robot1: { id: 10, name: 'AlphaBot', elo: 1500 },
        robot2Id: 20, robot2: { id: 20, name: 'BetaBot', elo: 1400 },
      });
      const { container } = render(
        <MatchCard match={match} seedMap={emptySeedMap} userRobotIds={emptyUserIds} isUserFuturePath={false} />,
      );
      const card = container.querySelector('[data-testid="match-card-17"]');
      expect(card?.getAttribute('data-robot1-id')).toBe('10');
      expect(card?.getAttribute('data-robot2-id')).toBe('20');
    });
  });
});


// ══════════════════════════════════════════════════════════════
//  SeedingList Tests
// ══════════════════════════════════════════════════════════════

import SeedingList from '../components/tournament/SeedingList';

describe('SeedingList', () => {
  const emptyUserIds = new Set<number>();

  function makeSeedEntries(count: number, startSeed = 1): SeedEntry[] {
    return Array.from({ length: count }, (_, i) => ({
      seed: startSeed + i,
      robotId: 100 + i,
      robotName: `Robot-${startSeed + i}`,
      elo: 2000 - (startSeed + i) * 10,
      eliminated: false,
    }));
  }

  it('should show "No seeding data available" when seedings array is empty', () => {
    render(<SeedingList seedings={[]} userRobotIds={emptyUserIds} />);
    expect(screen.getByText('No seeding data available')).toBeTruthy();
  });

  it('should default to expanded state', () => {
    const seedings = makeSeedEntries(5);
    render(<SeedingList seedings={seedings} userRobotIds={emptyUserIds} />);
    expect(screen.getByText('Robot-1')).toBeTruthy();
  });

  it('should only show top 32 seeds, not all entries', () => {
    // 40 entries: seeds 1-40
    const seedings = makeSeedEntries(40);
    render(<SeedingList seedings={seedings} userRobotIds={emptyUserIds} />);
    // Seed 32 should be visible
    expect(screen.getByText('Robot-32')).toBeTruthy();
    // Seed 33+ should NOT be visible (no user robots beyond 32)
    expect(screen.queryByText('Robot-33')).toBeNull();
    expect(screen.queryByText('Robot-40')).toBeNull();
  });

  it('should show user robots beyond top 32 in a separate "Your robots" section', () => {
    const seedings = makeSeedEntries(40);
    // User owns robot at seed 35 (robotId = 134)
    const userIds = new Set([134]);
    render(<SeedingList seedings={seedings} userRobotIds={userIds} />);
    expect(screen.getByText('Your robots')).toBeTruthy();
    expect(screen.getByText('Robot-35')).toBeTruthy();
  });

  it('should apply blue styling to user-owned robots in top 32', () => {
    const seedings = makeSeedEntries(10);
    // User owns robot at seed 3 (robotId = 102)
    const userIds = new Set([102]);
    const { container } = render(
      <SeedingList seedings={seedings} userRobotIds={userIds} />,
    );
    // Find the user robot row — it should have border-blue-500
    const userRow = container.querySelector('.border-blue-500');
    expect(userRow).not.toBeNull();
    // Should also show YOU badge
    expect(screen.getByText('YOU')).toBeTruthy();
  });

  it('should apply line-through to eliminated robots', () => {
    const seedings: SeedEntry[] = [
      { seed: 1, robotId: 1, robotName: 'Winner', elo: 2000, eliminated: false },
      { seed: 2, robotId: 2, robotName: 'Loser', elo: 1900, eliminated: true },
    ];
    render(<SeedingList seedings={seedings} userRobotIds={emptyUserIds} />);
    const loser = screen.getByText('Loser');
    expect(loser.className).toContain('line-through');
  });

  it('should call onRobotClick when a seed entry is clicked', () => {
    const seedings = makeSeedEntries(3);
    const handleClick = vi.fn();
    render(
      <SeedingList seedings={seedings} userRobotIds={emptyUserIds} onRobotClick={handleClick} />,
    );
    fireEvent.click(screen.getByText('Robot-2'));
    expect(handleClick).toHaveBeenCalledWith(101); // robotId for seed 2
  });

  it('should collapse and expand when header is clicked', () => {
    const seedings = makeSeedEntries(3);
    render(<SeedingList seedings={seedings} userRobotIds={emptyUserIds} />);
    // Initially expanded
    expect(screen.getByText('Robot-1')).toBeTruthy();
    // Click header to collapse
    fireEvent.click(screen.getByText('Top Seeds'));
    expect(screen.queryByText('Robot-1')).toBeNull();
    // Click again to expand
    fireEvent.click(screen.getByText('Top Seeds'));
    expect(screen.getByText('Robot-1')).toBeTruthy();
  });

  it('should display seed numbers in yellow for top 32', () => {
    const seedings = makeSeedEntries(3);
    const { container } = render(
      <SeedingList seedings={seedings} userRobotIds={emptyUserIds} />,
    );
    const seedNumbers = container.querySelectorAll('.text-warning.font-mono');
    expect(seedNumbers.length).toBe(3);
    expect(seedNumbers[0].textContent).toBe('#1');
  });
});

// ══════════════════════════════════════════════════════════════
//  TournamentDetailPage Tests
// ══════════════════════════════════════════════════════════════

// Mock modules before importing the component
vi.mock('../utils/tournamentApi', () => ({
  getTournamentDetails: vi.fn(),
}));

vi.mock('../utils/robotApi', () => ({
  fetchMyRobots: vi.fn().mockResolvedValue([]),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'player', currency: 1000, prestige: 0 },
    token: 'mock-token',
    logout: vi.fn(),
    login: vi.fn(),
    loading: false,
    refreshUser: vi.fn(),
  }),
}));

vi.mock('../components/Navigation', () => ({
  default: () => React.createElement('nav', { 'data-testid': 'nav' }, 'Nav'),
}));

import TournamentDetailPage from '../pages/TournamentDetailPage';
import { getTournamentDetails } from '../utils/tournamentApi';

const mockGetTournamentDetails = vi.mocked(getTournamentDetails);

function renderDetailPage(tournamentId = '1'): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/tournaments/${tournamentId}`]}>
      <Routes>
        <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
        <Route path="/tournaments" element={<div data-testid="tournaments-list">List</div>} />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TournamentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show error message and retry button on API failure', async () => {
    mockGetTournamentDetails.mockRejectedValueOnce(new Error('Network error'));

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load tournament details')).toBeTruthy();
    });

    // Retry button should be present
    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeTruthy();

    // Back to Tournaments link should be present
    expect(screen.getByText('Back to Tournaments')).toBeTruthy();
  });

  it('should show "Tournament not found" on 404 response', async () => {
    mockGetTournamentDetails.mockRejectedValueOnce({
      response: { status: 404 },
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Tournament not found')).toBeTruthy();
    });

    expect(screen.getByText('Back to Tournaments')).toBeTruthy();
  });

  it('should show champion banner when tournament is completed with a winner', async () => {
    mockGetTournamentDetails.mockResolvedValueOnce({
      tournament: {
        id: 1,
        name: 'Test Tournament',
        type: 'single_elimination',
        status: 'completed',
        currentRound: 3,
        maxRounds: 3,
        totalParticipants: 8,
        winnerId: 10,
        startedAt: '2026-01-01',
        completedAt: '2026-01-02',
        createdAt: '2026-01-01',
        winner: { id: 10, name: 'ChampionBot' },
        matches: [],
        currentRoundMatches: [],
        participantCount: 8,
        seedings: [],
      },
      seedings: [],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText(/Champion:.*ChampionBot/)).toBeTruthy();
    });

    expect(screen.getByText('🏆')).toBeTruthy();
    expect(screen.getByText('Tournament Winner')).toBeTruthy();
  });

  it('should retry fetching when retry button is clicked after error', async () => {
    // First call fails
    mockGetTournamentDetails.mockRejectedValueOnce(new Error('Network error'));

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load tournament details')).toBeTruthy();
    });

    // Second call succeeds
    mockGetTournamentDetails.mockResolvedValueOnce({
      tournament: {
        id: 1,
        name: 'Recovered Tournament',
        type: 'single_elimination',
        status: 'active',
        currentRound: 1,
        maxRounds: 3,
        totalParticipants: 8,
        winnerId: null,
        startedAt: '2026-01-01',
        completedAt: null,
        createdAt: '2026-01-01',
        matches: [],
        currentRoundMatches: [],
        participantCount: 8,
        seedings: [],
      },
      seedings: [],
    });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('Recovered Tournament')).toBeTruthy();
    });
  });

  it('should display tournament header info (name, status, round, participants)', async () => {
    mockGetTournamentDetails.mockResolvedValueOnce({
      tournament: {
        id: 1,
        name: 'Grand Championship',
        type: 'single_elimination',
        status: 'active',
        currentRound: 2,
        maxRounds: 4,
        totalParticipants: 16,
        winnerId: null,
        startedAt: '2026-01-01',
        completedAt: null,
        createdAt: '2026-01-01',
        matches: [],
        currentRoundMatches: [],
        participantCount: 16,
        seedings: [],
      },
      seedings: [],
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Grand Championship')).toBeTruthy();
    });

    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText(/Round 2 \/ 4/)).toBeTruthy();
    expect(screen.getByText(/16 participants/)).toBeTruthy();
  });

  it('should show loading skeleton initially', () => {
    // Never resolve — keep it loading
    mockGetTournamentDetails.mockReturnValue(new Promise(() => {}));

    const { container } = renderDetailPage();

    // Should have the animate-pulse skeleton
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).not.toBeNull();
  });
});
