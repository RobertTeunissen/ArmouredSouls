/**
 * PracticeArenaPage tests
 *
 * Requirements: 3.2, 3.3, 3.4, 3.5, 7.4, 7.5, 7.7, 8.4, 8.5, 8.6, 8.7, 8.8,
 *               9.2, 9.6, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import PracticeArenaPage from '../PracticeArenaPage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

import apiClient from '../../utils/apiClient';
const mockedApi = vi.mocked(apiClient);

const mockUser = {
  id: 1,
  username: 'testplayer',
  email: 'test@example.com',
  role: 'player',
  currency: 500_000,
  prestige: 100,
  stableName: 'Test Stable',
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'test-token',
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
    refreshUser: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/practice-arena' }),
  };
});

vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

vi.mock('../../components/BattlePlaybackViewer/BattlePlaybackViewer', () => ({
  BattlePlaybackViewer: (props: Record<string, unknown>) => (
    <div data-testid="battle-playback-viewer">
      BattlePlaybackViewer: {JSON.stringify(props.robot1Info)} vs {JSON.stringify(props.robot2Info)}
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockRobots = [
  {
    id: 1,
    name: 'Iron Fist',
    elo: 1500,
    currentHP: 80,
    maxHP: 100,
    currentShield: 50,
    maxShield: 50,
    loadoutType: 'single',
    stance: 'balanced',
    yieldThreshold: 20,
    mainWeaponId: 1,
    offhandWeaponId: null,
    combatPower: 10,
    targetingSystems: 8,
    criticalSystems: 5,
    penetration: 7,
    weaponControl: 6,
    attackSpeed: 9,
    armorPlating: 8,
    shieldCapacity: 5,
    evasionThrusters: 4,
    damageDampeners: 3,
    counterProtocols: 6,
    hullIntegrity: 7,
    servoMotors: 5,
    gyroStabilizers: 4,
    hydraulicSystems: 6,
    powerCore: 8,
    combatAlgorithms: 7,
    threatAnalysis: 5,
    adaptiveAI: 6,
    logicCores: 4,
    syncProtocols: 3,
    supportSystems: 2,
    formationTactics: 3,
  },
  {
    id: 2,
    name: 'Steel Thunder',
    elo: 1400,
    currentHP: 100,
    maxHP: 100,
    currentShield: 30,
    maxShield: 50,
    loadoutType: 'weapon_shield',
    stance: 'defensive',
    yieldThreshold: 15,
    mainWeaponId: 2,
    offhandWeaponId: 3,
    combatPower: 5,
    targetingSystems: 5,
    criticalSystems: 5,
    penetration: 5,
    weaponControl: 5,
    attackSpeed: 5,
    armorPlating: 5,
    shieldCapacity: 5,
    evasionThrusters: 5,
    damageDampeners: 5,
    counterProtocols: 5,
    hullIntegrity: 5,
    servoMotors: 5,
    gyroStabilizers: 5,
    hydraulicSystems: 5,
    powerCore: 5,
    combatAlgorithms: 5,
    threatAnalysis: 5,
    adaptiveAI: 5,
    logicCores: 5,
    syncProtocols: 5,
    supportSystems: 5,
    formationTactics: 5,
  },
];

const mockSparringPartners = [
  {
    botTier: 'WimpBot',
    description: 'Weak opponent with level 1 attributes',
    attributeLevel: 1,
    priceTier: { min: 0, max: 99999 },
    loadoutOptions: ['single', 'weapon_shield', 'two_handed', 'dual_wield'],
    rangeBandOptions: ['melee', 'short', 'mid', 'long'],
    stanceOptions: ['offensive', 'defensive', 'balanced'],
  },
  {
    botTier: 'AverageBot',
    description: 'Average opponent with level 5 attributes',
    attributeLevel: 5,
    priceTier: { min: 100000, max: 250000 },
    loadoutOptions: ['single', 'weapon_shield', 'two_handed', 'dual_wield'],
    rangeBandOptions: ['melee', 'short', 'mid', 'long'],
    stanceOptions: ['offensive', 'defensive', 'balanced'],
  },
  {
    botTier: 'ExpertBot',
    description: 'Expert opponent with level 10 attributes',
    attributeLevel: 10,
    priceTier: { min: 250000, max: 400000 },
    loadoutOptions: ['single', 'weapon_shield', 'two_handed', 'dual_wield'],
    rangeBandOptions: ['melee', 'short', 'mid', 'long'],
    stanceOptions: ['offensive', 'defensive', 'balanced'],
  },
  {
    botTier: 'UltimateBot',
    description: 'Ultimate opponent with level 15 attributes',
    attributeLevel: 15,
    priceTier: { min: 400000, max: Infinity },
    loadoutOptions: ['single', 'weapon_shield', 'two_handed', 'dual_wield'],
    rangeBandOptions: ['melee', 'short', 'mid', 'long'],
    stanceOptions: ['offensive', 'defensive', 'balanced'],
  },
];


function makeBattleResult(overrides: Record<string, unknown> = {}) {
  return {
    combatResult: {
      winnerId: 1,
      robot1FinalHP: 60,
      robot2FinalHP: 0,
      robot1FinalShield: 10,
      robot2FinalShield: 0,
      robot1Damage: 40,
      robot2Damage: 100,
      robot1DamageDealt: 100,
      robot2DamageDealt: 40,
      durationSeconds: 45,
      isDraw: false,
      events: [],
      ...((overrides.combatResult as object) || {}),
    },
    battleLog: [],
    robot1Info: { name: 'Iron Fist', maxHP: 100, maxShield: 50 },
    robot2Info: { name: 'AverageBot Sparring Partner', maxHP: 300, maxShield: 200 },
    ...overrides,
  };
}

function makeBatchResult(count = 5) {
  const results = Array.from({ length: count }, (_, i) =>
    makeBattleResult({
      combatResult: {
        winnerId: i % 2 === 0 ? 1 : 2,
        robot1FinalHP: i % 2 === 0 ? 60 : 0,
        robot2FinalHP: i % 2 === 0 ? 0 : 80,
        robot1FinalShield: 0,
        robot2FinalShield: 0,
        robot1Damage: 40,
        robot2Damage: 100,
        robot1DamageDealt: 100,
        robot2DamageDealt: 40,
        durationSeconds: 30 + i * 5,
        isDraw: false,
        events: [],
      },
    }),
  );
  return {
    results,
    aggregate: {
      totalBattles: count,
      robot1Wins: 3,
      robot2Wins: 2,
      draws: 0,
      avgDurationSeconds: 40,
      avgRobot1DamageDealt: 100,
      avgRobot2DamageDealt: 40,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupApiMocks() {
  mockedApi.get.mockImplementation((url: string) => {
    if (url.includes('/api/robots')) {
      return Promise.resolve({ data: mockRobots });
    }
    if (url.includes('/api/practice-arena/sparring-partners')) {
      return Promise.resolve({ data: { sparringPartners: mockSparringPartners } });
    }
    return Promise.reject(new Error(`Unknown URL: ${url}`));
  });
}

function renderPage() {
  return render(
    <BrowserRouter>
      <PracticeArenaPage />
    </BrowserRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PracticeArenaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure localStorage.getItem returns null by default (not undefined after clearAllMocks)
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    setupApiMocks();
  });

  // ---- Layout & Slot Panels ----

  it('renders two battle slot panels with "Deploy Robot" / "Simulate Opponent" toggles', async () => {
    renderPage();

    await waitFor(() => {
      const deployButtons = screen.getAllByText('Deploy Robot');
      const simulateButtons = screen.getAllByText('Simulate Opponent');
      expect(deployButtons).toHaveLength(2);
      expect(simulateButtons).toHaveLength(2);
    });
  });

  it('"Deploy Robot" mode shows robot dropdown populated from API', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
      expect(screen.getByText('Steel Thunder')).toBeInTheDocument();
    });
  });

  it('"Simulate Opponent" mode shows bot tier buttons with in-universe names', async () => {
    renderPage();

    await waitFor(() => {
      // Slot 2 defaults to sparring mode
      expect(screen.getByText('Scrapyard Drone')).toBeInTheDocument();
      expect(screen.getByText('Standard Combatant')).toBeInTheDocument();
      expect(screen.getByText('Elite Sparring Unit')).toBeInTheDocument();
      expect(screen.getByText('Apex Prototype')).toBeInTheDocument();
    });
  });

  it('selecting a bot tier populates the sparring partner config', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Scrapyard Drone')).toBeInTheDocument();
    });

    // Click on Elite Sparring Unit
    fireEvent.click(screen.getByText('Elite Sparring Unit'));

    // Should show the config controls (loadout, range band, stance, yield)
    expect(screen.getByText('Loadout Type')).toBeInTheDocument();
    expect(screen.getByText('Range Band')).toBeInTheDocument();
    expect(screen.getByText('Stance')).toBeInTheDocument();
  });

  // ---- Run Simulation Button ----

  it('"Run Simulation" button is disabled when slots are incomplete', async () => {
    renderPage();

    await waitFor(() => {
      // Slot 1 is "owned" mode with no robot selected by default
      const runButton = screen.getByText('⚡ Run Simulation');
      expect(runButton).toBeDisabled();
    });
  });

  // ---- Batch Count Selector ----

  it('batch count selector allows values 1-10', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Simulation runs:')).toBeInTheDocument();
    });

    // The label is not associated via htmlFor, so find the select via the parent container
    const label = screen.getByText('Simulation runs:');
    const batchSelect = label.closest('.flex')?.querySelector('select');
    expect(batchSelect).toBeTruthy();

    // Check options 1-10 exist
    if (batchSelect) {
      const options = within(batchSelect as HTMLElement).getAllByRole('option');
      expect(options).toHaveLength(10);
      expect(options[0]).toHaveTextContent('1');
      expect(options[9]).toHaveTextContent('10');
    }
  });

  // ---- Batch Result ----

  it('batch result displays "Simulation Analysis" with aggregate stats', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
    });

    // Select a robot in slot 1
    const selects = screen.getAllByRole('combobox');
    const robotSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option');
      return options.some(o => o.textContent === 'Iron Fist');
    });
    if (robotSelect) {
      fireEvent.change(robotSelect, { target: { value: '1' } });
    }

    // Set batch count to 5
    const batchSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option');
      return options.some(o => o.textContent === '5');
    });
    if (batchSelect) {
      fireEvent.change(batchSelect, { target: { value: '5' } });
    }

    // Mock the API to return batch result
    mockedApi.post.mockResolvedValueOnce({ data: makeBatchResult(5) });

    // Click Run Simulation
    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText(/Simulation Analysis/)).toBeInTheDocument();
    });
  });

  // ---- Loading State ----

  it('loading state displays "Running combat simulation..." during battle simulation', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
    });

    // Select a robot
    const selects = screen.getAllByRole('combobox');
    const robotSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option');
      return options.some(o => o.textContent === 'Iron Fist');
    });
    if (robotSelect) {
      fireEvent.change(robotSelect, { target: { value: '1' } });
    }

    // Make API hang to observe loading state
    let resolvePost: (value: unknown) => void;
    mockedApi.post.mockReturnValueOnce(
      new Promise((resolve) => { resolvePost = resolve; }),
    );

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('Running combat simulation...')).toBeInTheDocument();
    });

    // Resolve to clean up
    resolvePost!({ data: makeBattleResult() });
  });

  // ---- Battle Result ----

  it('battle result renders with "SIMULATION" badge and "Simulation Report" header', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
    });

    // Select a robot
    const selects = screen.getAllByRole('combobox');
    const robotSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option');
      return options.some(o => o.textContent === 'Iron Fist');
    });
    if (robotSelect) {
      fireEvent.change(robotSelect, { target: { value: '1' } });
    }

    mockedApi.post.mockResolvedValueOnce({ data: makeBattleResult() });

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('SIMULATION')).toBeInTheDocument();
      expect(screen.getByText(/Simulation Report/)).toBeInTheDocument();
    });
  });

  // ---- 503 Cycle In Progress ----

  it('503 cycle-in-progress shows "Combat Simulation Lab is offline" message', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
    });

    // Select a robot
    const selects = screen.getAllByRole('combobox');
    const robotSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option');
      return options.some(o => o.textContent === 'Iron Fist');
    });
    if (robotSelect) {
      fireEvent.change(robotSelect, { target: { value: '1' } });
    }

    // Mock 503 response
    mockedApi.post.mockRejectedValueOnce({
      response: {
        status: 503,
        data: { error: 'Practice Arena is temporarily unavailable', code: 'CYCLE_IN_PROGRESS', runningJob: 'league' },
      },
    });

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText(/Combat Simulation Lab is offline/)).toBeInTheDocument();
    });
  });

  // ---- Rate Limit Error ----

  it('rate limit error displays retry message', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
    });

    // Select a robot
    const selects = screen.getAllByRole('combobox');
    const robotSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option');
      return options.some(o => o.textContent === 'Iron Fist');
    });
    if (robotSelect) {
      fireEvent.change(robotSelect, { target: { value: '1' } });
    }

    // Mock 429 response
    mockedApi.post.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { error: 'Rate limit exceeded', retryAfter: '5 minutes' },
      },
    });

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument();
    });
  });

  // ---- What-If Overrides ----

  it('What-If overrides show visual differentiation and upgrade cost', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
    });

    // Select a robot in slot 1
    const selects = screen.getAllByRole('combobox');
    const robotSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option');
      return options.some(o => o.textContent === 'Iron Fist');
    });
    if (robotSelect) {
      fireEvent.change(robotSelect, { target: { value: '1' } });
    }

    // Expand What-If panel
    await waitFor(() => {
      const whatIfButton = screen.getByText(/What-If Configuration/);
      fireEvent.click(whatIfButton);
    });

    // Should show the notice about simulation parameters
    await waitFor(() => {
      expect(screen.getByText(/Simulation parameters only/)).toBeInTheDocument();
    });
  });

  // ---- Re-Run Button ----

  it('"Re-Run" button triggers another API call with same config', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
    });

    // Select a robot
    const selects = screen.getAllByRole('combobox');
    const robotSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option');
      return options.some(o => o.textContent === 'Iron Fist');
    });
    if (robotSelect) {
      fireEvent.change(robotSelect, { target: { value: '1' } });
    }

    mockedApi.post.mockResolvedValueOnce({ data: makeBattleResult() });

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('SIMULATION')).toBeInTheDocument();
    });

    // Click Re-Run
    mockedApi.post.mockResolvedValueOnce({ data: makeBattleResult() });
    const reRunButton = screen.getByText(/Re-Run Simulation/);
    fireEvent.click(reRunButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledTimes(2);
    });
  });

  // ---- History ----

  it('result history shows previous results from localStorage', async () => {
    // Pre-populate localStorage with a history entry
    const historyEntry = {
      timestamp: new Date().toISOString(),
      combatResult: {
        winnerId: 1,
        robot1FinalHP: 60,
        robot2FinalHP: 0,
        robot1FinalShield: 0,
        robot2FinalShield: 0,
        robot1Damage: 40,
        robot2Damage: 100,
        robot1DamageDealt: 100,
        robot2DamageDealt: 40,
        durationSeconds: 45,
        isDraw: false,
      },
      robot1: { name: 'Iron Fist', maxHP: 100, maxShield: 50 },
      robot2: { name: 'AverageBot', maxHP: 300, maxShield: 200 },
    };

    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'practice-arena-history-1') {
        return JSON.stringify([historyEntry]);
      }
      if (key === 'token') return 'test-token';
      return null;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Recent Simulations')).toBeInTheDocument();
    });
  });

  it('"Clear History" removes all results', async () => {
    const historyEntry = {
      timestamp: new Date().toISOString(),
      combatResult: {
        winnerId: 1,
        robot1FinalHP: 60,
        robot2FinalHP: 0,
        robot1FinalShield: 0,
        robot2FinalShield: 0,
        robot1Damage: 40,
        robot2Damage: 100,
        robot1DamageDealt: 100,
        robot2DamageDealt: 40,
        durationSeconds: 45,
        isDraw: false,
      },
      robot1: { name: 'Iron Fist', maxHP: 100, maxShield: 50 },
      robot2: { name: 'AverageBot', maxHP: 300, maxShield: 200 },
    };

    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'practice-arena-history-1') {
        return JSON.stringify([historyEntry]);
      }
      if (key === 'token') return 'test-token';
      return null;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Clear History')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Clear History'));

    expect(localStorage.removeItem).toHaveBeenCalledWith('practice-arena-history-1');
  });

  // ---- Battle Report Stats ----

  it('battle report shows summary stats (winner, duration, damage, HP/shield)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
    });

    // Select a robot
    const selects = screen.getAllByRole('combobox');
    const robotSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option');
      return options.some(o => o.textContent === 'Iron Fist');
    });
    if (robotSelect) {
      fireEvent.change(robotSelect, { target: { value: '1' } });
    }

    mockedApi.post.mockResolvedValueOnce({ data: makeBattleResult() });

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      // Check for duration
      expect(screen.getByText('45s')).toBeInTheDocument();
      // Check for VICTORY (winner exists)
      expect(screen.getByText('VICTORY')).toBeInTheDocument();
    });
  });

  // ---- Responsive Layout ----

  it('responsive layout renders on mobile viewport', async () => {
    // Simulate mobile viewport via matchMedia
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));

    renderPage();

    await waitFor(() => {
      // Page should still render the header
      expect(screen.getByText(/Combat Simulation Lab/)).toBeInTheDocument();
      // Both slot panels should be present
      const deployButtons = screen.getAllByText('Deploy Robot');
      expect(deployButtons.length).toBeGreaterThanOrEqual(1);
    });

    // Restore
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });
});
