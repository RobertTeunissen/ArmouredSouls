/**
 * EventSubscriptionStep: saves through saveRobotSubscriptions (the Booking
 * Office's `{ eventTypes }` call; the step used to send `{ subscriptions }`,
 * which the API rejected with VALIDATION_ERROR on every click).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EventSubscriptionStep from '../EventSubscriptionStep';
import { ApiError } from '../../../../utils/ApiError';

const subs = vi.hoisted(() => ({
  overview: null as unknown,
  events: [] as Array<{ type: string; label: string; eligible: boolean; reason?: string }>,
  save: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock('../../../../hooks/useSubscriptions', () => ({
  useStableOverview: () => ({ data: subs.overview, loading: false, error: null, refetch: subs.refetch }),
  useEventRegistry: () => ({ events: subs.events, loading: false, error: null, refetch: vi.fn() }),
  saveRobotSubscriptions: (...args: unknown[]) => subs.save(...args),
}));

const EVENTS = [
  { type: 'league_1v1', label: '1v1 League', eligible: true },
  { type: 'tournament_1v1', label: '1v1 Tournament', eligible: true },
  { type: 'koth', label: 'King of the Hill', eligible: true },
  { type: 'grand_melee', label: 'Grand Melee', eligible: true },
  { type: 'tag_team', label: 'Tag Team', eligible: false, reason: 'Tag Team requires 2 or more robots in your Stable' },
];

function overview(robot: Partial<{ subscriptions: Array<{ eventType: string; status: string }>; heldSlots: string[]; cap: number }> = {}) {
  return {
    robots: [{ robotId: 7, robotName: 'Bolt', subscriptions: [], heldSlots: [], cap: 3, ...robot }],
    registeredEvents: EVENTS.map(({ type, label }) => ({ type, label })),
    bookingOfficeLevel: 0,
    nextSchedulingMoments: {},
  };
}

function renderStep(onComplete = vi.fn()) {
  render(
    <MemoryRouter>
      <EventSubscriptionStep robotId={7} loadoutType="single" onComplete={onComplete} onSkip={vi.fn()} />
    </MemoryRouter>,
  );
  return onComplete;
}

beforeEach(() => {
  vi.clearAllMocks();
  subs.overview = overview();
  subs.events = EVENTS;
  subs.save.mockResolvedValue({ success: true });
});

describe('EventSubscriptionStep', () => {
  it('opens with the three solo events ticked and saves them in one click', async () => {
    const user = userEvent.setup();
    const onComplete = renderStep();

    expect(screen.getByRole('checkbox', { name: /1v1 League/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /1v1 Tournament/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /King of the Hill/ })).toBeChecked();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enter 3 events & finish' }));

    expect(subs.save).toHaveBeenCalledWith(7, ['league_1v1', 'tournament_1v1', 'koth']);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('blocks extra events at the cap and shows why an event is unavailable', async () => {
    const user = userEvent.setup();
    renderStep();

    expect(screen.getByRole('checkbox', { name: /Grand Melee/ })).toBeDisabled();
    // Events the roster can't enter yet are a short note, not checkboxes.
    expect(screen.queryByRole('checkbox', { name: /Tag Team/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('unavailable-events')).toHaveTextContent('Tag Team requires 2 or more robots in your Stable');

    await user.click(screen.getByRole('checkbox', { name: /King of the Hill/ }));
    await user.click(screen.getByRole('checkbox', { name: /Grand Melee/ }));
    await user.click(screen.getByRole('button', { name: 'Enter 3 events & finish' }));
    expect(subs.save).toHaveBeenCalledWith(7, ['league_1v1', 'tournament_1v1', 'grand_melee']);
  });

  it('keeps a robot\'s current entries instead of the defaults', () => {
    subs.overview = overview({ subscriptions: [{ eventType: 'grand_melee', status: 'active' }] });
    renderStep();

    expect(screen.getByRole('checkbox', { name: /Grand Melee/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /1v1 League/ })).not.toBeChecked();
  });

  it('cannot save an empty set and warns the robot will not fight', async () => {
    const user = userEvent.setup();
    subs.overview = overview({ cap: 1 });
    renderStep();

    await user.click(screen.getByRole('checkbox', { name: /1v1 League/ }));
    expect(screen.getByText(/never be scheduled for a battle/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter 0 events & finish' })).toBeDisabled();
  });

  it('shows the server message when the cap is exceeded and stays on the step', async () => {
    const user = userEvent.setup();
    subs.save.mockRejectedValue(new ApiError('That would put the robot at 4/3 event slots. Upgrade the Booking Office for more.', 'SUBSCRIPTION_CAP_EXCEEDED', 400));
    const onComplete = renderStep();

    await user.click(screen.getByRole('button', { name: 'Enter 3 events & finish' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That would put the robot at 4/3 event slots');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('asks once for a fresh overview when the new robot is not in the cached one', async () => {
    subs.overview = { ...overview(), robots: [] };
    renderStep();

    expect(subs.refetch).toHaveBeenCalledTimes(1);
    // Still missing after the refresh: say so instead of loading forever.
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the events');
  });
});
