export interface EnvConfig {
  nodeEnv: string;
  port: number;
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
}

/**
 * Load and validate environment configuration.
 *
 * Required variables:
 * - `DATABASE_URL` — PostgreSQL connection string (must be set in production)
 * - `JWT_SECRET` — JWT signing key (must not be the default placeholder in production)
 *
 * Optional variables with defaults:
 * - `JWT_EXPIRATION` — token lifetime (default: `'24h'`)
 * - `BCRYPT_SALT_ROUNDS` — bcrypt cost factor (default: `10`, valid: 4–31)
 * - `RATE_LIMIT_WINDOW_MS` — rate limit window in ms (default: `60000`)
 * - `RATE_LIMIT_MAX_REQUESTS` — max auth requests per window (default: `30`; general API allows 10x this)
 * - `LOGIN_RATE_LIMIT_WINDOW_MS` — login rate limit window in ms (default: `900000` = 15 minutes)
 * - `LOGIN_RATE_LIMIT_MAX` — max login attempts per window (default: `10`)
 */
export function loadEnvConfig(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';

  if (nodeEnv === 'production' && jwtSecret === 'dev-secret-change-in-production') {
    console.error('FATAL: JWT_SECRET must be set in production');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL || '';
  if (nodeEnv === 'production' && !databaseUrl) {
    console.error('FATAL: DATABASE_URL must be set in production');
    process.exit(1);
  }

  const jwtExpiration = process.env.JWT_EXPIRATION || '24h';

  const parsedSaltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
  const bcryptSaltRounds =
    isNaN(parsedSaltRounds) || parsedSaltRounds < 4 || parsedSaltRounds > 31
      ? 10
      : parsedSaltRounds;

  const parsedWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  const rateLimitWindowMs = isNaN(parsedWindowMs) || parsedWindowMs <= 0 ? 60000 : parsedWindowMs;

  const parsedMaxReqs = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10);
  const rateLimitMaxRequests = isNaN(parsedMaxReqs) || parsedMaxReqs <= 0 ? 30 : parsedMaxReqs;

  const parsedLoginWindowMs = parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10);
  const loginRateLimitWindowMs = isNaN(parsedLoginWindowMs) || parsedLoginWindowMs <= 0 ? 900000 : parsedLoginWindowMs;

  const parsedLoginMax = parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10);
  const loginRateLimitMax = isNaN(parsedLoginMax) || parsedLoginMax <= 0 ? 10 : parsedLoginMax;

  const corsOriginRaw = process.env.CORS_ORIGIN || '';
  const corsOrigins = nodeEnv === 'development'
    ? ['*']
    : corsOriginRaw.split(',').map(o => o.trim()).filter(Boolean);

  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl,
    jwtSecret,
    jwtExpiration,
    bcryptSaltRounds,
    corsOrigins,
    schedulerEnabled: process.env.SCHEDULER_ENABLED === 'true',
    rateLimitWindowMs,
    rateLimitMaxRequests,
    loginRateLimitWindowMs,
    loginRateLimitMax,
    leagueSchedule: process.env.LEAGUE_SCHEDULE || '0 20 * * *',
    tournamentSchedule: process.env.TOURNAMENT_SCHEDULE || '0 8 * * *',
    tagTeamSchedule: process.env.TAGTEAM_SCHEDULE || '0 12 * * *',
    settlementSchedule: process.env.SETTLEMENT_SCHEDULE || '0 23 * * *',
    kothSchedule: process.env.KOTH_SCHEDULE || '0 16 * * 1,3,5',
  };
}

// Singleton config instance — initialized on first access
let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!_config) {
    _config = loadEnvConfig();
  }
  return _config;
}
