/**
 * Frontend logger.
 *
 * Lightweight, dependency-free wrapper around `console.*` that:
 * - tags every message with a logger name so you can grep the browser console;
 * - silences `debug` output in production builds (treated as cheap dev tracing);
 * - centralizes the call site so we can plug in Sentry, OpenTelemetry, or a
 *   custom backend reporter later without touching every caller.
 *
 * Usage:
 * ```ts
 * import { createLogger } from '../utils/logger';
 * const log = createLogger('AuthContext');
 *
 * log.error('Auth token rejected', { error });
 * log.warn('Falling back to defaults');
 * log.info('User logged in', { userId });
 * log.debug('Polling interval tick');  // suppressed in production
 * ```
 *
 * Why not use `console.*` directly?
 * - Inconsistent prefixes make grepping a noisy browser console hard.
 * - We have no central place to ship errors to monitoring.
 * - Production builds shouldn't dump `console.log` chatter to end users.
 *
 * Lint rule `no-console` is enabled in this directory; route all logging
 * through this module instead. (`logger.ts` itself is exempted in
 * `eslint.config.js` so it can call `console.*` directly.)
 */

const isProduction = import.meta.env.PROD;

export interface Logger {
  /** Diagnostics. Suppressed in production. */
  debug(message: string, context?: unknown): void;
  /** Routine, expected events worth a trace in dev/staging. */
  info(message: string, context?: unknown): void;
  /** Recoverable issues. Always logged. */
  warn(message: string, context?: unknown): void;
  /** Failures, including caught exceptions. Always logged. */
  error(message: string, context?: unknown): void;
}

const formatPrefix = (name: string, level: string): string => `[${name}] ${level}:`;

/**
 * Create a logger scoped to a named module.
 *
 * The `name` is included in every output line so you can filter the console
 * by module (e.g. search "[AuthContext]" to see only auth events).
 */
export const createLogger = (name: string): Logger => ({
  debug(message, context) {
    if (isProduction) return;
    if (context !== undefined) {
      console.debug(formatPrefix(name, 'debug'), message, context);
    } else {
      console.debug(formatPrefix(name, 'debug'), message);
    }
  },
  info(message, context) {
    if (context !== undefined) {
      console.info(formatPrefix(name, 'info'), message, context);
    } else {
      console.info(formatPrefix(name, 'info'), message);
    }
  },
  warn(message, context) {
    if (context !== undefined) {
      console.warn(formatPrefix(name, 'warn'), message, context);
    } else {
      console.warn(formatPrefix(name, 'warn'), message);
    }
  },
  error(message, context) {
    if (context !== undefined) {
      console.error(formatPrefix(name, 'error'), message, context);
    } else {
      console.error(formatPrefix(name, 'error'), message);
    }
  },
});

/**
 * Default logger for one-off call sites that don't justify a named instance.
 * Prefer `createLogger('YourComponent')` so messages are filterable.
 */
export const logger = createLogger('app');
