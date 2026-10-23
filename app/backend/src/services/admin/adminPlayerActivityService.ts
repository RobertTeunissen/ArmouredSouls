/**
 * Human-player activity counts for the admin dashboard.
 *
 * Activity is login-based: `users.last_login_at` is written at password login,
 * and JWTs expire after 24 h with no refresh, so it is at most a day stale.
 * Generated bots and Automatons never log in, so these counts are always over
 * human stables (`buildUserFilter('real')`), whatever the dashboard filter is.
 */
import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { buildUserFilter } from '../../utils/buildUserFilter';
import { INACTIVE_PLAYER_AFTER_MS, PLAYER_ACTIVITY_WINDOW_MS } from './adminThresholds';

export interface HumanPlayerActivityCounts {
  /** Every human stable. */
  total: number;
  /** Logged in within the last 7 days. */
  active7d: number;
  /** Registered within the last 7 days. */
  new7d: number;
  /** Registered in the 7 days before that: `[now − 14d, now − 7d)`. */
  newPrevious7d: number;
  /** Last login (or registration, if never logged in) more than 3 days ago. */
  inactive3d: number;
}

/** The where clauses of each count, exported so tests can pin the window edges. */
export function buildHumanActivityWhere(now: Date): Record<keyof HumanPlayerActivityCounts, Prisma.UserWhereInput> {
  const human = buildUserFilter('real');
  const windowStart = new Date(now.getTime() - PLAYER_ACTIVITY_WINDOW_MS);
  const previousWindowStart = new Date(now.getTime() - 2 * PLAYER_ACTIVITY_WINDOW_MS);
  const inactiveBefore = new Date(now.getTime() - INACTIVE_PLAYER_AFTER_MS);

  return {
    total: human,
    active7d: { AND: [human, { lastLoginAt: { gte: windowStart } }] },
    new7d: { AND: [human, { createdAt: { gte: windowStart } }] },
    newPrevious7d: { AND: [human, { createdAt: { gte: previousWindowStart, lt: windowStart } }] },
    inactive3d: {
      AND: [
        human,
        {
          OR: [
            { lastLoginAt: { lt: inactiveBefore } },
            { lastLoginAt: null, createdAt: { lt: inactiveBefore } },
          ],
        },
      ],
    },
  };
}

/** Count human stables by activity. Five indexed counts, run in parallel. */
export async function countHumanPlayerActivity(now: Date = new Date()): Promise<HumanPlayerActivityCounts> {
  const where = buildHumanActivityWhere(now);
  const [total, active7d, new7d, newPrevious7d, inactive3d] = await Promise.all([
    prisma.user.count({ where: where.total }),
    prisma.user.count({ where: where.active7d }),
    prisma.user.count({ where: where.new7d }),
    prisma.user.count({ where: where.newPrevious7d }),
    prisma.user.count({ where: where.inactive3d }),
  ]);
  return { total, active7d, new7d, newPrevious7d, inactive3d };
}
