/**
 * Unit Tests for TuningAdoptionPage
 *
 * Tests adoption stats render, per-player summary displays, filters toggle.
 *
 * _Requirements: 18.2, 18.3, 18.4_
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TuningAdoptionPage from '../TuningAdoptionPage';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

const mockTuningData = {
  robotsWithTuning: 30,
  totalRobots: 50,
  adoptionRate: 60,
  totalAllocations: 120,
  attributeRanking: [
    { attribute: 'combatPower', totalPoints: 150.5 },
    { attribute: 'armorPlating', totalPoints: 120.0 },
    { attribute: 'targeting', totalPoints: 80.3 },
  ],
  timestamp: '2026-04-20T12:00:00Z',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('TuningAdoptionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: mockTuningData });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <TuningAdoptionPage />
      </MemoryRouter>,
    );

  it('should render the page header', () => {
    renderPage();
    expect(screen.getByText('Tuning Adoption')).toBeInTheDocument();
  });

  it('should display aggregate stat cards', async () => {
    renderPage();
    await waitFor(() => {
      const robotsWithTuning = screen.getAllByText('Robots with Tuning');
      expect(robotsWithTuning.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('Total Robots')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('Adoption Rate')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });
  });

  it('should display attribute ranking table', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Attribute Tuning Ranking')).toBeInTheDocument();
      expect(screen.getByText(/combat Power/i)).toBeInTheDocument();
      expect(screen.getByText(/armor Plating/i)).toBeInTheDocument();
      expect(screen.getByText(/targeting/i)).toBeInTheDocument();
    });
  });

  it('should display total points per attribute', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('150.5')).toBeInTheDocument();
      expect(screen.getByText('120.0')).toBeInTheDocument();
      expect(screen.getByText('80.3')).toBeInTheDocument();
    });
  });

  it('should render user filter chips', () => {
    renderPage();
    expect(screen.getByText('Real Players')).toBeInTheDocument();
    expect(screen.getByText('Auto-Generated')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('should fetch with filter parameter when filter is toggled', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Auto-Generated'));

    await waitFor(() => {
      const lastCall = mockGet.mock.calls[mockGet.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('filter=auto');
    });
  });

  it('should fetch from the tuning adoption endpoint', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/tuning/adoption'),
      );
    });
  });

  it('should display error state when API fails', async () => {
    mockGet.mockRejectedValue({ response: { data: { error: 'Tuning service error' } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Tuning service error')).toBeInTheDocument();
    });
  });
});
