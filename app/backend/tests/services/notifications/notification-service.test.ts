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
 * Unit tests for buildSuccessMessage — unified Discord webhook messages.
 *
 * Validates: Requirements R12.1, R12.3
 */
describe('buildSuccessMessage — settlement', () => {
  const APP_BASE_URL = 'https://armouredsouls.com';

  it('should produce settlement message', () => {
    const context: JobContext = { jobName: 'settlement' };
    const result = buildSuccessMessage(context, APP_BASE_URL);

    expect(result).toBe(`💰 Daily settlement complete! Check your income and expenses.\n${APP_BASE_URL}`);
  });
});

describe('buildSuccessMessage — league (1v1)', () => {
  const APP_BASE_URL = 'https://armouredsouls.com';

  it('should produce message with match count when matchesCompleted > 0', () => {
    const context: JobContext = { jobName: 'league', matchesCompleted: 42 };
    const result = buildSuccessMessage(context, APP_BASE_URL);

    expect(result).toBe(`⚔️ 1v1 League: 42 battles completed.\n${APP_BASE_URL}`);
  });

  it('should produce fallback message when matchesCompleted is not set', () => {
    const context: JobContext = { jobName: 'league' };
    const result = buildSuccessMessage(context, APP_BASE_URL);

    expect(result).toBe(`⚔️ 1v1 League battles completed.\n${APP_BASE_URL}`);
  });
});

describe('buildSuccessMessage — tournament (1v1)', () => {
  const APP_BASE_URL = 'https://armouredsouls.com';

  it('should produce creation message when tournamentScheduled is true', () => {
    const context: JobContext = {
      jobName: 'tournament',
      tournamentScheduled: true,
      tournamentName: 'Tournament #8',
    };
    const result = buildSuccessMessage(context, APP_BASE_URL);

    expect(result).toBe(`🏆 1v1 Tournament: Tournament #8 has been created!\n${APP_BASE_URL}/tournaments`);
  });

  it('should produce round completion message with match count', () => {
    const context: JobContext = {
      jobName: 'tournament',
      tournamentName: 'Tournament #8',
      tournamentRound: 2,
      tournamentMaxRounds: 11,
      matchesCompleted: 64,
    };
    const result = buildSuccessMessage(context, APP_BASE_URL);

    expect(result).toBe(`🏆 1v1 Tournament: Tournament #8 — Round 2/11, 64 matches.\n${APP_BASE_URL}/tournaments`);
  });

  it('should produce round completion without count when matchesCompleted is not set', () => {
    const context: JobContext = {
      jobName: 'tournament',
      tournamentName: 'Tournament #8',
      tournamentRound: 2,
      tournamentMaxRounds: 11,
    };
    const result = buildSuccessMessage(context, APP_BASE_URL);

    expect(result).toBe(`🏆 1v1 Tournament: Tournament #8 — Round 2/11 completed.\n${APP_BASE_URL}/tournaments`);
  });
});

describe('buildSuccessMessage — tag-team', () => {
  const APP_BASE_URL = 'https://armouredsouls.com';

  it('should produce message with match count when matchesCompleted > 0', () => {
    const context: JobContext = { jobName: 'tag-team', matchesCompleted: 15 };
    const result = buildSuccessMessage(context, APP_BASE_URL);

    expect(result).toBe(`🤝 Tag Team: 15 battles completed.\n${APP_BASE_URL}/team-battles`);
  });

  it('should produce fallback message when matchesCompleted is not set', () => {
    const context: JobContext = { jobName: 'tag-team' };
    const result = buildSuccessMessage(context, APP_BASE_URL);

    expect(result).toBe(`🤝 Tag Team battles completed.\n${APP_BASE_URL}/team-battles`);
  });
});

describe('buildSuccessMessage — koth', () => {
  const APP_BASE_URL = 'https://armouredsouls.com';

  it('should produce message with match count', () => {
    const context: JobContext = { jobName: 'koth', matchesCompleted: 546 };
    const result = buildSuccessMessage(context, APP_BASE_URL);

    expect(result).toBe(`👑 King of the Hill: 546 matches completed.\n${APP_BASE_URL}`);
  });

  it('should return null when matchesCompleted = 0', () => {
    const context: JobContext = { jobName: 'koth', matchesCompleted: 0 };
    const result = buildSuccessMessage(context, APP_BASE_URL);

    expect(result).toBeNull();
  });

  it('should return null when matchesCompleted is undefined', () => {
    const context: JobContext = { jobName: 'koth' };
    const result = buildSuccessMessage(context, APP_BASE_URL);

    expect(result).toBeNull();
  });
});

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
        `🏆 2v2 Tournament: Round 2/3 — 4 matches.\n${APP_BASE_URL}/tournaments`
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
        `🏆 2v2 Tournament: 2v2 Tournament #5 has been created!\n${APP_BASE_URL}/tournaments`
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
        `🏆 3v3 Tournament: Round 3/4 — 2 matches.\n${APP_BASE_URL}/tournaments`
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
        `🏆 3v3 Tournament: 3v3 Tournament #2 has been created!\n${APP_BASE_URL}/tournaments`
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

describe('buildSuccessMessage — team battle cases', () => {
  const APP_BASE_URL = 'https://armouredsouls.com';

  describe('team2v2League', () => {
    it('should produce correct message with link when matchesCompleted > 0', () => {
      const context: JobContext = { jobName: 'team2v2League', matchesCompleted: 5 };
      const result = buildSuccessMessage(context, APP_BASE_URL);

      expect(result).toBe(
        `⚔️ 2v2 League: 5 team battles completed.\n${APP_BASE_URL}/team-battles`
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
        `⚔️ 3v3 League: 3 team battles completed.\n${APP_BASE_URL}/team-battles`
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
