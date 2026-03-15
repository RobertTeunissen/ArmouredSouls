import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CycleControlsTab } from '../CycleControlsTab';
import type { SessionLogEntry } from '../types';

// Mock apiClient — CycleControlsTab posts to /api/admin/* endpoints
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Mock AuthContext — CycleControlsTab calls refreshUser after some operations
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshUser: vi.fn(),
  }),
}));

/* ------------------------------------------------------------------ */
/*  Mock session log entries                                           */
/* ------------------------------------------------------------------ */

const mockSessionLog: SessionLogEntry[] = [
  {
    timestamp: '2025-01-15T10:00:00.000Z',
    type: 'success',
    message: 'Matchmaking completed! Created 12 matches',
  },
  {
    timestamp: '2025-01-15T10:01:00.000Z',
    type: 'error',
    message: 'Battle execution failed: timeout',
  },
  {
    timestamp: '2025-01-15T10:02:00.000Z',
    type: 'warning',
    message: 'Cycle 5: Step 4 - 2 failed battles',
  },
  {
    timestamp: '2025-01-15T10:03:00.000Z',
    type: 'info',
    message: 'Starting bulk cycle run: 3 cycle(s)',
    details: { includeTournaments: true },
  },
];

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('CycleControlsTab', () => {
  const defaultProps = {
    addSessionLog: vi.fn(),
    sessionLog: [] as SessionLogEntry[],
    clearSessionLog: vi.fn(),
    exportSessionLog: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all cycle control buttons', () => {
    render(<CycleControlsTab {...defaultProps} />);

    expect(screen.getByRole('button', { name: /run matchmaking/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /execute battles/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rebalance leagues/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auto-repair all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /process daily finances/i })).toBeInTheDocument();
  });

  it('should render bulk cycle runner section', () => {
    render(<CycleControlsTab {...defaultProps} />);

    expect(screen.getByText('Bulk Cycle Testing')).toBeInTheDocument();
    expect(screen.getByText(/Number of Cycles/)).toBeInTheDocument();
    expect(screen.getByText(/Auto-repair before each cycle/)).toBeInTheDocument();
    expect(screen.getByText(/Include tournament execution/)).toBeInTheDocument();
    expect(screen.getByText(/Include daily finances processing/)).toBeInTheDocument();
    expect(screen.getByText(/Generate users per cycle/)).toBeInTheDocument();
    // The bulk run button
    expect(screen.getByRole('button', { name: /run 1 cycle/i })).toBeInTheDocument();
  });

  it('should render session log with entries', () => {
    render(<CycleControlsTab {...defaultProps} sessionLog={mockSessionLog} />);

    expect(screen.getByText(/Matchmaking completed! Created 12 matches/)).toBeInTheDocument();
    expect(screen.getByText(/Battle execution failed: timeout/)).toBeInTheDocument();
    expect(screen.getByText(/Cycle 5: Step 4 - 2 failed battles/)).toBeInTheDocument();
    expect(screen.getByText(/Starting bulk cycle run: 3 cycle\(s\)/)).toBeInTheDocument();
  });

  it('should render empty session log state', () => {
    render(<CycleControlsTab {...defaultProps} sessionLog={[]} />);

    expect(screen.getByText('No log entries')).toBeInTheDocument();
  });

  it('should call clearSessionLog when clear button clicked', async () => {
    const user = userEvent.setup();
    const clearSessionLog = vi.fn();

    render(
      <CycleControlsTab
        {...defaultProps}
        sessionLog={mockSessionLog}
        clearSessionLog={clearSessionLog}
      />,
    );

    const clearButton = screen.getByRole('button', { name: /clear/i });
    await user.click(clearButton);

    expect(clearSessionLog).toHaveBeenCalledTimes(1);
  });

  it('should call exportSessionLog when export button clicked', async () => {
    const user = userEvent.setup();
    const exportSessionLog = vi.fn();

    render(
      <CycleControlsTab
        {...defaultProps}
        sessionLog={mockSessionLog}
        exportSessionLog={exportSessionLog}
      />,
    );

    const exportButton = screen.getByRole('button', { name: /export/i });
    await user.click(exportButton);

    expect(exportSessionLog).toHaveBeenCalledTimes(1);
  });
});
