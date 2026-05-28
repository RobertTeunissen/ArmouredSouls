import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SubscriptionMatrix from '../SubscriptionMatrix';
import * as useSubscriptionsModule from '../../../hooks/useSubscriptions';

// Mock the hooks
vi.mock('../../../hooks/useSubscriptions', () => ({
  useStableOverview: vi.fn(),
  useRobotSubscriptions: vi.fn(),
}));

const mockRefetch = vi.fn().mockResolvedValue(undefined);
const mockSubscribe = vi.fn().mockResolvedValue({ success: true, message: 'Subscribed' });
const mockUnsubscribe = vi.fn().mockResolvedValue({ success: true, message: 'Unsubscribed' });

const defaultOverviewData: useSubscriptionsModule.StableOverview = {
  robots: [
    { robotId: 1, robotName: 'Iron Fist', subscriptions: [{ eventType: 'league', status: 'active' }, { eventType: 'tournament', status: 'active' }], cap: 3 },
    { robotId: 2, robotName: 'Steel Claw', subscriptions: [{ eventType: 'league', status: 'active' }, { eventType: 'koth', status: 'active' }, { eventType: 'tag_team', status: 'active' }], cap: 3 },
  ],
  registeredEvents: [
    { type: 'league', label: '1v1 League' },
    { type: 'tournament', label: '1v1 Tournament' },
    { type: 'tag_team', label: 'Tag Team' },
    { type: 'koth', label: 'King of the Hill' },
  ],
  bookingOfficeLevel: 0,
};

describe('SubscriptionMatrix', () => {
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
  });

  describe('Desktop layout', () => {
    it('should render robot names as row headers', () => {
      render(<SubscriptionMatrix />);
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
      expect(screen.getByText('Steel Claw')).toBeInTheDocument();
    });

    it('should render event badges in summary bar', () => {
      render(<SubscriptionMatrix />);
      // EventBadge components render the event type text
      // The summary bar shows activeCount/totalRobots for each event
      // League: 2 active out of 2 robots
      const summaryTexts = screen.getAllByText('2/2');
      expect(summaryTexts.length).toBeGreaterThan(0);
    });

    it('should display per-event active counts in summary bar', () => {
      render(<SubscriptionMatrix />);
      // League: 2/2 (both robots have active league subscription)
      expect(screen.getAllByText('2/2').length).toBeGreaterThan(0);
      // Tournament, tag_team, koth: each 1/2 active
      const oneOfTwo = screen.getAllByText('1/2');
      expect(oneOfTwo.length).toBe(3);
    });

    it('should display per-robot cap usage', () => {
      render(<SubscriptionMatrix />);
      // Iron Fist: 2/3 subscriptions
      expect(screen.getByText('2/3 subscriptions')).toBeInTheDocument();
      // Steel Claw: 3/3 subscriptions
      expect(screen.getByText('3/3 subscriptions')).toBeInTheDocument();
    });

    it('should show cap indicator in amber when at cap', () => {
      render(<SubscriptionMatrix />);
      // Steel Claw is at cap (3/3)
      const capIndicator = screen.getByText('3/3 subscriptions');
      expect(capIndicator.className).toContain('text-amber-400');
    });

    it('should call subscribe when clicking an unsubscribed cell', async () => {
      render(<SubscriptionMatrix />);

      // Iron Fist is not subscribed to koth — find the subscribe button
      const subscribeButton = screen.getByLabelText('Subscribe to King of the Hill');
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(mockSubscribe).toHaveBeenCalledWith('koth');
      });
    });

    it('should call unsubscribe when clicking a subscribed cell', async () => {
      render(<SubscriptionMatrix />);

      // Iron Fist is subscribed to league — find the unsubscribe button
      const unsubscribeButtons = screen.getAllByLabelText('Unsubscribe from 1v1 League');
      fireEvent.click(unsubscribeButtons[0]);

      await waitFor(() => {
        expect(mockUnsubscribe).toHaveBeenCalledWith('league');
      });
    });

    it('should disable subscribe button when robot is at cap', () => {
      render(<SubscriptionMatrix />);

      // Steel Claw is at cap (3/3) — subscribe to tournament should be disabled
      const subscribeButtons = screen.getAllByLabelText('Subscribe to 1v1 Tournament');
      const disabledButton = subscribeButtons.find((btn) => btn.hasAttribute('disabled'));
      expect(disabledButton).toBeDefined();
      expect(disabledButton).toBeDisabled();
    });
  });

  describe('Mobile layout (< 1024px)', () => {
    it('should render stacked cards instead of table', () => {
      const { container } = render(<SubscriptionMatrix />);
      // Should not have a table element
      expect(container.querySelector('table')).not.toBeInTheDocument();
      // Should have robot names in card headers
      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
      expect(screen.getByText('Steel Claw')).toBeInTheDocument();
    });

    it('should show per-robot subscription count in card header', () => {
      render(<SubscriptionMatrix />);
      expect(screen.getByText('2/3 subscriptions')).toBeInTheDocument();
      expect(screen.getByText('3/3 subscriptions')).toBeInTheDocument();
    });

    it('should render event badges as toggleable buttons', () => {
      render(<SubscriptionMatrix />);
      // Each robot card should have toggle buttons for each event
      const subscribeButtons = screen.getAllByRole('button');
      expect(subscribeButtons.length).toBeGreaterThan(0);
    });

    it('should not have horizontal overflow on cards', () => {
      const { container } = render(<SubscriptionMatrix />);
      // Cards use space-y-4 layout (vertical stacking)
      const cardContainer = container.querySelector('.space-y-4');
      expect(cardContainer).toBeInTheDocument();
    });

    it('should wrap event badges in flex-wrap container', () => {
      const { container } = render(<SubscriptionMatrix />);
      const wrapContainers = container.querySelectorAll('.flex-wrap');
      expect(wrapContainers.length).toBeGreaterThan(0);
    });
  });

  describe('Loading and error states', () => {
    it('should show loading state', () => {
      vi.mocked(useSubscriptionsModule.useStableOverview).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: mockRefetch,
      });

      render(<SubscriptionMatrix />);
      expect(screen.getByText('Loading subscription matrix...')).toBeInTheDocument();
    });

    it('should show error state', () => {
      vi.mocked(useSubscriptionsModule.useStableOverview).mockReturnValue({
        data: null,
        loading: false,
        error: 'Failed to load',
        refetch: mockRefetch,
      });

      render(<SubscriptionMatrix />);
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('should show empty state when no robots', () => {
      vi.mocked(useSubscriptionsModule.useStableOverview).mockReturnValue({
        data: { robots: [], registeredEvents: [], bookingOfficeLevel: 0 },
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<SubscriptionMatrix />);
      expect(screen.getByText('No robots in your stable yet.')).toBeInTheDocument();
    });
  });
});
