/**
 * Robot Detail owner tabs: when the viewer owns the robot but the payload
 * misses an owner-only field (`isOwnerRobotDetail` fails), the tab shows a
 * "details unavailable, reload" notice instead of an empty body.
 * Mocks follow `RobotDetailAutomatonBadge.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RobotDetailPage from '../RobotDetailPage';

vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));
vi.mock('../../utils/robotApi', () => ({
  fetchRobotById: vi.fn(),
  fetchRobotLeagueHistory: vi.fn().mockResolvedValue({ data: [] }),
  fetchRobotTeamBattleLeagueHistory: vi.fn().mockResolvedValue({ teams: [] }),
  fetchRobotKothStanding: vi.fn().mockResolvedValue({ standing: null }),
  fetchMyRobots: vi.fn().mockResolvedValue([]),
  updateAppearance: vi.fn(),
  commitUpgrades: vi.fn(),
  equipMainWeapon: vi.fn(),
  equipOffhandWeapon: vi.fn(),
  unequipMainWeapon: vi.fn(),
  unequipOffhandWeapon: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'user', currency: 5000 }, logout: vi.fn(), refreshUser: vi.fn() }),
}));
vi.mock('../../stores', () => ({
  useRobotStore: { getState: () => ({ robots: [], fetchRobots: vi.fn() }) },
}));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));
vi.mock('../../components/Navigation', () => ({ default: () => <div /> }));
vi.mock('../../components/StatisticalRankings', () => ({ default: () => <div /> }));
vi.mock('../../components/PerformanceByContext', () => ({ default: () => <div /> }));
vi.mock('../../components/RecentBattles', () => ({ default: () => <div /> }));
vi.mock('../../components/UpcomingMatches', () => ({ default: () => <div /> }));
vi.mock('../../components/RobotPerformanceAnalytics', () => ({ default: () => <div /> }));
vi.mock('../../components/BattleConfigTab', () => ({ default: () => <div data-testid="battle-config-tab" /> }));
vi.mock('../../components/UpgradePlanner', () => ({ default: () => <div /> }));
vi.mock('../../components/TuningPoolEditor', () => ({ default: () => <div /> }));
vi.mock('../../components/EffectiveStatsDisplay', () => ({ default: () => <div /> }));
vi.mock('../../components/RobotImage', () => ({ default: () => <div data-testid="robot-image" /> }));
vi.mock('../../components/RobotImageSelector', () => ({ default: () => <div /> }));
vi.mock('../../components/Toast', () => ({ default: () => null }));
vi.mock('../../components/robot-setup/RobotEligibilityChecklist', () => ({ default: () => null }));
vi.mock('../../utils/matchmakingApi', () => ({
  getMatchHistory: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } }),
  BattleHistory: {},
}));

import apiClient from '../../utils/apiClient';
import { fetchRobotById } from '../../utils/robotApi';
import type { Robot } from '../../utils/robotApi';
import type { RobotDetail } from '../../hooks/useRobotDetail';

/** The owner payload: `Robot` plus the fields the page reads that `Robot` does not declare. */
type OwnerRobotPayload = Robot & Pick<
  RobotDetail,
  'stance' | 'user' | 'titles' | 'damageDealtLifetime' | 'damageTakenLifetime' | 'kills' | 'lifetimeRepairCreditsPaid'
>;

const OWNER_ROBOT: OwnerRobotPayload = {
  id: 5,
  name: 'RoboCop',
  userId: 1,
  imageUrl: null,
  level: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  elo: 1412,
  currentLeague: 'gold',
  leagueId: 'gold_1',
  leaguePoints: 40,
  fame: 50,
  mainWeaponId: null,
  offhandWeaponId: null,
  loadoutType: 'single',
  stance: 'balanced',
  yieldThreshold: 10,
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
  currentShield: 0,
  maxShield: 0,
  battleReadiness: 100,
  repairQuoteCredits: 0,
  totalBattles: 21,
  wins: 15,
  draws: 1,
  losses: 5,
  totalLeague1v1Wins: 15,
  totalLeague1v1Losses: 5,
  totalLeague1v1Draws: 1,
  totalLeague2v2Wins: 0,
  totalLeague3v3Wins: 0,
  damageDealtLifetime: 0,
  damageTakenLifetime: 0,
  kills: 0,
  lifetimeRepairCreditsPaid: 0,
  titles: null,
  user: { username: 'owner', stableName: 'Owner Stable', stableType: 'human' },
};

/** The robot as its owner (user 1) receives it, with `overrides` applied. */
function ownerRobot(overrides: Partial<OwnerRobotPayload> = {}): OwnerRobotPayload {
  return { ...OWNER_ROBOT, ...overrides };
}

function renderPage(tab: string): void {
  render(
    <MemoryRouter initialEntries={[`/robots/5?tab=${tab}`]}>
      <Routes>
        <Route path="/robots/:id" element={<RobotDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RobotDetailPage — owner tab with an incomplete payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/facilities') return Promise.resolve({ data: { facilities: [] } });
      if (url.includes('/grand-melee-standing')) return Promise.resolve({ data: { standing: null } });
      if (url.includes('/scheduling-eligibility')) return Promise.resolve({ data: { robotId: 5, isEligible: true, isFullyConfigured: true, gates: [] } });
      if (url.includes('/standings')) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: [] });
    });
  });

  it('shows the reload notice instead of an empty tab when an owner-only field is missing', async () => {
    vi.mocked(fetchRobotById).mockResolvedValue(ownerRobot({ stance: undefined }));
    renderPage('battle-config');

    const notice = await screen.findByTestId('owner-details-unavailable');
    expect(notice).toHaveAttribute('role', 'alert');
    expect(notice).toHaveTextContent('Robot details unavailable. Reload the page to try again.');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByTestId('battle-config-tab')).toBeNull();
  });

  it('renders the tab and no notice when the owner payload is complete', async () => {
    vi.mocked(fetchRobotById).mockResolvedValue(ownerRobot());
    renderPage('battle-config');

    expect(await screen.findByTestId('battle-config-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-details-unavailable')).toBeNull();
  });

  it('shows no notice on a tab that does not need the owner payload', async () => {
    vi.mocked(fetchRobotById).mockResolvedValue(ownerRobot({ stance: undefined }));
    renderPage('overview');

    expect(await screen.findByText('RoboCop')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-details-unavailable')).toBeNull();
  });
});
