/**
 * TagTeamSubscriptionDashboardWarning Component
 *
 * Dashboard-level warning that checks if any TagTeam has robots missing
 * the 'tag_team' event subscription. Follows the same pattern as
 * TagTeamReadinessWarning for consistent dashboard UX.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyTagTeams, TagTeam } from '../utils/tagTeamApi';
import { useStableOverview } from '../hooks/useSubscriptions';

function TagTeamSubscriptionDashboardWarning() {
  const navigate = useNavigate();
  const { data: stableOverview } = useStableOverview();
  const [tagTeams, setTagTeams] = useState<TagTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    getMyTagTeams()
      .then(setTagTeams)
      .catch(() => setTagTeams([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stableOverview || tagTeams.length === 0) {
    return null;
  }

  // Build subscription map
  const subscriptionMap = new Map<number, string[]>();
  for (const robot of stableOverview.robots) {
    subscriptionMap.set(robot.robotId, robot.subscriptions.map(s => s.eventType));
  }

  // Find teams with subscription mismatches
  const mismatchedTeams = tagTeams.filter((team) => {
    const activeEvents = subscriptionMap.get(team.activeRobotId) ?? [];
    const reserveEvents = subscriptionMap.get(team.reserveRobotId) ?? [];
    return !activeEvents.includes('tag_team') || !reserveEvents.includes('tag_team');
  });

  if (mismatchedTeams.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-amber-900/10 border-l-4 border-amber-500 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-amber-900/15 transition-colors"
      onClick={() => navigate('/booking-office')}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚠️</span>
        <span className="text-amber-300 font-semibold">
          {mismatchedTeams.length} tag team{mismatchedTeams.length > 1 ? 's' : ''} missing Tag Team subscription
        </span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigate('/booking-office');
        }}
        className="bg-amber-500 hover:bg-amber-500/90 text-gray-900 font-semibold py-2 px-4 rounded text-sm transition-colors"
      >
        Booking Office
      </button>
    </div>
  );
}

export default TagTeamSubscriptionDashboardWarning;
