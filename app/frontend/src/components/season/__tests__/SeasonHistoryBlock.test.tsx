/**
 * Stable page season history: the season in progress, then completed
 * seasons with the latest one open and laid out like the live page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../utils/seasonApi', () => ({
  getStableSeasonHistory: vi.fn(),
  getStableSeasonDetail: vi.fn(),
}));

import * as seasonApi from '../../../utils/seasonApi';
import { useSeasonStore } from '../../../stores/seasonStore';
import SeasonHistoryBlock from '../SeasonHistoryBlock';

const summary: seasonApi.StableSeasonSummary = {
  seasonNumber: 0, isLegacy: true, competitiveCycles: 122, finalCredits: 764543, prestigeEarned: 27139,
  wins: 564, losses: 88, draws: 21, winRate: 0.8380386, championshipTitles: 6,
  achievementsUnlocked: 77, achievementsAvailable: 120, robotCount: 2, teamCount: 1,
  bestTier: { tier: 'champion', mode: 'league_1v1' },
};

const detail: seasonApi.StableSeasonDetail = {
  ...summary,
  stableName: 'ApenRots', highestElo: 1869, totalFame: 0, facilities: [], achievementIds: [],
  robots: [
    {
      robotName: 'Hitter', imageUrl: null, frameId: 1, paintJob: null, finalElo: 1400, fame: 100,
      wins: 0, losses: 0, draws: 0, totalBattles: 0, damageDealtLifetime: 0, damageTakenLifetime: 0, kills: 0,
      mainWeaponName: null, offhandWeaponName: null,
      standings: [{ mode: 'grand_melee', tier: 'silver', leagueInstanceId: 'silver_5', leaguePoints: 176, wins: 5, losses: 0, draws: 0, bestWinStreak: 3, instanceRank: 4 }],
      teams: [{ teamName: 'Batsers', teamSize: 2, modes: [{ mode: 'tag_team', tier: 'silver', leagueInstanceId: 'silver_2', leaguePoints: 27, instanceRank: 85 }] }],
    },
    {
      robotName: 'Smasher', imageUrl: null, frameId: 1, paintJob: null, finalElo: 1869, fame: 9000,
      wins: 0, losses: 0, draws: 0, totalBattles: 0, damageDealtLifetime: 0, damageTakenLifetime: 0, kills: 0,
      mainWeaponName: null, offhandWeaponName: null,
      standings: [
        { mode: 'league_1v1', tier: 'champion', leagueInstanceId: 'champion_1', leaguePoints: 259, wins: 167, losses: 20, draws: 8, bestWinStreak: 40, instanceRank: 1 },
        { mode: 'koth', tier: 'champion', leagueInstanceId: 'champion_1', leaguePoints: 535, wins: 35, losses: 0, draws: 0, bestWinStreak: 10, instanceRank: 13 },
      ],
      teams: [{ teamName: 'Batsers', teamSize: 2, modes: [] }],
    },
  ],
  accolades: [
    { category: 'mostKills', rank: 1, subjectName: 'Smasher', value: 470, valueLabel: 'kills', mode: null },
    { category: 'highestFame', rank: 1, subjectName: 'Smasher', value: 9000, valueLabel: 'fame', mode: null },
    { category: 'mostTitles', rank: 2, subjectName: 'Splatters', value: 6, valueLabel: 'titles', mode: null },
    { category: 'highestWinRate', rank: 2, subjectName: 'Basher', value: 96, valueLabel: 'win %', mode: null },
    { category: 'mostBattles', rank: 6, subjectName: 'Smasher', value: 500, valueLabel: 'battles', mode: null },
    { category: 'tournamentChampion', rank: 3, subjectName: 'Smasher', value: 0, valueLabel: '1v1 Tournament #8', mode: 'tournament_1v1' },
  ],
};

function renderBlock(): void {
  render(
    <MemoryRouter>
      <SeasonHistoryBlock userId={414} />
    </MemoryRouter>,
  );
}

describe('SeasonHistoryBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSeasonStore.setState({
      season: {
        seasonNumber: 1, phase: 'competitive', seasonCycle: 95, seasonLengthCycles: 100,
        remainingCompetitiveCycles: 5, preparationDay: 0, remainingPreparationCycles: 0, isLegacy: false,
      },
    });
    vi.mocked(seasonApi.getStableSeasonHistory).mockResolvedValue([summary]);
    vi.mocked(seasonApi.getStableSeasonDetail).mockResolvedValue(detail);
  });

  it('shows the season in progress, then opens the latest completed season', async () => {
    renderBlock();

    expect(await screen.findByText(/In progress · cycle 95 of 100/)).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /Season 0/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('₡764,543')).toBeInTheDocument();
    expect(seasonApi.getStableSeasonDetail).toHaveBeenCalledWith(414, 0);
    expect(screen.getByText(/these are career totals/)).toBeInTheDocument();
    expect(screen.getByText('83.8%')).toBeInTheDocument();
  });

  it('lays the roster out like the live page: highest tier, mode strip and best finish', async () => {
    renderBlock();

    await screen.findByText('Smasher');
    const rows = screen.getAllByTestId('tier-chip').map((chip) => chip.closest('li') as HTMLElement);
    // Highest final ELO first.
    expect(within(rows[0]).getByText('Smasher')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Champion ×2')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/Best finish: #1 Champion 1v1/)).toBeInTheDocument();
    expect(within(rows[1]).getByText('Silver ×2')).toBeInTheDocument();
    expect(within(rows[1]).getByTestId('mode-cell-tag_team')).toHaveAccessibleName('Tag Team: Silver, Team Batsers · 27 LP · #85');
    expect(screen.getByText(/2v2 · Hitter, Smasher/)).toBeInTheDocument();
  });

  it('shows the top Hall of Records placements, the rest behind "more", and tournament wins apart', async () => {
    renderBlock();

    await screen.findByText(/#1 Most Kills/);
    expect(screen.queryByText(/#6 Most Battles/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+1 more' }));
    expect(screen.getByText(/#6 Most Battles/)).toBeInTheDocument();
    expect(screen.getByText('Tournament wins: 1v1 Tournament #8 (Smasher)')).toBeInTheDocument();
  });

  it('collapses and reopens a season without loading it again', async () => {
    renderBlock();

    await screen.findByText('₡764,543');
    const toggle = screen.getByRole('button', { name: /Season 0/ });
    fireEvent.click(toggle);
    expect(screen.queryByText('₡764,543')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText('₡764,543')).toBeInTheDocument();
    expect(seasonApi.getStableSeasonDetail).toHaveBeenCalledTimes(1);
  });

  it('explains an empty history', async () => {
    vi.mocked(seasonApi.getStableSeasonHistory).mockResolvedValue([]);
    renderBlock();
    expect(await screen.findByTestId('season-history-empty')).toBeInTheDocument();
  });
});
