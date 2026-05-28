/**
 * SubscriptionMatrix Component
 *
 * Stable-level matrix showing all robots × all registered events.
 * Uses a card-per-robot layout on all screen sizes to handle any number of events
 * without horizontal scrolling.
 * Desktop (≥1024px): 2 cards per row.
 * Mobile (<1024px): 1 card per row.
 *
 * Two-state model:
 * - "active" (green) — matchmaker will schedule matches
 * - "pending" (amber) — waiting for slot to open
 *
 * Requirements: R9.10, R9.11, R9.12
 */

import { useState } from 'react';
import {
  useStableOverview,
  useRobotSubscriptions,
} from '../../hooks/useSubscriptions';
import EventBadge from './EventBadge';

interface SubscriptionMatrixProps {
  /** Optional lock state map: robotId → eventType → { isLocked, scheduledCycle? } — only tournament uses locks */
  lockStates?: Record<number, Record<string, { isLocked: boolean; scheduledCycle?: number }>>;
  /** Optional: robots that are on a tag team (for tag_team subscription warnings) */
  tagTeamRobotIds?: Set<number>;
}

function SubscriptionMatrix({ lockStates = {}, tagTeamRobotIds = new Set() }: SubscriptionMatrixProps) {
  const { data, loading, error, refetch } = useStableOverview();

  if (loading) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-6">
        <div className="text-secondary text-sm">Loading subscription matrix...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-6">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (!data || data.robots.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-6">
        <p className="text-secondary text-sm">No robots in your stable yet.</p>
      </div>
    );
  }

  const { robots, registeredEvents } = data;

  return (
    <div className="space-y-4">
      {/* Per-event summary bar */}
      <div className="bg-surface rounded-lg border border-white/10 p-4">
        <div className="flex flex-wrap gap-4">
          {registeredEvents.map((event) => {
            const activeCount = robots.filter((r) =>
              r.subscriptions.some(s => s.eventType === event.type && s.status === 'active')
            ).length;
            const totalSubscribed = robots.filter((r) =>
              r.subscriptions.some(s => s.eventType === event.type)
            ).length;
            return (
              <div key={event.type} className="flex items-center gap-2">
                <EventBadge eventType={event.type} />
                <span className="text-xs text-secondary">
                  {activeCount}/{robots.length}
                  {totalSubscribed > activeCount && (
                    <span className="text-amber-400 ml-1">(+{totalSubscribed - activeCount} pending)</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card grid */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {robots.map((robot) => (
          <RobotCard
            key={robot.robotId}
            robot={robot}
            registeredEvents={registeredEvents}
            lockStates={lockStates[robot.robotId] ?? {}}
            isOnTagTeam={tagTeamRobotIds.has(robot.robotId)}
            onRefetch={refetch}
          />
        ))}
      </div>
    </div>
  );
}

// ── Robot Card ────────────────────────────────────────────────────────

interface RobotCardProps {
  robot: { robotId: number; robotName: string; subscriptions: { eventType: string; status: string }[]; cap: number };
  registeredEvents: { type: string; label: string }[];
  lockStates: Record<string, { isLocked: boolean; scheduledCycle?: number }>;
  isOnTagTeam: boolean;
  onRefetch: () => Promise<void>;
}

function RobotCard({ robot, registeredEvents, lockStates, isOnTagTeam, onRefetch }: RobotCardProps) {
  const currentCount = robot.subscriptions.length;
  const atCap = currentCount >= robot.cap;

  return (
    <div className="bg-surface rounded-lg border border-white/10 p-4 space-y-3">
      {/* Robot header */}
      <div className="flex items-center justify-between">
        <span className="font-medium">{robot.robotName}</span>
        <span className={`text-xs ${atCap ? 'text-amber-400' : 'text-secondary'}`}>
          {currentCount}/{robot.cap} subscriptions
        </span>
      </div>

      {/* Event toggles as flex-wrap grid */}
      <div className="flex flex-wrap gap-2">
        {registeredEvents.map((event) => {
          const sub = robot.subscriptions.find(s => s.eventType === event.type);
          const isSubscribed = !!sub;
          const status = sub?.status as 'active' | 'pending' | undefined;
          // Only tournament has locks
          const isLocked = event.type === 'tournament' && (lockStates[event.type]?.isLocked ?? false);
          const showTagTeamWarning =
            event.type === 'tag_team' && isOnTagTeam && !isSubscribed;

          return (
            <ToggleButton
              key={event.type}
              robotId={robot.robotId}
              event={event}
              isSubscribed={isSubscribed}
              subscriptionStatus={status}
              isLocked={isLocked}
              atCap={atCap}
              showTagTeamWarning={showTagTeamWarning}
              onRefetch={onRefetch}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Toggle Button (shared for all screen sizes) ──────────────────────

interface ToggleButtonProps {
  robotId: number;
  event: { type: string; label: string };
  isSubscribed: boolean;
  subscriptionStatus?: 'active' | 'pending';
  isLocked: boolean;
  atCap: boolean;
  showTagTeamWarning: boolean;
  onRefetch: () => Promise<void>;
}

function ToggleButton({
  robotId,
  event,
  isSubscribed,
  subscriptionStatus,
  isLocked,
  atCap,
  showTagTeamWarning,
  onRefetch,
}: ToggleButtonProps) {
  const { subscribe, unsubscribe, mutating } = useRobotSubscriptions(robotId);
  const [cellMutating, setCellMutating] = useState(false);

  const canToggle = isSubscribed
    ? !isLocked && !mutating && !cellMutating
    : !atCap && !mutating && !cellMutating;

  const handleToggle = async () => {
    if (!canToggle) return;
    setCellMutating(true);
    try {
      if (isSubscribed) {
        await unsubscribe(event.type);
      } else {
        await subscribe(event.type);
      }
      await onRefetch();
    } catch {
      // Error handled by hook
    } finally {
      setCellMutating(false);
    }
  };

  // Determine button styling based on subscription status
  const getButtonClasses = (): string => {
    if (!isSubscribed) {
      return canToggle
        ? 'bg-white/5 text-secondary border border-white/10 hover:bg-white/10'
        : 'bg-white/5 text-secondary/30 border border-white/5 cursor-not-allowed';
    }
    if (isLocked) {
      return 'bg-amber-500/20 text-amber-300 cursor-not-allowed';
    }
    if (subscriptionStatus === 'pending') {
      return 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30';
    }
    return 'bg-green-500/20 text-green-300 hover:bg-green-500/30';
  };

  const getTitle = (): string => {
    if (isLocked) return 'Locked — alive in tournament bracket';
    if (!isSubscribed) return atCap ? 'Cap reached' : 'Click to subscribe';
    if (subscriptionStatus === 'pending') return 'Pending — will activate when a slot opens. Click to unsubscribe.';
    return 'Active — click to unsubscribe';
  };

  return (
    <button
      onClick={handleToggle}
      disabled={!canToggle}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
        transition-colors min-h-[44px]
        ${getButtonClasses()}
      `}
      aria-label={
        isSubscribed
          ? isLocked
            ? `${event.label} locked`
            : `Unsubscribe from ${event.label}`
          : `Subscribe to ${event.label}`
      }
      title={getTitle()}
    >
      {cellMutating ? (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {isSubscribed && subscriptionStatus === 'active' && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
          )}
          {isSubscribed && subscriptionStatus === 'pending' && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
            </svg>
          )}
          <EventBadge eventType={event.type} />
          {isLocked && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-amber-400">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
            </svg>
          )}
          {showTagTeamWarning && (
            <span className="text-amber-400" title="On a Tag Team but not subscribed to Tag Team events">{'\u26A0\uFE0F'}</span>
          )}
        </>
      )}
    </button>
  );
}

export default SubscriptionMatrix;
