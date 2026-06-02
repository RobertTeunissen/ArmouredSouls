import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import { getConfig } from '../config/env';

dotenv.config();

// Use a singleton pattern to ensure only one Prisma Client instance
// This is especially important for tests to avoid "too many connections" errors
declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const { databaseUrl, nodeEnv } = getConfig();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Increase pool size from default 10 to 20 to handle heavy batch workloads
  // (e.g. tournament rounds with 2000+ matches doing ~15 DB ops each).
  // Configurable via DB_POOL_MAX env var for per-environment tuning.
  const poolMax = parseInt(process.env.DB_POOL_MAX || '20', 10);
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: poolMax,
    idleTimeoutMillis: 30_000,
  });
  return new PrismaClient({
    adapter,
    log: nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
  });
}

// Lazy singleton — only connects when first accessed, not at import time.
// This prevents unit tests from failing when DATABASE_URL is not set,
// as long as they mock or don't actually call prisma methods.
let _prisma: PrismaClient | undefined = global.prisma;

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!_prisma) {
      _prisma = createPrismaClient();
      if (getConfig().nodeEnv !== 'production') {
        global.prisma = _prisma;
      }
    }
    return (_prisma as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export default prisma;
