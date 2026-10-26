import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolClient } from 'pg';
import dotenv from 'dotenv';
import { getConfig } from '../config/env';
import { resolveDbPoolMax } from './dbPoolConfig';

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

/**
 * Default limits of every interactive transaction (`prisma.$transaction(async tx => …)`);
 * a call can still pass its own.
 *
 * Prisma's defaults (wait 2 s for a connection, 5 s to finish) are too short
 * for transactions that queue on a shared lock. Every audit write takes the
 * per-cycle advisory lock of `withAuditSequence` (`services/common/auditSequence.ts`),
 * so concurrent writers (Automaton turns, Grand Melee rewards, achievement
 * audit rows) run one after another; under load a queued transaction passed
 * 5 s and failed with "A query cannot be executed on an expired transaction".
 * On ACC that silently dropped `audit_logs` rows (hundreds per day in Oct 2026)
 * and failed Automaton turns in the multi-season simulation. Waiting is the
 * correct outcome for a queue, and the 30 s statement timeout still ends a
 * runaway query.
 */
const INTERACTIVE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

function createPrismaClient(): PrismaClient {
  const { databaseUrl, nodeEnv } = getConfig();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Pool size. ACC and PRD run Postgres with `max_connections=20`
  // (docker-compose.production.yml), so the backend must not take every slot:
  // deploy migrations/seed, pg_dump backups and psql sessions run alongside it.
  // At the old default of 20 a busy backend locked them out, which failed the
  // 2026-10-07 ACC deploy at the seed step ("too many clients already").
  // 15 keeps 5 slots free while still covering heavy batch work (tournament
  // rounds). Note: `connection_limit` in DATABASE_URL is a Prisma-engine
  // parameter and is ignored by the pg driver adapter; this is the real cap.
  // Configurable via DB_POOL_MAX; keep it below the server's max_connections.
  // The Automaton Turn_Step sizes its parallelism from the same value.
  const poolMax = resolveDbPoolMax();

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
    transactionOptions: INTERACTIVE_TRANSACTION_OPTIONS,
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
