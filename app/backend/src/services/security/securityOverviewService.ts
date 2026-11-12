/**
 * Admin Security page (`GET /api/admin/security/overview`) and the dashboard's
 * security attention item.
 *
 * Reads `security_events` (failed logins, rate-limit hits, ownership
 * violations, race-condition and robot-creation bursts, malformed requests
 * without a logged-in user) and the audit log's NSFW rejections. A signal
 * either fired in the window or it did not; there are no severity levels.
 *
 * @module services/security/securityOverviewService
 */

import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import type { SecuritySignal } from '../../types';
import type {
  SecurityOverview,
  SecurityWindow,
  SignalCard,
  SignalSourceRow,
  SignalStableRow,
} from '../../shared/types';

export const SECURITY_WINDOWS = ['24h', '7d', '30d'] as const satisfies readonly SecurityWindow[];
/** Kept by the nightly retention job. */
export const SECURITY_EVENT_RETENTION_DAYS = 90;
/** A failed-login burst: this many failures from one IP within BURST_WINDOW_MS (the login limiter's window). */
export const FAILED_LOGIN_BURST_COUNT = 5;
export const FAILED_LOGIN_BURST_WINDOW_MS = 15 * 60 * 1000;
/** Rows per table on the page. */
const TABLE_LIMIT = 50;
/** Failed logins read for burst detection; far above anything seen on ACC. */
const BURST_SCAN_LIMIT = 20_000;

/** The six signal cards, in page order. `nsfw_block` comes from the audit log. */
export const SIGNAL_CARDS = ['failed_login', 'rate_limit', 'ownership_violation', 'race_condition_burst', 'robot_creation_burst', 'nsfw_block'] as const satisfies readonly SignalCard[];
export interface SecurityAttention {
  /** Signals of any kind in the last 24 hours. */
  signals: number;
  /** Failed-login bursts, ownership violations, race-condition and robot-creation bursts in the last 24 hours. */
  alerts: number;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function windowSpec(window: SecurityWindow, now: Date): { bucket: 'hour' | 'day'; buckets: Date[]; since: Date } {
  if (window === '24h') {
    const end = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
    const buckets = Array.from({ length: 24 }, (_, i) => new Date(end.getTime() - (23 - i) * HOUR_MS));
    return { bucket: 'hour', buckets, since: new Date(now.getTime() - 24 * HOUR_MS) };
  }
  const days = window === '7d' ? 7 : 30;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const buckets = Array.from({ length: days }, (_, i) => new Date(today.getTime() - (days - 1 - i) * DAY_MS));
  return { bucket: 'day', buckets, since: buckets[0] };
}

/** Index of the bucket a timestamp falls in, or -1. */
function bucketIndex(at: Date, buckets: Date[], bucket: 'hour' | 'day'): number {
  const size = bucket === 'hour' ? HOUR_MS : DAY_MS;
  const index = Math.floor((at.getTime() - buckets[0].getTime()) / size);
  return index >= 0 && index < buckets.length ? index : -1;
}

/**
 * Largest number of timestamps inside any `windowMs` span (sorted ascending),
 * with the time the span ended.
 */
export function largestBurst(sorted: Date[], windowMs: number): { count: number; at: Date } | null {
  let best: { count: number; at: Date } | null = null;
  let start = 0;
  for (let end = 0; end < sorted.length; end++) {
    while (sorted[end].getTime() - sorted[start].getTime() > windowMs) start++;
    const count = end - start + 1;
    if (!best || count > best.count) best = { count, at: sorted[end] };
  }
  return best;
}

interface CountRow { signal: string; bucket: Date; n: bigint }

async function countByBucket(since: Date, bucket: 'hour' | 'day'): Promise<CountRow[]> {
  const unit = bucket === 'hour' ? Prisma.sql`'hour'` : Prisma.sql`'day'`;
  return prisma.$queryRaw<CountRow[]>`
    SELECT signal, date_trunc(${unit}, occurred_at) AS bucket, COUNT(*)::bigint AS n
    FROM security_events
    WHERE occurred_at >= ${since}
    GROUP BY signal, bucket`;
}

async function nsfwByBucket(since: Date, bucket: 'hour' | 'day'): Promise<CountRow[]> {
  const unit = bucket === 'hour' ? Prisma.sql`'hour'` : Prisma.sql`'day'`;
  return prisma.$queryRaw<CountRow[]>`
    SELECT 'nsfw_block' AS signal, date_trunc(${unit}, event_timestamp) AS bucket, COUNT(*)::bigint AS n
    FROM audit_logs
    WHERE event_type = 'image_moderation_rejection' AND event_timestamp >= ${since}
    GROUP BY bucket`;
}

async function lastSeenBySignal(): Promise<Map<string, Date>> {
  const [signals, nsfw] = await Promise.all([
    prisma.securityEvent.groupBy({ by: ['signal'], _max: { occurredAt: true } }),
    prisma.auditLog.aggregate({ where: { eventType: 'image_moderation_rejection' }, _max: { eventTimestamp: true } }),
  ]);
  const map = new Map<string, Date>();
  for (const row of signals) if (row._max.occurredAt) map.set(row.signal, row._max.occurredAt);
  if (nsfw._max.eventTimestamp) map.set('nsfw_block', nsfw._max.eventTimestamp);
  return map;
}

async function stableRows(since: Date): Promise<SignalStableRow[]> {
  const grouped = await prisma.securityEvent.groupBy({
    by: ['userId', 'signal'],
    where: { occurredAt: { gte: since }, userId: { not: null } },
    _count: { _all: true },
    _max: { occurredAt: true },
  });
  const byUser = new Map<number, { counts: Partial<Record<SecuritySignal, number>>; total: number; last: Date }>();
  for (const row of grouped) {
    if (row.userId === null || !row._max.occurredAt) continue;
    const entry = byUser.get(row.userId) ?? { counts: {}, total: 0, last: row._max.occurredAt };
    entry.counts[row.signal as SecuritySignal] = row._count._all;
    entry.total += row._count._all;
    if (row._max.occurredAt > entry.last) entry.last = row._max.occurredAt;
    byUser.set(row.userId, entry);
  }
  const top = [...byUser.entries()]
    .sort((a, b) => b[1].last.getTime() - a[1].last.getTime() || b[1].total - a[1].total)
    .slice(0, TABLE_LIMIT);
  const users = await prisma.user.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, username: true, stableName: true, stableType: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return top.map(([userId, entry]) => {
    const user = userMap.get(userId);
    return {
      userId,
      stableName: user?.stableName ?? null,
      username: user?.username ?? null,
      stableType: user?.stableType ?? null,
      counts: entry.counts,
      lastSeenAt: entry.last.toISOString(),
    };
  });
}

async function sourceRows(since: Date): Promise<SignalSourceRow[]> {
  const events = await prisma.securityEvent.findMany({
    where: {
      occurredAt: { gte: since },
      sourceIp: { not: null },
      OR: [
        { signal: 'failed_login' },
        { signal: 'malformed_request' },
        { signal: 'rate_limit', userId: null },
      ],
    },
    select: { signal: true, userId: true, sourceIp: true, endpoint: true, occurredAt: true },
    orderBy: { occurredAt: 'asc' },
    take: BURST_SCAN_LIMIT,
  });
  interface Acc { failed: Date[]; accounts: Set<number>; malformed: number; rate: number; endpoints: Set<string>; last: Date }
  const byIp = new Map<string, Acc>();
  for (const event of events) {
    if (!event.sourceIp) continue;
    const acc = byIp.get(event.sourceIp) ?? { failed: [], accounts: new Set<number>(), malformed: 0, rate: 0, endpoints: new Set<string>(), last: event.occurredAt };
    if (event.signal === 'failed_login') {
      acc.failed.push(event.occurredAt);
      if (event.userId !== null) acc.accounts.add(event.userId);
    } else if (event.signal === 'malformed_request') {
      acc.malformed++;
    } else {
      acc.rate++;
    }
    if (event.endpoint) acc.endpoints.add(event.endpoint);
    acc.last = event.occurredAt;
    byIp.set(event.sourceIp, acc);
  }
  return [...byIp.entries()]
    .map(([sourceIp, acc]): SignalSourceRow => {
      const burst = largestBurst(acc.failed, FAILED_LOGIN_BURST_WINDOW_MS);
      return {
        sourceIp,
        failedLogins: acc.failed.length,
        accountsTried: acc.accounts.size,
        malformedRequests: acc.malformed,
        rateLimitHits: acc.rate,
        endpoints: [...acc.endpoints].sort(),
        lastSeenAt: acc.last.toISOString(),
        burst: burst && burst.count >= FAILED_LOGIN_BURST_COUNT ? { count: burst.count, at: burst.at.toISOString() } : null,
      };
    })
    .sort((a, b) => b.failedLogins - a.failedLogins || b.malformedRequests + b.rateLimitHits - (a.malformedRequests + a.rateLimitHits) || b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, TABLE_LIMIT);
}

/** Everything the admin Security page shows for one window. */
export async function getSecurityOverview(window: SecurityWindow, now: Date = new Date()): Promise<SecurityOverview> {
  const { bucket, buckets, since } = windowSpec(window, now);
  const [counts, nsfw, lastSeen, stables, sources, oldest] = await Promise.all([
    countByBucket(since, bucket),
    nsfwByBucket(since, bucket),
    lastSeenBySignal(),
    stableRows(since),
    sourceRows(since),
    prisma.securityEvent.aggregate({ _min: { occurredAt: true } }),
  ]);

  const perSignal = new Map<string, number[]>(SIGNAL_CARDS.map((s) => [s, buckets.map(() => 0)]));
  for (const row of [...counts, ...nsfw]) {
    const series = perSignal.get(row.signal);
    const index = bucketIndex(new Date(row.bucket), buckets, bucket);
    if (series && index >= 0) series[index] += Number(row.n);
  }

  return {
    window,
    generatedAt: now.toISOString(),
    bucket,
    buckets: buckets.map((b) => b.toISOString()),
    signals: SIGNAL_CARDS.map((signal) => {
      const perBucket = perSignal.get(signal) ?? [];
      return {
        signal,
        total: perBucket.reduce((sum, n) => sum + n, 0),
        perBucket,
        lastSeenAt: lastSeen.get(signal)?.toISOString() ?? null,
      };
    }),
    stables,
    sources,
    recordingSince: oldest._min.occurredAt?.toISOString() ?? null,
    thresholds: {
      retentionDays: SECURITY_EVENT_RETENTION_DAYS,
      burstCount: FAILED_LOGIN_BURST_COUNT,
      burstWindowMinutes: FAILED_LOGIN_BURST_WINDOW_MS / 60_000,
    },
  };
}

/**
 * The dashboard's security item: signals in the last 24 hours, and how many of
 * them are worth a look (bursts and violations, not a single mistyped password).
 */
export async function getSecurityAttention(now: Date = new Date()): Promise<SecurityAttention> {
  const since = new Date(now.getTime() - 24 * HOUR_MS);
  const [grouped, sources] = await Promise.all([
    prisma.securityEvent.groupBy({ by: ['signal'], where: { occurredAt: { gte: since } }, _count: { _all: true } }),
    sourceRows(since),
  ]);
  const count = (signal: SecuritySignal): number => grouped.find((g) => g.signal === signal)?._count._all ?? 0;
  const signals = grouped.reduce((sum, g) => sum + g._count._all, 0);
  const bursts = sources.filter((s) => s.burst !== null).length;
  return {
    signals,
    alerts: bursts + count('ownership_violation') + count('race_condition_burst') + count('robot_creation_burst'),
  };
}

/** Delete signals older than the retention window. Returns the rows deleted. */
export async function pruneSecurityEvents(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SECURITY_EVENT_RETENTION_DAYS * DAY_MS);
  const result = await prisma.securityEvent.deleteMany({ where: { occurredAt: { lt: cutoff } } });
  return result.count;
}
