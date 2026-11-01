/**
 * Persists security signals to `security_events` for the admin Security page.
 *
 * Writes are fire-and-forget: a failed insert is logged and never affects the
 * request that triggered the signal. The in-memory sliding windows in
 * `securityMonitor` decide when a burst fires; this module only records it.
 *
 * @module services/security/securityEventStore
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { Prisma } from '../../../generated/prisma';
import type { SecurityEventDetails, SecuritySignal } from '../../types';

export interface SecuritySignalInput {
  signal: SecuritySignal;
  userId?: number;
  sourceIp?: string;
  endpoint?: string;
  details?: SecurityEventDetails;
}

const MAX_ENDPOINT = 200;
const MAX_IP = 64;

/** Request path without the query string, cut to the column size. */
export function normaliseEndpoint(endpoint: string | undefined): string | null {
  if (!endpoint) return null;
  const path = endpoint.split('?')[0];
  return path.length > MAX_ENDPOINT ? path.slice(0, MAX_ENDPOINT) : path;
}

/** Record one signal. Never throws and never blocks the caller. */
export function persistSecuritySignal(input: SecuritySignalInput): void {
  const data: Prisma.SecurityEventCreateInput = {
    signal: input.signal,
    userId: input.userId ?? null,
    sourceIp: input.sourceIp ? input.sourceIp.slice(0, MAX_IP) : null,
    endpoint: normaliseEndpoint(input.endpoint),
    details: (input.details ?? {}) as unknown as Prisma.InputJsonValue,
  };
  try {
    prisma.securityEvent.create({ data }).catch((error: unknown) => {
      logger.warn(`[security] Could not store ${input.signal} signal: ${error instanceof Error ? error.message : String(error)}`);
    });
  } catch (error) {
    // A synchronous failure (e.g. a mocked client in a test) must not reach the request either.
    logger.warn(`[security] Could not store ${input.signal} signal: ${error instanceof Error ? error.message : String(error)}`);
  }
}
