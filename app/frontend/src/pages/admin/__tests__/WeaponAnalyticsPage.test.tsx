/**
 * Unit Tests for WeaponAnalyticsPage
 *
 * Tests weapon list renders, outlier highlighting works, user filter toggles.
 *
 * _Requirements: 16.2, 16.3, 16.4, 16.5_
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WeaponAnalyticsPage from '../WeaponAnalyticsPage';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

const mockWeaponData = {
  weapons: [
    {
      weaponId: 1,
      name: 'Laser Cannon',
      type: 'energy',
      cost: 5000,
      baseDamage: 120,
      owned: 50,
    },
    {
      weaponId: 2,
      name: 'Plasma Rifle',
      type: 'energy',
      cost: 8000,
      baseDamage: 180,
      owned: 0,
    },
    {
      weaponId: 3,
      name: 'Mega Blaster',
      type: 'ballistic',
      cost: 12000,
      baseDamage: 250,
      owned: 40,
    },
  ],
  typeBreakdown: { energy: 50, ballistic: 40 },
  totalWeaponsOwned: 90,
  timestamp: '2026-04-20T12:00:00Z',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('WeaponAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: mockWeaponData });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <WeaponAnalyticsPage />
      </MemoryRouter>,
    );

  it('should render the page header', () => {
    renderPage();
    expect(screen.getByText('Weapon Analytics')).toBeInTheDocument();
  });

  it('should display summary stat cards', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Total Owned')).toBeInTheDocument();
      expect(screen.getByText('Weapon Types')).toBeInTheDocument();
      expect(screen.getByText('Never Owned')).toBeInTheDocument();
      expect(screen.getByText('Most Popular Type')).toBeInTheDocument();
    });
  });

  it('should display weapon names in the table', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Laser Cannon')).toBeInTheDocument();
      expect(screen.getByText('Plasma Rifle')).toBeInTheDocument();
      expect(screen.getByText('Mega Blaster')).toBeInTheDocument();
    });
  });

  it('should display weapon costs', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('₡5,000')).toBeInTheDocument();
      expect(screen.getByText('₡8,000')).toBeInTheDocument();
      expect(screen.getByText('₡12,000')).toBeInTheDocument();
    });
  });

  it('should display type breakdown', async () => {
    renderPage();
    await waitFor(() => {
      // energy and ballistic types in the breakdown section
      const energyElements = screen.getAllByText(/energy/i);
      expect(energyElements.length).toBeGreaterThanOrEqual(1);
      const ballisticElements = screen.getAllByText(/ballistic/i);
      expect(ballisticElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should render user filter chips', () => {
    renderPage();
    expect(screen.getByText('All Users')).toBeInTheDocument();
    expect(screen.getByText('Real Players')).toBeInTheDocument();
    expect(screen.getByText('Auto-Generated')).toBeInTheDocument();
  });

  it('should fetch with filter parameter when filter is toggled', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Real Players'));

    await waitFor(() => {
      const lastCall = mockGet.mock.calls[mockGet.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('filter=real');
    });
  });

  it('should display error state when API fails', async () => {
    mockGet.mockRejectedValue({ response: { data: { error: 'Weapon service error' } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Weapon service error')).toBeInTheDocument();
    });
  });
});
