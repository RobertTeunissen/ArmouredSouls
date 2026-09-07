import type { ModerationAvailabilityStatus } from '../contentModerationService';
import {
  shouldInitializeModeration,
  startModerationLifecycle,
} from '../moderationLifecycle';

interface MockModerationService {
  initialize: jest.Mock<Promise<void>, []>;
  disable: jest.Mock<void, []>;
  getAvailability: jest.Mock<{ status: ModerationAvailabilityStatus }, []>;
}

interface MockLogger {
  error: jest.Mock<void, [string, unknown?]>;
  info: jest.Mock<void, [string]>;
}

function createService(
  initialStatus: ModerationAvailabilityStatus = 'unavailable',
): { service: MockModerationService; setStatus: (status: ModerationAvailabilityStatus) => void } {
  let status = initialStatus;
  const service: MockModerationService = {
    initialize: jest.fn<Promise<void>, []>(),
    disable: jest.fn<void, []>(),
    getAvailability: jest.fn(() => ({ status })),
  };

  return {
    service,
    setStatus: (nextStatus: ModerationAvailabilityStatus): void => {
      status = nextStatus;
    },
  };
}

function createLogger(): MockLogger {
  return {
    error: jest.fn<void, [string, unknown?]>(),
    info: jest.fn<void, [string]>(),
  };
}

async function settleAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('moderation lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should automatically enable moderation for acceptance and production', () => {
    expect(shouldInitializeModeration({ nodeEnv: 'acceptance', enableModeration: false })).toBe(true);
    expect(shouldInitializeModeration({ nodeEnv: 'production', enableModeration: false })).toBe(true);
    expect(shouldInitializeModeration({ nodeEnv: 'development', enableModeration: false })).toBe(false);
    expect(shouldInitializeModeration({ nodeEnv: 'test', enableModeration: true })).toBe(true);
  });

  it('should disable moderation without initializing or scheduling recovery when disabled', () => {
    const { service } = createService();
    const logger = createLogger();

    const lifecycle = startModerationLifecycle({
      enabled: false,
      service,
      logger,
      retryIntervalMs: 1_000,
    });

    jest.advanceTimersByTime(10_000);

    expect(service.disable).toHaveBeenCalledTimes(1);
    expect(service.initialize).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('fail-closed'));

    lifecycle.stop();
  });

  it('should stop automatic recovery after the configured failed-attempt limit', async () => {
    const { service } = createService();
    const logger = createLogger();
    service.initialize.mockRejectedValue(new Error('native model incompatible'));

    const lifecycle = startModerationLifecycle({
      enabled: true,
      service,
      logger,
      retryIntervalMs: 1_000,
      maxInitializationAttempts: 3,
    });

    await settleAsyncWork();
    jest.advanceTimersByTime(1_000);
    await settleAsyncWork();
    jest.advanceTimersByTime(1_000);
    await settleAsyncWork();
    jest.advanceTimersByTime(10_000);
    await settleAsyncWork();

    expect(service.initialize).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenLastCalledWith(
      expect.stringContaining('automatic recovery stopped'),
      expect.any(Error),
    );

    lifecycle.stop();
  });

  it('should never overlap an unresolved model initialization attempt', async () => {
    const { service } = createService();
    const logger = createLogger();
    let rejectInitialization: (reason: Error) => void = () => undefined;
    service.initialize.mockImplementation(() => new Promise<void>((_resolve, reject) => {
      rejectInitialization = reject;
    }));

    const lifecycle = startModerationLifecycle({
      enabled: true,
      service,
      logger,
      retryIntervalMs: 1_000,
      maxInitializationAttempts: 3,
    });

    jest.advanceTimersByTime(5_000);
    expect(service.initialize).toHaveBeenCalledTimes(1);

    rejectInitialization(new Error('load failed'));
    await settleAsyncWork();
    jest.advanceTimersByTime(1_000);
    await settleAsyncWork();

    expect(service.initialize).toHaveBeenCalledTimes(2);

    lifecycle.stop();
  });

  it('should reset its failure budget after a successful recovery and stop cleanly', async () => {
    const { service, setStatus } = createService();
    const logger = createLogger();
    service.initialize
      .mockImplementationOnce(async () => {
        setStatus('ready');
      })
      .mockRejectedValue(new Error('later failure'));

    const lifecycle = startModerationLifecycle({
      enabled: true,
      service,
      logger,
      retryIntervalMs: 1_000,
      maxInitializationAttempts: 2,
    });

    await settleAsyncWork();
    setStatus('unavailable');
    jest.advanceTimersByTime(1_000);
    await settleAsyncWork();
    jest.advanceTimersByTime(1_000);
    await settleAsyncWork();

    expect(service.initialize).toHaveBeenCalledTimes(3);

    lifecycle.stop();
    jest.advanceTimersByTime(10_000);
    expect(service.initialize).toHaveBeenCalledTimes(3);
  });
});
