import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingOfficePage from '../BookingOfficePage';
import * as useSubscriptionsModule from '../../hooks/useSubscriptions';
import * as useMediaQueryModule from '../../hooks/useMediaQuery';

// Mock Navigation to avoid complex auth/routing dependencies
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Nav</div>,
}));

// Mock the hooks
vi.mock('../../hooks/useSubscriptions', () => ({
  useStableOverview: vi.fn(),
  useRobotSubscriptions: vi.fn(),
}));

vi.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
}));

const mockRefetch = vi.fn().mockResolvedValue(undefined);
const mockSubscribe = vi.fn().mockResolvedValue({ success: true, message: 'Subscribed' });
const mockUnsubscribe = vi.fn().mockResolvedValue({ success: true, message: 'Unsubscribed' });

const defaultOverviewData: useSubscriptionsModule.StableOverview = {
  robots: [
    { robotId: 1, robotName: 'Iron Fist', subscriptions: ['league', 'tournament'], cap: 3 },
    { robotId: 2, robotName: 'Steel Claw', subscriptions: ['league', 'koth', 'tag_team'], cap: 3 },
    { robotId: 3, robotName: 'Thunder Bot', subscriptions: ['league'], cap: 3 },
  ],
  registeredEvents: [
    { type: 'league', label: '1v1 League' },
    { type: 'tournament', label: '1v1 Tournament' },
    { type: 'tag_team', label: 'Tag Team' },
    { type: 'koth', label: 'King of the Hill' },
  ],
  bookingOfficeLevel: 0,
};

function renderBookingOfficePage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <BookingOfficePage />
    </MemoryRouter>
  );
}

describe('BookingOfficePage', () => {
  beforeEach(() => {
    vi.mocked(useSubscriptionsModule.useStableOverview).mockReturnValue({
      data: defaultOverviewData,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      mutating: false,
    });
    // Default to desktop view
    vi.mocked(useMediaQueryModule.useMediaQuery).mockReturnValue(true);
  });

  describe('Matrix rendering (shows robots and events)', () => {
    it('should render the page heading', () => {
      renderBookingOfficePage();
      expect(screen.getByRole('heading', { name: 'Booking Office' })).toBeInTheDocument();
    });

    it('should render the Booking Office level indicator', () => {
      renderBookingOfficePage();
      expect(screen.getByText('Booking Office Level')).toBeInTheDocument();
      expect(screen.getByText('0 / 10')).toBeInTheDocument();
    });

    it('should render all robot names in the matrix', () => {
      renderBookingOfficePage();
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
      expect(screen.getByText('Steel Claw')).toBeInTheDocument();
      expect(screen.getByText('Thunder Bot')).toBeInTheDocument();
    });

    it('should render all event type column headers', () => {
      renderBookingOfficePage();
      expect(screen.getByText('1v1 League')).toBeInTheDocument();
      expect(screen.getByText('1v1 Tournament')).toBeInTheDocument();
      expect(screen.getByText('Tag Team')).toBeInTheDocument();
      expect(screen.getByText('King of the Hill')).toBeInTheDocument();
    });

    it('should show per-event totals in column headers', () => {
      renderBookingOfficePage();
      // League: 3 of 3 robots subscribed
      expect(screen.getByText('3 of 3')).toBeInTheDocument();
      // Tournament, tag_team, koth: each 1 of 3
      const oneOfThreeElements = screen.getAllByText('1 of 3');
      expect(oneOfThreeElements.length).toBe(3);
    });

    it('should display subscription cap info per robot', () => {
      renderBookingOfficePage();
      // Iron Fist: 2/3, Steel Claw: 3/3, Thunder Bot: 1/3
      expect(screen.getByText('2/3')).toBeInTheDocument();
      expect(screen.getByText('3/3')).toBeInTheDocument();
      expect(screen.getByText('1/3')).toBeInTheDocument();
    });

    it('should show next level info when not at max', () => {
      renderBookingOfficePage();
      expect(screen.getByText('Next level: 4 subscriptions per robot')).toBeInTheDocument();
    });

    it('should show max level reached when at level 10', () => {
      vi.mocked(useSubscriptionsModule.useStableOverview).mockReturnValue({
        data: { ...defaultOverviewData, bookingOfficeLevel: 10 },
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      renderBookingOfficePage();
      expect(screen.getByText('Maximum level reached')).toBeInTheDocument();
    });
  });

  describe('Subscribe/unsubscribe from matrix', () => {
    it('should call subscribe when clicking an unsubscribed cell', async () => {
      renderBookingOfficePage();

      // Iron Fist is not subscribed to koth — find the subscribe buttons
      const subscribeButtons = screen.getAllByLabelText('Subscribe to koth');
      fireEvent.click(subscribeButtons[0]);

      await waitFor(() => {
        expect(mockSubscribe).toHaveBeenCalledWith('koth');
      });
    });

    it('should call unsubscribe when clicking a subscribed cell', async () => {
      renderBookingOfficePage();

      // Iron Fist is subscribed to league — find the unsubscribe button
      const unsubscribeButtons = screen.getAllByLabelText('Unsubscribe from league');
      fireEvent.click(unsubscribeButtons[0]);

      await waitFor(() => {
        expect(mockUnsubscribe).toHaveBeenCalledWith('league');
      });
    });

    it('should refetch overview data after toggling a subscription', async () => {
      renderBookingOfficePage();

      const subscribeButtons = screen.getAllByLabelText('Subscribe to koth');
      fireEvent.click(subscribeButtons[0]);

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  describe('Cap enforcement in matrix', () => {
    it('should disable subscribe buttons for robots at cap', () => {
      renderBookingOfficePage();

      // Steel Claw is at cap (3/3) — subscribe to tournament should be disabled
      // There may be multiple "Subscribe to tournament" buttons (one per robot not subscribed)
      const subscribeButtons = screen.getAllByLabelText('Subscribe to tournament');
      // Find the disabled one (Steel Claw's)
      const disabledButton = subscribeButtons.find((btn) => btn.hasAttribute('disabled'));
      expect(disabledButton).toBeDefined();
      expect(disabledButton).toBeDisabled();
    });

    it('should still allow unsubscribe for robots at cap', () => {
      renderBookingOfficePage();

      // Steel Claw is at cap but can still unsubscribe from league
      const unsubscribeButtons = screen.getAllByLabelText('Unsubscribe from league');
      // All unsubscribe buttons should be enabled (no locks)
      unsubscribeButtons.forEach((btn) => {
        expect(btn).not.toBeDisabled();
      });
    });

    it('should show cap indicator in amber color for robots at cap', () => {
      renderBookingOfficePage();
      // Steel Claw is at 3/3 — should have amber text
      const capTexts = screen.getAllByText('3/3');
      const atCapText = capTexts.find((el) => el.className.includes('text-amber-400'));
      expect(atCapText).toBeDefined();
    });
  });
});
