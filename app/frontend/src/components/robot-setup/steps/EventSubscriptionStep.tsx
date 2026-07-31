/**
 * EventSubscriptionStep — Step 6 of the robot setup wizard.
 * Displays event checklist with subscription cap indicator.
 * Pre-checks relevant team events if robot was assigned to a team.
 *
 * Requirements: 5.7, 6.1, 6.2, 10.3
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptionStore, selectOverview } from '../../../stores/subscriptionStore';
import { api } from '../../../utils/api';
import type { StepProps } from '../types';

interface SubscriptionToggle {
  eventType: string;
  label: string;
  active: boolean;
}

const EVENT_LABELS: Record<string, string> = {
  league_1v1: '1v1 League',
  tournament_1v1: '1v1 Tournament',
  koth: 'King of the Hill',
  grand_melee: 'Grand Melee',
  league_2v2: '2v2 League',
  league_3v3: '3v3 League',
  tag_team: 'Tag Team',
  tournament_2v2: '2v2 Tournament',
  tournament_3v3: '3v3 Tournament',
};

function EventSubscriptionStep({ robotId, onComplete, onSkip }: StepProps) {
  const navigate = useNavigate();
  const overview = useSubscriptionStore(selectOverview);
  const fetchOverview = useSubscriptionStore(state => state.fetchOverview);
  const [toggles, setToggles] = useState<SubscriptionToggle[]>([]);
  const [cap, setCap] = useState(3);
  const [activeCount, setActiveCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (!overview) return;

    const robot = overview.robots.find((r) => r.robotId === robotId);
    if (!robot) return;

    setCap(robot.cap);

    const events = overview.registeredEvents.map((event) => {
      const isActive = robot.subscriptions.some(
        (s) => s.eventType === event.type && s.status === 'active'
      );
      return {
        eventType: event.type,
        label: EVENT_LABELS[event.type] || event.label,
        active: isActive,
      };
    });

    setToggles(events);
    setActiveCount(events.filter((e) => e.active).length);
  }, [overview, robotId]);

  const handleToggle = async (eventType: string): Promise<void> => {
    const toggle = toggles.find((t) => t.eventType === eventType);
    if (!toggle) return;

    const newActive = !toggle.active;

    // Cap check
    if (newActive && activeCount >= cap) {
      setError(`Subscription cap reached (${cap}). Upgrade your Booking Office for more slots.`);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      // Build the full subscription set
      const desired = toggles.map((t) =>
        t.eventType === eventType ? { eventType: t.eventType, active: newActive } : { eventType: t.eventType, active: t.active }
      );

      const activeEvents = desired.filter((d) => d.active).map((d) => d.eventType);

      await api.put(`/api/subscriptions/robot/${robotId}`, { subscriptions: activeEvents });

      // Update local state
      setToggles((prev) =>
        prev.map((t) => t.eventType === eventType ? { ...t, active: newActive } : t)
      );
      setActiveCount(newActive ? activeCount + 1 : activeCount - 1);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setBusy(false);
    }
  };

  if (!overview) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Event Subscriptions</h2>
        <div className="text-secondary text-sm animate-pulse">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-white">Event Subscriptions</h2>
        <p className="text-secondary text-sm mt-1">
          Subscribe to battle events so your robot gets scheduled for fights.
          You need at least one subscription for your robot to compete.
        </p>
      </div>

      {/* Cap indicator */}
      <div className="bg-surface border border-gray-700 rounded-lg p-3 flex justify-between items-center">
        <span className="text-secondary text-sm">Subscription Slots</span>
        <span className={`font-semibold text-sm ${activeCount >= cap ? 'text-warning' : 'text-white'}`}>
          {activeCount} / {cap}
        </span>
      </div>

      {activeCount >= cap && (
        <div className="bg-warning/10 border border-warning rounded-lg p-3 flex items-center justify-between">
          <span className="text-warning text-sm">Cap reached — upgrade Booking Office for more slots</span>
          <button
            onClick={() => navigate('/facilities')}
            className="text-warning hover:text-yellow-300 text-sm font-semibold min-h-[44px] px-3 py-2 transition-colors"
          >
            Upgrade →
          </button>
        </div>
      )}

      {error && (
        <div className="bg-error/10 border border-error rounded-lg p-3 text-error text-sm">
          {error}
        </div>
      )}

      {/* Event toggles */}
      <div className="space-y-2">
        {toggles.map((toggle) => (
          <button
            key={toggle.eventType}
            onClick={() => handleToggle(toggle.eventType)}
            disabled={busy || (!toggle.active && activeCount >= cap)}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors min-h-[44px] ${
              toggle.active
                ? 'bg-primary/10 border-primary'
                : 'bg-surface border-gray-700 hover:border-gray-500'
            } disabled:opacity-50`}
          >
            <span className={`text-sm font-medium ${toggle.active ? 'text-primary' : 'text-white'}`}>
              {toggle.label}
            </span>
            <span className={`text-xs font-semibold px-2 py-1 rounded ${
              toggle.active ? 'bg-primary text-white' : 'bg-surface-elevated text-secondary'
            }`}>
              {toggle.active ? '✓ Active' : 'Inactive'}
            </span>
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onComplete}
          disabled={activeCount === 0}
          className="bg-primary hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg min-h-[44px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saved ? 'Continue' : 'Continue'}
        </button>
        {onSkip && activeCount === 0 && (
          <button
            onClick={onSkip}
            className="bg-surface-elevated hover:bg-gray-600 text-white px-6 py-3 rounded-lg min-h-[44px] transition-colors"
          >
            Skip — Subscribe Later
          </button>
        )}
      </div>

      {activeCount === 0 && (
        <p className="text-warning text-xs text-center">
          ⚠️ Without at least one subscription, your robot will never be scheduled for battles.
        </p>
      )}
    </div>
  );
}

export default EventSubscriptionStep;
