/**
 * Profile History (tier bands for robot and team modes, tournaments) and
 * Form (recent matches link to the battle; ELO chart) sections (#504).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const robotApi = vi.hoisted(() => ({
  fetchRobotLeagueHistory: vi.fn(),
  fetchRobotTeamBattleLeagueHistory: vi.fn(),
}));
const apiGet = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/robotApi', () => robotApi);
vi.mock('../../../utils/api', () => ({ api: { get: apiGet } }));
vi.mock('../../UpcomingMatches', () => ({ default: () => <div data-testid="upcoming" /> }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null,
}));

import { HistorySection } from '../HistorySection';
import { FormSection } from '../FormSection';
import { SeasonModeCards } from '../SeasonModeCards';
import { useSeasonStore } from '../../../stores/seasonStore';

beforeEach(() => {
  vi.clearAllMocks();
  useSeasonStore.setState({ season: { seasonNumber: 1, phase: 'competitive', seasonCycle: 95, seasonLengthCycles: 100, remainingCompetitiveCycles: 5, preparationDay: 0, remainingPreparationCycles: 0, isLegacy: false } });
  robotApi.fetchRobotLeagueHistory.mockResolvedValue({ data: [
    { cycleNumber: 20, destinationTier: 'silver', changeType: 'promotion', leaguePoints: 40, mode: 'league_1v1' },
    { cycleNumber: 40, destinationTier: 'gold', changeType: 'promotion', leaguePoints: 50, mode: null },
  ] });
  robotApi.fetchRobotTeamBattleLeagueHistory.mockResolvedValue({ teams: [
    { teamId: 9, teamSize: 3, teamName: 'Trio', currentLeague: 'diamond', currentLeagueId: 'diamond_1', currentLp: 212, history: [
      { cycleNumber: 50, destinationTier: 'diamond', changeType: 'promotion', leaguePoints: 90 },
    ], tagTeamHistory: [], tagTeamCurrentLeague: null, tagTeamCurrentLp: null },
  ] });
  apiGet.mockImplementation(async (url: string) => {
    if (url.endsWith('/performance-context')) return { tournaments: [{ tournamentId: 1, tournamentName: '3v3 Tournament #2', placement: 1, wins: 4, losses: 0 }] };
    if (url === '/api/analytics/cycle/current') return { cycleNumber: 95 };
    return { dataPoints: [{ cycleNumber: 94, value: 1904 }, { cycleNumber: 95, value: 1922 }] };
  });
});

describe('HistorySection', () => {
  it('draws tier bands for robot modes, including pre-mode records, and team modes', async () => {
    render(<HistorySection robotId={5} standings={[
      { mode: 'league_1v1', tier: 'gold', leaguePoints: 50, wins: 1, losses: 0, draws: 0, totalMatches: null, teamName: null, rank: 1, instanceSize: 2 },
      { mode: 'league_3v3', tier: 'diamond', leaguePoints: 212, wins: 1, losses: 0, draws: 0, totalMatches: null, teamName: 'Trio', rank: 1, instanceSize: 2 },
    ]} />);
    expect(await screen.findByRole('img', { name: /League 1v1: Bronze from cycle 1, Silver from cycle 20, Gold from cycle 40/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /League 3v3: Platinum from cycle 1, Diamond from cycle 50/ })).toBeInTheDocument();
    expect(screen.getByText('3 promotions · 0 demotions this season')).toBeInTheDocument();
    expect(screen.getByText('3v3 Tournament #2')).toBeInTheDocument();
    expect(screen.getByText('Champion')).toBeInTheDocument();
  });
});

describe('FormSection', () => {
  it('links recent matches to their battle and shows the ELO change', async () => {
    render(
      <MemoryRouter>
        <FormSection robotId={5} isOwner={false} form={[
          { battleId: 614805, battleType: 'league_1v1', tier: 'champion', kind: 'win', label: 'Win', eloChange: 18 },
          { battleId: 612267, battleType: 'grand_melee', tier: 'champion', kind: 'first', label: '1st', eloChange: 0 },
        ]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'League 1v1, Champion: Win, ELO +18' })).toHaveAttribute('href', '/battle/614805');
    expect(screen.getByRole('link', { name: 'Grand Melee, Champion: 1st' })).toHaveAttribute('href', '/battle/612267');
    expect(screen.queryByRole('link', { name: /Battle history/ })).toBeNull();
    expect(screen.getByTestId('upcoming')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'ELO from 1904 to 1922 over the last 2 cycles' })).toBeInTheDocument();
  });

  it('shows an error with Retry, not a permanent loader, when the profile failed', () => {
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <FormSection robotId={5} isOwner={false} form={null} failed onRetry={onRetry} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Could not load recent matches.')).toBeInTheDocument();
    // The ELO chart has its own loader; the recent-matches card must not.
    const card = screen.getByRole('heading', { name: 'Recent matches' }).parentElement?.parentElement as HTMLElement;
    expect(card).not.toHaveTextContent('Loading…');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('SeasonModeCards', () => {
  it('offers Retry when the standings failed to load', () => {
    const onRetry = vi.fn();
    render(<SeasonModeCards standings={null} failed onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Could not load this season's standings.");
    expect(screen.queryByText('Loading…')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
