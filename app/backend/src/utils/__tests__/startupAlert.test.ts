import { sendStartupFailureAlert, STARTUP_ALERT_REPEAT_MS, type StartupAlertStore } from '../startupAlert';

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

/** In-memory stand-in for the temp-file state, so the test writes nothing to disk. */
function memoryStore(initial: string | null = null): StartupAlertStore & { content: string | null } {
  const store = {
    content: initial,
    read: (): string | null => store.content,
    write: (content: string): void => { store.content = content; },
  };
  return store;
}

const FAILURE = '🚨 STARTUP FAILED: Missing modules: [x]. Server did not start.';

describe('sendStartupFailureAlert', () => {
  it('sends the first alert and remembers it', async () => {
    const store = memoryStore();
    const send = jest.fn().mockResolvedValue(true);

    await expect(sendStartupFailureAlert(FAILURE, { store, send, now: () => 1_000 })).resolves.toBe(true);

    expect(send).toHaveBeenCalledWith(FAILURE);
    expect(JSON.parse(store.content ?? '')).toEqual({ message: FAILURE, sentAt: 1_000 });
  });

  it('sends one alert for a burst of PM2 restarts with the same failure', async () => {
    const store = memoryStore();
    const send = jest.fn().mockResolvedValue(true);

    for (let restart = 0; restart < 10; restart++) {
      await sendStartupFailureAlert(FAILURE, { store, send, now: () => 1_000 + restart * 5_000 });
    }

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends the same failure again once the window has passed', async () => {
    const store = memoryStore(JSON.stringify({ message: FAILURE, sentAt: 0 }));
    const send = jest.fn().mockResolvedValue(true);

    await expect(sendStartupFailureAlert(FAILURE, { store, send, now: () => STARTUP_ALERT_REPEAT_MS })).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends a different failure at once', async () => {
    const store = memoryStore(JSON.stringify({ message: FAILURE, sentAt: 0 }));
    const send = jest.fn().mockResolvedValue(true);

    await sendStartupFailureAlert('🚨 STARTUP FAILED: something else', { store, send, now: () => 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not remember an alert that failed to send, so the next restart retries', async () => {
    const store = memoryStore();
    const send = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await sendStartupFailureAlert(FAILURE, { store, send, now: () => 1 });
    await sendStartupFailureAlert(FAILURE, { store, send, now: () => 2 });

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('sends when the state cannot be read or is garbled, and survives a failed write', async () => {
    const send = jest.fn().mockResolvedValue(true);
    const unreadable: StartupAlertStore = {
      read: () => { throw new Error('EACCES'); },
      write: () => { throw new Error('EROFS'); },
    };

    await expect(sendStartupFailureAlert(FAILURE, { store: unreadable, send, now: () => 1 })).resolves.toBe(true);
    await expect(sendStartupFailureAlert(FAILURE, { store: memoryStore('not json'), send, now: () => 1 })).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
