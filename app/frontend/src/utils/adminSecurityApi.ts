/**
 * Typed API of the admin Security page (`/admin/security`). Mirrors
 * `app/backend/src/services/security/securityOverviewService.ts`.
 */
import { api } from './api';

export type SecurityWindow = '24h' | '7d' | '30d';
export const SECURITY_WINDOWS: readonly SecurityWindow[] = ['24h', '7d', '30d'];
export const DEFAULT_SECURITY_WINDOW: SecurityWindow = '7d';

export type SecuritySignal =
  | 'failed_login'
  | 'rate_limit'
  | 'ownership_violation'
  | 'race_condition_burst'
  | 'robot_creation_burst'
  | 'malformed_request';

/** The six signal cards; `nsfw_block` is read from the image moderation log. */
export type SignalCard =
  | 'failed_login'
  | 'rate_limit'
  | 'ownership_violation'
  | 'race_condition_burst'
  | 'robot_creation_burst'
  | 'nsfw_block';

export interface SignalSummary {
  signal: SignalCard;
  total: number;
  perBucket: number[];
  lastSeenAt: string | null;
}

export interface SignalStableRow {
  userId: number;
  stableName: string | null;
  username: string | null;
  stableType: 'human' | 'generated' | 'automaton' | null;
  counts: Partial<Record<SecuritySignal, number>>;
  lastSeenAt: string;
}

export interface SignalSourceRow {
  sourceIp: string;
  failedLogins: number;
  accountsTried: number;
  malformedRequests: number;
  rateLimitHits: number;
  endpoints: string[];
  lastSeenAt: string;
  burst: { count: number; at: string } | null;
}

export interface SecurityOverview {
  window: SecurityWindow;
  generatedAt: string;
  bucket: 'hour' | 'day';
  buckets: string[];
  signals: SignalSummary[];
  stables: SignalStableRow[];
  sources: SignalSourceRow[];
  recordingSince: string | null;
  thresholds: { retentionDays: number; burstCount: number; burstWindowMinutes: number };
}

export const getSecurityOverview = (window: SecurityWindow, signal?: AbortSignal): Promise<SecurityOverview> =>
  api.get<SecurityOverview>('/api/admin/security/overview', { params: { window }, signal });
