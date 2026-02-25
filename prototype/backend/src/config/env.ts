export interface EnvConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigins: string[];
  schedulerEnabled: boolean;
}

export function loadEnvConfig(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET || 'default-dev-secret';

  if (nodeEnv === 'production' && jwtSecret === 'default-dev-secret') {
    console.error('FATAL: JWT_SECRET must be set in production');
    process.exit(1);
  }

  const corsOriginRaw = process.env.CORS_ORIGIN || '';
  const corsOrigins = nodeEnv === 'development'
    ? ['*']
    : corsOriginRaw.split(',').map(o => o.trim()).filter(Boolean);

  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret,
    corsOrigins,
    schedulerEnabled: process.env.SCHEDULER_ENABLED === 'true',
  };
}
