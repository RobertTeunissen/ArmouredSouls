import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SubscriptionManager from '../SubscriptionManager';
import * as useSubscriptionsModule from '../../../hooks/useSubscriptions';

// Mock the hooks
vi.mock('../../../hooks/useSubscriptions', () => ({
  useRobotSubscriptions: vi.fn(),
  useEventRegistry: vi.fn(),
}));

const mockSubscribe = vi.fn().mockResolvedValue({ success: true, message: 'Subscribed' });
const mockUnsubscribe = vi.fn().mockResolvedValue({ success: true, message: 'Unsubscribed' });

const defaultRobotSubscriptions: useSubscriptionsModule.UseRobotSubscriptionsReturn = {
  data: {
    subscriptions: [
      { id: 1, robotId: 1, eventType: 'league', status: 'active', createdAt: '2026-01-01' },
      { id: 2, robotId: 1, eventType: 'tournament', status: 'active', createdAt: '2026-01-01' },
    ],
    cap: 3,
    level: 0,
  },
  loading: false,
  error: null,
  refetch: vi.fn(),
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  mutating: false,
};

const defaultRegistryEvents: useSubscriptionsModule.EligibleEvent[] = [
  { type: 'league', label: '1v1 League', eligible: true },
  { type: 'tournament', label: '1v1 Tournament', eligible: true },
  { type: 'tag_team', label: 'Tag Team', eligible: false, reason: 'Tag Team requires 2 or more robots' },
  { type: 'koth', label: 'King of the Hill', eligible: true },
];

describe('SubscriptionManager', () => {
  beforeEach(() => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue(defaultRobotSubscriptions);
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

  it('should display cap indicator showing current/max subscriptions', () => {
    render(<SubscriptionManager robotId={1} />);
    expect(screen.getByText('2/3 subscriptions')).toBeInTheDocument();
  });

  it('should show cap reached warning when at cap', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue({
      ...defaultRobotSubscriptions,
      data: {
        subscriptions: [
          { id: 1, robotId: 1, eventType: 'league', createdAt: '2026-01-01' },
          { id: 2, robotId: 1, eventType: 'tournament', createdAt: '2026-01-01' },
          { id: 3, robotId: 1, eventType: 'koth', createdAt: '2026-01-01' },
        ],
        cap: 3,
        level: 0,
      },
    });

    render(<SubscriptionManager robotId={1} />);
    expect(screen.getByText(/Subscription cap reached/)).toBeInTheDocument();
  });

  it('should disable subscribe button when at cap', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue({
      ...defaultRobotSubscriptions,
      data: {
        subscriptions: [
          { id: 1, robotId: 1, eventType: 'league', createdAt: '2026-01-01' },
          { id: 2, robotId: 1, eventType: 'tournament', createdAt: '2026-01-01' },
          { id: 3, robotId: 1, eventType: 'koth', createdAt: '2026-01-01' },
        ],
        cap: 3,
        level: 0,
      },
    });

    render(<SubscriptionManager robotId={1} />);
    // The "Add" button for tag_team should be disabled (at cap + not eligible)
    const addButtons = screen.getAllByText('Add');
    addButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('should render lock indicator for tournament subscription when locked', () => {
    // Only tournament has locks in the two-state model
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue({
      ...defaultRobotSubscriptions,
      data: {
        subscriptions: [
          { id: 1, robotId: 1, eventType: 'league', status: 'active', createdAt: '2026-01-01' },
          { id: 2, robotId: 1, eventType: 'tournament', status: 'active', createdAt: '2026-01-01' },
        ],
        cap: 3,
        level: 0,
      },
    });

    const lockStates = {
      tournament: { isLocked: true, scheduledCycle: 59 },
    };

    render(<SubscriptionManager robotId={1} lockStates={lockStates} />);
    // Lock indicator should be present
    const lockElement = screen.getByRole('img', { name: /Locked — queued battle in cycle 59/ });
    expect(lockElement).toBeInTheDocument();
  });

  it('should show "Locked" text on unsubscribe button when tournament subscription is locked', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue({
      ...defaultRobotSubscriptions,
      data: {
        subscriptions: [
          { id: 1, robotId: 1, eventType: 'league', status: 'active', createdAt: '2026-01-01' },
          { id: 2, robotId: 1, eventType: 'tournament', status: 'active', createdAt: '2026-01-01' },
        ],
        cap: 3,
        level: 0,
      },
    });

    const lockStates = {
      tournament: { isLocked: true, scheduledCycle: 59 },
    };

    render(<SubscriptionManager robotId={1} lockStates={lockStates} />);
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('should disable unsubscribe button when tournament subscription is locked', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue({
      ...defaultRobotSubscriptions,
      data: {
        subscriptions: [
          { id: 1, robotId: 1, eventType: 'league', status: 'active', createdAt: '2026-01-01' },
          { id: 2, robotId: 1, eventType: 'tournament', status: 'active', createdAt: '2026-01-01' },
        ],
        cap: 3,
        level: 0,
      },
    });

    const lockStates = {
      tournament: { isLocked: true, scheduledCycle: 59 },
    };

    render(<SubscriptionManager robotId={1} lockStates={lockStates} />);
    const lockedButton = screen.getByText('Locked');
    expect(lockedButton).toBeDisabled();
  });

  it('should NOT show lock indicator for non-tournament events even if lockStates provided', () => {
    const lockStates = {
      league: { isLocked: true, scheduledCycle: 59 },
    };

    render(<SubscriptionManager robotId={1} lockStates={lockStates} />);
    // League lock should be ignored — only tournament locks apply
    expect(screen.queryByRole('img', { name: /Locked/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
  });

  it('should render empty state when no subscriptions and no registry events', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue({
      ...defaultRobotSubscriptions,
      data: { subscriptions: [], cap: 3, level: 0 },
    });
    vi.mocked(useSubscriptionsModule.useEventRegistry).mockReturnValue({
      events: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SubscriptionManager robotId={1} />);
    expect(screen.getByText(/No event subscriptions available/)).toBeInTheDocument();
  });

  it('should show "No longer eligible" for ineligible events', () => {
    render(<SubscriptionManager robotId={1} />);
    expect(screen.getByText('No longer eligible')).toBeInTheDocument();
  });

  it('should call subscribe when Add button is clicked', async () => {
    render(<SubscriptionManager robotId={1} />);

    // Find the "Add" button for koth (the one that's eligible and not subscribed)
    const addButton = screen.getByLabelText('Subscribe to King of the Hill');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledWith('koth');
    });
  });

  it('should call unsubscribe when Remove button is clicked', async () => {
    render(<SubscriptionManager robotId={1} />);

    const removeButton = screen.getByLabelText('Unsubscribe from 1v1 League');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockUnsubscribe).toHaveBeenCalledWith('league');
    });
  });

  it('should show loading state', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue({
      ...defaultRobotSubscriptions,
      loading: true,
    });

    render(<SubscriptionManager robotId={1} />);
    expect(screen.getByText('Loading subscriptions...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue({
      ...defaultRobotSubscriptions,
      error: 'Failed to load',
    });

    render(<SubscriptionManager robotId={1} />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('should show level indicator when level > 0', () => {
    vi.mocked(useSubscriptionsModule.useRobotSubscriptions).mockReturnValue({
      ...defaultRobotSubscriptions,
      data: {
        subscriptions: [
          { id: 1, robotId: 1, eventType: 'league', createdAt: '2026-01-01' },
        ],
        cap: 4,
        level: 1,
      },
    });

    render(<SubscriptionManager robotId={1} />);
    expect(screen.getByText('L1')).toBeInTheDocument();
  });
});
