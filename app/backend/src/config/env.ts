/**
 * Environment configuration — Zod-validated, fail-fast in production.
 *
 * Why this exists:
 * - Bare `process.env.X` returns `string | undefined`. Code that asserts
 *   non-null with `!` crashes at runtime in some random service when an env
 *   var is missing on deploy, instead of failing clearly at startup.
 * - Manual `parseInt(... || 'default')` boilerplate scattered across files
 *   gets inconsistent. One schema = one source of truth.
 * - Zod gives us type-narrowed access: `config.bcryptSaltRounds` is
 *   `number`, not `number | undefined`.
 *
 * Behavior:
 * - In **production**: invariants are strict. Missing required vars
 *   (DATABASE_URL, non-default JWT_SECRET) cause `process.exit(1)`.
 * - In **development / test / acceptance**: lenient. Invalid numeric values
 *   silently fall back to defaults so a fat-fingered `.env` doesn't block
 *   local work. Acceptance behaves like dev intentionally — historical test
 *   contracts depend on this.
 *
 * Add new env vars by extending `EnvSchema` below. Update `.env.example` and
 * `.env.production.example` in the same commit so deploys don't drift.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema — pre-coercion (raw string env)
// ---------------------------------------------------------------------------

/**
 * Coerce a numeric env var with bounds. Out-of-range or non-numeric values
 * fall back to `fallback` rather than throwing — preserves the original
 * lenient behavior for optional numeric knobs (rate limits, salt rounds).
 */
const numericString = (
  fallback: number,
  opts: { min?: number; max?: number } = {},
) =>
  z.preprocess((val) => {
    if (val === undefined || val === '') return fallback;
    const n = Number(val);
    if (Number.isNaN(n)) return fallback;
    if (opts.min !== undefined && n < opts.min) return fallback;
    if (opts.max !== undefined && n > opts.max) return fallback;
    return n;
  }, z.number());

/** Comma-separated string list, trimmed and empty-filtered. */
const csvList = z
  .string()
  .optional()
  .transform((val) =>
    (val ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

/** "true" / "false" string → boolean. Anything else (or unset) → false. */
const boolFlag = z
  .string()
  .optional()
  .transform((val) => val === 'true');

const EnvSchema = z
  .object({
    // ── Runtime ────────────────────────────────────────────────────────
    NODE_ENV: z
      .enum(['development', 'test', 'acceptance', 'production'])
      .default('development'),
    PORT: numericString(3001),
    LOG_LEVEL: z
      .enum(['debug', 'info', 'warn', 'error'])
      .default('info'),

    // ── Database ───────────────────────────────────────────────────────
    // Optional at schema level; production-only requirement is enforced in
    // `superRefine` below to keep dev/test ergonomics (no DATABASE_URL needed
    // for unit tests that don't touch Prisma).
    DATABASE_URL: z.string().optional().default(''),

    // ── Authentication ─────────────────────────────────────────────────
    JWT_SECRET: z.string().default('default-dev-secret'),
    JWT_EXPIRATION: z.string().default('24h'),
    BCRYPT_SALT_ROUNDS: numericString(10, { min: 4, max: 31 }),

    // ── Rate limiting ─────────────────────────────────────────────────
    RATE_LIMIT_WINDOW_MS: numericString(60_000, { min: 1 }),
    RATE_LIMIT_MAX_REQUESTS: numericString(30, { min: 1 }),
    LOGIN_RATE_LIMIT_WINDOW_MS: numericString(900_000, { min: 1 }),
    LOGIN_RATE_LIMIT_MAX: numericString(10, { min: 1 }),

    // ── CORS ──────────────────────────────────────────────────────────
    CORS_ORIGIN: csvList,

    // ── Scheduler ─────────────────────────────────────────────────────
    SCHEDULER_ENABLED: boolFlag,
    LEAGUE_SCHEDULE: z.string().default('0 20 * * *'),
    TOURNAMENT_SCHEDULE: z.string().default('0 8 * * *'),
    TAGTEAM_SCHEDULE: z.string().default('0 12 * * *'),
    SETTLEMENT_SCHEDULE: z.string().default('0 23 * * *'),
    KOTH_SCHEDULE: z.string().default('0 16 * * 1,3,5'),

    // ── Monitoring & alerts ──────────────────────────────────────────
    MONITORING_DISCORD_WEBHOOK: z.string().optional(),
    DISCORD_WEBHOOK_URL: z.string().optional(),
    DAILY_REPORT_SCHEDULE: z.string().default('0 8 * * *'),

    // ── Optional integrations ────────────────────────────────────────
    CHANGELOG_DEPLOY_TOKEN: z.string().optional(),
    APP_BASE_URL: z.string().optional(),
    ENABLE_MODERATION: boolFlag,
  })
  .superRefine((env, ctx) => {
    // Production-only invariants. Acceptance / staging deploys SHOULD also
    // set real values, but enforcing here would break tests that rely on
    // the lenient pre-Zod behavior. Keep the strict check production-only.
    if (env.NODE_ENV !== 'production') return;

    if (!env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL must be set in production',
      });
    }

    if (
      env.JWT_SECRET === 'default-dev-secret' ||
      env.JWT_SECRET === 'dev-secret-change-in-production'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be a non-default value in production. Generate with: openssl rand -hex 32',
      });
    }
  });

// ---------------------------------------------------------------------------
// Public types & accessors
// ---------------------------------------------------------------------------

/**
 * Parsed, validated, type-safe environment configuration.
 *
 * Field names mirror the surrounding code — kept camelCase intentionally
 * so existing call sites (`config.databaseUrl`, `config.jwtSecret`) keep
 * working without a churn-heavy rename.
 */
export interface EnvConfig {
  nodeEnv: 'development' | 'test' | 'acceptance' | 'production';
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiration: string;
  bcryptSaltRounds: number;
  corsOrigins: string[];
  schedulerEnabled: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  loginRateLimitWindowMs: number;
  loginRateLimitMax: number;
  leagueSchedule: string;
  tournamentSchedule: string;
  tagTeamSchedule: string;
  settlementSchedule: string;
  kothSchedule: string;
  /** Discord webhook URL for ops alerts. Falls back to DISCORD_WEBHOOK_URL. */
  monitoringDiscordWebhook: string | undefined;
  /** Generic Discord webhook for player notifications. */
  discordWebhookUrl: string | undefined;
  dailyReportSchedule: string;
  changelogDeployToken: string | undefined;
  /** Base URL of the deployed app, used in notification links. */
  appBaseUrl: string | undefined;
  /** Force-enable image moderation in non-prod environments. */
  enableModeration: boolean;
}

const toEnvConfig = (parsed: z.infer<typeof EnvSchema>): EnvConfig => ({
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  databaseUrl: parsed.DATABASE_URL,
  jwtSecret: parsed.JWT_SECRET,
  jwtExpiration: parsed.JWT_EXPIRATION,
  bcryptSaltRounds: parsed.BCRYPT_SALT_ROUNDS,
  corsOrigins:
    parsed.NODE_ENV === 'development'
      ? [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:3000',
        ]
      : parsed.CORS_ORIGIN,
  schedulerEnabled: parsed.SCHEDULER_ENABLED,
  rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: parsed.RATE_LIMIT_MAX_REQUESTS,
  loginRateLimitWindowMs: parsed.LOGIN_RATE_LIMIT_WINDOW_MS,
  loginRateLimitMax: parsed.LOGIN_RATE_LIMIT_MAX,
  leagueSchedule: parsed.LEAGUE_SCHEDULE,
  tournamentSchedule: parsed.TOURNAMENT_SCHEDULE,
  tagTeamSchedule: parsed.TAGTEAM_SCHEDULE,
  settlementSchedule: parsed.SETTLEMENT_SCHEDULE,
  kothSchedule: parsed.KOTH_SCHEDULE,
  monitoringDiscordWebhook: parsed.MONITORING_DISCORD_WEBHOOK || undefined,
  discordWebhookUrl: parsed.DISCORD_WEBHOOK_URL || undefined,
  dailyReportSchedule: parsed.DAILY_REPORT_SCHEDULE,
  changelogDeployToken: parsed.CHANGELOG_DEPLOY_TOKEN,
  appBaseUrl: parsed.APP_BASE_URL || undefined,
  enableModeration: parsed.ENABLE_MODERATION,
});

/**
 * Format a Zod issue list into a human-readable error block. We can't use
 * the project logger here because env validation runs before the logger is
 * configured — `process.stderr.write` is the lowest-friction option.
 */
const formatIssues = (issues: z.ZodIssue[]): string =>
  issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `  - ${path}: ${issue.message}`;
    })
    .join('\n');

/**
 * Validate `process.env` against `EnvSchema`. On failure, write all issues
 * to stderr and exit with code 1. On success, return the typed config.
 *
 * Exported for testing — application code should use {@link getConfig}.
 */
export function loadEnvConfig(): EnvConfig {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    process.stderr.write(
      `\nFATAL: Invalid environment configuration.\n${formatIssues(result.error.issues)}\n\n` +
        `Check .env, .env.example, and .env.production.example.\n\n`,
    );
    process.exit(1);
  }

  return toEnvConfig(result.data);
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _config: EnvConfig | null = null;

/**
 * Get the validated config singleton. Initializes on first call. Safe to
 * call from anywhere — the underlying validation runs at most once per
 * process.
 */
export function getConfig(): EnvConfig {
  if (!_config) {
    _config = loadEnvConfig();
  }
  return _config;
}

/**
 * Reset the cached config. Tests use this to re-read mutated env vars
 * between cases. Production code must not call this.
 */
export function _resetConfigForTesting(): void {
  _config = null;
}
