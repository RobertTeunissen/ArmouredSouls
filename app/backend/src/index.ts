import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
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
import tagTeamsRoutes from './routes/tagTeams';
import analyticsRoutes from './routes/analytics';
import onboardingRoutes from './routes/onboarding';
import guideRoutes from './routes/guide';
import kothRoutes from './routes/koth';
import practiceArenaRouter from './routes/practiceArena';
import stablesRoutes from './routes/stables';
import changelogRoutes from './routes/changelog';
import tuningAllocationRoutes from './routes/tuningAllocation';
import { loadEnvConfig } from './config/env';
import { initScheduler } from './services/cycle/cycleScheduler';
import { contentModerationService } from './services/moderation';
import { createGeneralLimiter, createAuthLimiter, createLoginLimiter } from './middleware/rateLimiter';
import { createUserEconomicLimiter } from './middleware/userRateLimiter';
import { authenticateToken } from './middleware/auth';
import { requestLogger } from './middleware/requestLogger';
import logger from './config/logger';
import prisma from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const config = loadEnvConfig();
const app = express();

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
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  } catch {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  }
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
app.use('/api/tag-teams', tagTeamsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/guide', guideRoutes);
app.use('/api/koth', kothRoutes);
app.use('/api/practice-arena', practiceArenaRouter);
app.use('/api/stables', stablesRoutes);
app.use('/api/changelog', changelogRoutes);
app.use('/api/robots', tuningAllocationRoutes);

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

// Initialize content moderation model (fire-and-forget — service handles errors internally)
contentModerationService.initialize().catch(err => {
  logger.error('Failed to initialize content moderation service:', err);
  // App continues — uploads will be rejected via fail-closed pattern
});

const host = (config.nodeEnv === 'production' || config.nodeEnv === 'acceptance')
  ? '127.0.0.1'
  : '0.0.0.0';

app.listen(config.port, host, () => {
  logger.info(`Backend server running on http://${host}:${config.port}`);

  // Initialize the cycle scheduler after the server is listening
  initScheduler({
    enabled: config.schedulerEnabled,
    leagueSchedule: config.leagueSchedule,
    tournamentSchedule: config.tournamentSchedule,
    tagTeamSchedule: config.tagTeamSchedule,
    settlementSchedule: config.settlementSchedule,
    kothSchedule: config.kothSchedule,
  });
});
