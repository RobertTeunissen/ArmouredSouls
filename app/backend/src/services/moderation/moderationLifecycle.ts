import type { EnvConfig } from '../../config/env';
import type { ModerationAvailabilityStatus } from './contentModerationService';

const DEFAULT_RECOVERY_INTERVAL_MS = 60_000;
const DEFAULT_MAX_INITIALIZATION_ATTEMPTS = 3;

interface ModerationService {
  initialize(): Promise<void>;
  disable(): void;
  getAvailability(): { status: ModerationAvailabilityStatus };
}

interface ModerationLogger {
  error(message: string, error?: unknown): void;
  info(message: string): void;
}

export interface ModerationLifecycleOptions {
  enabled: boolean;
  service: ModerationService;
  logger: ModerationLogger;
  retryIntervalMs?: number;
  maxInitializationAttempts?: number;
}

export interface ModerationLifecycle {
  stop(): void;
}

/**
 * Production and acceptance always enable moderation; development and test
 * environments require an explicit opt-in. Disabled moderation remains fail-closed
 * in the upload path.
 */
export function shouldInitializeModeration(
  config: Pick<EnvConfig, 'nodeEnv' | 'enableModeration'>,
): boolean {
  return config.nodeEnv === 'production'
    || config.nodeEnv === 'acceptance'
    || config.enableModeration;
}

/**
 * Starts fail-closed moderation with bounded recovery from model-load failures.
 * A permanently incompatible native model therefore cannot retry indefinitely.
 */
export function startModerationLifecycle(
  options: ModerationLifecycleOptions,
): ModerationLifecycle {
  const retryIntervalMs = options.retryIntervalMs ?? DEFAULT_RECOVERY_INTERVAL_MS;
  const maxInitializationAttempts = options.maxInitializationAttempts
    ?? DEFAULT_MAX_INITIALIZATION_ATTEMPTS;

  let stopped = false;
  let attemptInFlight = false;
  let consecutiveAttempts = 0;
  let recoveryTimer: ReturnType<typeof setInterval> | null = null;

  const stop = (): void => {
    stopped = true;
    if (recoveryTimer) {
      clearInterval(recoveryTimer);
      recoveryTimer = null;
    }
  };

  if (!options.enabled) {
    options.service.disable();
    options.logger.info(
      'Content moderation disabled by configuration; custom image uploads remain unavailable (fail-closed)',
    );
    return { stop };
  }

  const attemptInitialization = (): void => {
    if (
      stopped
      || attemptInFlight
      || consecutiveAttempts >= maxInitializationAttempts
    ) {
      return;
    }

    attemptInFlight = true;
    consecutiveAttempts += 1;

    void options.service.initialize().then(
      () => {
        attemptInFlight = false;
        if (options.service.getAvailability().status === 'ready') {
          consecutiveAttempts = 0;
        }
      },
      (error: unknown) => {
        attemptInFlight = false;
        if (consecutiveAttempts >= maxInitializationAttempts) {
          options.logger.error(
            `Content moderation initialization failed ${consecutiveAttempts} times; automatic recovery stopped`,
            error,
          );
          stop();
          return;
        }
        options.logger.error(
          `Content moderation initialization failed; retrying automatically (${consecutiveAttempts}/${maxInitializationAttempts})`,
          error,
        );
      },
    );
  };

  attemptInitialization();
  recoveryTimer = setInterval(() => {
    if (options.service.getAvailability().status === 'unavailable') {
      attemptInitialization();
    }
  }, retryIntervalMs);
  recoveryTimer.unref();

  return { stop };
}
