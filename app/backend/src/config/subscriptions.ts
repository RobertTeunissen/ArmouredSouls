/**
 * Booking Office slot cap curve.
 * Index = Booking Office facility level (0..10).
 * Value = maximum concurrent subscriptions per robot.
 */
export const BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT: readonly number[] = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
] as const;

/**
 * Get the subscription cap for a robot given its owning Stable's Booking Office level.
 * Treats missing facility as level 0.
 */
export function getSubscriptionCap(bookingOfficeLevel: number): number {
  const clampedLevel = Math.max(0, Math.min(10, bookingOfficeLevel));
  return BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[clampedLevel];
}
