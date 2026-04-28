/**
 * Unit Tests for EconomyOverviewPage
 *
 * Tests credit circulation displays, inflation rate renders, trend data shows.
 *
 * _Requirements: 14.2, 14.3, 14.4_
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EconomyOverviewPage from '../EconomyOverviewPage';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

const mockEconomyData = {
  totalCreditsInCirculation: 5000000,
  averageBalance: 15000,
  medianBalance: 12000,
  usersAtBankruptcyRisk: 3,
  totalUsers: 50,
  facilities: [
    {
      type: 'repair_bay',
      owners: 30,
      avgLevel: 2,
      maxLevel: 5,
      levelDistribution: [
        { level: 1, count: 10 },
        { level: 2, count: 12 },
        { level: 3, count: 8 },
      ],
    },
    {
      type: 'training_ground',
      owners: 20,
      avgLevel: 1,
      maxLevel: 3,
      levelDistribution: [
        { level: 1, count: 15 },
        { level: 2, count: 5 },
      ],
    },
  ],
  timestamp: '2026-04-20T12:00:00Z',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('EconomyOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: mockEconomyData });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <EconomyOverviewPage />
      </MemoryRouter>,
    );

  it('should render the page header', () => {
    renderPage();
    expect(screen.getByText('Economy Overview')).toBeInTheDocument();
  });

  it('should display credits in circulation', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Credits in Circulation')).toBeInTheDocument();
      const creditElements = screen.getAllByText('₡5.0M');
      expect(creditElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should display average balance', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Average Balance')).toBeInTheDocument();
      expect(screen.getByText('₡15.0K')).toBeInTheDocument();
    });
  });

  it('should display median balance', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Median Balance')).toBeInTheDocument();
      expect(screen.getByText('₡12.0K')).toBeInTheDocument();
    });
  });

  it('should display bankruptcy risk', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Bankruptcy Risk')).toBeInTheDocument();
      expect(screen.getByText('3 (6.0%)')).toBeInTheDocument();
    });
  });

  it('should display facility popularity section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Facility Popularity')).toBeInTheDocument();
      expect(screen.getByText('Repair Bay')).toBeInTheDocument();
      expect(screen.getByText('Training Ground')).toBeInTheDocument();
    });
  });

  it('should fetch from the economy overview endpoint', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/admin/economy/overview');
    });
  });

  it('should display error state when API fails', async () => {
    mockGet.mockRejectedValue({ response: { data: { error: 'Economy service down' } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Economy service down')).toBeInTheDocument();
    });
  });
});
