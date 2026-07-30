import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SubscriptionMatrix from '../SubscriptionMatrix';
import * as useSubscriptionsModule from '../../../hooks/useSubscriptions';

/**
 * The matrix edits locally and saves once. These tests cover that flow, the
 * unified rule it presents (leaving is always offered, a booked match holds its
 * slot), and the mobile affordances: a summary line per robot, inline
 * explanations rather than hover tooltips, and 44px touch targets.
 */

vi.mock('../../../hooks/useSubscriptions', () => ({
  useStableOverview: vi.fn(),
  saveRobotSubscriptions: vi.fn(),
}));

const mockRefetch = vi.fn().mockResolvedValue(undefined);

function overview(
  robots: useSubscriptionsModule.StableOverviewRobot[],
): useSubscriptionsModule.StableOverview {
  return {
    robots,
    registeredEvents: [
      { type: 'league_1v1', label: '1v1 League' },
      { type: 'tournament_1v1', label: '1v1 Tournament' },
      { type: 'tag_team', label: 'Tag Team' },
      { type: 'koth', label: 'King of the Hill' },
    ],
    bookingOfficeLevel: 0,
    nextSchedulingMoments: {
      league_1v1: new Date(Date.now() + 2 * 3600_000).toISOString(),
      tournament_1v1: new Date(Date.now() + 4 * 3600_000).toISOString(),
      tag_team: new Date(Date.now() + 6 * 3600_000).toISOString(),
      koth: new Date(Date.now() + 8 * 3600_000).toISOString(),
    },
  };
}

const ironFist: useSubscriptionsModule.StableOverviewRobot = {
  robotId: 1,
  robotName: 'Iron Fist',
  subscriptions: [
    { eventType: 'league_1v1', status: 'active' },
    { eventType: 'tournament_1v1', status: 'active' },
  ],
  heldSlots: [],
  cap: 3,
};

const steelClaw: useSubscriptionsModule.StableOverviewRobot = {
  robotId: 2,
  robotName: 'Steel Claw',
  subscriptions: [
    { eventType: 'league_1v1', status: 'active' },
    { eventType: 'koth', status: 'active' },
    { eventType: 'tag_team', status: 'active' },
  ],
  heldSlots: [],
  cap: 3,
};

function setOverview(data: useSubscriptionsModule.StableOverview | null, extra = {}): void {
  vi.mocked(useSubscriptionsModule.useStableOverview).mockReturnValue({
    data,
    loading: false,
    error: null,
    refetch: mockRefetch,
    ...extra,
  });
}

describe('SubscriptionMatrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOverview(overview([ironFist, steelClaw]));
    vi.mocked(useSubscriptionsModule.saveRobotSubscriptions).mockResolvedValue({
      success: true,
      added: [],
      removed: [],
      heldSlots: [],
      occupiedCount: 2,
      cap: 3,
      level: 0,
    });
  });

  describe('Rendering', () => {
    it('should render a card per robot', () => {
      render(<SubscriptionMatrix />);

      expect(screen.getByText('Iron Fist')).toBeInTheDocument();
      expect(screen.getByText('Steel Claw')).toBeInTheDocument();
    });

    it('should show slot usage per robot', () => {
      render(<SubscriptionMatrix />);

      expect(screen.getByText('2/3 slots')).toBeInTheDocument();
      expect(screen.getByText('3/3 slots')).toBeInTheDocument();
    });

    it('should summarise each robot in one line for small screens', () => {
      render(<SubscriptionMatrix />);

      expect(screen.getByText('1v1 League, 1v1 Tournament')).toBeInTheDocument();
    });

    it('should explain the rule once, without relying on hover', () => {
      render(<SubscriptionMatrix />);

      expect(screen.getByText('How subscriptions work')).toBeInTheDocument();
      expect(screen.getByText(/leaving is\s+always allowed/i)).toBeInTheDocument();
    });

    it('should show when each event next books matches', () => {
      render(<SubscriptionMatrix />);

      expect(screen.getAllByText(/books in \d+h/).length).toBeGreaterThan(0);
    });

    it('should give every toggle a 44px minimum touch target', () => {
      const { container } = render(<SubscriptionMatrix />);

      const toggles = container.querySelectorAll('button[aria-pressed]');
      expect(toggles.length).toBeGreaterThan(0);
      toggles.forEach((toggle) => {
        expect(toggle.className).toContain('min-h-[44px]');
      });
    });
  });

  describe('Local editing', () => {
    it('should not save on toggle', () => {
      render(<SubscriptionMatrix />);

      fireEvent.click(screen.getByLabelText('Enter King of the Hill'));

      expect(useSubscriptionsModule.saveRobotSubscriptions).not.toHaveBeenCalled();
    });

    it('should mark a toggled event as unsaved', () => {
      render(<SubscriptionMatrix />);

      fireEvent.click(screen.getByLabelText('Enter King of the Hill'));

      expect(screen.getAllByText('unsaved').length).toBe(1);
    });

    it('should show the save bar with a count of changed robots', () => {
      render(<SubscriptionMatrix />);

      fireEvent.click(screen.getByLabelText('Enter King of the Hill'));

      expect(screen.getByText('1 robot changed')).toBeInTheDocument();
    });

    it('should count each changed robot once, however many events it changed', () => {
      render(<SubscriptionMatrix />);

      fireEvent.click(screen.getByLabelText('Enter King of the Hill'));
      fireEvent.click(screen.getByLabelText('Leave 1v1 Tournament'));

      expect(screen.getByText('1 robot changed')).toBeInTheDocument();
    });

    it('should drop the save bar when edits cancel out', () => {
      render(<SubscriptionMatrix />);

      // Hold the element: once staged, its label flips to "Leave King of the
      // Hill", which Steel Claw's already-saved toggle also carries.
      const toggle = screen.getByLabelText('Enter King of the Hill');
      fireEvent.click(toggle);
      fireEvent.click(toggle);

      expect(screen.queryByText(/robot changed/)).not.toBeInTheDocument();
      expect(screen.queryByText('unsaved')).not.toBeInTheDocument();
    });

    it('should discard all pending edits', () => {
      render(<SubscriptionMatrix />);

      fireEvent.click(screen.getByLabelText('Enter King of the Hill'));
      fireEvent.click(screen.getByText('Discard'));

      expect(screen.queryByText(/robot changed/)).not.toBeInTheDocument();
      expect(screen.queryByText('unsaved')).not.toBeInTheDocument();
    });
  });

  describe('Saving', () => {
    it('should send one request per changed robot', async () => {
      render(<SubscriptionMatrix />);

      fireEvent.click(screen.getByLabelText('Enter King of the Hill'));
      fireEvent.click(screen.getByText('Save changes'));

      await waitFor(() => {
        expect(useSubscriptionsModule.saveRobotSubscriptions).toHaveBeenCalledTimes(1);
      });
      expect(useSubscriptionsModule.saveRobotSubscriptions).toHaveBeenCalledWith(1, [
        'league_1v1',
        'tournament_1v1',
        'koth',
      ]);
    });

    it('should not send a request for an untouched robot', async () => {
      render(<SubscriptionMatrix />);

      fireEvent.click(screen.getByLabelText('Enter King of the Hill'));
      fireEvent.click(screen.getByText('Save changes'));

      await waitFor(() => {
        expect(useSubscriptionsModule.saveRobotSubscriptions).toHaveBeenCalledTimes(1);
      });
      expect(useSubscriptionsModule.saveRobotSubscriptions).not.toHaveBeenCalledWith(
        2,
        expect.anything(),
      );
    });

    it('should report the outcome on the robot card', async () => {
      vi.mocked(useSubscriptionsModule.saveRobotSubscriptions).mockResolvedValue({
        success: true,
        added: ['koth'],
        removed: [],
        heldSlots: [],
        occupiedCount: 3,
        cap: 3,
        level: 0,
      });

      render(<SubscriptionMatrix />);

      fireEvent.click(screen.getByLabelText('Enter King of the Hill'));
      fireEvent.click(screen.getByText('Save changes'));

      expect(await screen.findByText(/Saved/)).toBeInTheDocument();
    });
  });

  describe('Cap and held slots', () => {
    it('should block entering a new event when all slots are in use', () => {
      render(<SubscriptionMatrix />);

      // Steel Claw is at 3/3.
      expect(screen.getByLabelText('1v1 Tournament — no free slot')).toBeDisabled();
    });

    it('should still offer to leave an event at the cap', () => {
      render(<SubscriptionMatrix />);

      // Leaving is never blocked — that is the point of the unified rule.
      expect(screen.getByLabelText('Leave King of the Hill')).toBeEnabled();
    });

    it('should count a held slot against the cap even when not subscribed', () => {
      setOverview(
        overview([
          {
            robotId: 1,
            robotName: 'Iron Fist',
            subscriptions: [
              { eventType: 'league_1v1', status: 'active' },
              { eventType: 'koth', status: 'active' },
            ],
            // Left the tournament, but is still alive in the bracket.
            heldSlots: ['tournament_1v1'],
            cap: 3,
          },
        ]),
      );

      render(<SubscriptionMatrix />);

      expect(screen.getByText('3/3 slots')).toBeInTheDocument();
      expect(screen.getByLabelText('Tag Team — no free slot')).toBeDisabled();
    });

    it('should explain a held slot inline rather than in a tooltip', () => {
      setOverview(
        overview([{ ...ironFist, heldSlots: ['tournament_1v1'] }]),
      );

      render(<SubscriptionMatrix />);

      expect(
        screen.getByText(/Slot held until the booked match has been fought: 1v1 Tournament/),
      ).toBeInTheDocument();
      expect(screen.getByText('held')).toBeInTheDocument();
    });

    it('should surface the held slots that blocked a save', async () => {
      const capError = Object.assign(new Error('Cap exceeded'), {
        code: 'SUBSCRIPTION_CAP_EXCEEDED',
        details: { currentCount: 4, cap: 3, level: 0, heldSlots: ['tournament_1v1'] },
      });
      // ApiError is matched by instanceof in the component; simulate the generic
      // path here and assert the player still gets a reason.
      vi.mocked(useSubscriptionsModule.saveRobotSubscriptions).mockRejectedValue(capError);

      render(<SubscriptionMatrix />);

      fireEvent.click(screen.getByLabelText('Enter King of the Hill'));
      fireEvent.click(screen.getByText('Save changes'));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('should keep the failed robot dirty so it can be retried', async () => {
      vi.mocked(useSubscriptionsModule.saveRobotSubscriptions).mockRejectedValue(
        new Error('nope'),
      );

      render(<SubscriptionMatrix />);

      fireEvent.click(screen.getByLabelText('Enter King of the Hill'));
      fireEvent.click(screen.getByText('Save changes'));

      await waitFor(() => {
        expect(screen.getByText('1 robot changed')).toBeInTheDocument();
      });
    });
  });

  describe('States', () => {
    it('should show loading state on first load', () => {
      setOverview(null, { loading: true });

      render(<SubscriptionMatrix />);

      expect(screen.getByText('Loading subscription matrix...')).toBeInTheDocument();
    });

    it('should show error state when the overview cannot be loaded', () => {
      vi.mocked(useSubscriptionsModule.useStableOverview).mockReturnValue({
        data: null,
        loading: false,
        error: 'Failed to load',
        refetch: mockRefetch,
      });

      render(<SubscriptionMatrix />);

      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('should show empty state when the stable has no robots', () => {
      setOverview(overview([]));

      render(<SubscriptionMatrix />);

      expect(screen.getByText('No robots in your stable yet.')).toBeInTheDocument();
    });
  });

  describe('Tag team warning', () => {
    it('should flag a tag team robot that is not entered in Tag Team', () => {
      render(<SubscriptionMatrix tagTeamRobotIds={new Set([1])} />);

      expect(
        screen.getByLabelText('On a Tag Team but not entered in Tag Team events'),
      ).toBeInTheDocument();
    });
  });
});
