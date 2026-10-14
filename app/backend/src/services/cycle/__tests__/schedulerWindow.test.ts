/**
 * `nextScheduledJobRunAt` (schedulerWindow.ts): the next cycle-scheduler job
 * the Automaton Turn_Step deadline stops before (plan.md D1).
 */
import logger from '../../../config/logger';
import { nextScheduledJobRunAt, schedulerJobSchedules, type SchedulerWindowConfig } from '../schedulerWindow';

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockWarn = logger.warn as jest.MockedFunction<typeof logger.warn>;

/** The env.ts defaults (the same on ACC and PRD). */
const DEFAULTS: SchedulerWindowConfig = {
  schedulerEnabled: true,
  leagueSchedule: '0 8 * * *',
  team2v2LeagueSchedule: '0 9 * * *',
  tournamentSchedule: '0 10 * * *',
  tagTeamSchedule: '0 11 * * *',
  kothSchedule: '0 13 * * *',
  team3v3LeagueSchedule: '0 14 * * *',
  team2v2TournamentSchedule: '0 15 * * *',
  grandMeleeSchedule: '0 17 * * *',
  team3v3TournamentSchedule: '0 18 * * *',
  settlementSchedule: '0 0 * * *',
};

const at = (iso: string): number => new Date(iso).getTime();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('schedulerJobSchedules', () => {
  it('lists the ten scheduler jobs', () => {
    expect(schedulerJobSchedules(DEFAULTS).map((s) => s.job).sort()).toEqual([
      'grandMelee', 'koth', 'league', 'settlement', 'tagTeam', 'team2v2League',
      'team2v2Tournament', 'team3v3League', 'team3v3Tournament', 'tournament',
    ]);
  });
});

describe('nextScheduledJobRunAt', () => {
  it('returns null when the scheduler is disabled', () => {
    expect(nextScheduledJobRunAt({ ...DEFAULTS, schedulerEnabled: false }, at('2026-10-20T00:05:00Z'))).toBeNull();
  });

  it('after the 00:00 settlement the next job is the 08:00 league job', () => {
    expect(nextScheduledJobRunAt(DEFAULTS, at('2026-10-20T00:05:00Z'))).toBe(at('2026-10-20T08:00:00Z'));
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('at 08:30 the next job is the 09:00 2v2 league job', () => {
    expect(nextScheduledJobRunAt(DEFAULTS, at('2026-10-20T08:30:00Z'))).toBe(at('2026-10-20T09:00:00Z'));
  });

  it('at 23:30 the next job is the settlement at 00:00 the next day', () => {
    expect(nextScheduledJobRunAt(DEFAULTS, at('2026-10-20T23:30:00Z'))).toBe(at('2026-10-21T00:00:00Z'));
  });

  it('treats a day-of-week schedule as daily (conservative)', () => {
    const config = { ...DEFAULTS, leagueSchedule: '0 20 * * *', team2v2LeagueSchedule: '0 20 * * *', tournamentSchedule: '0 20 * * *',
      tagTeamSchedule: '0 20 * * *', kothSchedule: '0 16 * * 1,3,5', team3v3LeagueSchedule: '0 20 * * *',
      team2v2TournamentSchedule: '0 20 * * *', grandMeleeSchedule: '0 20 * * *', team3v3TournamentSchedule: '0 20 * * *' };
    // 2026-10-20 is a Tuesday; KotH would only run Mon/Wed/Fri, but counts as daily 16:00.
    expect(nextScheduledJobRunAt(config, at('2026-10-20T00:05:00Z'))).toBe(at('2026-10-20T16:00:00Z'));
  });

  it('skips a schedule without a fixed time of day, with one warning', () => {
    const config = { ...DEFAULTS, leagueSchedule: '*/30 * * * *' };
    expect(nextScheduledJobRunAt(config, at('2026-10-20T00:05:00Z'))).toBe(at('2026-10-20T09:00:00Z'));
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0][0]).toContain('league "*/30 * * * *"');
  });

  it('returns null when no schedule has a fixed time of day', () => {
    const every = '*/30 * * * *';
    const config: SchedulerWindowConfig = {
      schedulerEnabled: true,
      leagueSchedule: every, team2v2LeagueSchedule: every, tournamentSchedule: every, tagTeamSchedule: every,
      kothSchedule: every, team3v3LeagueSchedule: every, team2v2TournamentSchedule: every, grandMeleeSchedule: '0 */2 * * *',
      team3v3TournamentSchedule: every, settlementSchedule: '15,45 0 * * *',
    };
    expect(nextScheduledJobRunAt(config, at('2026-10-20T00:05:00Z'))).toBeNull();
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });
});
