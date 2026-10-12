/**
 * #532 — robot detail headline "Battles" shows the all-modes count.
 * "Record" and "Win Rate" keep covering win/loss modes only, with a note when
 * the two figures differ. Mocks follow `RobotDetailAutomatonBadge.test.tsx`.
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
vi.mock('../../components/BattleConfigTab', () => ({ default: () => <div /> }));
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

const ATTRIBUTES = [
  'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
  'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
  'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
  'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores', 'syncProtocols', 'supportSystems', 'formationTactics',
];

const NOTE = 'Record and win rate exclude KotH and Grand Melee, which are placement events.';

function robot(allModesBattleCount?: number): Robot {
  return {
    id: 5,
    name: 'Wattage',
    userId: 99,
    imageUrl: null,
    elo: 1412,
    currentLeague: 'gold',
    leagueId: 'gold_1',
    leaguePoints: 40,
    fame: 1401,
    mainWeaponId: null,
    offhandWeaponId: null,
    loadoutType: 'single',
    stance: 'balanced',
    yieldThreshold: 10,
    mainWeapon: null,
    offhandWeapon: null,
    ...Object.fromEntries(ATTRIBUTES.map((a) => [a, 10])),
    currentHP: 100,
    maxHP: 100,
    currentShield: 0,
    maxShield: 0,
    battleReadiness: 100,
    repairQuoteCredits: 0,
    totalBattles: 211,
    ...(allModesBattleCount !== undefined ? { allModesBattleCount } : {}),
    wins: 71,
    draws: 77,
    losses: 63,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    lifetimeRepairCreditsPaid: 0,
    titles: null,
    user: { id: 99, username: 'arena04', stableName: 'Arena 04', stableType: 'human' },
  } as unknown as Robot;
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/robots/5?tab=overview']}>
      <Routes>
        <Route path="/robots/:id" element={<RobotDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function headlineValue(label: string): Promise<string | null | undefined> {
  const labelEl = await screen.findByText(label);
  return labelEl.nextElementSibling?.textContent;
}

describe('RobotDetailPage — all-modes battle count (#532)', () => {
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

  it('shows the all-modes count, keeps the win/loss record and explains the difference', async () => {
    vi.mocked(fetchRobotById).mockResolvedValue(robot(280));
    renderPage();

    expect(await headlineValue('Battles:')).toBe('280');
    expect(await headlineValue('Record:')).toBe('71W - 63L - 77D');
    // Win rate stays wins / totalBattles (71 / 211).
    expect(await headlineValue('Win Rate:')).toBe('33.6%');
    expect(screen.getByText(NOTE)).toBeInTheDocument();
  });

  it('falls back to totalBattles without a note when the count is absent', async () => {
    vi.mocked(fetchRobotById).mockResolvedValue(robot());
    renderPage();

    expect(await headlineValue('Battles:')).toBe('211');
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('shows no note when the robot has no placement-mode matches', async () => {
    vi.mocked(fetchRobotById).mockResolvedValue(robot(211));
    renderPage();

    expect(await headlineValue('Battles:')).toBe('211');
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});
