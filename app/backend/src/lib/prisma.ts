import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolClient } from 'pg';
import dotenv from 'dotenv';
import { getConfig } from '../config/env';

dotenv.config();

type PrismaStatementObserver = (sql: string) => void;

const statementObservers = new Set<PrismaStatementObserver>();

function queryText(query: unknown): string {
  if (typeof query === 'string') return query;
  if (typeof query !== 'object' || query === null || !('text' in query)) return '';
  return typeof query.text === 'string' ? query.text : '';
}

function instrumentClient(client: PoolClient): void {
  const originalQuery = client.query.bind(client) as unknown as (...args: unknown[]) => unknown;
  client.query = ((...args: unknown[]): unknown => {
    const sql = queryText(args[0]);
    for (const observer of statementObservers) observer(sql);
    return originalQuery(...args);
  }) as typeof client.query;
}

/**
 * Observe SQL statement text emitted through the Prisma PostgreSQL adapter.
 * Values are deliberately unavailable so performance diagnostics cannot expose
 * tokens, player identities, source identities, or financial payloads.
 */
export function observePrismaStatements(observer: PrismaStatementObserver): () => void {
  statementObservers.add(observer);
  return (): void => {
    statementObservers.delete(observer);
  };
}

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

  // Statement timeout (ms): kills queries that exceed this duration to prevent
  // pool starvation from runaway queries. Default 30s; configurable via DB_STATEMENT_TIMEOUT_MS.
  const statementTimeoutMs = parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '30000', 10);

  const pool = new Pool({
    connectionString: databaseUrl,
    max: poolMax,
    idleTimeoutMillis: 30_000,
    options: `-c statement_timeout=${statementTimeoutMs}`,
  });
  if (nodeEnv === 'test') {
    pool.on('connect', instrumentClient);
  }
  const adapter = new PrismaPg(pool, { disposeExternalPool: true });
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
