/**
 * Unit Tests for CycleControlsPage
 *
 * Tests scheduler status panel renders, production job buttons trigger
 * confirmation, bulk runner section renders, session log panel toggles.
 *
 * _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7, 8.8_
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CycleControlsPage from '../CycleControlsPage';

// ----------------------------------------------------------------
// Mock apiClient
// ----------------------------------------------------------------
const mockPost = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

// ----------------------------------------------------------------
// Mock useAuth
// ----------------------------------------------------------------
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ refreshUser: vi.fn() }),
}));

// ----------------------------------------------------------------
// Mock useAdminStore
// ----------------------------------------------------------------
const mockFetchSchedulerStatus = vi.fn();
const mockAddSessionLog = vi.fn();
const mockClearSessionLog = vi.fn();
const mockExportSessionLog = vi.fn();

const defaultSchedulerStatus = {
  active: true,
  runningJob: null,
  queue: [],
  jobs: [
    { name: 'league', schedule: '0 8 * * *', lastRunAt: '2025-01-01T00:00:00Z', lastRunDurationMs: 5000, lastRunStatus: 'success' as const, lastError: null, nextRunAt: '2025-01-02T08:00:00Z' },
    { name: 'tournament', schedule: '0 10 * * *', lastRunAt: null, lastRunDurationMs: null, lastRunStatus: null, lastError: null, nextRunAt: '2025-01-01T10:00:00Z' },
    { name: 'tagTeam', schedule: '0 11 * * *', lastRunAt: null, lastRunDurationMs: null, lastRunStatus: null, lastError: null, nextRunAt: '2025-01-01T11:00:00Z' },
    { name: 'koth', schedule: '0 13 * * *', lastRunAt: null, lastRunDurationMs: null, lastRunStatus: null, lastError: null, nextRunAt: '2025-01-01T13:00:00Z' },
    { name: 'settlement', schedule: '0 0 * * *', lastRunAt: null, lastRunDurationMs: null, lastRunStatus: null, lastError: null, nextRunAt: '2025-01-02T00:00:00Z' },
    { name: 'team2v2League', schedule: '0 9 * * *', lastRunAt: null, lastRunDurationMs: null, lastRunStatus: null, lastError: null, nextRunAt: null },
    { name: 'team3v3League', schedule: '0 14 * * *', lastRunAt: null, lastRunDurationMs: null, lastRunStatus: null, lastError: null, nextRunAt: null },
    { name: 'grandMelee', schedule: '0 17 * * *', lastRunAt: null, lastRunDurationMs: null, lastRunStatus: null, lastError: null, nextRunAt: null },
  ],
};

let mockStoreState = {
  schedulerStatus: defaultSchedulerStatus,
  fetchSchedulerStatus: mockFetchSchedulerStatus,
  sessionLog: [] as { timestamp: string; type: string; message: string; details?: unknown }[],
  addSessionLog: mockAddSessionLog,
  clearSessionLog: mockClearSessionLog,
  exportSessionLog: mockExportSessionLog,
};

vi.mock('../../../stores/adminStore', () => ({
  useAdminStore: (selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('CycleControlsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      schedulerStatus: defaultSchedulerStatus,
      fetchSchedulerStatus: mockFetchSchedulerStatus,
      sessionLog: [],
      addSessionLog: mockAddSessionLog,
      clearSessionLog: mockClearSessionLog,
      exportSessionLog: mockExportSessionLog,
    };
    mockPost.mockResolvedValue({ data: {} });
  });

  it('should render the page header', () => {
    render(<CycleControlsPage />);
    expect(screen.getByText('Cycle Controls')).toBeInTheDocument();
  });

  it('should render scheduler status panel with job details', () => {
    render(<CycleControlsPage />);
    expect(screen.getByTestId('scheduler-status-panel')).toBeInTheDocument();
    expect(screen.getByText('1v1 League')).toBeInTheDocument();
    expect(screen.getByText('1v1 Tournament')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should render scheduler status cards', () => {
    render(<CycleControlsPage />);
    expect(screen.getByText('Scheduler')).toBeInTheDocument();
    expect(screen.getByText('Running Job')).toBeInTheDocument();
    expect(screen.getByText('Scheduled Jobs')).toBeInTheDocument();
  });

  it('should render Run buttons for live events in the scheduler table', () => {
    render(<CycleControlsPage />);
    // The scheduler table shows Run buttons for live (non-reserved) events
    const runButtons = screen.getAllByText('Run');
    expect(runButtons.length).toBeGreaterThan(0);
  });

  it('should show confirmation dialog when a Run button is clicked', async () => {
    const user = userEvent.setup();
    render(<CycleControlsPage />);

    const runButtons = screen.getAllByText('Run');
    await user.click(runButtons[0]);

    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should dismiss confirmation dialog on cancel', async () => {
    const user = userEvent.setup();
    render(<CycleControlsPage />);

    const runButtons = screen.getAllByText('Run');
    await user.click(runButtons[0]);
    expect(screen.getByText('Confirm')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
  });

  it('should render bulk cycle testing section', () => {
    render(<CycleControlsPage />);
    expect(screen.getByText('Bulk Cycle Testing')).toBeInTheDocument();
    expect(screen.getByText(/Cycles:/)).toBeInTheDocument();
  });

  it('should render session log toggle button', () => {
    render(<CycleControlsPage />);
    expect(screen.getByText(/Session Log/)).toBeInTheDocument();
  });

  it('should toggle session log panel open and closed', async () => {
    const user = userEvent.setup();
    render(<CycleControlsPage />);

    // Initially closed — "No log entries" should not be visible
    expect(screen.queryByText('No log entries')).not.toBeInTheDocument();

    // Open session log
    await user.click(screen.getByText(/Session Log/));
    expect(screen.getByText('No log entries')).toBeInTheDocument();

    // Close session log
    await user.click(screen.getByText(/Session Log/));
    expect(screen.queryByText('No log entries')).not.toBeInTheDocument();
  });

  it('should fetch scheduler status on mount', () => {
    render(<CycleControlsPage />);
    expect(mockFetchSchedulerStatus).toHaveBeenCalled();
  });

  it('should show loading state when scheduler status is null', () => {
    mockStoreState = { ...mockStoreState, schedulerStatus: null as unknown as typeof defaultSchedulerStatus };
    render(<CycleControlsPage />);
    expect(screen.getByText('Loading scheduler status...')).toBeInTheDocument();
  });

  // Team 2v2/3v3 League active buttons tests (R11.2–R11.9)
  it('should show Team 2v2 League as active with Run button (not reserved badge)', () => {
    render(<CycleControlsPage />);
    expect(screen.getByText('Team 2v2 League')).toBeInTheDocument();
    // The row for team2v2League should NOT have a "Reserved" badge
    const team2v2Row = screen.getByText('Team 2v2 League').closest('tr');
    expect(team2v2Row).not.toBeNull();
    expect(team2v2Row!.textContent).not.toContain('Reserved');
    // It should have a Run button
    const runButton = team2v2Row!.querySelector('button');
    expect(runButton).not.toBeNull();
    expect(runButton!.textContent).toBe('Run');
  });

  it('should show Team 3v3 League as active with Run button (not reserved badge)', () => {
    render(<CycleControlsPage />);
    expect(screen.getByText('Team 3v3 League')).toBeInTheDocument();
    // The row for team3v3League should NOT have a "Reserved" badge
    const team3v3Row = screen.getByText('Team 3v3 League').closest('tr');
    expect(team3v3Row).not.toBeNull();
    expect(team3v3Row!.textContent).not.toContain('Reserved');
    // It should have a Run button
    const runButton = team3v3Row!.querySelector('button');
    expect(runButton).not.toBeNull();
    expect(runButton!.textContent).toBe('Run');
  });

  it('should show confirmation dialog for 2v2 League Run button', async () => {
    const user = userEvent.setup();
    render(<CycleControlsPage />);

    const team2v2Row = screen.getByText('Team 2v2 League').closest('tr');
    const runButton = team2v2Row!.querySelector('button')!;
    await user.click(runButton);

    expect(screen.getByText('Run 2v2 League Cycle')).toBeInTheDocument();
    expect(screen.getByText('Repair → Battles → Rebalance → Matchmaking (same as cron). Continue?')).toBeInTheDocument();
  });

  it('should show confirmation dialog for 3v3 League Run button', async () => {
    const user = userEvent.setup();
    render(<CycleControlsPage />);

    const team3v3Row = screen.getByText('Team 3v3 League').closest('tr');
    const runButton = team3v3Row!.querySelector('button')!;
    await user.click(runButton);

    expect(screen.getByText('Run 3v3 League Cycle')).toBeInTheDocument();
    expect(screen.getByText('Repair → Battles → Rebalance → Matchmaking (same as cron). Continue?')).toBeInTheDocument();
  });

  it('should show Grand Melee as active with Run button (not reserved badge)', () => {
    render(<CycleControlsPage />);
    expect(screen.getByText('Grand Melee')).toBeInTheDocument();
    const grandMeleeRow = screen.getByText('Grand Melee').closest('tr');
    expect(grandMeleeRow).not.toBeNull();
    expect(grandMeleeRow!.textContent).not.toContain('Reserved');
    // It should have a Run button
    const runButton = grandMeleeRow!.querySelector('button');
    expect(runButton).not.toBeNull();
    expect(runButton!.textContent).toBe('Run');
  });
});
