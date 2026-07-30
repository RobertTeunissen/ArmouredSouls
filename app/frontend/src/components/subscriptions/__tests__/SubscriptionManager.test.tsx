import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SubscriptionManager from '../SubscriptionManager';
import * as useSubscriptionsModule from '../../../hooks/useSubscriptions';

/**
 * The robot-detail panel presents the same rule as the Booking Office matrix:
 * leaving is always offered, and a booked match holds its slot until fought.
 * The per-event lock and the "pending" state this file used to assert are gone.
 */

vi.mock('../../../hooks/useSubscriptions', () => ({
  useRobotSubscriptions: vi.fn(),
  useEventRegistry: vi.fn(),
}));

const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();

function subscriptionsReturn(
  overrides: Partial<useSubscriptionsModule.UseRobotSubscriptionsReturn> = {},
  dataOverrides: Partial<useSubscriptionsModule.RobotSubscriptionInfo> = {},
): useSubscriptionsModule.UseRobotSubscriptionsReturn {
  return {
    data: {
      subscriptions: [
        { id: 1, robotId: 1, eventType: 'league_1v1', status: 'active', createdAt: '2026-01-01' },
        { id: 2, robotId: 1, eventType: 'tournament_1v1', status: 'active', createdAt: '2026-01-01' },
      ],
      cap: 3,
      level: 0,
      heldSlots: [],
      nextSchedulingMoments: {
        league_1v1: new Date(Date.now() + 2 * 3600_000).toISOString(),
      },
      ...dataOverrides,
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    saveSubscriptions: vi.fn(),
    mutating: false,
    ...overrides,
  };
}

const defaultRegistryEvents: useSubscriptionsModule.EligibleEvent[] = [
  { type: 'league_1v1', label: '1v1 League', eligible: true },
  { type: 'tournament_1v1', label: '1v1 Tournament', eligible: true },
  { type: 'tag_team', label: 'Tag Team', eligible: false, reason: 'Tag Team requires 2 or more robots' },
  { type: 'koth', label: 'King of the Hill', eligible: true },
];

describe('SubscriptionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribe.mockResolvedValue({
      success: true, added: ['koth'], removed: [], heldSlots: [], occupiedCount: 3, cap: 3, level: 0,
    });
    mockUnsubscribe.mockResolvedValue({
      success: true, added: [], removed: ['league_1v1'], heldSlots: [], occupiedCount: 1, cap: 3, level: 0,
    });
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue(subscriptionsReturn());
    vi.mocked(useSubscriptionsModule.useEventRegistry).mockReturnValue({
      events: defaultRegistryEvents,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('should render the subscription manager heading', () => {
    render(<SubscriptionManager robotId={1} />);

    expect(screen.getByText('Event Subscriptions')).toBeInTheDocument();
  });

  it('should display slot usage against the cap', () => {
    render(<SubscriptionManager robotId={1} />);

    expect(screen.getByText('2/3 slots')).toBeInTheDocument();
  });

  it('should show when an event next books matches', () => {
    render(<SubscriptionManager robotId={1} />);

    expect(screen.getByText(/Books next matches in 2h/)).toBeInTheDocument();
  });

  it('should show the cap message when all slots are in use', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue(
      subscriptionsReturn({}, {
        subscriptions: [
          { id: 1, robotId: 1, eventType: 'league_1v1', status: 'active', createdAt: '2026-01-01' },
          { id: 2, robotId: 1, eventType: 'tournament_1v1', status: 'active', createdAt: '2026-01-01' },
          { id: 3, robotId: 1, eventType: 'koth', status: 'active', createdAt: '2026-01-01' },
        ],
      }),
    );

    render(<SubscriptionManager robotId={1} />);

    expect(screen.getByText(/All 3 event slots are in use/)).toBeInTheDocument();
  });

  it('should disable Enter when all slots are in use', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue(
      subscriptionsReturn({}, {
        subscriptions: [
          { id: 1, robotId: 1, eventType: 'league_1v1', status: 'active', createdAt: '2026-01-01' },
          { id: 2, robotId: 1, eventType: 'tournament_1v1', status: 'active', createdAt: '2026-01-01' },
          { id: 3, robotId: 1, eventType: 'koth', status: 'active', createdAt: '2026-01-01' },
        ],
      }),
    );

    render(<SubscriptionManager robotId={1} />);

    expect(screen.getByLabelText('Enter Tag Team')).toBeDisabled();
  });

  // ── The unified rule ──────────────────────────────────────────────

  it.each(['1v1 League', '1v1 Tournament'])(
    'should always offer to leave %s',
    (label) => {
      render(<SubscriptionManager robotId={1} />);

      expect(screen.getByLabelText(`Leave ${label}`)).toBeEnabled();
    },
  );

  it('should count a held slot against the cap even when not subscribed', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue(
      subscriptionsReturn({}, { heldSlots: ['koth'] }),
    );

    render(<SubscriptionManager robotId={1} />);

    // Two subscriptions plus one held slot fills a cap of 3.
    expect(screen.getByText('3/3 slots')).toBeInTheDocument();
  });

  it('should mark and explain a held slot without needing hover', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue(
      subscriptionsReturn({}, { heldSlots: ['tournament_1v1'] }),
    );

    render(<SubscriptionManager robotId={1} />);

    expect(screen.getByText('Slot held')).toBeInTheDocument();
    expect(
      screen.getByText(/A slot is held by a match that has been booked but not yet fought/),
    ).toBeInTheDocument();
  });

  it('should tell the player the booked match still goes ahead after leaving', async () => {
    mockUnsubscribe.mockResolvedValue({
      success: true,
      added: [],
      removed: ['league_1v1'],
      heldSlots: ['league_1v1'],
      occupiedCount: 2,
      cap: 3,
      level: 0,
    });

    render(<SubscriptionManager robotId={1} />);
    fireEvent.click(screen.getByLabelText('Leave 1v1 League'));

    expect(
      await screen.findByText(/A match is already booked, so it still goes ahead/),
    ).toBeInTheDocument();
  });

  it('should not render any lock affordance', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue(
      subscriptionsReturn({}, { heldSlots: ['tournament_1v1'] }),
    );

    render(<SubscriptionManager robotId={1} />);

    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Locked/ })).not.toBeInTheDocument();
  });

  it('should never render a pending status', () => {
    render(<SubscriptionManager robotId={1} />);

    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });

  // ── Actions ───────────────────────────────────────────────────────

  it('should call subscribe when Enter is clicked', async () => {
    render(<SubscriptionManager robotId={1} />);

    fireEvent.click(screen.getByLabelText('Enter King of the Hill'));

    await waitFor(() => expect(mockSubscribe).toHaveBeenCalledWith('koth'));
  });

  it('should call unsubscribe when Leave is clicked', async () => {
    render(<SubscriptionManager robotId={1} />);

    fireEvent.click(screen.getByLabelText('Leave 1v1 League'));

    await waitFor(() => expect(mockUnsubscribe).toHaveBeenCalledWith('league_1v1'));
  });

  it('should give every action a 44px minimum touch target', () => {
    const { container } = render(<SubscriptionManager robotId={1} />);

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => {
      expect(button.className).toContain('min-h-[44px]');
    });
  });

  // ── States ────────────────────────────────────────────────────────

  it('should show "No longer eligible" for ineligible events', () => {
    render(<SubscriptionManager robotId={1} />);

    expect(screen.getByText('No longer eligible')).toBeInTheDocument();
  });

  it('should show the empty state when nothing is available', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue(
      subscriptionsReturn({}, { subscriptions: [] }),
    );
    vi.mocked(useSubscriptionsModule.useEventRegistry).mockReturnValue({
      events: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SubscriptionManager robotId={1} />);

    expect(screen.getByText(/No event subscriptions available/)).toBeInTheDocument();
  });

  it('should show the loading state', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue(
      subscriptionsReturn({ loading: true, data: null }),
    );

    render(<SubscriptionManager robotId={1} />);

    expect(screen.getByText('Loading subscriptions...')).toBeInTheDocument();
  });

  it('should show the error state', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue(
      subscriptionsReturn({ error: 'Failed to load', data: null }),
    );

    render(<SubscriptionManager robotId={1} />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('should show the Booking Office level when above zero', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue(
      subscriptionsReturn({}, { level: 1, cap: 4 }),
    );

    render(<SubscriptionManager robotId={1} />);

    expect(screen.getByText('L1')).toBeInTheDocument();
  });

  it('should warn a tag team robot that is not entered in Tag Team', () => {
    render(<SubscriptionManager robotId={1} isOnTagTeam />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      /on a Tag Team but not entered in Tag Team events/,
    );
  });
});
