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
import BookingOfficeUpgradePanel from '../components/subscriptions/BookingOfficeUpgradePanel';
import { useStableOverview } from '../hooks/useSubscriptions';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useCallback, useState } from 'react';

function BookingOfficePage() {
  const { data, refetch } = useStableOverview();
  const invalidateOverview = useSubscriptionStore((s) => s.invalidate);
  const bookingOfficeLevel = data?.bookingOfficeLevel ?? 0;
  // Bumped after an upgrade to force the SubscriptionMatrix to remount and
  // re-read the new per-robot cap (Spec #46 R6.15)
  const [matrixKey, setMatrixKey] = useState(0);

  const handleUpgraded = useCallback(() => {
    // The overview is cached with a short TTL, so a remount alone would show the
    // old cap. Drop the cache first, then refetch.
    invalidateOverview();
    refetch();
    setMatrixKey((k) => k + 1);
  }, [invalidateOverview, refetch]);

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

        {/* Upgrade control + implication panel (Spec #46 R6) */}
        <BookingOfficeUpgradePanel onUpgraded={handleUpgraded} />

        {/* Free slots alert */}
        {data && data.robots.length > 0 && (() => {
          const robotsWithFreeSlots = data.robots.filter(
            (r) => r.subscriptions.length < r.cap
          );
          if (robotsWithFreeSlots.length === 0) return null;
          const totalFree = robotsWithFreeSlots.reduce(
            (sum, r) => sum + (r.cap - r.subscriptions.length), 0
          );
          return (
            <div className="bg-primary/10 border-l-4 border-primary rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-primary text-lg">💡</span>
                <span className="text-primary font-semibold text-sm">
                  {totalFree} free subscription slot{totalFree !== 1 ? 's' : ''} available across {robotsWithFreeSlots.length} robot{robotsWithFreeSlots.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Subscription Matrix */}
        <SubscriptionMatrix key={matrixKey} />
      </div>
    </div>
  );
}

export default BookingOfficePage;
