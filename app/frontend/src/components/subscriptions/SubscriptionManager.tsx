/**
 * SubscriptionManager Component
 *
 * Robot Detail subscription section showing current subscriptions, cap indicator,
 * subscribe/unsubscribe toggles, status indicators, and eligibility filtering.
 *
 * Two-state model:
 * - "active" (green) — matchmaker will schedule matches
 * - "pending" (amber) — waiting for slot to open
 *
 * Requirements: R9.2, R9.3, R9.4, R9.5, R9.7, R9.8, R9.9, R9.12
 */

import { useState } from 'react';
import {
  useRobotSubscriptions,
  useEventRegistry,
  type EligibleEvent,
} from '../../hooks/useSubscriptions';
import EventBadge from './EventBadge';
import SubscriptionLockIndicator from './SubscriptionLockIndicator';

interface SubscriptionManagerProps {
  /** The robot ID to manage subscriptions for */
  robotId: number;
  /** Optional lock state map: eventType → { isLocked, scheduledCycle? } — only tournament uses locks now */
  lockStates?: Record<string, { isLocked: boolean; scheduledCycle?: number }>;
  /** Whether this robot is on a tag team */
  isOnTagTeam?: boolean;
}

function SubscriptionManager({ robotId, lockStates = {}, isOnTagTeam = false }: SubscriptionManagerProps) {
  const {
    data,
    loading: subsLoading,
    error: subsError,
    subscribe,
    unsubscribe,
    mutating,
  } = useRobotSubscriptions(robotId);

  const {
    events: registryEvents,
    loading: registryLoading,
    error: registryError,
  } = useEventRegistry();

  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const loading = subsLoading || registryLoading;
  const error = subsError || registryError;

  if (loading) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-4">
        <div className="text-secondary text-sm">Loading subscriptions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-4">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  const subscriptions = data?.subscriptions ?? [];
  const cap = data?.cap ?? 3;
  const level = data?.level ?? 0;
  const currentCount = subscriptions.length;
  const atCap = currentCount >= cap;

  // Build maps of currently subscribed event types and their statuses
  const subscribedTypes = new Set(subscriptions.map((s) => s.eventType));
  const subscriptionStatusMap = new Map(subscriptions.map((s) => [s.eventType, s.status]));

  // Handle subscribe action
  const handleSubscribe = async (eventType: string) => {
    try {
      const result = await subscribe(eventType);
      setConfirmationMessage(result.message || 'Subscribed. Takes effect next cycle.');
      setTimeout(() => setConfirmationMessage(null), 4000);
    } catch (err) {
      setConfirmationMessage(
        err instanceof Error ? err.message : 'Failed to subscribe',
      );
      setTimeout(() => setConfirmationMessage(null), 4000);
    }
  };

  // Handle unsubscribe action
  const handleUnsubscribe = async (eventType: string) => {
    try {
      const result = await unsubscribe(eventType);
      setConfirmationMessage(result.message || 'Unsubscribed. Takes effect next cycle.');
      setTimeout(() => setConfirmationMessage(null), 4000);
    } catch (err) {
      setConfirmationMessage(
        err instanceof Error ? err.message : 'Failed to unsubscribe',
      );
      setTimeout(() => setConfirmationMessage(null), 4000);
    }
  };

  // Empty state
  if (subscriptions.length === 0 && registryEvents.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-4">
        <h3 className="text-lg font-semibold mb-2">Event Subscriptions</h3>
        <p className="text-secondary text-sm">
          No event subscriptions available. The Booking Office facility manages which battle events
          this robot participates in.
        </p>
      </div>
    );
  }

  const isSubscribedToTagTeam = subscribedTypes.has('tag_team');
  const showTagTeamWarning = isOnTagTeam && !isSubscribedToTagTeam;

  return (
    <div className="bg-surface rounded-lg border border-white/10 p-4 space-y-4">
      {/* Header with cap indicator */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Event Subscriptions</h3>
        <CapIndicator current={currentCount} cap={cap} level={level} />
      </div>

      {/* Confirmation message */}
      {confirmationMessage && (
        <div className="bg-blue-900/30 border border-blue-500/30 text-blue-200 px-3 py-2 rounded text-sm">
          {confirmationMessage}
        </div>
      )}

      {/* Cap reached upgrade prompt */}
      {atCap && (
        <div className="bg-amber-900/20 border border-amber-500/30 text-amber-200 px-3 py-2 rounded text-sm">
          Subscription cap reached ({currentCount}/{cap}). Upgrade your Booking Office to add more event subscriptions.
        </div>
      )}

      {/* Tag Team subscription warning */}
      {showTagTeamWarning && (
        <div
          className="bg-amber-900/20 border border-amber-500/30 text-amber-200 px-3 py-2 rounded text-sm flex items-start gap-2"
          role="alert"
        >
          <span className="flex-shrink-0" aria-hidden="true">{'\u26A0\uFE0F'}</span>
          <span>
            This robot is on a Tag Team but not subscribed to Tag Team events.
            The team will not be matched until both members are subscribed.
          </span>
        </div>
      )}

      {/* Event toggles list — mobile responsive vertical layout */}
      <div className="space-y-2">
        {registryEvents.map((event) => (
          <EventToggleRow
            key={event.type}
            event={event}
            isSubscribed={subscribedTypes.has(event.type)}
            subscriptionStatus={subscriptionStatusMap.get(event.type)}
            isLocked={event.type === 'tournament' && (lockStates[event.type]?.isLocked ?? false)}
            scheduledCycle={lockStates[event.type]?.scheduledCycle}
            atCap={atCap}
            mutating={mutating}
            onSubscribe={handleSubscribe}
            onUnsubscribe={handleUnsubscribe}
          />
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

interface CapIndicatorProps {
  current: number;
  cap: number;
  level: number;
}

function CapIndicator({ current, cap, level }: CapIndicatorProps) {
  const percentage = cap > 0 ? Math.min(100, (current / cap) * 100) : 0;
  const isFull = current >= cap;

  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-medium ${isFull ? 'text-amber-400' : 'text-secondary'}`}>
        {current}/{cap} subscriptions
      </span>
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isFull ? 'bg-amber-400' : 'bg-blue-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {level > 0 && (
        <span className="text-xs text-secondary">L{level}</span>
      )}
    </div>
  );
}

interface EventToggleRowProps {
  event: EligibleEvent;
  isSubscribed: boolean;
  subscriptionStatus?: 'active' | 'pending';
  isLocked: boolean;
  scheduledCycle?: number;
  atCap: boolean;
  mutating: boolean;
  onSubscribe: (eventType: string) => void;
  onUnsubscribe: (eventType: string) => void;
}

function EventToggleRow({
  event,
  isSubscribed,
  subscriptionStatus,
  isLocked,
  scheduledCycle,
  atCap,
  mutating,
  onSubscribe,
  onUnsubscribe,
}: EventToggleRowProps) {
  const canSubscribe = !atCap && event.eligible && !isSubscribed && !mutating;
  // Remove button always enabled except for tournament lock
  const canUnsubscribe = isSubscribed && !isLocked && !mutating;

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-lg min-h-[44px]">
      {/* Left: event badge + status + eligibility info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <EventBadge eventType={event.type} />
        {isSubscribed && subscriptionStatus && (
          <SubscriptionStatusBadge status={subscriptionStatus} />
        )}
        {!event.eligible && (
          <span className="text-xs text-amber-400 truncate" title={event.reason}>
            No longer eligible
          </span>
        )}
        {isLocked && (
          <SubscriptionLockIndicator isLocked={isLocked} scheduledCycle={scheduledCycle} />
        )}
      </div>

      {/* Right: toggle button */}
      <div className="flex-shrink-0">
        {isSubscribed ? (
          <button
            onClick={() => onUnsubscribe(event.type)}
            disabled={!canUnsubscribe}
            className={`
              min-w-[44px] min-h-[44px] px-3 py-1.5 rounded text-sm font-medium transition-colors
              ${canUnsubscribe
                ? 'bg-white/5 text-secondary hover:bg-white/10'
                : 'bg-white/5 text-secondary cursor-not-allowed'
              }
            `}
            aria-label={`Unsubscribe from ${event.label}`}
          >
            {isLocked ? 'Locked' : 'Remove'}
          </button>
        ) : (
          <button
            onClick={() => onSubscribe(event.type)}
            disabled={!canSubscribe}
            className={`
              min-w-[44px] min-h-[44px] px-3 py-1.5 rounded text-sm font-medium transition-colors
              ${canSubscribe
                ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                : 'bg-white/5 text-secondary cursor-not-allowed'
              }
            `}
            aria-label={`Subscribe to ${event.label}`}
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}

/** Status badge showing Active (green) or Pending (amber) */
function SubscriptionStatusBadge({ status }: { status: 'active' | 'pending' }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300">
        Active
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300"
      title="Will activate when a scheduled match completes and frees a slot"
    >
      Pending
    </span>
  );
}

export default SubscriptionManager;
