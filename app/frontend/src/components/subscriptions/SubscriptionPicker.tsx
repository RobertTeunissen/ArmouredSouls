/**
 * SubscriptionPicker Component
 *
 * Onboarding subscription picker for new Stables.
 * Renders event list from registry filtered by Roster_Eligibility_Filter.
 * Pre-selects `league`, `tournament`, `koth` for 1-robot Stables.
 * Allows toggling up to cap (3 at L0).
 * Inline "Buy Booking Office L1" affordance: hidden for 1-robot Stables,
 * disabled if insufficient credits/prestige.
 * On complete: calls subscribe endpoint for each selected event.
 *
 * Requirements: R8.1, R8.2, R8.3, R8.4, R8.5, R8.6, R8.7, R8.8
 */

import { useState, useEffect, useCallback } from 'react';
import { useEventRegistry } from '../../hooks/useSubscriptions';
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';
import EventBadge from './EventBadge';

interface SubscriptionPickerProps {
  /** The robot ID to subscribe events for (primary robot shown in UI) */
  robotId: number;
  /** All robot IDs to subscribe (all get the same selections). Defaults to [robotId]. */
  allRobotIds?: number[];
  /** Number of robots the Stable currently owns */
  robotCount: number;
  /** Current credits available to the Stable */
  credits: number;
  /** Current prestige of the Stable */
  prestige: number;
  /** Called when the picker completes (all subscriptions saved) */
  onComplete: () => void;
  /** Optional: current Booking Office level (defaults to 0 for new Stables) */
  bookingOfficeLevel?: number;
}

/** Default pre-selected events for 1-robot Stables */
const DEFAULT_SELECTIONS_1_ROBOT = ['league', 'tournament', 'koth'];

/** Booking Office L1 cost (matches backend config) */
const BOOKING_OFFICE_L1_COST = 75000;
/** Booking Office L1 prestige requirement */
const BOOKING_OFFICE_L1_PRESTIGE = 0;

function SubscriptionPicker({
  robotId,
  allRobotIds,
  robotCount,
  credits,
  prestige,
  onComplete,
  bookingOfficeLevel = 0,
}: SubscriptionPickerProps) {
  const { events, loading: registryLoading, error: registryError } = useEventRegistry();
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasUpgraded, setHasUpgraded] = useState(false);

  // All robots to subscribe — defaults to just the primary robot
  const robotIds = allRobotIds ?? [robotId];

  // Cap: 3 at L0, 4 at L1, etc.
  const currentLevel = hasUpgraded ? bookingOfficeLevel + 1 : bookingOfficeLevel;
  const cap = 3 + currentLevel;

  // Filter events by eligibility (Roster_Eligibility_Filter)
  const eligibleEvents = events.filter((e) => e.eligible);

  // Pre-select defaults when events load
  useEffect(() => {
    if (events.length > 0 && selectedEvents.size === 0) {
      const defaults = robotCount === 1
        ? DEFAULT_SELECTIONS_1_ROBOT.filter((type) =>
            events.some((e) => e.type === type && e.eligible),
          )
        : events
            .filter((e) => e.eligible)
            .slice(0, cap)
            .map((e) => e.type);
      setSelectedEvents(new Set(defaults));
    }
  }, [events, robotCount, cap, selectedEvents.size]);

  const handleToggle = useCallback(
    (eventType: string) => {
      setSelectedEvents((prev) => {
        const next = new Set(prev);
        if (next.has(eventType)) {
          next.delete(eventType);
        } else if (next.size < cap) {
          next.add(eventType);
        }
        return next;
      });
    },
    [cap],
  );

  const handleBuyL1 = async () => {
    try {
      await api.post('/api/facilities/upgrade', { facilityType: 'booking_office' });
      setHasUpgraded(true);
    } catch {
      setSubmitError('Failed to purchase Booking Office upgrade.');
    }
  };

  const handleComplete = async () => {
    if (selectedEvents.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Subscribe each robot sequentially to avoid audit log sequence number conflicts.
      // Skip duplicates gracefully (robot may already be subscribed from a previous attempt).
      for (const rid of robotIds) {
        for (const eventType of selectedEvents) {
          try {
            await api.post(`/api/subscriptions/robot/${rid}/subscribe`, { eventType });
          } catch (err: unknown) {
            // Skip duplicate or cap errors — robot may already be subscribed from a previous attempt
            if (err instanceof ApiError && (err.code === 'SUBSCRIPTION_DUPLICATE' || err.code === 'SUBSCRIPTION_CAP_EXCEEDED')) {
              continue;
            }
            throw err;
          }
        }
      }
      onComplete();
    } catch {
      setSubmitError('Failed to save subscriptions. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Determine if the "Buy L1" affordance should be shown
  // Hidden for 1-robot Stables (R8.3)
  const showBuyL1 = robotCount > 1 && !hasUpgraded && bookingOfficeLevel === 0;
  const canAffordL1 = credits >= BOOKING_OFFICE_L1_COST && prestige >= BOOKING_OFFICE_L1_PRESTIGE;

  if (registryLoading) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-6">
        <div className="text-secondary text-sm">Loading available events...</div>
      </div>
    );
  }

  if (registryError) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-6">
        <div className="text-red-400 text-sm">{registryError}</div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-white/10 p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold mb-2">Choose Event Subscriptions</h3>
        <p className="text-secondary text-sm">
          Select which battle events your robot will participate in.
          You can pick up to <span className="text-primary font-medium">{cap}</span> events.
        </p>
      </div>

      {/* Cap indicator */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-secondary">Selected:</span>
        <span
          className={`text-sm font-medium ${
            selectedEvents.size >= cap ? 'text-amber-400' : 'text-primary'
          }`}
        >
          {selectedEvents.size}/{cap}
        </span>
      </div>

      {/* Event list — full-width vertical list for mobile responsiveness */}
      <div className="space-y-2">
        {eligibleEvents.map((event) => {
          const isSelected = selectedEvents.has(event.type);
          const canSelect = isSelected || selectedEvents.size < cap;

          return (
            <button
              key={event.type}
              onClick={() => handleToggle(event.type)}
              disabled={!canSelect && !isSelected}
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg border transition-colors
                min-h-[44px]
                ${isSelected
                  ? 'border-green-500/50 bg-green-500/10'
                  : canSelect
                    ? 'border-white/10 bg-surface-elevated hover:border-blue-500/50 hover:bg-blue-500/5'
                    : 'border-white/5 bg-surface-elevated/50 opacity-50 cursor-not-allowed'
                }
              `}
              aria-pressed={isSelected}
              aria-label={`${isSelected ? 'Deselect' : 'Select'} ${event.label}`}
            >
              {/* Checkbox indicator */}
              <div
                className={`
                  w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                  ${isSelected
                    ? 'border-green-400 bg-green-500/20'
                    : 'border-white/30'
                  }
                `}
              >
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5 text-green-400"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* Event badge + label */}
              <EventBadge eventType={event.type} />
              <span className="text-sm font-medium">{event.label}</span>
            </button>
          );
        })}

        {/* Ineligible events shown as disabled with reason */}
        {events
          .filter((e) => !e.eligible)
          .map((event) => (
            <div
              key={event.type}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-surface-elevated/30 opacity-50"
            >
              <div className="w-5 h-5 rounded border-2 border-white/20 flex-shrink-0" />
              <EventBadge eventType={event.type} />
              <span className="text-sm font-medium text-secondary">{event.label}</span>
              {event.reason && (
                <span className="text-xs text-secondary ml-auto">{event.reason}</span>
              )}
            </div>
          ))}
      </div>

      {/* Buy Booking Office L1 affordance */}
      {showBuyL1 && (
        <div className="border border-white/10 rounded-lg p-4 bg-surface-elevated/50">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Unlock a 4th subscription slot</div>
              <div className="text-xs text-secondary mt-0.5">
                Purchase Booking Office Level 1 for ₡{BOOKING_OFFICE_L1_COST.toLocaleString()}
              </div>
            </div>
            <button
              onClick={handleBuyL1}
              disabled={!canAffordL1}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]
                ${canAffordL1
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-surface-elevated text-secondary cursor-not-allowed'
                }
              `}
              title={
                !canAffordL1
                  ? `Requires ₡${BOOKING_OFFICE_L1_COST.toLocaleString()}${BOOKING_OFFICE_L1_PRESTIGE > 0 ? ` and ${BOOKING_OFFICE_L1_PRESTIGE} prestige` : ''}`
                  : undefined
              }
            >
              {canAffordL1 ? 'Buy L1' : 'Insufficient Credits'}
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {submitError && (
        <div className="text-red-400 text-sm">{submitError}</div>
      )}

      {/* Complete button */}
      <button
        onClick={handleComplete}
        disabled={submitting || selectedEvents.size === 0}
        className={`
          w-full py-3 rounded-lg font-semibold transition-colors min-h-[44px]
          ${selectedEvents.size > 0 && !submitting
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-surface-elevated text-secondary cursor-not-allowed'
          }
        `}
      >
        {submitting
          ? 'Saving subscriptions...'
          : `Confirm ${selectedEvents.size} Subscription${selectedEvents.size !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

export default SubscriptionPicker;
