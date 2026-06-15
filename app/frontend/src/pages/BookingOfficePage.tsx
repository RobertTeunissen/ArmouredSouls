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
import { useStableOverview } from '../hooks/useSubscriptions';
import { useEffect, useState } from 'react';
import { getMyTeamBattles, TeamBattle } from '../utils/teamBattleApi';

function BookingOfficePage() {
  const { data } = useStableOverview();
  const bookingOfficeLevel = data?.bookingOfficeLevel ?? 0;
  const [teams2v2, setTeams2v2] = useState<TeamBattle[]>([]);

  useEffect(() => {
    getMyTeamBattles(2)
      .then(setTeams2v2)
      .catch(() => setTeams2v2([]));
  }, []);

  // Build subscription map from stable overview
  const subscriptionMap = new Map<number, string[]>();
  if (data) {
    for (const robot of data.robots) {
      subscriptionMap.set(robot.robotId, robot.subscriptions.map(s => s.eventType));
    }
  }

  // Find 2v2 teams with tag_team subscription mismatches
  const mismatchedTeams = teams2v2.filter((team) => {
    return team.members.some(member => {
      const events = subscriptionMap.get(member.robotId) ?? [];
      return !events.includes('tag_team');
    });
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
            {mismatchedTeams.map((team) => {
              const unsubscribedMembers = team.members.filter(m => {
                const events = subscriptionMap.get(m.robotId) ?? [];
                return !events.includes('tag_team');
              });
              return (
                <div
                  key={team.id}
                  className="bg-warning/10 border-l-4 border-warning rounded-lg p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-warning text-lg">⚠️</span>
                    <span className="text-warning font-semibold text-sm">
                      {team.teamName}: {unsubscribedMembers.map(m => m.robot.name).join(', ')} not subscribed to Tag Team
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Subscription Matrix */}
        <SubscriptionMatrix />
      </div>
    </div>
  );
}

export default BookingOfficePage;
