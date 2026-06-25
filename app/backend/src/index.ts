import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import facilityRoutes from './routes/facility';
import robotRoutes from './routes/robots';
import weaponRoutes from './routes/weapons';
import weaponInventoryRoutes from './routes/weaponInventory';
import adminRoutes from './routes/admin';
import matchesRoutes from './routes/matches';
import leaguesRoutes from './routes/leagues';
import leaderboardsRoutes from './routes/leaderboards';
import financesRoutes from './routes/finances';
import recordsRoutes from './routes/records';
import tournamentsRoutes from './routes/tournaments';
import analyticsRoutes from './routes/analytics';
import onboardingRoutes from './routes/onboarding';
import guideRoutes from './routes/guide';
import kothRoutes from './routes/koth';
import practiceArenaRouter from './routes/practiceArena';
import stablesRoutes from './routes/stables';
import changelogRoutes from './routes/changelog';
import tuningAllocationRoutes from './routes/tuningAllocation';
import achievementsRoutes from './routes/achievements';
import subscriptionsRoutes from './routes/subscriptions';
import teamBattlesRoutes from './routes/teamBattles';
import { loadEnvConfig } from './config/env';
import { initScheduler } from './services/cycle/cycleScheduler';
import { registerSubscribableEvent } from './services/subscription/eventRegistry';
import {
  leagueLockingPredicate,
  tournamentLockingPredicate,
  tagTeamLockingPredicate,
  kothLockingPredicate,
  league2v2LockingPredicate,
  league3v3LockingPredicate,
  tournament2v2LockingPredicate,
  tournament3v3LockingPredicate,
} from './services/subscription/lockingPredicates';
import { contentModerationService } from './services/moderation';
import { getDiskUsage, getMemoryUsage, checkCriticalModules } from './utils/systemHealth';
import { sendMonitoringAlert } from './utils/monitoringWebhook';
import { initDailyHealthReport } from './services/monitoring/dailyHealthReport';
import { initBattleLogRetention } from './services/retention/battleLogRetentionService';
import os from 'os';
import { createGeneralLimiter, createAuthLimiter, createLoginLimiter } from './middleware/rateLimiter';
import { createUserEconomicLimiter } from './middleware/userRateLimiter';
import { authenticateToken } from './middleware/auth';
import { requestLogger } from './middleware/requestLogger';
import logger from './config/logger';
import prisma from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';

// `.env` is loaded as a side-effect of importing `./config/env` (via logger
// above). Calling `loadEnvConfig()` here triggers the singleton + Zod
// validation; if env is invalid the process exits before binding the port.
const config = loadEnvConfig();
const app = express();

// Disk alert cooldown state (15-minute cooldown per severity level)
const DISK_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const diskAlertCooldowns = new Map<string, number>();

app.set('trust proxy', 1);

// Security headers — mitigates XSS, clickjacking, MIME sniffing, and more (Req 5.5, 10.3, 10.5)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS — production restricts to explicit allowlist from CORS_ORIGIN env var (Req 10.1);
// development permits all origins for local convenience (Req 10.2).
// NOTE (Req 10.4): Currently using JWT in Authorization header, so CSRF is not a concern.
// If the application transitions to cookie-based token storage in the future, implement
// CSRF protection using the double-submit cookie pattern or synchronizer token pattern
// before deploying. See: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
app.use(cors({
  origin: config.corsOrigins.includes('*')
    ? true
    : config.corsOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use(requestLogger);

// Rate limiting — login limiter is tighter (10 req/15min), auth limiter for register, general for everything else
const loginLimiter = createLoginLimiter(config);
const authLimiter = createAuthLimiter(config);
const generalLimiter = createGeneralLimiter(config);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', generalLimiter);

// Per-user rate limiting on economic endpoints — mounted after auth so userId is available (Req 6.4)
const userEconomicLimiter = createUserEconomicLimiter();
const economicPrefixes = ['/api/weapons', '/api/weapon-inventory', '/api/facilities', '/api/robots'];
for (const prefix of economicPrefixes) {
  app.use(prefix, authenticateToken, userEconomicLimiter);
}

app.get('/api/health', async (req, res) => {
  const disk = getDiskUsage();
  const memory = getMemoryUsage();
  const modules = checkCriticalModules();

  // Active alerting on disk threshold breach (15-minute cooldown per severity)
  if (disk.status === 'warning' || disk.status === 'critical') {
    const now = Date.now();
    const lastAlert = diskAlertCooldowns.get(disk.status) || 0;
    if (now - lastAlert >= DISK_ALERT_COOLDOWN_MS) {
      diskAlertCooldowns.set(disk.status, now);
      const emoji = disk.status === 'critical' ? '🚨' : '⚠️';
      const label = disk.status.toUpperCase();
      sendMonitoringAlert(
        `${emoji} Disk usage ${label}: ${disk.usagePercent}% used (${disk.availableMB}MB free) on ${os.hostname()}`
      );
    }
  }

  let dbConnected = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbConnected = false;
  }

  const isHealthy = dbConnected && disk.status !== 'critical';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'error',
    database: dbConnected ? 'connected' : 'disconnected',
    disk,
    memory,
    modules,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/robots', robotRoutes);
app.use('/api/weapons', weaponRoutes);
app.use('/api/weapon-inventory', weaponInventoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/leagues', leaguesRoutes);
app.use('/api/leaderboards', leaderboardsRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/tournaments', tournamentsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/guide', guideRoutes);
app.use('/api/koth', kothRoutes);
app.use('/api/practice-arena', practiceArenaRouter);
app.use('/api/stables', stablesRoutes);
app.use('/api/changelog', changelogRoutes);
app.use('/api/robots', tuningAllocationRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/team-battles', teamBattlesRoutes);

// Serve uploaded images as static files (in production, Caddy handles this)
import path from 'path';
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

// Error handling middleware
app.use(errorHandler);

// Initialize content moderation model — skip in development unless explicitly enabled
// TF.js pure-JS backend blocks the Node event loop and adds ~5-13s latency to every request
if (config.nodeEnv === 'production' || config.nodeEnv === 'acceptance' || config.enableModeration) {
  contentModerationService.initialize().catch(err => {
    logger.error('Failed to initialize content moderation service:', err);
    // App continues — uploads will be rejected via fail-closed pattern
  });
} else {
  logger.info('Content moderation model skipped in development (set ENABLE_MODERATION=true to enable)');
}

// Populate achievement rarity cache on startup so /api/achievements has rarity data immediately
import { achievementService } from './services/achievement';
achievementService.refreshRarityCache().catch(err => {
  logger.error('Failed to initialize achievement rarity cache:', err);
});

const host = (config.nodeEnv === 'production' || config.nodeEnv === 'acceptance')
  ? '127.0.0.1'
  : '0.0.0.0';

// Run startup self-test before accepting connections
import { runStartupSelfTest } from './utils/startupSelfTest';

(async () => {
  const selfTest = await runStartupSelfTest();
  if (!selfTest.passed) {
    // Self-test handles logging and alerting internally
    process.exit(1);
  }

  // Note: Spec 35 (Booking Office) subscription table is a prerequisite for Spec 36.
  // The table is created by Prisma migrations — no runtime assertion needed.
  // Deploy order is enforced by documentation (see docs/guides/operations/DEPLOYMENT.md).

  app.listen(config.port, host, () => {
    logger.info(`Backend server running on http://${host}:${config.port}`);

    // Register v1 subscribable events (must happen before cycleScheduler.init())
    registerSubscribableEvent({ type: 'league_1v1', label: '1v1 League', lockingPredicate: leagueLockingPredicate });
    registerSubscribableEvent({ type: 'tournament_1v1', label: '1v1 Tournament', lockingPredicate: tournamentLockingPredicate });
    registerSubscribableEvent({ type: 'tag_team', label: 'Tag Team', lockingPredicate: tagTeamLockingPredicate });
    registerSubscribableEvent({ type: 'koth', label: 'King of the Hill', lockingPredicate: kothLockingPredicate });
    registerSubscribableEvent({ type: 'league_2v2', label: '2v2 League', lockingPredicate: league2v2LockingPredicate });
    registerSubscribableEvent({ type: 'league_3v3', label: '3v3 League', lockingPredicate: league3v3LockingPredicate });
    registerSubscribableEvent({ type: 'tournament_2v2', label: '2v2 Tournament', lockingPredicate: tournament2v2LockingPredicate });
    registerSubscribableEvent({ type: 'tournament_3v3', label: '3v3 Tournament', lockingPredicate: tournament3v3LockingPredicate });

    // Initialize the cycle scheduler after the server is listening
    initScheduler({
      enabled: config.schedulerEnabled,
      leagueSchedule: config.leagueSchedule,
      tournamentSchedule: config.tournamentSchedule,
      tagTeamSchedule: config.tagTeamSchedule,
      settlementSchedule: config.settlementSchedule,
      kothSchedule: config.kothSchedule,
      team2v2LeagueSchedule: config.team2v2LeagueSchedule,
      team3v3LeagueSchedule: config.team3v3LeagueSchedule,
      team2v2TournamentSchedule: config.team2v2TournamentSchedule,
      team3v3TournamentSchedule: config.team3v3TournamentSchedule,
      grandMeleeSchedule: config.grandMeleeSchedule,
    });

    // Initialize daily health report (independent of scheduler)
    initDailyHealthReport();

    // Initialize battle log retention cron (Spec #39 — 01:30 UTC daily)
    initBattleLogRetention();
  });
})();
