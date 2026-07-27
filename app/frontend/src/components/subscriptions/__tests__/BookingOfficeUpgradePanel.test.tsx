/**
 * BookingOfficeUpgradePanel — Spec #46 Requirement 6
 *
 * The Booking Office page instructed players to upgrade the facility but gave
 * them no control, so hitting the subscription cap meant navigating away. These
 * tests cover the control's disabled states, the implication panel contents, and
 * the refresh-on-success behaviour that makes new slots immediately usable.
 *
 * **Validates: Requirements 6.5, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.15, 6.17, 6.18, 6.20, 6.23, 6.24, 6.25**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingOfficeUpgradePanel from '../BookingOfficeUpgradePanel';
import { api } from '../../../utils/api';
import { ApiError } from '../../../utils/ApiError';

vi.mock('../../../utils/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

/** A Booking Office entry as `GET /api/facilities` returns it. */
function bookingOffice(overrides: Record<string, unknown> = {}) {
  return {
    type: 'booking_office',
    name: 'Booking Office',
    currentLevel: 2,
    maxLevel: 10,
    upgradeCost: 225_000,
    canUpgrade: true,
    nextLevelPrestigeRequired: 0,
    hasPrestige: true,
    canAfford: true,
    currentOperatingCost: 300,
    nextOperatingCost: 450,
    ...overrides,
  };
}

function mockFacilities(entry: Record<string, unknown>, currency = 900_000, prestige = 4_000) {
  vi.mocked(api.get).mockResolvedValue({
    facilities: [entry],
    userCurrency: currency,
    userPrestige: prestige,
  } as never);
}

const onUpgraded = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.post).mockResolvedValue({} as never);
});

describe('Upgrade_Implication_Panel contents (R6.7, R6.8, R6.9)', () => {
  it('states the cost, the resulting cap, the operating cost and the balance', async () => {
    mockFacilities(bookingOffice());
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    await waitFor(() => expect(screen.getByText('Cost')).toBeInTheDocument());

    expect(screen.getByText('₡225,000')).toBeInTheDocument();

    // Cap is expressed as subscriptions per robot, not a bare level number.
    // The value renders as split nodes ("5 → <span>6</span>"), so assert on the
    // definition's text rather than on individual text nodes.
    const capTerm = screen.getByText('Subscriptions per robot');
    const capValue = capTerm.parentElement?.querySelector('dd');
    expect(capValue?.textContent?.replace(/\s+/g, ' ')).toBe('5 → 6'); // 3 base + level 2 → level 3

    expect(screen.getByText('₡300 → ₡450')).toBeInTheDocument();
    expect(screen.getByText('₡900,000')).toBeInTheDocument();
  });

  it('shows required and current prestige when the next level is gated', async () => {
    mockFacilities(bookingOffice({ currentLevel: 3, nextLevelPrestigeRequired: 1000, hasPrestige: true }), 900_000, 2_500);
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    await waitFor(() => expect(screen.getByText('Prestige required')).toBeInTheDocument());
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
    expect(screen.getByText(/you have 2,500/)).toBeInTheDocument();
  });

  it('omits the prestige row when the next level is ungated', async () => {
    mockFacilities(bookingOffice({ nextLevelPrestigeRequired: 0 }));
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    await waitFor(() => expect(screen.getByText('Cost')).toBeInTheDocument());
    expect(screen.queryByText('Prestige required')).not.toBeInTheDocument();
  });

  it('sources every figure from the API rather than recomputing', async () => {
    mockFacilities(bookingOffice());
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/facilities'));
  });
});

describe('Disabled-state matrix (R6.10, R6.11, R6.12, R6.13, R6.18)', () => {
  it('disables and blames credits when the balance is short', async () => {
    mockFacilities(bookingOffice({ canAfford: false }), 10_000);
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    const button = await screen.findByRole('button', { name: /Upgrade Booking Office/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/You need ₡225,000 and have ₡10,000/)).toBeInTheDocument();
    expect(screen.queryByText(/requires .* prestige/)).not.toBeInTheDocument();
  });

  it('disables and blames prestige when prestige is short', async () => {
    mockFacilities(
      bookingOffice({ hasPrestige: false, nextLevelPrestigeRequired: 5000 }),
      900_000,
      1_200,
    );
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    const button = await screen.findByRole('button', { name: /Upgrade Booking Office/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/requires 5,000 prestige and you have 1,200/)).toBeInTheDocument();
  });

  it('states both blocking conditions when both are short', async () => {
    mockFacilities(
      bookingOffice({ canAfford: false, hasPrestige: false, nextLevelPrestigeRequired: 5000 }),
      10_000,
      1_200,
    );
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    const button = await screen.findByRole('button', { name: /Upgrade Booking Office/i });
    expect(button).toBeDisabled();

    const reason = screen.getByText(/You need ₡225,000/);
    expect(reason.textContent).toMatch(/have ₡10,000/);
    expect(reason.textContent).toMatch(/requires 5,000 prestige/);
  });

  it('replaces the control with a max-level indicator and omits the panel', async () => {
    mockFacilities(bookingOffice({ currentLevel: 10, canUpgrade: false }));
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    await waitFor(() =>
      expect(screen.getByText(/Booking Office is at maximum level/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/13 subscriptions per robot/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Cost')).not.toBeInTheDocument();
  });

  it('disables the control while a request is in flight, so a double click cannot buy two levels', async () => {
    mockFacilities(bookingOffice());
    let resolvePost: (v: unknown) => void = () => {};
    vi.mocked(api.post).mockImplementation(() => new Promise((r) => { resolvePost = r; }) as never);

    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);
    const button = await screen.findByRole('button', { name: /Upgrade Booking Office/i });

    await userEvent.click(button);
    await waitFor(() => expect(screen.getByRole('button', { name: /Upgrading/i })).toBeDisabled());

    await userEvent.click(screen.getByRole('button', { name: /Upgrading/i }));
    expect(api.post).toHaveBeenCalledTimes(1);

    resolvePost({});
  });

  it('exposes the disabled reason to assistive technology, not by colour alone', async () => {
    mockFacilities(bookingOffice({ canAfford: false }), 10_000);
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    const button = await screen.findByRole('button', { name: /Upgrade Booking Office/i });
    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBe('booking-office-upgrade-reason');
    expect(document.getElementById(describedBy!)).toHaveTextContent(/You need ₡225,000/);
  });
});

describe('Mutation path (R6.6, R6.15, R6.17)', () => {
  it('calls the existing facility upgrade endpoint with booking_office', async () => {
    mockFacilities(bookingOffice());
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    const button = await screen.findByRole('button', { name: /Upgrade Booking Office/i });
    await userEvent.click(button);

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/facilities/upgrade', { facilityType: 'booking_office' }),
    );
  });

  it('refreshes its own figures and notifies the page on success', async () => {
    mockFacilities(bookingOffice());
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    const button = await screen.findByRole('button', { name: /Upgrade Booking Office/i });
    await userEvent.click(button);

    await waitFor(() => expect(onUpgraded).toHaveBeenCalledTimes(1));
    // Once on mount, once after the upgrade
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('surfaces the endpoint error message and does not notify the page', async () => {
    mockFacilities(bookingOffice());
    vi.mocked(api.post).mockRejectedValue(
      new ApiError('Booking Office Level 3 requires 1,000 prestige', 'FORBIDDEN', 403),
    );

    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);
    const button = await screen.findByRole('button', { name: /Upgrade Booking Office/i });
    await userEvent.click(button);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/requires 1,000 prestige/),
    );
    expect(onUpgraded).not.toHaveBeenCalled();
  });

  it('re-enables the control after a failure', async () => {
    mockFacilities(bookingOffice());
    vi.mocked(api.post).mockRejectedValue(new ApiError('Upgrade failed', 'UNKNOWN_ERROR', 500));

    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);
    const button = await screen.findByRole('button', { name: /Upgrade Booking Office/i });
    await userEvent.click(button);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Upgrade Booking Office/i })).toBeEnabled();
  });
});

describe('Operating cost regression (R6.25)', () => {
  it('displays a non-zero daily operating cost for the Booking Office', async () => {
    // The removed if/else chain in the facilities route omitted booking_office
    // entirely, so this rendered "₡0 → ₡0" and understated the ongoing cost.
    mockFacilities(bookingOffice({ currentLevel: 4, currentOperatingCost: 600, nextOperatingCost: 750 }));
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    await waitFor(() => expect(screen.getByText('₡600 → ₡750')).toBeInTheDocument());
    expect(screen.queryByText('₡0 → ₡0')).not.toBeInTheDocument();
  });
});

describe('Mobile layout (R6.21, R6.22)', () => {
  it('gives the upgrade control a 44px minimum touch target', async () => {
    mockFacilities(bookingOffice());
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    const button = await screen.findByRole('button', { name: /Upgrade Booking Office/i });
    expect(button.className).toContain('min-h-[44px]');
  });

  it('stacks the implication figures vertically below the lg breakpoint', async () => {
    mockFacilities(bookingOffice());
    render(<BookingOfficeUpgradePanel onUpgraded={onUpgraded} />);

    await waitFor(() => expect(screen.getByText('Cost')).toBeInTheDocument());
    const list = screen.getByText('Cost').closest('dl');
    expect(list?.className).toContain('flex-col');
    expect(list?.className).toContain('lg:flex-row');
  });
});
