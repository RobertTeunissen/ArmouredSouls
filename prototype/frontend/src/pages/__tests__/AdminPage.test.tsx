import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminPage from '../AdminPage';

// Mock apiClient
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshUser: vi.fn(),
    user: { id: 1, username: 'admin', role: 'admin', currency: 50000 },
    token: 'mock-token',
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  }),
}));

// Mock Navigation
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

// Mock all tab components
vi.mock('../../components/admin', () => ({
  DashboardTab: () => <div data-testid="dashboard-tab-content">Dashboard</div>,
  CycleControlsTab: () => <div data-testid="cycles-tab-content">Cycle Controls</div>,
  BattleLogsTab: () => <div data-testid="battles-tab-content">Battle Logs</div>,
  RobotStatsTab: () => <div data-testid="stats-tab-content">Robot Stats</div>,
  BankruptcyMonitorTab: () => <div data-testid="bankruptcy-monitor-tab-content">Bankruptcy Monitor</div>,
  RecentUsersTab: () => <div data-testid="recent-users-tab-content">Recent Users</div>,
}));

vi.mock('../../components/TournamentManagement', () => ({
  default: () => <div data-testid="tournaments-tab-content">Tournaments</div>,
}));

const TAB_LABELS = [
  '📊 Dashboard',
  '⚙️ Cycle Controls',
  '🏆 Tournaments',
  '⚔️ Battle Logs',
  '🤖 Robot Stats',
  '💰 Bankruptcy Monitor',
  '👥 Recent Users',
];

function renderAdminPage() {
  return render(
    <BrowserRouter>
      <AdminPage />
    </BrowserRouter>,
  );
}

describe('AdminPage shell', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockClear();
    window.location.hash = '';
  });

  it('should render all 7 tab buttons', () => {
    renderAdminPage();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(7);
    for (const label of TAB_LABELS) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('should render Dashboard tab by default', () => {
    renderAdminPage();
    expect(screen.getByTestId('dashboard-tab-content')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '📊 Dashboard' })).toHaveAttribute('aria-selected', 'true');
  });

  it('should switch tabs when clicking tab buttons', async () => {
    const user = userEvent.setup();
    renderAdminPage();

    const cases: Array<{ label: string; testId: string }> = [
      { label: '⚙️ Cycle Controls', testId: 'cycles-tab-content' },
      { label: '🏆 Tournaments', testId: 'tournaments-tab-content' },
      { label: '⚔️ Battle Logs', testId: 'battles-tab-content' },
      { label: '🤖 Robot Stats', testId: 'stats-tab-content' },
      { label: '💰 Bankruptcy Monitor', testId: 'bankruptcy-monitor-tab-content' },
      { label: '👥 Recent Users', testId: 'recent-users-tab-content' },
    ];

    for (const { label, testId } of cases) {
      await user.click(screen.getByRole('tab', { name: label }));
      expect(screen.getByTestId(testId)).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
    }
  });

  it('should persist active tab to localStorage', async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByRole('tab', { name: '⚔️ Battle Logs' }));
    expect(localStorage.setItem).toHaveBeenCalledWith('adminActiveTab', 'battles');
  });

  it('should update URL hash when switching tabs', async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByRole('tab', { name: '🤖 Robot Stats' }));
    expect(window.location.hash).toBe('stats');
  });

  it('should restore tab from URL hash on load', () => {
    window.location.hash = '#battles';
    renderAdminPage();

    expect(screen.getByTestId('battles-tab-content')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '⚔️ Battle Logs' })).toHaveAttribute('aria-selected', 'true');
  });

  it('should restore tab from localStorage when no hash', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
      key === 'adminActiveTab' ? 'stats' : null,
    );
    renderAdminPage();

    expect(screen.getByTestId('stats-tab-content')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '🤖 Robot Stats' })).toHaveAttribute('aria-selected', 'true');
  });

  it('should not render system-health tab', () => {
    renderAdminPage();
    const tabs = screen.getAllByRole('tab');
    const tabNames = tabs.map((t) => t.textContent);
    expect(tabNames.join(',')).not.toContain('System Health');
    expect(screen.queryByRole('tab', { name: /system.?health/i })).not.toBeInTheDocument();
  });

  it('should not render onboarding analytics link', () => {
    renderAdminPage();
    expect(screen.queryByRole('link', { name: /onboarding/i })).not.toBeInTheDocument();
  });
});
