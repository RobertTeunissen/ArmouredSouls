/**
 * Bug Condition Exploration Tests — Admin Page Structural and Functional Defects
 *
 * These tests encode the EXPECTED (correct) behavior of the Admin Page.
 * They are designed to FAIL on unfixed code, confirming the bugs exist.
 * After the fix is implemented, these same tests will PASS.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.7, 1.9**
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import AdminPage from '../AdminPage';

// Mock apiClient so the module-level interceptor setup doesn't crash
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
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

// Mock Navigation component
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

// Mock SystemHealthPage
vi.mock('../SystemHealthPage', () => ({
  default: () => <div data-testid="system-health-page">System Health</div>,
}));

// Mock TournamentManagement
vi.mock('../../components/TournamentManagement', () => ({
  default: () => <div data-testid="tournament-management">Tournaments</div>,
}));

// Mock BattleDetailsModal
vi.mock('../../components/BattleDetailsModal', () => ({
  default: () => <div data-testid="battle-details-modal">Battle Details</div>,
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    create: vi.fn(),
  },
}));

const renderAdminPage = () => {
  return render(
    <BrowserRouter>
      <AdminPage />
    </BrowserRouter>
  );
};

describe('Bug Condition Exploration — Admin Page Structural and Functional Defects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.getItem = vi.fn().mockReturnValue(null);
    localStorage.setItem = vi.fn();
    window.location.hash = '';
  });

  /**
   * Test 1: Tab bar should contain "Bankruptcy Monitor" tab
   * Bug 1.2: Currently has "System Health" instead of "Bankruptcy Monitor"
   * **Validates: Requirements 1.2**
   */
  it('should render a "Bankruptcy Monitor" tab in the tab bar', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        renderAdminPage();
        const tabs = screen.getAllByRole('tab');
        const tabLabels = tabs.map((tab) => tab.textContent?.trim() ?? '');
        expect(tabLabels.some((label) => label.includes('Bankruptcy Monitor'))).toBe(true);
      }),
      { numRuns: 1 }
    );
  });

  /**
   * Test 2: No system-health tab should exist in the tab bar
   * Bug 1.9: System Health tab currently exists but should be folded into Dashboard
   * **Validates: Requirements 1.9**
   */
  it('should NOT have a system-health tab in the tab bar', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        renderAdminPage();
        const systemHealthTab = screen.queryByRole('tab', { name: /system health/i });
        expect(systemHealthTab).toBeNull();
      }),
      { numRuns: 1 }
    );
  });

  /**
   * Test 3: Header should NOT contain a link to /admin/onboarding-analytics
   * Bug 1.3: The onboarding analytics link currently exists in the header
   * **Validates: Requirements 1.3**
   */
  it('should NOT contain a link to /admin/onboarding-analytics in the header', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        renderAdminPage();
        const onboardingLink = document.querySelector('a[href="/admin/onboarding-analytics"]');
        expect(onboardingLink).toBeNull();
      }),
      { numRuns: 1 }
    );
  });

  /**
   * Test 4: Battle type filter should include a "Tag Team" option
   * Bug 1.7: Currently only "All", "League", "Tournament" exist
   * **Validates: Requirements 1.7**
   */
  it('should have a "Tag Team" option in the battle type filter dropdown', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        renderAdminPage();
        // Switch to battles tab to render the filter
        const battlesTab = screen.getByRole('tab', { name: /battle logs/i });
        act(() => {
          battlesTab.click();
        });

        // Look for the Tag Team option in any select element
        const allOptions = document.querySelectorAll('option');
        const optionTexts = Array.from(allOptions).map((opt) => opt.textContent?.trim() ?? '');
        expect(optionTexts.some((text) => /tag\s*team/i.test(text))).toBe(true);
      }),
      { numRuns: 1 }
    );
  });

  /**
   * Test 5: AdminPage.test.tsx should NOT contain describe.skip
   * Bug 1.5: The entire test suite is currently skipped
   * **Validates: Requirements 1.5**
   */
  it('should NOT have describe.skip in AdminPage.test.tsx', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const testFilePath = path.resolve(__dirname, 'AdminPage.test.tsx');
        const content = fs.readFileSync(testFilePath, 'utf-8');
        expect(content).not.toMatch(/describe\.skip/);
      }),
      { numRuns: 1 }
    );
  });

  /**
   * Test 6: Separate tab component files should exist in components/admin/
   * Bug: Monolithic AdminPage.tsx with no component decomposition
   * **Validates: Requirements 1.1**
   */
  it('should have separate tab component files in components/admin/ directory', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const adminComponentsDir = path.resolve(__dirname, '../../components/admin');
        const expectedFiles = [
          'DashboardTab.tsx',
          'CycleControlsTab.tsx',
          'BattleLogsTab.tsx',
          'RobotStatsTab.tsx',
          'BankruptcyMonitorTab.tsx',
          'RecentUsersTab.tsx',
        ];

        const dirExists = fs.existsSync(adminComponentsDir);
        expect(dirExists).toBe(true);

        if (dirExists) {
          const files = fs.readdirSync(adminComponentsDir);
          for (const expectedFile of expectedFiles) {
            expect(files).toContain(expectedFile);
          }
        }
      }),
      { numRuns: 1 }
    );
  });
});
