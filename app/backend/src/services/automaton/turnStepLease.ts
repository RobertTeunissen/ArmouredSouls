/**
 * Turn_Step infrastructure (Spec #55): the error code of a failed
 * Turn_Record, the cutover guard (R7.5), and the heartbeat lease that keeps
 * one Turn_Step running at a time (design §11.1,
 * docs/implementation_notes/AUTOMATON_TURN_STEP_DEADLINE.md).
 *
 * @module services/automaton/turnStepLease
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { AppError } from '../../errors/AppError';
import { AutomatonError, AutomatonErrorCode } from '../../errors/automatonErrors';
import { resolveCanonicalCycleIdentity } from '../cycle/canonicalCycleIdentity';
import type { StableFacts } from './stableFacts';
import { ensureProgramSettings, PROGRAM_SETTINGS_ID } from './programSwitch';
import {
  truncate,
} from './automatonObservability';
import type { TurnStepDependencies } from './automatonTurnService';

/** The lease settings of the Turn_Step dependencies. */
type LeaseDependencies = Pick<TurnStepDependencies, 'now' | 'leasePollMs' | 'leaseTtlMs' | 'leaseRenewMs'>;

/** Error code of the alert raised when a running Turn_Step lost its lease (AUTOMATON_TURN_STEP_DEADLINE.md, "Heartbeat lease"). */
export const TURN_STEP_LEASE_LOST = 'TURN_STEP_LEASE_LOST';

/**
 * Lifetime of one Turn_Step lease claim or renewal: a crashed holder blocks
 * other callers for at most this long (docs/implementation_notes/
 * AUTOMATON_TURN_STEP_DEADLINE.md, "Heartbeat lease").
 */
export const TURN_STEP_LEASE_TTL_MS = 120_000;
/** How often the holder renews its lease while the step runs ("Heartbeat lease"). */
export const TURN_STEP_LEASE_RENEW_MS = 30_000;
/** How often a waiting caller retries the lease (design §11.1). */
export const TURN_STEP_LEASE_POLL_MS = 1_000;

/** What the step sees of its lease while it runs. */
export interface TurnStepLease {
  /** True once a renewal found the lease taken over; start no further turns. */
  readonly lost: boolean;
}


// ─── Errors ──────────────────────────────────────────────────────────

/** Error code recorded on a failed Turn_Record. */
export function errorCodeOf(error: unknown): string {
  if (error instanceof AppError) return error.code;
  return 'UNEXPECTED_ERROR';
}

export function errorMessageOf(error: unknown): string {
  return truncate(error instanceof Error ? error.message : String(error));
}

// ─── Cutover guard and lease ─────────────────────────────────────────

/**
 * Refuse to run while a Serialized_Cycle_Cutover is in progress (R7.5).
 * Defensive: every call site already runs after `completeSerializedCycleCutover`.
 * Returns the season phase the identity reports.
 */
export async function assertNoCutoverInProgress(): Promise<StableFacts['phase']> {
  const identity = await resolveCanonicalCycleIdentity();
  if (identity.isClosing) {
    throw new AutomatonError(
      AutomatonErrorCode.AUTOMATON_CUTOVER_IN_PROGRESS,
      `Cycle ${identity.closingCycle ?? identity.activeCycle} is closing; Automaton turns wait for the cutover to finish`,
      409,
    );
  }
  return identity.phase;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn` while holding the Turn_Step lease (`automaton_program_settings.
 * turnStepLeaseUntil`, design §11.1, heartbeat per AUTOMATON_TURN_STEP_DEADLINE.md).
 *
 * One conditional update claims it for TURN_STEP_LEASE_TTL_MS when it is
 * empty or expired (a crashed holder's lease is taken over); otherwise the
 * caller polls. While `fn` runs, the holder renews it every
 * TURN_STEP_LEASE_RENEW_MS with an update that matches only its own value.
 * A renewal that matches no row means another caller took the lease over:
 * `lease.lost` turns true and renewing stops. A renewal that throws is logged
 * and retried at the next tick. The lease is cleared in `finally`, only if
 * still ours. Raw parameterised SQL keeps the switch's `updatedAt` for switch
 * changes.
 */
export async function withTurnStepLease<T>(fn: (lease: TurnStepLease) => Promise<T>, deps: LeaseDependencies = {}): Promise<T> {
  const now = deps.now ?? Date.now;
  const pollMs = deps.leasePollMs ?? TURN_STEP_LEASE_POLL_MS;
  const ttlMs = deps.leaseTtlMs ?? TURN_STEP_LEASE_TTL_MS;
  await ensureProgramSettings();
  for (;;) {
    const current = new Date(now());
    const until = new Date(current.getTime() + ttlMs);
    const claimed = await prisma.$executeRaw`
      UPDATE "automaton_program_settings"
      SET "turn_step_lease_until" = ${until}
      WHERE "id" = ${PROGRAM_SETTINGS_ID}
        AND ("turn_step_lease_until" IS NULL OR "turn_step_lease_until" < ${current})`;
    if (claimed === 1) return holdTurnStepLease(fn, until, deps);
    await sleep(pollMs);
  }
}

/** Run `fn` under a claimed lease (value `claimedUntil`), renewing it until `fn` settles. */
async function holdTurnStepLease<T>(
  fn: (lease: TurnStepLease) => Promise<T>,
  claimedUntil: Date,
  deps: LeaseDependencies,
): Promise<T> {
  const now = deps.now ?? Date.now;
  const ttlMs = deps.leaseTtlMs ?? TURN_STEP_LEASE_TTL_MS;
  const renewMs = deps.leaseRenewMs ?? TURN_STEP_LEASE_RENEW_MS;
  const state: { current: Date; lost: boolean; renewal: Promise<void> | null } = { current: claimedUntil, lost: false, renewal: null };
  const lease: TurnStepLease = {
    get lost(): boolean {
      return state.lost;
    },
  };

  const renew = async (): Promise<void> => {
    const next = new Date(now() + ttlMs);
    try {
      const renewed = await prisma.$executeRaw`
        UPDATE "automaton_program_settings"
        SET "turn_step_lease_until" = ${next}
        WHERE "id" = ${PROGRAM_SETTINGS_ID} AND "turn_step_lease_until" = ${state.current}`;
      if (renewed === 1) {
        state.current = next;
        return;
      }
      state.lost = true;
      clearInterval(timer);
      logger.error('[automaton-turns] Turn_Step lease lost: another caller took it over; no further turns start');
    } catch (error) {
      // Not lost: the lease is still ours until it expires; retry at the next tick.
      logger.error(`[automaton-turns] Turn_Step lease renewal failed, retrying — ${errorMessageOf(error)}`);
    }
  };

  const timer = setInterval(() => {
    // Never overlap renewals: each one compares against the value the previous one wrote.
    if (state.lost || state.renewal !== null) return;
    state.renewal = renew().finally(() => {
      state.renewal = null;
    });
  }, renewMs);
  timer.unref();

  try {
    return await fn(lease);
  } finally {
    clearInterval(timer);
    if (state.renewal !== null) await state.renewal;
    if (!state.lost) {
      await prisma.$executeRaw`
        UPDATE "automaton_program_settings"
        SET "turn_step_lease_until" = NULL
        WHERE "id" = ${PROGRAM_SETTINGS_ID} AND "turn_step_lease_until" = ${state.current}`;
    }
  }
}

