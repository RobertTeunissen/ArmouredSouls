/**
 * TagTeamSubscriptionWarning Component
 *
 * Displays a warning when a robot on a TagTeam is not subscribed to the
 * 'tag_team' event. The matchmaker excludes teams where either robot lacks
 * the subscription, but there's no visible indicator — this component fills
 * that gap.
 *
 * Supports two usage modes:
 * 1. Single-robot mode (SubscriptionManager): shows warning for one robot
 * 2. Team-pair mode (TagTeamManagementPage / BookingOfficePage): shows warning for a team
 *
 * Requirements: R9.12
 */

// ── Single-robot mode props ──────────────────────────────────────────

interface SingleRobotProps {
  /** The robot ID (used for context, not displayed) */
  robotId: number;
  /** Whether this robot is subscribed to tag_team events */
  isSubscribedToTagTeam: boolean;
  /** Whether this robot is on a tag team */
  isOnTagTeam: boolean;
  /** Not used in single-robot mode */
  tagTeam?: never;
  subscriptions?: never;
  compact?: never;
}

// ── Team-pair mode props ─────────────────────────────────────────────

interface TagTeamInfo {
  activeRobotId: number;
  reserveRobotId: number;
  activeRobotName: string;
  reserveRobotName: string;
}

interface TeamPairProps {
  /** The tag team to check */
  tagTeam: TagTeamInfo;
  /** Map of robot ID → subscribed event types */
  subscriptions: Map<number, string[]>;
  /** Compact mode for dashboard display */
  compact?: boolean;
  /** Not used in team-pair mode */
  robotId?: never;
  isSubscribedToTagTeam?: never;
  isOnTagTeam?: never;
}

type TagTeamSubscriptionWarningProps = SingleRobotProps | TeamPairProps;

function TagTeamSubscriptionWarning(props: TagTeamSubscriptionWarningProps) {
  // ── Single-robot mode ──────────────────────────────────────────────
  if ('robotId' in props && props.robotId !== undefined) {
    const { isSubscribedToTagTeam, isOnTagTeam } = props;

    // No warning needed if not on a tag team or already subscribed
    if (!isOnTagTeam || isSubscribedToTagTeam) {
      return null;
    }

    return (
      <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <span className="text-amber-400 flex-shrink-0">⚠️</span>
          <div className="text-sm text-amber-200">
            This robot is on a Tag Team but not subscribed to Tag Team events.
            The team will not be matched until this robot is subscribed.
          </div>
        </div>
      </div>
    );
  }

  // ── Team-pair mode ─────────────────────────────────────────────────
  const { tagTeam, subscriptions, compact = false } = props;

  const activeEvents = subscriptions.get(tagTeam.activeRobotId) ?? [];
  const reserveEvents = subscriptions.get(tagTeam.reserveRobotId) ?? [];

  const activeSubscribed = activeEvents.includes('tag_team');
  const reserveSubscribed = reserveEvents.includes('tag_team');

  // Both subscribed — no warning needed
  if (activeSubscribed && reserveSubscribed) {
    return null;
  }

  // Build list of unsubscribed robots
  const unsubscribedRobots: string[] = [];
  if (!activeSubscribed) unsubscribedRobots.push(tagTeam.activeRobotName);
  if (!reserveSubscribed) unsubscribedRobots.push(tagTeam.reserveRobotName);

  if (compact) {
    return (
      <div className="bg-amber-900/20 border-l-4 border-amber-500 rounded-r-lg px-3 py-2 text-sm">
        <span className="text-amber-300">
          ⚠️ {unsubscribedRobots.join(' and ')} not subscribed to Tag Team events.
          This team will not be matched.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <span className="text-amber-400 flex-shrink-0">⚠️</span>
        <div className="text-sm text-amber-200">
          <span className="font-semibold">{unsubscribedRobots.join(' and ')}</span>{' '}
          {unsubscribedRobots.length === 1 ? 'is' : 'are'} not subscribed to Tag Team events.
          This team will not be matched until both robots are subscribed.
        </div>
      </div>
    </div>
  );
}

export default TagTeamSubscriptionWarning;
