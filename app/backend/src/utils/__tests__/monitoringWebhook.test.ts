import { DISCORD_CONTENT_LIMIT, fitDiscordContent, sendMonitoringAlert } from '../monitoringWebhook';

// Mock logger
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('sendMonitoringAlert', () => {
  const originalEnv = process.env;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.MONITORING_DISCORD_WEBHOOK;
    delete process.env.DISCORD_WEBHOOK_URL;

    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('should send to MONITORING_DISCORD_WEBHOOK when set', async () => {
    process.env.MONITORING_DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/monitoring';
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });

    const result = await sendMonitoringAlert('Test alert');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/monitoring',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test alert' }),
      })
    );
  });

  it('never sends ops alerts to the player-facing DISCORD_WEBHOOK_URL', async () => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/game';

    const result = await sendMonitoringAlert('Ops alert');

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('cuts content over the 2000-character Discord limit instead of having it rejected', async () => {
    process.env.MONITORING_DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/monitoring';
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });

    await sendMonitoringAlert(`🚨${'x'.repeat(3000)}`);

    const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body) as { content: string };
    expect(Array.from(body.content)).toHaveLength(DISCORD_CONTENT_LIMIT);
    expect(body.content.startsWith('🚨')).toBe(true);
    expect(body.content.endsWith('…')).toBe(true);
  });

  it('leaves content within the limit unchanged', () => {
    const message = 'y'.repeat(DISCORD_CONTENT_LIMIT);
    expect(fitDiscordContent(message)).toBe(message);
  });

  it('should return false and log when neither webhook is set', async () => {
    const result = await sendMonitoringAlert('No webhook alert');

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return false on fetch timeout', async () => {
    process.env.MONITORING_DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/test';
    mockFetch.mockImplementation(() => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    const result = await sendMonitoringAlert('Timeout alert');

    expect(result).toBe(false);
  });

  it('should return false on non-2xx response', async () => {
    process.env.MONITORING_DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/test';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    });

    const result = await sendMonitoringAlert('Rate limited alert');

    expect(result).toBe(false);
  });

  it('should never throw regardless of error type', async () => {
    process.env.MONITORING_DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/test';
    mockFetch.mockRejectedValue(new TypeError('Network error'));

    const result = await sendMonitoringAlert('Network error alert');

    expect(result).toBe(false);
    // No exception thrown — test passes if we reach here
  });

  it('should use MONITORING_DISCORD_WEBHOOK when both webhooks are set', async () => {
    process.env.MONITORING_DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/monitoring';
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/game';
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });

    await sendMonitoringAlert('Priority test');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/monitoring',
      expect.anything()
    );
  });
});
