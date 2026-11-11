/**
 * EventSubscriptionStep — last wizard step: enter battle events (a hard gate).
 *
 * Opens with the solo events ticked (or the robot's current entries), so one
 * click saves the set and finishes the setup. Saves the whole set through
 * `saveRobotSubscriptions`, the same call the Booking Office uses.
 *
 * Requirements: 5.7, 6.1, 6.2, 10.3
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { saveRobotSubscriptions, useEventRegistry, useStableOverview } from '../../../hooks/useSubscriptions';
import { ApiError } from '../../../utils/ApiError';
import { defaultEventSelection } from '../../../utils/robotSetupSteps';
import { ERROR_NOTICE, PANEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../styles';
import type { StepProps } from '../types';

function saveErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.code === 'SUBSCRIPTION_CAP_EXCEEDED') return err.message;
  return 'Saving the events failed. Please try again.';
}

function EventSubscriptionStep({ robotId, onComplete, onSkip }: StepProps) {
  const { data: overview, loading: overviewLoading, error: overviewError, refetch } = useStableOverview();
  const { events, error: registryError } = useEventRegistry();
  const [selected, setSelected] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const robot = overview?.robots.find((r) => r.robotId === robotId) ?? null;
  const cap = robot?.cap ?? 0;
  const held = useMemo(() => robot?.heldSlots ?? [], [robot]);
  const eligible = useMemo(() => events.filter((e) => e.eligible).map((e) => e.type), [events]);
  const available = events.filter((e) => e.eligible);
  // Team events a small stable can't enter yet: one short note, not a row each.
  const unavailable = events.filter((e) => !e.eligible);

  // The shared overview is cached briefly; a robot created moments ago may
  // not be in it yet, so ask once for a fresh copy.
  const [refreshed, setRefreshed] = useState(false);
  useEffect(() => {
    if (overview && !robot && !refreshed) {
      setRefreshed(true);
      void refetch();
    }
  }, [overview, robot, refreshed, refetch]);
  const robotMissing = refreshed && !overviewLoading && Boolean(overview) && !robot;

  // Tick the defaults once both the robot's slots and the event list are in.
  useEffect(() => {
    if (selected !== null || !robot || events.length === 0) return;
    const active = robot.subscriptions.filter((s) => s.status === 'active').map((s) => s.eventType);
    setSelected(defaultEventSelection(eligible, active, cap));
  }, [selected, robot, events.length, eligible, cap]);

  const chosen = selected ?? [];
  // A slot with a booked match stays taken until that match is fought.
  const occupied = new Set([...chosen, ...held]);
  const full = occupied.size >= cap;

  const toggle = (type: string): void => {
    setSelected((current) => {
      const list = current ?? [];
      return list.includes(type) ? list.filter((t) => t !== type) : [...list, type];
    });
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await saveRobotSubscriptions(robotId, chosen);
      onComplete();
    } catch (err: unknown) {
      setError(saveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const loadFailed = (Boolean(overviewError || registryError) || robotMissing) && selected === null;
  const ready = selected !== null;

  return (
    <section className={PANEL} aria-labelledby="events-step-heading">
      <h2 id="events-step-heading" className="text-lg font-semibold">Enter battle events</h2>
      <p className="mt-1 text-sm text-secondary">
        Your robot is only scheduled for the events it is entered in. You can change these any time in the{' '}
        <Link to="/booking-office" className="text-primary hover:underline">Booking Office</Link>.
      </p>

      {loadFailed && <p className={`${ERROR_NOTICE} mt-4`} role="alert">Could not load the events. Skip this step and enter them in the Booking Office.</p>}
      {!ready && !loadFailed && <p className="mt-4 text-sm text-secondary">Loading events…</p>}

      {ready && (
        <>
          <p className="mt-4 text-sm" aria-live="polite">
            <span className={`font-semibold tabular-nums ${full ? 'text-warning' : 'text-white'}`}>{occupied.size} / {cap}</span>
            <span className="text-secondary"> event slots used{full ? ' · upgrade the Booking Office for more' : ''}</span>
          </p>
          <fieldset className="mt-3">
            <legend className="sr-only">Battle events</legend>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {available.map((event) => {
                const isChecked = chosen.includes(event.type);
                const disabled = !isChecked && full;
                const heldNote = held.includes(event.type) && !isChecked;
                return (
                  <li key={event.type}>
                    <label
                      className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 ${
                        isChecked ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-surface-elevated'
                      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/40'}`}
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 flex-shrink-0 accent-primary"
                        checked={isChecked}
                        disabled={disabled}
                        onChange={() => toggle(event.type)}
                      />
                      <span className="text-sm">
                        {event.label}
                        {heldNote && <span className="block text-xs text-secondary">Slot held until its booked match</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          {unavailable.length > 0 && (
            <div className="mt-3 text-xs text-secondary" data-testid="unavailable-events">
              <p>Not available yet:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {unavailable.map((event) => <li key={event.type}>{event.reason ?? event.label}</li>)}
              </ul>
            </div>
          )}
        </>
      )}

      {error && <p className={`${ERROR_NOTICE} mt-4`} role="alert">{error}</p>}
      {ready && chosen.length === 0 && held.length === 0 && (
        <p className="mt-4 text-sm text-warning">Without an event this robot will never be scheduled for a battle.</p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        {onSkip && <button type="button" onClick={onSkip} disabled={saving} className={SECONDARY_BUTTON}>Skip for now</button>}
        <button type="button" onClick={() => void save()} disabled={!ready || saving || chosen.length === 0} className={PRIMARY_BUTTON}>
          {saving ? 'Saving…' : `Enter ${chosen.length} ${chosen.length === 1 ? 'event' : 'events'} & finish`}
        </button>
      </div>
    </section>
  );
}

export default EventSubscriptionStep;
