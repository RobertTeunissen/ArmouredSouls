/**
 * BookingOfficePage — Booking Office overview page.
 *
 * Shows the Stable's Booking Office level, a brief explanation of the
 * Event Subscription System, and the SubscriptionMatrix for managing
 * all robots' subscriptions in one place.
 *
 * Requirements: R9.10, R9.11
 */

import Navigation from '../components/Navigation';
import SubscriptionMatrix from '../components/subscriptions/SubscriptionMatrix';
import TagTeamSubscriptionWarning from '../components/subscriptions/TagTeamSubscriptionWarning';
import { useStableOverview } from '../hooks/useSubscriptions';
import { useEffect, useState } from 'react';
import { getMyTagTeams, TagTeam } from '../utils/tagTeamApi';

function BookingOfficePage() {
  const { data } = useStableOverview();
  const bookingOfficeLevel = data?.bookingOfficeLevel ?? 0;
  const [tagTeams, setTagTeams] = useState<TagTeam[]>([]);

  useEffect(() => {
    getMyTagTeams()
      .then(setTagTeams)
      .catch(() => setTagTeams([]));
  }, []);

  // Build subscription map from stable overview
  const subscriptionMap = new Map<number, string[]>();
  if (data) {
    for (const robot of data.robots) {
      subscriptionMap.set(robot.robotId, robot.subscriptions.map(s => s.eventType));
    }
  }

  // Find tag teams with subscription mismatches
  const mismatchedTeams = tagTeams.filter((team) => {
    const activeEvents = subscriptionMap.get(team.activeRobotId) ?? [];
    const reserveEvents = subscriptionMap.get(team.reserveRobotId) ?? [];
    return !activeEvents.includes('tag_team') || !reserveEvents.includes('tag_team');
  });

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        {/* Page Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-2">Booking Office</h2>
          <p className="text-secondary text-sm max-w-2xl">
            The Event Subscription System controls which battle events each of your robots
            participates in. Each robot can hold up to{' '}
            <span className="text-primary font-medium">{3 + bookingOfficeLevel}</span>{' '}
            concurrent subscriptions at your current Booking Office level ({bookingOfficeLevel}).
            Upgrade the facility to unlock more slots per robot.
          </p>
        </div>

        {/* Level Indicator */}
        <div className="bg-surface rounded-lg border border-white/10 p-4 mb-6 flex items-center gap-4">
          <span className="text-3xl" aria-hidden="true">🏆</span>
          <div>
            <div className="text-sm text-secondary">Booking Office Level</div>
            <div className="text-xl font-bold">{bookingOfficeLevel} / 10</div>
          </div>
          <div className="flex-1" />
          <div className="text-sm text-secondary">
            {bookingOfficeLevel < 10
              ? `Next level: ${4 + bookingOfficeLevel} subscriptions per robot`
              : 'Maximum level reached'}
          </div>
        </div>

        {/* Tag Team Subscription Warnings */}
        {mismatchedTeams.length > 0 && (
          <div className="space-y-2 mb-6">
            {mismatchedTeams.map((team) => (
              <TagTeamSubscriptionWarning
                key={team.id}
                tagTeam={{
                  activeRobotId: team.activeRobotId,
                  reserveRobotId: team.reserveRobotId,
                  activeRobotName: team.activeRobot.name,
                  reserveRobotName: team.reserveRobot.name,
                }}
                subscriptions={subscriptionMap}
              />
            ))}
          </div>
        )}

        {/* Subscription Matrix */}
        <SubscriptionMatrix />
      </div>
    </div>
  );
}

export default BookingOfficePage;
