import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CycleComparisonPage from '../CycleComparisonPage';

// Mock the AuthContext
const mockNavigate = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser', currency: 1000 },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Navigation component
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

// Mock fetch
global.fetch = vi.fn();

const mockSummaryData = {
  userId: 1,
  cycleRange: [1, 10],
  totalIncome: 10000,
  totalExpenses: 5000,
  netProfit: 5000,
  cycles: [
    {
      cycleNumber: 10,
      income: 1000,
      expenses: 500,
      netProfit: 500,
      breakdown: {
        battleCredits: 800,
        merchandising: 100,
        streaming: 100,
        repairCosts: 300,
        operatingCosts: 200,
      },
    },
  ],
};

const mockComparisonData = {
  currentCycle: 10,
  comparisonCycle: 9,
  stableComparisons: [
    {
      userId: 1,
      battlesParticipated: { current: 5, comparison: 4, delta: 1, percentChange: 25 },
      totalCreditsEarned: { current: 800, comparison: 700, delta: 100, percentChange: 14.29 },
      totalPrestigeEarned: { current: 50, comparison: 45, delta: 5, percentChange: 11.11 },
      totalRepairCosts: { current: 300, comparison: 250, delta: 50, percentChange: 20 },
      merchandisingIncome: { current: 100, comparison: 90, delta: 10, percentChange: 11.11 },
      streamingIncome: { current: 100, comparison: 90, delta: 10, percentChange: 11.11 },
      operatingCosts: { current: 200, comparison: 180, delta: 20, percentChange: 11.11 },
      netProfit: { current: 500, comparison: 450, delta: 50, percentChange: 11.11 },
    },
  ],
};

const mockTrendData = {
  metric: 'income',
  cycleRange: [9, 10],
  data: [
    { cycleNumber: 9, value: 900, timestamp: '2024-01-01T00:00:00Z' },
    { cycleNumber: 10, value: 1000, timestamp: '2024-01-02T00:00:00Z' },
  ],
  movingAverage3: [
    { cycleNumber: 9, value: 900, average: 900 },
    { cycleNumber: 10, value: 1000, average: 950 },
  ],
  trendLine: {
    slope: 50,
    intercept: 850,
    points: [
      { cycleNumber: 9, value: 900 },
      { cycleNumber: 10, value: 950 },
    ],
  },
};

describe('CycleComparisonPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(() => '1'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Default mock implementation for fetch
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSummaryData),
        });
      }
      if (url.includes('/comparison')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockComparisonData),
        });
      }
      if (url.includes('/trends')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTrendData),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  const renderCycleComparisonPage = () => {
    return render(
      <BrowserRouter>
        <CycleComparisonPage />
      </BrowserRouter>
    );
  };

  describe('Component Rendering', () => {
    it('should render the page title', async () => {
      renderCycleComparisonPage();

      await waitFor(() => {
        expect(screen.getByText('Cycle Comparison')).toBeInTheDocument();
      });
    });

    it('should display loading state initially', () => {
      renderCycleComparisonPage();
      expect(screen.getByText('Loading comparison data...')).toBeInTheDocument();
    });

    it('should display comparison data after loading', async () => {
      renderCycleComparisonPage();

      await waitFor(() => {
        expect(screen.getByText('Cycle Comparison')).toBeInTheDocument();
      });

      // Check that comparison cycle info is displayed
      expect(screen.getByText(/Comparing Cycle 10 vs Cycle 9/)).toBeInTheDocument();
    });

    it('should display income metrics', async () => {
      renderCycleComparisonPage();

      await waitFor(() => {
        expect(screen.getByText('Income Metrics')).toBeInTheDocument();
      });

      expect(screen.getByText('Battle Credits')).toBeInTheDocument();
      expect(screen.getByText('Merchandising')).toBeInTheDocument();
      expect(screen.getByText('Streaming')).toBeInTheDocument();
    });

    it('should display expense metrics', async () => {
      renderCycleComparisonPage();

      await waitFor(() => {
        expect(screen.getByText('Expense Metrics')).toBeInTheDocument();
      });

      expect(screen.getByText('Repair Costs')).toBeInTheDocument();
      expect(screen.getByText('Operating Costs')).toBeInTheDocument();
    });

    it('should display net profit', async () => {
      renderCycleComparisonPage();

      await waitFor(() => {
        expect(screen.getAllByText('Net Profit').length).toBeGreaterThan(0);
      });
    });

    it('should display trend analysis section', async () => {
      renderCycleComparisonPage();

      await waitFor(() => {
        expect(screen.getByText('Trend Analysis')).toBeInTheDocument();
      });

      expect(screen.getByText('Income Trend')).toBeInTheDocument();
      expect(screen.getByText('Expenses Trend')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      (global.fetch as any).mockImplementation(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Failed to fetch data' }),
        })
      );

      renderCycleComparisonPage();

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch latest cycle')).toBeInTheDocument();
      });
    });

    it('should display error when user is not logged in', async () => {
      const localStorageMock = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      });

      renderCycleComparisonPage();

      await waitFor(() => {
        expect(screen.getByText('User not logged in')).toBeInTheDocument();
      });
    });
  });

  describe('Comparison Type Selection', () => {
    it('should display comparison type buttons', async () => {
      renderCycleComparisonPage();

      await waitFor(() => {
        expect(screen.getByText('Compare with:')).toBeInTheDocument();
      });

      expect(screen.getByText(/Yesterday/)).toBeInTheDocument();
      expect(screen.getByText(/Week Ago/)).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should have a back to dashboard button', async () => {
      renderCycleComparisonPage();

      await waitFor(() => {
        expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
      });
    });

    it('should have a view summary button', async () => {
      renderCycleComparisonPage();

      await waitFor(() => {
        expect(screen.getByText('View Summary')).toBeInTheDocument();
      });
    });
  });
});
