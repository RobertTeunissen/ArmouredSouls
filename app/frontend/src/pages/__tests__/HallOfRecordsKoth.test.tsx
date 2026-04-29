import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import HallOfRecordsPage from '../HallOfRecordsPage';
import { mockAuthContext } from '../../test-utils';

vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from '../../utils/apiClient';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}));
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation" />,
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const mockRecordsWithKoth = {
  combat: { fastestVictory: [], longestBattle: [], mostDamageInBattle: [], narrowestVictory: [] },
  upsets: { biggestUpset: [], biggestEloGain: [], biggestEloLoss: [] },
  career: { mostBattles: [], highestWinRate: [], mostLifetimeDamage: [], highestElo: [], mostKills: [] },
  economic: { mostExpensiveBattle: [], highestFame: [], richestStables: [] },
  prestige: { highestPrestige: [], mostTitles: [] },
  koth: {
    mostWins: [{ robotId: 1, robotName: 'ZoneKing', username: 'player1', kothWins: 10, kothMatches: 15, winRate: 66.7 }],
    highestAvgZoneScore: [{ robotId: 1, robotName: 'ZoneKing', username: 'player1', avgZoneScore: 38.0, kothMatches: 15 }],
    mostKillsCareer: [{ robotId: 2, robotName: 'Slayer', username: 'player2', kothKills: 25, kothMatches: 12 }],
    longestWinStreak: [{ robotId: 1, robotName: 'ZoneKing', username: 'player1', bestWinStreak: 5, kothWins: 10 }],
    mostZoneTime: [{ robotId: 3, robotName: 'Camper', username: 'player3', totalZoneTime: 120, kothMatches: 10 }],
    bestPlacement: [{ robotId: 1, robotName: 'ZoneKing', username: 'player1', bestPlacement: 1, kothMatches: 15 }],
    zoneDominator: [{ robotId: 4, robotName: 'Dominator', username: 'player4', totalZoneScore: 570, kothMatches: 20 }],
  },
  timestamp: '2026-03-15T00:00:00Z',
};

const mockRecordsWithoutKoth = {
  combat: { fastestVictory: [], longestBattle: [], mostDamageInBattle: [], narrowestVictory: [] },
  upsets: { biggestUpset: [], biggestEloGain: [], biggestEloLoss: [] },
  career: { mostBattles: [], highestWinRate: [], mostLifetimeDamage: [], highestElo: [], mostKills: [] },
  economic: { mostExpensiveBattle: [], highestFame: [], richestStables: [] },
  prestige: { highestPrestige: [], mostTitles: [] },
  koth: {
    mostWins: [], highestAvgZoneScore: [], mostKillsCareer: [],
    longestWinStreak: [], mostZoneTime: [], bestPlacement: [], zoneDominator: [],
  },
  timestamp: '2026-03-15T00:00:00Z',
};

describe('HallOfRecordsPage - KotH Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render KotH tab when koth records exist', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockRecordsWithKoth });

    render(
      <BrowserRouter>
        <HallOfRecordsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('King of the Hill')).toBeInTheDocument();
    });

    const kothTab = screen.getByText('King of the Hill');
    expect(kothTab.closest('button')).toBeInTheDocument();
  });

  it('should render KotH tab even when koth records are empty', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockRecordsWithoutKoth });

    render(
      <BrowserRouter>
        <HallOfRecordsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Combat')).toBeInTheDocument();
    });

    expect(screen.getByText('King of the Hill')).toBeInTheDocument();

    fireEvent.click(screen.getByText('King of the Hill'));

    // No record sections should render when all arrays are empty
    expect(screen.queryByText('👑 Most KotH Wins')).not.toBeInTheDocument();
  });

  it('should display KotH records when KotH tab is clicked', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockRecordsWithKoth });

    render(
      <BrowserRouter>
        <HallOfRecordsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('King of the Hill')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('King of the Hill'));

    await waitFor(() => {
      expect(screen.getByText('👑 Most KotH Wins')).toBeInTheDocument();
    });

    expect(screen.getByText('🎯 Highest Avg Zone Score')).toBeInTheDocument();
    expect(screen.getByText('☠️ Most KotH Kills (Career)')).toBeInTheDocument();
    expect(screen.getByText('🔥 Longest Win Streak')).toBeInTheDocument();
    expect(screen.getByText('⏱️ Most Zone Time (Career)')).toBeInTheDocument();
    expect(screen.getByText('🏆 Best Placement')).toBeInTheDocument();
    expect(screen.getByText('🏰 Zone Dominator')).toBeInTheDocument();

    // Verify record data renders
    expect(screen.getByText('10 wins')).toBeInTheDocument();
    expect(screen.getByText('25 kills')).toBeInTheDocument();
    expect(screen.getByText('570 total')).toBeInTheDocument();
  });
});
