import express from 'express';
import cors from 'cors';
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
import { loadEnvConfig } from './config/env';
import { initScheduler } from './services/cycleScheduler';
import { generalLimiter, authLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import logger from './config/logger';
import prisma from './lib/prisma';

dotenv.config();

const config = loadEnvConfig();
const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: config.corsOrigins.includes('*')
    ? true
    : config.corsOrigins,
  credentials: true,
}));
app.use(express.json());

// Request logging
app.use(requestLogger);

// Rate limiting — auth limiter applied before general limiter for auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', generalLimiter);

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  } catch (error) {
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

// Error handling middleware — logs stack traces, redacts them from production responses
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
  });

  const isProduction = config.nodeEnv === 'production' || config.nodeEnv === 'acceptance';

  res.status(500).json({
    error: 'Internal Server Error',
    ...(isProduction ? {} : { message: err.message, stack: err.stack }),
  });
});

const host = (config.nodeEnv === 'production' || config.nodeEnv === 'acceptance')
  ? '127.0.0.1'
  : '0.0.0.0';

app.listen(config.port, host, () => {
  logger.info(`Backend server running on http://${host}:${config.port}`);

  // Initialize the cycle scheduler after the server is listening
  initScheduler({
    enabled: config.schedulerEnabled,
    leagueSchedule: process.env.LEAGUE_SCHEDULE || '0 20 * * *',
    tournamentSchedule: process.env.TOURNAMENT_SCHEDULE || '0 8 * * *',
    tagTeamSchedule: process.env.TAGTEAM_SCHEDULE || '0 12 * * *',
    settlementSchedule: process.env.SETTLEMENT_SCHEDULE || '0 23 * * *',
  });
});
