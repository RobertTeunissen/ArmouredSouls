/**
 * Wire contract for the admin Security page: `GET /api/admin/security/overview`
 * (backend `services/security/securityOverviewService.ts`).
 */


/** Every recorded security signal (`SECURITY_SIGNALS` in backend `types/securityTypes.ts` satisfies it). */
export type SecuritySignal =
  /** Wrong password, unknown account, or an Automaton name at login. */
  | 'failed_login'
  /** Any rate limiter refused a request (per player, or per IP before login). */
  | 'rate_limit'
  /** A player acted on another stable's robot, weapon or facility, or a non-admin opened an admin endpoint. */
  | 'ownership_violation'
  /** More than 10 conflict (409) responses for one player within a minute. */
  | 'race_condition_burst'
  /** More than 3 robots created by one player within 10 minutes. */
  | 'robot_creation_burst'
  /** A request without a logged-in user failed schema validation. */
  | 'malformed_request';


export interface SecurityOverview {
  window: SecurityWindow;
  generatedAt: string;
  bucket: 'hour' | 'day';
  /** Start of every bucket, oldest first (ISO, UTC). */
  buckets: string[];
  signals: SignalSummary[];
  stables: SignalStableRow[];
  sources: SignalSourceRow[];
  /** Oldest stored signal, so the page can say how far back it can see. */
  recordingSince: string | null;
  thresholds: { retentionDays: number; burstCount: number; burstWindowMinutes: number };
}

export type SecurityWindow = '24h' | '7d' | '30d';

export type SignalCard = 'failed_login' | 'rate_limit' | 'ownership_violation' | 'race_condition_burst' | 'robot_creation_burst' | 'nsfw_block';

export interface SignalSourceRow {
  sourceIp: string;
  failedLogins: number;
  /** Distinct existing accounts named in those attempts. */
  accountsTried: number;
  malformedRequests: number;
  rateLimitHits: number;
  endpoints: string[];
  lastSeenAt: string;
  /** Largest number of failed logins inside one burst window, when it reached the burst count. */
  burst: { count: number; at: string } | null;
}

export interface SignalStableRow {
  userId: number;
  stableName: string | null;
  username: string | null;
  stableType: 'human' | 'generated' | 'automaton' | null;
  /** Failed logins count attempts on this account; the rest are the player's own. */
  counts: Partial<Record<SecuritySignal, number>>;
  lastSeenAt: string;
}

export interface SignalSummary {
  signal: SignalCard;
  total: number;
  /** One count per bucket of `buckets`. */
  perBucket: number[];
  /** Last occurrence ever recorded (not limited to the window). */
  lastSeenAt: string | null;
}
