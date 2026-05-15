import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RobotDetailPage from '../RobotDetailPage';

// Mock apiClient
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Mock robotApi
vi.mock('../../utils/robotApi', () => ({
  fetchRobotById: vi.fn(),
  fetchRobotLeagueHistory: vi.fn(),
  fetchMyRobots: vi.fn().mockResolvedValue([]),
  updateAppearance: vi.fn(),
  commitUpgrades: vi.fn(),
  equipMainWeapon: vi.fn(),
  equipOffhandWeapon: vi.fn(),
  unequipMainWeapon: vi.fn(),
  unequipOffhandWeapon: vi.fn(),
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, role: 'user', currency: 5000 },
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

// Mock stores
vi.mock('../../stores', () => ({
  useRobotStore: {
    getState: () => ({
      robots: [{ id: 1, name: 'TestBot' }],
      fetchRobots: vi.fn(),
    }),
  },
}));

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

// Mock other components that are heavy
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation" />,
}));
vi.mock('../../components/StatisticalRankings', () => ({
  default: () => <div data-testid="statistical-rankings" />,
}));
vi.mock('../../components/PerformanceByContext', () => ({
  default: () => <div data-testid="performance-by-context" />,
}));
vi.mock('../../components/RecentBattles', () => ({
  default: () => <div data-testid="recent-battles" />,
}));
vi.mock('../../components/UpcomingMatches', () => ({
  default: () => <div data-testid="upcoming-matches" />,
}));
vi.mock('../../components/RobotPerformanceAnalytics', () => ({
  default: () => <div data-testid="robot-analytics" />,
}));
vi.mock('../../components/BattleConfigTab', () => ({
  default: () => <div data-testid="battle-config" />,
}));
vi.mock('../../components/UpgradePlanner', () => ({
  default: () => <div data-testid="upgrade-planner" />,
}));
vi.mock('../../components/TuningPoolEditor', () => ({
  default: () => <div data-testid="tuning-editor" />,
}));
vi.mock('../../components/EffectiveStatsDisplay', () => ({
  default: () => <div data-testid="effective-stats" />,
}));
vi.mock('../../components/RobotImage', () => ({
  default: () => <div data-testid="robot-image" />,
}));
vi.mock('../../components/RobotImageSelector', () => ({
  default: () => <div data-testid="robot-image-selector" />,
}));
vi.mock('../../components/Toast', () => ({
  default: () => null,
}));
vi.mock('../../utils/matchmakingApi', () => ({
  getMatchHistory: vi.fn().mockResolvedValue({ data: [] }),
  BattleHistory: {},
}));

import apiClient from '../../utils/apiClient';
import { fetchRobotById, fetchRobotLeagueHistory } from '../../utils/robotApi';
const mockedApiClient = vi.mocked(apiClient);
const mockedFetchRobotById = vi.mocked(fetchRobotById);
const mockedFetchRobotLeagueHistory = vi.mocked(fetchRobotLeagueHistory);

const mockRobot = {
  id: 1,
  name: 'TestBot',
  userId: 1,
  imageUrl: null,
  elo: 1200,
  currentLeague: 'silver',
  leagueId: 'silver_1',
  leaguePoints: 80,
  fame: 50,
  mainWeaponId: 1,
  offhandWeaponId: null,
  loadoutType: 'standard',
  stance: 'balanced',
  yieldThreshold: 30,
  mainWeapon: null,
  offhandWeapon: null,
  combatPower: 10,
  targetingSystems: 10,
  criticalSystems: 10,
  penetration: 10,
  weaponControl: 10,
  attackSpeed: 10,
  armorPlating: 10,
  shieldCapacity: 10,
  evasionThrusters: 10,
  damageDampeners: 10,
  counterProtocols: 10,
  hullIntegrity: 10,
  servoMotors: 10,
  gyroStabilizers: 10,
  hydraulicSystems: 10,
  powerCore: 10,
  combatAlgorithms: 10,
  threatAnalysis: 10,
  adaptiveAI: 10,
  logicCores: 10,
  syncProtocols: 10,
  supportSystems: 10,
  formationTactics: 10,
  currentHP: 100,
  maxHP: 100,
  currentShield: 50,
  maxShield: 50,
  battleReadiness: 100,
  repairCost: 0,
  totalBattles: 20,
  wins: 12,
  draws: 2,
  losses: 6,
  damageDealtLifetime: 5000,
  damageTakenLifetime: 3000,
  kills: 5,
  totalRepairsPaid: 200,
  titles: null,
  user: { username: 'testuser', stableName: 'Test Stable' },
};

const mockLeagueHistory = {
  data: [
    { cycleNumber: 5, destinationTier: 'silver', changeType: 'promotion', leaguePoints: 120 },
    { cycleNumber: 12, destinationTier: 'gold', changeType: 'promotion', leaguePoints: 150 },
  ],
};

function renderWithRouter(tab: string) {
  return render(
    <MemoryRouter initialEntries={[`/robots/1?tab=${tab}`]}>
      <Routes>
        <Route path="/robots/:id" element={<RobotDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RobotDetailPage - League History Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchRobotById.mockResolvedValue(mockRobot as any);
    mockedFetchRobotLeagueHistory.mockResolvedValue(mockLeagueHistory as any);
    mockedApiClient.get.mockImplementation((url: string) => {
      if (url.includes('/standings')) {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/api/weapon-inventory') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/facilities') {
        return Promise.resolve({ data: { facilities: [] } });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('renders League History tab button', async () => {
    renderWithRouter('overview');

    await waitFor(() => {
      expect(screen.getByText('League History')).toBeInTheDocument();
    });
  });

  it('fetches and shows timeline when league-history tab is active', async () => {
    renderWithRouter('league-history');

    await waitFor(() => {
      expect(screen.getByTestId('league-history-tab')).toBeInTheDocument();
    });

    expect(mockedFetchRobotLeagueHistory).toHaveBeenCalledWith(1);
  });

  it('shows empty state when no history exists', async () => {
    mockedFetchRobotLeagueHistory.mockResolvedValue({ data: [] });
    mockedApiClient.get.mockImplementation((url: string) => {
      if (url.includes('/standings')) {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/api/weapon-inventory') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/facilities') {
        return Promise.resolve({ data: { facilities: [] } });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithRouter('league-history');

    await waitFor(() => {
      expect(screen.getByTestId('league-timeline-empty')).toBeInTheDocument();
    });

    expect(screen.getByText(/No tier changes recorded yet/)).toBeInTheDocument();
  });
});
