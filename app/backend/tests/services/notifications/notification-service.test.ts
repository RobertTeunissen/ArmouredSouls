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
 * Unit tests for buildSuccessMessage — team tournament Discord webhook messages.
 *
 * Validates: Requirements R12.1, R12.3
 */
describe('buildSuccessMessage — team tournament cases', () => {
  const APP_BASE_URL = 'https://armouredsouls.com';

  describe('team2v2Tournament', () => {
    it('should produce round completion message with type label, round, and matches count', () => {
      const context: JobContext = {
        jobName: 'team2v2Tournament',
        matchesCompleted: 4,
        tournamentRound: 2,
        tournamentMaxRounds: 3,
      };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBe(
        `⚔️ 2v2 Tournament: Round 2/3 — 4 matches. [View](${APP_BASE_URL}/tournaments)`
      );
    });

    it('should include tournament type label "2v2" in the message', () => {
      const context: JobContext = {
        jobName: 'team2v2Tournament',
        matchesCompleted: 1,
        tournamentRound: 1,
        tournamentMaxRounds: 4,
      };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toContain('2v2 Tournament');
    });

    it('should produce tournament creation message when tournamentScheduled is true', () => {
      const context: JobContext = {
        jobName: 'team2v2Tournament',
        tournamentScheduled: true,
        tournamentName: '2v2 Tournament #5',
      };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBe(
        `⚔️ 2v2 Tournament: 2v2 Tournament #5 has been created! [View](${APP_BASE_URL}/tournaments)`
      );
    });

    it('should return null when matchesCompleted = 0', () => {
      const context: JobContext = {
        jobName: 'team2v2Tournament',
        matchesCompleted: 0,
        tournamentRound: 1,
        tournamentMaxRounds: 3,
      };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBeNull();
    });

    it('should return null when matchesCompleted is undefined', () => {
      const context: JobContext = { jobName: 'team2v2Tournament' };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBeNull();
    });
  });

  describe('team3v3Tournament', () => {
    it('should produce round completion message with type label, round, and matches count', () => {
      const context: JobContext = {
        jobName: 'team3v3Tournament',
        matchesCompleted: 2,
        tournamentRound: 3,
        tournamentMaxRounds: 4,
      };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBe(
        `⚔️ 3v3 Tournament: Round 3/4 — 2 matches. [View](${APP_BASE_URL}/tournaments)`
      );
    });

    it('should include tournament type label "3v3" in the message', () => {
      const context: JobContext = {
        jobName: 'team3v3Tournament',
        matchesCompleted: 3,
        tournamentRound: 1,
        tournamentMaxRounds: 5,
      };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toContain('3v3 Tournament');
    });

    it('should produce tournament creation message when tournamentScheduled is true', () => {
      const context: JobContext = {
        jobName: 'team3v3Tournament',
        tournamentScheduled: true,
        tournamentName: '3v3 Tournament #2',
      };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBe(
        `⚔️ 3v3 Tournament: 3v3 Tournament #2 has been created! [View](${APP_BASE_URL}/tournaments)`
      );
    });

    it('should return null when matchesCompleted = 0', () => {
      const context: JobContext = {
        jobName: 'team3v3Tournament',
        matchesCompleted: 0,
        tournamentRound: 2,
        tournamentMaxRounds: 4,
      };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBeNull();
    });

    it('should return null when matchesCompleted is undefined', () => {
      const context: JobContext = { jobName: 'team3v3Tournament' };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBeNull();
    });
  });
});

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
