/**
 * Unit Tests for DashboardPage
 *
 * Tests KPI cards render with correct values, trend indicators display,
 * battle type breakdowns render, facility breakdown shows all types,
 * and global filter toggles work.
 *
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from '../DashboardPage';

// ----------------------------------------------------------------
// Mock apiClient
// ----------------------------------------------------------------
const mockGet = vi.fn();

vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

// ----------------------------------------------------------------
// Mock useAdminStore
// ----------------------------------------------------------------
const mockFetchStats = vi.fn();

const defaultSystemStats = {
  robots: {
    total: 150,
    byTier: [
      { league: 'Bronze', count: 50 },
      { league: 'Silver', count: 40 },
      { league: 'Gold', count: 30 },
      { league: 'Platinum', count: 20 },
      { league: 'Diamond', count: 10 },
    ],
    battleReady: 120,
    battleReadyPercentage: 80.0,
  },
  matches: {
    scheduled: 25,
    completed: 200,
    byType: {
      league: { scheduled: 10, completed: 100 },
      tournament: { scheduled: 5, completed: 40 },
      tagTeam: { scheduled: 6, completed: 35 },
      koth: { scheduled: 4, completed: 25 },
    },
  },
  battles: {
    last24Hours: 42,
    total: 1500,
    draws: 150,
    drawPercentage: 10,
    avgDuration: 45,
    kills: 300,
    killPercentage: 20,
  },
  finances: {
    totalCredits: 500000,
    avgBalance: 3333,
    usersAtRisk: 5,
    totalUsers: 50,
  },
  facilities: {
    summary: [
      { type: 'repair_bay', purchaseCount: 30, avgLevel: 2.5 },
      { type: 'training_ground', purchaseCount: 25, avgLevel: 1.8 },
      { type: 'weapons_lab', purchaseCount: 20, avgLevel: 3.0 },
    ],
    totalPurchases: 75,
    mostPopular: 'repair_bay',
  },
  weapons: {
    totalBought: 200,
    equipped: 150,
  },
  stances: [
    { stance: 'aggressive', count: 40 },
    { stance: 'defensive', count: 35 },
    { stance: 'balanced', count: 50 },
  ],
  loadouts: [
    { type: 'heavy_armor', count: 30 },
    { type: 'light_speed', count: 45 },
  ],
  yieldThresholds: {
    distribution: [
      { threshold: 10, count: 5 },
      { threshold: 20, count: 15 },
      { threshold: 30, count: 25 },
    ],
    mostCommon: 30,
    mostCommonCount: 25,
  },
};

let mockStoreState = {
  systemStats: defaultSystemStats,
  statsLoading: false,
  fetchStats: mockFetchStats,
};

vi.mock('../../../stores/adminStore', () => ({
  useAdminStore: (selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

// ----------------------------------------------------------------
// Default KPI response
// ----------------------------------------------------------------
const defaultKpiResponse = {
  data: {
    inactivePlayers: 12,
    battlesToday: 42,
    scheduledMatches: 25,
    currentCycle: 100,
    trends: {
      inactivePlayers: 'up' as const,
      battlesToday: 'down' as const,
    },
  },
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      systemStats: defaultSystemStats,
      statsLoading: false,
      fetchStats: mockFetchStats,
    };
    mockGet.mockResolvedValue(defaultKpiResponse);
  });

  /**
   * Requirement 5.1: THE Dashboard page SHALL display a top row of KPI_Cards
   * showing: Inactive Real Players, Battles Today, Scheduled Matches,
   * Current Cycle number, and Cycle Status.
   */
  it('should render KPI cards with correct values from API response', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Inactive Real Players (3+ days)')).toBeInTheDocument();
    });

    // Verify KPI labels are present
    expect(screen.getByText('Inactive Real Players (3+ days)')).toBeInTheDocument();
    expect(screen.getByText('Battles Today')).toBeInTheDocument();
    expect(screen.getByText('Scheduled Matches')).toBeInTheDocument();
    expect(screen.getByText('Current Cycle')).toBeInTheDocument();

    // Verify KPI values appear (use getAllByText for values that appear in multiple sections)
    expect(screen.getByText('12')).toBeInTheDocument(); // Inactive Players (unique)

    // Battles Today (42) also appears in battles.last24Hours — use getAllByText
    const fortyTwos = screen.getAllByText('42');
    expect(fortyTwos.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * Requirement 5.2: WHEN a KPI_Card value has changed compared to the
   * previous cycle, THE Dashboard page SHALL display a trend indicator.
   */
  it('should display trend indicators on KPI cards', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    // Inactive Players has 'up' trend, Battles Today has 'down' trend
    const upTrend = screen.getByLabelText('Trend: up');
    expect(upTrend).toBeInTheDocument();

    const downTrend = screen.getByLabelText('Trend: down');
    expect(downTrend).toBeInTheDocument();
  });

  /**
   * Requirement 5.4: THE Dashboard page SHALL display battle statistics
   * broken down by battle type (League, Tournament, Tag Team, KotH).
   */
  it('should render battle type breakdown cards', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    // Battle Statistics section header
    expect(screen.getByText('⚔️ Battle Statistics')).toBeInTheDocument();

    // Overall battles card
    expect(screen.getByText('Overall Battles')).toBeInTheDocument();

    // Per-type cards
    expect(screen.getByText('League')).toBeInTheDocument();
    expect(screen.getByText('Tournament')).toBeInTheDocument();
    expect(screen.getByText('Tag Team')).toBeInTheDocument();
    expect(screen.getByText('KotH')).toBeInTheDocument();
  });

  it('should show scheduled and completed counts for each battle type', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('League')).toBeInTheDocument();
    });

    // Verify the Scheduled/Completed labels appear in battle type cards
    const scheduledLabels = screen.getAllByText('Scheduled:');
    const completedLabels = screen.getAllByText('Completed:');
    expect(scheduledLabels.length).toBe(4); // League, Tournament, Tag Team, KotH
    expect(completedLabels.length).toBe(4);
  });

  /**
   * Requirement 5.5: THE Dashboard page SHALL display a facility investment
   * breakdown showing ALL facility types with purchase count AND level
   * distribution.
   */
  it('should render facility breakdown table with all facility types', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Facility Investment/)).toBeInTheDocument();
    });

    // All facility types should be rendered (with underscores replaced by spaces)
    expect(screen.getByText('repair bay')).toBeInTheDocument();
    expect(screen.getByText('training ground')).toBeInTheDocument();
    expect(screen.getByText('weapons lab')).toBeInTheDocument();

    // Average levels — use getAllByText for values that may appear elsewhere
    expect(screen.getByText('2.5')).toBeInTheDocument();
    expect(screen.getByText('1.8')).toBeInTheDocument();
    const threePointZeros = screen.getAllByText('3.0');
    expect(threePointZeros.length).toBeGreaterThanOrEqual(1);

    // Table headers
    expect(screen.getByText('Facility Type')).toBeInTheDocument();
    expect(screen.getByText('Purchases')).toBeInTheDocument();
    expect(screen.getByText('Avg Level')).toBeInTheDocument();
  });

  it('should show total purchases count in facility section', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    expect(screen.getByText('(75 total purchases)')).toBeInTheDocument();
  });

  /**
   * Requirement 5.3: THE Dashboard page SHALL provide a global filter toggle
   * to switch between "Real Players Only", "Auto-Generated Only", and "All".
   */
  it('should render global filter toggle buttons', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    expect(screen.getByText('Real Players')).toBeInTheDocument();
    expect(screen.getByText('Auto-Generated')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('should have Real Players filter active by default', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    const realButton = screen.getByText('Real Players');
    expect(realButton).toHaveAttribute('aria-pressed', 'true');

    const autoButton = screen.getByText('Auto-Generated');
    expect(autoButton).toHaveAttribute('aria-pressed', 'false');

    const allButton = screen.getByText('All');
    expect(allButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('should re-fetch KPIs when filter is changed', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    // Initial fetch with 'real' filter
    expect(mockGet).toHaveBeenCalledWith('/api/admin/dashboard/kpis?filter=real');

    mockGet.mockClear();

    // Click "Auto-Generated" filter
    await user.click(screen.getByText('Auto-Generated'));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/admin/dashboard/kpis?filter=auto');
    });
  });

  it('should fetch KPIs from the API on mount', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/admin/dashboard/kpis?filter=real');
    });
  });

  it('should call fetchStats from admin store on mount', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockFetchStats).toHaveBeenCalled();
    });
  });

  it('should show loading state when stats and KPIs are not yet loaded', () => {
    mockStoreState = {
      systemStats: null,
      statsLoading: true,
      fetchStats: mockFetchStats,
    };
    mockGet.mockReturnValue(new Promise(() => {})); // Never resolves

    render(<DashboardPage />);

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('should render the page header with title and subtitle', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Operational overview')).toBeInTheDocument();
  });

  it('should render weapon economy section', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Weapon Economy/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Weapon Economy/)).toBeInTheDocument();
    expect(screen.getByText('Total Purchased')).toBeInTheDocument();
    expect(screen.getByText('Equipped')).toBeInTheDocument();
    expect(screen.getByText('Equip Rate')).toBeInTheDocument();
    expect(screen.getByText('Unequipped')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument(); // Equip Rate (150/200)
  });

  it('should render roster overview section', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    expect(screen.getByText(/Roster Overview/)).toBeInTheDocument();
    expect(screen.getByText('Total Robots')).toBeInTheDocument();
    expect(screen.getByText('Battle Ready')).toBeInTheDocument();
    expect(screen.getByText('Total Players')).toBeInTheDocument();
  });

  it('should render collapsible stance, loadout, and yield sections', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    expect(screen.getByText('Stance Distribution')).toBeInTheDocument();
    expect(screen.getByText('Loadout Distribution')).toBeInTheDocument();
    expect(screen.getByText('Yield Threshold Distribution')).toBeInTheDocument();
  });

  it('should display KPI error when API call fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should render overall battle stats with correct values', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    // Total battles
    expect(screen.getByText('1,500')).toBeInTheDocument();
    // Avg Duration
    expect(screen.getByText('45s')).toBeInTheDocument();
  });
});
