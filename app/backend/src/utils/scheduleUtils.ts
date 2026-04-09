/**
 * Compute the next occurrence of a daily cron schedule (e.g. "0 8 * * *").
 * Supports standard "minute hour * * *" patterns used by the cycle scheduler.
 * All times are in UTC.
 */
export function getNextCronOccurrence(cronExpression: string): Date {
  const parts = cronExpression.trim().split(/\s+/);
  const minute = parseInt(parts[0], 10);
  const hour = parseInt(parts[1], 10);

  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
    0,
    0,
  ));

  // If the time has already passed today, move to tomorrow
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}
