/**
 * Robot Detail → Matches tab with the real UpcomingMatches component.
 *
 * Covers the non-owner path (sanitized `GET /api/robots/:id` payload, e.g.
 * every Automaton robot) and the owner-only "Not Battle Ready" badge, which
 * uses the shared loadout readiness rule. Mocks follow
 * `RobotDetailAutomatonBadge.test.tsx`, except UpcomingMatches is NOT mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RobotDetailPage from '../RobotDetailPage';
import type { ScheduledMatch } from '../../utils/matchmakingApi';

const mockedGetUpcomingMatches = vi.hoisted(() => vi.fn());
const mockedGetMatchHistory = vi.hoisted(() => vi.fn());

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
// The page reads booked events from the Booking Office overview for the
// unequip confirmation; the apiClient mock above does not serve that shape.
vi.mock('../../stores/subscriptionStore', () => {
  const state = { overview: null, fetchOverview: vi.fn().mockResolvedValue(undefined) };
  const useSubscriptionStore = Object.assign(
    (selector: (s: typeof state) => unknown) => selector(state),
    { getState: () => state },
  );
  return { useSubscriptionStore };
});
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
vi.mock('../../components/RobotPerformanceAnalytics', () => ({ default: () => <div /> }));
// Buttons drive the page's real equip / unequip / robot-update handlers.
vi.mock('../../components/BattleConfigTab', () => ({
  default: ({ onEquipWeapon, onUnequipWeapon, onRobotUpdate }: {
    onEquipWeapon: (slot: 'main' | 'offhand', weaponInventoryId: number) => Promise<void>;
    onUnequipWeapon: (slot: 'main' | 'offhand') => Promise<void>;
    onRobotUpdate: (updates: Record<string, unknown>) => void;
  }) => (
    <div>
      <button type="button" onClick={() => { void onUnequipWeapon('main'); }}>unequip main</button>
      <button type="button" onClick={() => { void onEquipWeapon('main', 11); }}>equip main</button>
      <button type="button" onClick={() => onRobotUpdate({ mainWeaponId: null })}>update: no main</button>
      <button type="button" onClick={() => onRobotUpdate({ mainWeaponId: 11 })}>update: main 11</button>
    </div>
  ),
}));
vi.mock('../../components/UpgradePlanner', () => ({ default: () => <div /> }));
vi.mock('../../components/TuningPoolEditor', () => ({ default: () => <div /> }));
vi.mock('../../components/EffectiveStatsDisplay', () => ({ default: () => <div /> }));
vi.mock('../../components/RobotImage', () => ({ default: () => <div data-testid="robot-image" /> }));
vi.mock('../../components/RobotImageSelector', () => ({ default: () => <div /> }));
vi.mock('../../components/Toast', () => ({ default: () => null }));
vi.mock('../../components/robot-setup/RobotEligibilityChecklist', () => ({ default: () => null }));
vi.mock('../../utils/matchmakingApi', async () => {
  const actual = await vi.importActual<typeof import('../../utils/matchmakingApi')>('../../utils/matchmakingApi');
  return {
    ...actual,
    getMatchHistory: mockedGetMatchHistory,
    getUpcomingMatches: mockedGetUpcomingMatches,
  };
});

import apiClient from '../../utils/apiClient';
import { equipMainWeapon, fetchRobotById, unequipMainWeapon } from '../../utils/robotApi';
import type { Robot } from '../../utils/robotApi';

const ROBOT_ID = 5;
const VIEWER_ID = 1;

const ATTRIBUTES = [
  'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
  'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
  'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
  'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores', 'syncProtocols', 'supportSystems', 'formationTactics',
];

/** Fields `robotSanitizer.ts` strips for non-owners. */
const SANITIZED_FIELDS = [
  'currentHP', 'currentShield', 'mainWeaponId', 'offhandWeaponId', 'loadoutType',
  'stance', 'yieldThreshold', 'mainWeapon', 'offhandWeapon', 'damageTaken',
] as const;

function robot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ROBOT_ID,
    name: 'CT-7567 Rex',
    userId: VIEWER_ID,
    imageUrl: null,
    elo: 1200,
    currentLeague: 'bronze',
    leagueId: 'bronze_7',
    leaguePoints: 0,
    fame: 0,
    mainWeaponId: 11,
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
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    lifetimeRepairCreditsPaid: 0,
    titles: null,
    user: { id: VIEWER_ID, username: 'owner', stableName: 'Owner Stable', stableType: 'human' },
    ...overrides,
  };
}

/** Non-owner Automaton robot, sanitized the way the backend returns it. */
function sanitizedAutomatonRobot(): Robot {
  const data = robot({
    userId: 99,
    user: { id: 99, username: 'automaton_kamino', stableName: 'Kamino Clone Legion', stableType: 'automaton' },
  });
  for (const field of SANITIZED_FIELDS) {
    delete data[field];
  }
  return data as unknown as Robot;
}

function upcomingMatch(robotUserId: number): ScheduledMatch {
  return {
    id: 'scheduled-1',
    matchType: 'league_1v1',
    leagueType: 'bronze',
    scheduledFor: '2026-06-01T12:00:00Z',
    status: 'scheduled',
    robot1: { id: ROBOT_ID, name: 'CT-7567 Rex', elo: 1200, currentHP: 100, maxHP: 100, userId: robotUserId, user: { username: 'stable' } },
    robot2: { id: 77, name: 'Opponent Bot', elo: 1200, currentHP: 100, maxHP: 100, userId: 42, user: { username: 'rival' } },
    teamBattleTeam2: null,
  };
}

function renderPage(tab = 'matches'): void {
  vi.mocked(localStorage.getItem).mockReturnValue('test-token');
  render(
    <MemoryRouter initialEntries={[`/robots/${ROBOT_ID}?tab=${tab}`]}>
      <Routes>
        <Route path="/robots/:id" element={<RobotDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RobotDetailPage — Upcoming Matches and battle readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetMatchHistory.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/facilities') return Promise.resolve({ data: { facilities: [] } });
      if (url.includes('/grand-melee-standing')) return Promise.resolve({ data: { standing: null } });
      if (url.includes('/scheduling-eligibility')) return Promise.resolve({ data: { robotId: ROBOT_ID, isEligible: true, isFullyConfigured: true, gates: [] } });
      if (url.includes('/standings')) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: [] });
    });
  });

  it('non-owner viewing a sanitized Automaton robot sees match cards and no readiness badge', async () => {
    vi.mocked(fetchRobotById).mockResolvedValue(sanitizedAutomatonRobot());
    mockedGetUpcomingMatches.mockResolvedValue([upcomingMatch(99)]);
    renderPage();

    expect((await screen.findAllByText('PENDING')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Opponent Bot').length).toBeGreaterThan(0);
    expect(screen.queryByText('Not Battle Ready')).toBeNull();
    expect(mockedGetUpcomingMatches).toHaveBeenCalledWith(ROBOT_ID);
  });

  it('owner without a main weapon sees the badge with the weapon warning', async () => {
    vi.mocked(fetchRobotById).mockResolvedValue(robot({ mainWeaponId: null }) as unknown as Robot);
    mockedGetUpcomingMatches.mockResolvedValue([upcomingMatch(VIEWER_ID)]);
    renderPage();

    expect(await screen.findByText('Not Battle Ready')).toBeInTheDocument();
    expect(screen.getByText(/⚠️ No main weapon equipped/)).toBeInTheDocument();
  });

  it('owner with dual_wield missing an offhand is not ready', async () => {
    vi.mocked(fetchRobotById).mockResolvedValue(
      robot({ loadoutType: 'dual_wield', mainWeaponId: 11, offhandWeaponId: null }) as unknown as Robot,
    );
    mockedGetUpcomingMatches.mockResolvedValue([upcomingMatch(VIEWER_ID)]);
    renderPage();

    expect(await screen.findByText('Not Battle Ready')).toBeInTheDocument();
    expect(screen.getByText(/⚠️ No offhand weapon equipped/)).toBeInTheDocument();
  });

  it('owner with weapon_shield missing a shield is not ready', async () => {
    vi.mocked(fetchRobotById).mockResolvedValue(
      robot({ loadoutType: 'weapon_shield', mainWeaponId: 11, offhandWeaponId: null }) as unknown as Robot,
    );
    mockedGetUpcomingMatches.mockResolvedValue([upcomingMatch(VIEWER_ID)]);
    renderPage();

    expect(await screen.findByText('Not Battle Ready')).toBeInTheDocument();
    expect(screen.getByText(/⚠️ No shield equipped/)).toBeInTheDocument();
  });

  it('owner with a fully armed but damaged robot sees no badge (HP is repaired before battle)', async () => {
    vi.mocked(fetchRobotById).mockResolvedValue(
      robot({ loadoutType: 'single', mainWeaponId: 11, currentHP: 10, maxHP: 100 }) as unknown as Robot,
    );
    mockedGetUpcomingMatches.mockResolvedValue([upcomingMatch(VIEWER_ID)]);
    renderPage();

    expect((await screen.findAllByText('PENDING')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Not Battle Ready')).toBeNull();
  });
});

describe('RobotDetailPage — battle readiness follows loadout changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetMatchHistory.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
    mockedGetUpcomingMatches.mockResolvedValue([upcomingMatch(VIEWER_ID)]);
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/facilities') return Promise.resolve({ data: { facilities: [] } });
      if (url.includes('/grand-melee-standing')) return Promise.resolve({ data: { standing: null } });
      if (url.includes('/scheduling-eligibility')) return Promise.resolve({ data: { robotId: ROBOT_ID, isEligible: true, isFullyConfigured: true, gates: [] } });
      if (url.includes('/standings')) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: [] });
    });
    // Starts fully armed: single loadout, main weapon 11.
    vi.mocked(fetchRobotById).mockResolvedValue(robot() as unknown as Robot);
  });

  /** Open the Matches tab and wait for its cards (UpcomingMatches remounts per visit). */
  async function openMatchesTab(): Promise<void> {
    fireEvent.click(screen.getByRole('tab', { name: /Matches/ }));
    expect((await screen.findAllByText('PENDING')).length).toBeGreaterThan(0);
  }

  async function openBattleConfigTab(): Promise<void> {
    fireEvent.click(screen.getByRole('tab', { name: /Battle Config/ }));
    await screen.findByRole('button', { name: 'equip main' });
  }

  it('shows the badge after the main weapon is unequipped and hides it after re-equipping', async () => {
    vi.mocked(unequipMainWeapon).mockResolvedValue(
      { robot: robot({ mainWeaponId: null }) } as unknown as Awaited<ReturnType<typeof unequipMainWeapon>>,
    );
    vi.mocked(equipMainWeapon).mockResolvedValue(
      { robot: robot({ mainWeaponId: 11 }) } as unknown as Awaited<ReturnType<typeof equipMainWeapon>>,
    );
    renderPage('battle-config');
    await screen.findByRole('button', { name: 'unequip main' });

    fireEvent.click(screen.getByRole('button', { name: 'unequip main' }));
    expect(await screen.findByText('Weapon unequipped!')).toBeInTheDocument();
    await openMatchesTab();
    expect(screen.getByText('Not Battle Ready')).toBeInTheDocument();
    expect(screen.getByText(/⚠️ No main weapon equipped/)).toBeInTheDocument();

    await openBattleConfigTab();
    fireEvent.click(screen.getByRole('button', { name: 'equip main' }));
    expect(await screen.findByText('Weapon equipped successfully!')).toBeInTheDocument();
    await openMatchesTab();
    expect(screen.queryByText('Not Battle Ready')).toBeNull();
  });

  it('follows handleRobotUpdate: badge appears without a main weapon, disappears once it is back', async () => {
    renderPage('battle-config');
    await screen.findByRole('button', { name: 'update: no main' });

    fireEvent.click(screen.getByRole('button', { name: 'update: no main' }));
    await openMatchesTab();
    expect(screen.getByText('Not Battle Ready')).toBeInTheDocument();

    await openBattleConfigTab();
    fireEvent.click(screen.getByRole('button', { name: 'update: main 11' }));
    await openMatchesTab();
    expect(screen.queryByText('Not Battle Ready')).toBeNull();
  });
});
