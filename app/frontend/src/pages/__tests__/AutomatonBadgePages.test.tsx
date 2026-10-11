/**
 * Automaton_Badge on the stable profile and the season archive (Spec #55
 * R12.2–R12.4, task 11.3). The robot detail owner block is covered in
 * `RobotDetailAutomatonBadge.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, userId: 1, username: 'tester', role: 'user' } }),
}));
vi.mock('../../utils/seasonApi', () => ({
  listSeasons: vi.fn(),
  getSeasonDetail: vi.fn(),
}));

import apiClient from '../../utils/apiClient';
import * as seasonApi from '../../utils/seasonApi';
import StableViewPage from '../StableViewPage';
import SeasonArchivePage from '../SeasonArchivePage';

function stableResponse(user: Record<string, unknown>) {
  return {
    user: {
      id: 42,
      username: 'automaton_autobots',
      stableName: 'Autobots of the Ark',
      prestige: 2140,
      prestigeRank: 'Established',
      championshipTitles: 0,
      ...user,
    },
    robots: [],
    facilities: [],
    stats: {
      totalBattles: 0, totalWins: 0, totalLosses: 0, totalDraws: 0, winRate: 0, highestElo: 0,
      activeRobots: 0, totalTeamBattles: 0, teamBattleWins: 0, teamBattleWinRate: 0,
    },
  };
}

function renderStable(): void {
  render(
    <MemoryRouter initialEntries={['/stables/42']}>
      <Routes>
        <Route path="/stables/:userId" element={<StableViewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockStable(user: Record<string, unknown>): void {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.startsWith('/api/stables/')) return Promise.resolve({ data: stableResponse(user) });
    return Promise.resolve({ data: { achievements: [], pinned: [], totalUnlocked: 0, totalAvailable: 0 } });
  });
}

describe('StableViewPage — Automaton_Badge (R12.3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the full-label badge after the stable name, attached to its last word', async () => {
    mockStable({ stableType: 'automaton' });
    renderStable();
    const heading = await screen.findByRole('heading', { name: 'Autobots of the Ark Automaton' });
    const badge = within(heading).getByTestId('automaton-badge');
    expect(badge).toHaveAttribute('data-compact', 'false');
    const glue = badge.parentElement as HTMLElement;
    expect(glue).toHaveClass('whitespace-nowrap');
    expect(glue.textContent).toBe('Ark Automaton');
  });

  it('shows the same page with no franchise, backstory or strategy text', async () => {
    mockStable({ stableType: 'automaton', franchise: 'Transformers', backstory: 'Autobots who left Cybertron.' });
    renderStable();
    await screen.findByRole('heading', { name: /Autobots of the Ark/ });
    expect(screen.queryByText(/Transformers/)).toBeNull();
    expect(screen.queryByText(/Cybertron/)).toBeNull();
    expect(screen.queryByText(/strategy/i)).toBeNull();
    expect(screen.getByText('Prestige:')).toBeInTheDocument();
  });

  it.each([['human'], ['generated']])('shows no badge for a %s stable', async (stableType) => {
    mockStable({ stableType, stableName: 'Iron Warriors' });
    renderStable();
    await screen.findByRole('heading', { name: 'Iron Warriors' });
    expect(screen.queryByTestId('automaton-badge')).toBeNull();
  });
});

describe('SeasonArchivePage — Automaton_Badge (R12.2, R12.4)', () => {
  const detail: seasonApi.SeasonDetail = {
    seasonNumber: 2,
    isLegacy: false,
    competitiveCycles: 100,
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-04-10T00:00:00.000Z',
    humanStableCount: 12,
    generatedStableCount: 340,
    standingsByMode: {
      league_1v1: [
        { tier: 'gold', leagueInstanceId: 'gold_1', instanceRank: 1, entityType: 'robot', entityName: 'RoboCop', stableName: 'Old Detroit Precinct', leaguePoints: 88, wins: 9, losses: 1, draws: 0, isGeneratedSubject: false, subjectStableType: 'automaton', modeRank: 1 },
        { tier: 'gold', leagueInstanceId: 'gold_1', instanceRank: 2, entityType: 'robot', entityName: 'WimpBot Lone Spark 4', stableName: 'Rusty Bolts', leaguePoints: 64, wins: 5, losses: 5, draws: 0, isGeneratedSubject: true, subjectStableType: 'generated', modeRank: 2 },
      ],
    },
    accolades: [
      { category: 'highestElo', rank: 1, subjectName: 'RoboCop', value: 1600, valueLabel: 'ELO', mode: null, stableName: 'Old Detroit Precinct', isGeneratedSubject: false, subjectStableType: 'automaton' },
      { category: 'mostKills', rank: 1, subjectName: 'WimpBot Lone Spark 4', value: 9, valueLabel: 'kills', mode: null, stableName: 'Rusty Bolts', isGeneratedSubject: true, subjectStableType: 'generated' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(seasonApi.listSeasons).mockResolvedValue([
      { seasonNumber: 2, isLegacy: false, competitiveCycles: 100, startedAt: detail.startedAt, endedAt: detail.endedAt, humanStableCount: 12, generatedStableCount: 340 },
    ]);
    vi.mocked(seasonApi.getSeasonDetail).mockResolvedValue(detail);
  });

  it('shows the sm badge after the Automaton stable name and keeps "bot"/"system" for generated subjects', async () => {
    render(
      <MemoryRouter>
        <SeasonArchivePage />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: /Season 2/ }));
    await waitFor(() => expect(screen.getByText('Final Standings')).toBeInTheDocument());

    const badges = screen.getAllByTestId('automaton-badge');
    expect(badges).toHaveLength(2);
    for (const badge of badges) {
      expect(badge).toHaveClass('text-[10px]', 'uppercase');
      expect(badge).toHaveAttribute('data-compact', 'true');
    }

    // Standings: badge in the stable cell (not the robot cell), on the name's line.
    const automatonRow = screen.getAllByText('RoboCop').map((el) => el.closest('tr')).find((tr) => tr !== null) as HTMLElement;
    const stableCell = within(automatonRow).getByText(/Old Detroit Precinct/).closest('td') as HTMLElement;
    expect(stableCell).toContainElement(badges[0]);
    // The name truncates on its own; the badge follows it in a non-wrapping row.
    const standingName = within(stableCell).getByText('Old Detroit Precinct');
    expect(standingName).toHaveClass('min-w-0', 'truncate');
    expect(standingName).not.toContainElement(badges[0]);
    expect(badges[0].parentElement).toHaveClass('flex-nowrap');
    expect(badges[0].parentElement).not.toHaveClass('truncate');
    expect(badges[0]).toHaveClass('shrink-0');
    expect(within(automatonRow).queryByText('bot')).toBeNull();

    // Generated subjects keep their chips and get no badge.
    const botRow = screen.getAllByText('WimpBot Lone Spark 4').map((el) => el.closest('tr')).find((tr) => tr !== null) as HTMLElement;
    expect(within(botRow).getByText('bot')).toBeInTheDocument();
    expect(within(botRow).queryByTestId('automaton-badge')).toBeNull();
    expect(screen.getByText('system')).toBeInTheDocument();

    // Records: the Automaton entry carries the badge, the system entry does not.
    const eloCard = screen.getByText('Highest ELO').closest('.rounded-lg') as HTMLElement;
    const recordBadge = within(eloCard).getByTestId('automaton-badge');
    // The badge is not inside the truncating names element, so an ellipsis
    // never clips it (R12.2).
    const truncatingNames = within(eloCard).getByText('Old Detroit Precinct').closest('.truncate') as HTMLElement;
    expect(truncatingNames).not.toBeNull();
    expect(truncatingNames).toHaveClass('min-w-0');
    expect(truncatingNames).not.toContainElement(recordBadge);
    expect(recordBadge.parentElement).toHaveClass('flex-nowrap');
    expect(recordBadge.parentElement).toContainElement(truncatingNames);
    expect(recordBadge).toHaveClass('shrink-0');
    const killsCard = screen.getByText('Most Kills').closest('.rounded-lg') as HTMLElement;
    expect(within(killsCard).queryByTestId('automaton-badge')).toBeNull();
  });
});
