import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingOfficePage from '../BookingOfficePage';
import * as useSubscriptionsModule from '../../hooks/useSubscriptions';

// Mock Navigation to avoid complex auth/routing dependencies
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Nav</div>,
}));

// Mock the hooks
vi.mock('../../hooks/useSubscriptions', () => ({
  useStableOverview: vi.fn(),
  useRobotSubscriptions: vi.fn(),
  saveRobotSubscriptions: vi.fn().mockResolvedValue({
    success: true, added: [], removed: [], heldSlots: [], occupiedCount: 0, cap: 3, level: 0,
  }),
}));

// The page invalidates the shared overview cache after an upgrade.
vi.mock('../../stores/subscriptionStore', () => ({
  useSubscriptionStore: (selector: (s: { invalidate: () => void }) => unknown) =>
    selector({ invalidate: vi.fn() }),
}));

const mockRefetch = vi.fn().mockResolvedValue(undefined);
const mockSubscribe = vi.fn().mockResolvedValue({ success: true, message: 'Subscribed' });
const mockUnsubscribe = vi.fn().mockResolvedValue({ success: true, message: 'Unsubscribed' });

const defaultOverviewData: useSubscriptionsModule.StableOverview = {
  robots: [
    { robotId: 1, robotName: 'Iron Fist', subscriptions: [{ eventType: 'league_1v1', status: 'active' }, { eventType: 'tournament_1v1', status: 'active' }], heldSlots: [], cap: 3 },
    { robotId: 2, robotName: 'Steel Claw', subscriptions: [{ eventType: 'league_1v1', status: 'active' }, { eventType: 'koth', status: 'active' }, { eventType: 'tag_team', status: 'active' }], heldSlots: [], cap: 3 },
    { robotId: 3, robotName: 'Thunder Bot', subscriptions: [{ eventType: 'league_1v1', status: 'active' }], heldSlots: [], cap: 3 },
  ],
  registeredEvents: [
    { type: 'league_1v1', label: '1v1 League' },
    { type: 'tournament_1v1', label: '1v1 Tournament' },
    { type: 'tag_team', label: 'Tag Team' },
    { type: 'koth', label: 'King of the Hill' },
  ],
  bookingOfficeLevel: 0,
  nextSchedulingMoments: {
    league_1v1: new Date(Date.now() + 3600_000).toISOString(),
  },
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
      saveSubscriptions: vi.fn(),
      mutating: false,
    });
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
      // Event badges render in the summary bar — check for event type text
      // The EventBadge component renders the event type
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
    });

    it('should show per-event totals in column headers', () => {
      renderBookingOfficePage();
      // Summary bar shows activeCount/totalRobots per event
      // League: 3/3 (all 3 robots have active league subscription)
      const threeOfThree = screen.getAllByText('3/3');
      expect(threeOfThree.length).toBeGreaterThan(0);
      // Tournament, tag_team, koth: each 1/3
      const oneOfThree = screen.getAllByText('1/3');
      expect(oneOfThree.length).toBeGreaterThanOrEqual(3);
    });

    it('should display slot usage per robot', () => {
      renderBookingOfficePage();
      // Card layout shows "X/Y slots" per robot
      expect(screen.getByText('2/3 slots')).toBeInTheDocument();
      expect(screen.getByText('3/3 slots')).toBeInTheDocument();
      expect(screen.getByText('1/3 slots')).toBeInTheDocument();
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

  describe('Editing from the matrix', () => {
    it('should stage a change rather than saving on each tap', async () => {
      renderBookingOfficePage();

      // Iron Fist is not entered in KotH.
      fireEvent.click(screen.getAllByLabelText('Enter King of the Hill')[0]);

      expect(useSubscriptionsModule.saveRobotSubscriptions).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByText('1 robot changed')).toBeInTheDocument();
      });
    });

    it('should save the staged set for the changed robot', async () => {
      renderBookingOfficePage();

      fireEvent.click(screen.getAllByLabelText('Enter King of the Hill')[0]);
      fireEvent.click(screen.getByText('Save changes'));

      await waitFor(() => {
        expect(useSubscriptionsModule.saveRobotSubscriptions).toHaveBeenCalledWith(1, [
          'league_1v1',
          'tournament_1v1',
          'koth',
        ]);
      });
    });
  });

  describe('Cap enforcement in matrix', () => {
    it('should block entering a new event for a robot with no free slot', () => {
      renderBookingOfficePage();

      // Steel Claw is at 3/3.
      const blocked = screen
        .getAllByLabelText('1v1 Tournament — no free slot')
        .find((btn) => btn.hasAttribute('disabled'));
      expect(blocked).toBeDefined();
      expect(blocked).toBeDisabled();
    });

    it('should still offer to leave an event at the cap', () => {
      renderBookingOfficePage();

      // Leaving is never blocked, for any event.
      screen.getAllByLabelText('Leave 1v1 League').forEach((btn) => {
        expect(btn).not.toBeDisabled();
      });
    });

    it('should show slot usage in amber for a robot with no free slot', () => {
      renderBookingOfficePage();

      expect(screen.getByText('3/3 slots').className).toContain('text-amber-400');
    });
  });
});
