/**
 * SubscriptionManager Component
 *
 * Robot Detail subscription section: which events this robot is entered in, how
 * many slots it occupies, and when each event next books matches.
 *
 * Presents the same rule as the Booking Office matrix, in the same words:
 * - Subscribing enters the robot; it counts against the Booking Office cap.
 * - Unsubscribing is always allowed, for every event.
 * - An event with a match already booked keeps its slot until that match has been
 *   fought. Those are marked "slot held" and explained in the row itself, not in
 *   a hover tooltip — a touch device cannot hover.
 *
 * There is no per-event lock and no "pending" state. Both existed here before and
 * neither survived unification: the locks contradicted each other across events,
 * and nothing ever wrote a pending subscription.
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

interface SubscriptionManagerProps {
  /** The robot ID to manage subscriptions for */
  robotId: number;
  /** Whether this robot is on a tag team */
  isOnTagTeam?: boolean;
}

/** How long until the given ISO moment, phrased for a player. */
function formatCountdown(iso: string | undefined): string | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;

  const minutes = Math.max(0, Math.round((target - Date.now()) / 60_000));
  if (minutes < 60) return `in ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `in ${hours}h` : `in ${hours}h ${remainder}m`;
}

function SubscriptionManager({ robotId, isOnTagTeam = false }: SubscriptionManagerProps) {
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
  const heldSlots = data?.heldSlots ?? [];
  const nextSchedulingMoments = data?.nextSchedulingMoments ?? {};
  const cap = data?.cap ?? 3;
  const level = data?.level ?? 0;

  const subscribedTypes = new Set(subscriptions.map((s) => s.eventType));
  // A booked match occupies a slot whether or not the robot is still entered.
  const occupied = new Set([...subscribedTypes, ...heldSlots]);
  const atCap = occupied.size >= cap;

  const notify = (message: string): void => {
    setConfirmationMessage(message);
    setTimeout(() => setConfirmationMessage(null), 4000);
  };

  const handleSubscribe = async (eventType: string) => {
    try {
      const result = await subscribe(eventType);
      notify(result.message || 'Entered. Takes effect at the next scheduling moment.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to subscribe');
    }
  };

  const handleUnsubscribe = async (eventType: string) => {
    try {
      const result = await unsubscribe(eventType);
      if (result.heldSlots?.includes(eventType)) {
        notify('Left the event. A match is already booked, so it still goes ahead and holds the slot until fought.');
      } else {
        notify(result.message || 'Left the event.');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to unsubscribe');
    }
  };

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

  const showTagTeamWarning = isOnTagTeam && !subscribedTypes.has('tag_team');

  return (
    <div className="bg-surface rounded-lg border border-white/10 p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Event Subscriptions</h3>
        <CapIndicator current={occupied.size} cap={cap} level={level} />
      </div>

      {confirmationMessage && (
        <div
          role="status"
          className="bg-blue-900/30 border border-blue-500/30 text-blue-200 px-3 py-2 rounded text-sm"
        >
          {confirmationMessage}
        </div>
      )}

      {atCap && (
        <div className="bg-amber-900/20 border border-amber-500/30 text-amber-200 px-3 py-2 rounded text-sm">
          All {cap} event slots are in use. Leave an event or upgrade your Booking Office to enter more.
        </div>
      )}

      {heldSlots.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-500/30 text-amber-200 px-3 py-2 rounded text-sm">
          A slot is held by a match that has been booked but not yet fought. It frees up once the
          match has run.
        </div>
      )}

      {showTagTeamWarning && (
        <div
          className="bg-amber-900/20 border border-amber-500/30 text-amber-200 px-3 py-2 rounded text-sm flex items-start gap-2"
          role="alert"
        >
          <span className="flex-shrink-0" aria-hidden="true">{'\u26A0\uFE0F'}</span>
          <span>
            This robot is on a Tag Team but not entered in Tag Team events.
            The team will not be matched until both members are entered.
          </span>
        </div>
      )}

      <div className="space-y-2">
        {registryEvents.map((event) => (
          <EventToggleRow
            key={event.type}
            event={event}
            isSubscribed={subscribedTypes.has(event.type)}
            isHeld={heldSlots.includes(event.type)}
            nextSchedulingMoment={nextSchedulingMoments[event.type]}
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
        {current}/{cap} slots
      </span>
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isFull ? 'bg-amber-400' : 'bg-blue-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {level > 0 && <span className="text-xs text-secondary">L{level}</span>}
    </div>
  );
}

interface EventToggleRowProps {
  event: EligibleEvent;
  isSubscribed: boolean;
  isHeld: boolean;
  nextSchedulingMoment?: string;
  atCap: boolean;
  mutating: boolean;
  onSubscribe: (eventType: string) => void;
  onUnsubscribe: (eventType: string) => void;
}

function EventToggleRow({
  event,
  isSubscribed,
  isHeld,
  nextSchedulingMoment,
  atCap,
  mutating,
  onSubscribe,
  onUnsubscribe,
}: EventToggleRowProps) {
  const canSubscribe = !atCap && event.eligible && !isSubscribed && !mutating;
  // Leaving is never blocked — that is the whole point of the unified rule.
  const canUnsubscribe = isSubscribed && !mutating;
  const countdown = formatCountdown(nextSchedulingMoment);

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-lg min-h-[44px]">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <EventBadge eventType={event.type} />
          {isSubscribed && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300">
              Entered
            </span>
          )}
          {isHeld && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300">
              Slot held
            </span>
          )}
          {!event.eligible && (
            <span className="text-xs text-amber-400 truncate" title={event.reason}>
              No longer eligible
            </span>
          )}
        </div>
        {countdown && (
          <span className="text-xs text-secondary">Books next matches {countdown}</span>
        )}
      </div>

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
            aria-label={`Leave ${event.label}`}
          >
            Leave
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
            aria-label={`Enter ${event.label}`}
          >
            Enter
          </button>
        )}
      </div>
    </div>
  );
}

export default SubscriptionManager;
