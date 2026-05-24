/**
 * Unit Tests for RefinementAdoptionPage.
 *
 * Verifies aggregate stats render, tier breakdown shows all four tiers, the
 * filter bar toggles the API query parameter, and error states surface a
 * retry affordance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RefinementAdoptionPage from '../RefinementAdoptionPage';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

const mockData = {
  usersWithRefinements: 12,
  totalUsers: 50,
  adoptionRate: 24,
  totalRefinements: 38,
  totalRefinedWeapons: 17,
  totalCreditsSpent: 4_500_000,
  tierBreakdown: [
    { tier: 'hone',    refinementCount: 19, uniqueUsers: 10, totalMagnitude: 42 },
    { tier: 'augment', refinementCount: 8,  uniqueUsers: 6,  totalMagnitude: 16 },
    { tier: 'sharpen', refinementCount: 7,  uniqueUsers: 5,  totalMagnitude: 7 },
    { tier: 'forge',   refinementCount: 4,  uniqueUsers: 3,  totalMagnitude: 4 },
  ],
  attributeRanking: [
    { attribute: 'combatPower', refinementCount: 11, uniqueUsers: 9, totalMagnitude: 28 },
    { attribute: 'attackSpeed', refinementCount: 6,  uniqueUsers: 4, totalMagnitude: 14 },
  ],
  topSpenders: [
    { userId: 1, username: 'topPlayer', totalSpent: 1_200_000, weaponCount: 3 },
    { userId: 2, username: 'secondPlace', totalSpent: 800_000, weaponCount: 2 },
  ],
  timestamp: '2026-05-23T12:00:00.000Z',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('RefinementAdoptionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: mockData });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <RefinementAdoptionPage />
      </MemoryRouter>,
    );

  it('renders the page header', () => {
    renderPage();
    expect(screen.getByText('Refinement Adoption')).toBeInTheDocument();
  });

  it('fetches from the refinement adoption endpoint with default real filter', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        '/api/admin/refinement/adoption',
        expect.objectContaining({ params: { filter: 'real' } }),
      );
    });
  });

  it('displays aggregate stat cards with formatted values', async () => {
    renderPage();
    await waitFor(() => {
      // Each label is unique to its stat card; the value lives in the same card.
      // Use the label text to scope the assertion to that card.
      const usersCard = screen.getByText('Users with Refinements').closest('div')!;
      expect(within(usersCard.parentElement!).getByText('12')).toBeInTheDocument();

      const adoptionCard = screen.getByText('Adoption Rate').closest('div')!;
      expect(within(adoptionCard.parentElement!).getByText('24%')).toBeInTheDocument();

      const refinedWeaponsCard = screen.getByText('Refined Weapons').closest('div')!;
      expect(within(refinedWeaponsCard.parentElement!).getByText('17')).toBeInTheDocument();

      const slotsCard = screen.getByText('Total Refinement Slots').closest('div')!;
      expect(within(slotsCard.parentElement!).getByText('38')).toBeInTheDocument();

      const creditsCard = screen.getByText('Credits Spent (lifetime)').closest('div')!;
      expect(within(creditsCard.parentElement!).getByText('₡4,500,000')).toBeInTheDocument();
    });
  });

  it('renders all four tier rows in the tier breakdown', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Hone')).toBeInTheDocument();
      expect(screen.getByText('Augment')).toBeInTheDocument();
      expect(screen.getByText('Sharpen')).toBeInTheDocument();
      expect(screen.getByText('Forge')).toBeInTheDocument();
    });
  });

  it('shows tier descriptions to clarify what each tier does', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/\+1 to \+5 to an existing attribute/i)).toBeInTheDocument();
      expect(screen.getByText(/\+1 to \+5 to a new attribute/i)).toBeInTheDocument();
      expect(screen.getByText(/cooldown/i)).toBeInTheDocument();
      expect(screen.getByText(/\+1\.0 base damage/i)).toBeInTheDocument();
    });
  });

  it('renders the attribute ranking table with formatted attribute names', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Most-Refined Attributes')).toBeInTheDocument();
      // camelCase → "Combat Power", "Attack Speed"
      expect(screen.getByText('Combat Power')).toBeInTheDocument();
      expect(screen.getByText('Attack Speed')).toBeInTheDocument();
    });
  });

  it('renders the top spenders table with credits formatted as currency', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Top Spenders')).toBeInTheDocument();
      expect(screen.getByText('topPlayer')).toBeInTheDocument();
      expect(screen.getByText('secondPlace')).toBeInTheDocument();
      expect(screen.getByText('₡1,200,000')).toBeInTheDocument();
      expect(screen.getByText('₡800,000')).toBeInTheDocument();
    });
  });

  it('renders user filter chips and toggles the filter param when clicked', async () => {
    renderPage();
    expect(screen.getByText('Real Players')).toBeInTheDocument();
    expect(screen.getByText('Auto-Generated')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Auto-Generated'));

    await waitFor(() => {
      const calls = mockGet.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toMatchObject({ params: { filter: 'auto' } });
    });
  });

  it('displays an error banner with retry button when the API fails', async () => {
    mockGet.mockRejectedValue({ response: { data: { error: 'Refinement service error' } } });
    renderPage();
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(within(alert).getByText('Refinement service error')).toBeInTheDocument();
      expect(within(alert).getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('falls back to a generic error message when the API response has no error string', async () => {
    mockGet.mockRejectedValue({});
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load refinement adoption data/i)).toBeInTheDocument();
    });
  });
});
