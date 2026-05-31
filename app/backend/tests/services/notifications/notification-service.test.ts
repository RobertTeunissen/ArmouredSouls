import { buildSuccessMessage } from '../../../src/services/notifications/notification-service';
import { JobContext } from '../../../src/services/notifications/integration';

// Mock logger to prevent console output
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock env config (getConfig is used by getActiveIntegrations, not buildSuccessMessage, but needed for module load)
jest.mock('../../../src/config/env', () => ({
  getConfig: jest.fn(() => ({ discordWebhookUrl: '' })),
}));

/**
 * Unit tests for buildSuccessMessage — team battle Discord webhook messages.
 *
 * Validates: Requirements R11.1a
 */
describe('buildSuccessMessage — team battle cases', () => {
  const APP_BASE_URL = 'https://armouredsouls.com';

  describe('team2v2League', () => {
    it('should produce correct message with link when matchesCompleted > 0', () => {
      const context: JobContext = { jobName: 'team2v2League', matchesCompleted: 5 };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBe(
        `⚔️ 2v2 League: 5 team battles completed. [View results](${APP_BASE_URL}/team-battles)`
      );
    });

    it('should include the correct matchesCompleted count in the message', () => {
      const context: JobContext = { jobName: 'team2v2League', matchesCompleted: 12 };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toContain('12 team battles completed');
    });

    it('should return null when matchesCompleted = 0', () => {
      const context: JobContext = { jobName: 'team2v2League', matchesCompleted: 0 };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBeNull();
    });

    it('should return null when matchesCompleted is undefined', () => {
      const context: JobContext = { jobName: 'team2v2League' };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBeNull();
    });
  });

  describe('team3v3League', () => {
    it('should produce correct message with link when matchesCompleted > 0', () => {
      const context: JobContext = { jobName: 'team3v3League', matchesCompleted: 3 };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBe(
        `⚔️ 3v3 League: 3 team battles completed. [View results](${APP_BASE_URL}/team-battles)`
      );
    });

    it('should include the correct matchesCompleted count in the message', () => {
      const context: JobContext = { jobName: 'team3v3League', matchesCompleted: 8 };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toContain('8 team battles completed');
    });

    it('should return null when matchesCompleted = 0', () => {
      const context: JobContext = { jobName: 'team3v3League', matchesCompleted: 0 };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBeNull();
    });

    it('should return null when matchesCompleted is undefined', () => {
      const context: JobContext = { jobName: 'team3v3League' };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBeNull();
    });
  });
});
