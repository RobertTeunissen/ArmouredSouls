import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SubscriptionPicker from '../../components/subscriptions/SubscriptionPicker';
import * as useSubscriptionsModule from '../../hooks/useSubscriptions';
import { api } from '../../utils/api';

// Mock the hooks and api
vi.mock('../../hooks/useSubscriptions', () => ({
  useEventRegistry: vi.fn(),
}));

vi.mock('../../utils/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const defaultRegistryEvents: useSubscriptionsModule.EligibleEvent[] = [
  { type: 'league', label: '1v1 League', eligible: true },
  { type: 'tournament', label: '1v1 Tournament', eligible: true },
  { type: 'koth', label: 'King of the Hill', eligible: true },
  { type: 'tag_team', label: 'Tag Team', eligible: false, reason: 'Tag Team requires 2 or more robots' },
];

const multiRobotRegistryEvents: useSubscriptionsModule.EligibleEvent[] = [
  { type: 'league', label: '1v1 League', eligible: true },
  { type: 'tournament', label: '1v1 Tournament', eligible: true },
  { type: 'koth', label: 'King of the Hill', eligible: true },
  { type: 'tag_team', label: 'Tag Team', eligible: true },
];

describe('OnboardingSubscriptionPicker', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.mocked(useSubscriptionsModule.useEventRegistry).mockReturnValue({
      events: defaultRegistryEvents,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.mocked(api.post).mockResolvedValue({ success: true });
  });

  describe('Default selections for 1-robot Stable', () => {
    it('should pre-select league, tournament, and koth for 1-robot Stable', async () => {
      render(
        <SubscriptionPicker
          robotId={1}
          robotCount={1}
          credits={10000}
          prestige={0}
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        // Check that the three default events are selected (aria-pressed=true)
        const leagueButton = screen.getByLabelText('Deselect 1v1 League');
        expect(leagueButton).toHaveAttribute('aria-pressed', 'true');

        const tournamentButton = screen.getByLabelText('Deselect 1v1 Tournament');
        expect(tournamentButton).toHaveAttribute('aria-pressed', 'true');

        const kothButton = screen.getByLabelText('Deselect King of the Hill');
        expect(kothButton).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should show 3/3 selected count for 1-robot Stable', async () => {
      render(
        <SubscriptionPicker
          robotId={1}
          robotCount={1}
          credits={10000}
          prestige={0}
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('3/3')).toBeInTheDocument();
      });
    });
  });

  describe('tag_team hidden for 1-robot Stable', () => {
    it('should show tag_team as ineligible with reason for 1-robot Stable', async () => {
      render(
        <SubscriptionPicker
          robotId={1}
          robotCount={1}
          credits={10000}
          prestige={0}
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Tag Team requires 2 or more robots')).toBeInTheDocument();
      });
    });

    it('should not allow selecting tag_team for 1-robot Stable', async () => {
      render(
        <SubscriptionPicker
          robotId={1}
          robotCount={1}
          credits={10000}
          prestige={0}
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        // tag_team is rendered in a div (not a button) for ineligible events
        // The label span with class text-secondary indicates it's the ineligible item
        const tagTeamLabels = screen.getAllByText('Tag Team');
        // One of them should be inside a div (not a button)
        const ineligibleLabel = tagTeamLabels.find(
          (el) => el.closest('div.opacity-50') !== null
        );
        expect(ineligibleLabel).toBeDefined();
        // Verify it's not inside a button
        expect(ineligibleLabel?.closest('button')).toBeNull();
      });
    });
  });

  describe('Inline buy affordance hidden for 1-robot Stable', () => {
    it('should not show Buy L1 affordance for 1-robot Stable', async () => {
      render(
        <SubscriptionPicker
          robotId={1}
          robotCount={1}
          credits={100000}
          prestige={0}
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Choose Event Subscriptions')).toBeInTheDocument();
      });

      expect(screen.queryByText('Buy L1')).not.toBeInTheDocument();
      expect(screen.queryByText(/Unlock a 4th subscription slot/)).not.toBeInTheDocument();
    });

    it('should show Buy L1 affordance for multi-robot Stable', async () => {
      vi.mocked(useSubscriptionsModule.useEventRegistry).mockReturnValue({
        events: multiRobotRegistryEvents,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <SubscriptionPicker
          robotId={1}
          robotCount={3}
          credits={100000}
          prestige={0}
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Unlock a 4th subscription slot/)).toBeInTheDocument();
      });
    });
  });

  describe('Inline buy affordance disabled when insufficient credits/prestige', () => {
    it('should disable Buy L1 button when credits are insufficient', async () => {
      vi.mocked(useSubscriptionsModule.useEventRegistry).mockReturnValue({
        events: multiRobotRegistryEvents,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <SubscriptionPicker
          robotId={1}
          robotCount={3}
          credits={1000}
          prestige={0}
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        const buyButton = screen.getByText('Insufficient Credits');
        expect(buyButton).toBeDisabled();
      });
    });

    it('should enable Buy L1 button when credits are sufficient', async () => {
      vi.mocked(useSubscriptionsModule.useEventRegistry).mockReturnValue({
        events: multiRobotRegistryEvents,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <SubscriptionPicker
          robotId={1}
          robotCount={3}
          credits={100000}
          prestige={0}
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        const buyButton = screen.getByText('Buy L1');
        expect(buyButton).not.toBeDisabled();
      });
    });
  });

  describe('Completing onboarding persists selected subscriptions', () => {
    it('should call subscribe API for each selected event on complete', async () => {
      render(
        <SubscriptionPicker
          robotId={42}
          robotCount={1}
          credits={10000}
          prestige={0}
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Confirm 3 Subscriptions/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText(/Confirm 3 Subscriptions/);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/subscriptions/robot/42/subscribe', { eventType: 'league' });
        expect(api.post).toHaveBeenCalledWith('/api/subscriptions/robot/42/subscribe', { eventType: 'tournament' });
        expect(api.post).toHaveBeenCalledWith('/api/subscriptions/robot/42/subscribe', { eventType: 'koth' });
      });
    });

    it('should call onComplete after successful subscription', async () => {
      render(
        <SubscriptionPicker
          robotId={42}
          robotCount={1}
          credits={10000}
          prestige={0}
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Confirm 3 Subscriptions/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText(/Confirm 3 Subscriptions/);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });

    it('should allow toggling events before confirming', async () => {
      render(
        <SubscriptionPicker
          robotId={1}
          robotCount={1}
          credits={10000}
          prestige={0}
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Deselect 1v1 League')).toBeInTheDocument();
      });

      // Deselect league
      const leagueButton = screen.getByLabelText('Deselect 1v1 League');
      fireEvent.click(leagueButton);

      // Now it should show 2/3
      expect(screen.getByText('2/3')).toBeInTheDocument();
      expect(screen.getByText(/Confirm 2 Subscriptions/)).toBeInTheDocument();
    });
  });
});
