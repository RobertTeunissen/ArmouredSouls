/**
 * PracticeArenaPage tests
 *
 * Requirements: 3.2, 3.3, 3.4, 3.5, 7.4, 7.5, 7.7, 8.4, 8.5, 8.6, 8.7, 8.8,
 *               9.2, 9.6, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any import that triggers module resolution
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

import { mockUser } from './practice-arena/test-data';

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

vi.mock('../../components/RobotImage', () => ({
  default: ({ robotName }: { robotName: string }) => (
    <div data-testid={`robot-image-${robotName}`}>{robotName}</div>
  ),
}));

vi.mock('../../components/BattlePlaybackViewer/BattlePlaybackViewer', () => ({
  BattlePlaybackViewer: (props: Record<string, unknown>) => (
    <div data-testid="battle-playback-viewer">
      BattlePlaybackViewer: {JSON.stringify(props.robot1Info)} vs {JSON.stringify(props.robot2Info)}
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers (imported after mocks are declared)
// ---------------------------------------------------------------------------

import {
  mockedApi,
  makeBattleResult,
  makeBatchResult,
  setupApiMocks,
  renderPage,
  selectRobotByName,
} from './practice-arena/test-helpers';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PracticeArenaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    setupApiMocks();
  });

  // ---- Layout & Slot Panels ----

  it('renders slot 2 with "Deploy Robot" / "Simulate Opponent" toggle (slot 1 is forced owned)', async () => {
    renderPage();

    await waitFor(() => {
      const deployButtons = screen.getAllByText('Deploy Robot');
      const simulateButtons = screen.getAllByText('Simulate Opponent');
      expect(deployButtons).toHaveLength(1);
      expect(simulateButtons).toHaveLength(1);
    });
  });

  it('"Deploy Robot" mode shows robot image grid populated from API', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Steel Thunder').length).toBeGreaterThan(0);
    });
  });

  it('"Simulate Opponent" mode shows bot tier buttons with tier names', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('WimpBot')).toBeInTheDocument();
      expect(screen.getByText('AverageBot')).toBeInTheDocument();
      expect(screen.getByText('ExpertBot')).toBeInTheDocument();
      expect(screen.getByText('UltimateBot')).toBeInTheDocument();
    });
  });

  it('selecting a bot tier populates the sparring partner config', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('ExpertBot')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('ExpertBot'));

    expect(screen.getByText('Loadout Type')).toBeInTheDocument();
    expect(screen.getByText('Range Band')).toBeInTheDocument();
    expect(screen.getByText('Stance')).toBeInTheDocument();
  });

  // ---- Run Simulation Button ----

  it('"Run Simulation" button is disabled when slots are incomplete', async () => {
    renderPage();

    await waitFor(() => {
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

    const label = screen.getByText('Simulation runs:');
    const batchSelect = label.closest('.flex')?.querySelector('select');
    expect(batchSelect).toBeTruthy();

    if (batchSelect) {
      const options = within(batchSelect as HTMLElement).getAllByRole('option');
      expect(options).toHaveLength(10);
      expect(options[0]).toHaveTextContent('1');
      expect(options[9]).toHaveTextContent('10');
    }
  });

  // ---- Batch Result ----

  it('batch result displays BatchSummary with Wins/Losses/Draws grid', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
    });

    await selectRobotByName('Iron Fist');

    const selects = screen.getAllByRole('combobox');
    const batchSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option');
      return options.some(o => o.textContent === '5');
    });
    if (batchSelect) {
      fireEvent.change(batchSelect, { target: { value: '5' } });
    }

    mockedApi.post.mockResolvedValueOnce({ data: makeBatchResult(5) });

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('Wins')).toBeInTheDocument();
      expect(screen.getByText('Losses')).toBeInTheDocument();
      expect(screen.getByText('Draws')).toBeInTheDocument();
    });
  });

  // ---- Loading State ----

  it('loading state displays "Running combat simulation..." during battle simulation', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
    });

    await selectRobotByName('Iron Fist');

    let resolvePost: (value: unknown) => void;
    mockedApi.post.mockReturnValueOnce(
      new Promise((resolve) => { resolvePost = resolve; }),
    );

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('Running combat simulation...')).toBeInTheDocument();
    });

    resolvePost!({ data: makeBattleResult() });
  });

  // ---- Battle Result ----

  it('battle result renders with "SIMULATION" badge and SimulationResultBanner', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
    });

    await selectRobotByName('Iron Fist');

    mockedApi.post.mockResolvedValueOnce({ data: makeBattleResult() });

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('SIMULATION')).toBeInTheDocument();
      expect(screen.getByText(/🏆 Iron Fist WINS/)).toBeInTheDocument();
      expect(screen.getByText('Battle Playback')).toBeInTheDocument();
    });
  });

  // ---- 503 Cycle In Progress ----

  it('503 cycle-in-progress shows "Combat Simulation Lab is offline" message', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
    });

    await selectRobotByName('Iron Fist');

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
      expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
    });

    await selectRobotByName('Iron Fist');

    mockedApi.post.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { error: 'Rate limit exceeded', retryAfter: 300, remaining: 0 },
      },
    });

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText(/Rate limit reached/)).toBeInTheDocument();
    });
  });

  // ---- What-If Overrides ----

  it('What-If overrides show simulation-only notice and category +/- buttons', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
    });

    await selectRobotByName('Iron Fist');

    await waitFor(() => {
      const whatIfButton = screen.getByText(/What-If Configuration/);
      fireEvent.click(whatIfButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Simulation only — your robot is not modified/)).toBeInTheDocument();
    });

    expect(screen.getByText('Combat Systems')).toBeInTheDocument();
    expect(screen.getByText('Defensive Systems')).toBeInTheDocument();
  });

  // ---- Re-Run Button ----

  it('"Re-Run" button triggers another API call with same config', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
    });

    await selectRobotByName('Iron Fist');

    mockedApi.post.mockResolvedValueOnce({ data: makeBattleResult() });

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('SIMULATION')).toBeInTheDocument();
    });

    mockedApi.post.mockResolvedValueOnce({ data: makeBattleResult() });
    const reRunButton = screen.getByText(/Re-Run Simulation/);
    fireEvent.click(reRunButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledTimes(2);
    });
  });

  // ---- History ----

  it('result history shows previous results from localStorage', async () => {
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

  it('battle report shows SimulationResultBanner with winner and duration', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0);
    });

    await selectRobotByName('Iron Fist');

    mockedApi.post.mockResolvedValueOnce({ data: makeBattleResult() });

    const runButton = screen.getByText('⚡ Run Simulation');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText(/🏆 Iron Fist WINS/)).toBeInTheDocument();
      expect(screen.getByText(/Duration: 45s/)).toBeInTheDocument();
    });
  });

  // ---- Responsive Layout ----

  it('responsive layout renders on mobile viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    window.dispatchEvent(new Event('resize'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Combat Simulation Lab/)).toBeInTheDocument();
      const deployButtons = screen.getAllByText('Deploy Robot');
      expect(deployButtons).toHaveLength(1);
    });

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });
});
