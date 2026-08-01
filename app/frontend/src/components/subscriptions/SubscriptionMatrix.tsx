/**
 * SubscriptionMatrix Component
 *
 * Stable-level view of every robot × every registered event.
 *
 * Edits are local until saved. Tapping an event marks it pending, and a sticky
 * bar saves the changed robots — one request per robot instead of one per cell.
 * Before this, every tap fired a subscribe/unsubscribe plus a full overview
 * refetch, so a full roster cost upwards of a hundred requests and routinely hit
 * the rate limiter. It also removes the scroll-jump workaround the old
 * refetch-per-toggle needed.
 *
 * The rule shown here is the same for all nine events:
 * - Subscribed events count against the robot's Booking Office cap.
 * - Unsubscribing is always allowed.
 * - An event with a match already booked keeps its slot until that match has
 *   been fought. Those are marked "held" and are explained inline rather than in
 *   a hover tooltip, because a touch device has no hover.
 *
 * Requirements: R9.10, R9.11, R9.12
 */

import { useCallback, useMemo, useState } from 'react';
import { useStableOverview, saveRobotSubscriptions } from '../../hooks/useSubscriptions';
import type { StableOverviewRobot, CapExceededDetails } from '../../hooks/useSubscriptions';
import { ApiError } from '../../utils/ApiError';
import EventBadge from './EventBadge';

interface SubscriptionMatrixProps {
  /** Robots on a tag team, used to warn when they are not subscribed to Tag Team. */
  tagTeamRobotIds?: Set<number>;
}

/** Pending edits: robotId → the set of events the player wants. */
type DraftMap = Record<number, string[]>;

/** Per-robot save outcome, shown after a save attempt. */
type SaveOutcome =
  | { kind: 'saved'; added: string[]; removed: string[] }
  | { kind: 'error'; message: string; heldSlots?: string[] };

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((item) => setB.has(item));
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

function SubscriptionMatrix({ tagTeamRobotIds = new Set() }: SubscriptionMatrixProps) {
  const { data, loading, error } = useStableOverview();
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [saving, setSaving] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<number, SaveOutcome>>({});

  /** The set currently shown for a robot: its draft if edited, else what is saved. */
  const effectiveSet = useCallback(
    (robot: StableOverviewRobot): string[] =>
      drafts[robot.robotId] ?? robot.subscriptions.map((s) => s.eventType),
    [drafts],
  );

  const robots = useMemo(() => data?.robots ?? [], [data?.robots]);

  const changedRobotIds = useMemo(
    () =>
      robots
        .filter((robot) => {
          const draft = drafts[robot.robotId];
          if (!draft) return false;
          return !sameSet(draft, robot.subscriptions.map((s) => s.eventType));
        })
        .map((r) => r.robotId),
    [robots, drafts],
  );

  const toggle = useCallback(
    (robot: StableOverviewRobot, eventType: string) => {
      setOutcomes((prev) => {
        if (!prev[robot.robotId]) return prev;
        const next = { ...prev };
        delete next[robot.robotId];
        return next;
      });

      setDrafts((prev) => {
        const current = prev[robot.robotId] ?? robot.subscriptions.map((s) => s.eventType);
        const next = current.includes(eventType)
          ? current.filter((e) => e !== eventType)
          : [...current, eventType];
        return { ...prev, [robot.robotId]: next };
      });
    },
    [],
  );

  const discard = useCallback(() => {
    setDrafts({});
    setOutcomes({});
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    const results: Record<number, SaveOutcome> = {};

    // Sequential on purpose: a handful of requests at a civilised pace, rather
    // than a burst that looks like abuse to the rate limiter.
    for (const robotId of changedRobotIds) {
      const desired = drafts[robotId];
      if (!desired) continue;
      try {
        const result = await saveRobotSubscriptions(robotId, desired);
        results[robotId] = { kind: 'saved', added: result.added, removed: result.removed };
      } catch (err) {
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_CAP_EXCEEDED') {
          const details = err.details as CapExceededDetails | undefined;
          results[robotId] = {
            kind: 'error',
            message: details
              ? `Needs ${details.currentCount} of ${details.cap} slots.`
              : err.message,
            heldSlots: details?.heldSlots,
          };
        } else {
          results[robotId] = {
            kind: 'error',
            message: err instanceof ApiError ? err.message : 'Could not save changes.',
          };
        }
      }
    }

    // Keep only the drafts that failed, so a partial save leaves the player with
    // exactly the robots that still need attention.
    setDrafts((prev) => {
      const remaining: DraftMap = {};
      for (const [key, value] of Object.entries(prev)) {
        const robotId = Number(key);
        if (results[robotId]?.kind === 'error') remaining[robotId] = value;
      }
      return remaining;
    });
    setOutcomes(results);
    setSaving(false);
  }, [changedRobotIds, drafts]);

  if (loading && !data) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-6">
        <div className="text-secondary text-sm">Loading subscription matrix...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-6">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (!data || robots.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-6">
        <p className="text-secondary text-sm">No robots in your stable yet.</p>
      </div>
    );
  }

  const { registeredEvents, nextSchedulingMoments } = data;
  const hasChanges = changedRobotIds.length > 0;

  return (
    // Bottom padding clears the sticky save bar, which itself sits above the
    // mobile bottom nav.
    <div className={`space-y-4 ${hasChanges ? 'pb-40 lg:pb-24' : 'pb-24 lg:pb-8'}`}>
      {error && (
        <div
          role="alert"
          className="bg-red-500/10 border-l-4 border-red-500 rounded-lg p-3 text-red-400 text-sm"
        >
          {error}
        </div>
      )}

      {/* How the rule works — stated once, in plain terms, visible on every screen size */}
      <div className="bg-surface rounded-lg border border-white/10 p-4 text-sm text-secondary space-y-1">
        <p className="text-primary font-medium">How subscriptions work</p>
        <p>
          Every event works the same way. Subscribe to enter, unsubscribe to leave — leaving is
          always allowed. A match that has already been booked still goes ahead, and keeps its slot
          until it has been fought.
        </p>
        <p>
          Changes take effect at the event&apos;s next scheduling moment, shown on each event below.
        </p>
      </div>

      {/* Per-event summary, including the next scheduling moment */}
      <div className="bg-surface rounded-lg border border-white/10 p-4">
        <div className="flex flex-wrap gap-x-4 gap-y-3">
          {registeredEvents.map((event) => {
            const subscribed = robots.filter((r) =>
              effectiveSet(r).includes(event.type),
            ).length;
            const countdown = formatCountdown(nextSchedulingMoments?.[event.type]);
            return (
              <div key={event.type} className="flex items-center gap-2">
                <EventBadge eventType={event.type} />
                <span className="text-xs text-secondary">
                  <span>{subscribed}/{robots.length}</span>
                  {countdown && <span className="ml-1 text-secondary/70">· books {countdown}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {robots.map((robot) => (
          <RobotCard
            key={robot.robotId}
            robot={robot}
            registeredEvents={registeredEvents}
            selected={effectiveSet(robot)}
            isDirty={changedRobotIds.includes(robot.robotId)}
            outcome={outcomes[robot.robotId]}
            isOnTagTeam={tagTeamRobotIds.has(robot.robotId)}
            onToggle={toggle}
          />
        ))}
      </div>

      {hasChanges && (
        <SaveBar
          changedCount={changedRobotIds.length}
          saving={saving}
          onSave={save}
          onDiscard={discard}
        />
      )}
    </div>
  );
}

// ── Sticky save bar ───────────────────────────────────────────────────

interface SaveBarProps {
  changedCount: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

function SaveBar({ changedCount, saving, onSave, onDiscard }: SaveBarProps) {
  return (
    // bottom-16 on mobile clears the bottom navigation; bottom-0 on desktop.
    <div
      role="region"
      aria-label="Unsaved subscription changes"
      className="fixed left-0 right-0 bottom-16 lg:bottom-0 z-40 border-t border-white/10 bg-surface/95 backdrop-blur px-4 py-3"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <p className="text-sm text-white font-medium">
          {changedCount} {changedCount === 1 ? 'robot' : 'robots'} changed
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="min-h-[44px] px-4 rounded-lg text-sm font-semibold bg-surface-elevated hover:bg-gray-600 text-white transition-colors disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="min-h-[44px] px-5 rounded-lg text-sm font-semibold bg-primary hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Robot Card ────────────────────────────────────────────────────────

interface RobotCardProps {
  robot: StableOverviewRobot;
  registeredEvents: { type: string; label: string }[];
  selected: string[];
  isDirty: boolean;
  outcome?: SaveOutcome;
  isOnTagTeam: boolean;
  onToggle: (robot: StableOverviewRobot, eventType: string) => void;
}

function RobotCard({
  robot,
  registeredEvents,
  selected,
  isDirty,
  outcome,
  isOnTagTeam,
  onToggle,
}: RobotCardProps) {
  // Held events occupy a slot whether or not they are still selected.
  const occupied = new Set([...selected, ...robot.heldSlots]);
  const atCap = occupied.size >= robot.cap;
  const savedSet = new Set(robot.subscriptions.map((s) => s.eventType));

  return (
    <div
      className={`bg-surface rounded-lg border p-4 space-y-3 ${
        isDirty ? 'border-primary/60' : 'border-white/10'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{robot.robotName}</span>
        <span className={`text-xs whitespace-nowrap ${atCap ? 'text-amber-400' : 'text-secondary'}`}>
          {occupied.size}/{robot.cap} slots
        </span>
      </div>

      {/* Summary line — the whole state of the robot at a glance, which is what
          makes the collapsed card readable on a phone. */}
      <p className="text-xs text-secondary">
        {selected.length === 0
          ? 'Not entered in any event'
          : registeredEvents
              .filter((e) => selected.includes(e.type))
              .map((e) => e.label)
              .join(', ')}
      </p>

      <div className="flex flex-wrap gap-2">
        {registeredEvents.map((event) => {
          const isSelected = selected.includes(event.type);
          const isHeld = robot.heldSlots.includes(event.type);
          const wasSaved = savedSet.has(event.type);
          // Blocked only when adding would exceed the cap. Removing is never blocked.
          const blocked = !isSelected && atCap;

          return (
            <ToggleButton
              key={event.type}
              event={event}
              isSelected={isSelected}
              isHeld={isHeld}
              isPending={isSelected !== wasSaved}
              blocked={blocked}
              showTagTeamWarning={event.type === 'tag_team' && isOnTagTeam && !isSelected}
              onToggle={() => onToggle(robot, event.type)}
            />
          );
        })}
      </div>

      {/* Lock and cap explanations inline — a touch device cannot hover a tooltip */}
      {robot.heldSlots.length > 0 && (
        <p className="text-xs text-amber-300/90">
          Slot held until the booked match has been fought:{' '}
          {robot.heldSlots
            .map((type) => registeredEvents.find((e) => e.type === type)?.label ?? type)
            .join(', ')}
          .
        </p>
      )}

      {atCap && (
        <p className="text-xs text-secondary">
          All slots in use. Remove an event or upgrade the Booking Office to enter more.
        </p>
      )}

      {outcome?.kind === 'saved' && (
        <p className="text-xs text-green-400" role="status">
          Saved
          {outcome.added.length > 0 && ` · entered ${outcome.added.length}`}
          {outcome.removed.length > 0 && ` · left ${outcome.removed.length}`}
        </p>
      )}

      {outcome?.kind === 'error' && (
        <p className="text-xs text-red-400" role="alert">
          {outcome.message}
          {outcome.heldSlots && outcome.heldSlots.length > 0 && (
            <>
              {' '}
              Held by a booked match:{' '}
              {outcome.heldSlots
                .map((type) => registeredEvents.find((e) => e.type === type)?.label ?? type)
                .join(', ')}
              .
            </>
          )}
        </p>
      )}
    </div>
  );
}

// ── Toggle Button ─────────────────────────────────────────────────────

interface ToggleButtonProps {
  event: { type: string; label: string };
  isSelected: boolean;
  isHeld: boolean;
  isPending: boolean;
  blocked: boolean;
  showTagTeamWarning: boolean;
  onToggle: () => void;
}

function ToggleButton({
  event,
  isSelected,
  isHeld,
  isPending,
  blocked,
  showTagTeamWarning,
  onToggle,
}: ToggleButtonProps) {
  const classes = (): string => {
    if (isSelected) {
      return isPending
        ? 'bg-primary/20 text-primary border border-primary/60'
        : 'bg-green-500/20 text-green-300 border border-transparent hover:bg-green-500/30';
    }
    if (blocked) {
      return 'bg-white/5 text-secondary/30 border border-white/5 cursor-not-allowed';
    }
    return isPending
      ? 'bg-white/10 text-secondary border border-primary/60 line-through'
      : 'bg-white/5 text-secondary border border-white/10 hover:bg-white/10';
  };

  const description = (): string => {
    if (isSelected) return `Leave ${event.label}`;
    if (blocked) return `${event.label} — no free slot`;
    return `Enter ${event.label}`;
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={blocked}
      aria-pressed={isSelected}
      aria-label={description()}
      className={`inline-flex items-center gap-1.5 px-3 rounded-full text-xs font-medium transition-colors min-h-[44px] ${classes()}`}
    >
      {isSelected && !isPending && (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
        </svg>
      )}
      <EventBadge eventType={event.type} />
      {isHeld && (
        <span className="text-amber-400 text-[10px] uppercase tracking-wide">held</span>
      )}
      {isPending && (
        <span className="text-primary text-[10px] uppercase tracking-wide">unsaved</span>
      )}
      {showTagTeamWarning && (
        <span className="text-amber-400" aria-label="On a Tag Team but not entered in Tag Team events">
          {'\u26A0\uFE0F'}
        </span>
      )}
    </button>
  );
}

export default SubscriptionMatrix;
