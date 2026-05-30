import { loadEnvConfig, _resetConfigForTesting } from '../src/config/env';

// Save original env so we can restore after each test
const originalEnv = process.env;

let mockExit: jest.SpiedFunction<typeof process.exit>;
let mockStderr: jest.SpiedFunction<typeof process.stderr.write>;

beforeEach(() => {
  process.env = { ...originalEnv };
  _resetConfigForTesting();
  mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called');
  }) as never);
  mockStderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  mockExit.mockRestore();
  mockStderr.mockRestore();
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Cron expression validation at startup (R8.1)', () => {
  test('should succeed with valid default cron expressions', () => {
    process.env.NODE_ENV = 'development';

    const config = loadEnvConfig();

    expect(config.leagueSchedule).toBe('0 8 * * *');
    expect(config.settlementSchedule).toBe('0 0 * * *');
    expect(mockExit).not.toHaveBeenCalled();
  });

  test('should fail startup when LEAGUE_SCHEDULE has an invalid cron expression', () => {
    process.env.NODE_ENV = 'development';
    process.env.LEAGUE_SCHEDULE = 'not-a-cron';

    expect(() => loadEnvConfig()).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockStderr).toHaveBeenCalledWith(
      expect.stringContaining('LEAGUE_SCHEDULE'),
    );
    expect(mockStderr).toHaveBeenCalledWith(
      expect.stringContaining('not-a-cron'),
    );
  });

  test('should fail startup when SETTLEMENT_SCHEDULE has an invalid cron expression', () => {
    process.env.NODE_ENV = 'development';
    process.env.SETTLEMENT_SCHEDULE = '99 99 99 99 99';

    expect(() => loadEnvConfig()).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockStderr).toHaveBeenCalledWith(
      expect.stringContaining('SETTLEMENT_SCHEDULE'),
    );
  });

  test('should fail startup when TEAM_2V2_LEAGUE_SCHEDULE has an invalid cron expression', () => {
    process.env.NODE_ENV = 'development';
    process.env.TEAM_2V2_LEAGUE_SCHEDULE = 'invalid';

    expect(() => loadEnvConfig()).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockStderr).toHaveBeenCalledWith(
      expect.stringContaining('TEAM_2V2_LEAGUE_SCHEDULE'),
    );
  });

  test('should fail startup when GRAND_MELEE_SCHEDULE has an invalid cron expression', () => {
    process.env.NODE_ENV = 'development';
    process.env.GRAND_MELEE_SCHEDULE = '* * *';

    expect(() => loadEnvConfig()).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockStderr).toHaveBeenCalledWith(
      expect.stringContaining('GRAND_MELEE_SCHEDULE'),
    );
  });

  test('should fail startup when DAILY_REPORT_SCHEDULE has an invalid cron expression', () => {
    process.env.NODE_ENV = 'development';
    process.env.DAILY_REPORT_SCHEDULE = 'abc def ghi';

    expect(() => loadEnvConfig()).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockStderr).toHaveBeenCalledWith(
      expect.stringContaining('DAILY_REPORT_SCHEDULE'),
    );
  });

  test('should succeed with valid overridden cron expressions', () => {
    process.env.NODE_ENV = 'development';
    process.env.LEAGUE_SCHEDULE = '0 20 * * *';
    process.env.KOTH_SCHEDULE = '0 16 * * 1,3,5';
    process.env.TAGTEAM_SCHEDULE = '*/30 * * * *';

    const config = loadEnvConfig();

    expect(config.leagueSchedule).toBe('0 20 * * *');
    expect(config.kothSchedule).toBe('0 16 * * 1,3,5');
    expect(config.tagTeamSchedule).toBe('*/30 * * * *');
    expect(mockExit).not.toHaveBeenCalled();
  });

  test('should identify the first offending env var in the error message', () => {
    process.env.NODE_ENV = 'development';
    process.env.TOURNAMENT_SCHEDULE = 'bad-cron';

    expect(() => loadEnvConfig()).toThrow('process.exit called');
    expect(mockStderr).toHaveBeenCalledWith(
      expect.stringContaining('TOURNAMENT_SCHEDULE'),
    );
    expect(mockStderr).toHaveBeenCalledWith(
      expect.stringContaining('"bad-cron"'),
    );
  });
});
