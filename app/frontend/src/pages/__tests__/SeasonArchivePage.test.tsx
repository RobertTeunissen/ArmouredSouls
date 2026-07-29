import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SeasonArchivePage from '../SeasonArchivePage';
import * as seasonApi from '../../utils/seasonApi';

/**
 * These assert the page as it is actually mounted in the app, not in isolation.
 *
 * The bugs this file exists to catch, none of which an isolated component render
 * would surface:
 *  - the page not rendering the app navigation (a bare white page)
 *  - the "open your stable" link pointing at the wrong route
 */

// Mock Navigation with a marker so we can assert the page composes the app shell.
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Nav</div>,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 42, username: 'tester', role: 'user' } }),
}));

vi.mock('../../utils/seasonApi', () => ({
  listSeasons: vi.fn(),
  getSeasonDetail: vi.fn(),
}));

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <SeasonArchivePage />
    </MemoryRouter>,
  );
}

describe('SeasonArchivePage — mounting and layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the app navigation, not a bare page', async () => {
    vi.mocked(seasonApi.listSeasons).mockResolvedValue([]);
    renderPage();

    // Regression: the page originally rendered no <Navigation />, so it showed
    // as a white page outside the app layout.
    expect(screen.getByTestId('navigation')).toBeInTheDocument();
  });

  it('should render inside the standard page background container', async () => {
    vi.mocked(seasonApi.listSeasons).mockResolvedValue([]);
    const { container } = renderPage();

    // The app's page shell class. Its absence is what made the page look wrong.
    expect(container.querySelector('.min-h-screen.bg-background')).not.toBeNull();
  });

  it('should show the heading and the empty state when no season has completed', async () => {
    vi.mocked(seasonApi.listSeasons).mockResolvedValue([]);
    renderPage();

    expect(screen.getByRole('heading', { name: /Season Archive/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('season-archive-empty')).toBeInTheDocument();
    });
  });

  it('should link "open your stable page" to the signed-in user\u2019s stable, not /profile', async () => {
    vi.mocked(seasonApi.listSeasons).mockResolvedValue([]);
    renderPage();

    const link = await screen.findByRole('link', { name: /open your stable page/i });
    // Regression: this pointed at /profile. It must point at the player's stable.
    expect(link).toHaveAttribute('href', '/stables/42');
  });

  it('should list completed seasons when they exist', async () => {
    vi.mocked(seasonApi.listSeasons).mockResolvedValue([
      {
        seasonNumber: 2,
        isLegacy: false,
        competitiveCycles: 100,
        startedAt: '2026-01-01T00:00:00.000Z',
        endedAt: '2026-04-10T00:00:00.000Z',
        humanStableCount: 12,
        generatedStableCount: 340,
      },
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('season-archive-list')).toBeInTheDocument();
    });
    expect(screen.getByText(/Season 2/)).toBeInTheDocument();
    // Player and system stable counts are reported separately (R30.13).
    expect(screen.getByText(/12 player stables/)).toBeInTheDocument();
    expect(screen.getByText(/340 system stables/)).toBeInTheDocument();
  });
});

describe('SeasonArchivePage — finding your own results', () => {
  const seasonRow: seasonApi.SeasonListEntry = {
    seasonNumber: 2,
    isLegacy: false,
    competitiveCycles: 100,
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-04-10T00:00:00.000Z',
    humanStableCount: 12,
    generatedStableCount: 340,
  };

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
        { tier: 'gold', leagueInstanceId: 'gold_1', instanceRank: 1, entityType: 'robot', entityName: 'Botzilla', stableName: 'AutoBot', leaguePoints: 100, wins: 9, losses: 1, draws: 0, isGeneratedSubject: true },
        { tier: 'gold', leagueInstanceId: 'gold_1', instanceRank: 2, entityType: 'robot', entityName: 'MyBot', stableName: 'tester', leaguePoints: 80, wins: 7, losses: 3, draws: 0, isGeneratedSubject: false },
      ],
    },
    accolades: [
      { category: 'mostKills', rank: 1, subjectName: 'MyBot', value: 50, valueLabel: 'kills', mode: null, stableName: 'tester', isGeneratedSubject: false },
      { category: 'highestElo', rank: 1, subjectName: 'Botzilla', value: 1600, valueLabel: 'ELO', mode: null, stableName: 'AutoBot', isGeneratedSubject: true },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(seasonApi.listSeasons).mockResolvedValue([seasonRow]);
    vi.mocked(seasonApi.getSeasonDetail).mockResolvedValue(detail);
  });

  async function expandSeason() {
    renderPage();
    const header = await screen.findByRole('button', { name: /Season 2/ });
    await userEvent.click(header);
    await waitFor(() => expect(screen.getByText('Final Standings')).toBeInTheDocument());
  }

  it('should highlight the signed-in player\u2019s own standing with a badge', async () => {
    await expandSeason();
    // The player's own stable is flagged; the bot's is not.
    expect(screen.getByText('My Stable')).toBeInTheDocument();
    // The toolbar summarises how many results belong to the player.
    const toolbar = screen.getByText(/results? for/);
    expect(toolbar.textContent?.replace(/\s+/g, ' ')).toContain('2 results for tester');
  });

  it('should filter to only the player\u2019s stable when the toggle is on', async () => {
    await expandSeason();

    // The bot appears in both standings and records initially.
    expect(screen.getAllByText('Botzilla').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MyBot').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByLabelText(/Show only my stable/));

    // The generated bot's entries drop out entirely; the player's remain.
    await waitFor(() => expect(screen.queryAllByText('Botzilla')).toHaveLength(0));
    expect(screen.getAllByText('MyBot').length).toBeGreaterThan(0);
  });

  it('should group records into per-record cards rather than one flat list', async () => {
    await expandSeason();
    // Friendly category labels, one card each — not a single flat list.
    expect(screen.getByText('Most Kills')).toBeInTheDocument();
    expect(screen.getByText('Highest ELO')).toBeInTheDocument();
    // The kills card carries its own subject, scoped to that card.
    const killsCard = screen.getByText('Most Kills').closest('.rounded-lg')!;
    expect(within(killsCard).getByText('MyBot')).toBeInTheDocument();
    expect(within(killsCard).getByText(/50/)).toBeInTheDocument();
  });
});
