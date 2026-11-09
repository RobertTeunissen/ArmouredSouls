/**
 * Failed and slow API requests, counted per UTC hour, route pattern and error
 * code for the admin System page (`request_metrics`).
 *
 * Successful requests are only logged at debug level, so without this a page
 * that times out on ACC (the Economy page did, for days) leaves no trace an
 * admin sees. `requestLogger` reports every finished request; only server
 * errors (5xx) and requests of 2 s or longer are kept. They are summed in
 * memory and written once a minute (one upsert per bucket), so a busy route
 * costs no extra database write per request. Status only: this never alerts.
 *
 * @module services/monitoring/requestMetrics
 */
import type { Request } from 'express';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';

/** A request this long or longer counts as slow. */
export const SLOW_REQUEST_MS = 2_000;
/** Rows older than this are deleted. */
export const REQUEST_METRICS_RETENTION_DAYS = 30;
export const REQUEST_METRICS_FLUSH_MS = 60_000;
/** Distinct buckets kept in memory between flushes; more are dropped (and counted). */
const MAX_BUCKETS = 500;
const PRUNE_EVERY_MS = 60 * 60 * 1000;

export type RequestMetricKind = 'error' | 'slow';

interface Bucket {
  hour: Date;
  kind: RequestMetricKind;
  method: string;
  route: string;
  code: string;
  count: number;
  totalMs: number;
  maxMs: number;
  lastAt: Date;
}

const buckets = new Map<string, Bucket>();
let dropped = 0;
let lastPruneAt = 0;
let timer: NodeJS.Timeout | null = null;

/**
 * The Express route pattern of a request (`/api/admin/users/:id`), never the
 * raw URL, so ids and query strings are not stored. Null when no route matched.
 */
export function routePattern(req: Pick<Request, 'baseUrl' | 'route'>): string | null {
  const path = (req.route as { path?: unknown } | undefined)?.path;
  if (typeof path !== 'string') return null;
  const joined = `${req.baseUrl ?? ''}${path === '/' && req.baseUrl ? '' : path}`;
  return joined.slice(0, 160) || '/';
}

function utcHour(at: Date): Date {
  const hour = new Date(at);
  hour.setUTCMinutes(0, 0, 0);
  return hour;
}

function add(kind: RequestMetricKind, method: string, route: string, code: string, durationMs: number, at: Date): void {
  const hour = utcHour(at);
  const key = `${hour.toISOString()}|${kind}|${method}|${route}|${code}`;
  const bucket = buckets.get(key);
  if (bucket) {
    bucket.count += 1;
    bucket.totalMs += durationMs;
    bucket.maxMs = Math.max(bucket.maxMs, durationMs);
    bucket.lastAt = at;
    return;
  }
  if (buckets.size >= MAX_BUCKETS) {
    dropped += 1;
    return;
  }
  buckets.set(key, { hour, kind, method, route, code, count: 1, totalMs: durationMs, maxMs: durationMs, lastAt: at });
}

export interface FinishedRequest {
  method: string;
  /** Route pattern; null when no route matched (those are left out). */
  route: string | null;
  statusCode: number;
  durationMs: number;
  /** Set by `errorHandler` for errors it answered. */
  errorCode?: string | null;
  at?: Date;
}

/** Count a finished request if it failed with a server error or was slow. Never throws. */
export function recordRequest(request: FinishedRequest): void {
  try {
    if (!request.route) return;
    const at = request.at ?? new Date();
    const method = request.method.toUpperCase().slice(0, 8);
    const durationMs = Math.max(0, Math.round(request.durationMs));
    if (request.statusCode >= 500) {
      add('error', method, request.route, (request.errorCode || `HTTP_${request.statusCode}`).slice(0, 40), durationMs, at);
    }
    if (durationMs >= SLOW_REQUEST_MS) add('slow', method, request.route, '', durationMs, at);
  } catch {
    // Metrics must never break a response.
  }
}

/** Write the buffered counts (one upsert per bucket) and prune old rows once an hour. */
export async function flushRequestMetrics(now: Date = new Date()): Promise<number> {
  const pending = [...buckets.values()];
  buckets.clear();
  if (dropped > 0) {
    logger.warn(`[RequestMetrics] ${dropped} requests not counted: more than ${MAX_BUCKETS} routes in one minute`);
    dropped = 0;
  }
  for (const b of pending) {
    try {
      await prisma.$executeRaw`
        INSERT INTO request_metrics (hour, kind, method, route, code, count, total_ms, max_ms, last_at)
        VALUES (${b.hour}, ${b.kind}, ${b.method}, ${b.route}, ${b.code}, ${b.count}, ${b.totalMs}, ${b.maxMs}, ${b.lastAt})
        ON CONFLICT (hour, kind, method, route, code) DO UPDATE SET
          count = request_metrics.count + EXCLUDED.count,
          total_ms = request_metrics.total_ms + EXCLUDED.total_ms,
          max_ms = GREATEST(request_metrics.max_ms, EXCLUDED.max_ms),
          last_at = GREATEST(request_metrics.last_at, EXCLUDED.last_at)`;
    } catch (error) {
      logger.warn('[RequestMetrics] Could not write a bucket', { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (now.getTime() - lastPruneAt >= PRUNE_EVERY_MS) {
    lastPruneAt = now.getTime();
    try {
      const cutoff = new Date(now.getTime() - REQUEST_METRICS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await prisma.requestMetric.deleteMany({ where: { hour: { lt: cutoff } } });
    } catch (error) {
      logger.warn('[RequestMetrics] Could not prune old rows', { error: error instanceof Error ? error.message : String(error) });
    }
  }
  return pending.length;
}

/** Start the once-a-minute writer (backend start). */
export function startRequestMetrics(): void {
  if (timer) return;
  timer = setInterval(() => { void flushRequestMetrics(); }, REQUEST_METRICS_FLUSH_MS);
  timer.unref();
}

/** Buffered buckets (tests). */
export function pendingRequestMetrics(): Bucket[] {
  return [...buckets.values()];
}

/** Forget buffered buckets (tests). */
export function resetRequestMetrics(): void {
  buckets.clear();
  dropped = 0;
  lastPruneAt = 0;
}
