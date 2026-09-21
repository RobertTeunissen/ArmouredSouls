import logger from '../../config/logger';

/** Stable operation identifier for the fail-open analytics persistence path. */
export const SEARCH_PERSISTENCE_FAILURE_OPERATION_CODE =
  'search_analytics_persistence_failure' as const;

/** Result counts captured after a player search response is fully shaped. */
export interface SearchResultCounts {
  robots: number;
  stables: number;
  guide: number;
  total: number;
}

/**
 * Server-owned context available when Search_Analytics_Store persistence fails.
 *
 * This input is intentionally narrower than a search request, response, or
 * persistence error. The helper never accepts those values, so a fail-open
 * diagnostic cannot accidentally serialize a query, token, or audit payload.
 */
export interface SearchPersistenceFailureContext {
  userId: number;
  eventTimestamp?: Date | string;
  seasonNumber?: number;
  cycleNumber?: number;
  resultCounts: SearchResultCounts;
}

/** Exact allow-list emitted to the application logger. */
export interface SearchPersistenceFailureDiagnostic {
  operationCode: typeof SEARCH_PERSISTENCE_FAILURE_OPERATION_CODE;
  eventTimestamp?: string;
  seasonNumber?: number;
  cycleNumber?: number;
  userId: number;
  resultCounts: SearchResultCounts;
}

function safeInteger(value: number | undefined): number | undefined {
  return value !== undefined && Number.isSafeInteger(value) ? value : undefined;
}

function safeNonNegativeCount(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeTimestamp(value: Date | string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Build the allow-listed diagnostic without retaining references to caller
 * objects. Invalid optional server context is omitted and invalid counts are
 * reduced to zero so this failure path cannot throw while reporting a failure.
 */
export function createSearchPersistenceFailureDiagnostic(
  context: SearchPersistenceFailureContext,
): SearchPersistenceFailureDiagnostic {
  const diagnostic: SearchPersistenceFailureDiagnostic = {
    operationCode: SEARCH_PERSISTENCE_FAILURE_OPERATION_CODE,
    userId: safeInteger(context.userId) ?? 0,
    resultCounts: {
      robots: safeNonNegativeCount(context.resultCounts.robots),
      stables: safeNonNegativeCount(context.resultCounts.stables),
      guide: safeNonNegativeCount(context.resultCounts.guide),
      total: safeNonNegativeCount(context.resultCounts.total),
    },
  };

  const eventTimestamp = safeTimestamp(context.eventTimestamp);
  if (eventTimestamp !== undefined) diagnostic.eventTimestamp = eventTimestamp;

  const seasonNumber = safeInteger(context.seasonNumber);
  if (seasonNumber !== undefined) diagnostic.seasonNumber = seasonNumber;

  const cycleNumber = safeInteger(context.cycleNumber);
  if (cycleNumber !== undefined) diagnostic.cycleNumber = cycleNumber;

  return diagnostic;
}

/**
 * Record a phrase-free internal diagnostic for a fail-open persistence error.
 *
 * Deliberately does not accept or log the persistence error itself: database
 * error text can contain query values, and the successful player response must
 * remain isolated from this operational warning.
 */
export function logSearchPersistenceFailure(context: SearchPersistenceFailureContext): void {
  const diagnostic = createSearchPersistenceFailureDiagnostic(context);
  logger.warn('Search analytics persistence failure', diagnostic);
}
