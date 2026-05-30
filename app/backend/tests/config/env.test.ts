/**
 * Unit tests for environment configuration defaults (Spec 36).
 *
 * Asserts all env defaults match the documented slot map (R1.1)
 * and that the EnvConfig interface exposes the new schedule fields (R1.3, R1.4).
 *
 * _Requirements: R1.1, R1.3, R1.4_
 */

import { loadEnvConfig, _resetConfigForTesting } from '../../src/config/env';

const originalEnv = process.env;

let mockExit: jest.SpiedFunction<typeof process.exit>;
let mockStderr: jest.SpiedFunction<typeof process.stderr.write>;

beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: 'development' };
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

describe('Env defaults match documented slot map (R1.1)', () => {
  test('LEAGUE_SCHEDULE defaults to 0 8 * * * (08:00 UTC)', () => {
    const config = loadEnvConfig();
    expect(config.leagueSchedule).toBe('0 8 * * *');
  });

  test('TOURNAMENT_SCHEDULE defaults to 0 10 * * * (10:00 UTC)', () => {
    const config = loadEnvConfig();
    expect(config.tournamentSchedule).toBe('0 10 * * *');
  });

  test('TAGTEAM_SCHEDULE defaults to 0 11 * * * (11:00 UTC)', () => {
    const config = loadEnvConfig();
    expect(config.tagTeamSchedule).toBe('0 11 * * *');
  });

  test('KOTH_SCHEDULE defaults to 0 13 * * * (13:00 UTC)', () => {
    const config = loadEnvConfig();
    expect(config.kothSchedule).toBe('0 13 * * *');
  });

  test('SETTLEMENT_SCHEDULE defaults to 0 0 * * * (00:00 UTC)', () => {
    const config = loadEnvConfig();
    expect(config.settlementSchedule).toBe('0 0 * * *');
  });

  test('DAILY_REPORT_SCHEDULE defaults to 30 0 * * * (00:30 UTC)', () => {
    const config = loadEnvConfig();
    expect(config.dailyReportSchedule).toBe('30 0 * * *');
  });

  test('TEAM_2V2_LEAGUE_SCHEDULE defaults to 0 9 * * * (09:00 UTC)', () => {
    const config = loadEnvConfig();
    expect(config.team2v2LeagueSchedule).toBe('0 9 * * *');
  });

  test('TEAM_3V3_LEAGUE_SCHEDULE defaults to 0 14 * * * (14:00 UTC)', () => {
    const config = loadEnvConfig();
    expect(config.team3v3LeagueSchedule).toBe('0 14 * * *');
  });

  test('TEAM_2V2_TOURNAMENT_SCHEDULE defaults to 0 15 * * * (15:00 UTC)', () => {
    const config = loadEnvConfig();
    expect(config.team2v2TournamentSchedule).toBe('0 15 * * *');
  });

  test('TEAM_3V3_TOURNAMENT_SCHEDULE defaults to 0 18 * * * (18:00 UTC)', () => {
    const config = loadEnvConfig();
    expect(config.team3v3TournamentSchedule).toBe('0 18 * * *');
  });

  test('GRAND_MELEE_SCHEDULE defaults to 0 17 * * * (17:00 UTC)', () => {
    const config = loadEnvConfig();
    expect(config.grandMeleeSchedule).toBe('0 17 * * *');
  });
});

describe('Env overrides are respected (R1.5)', () => {
  test('should use overridden LEAGUE_SCHEDULE value', () => {
    process.env.LEAGUE_SCHEDULE = '0 20 * * *';
    const config = loadEnvConfig();
    expect(config.leagueSchedule).toBe('0 20 * * *');
  });

  test('should use overridden KOTH_SCHEDULE value', () => {
    process.env.KOTH_SCHEDULE = '0 16 * * 1,3,5';
    const config = loadEnvConfig();
    expect(config.kothSchedule).toBe('0 16 * * 1,3,5');
  });

  test('should use overridden GRAND_MELEE_SCHEDULE value', () => {
    process.env.GRAND_MELEE_SCHEDULE = '0 19 * * *';
    const config = loadEnvConfig();
    expect(config.grandMeleeSchedule).toBe('0 19 * * *');
  });
});

describe('All 5 new schedule fields are exposed on EnvConfig (R1.3, R1.4)', () => {
  test('config object has all new schedule fields', () => {
    const config = loadEnvConfig();
    expect(config).toHaveProperty('team2v2LeagueSchedule');
    expect(config).toHaveProperty('team3v3LeagueSchedule');
    expect(config).toHaveProperty('team2v2TournamentSchedule');
    expect(config).toHaveProperty('team3v3TournamentSchedule');
    expect(config).toHaveProperty('grandMeleeSchedule');
  });
});
