/**
 * When the cycle scheduler next runs a job, from configuration only.
 *
 * The Automaton Turn_Step runs inside the settlement job and holds the
 * scheduler's job mutex, so it must stop starting turns before the next job
 * is due (plan.md "DESIGN (Part B)" D1; supersedes spec 55 R7.10).
 *
 * A leaf module, like `schedulerJobNames.ts`: it reads the same EnvConfig
 * schedules `src/index.ts` passes to `initScheduler` instead of scheduler
 * state, so the automaton module never imports `cycleScheduler.ts` and its
 * orchestrator graph. The scheduler is initialised exactly when
 * `schedulerEnabled` is true, so the two cannot disagree.
 */
import logger from '../../config/logger';
import type { EnvConfig } from '../../config/env';
import { getNextCronOccurrence } from '../../utils/scheduleUtils';
import type { SchedulerJobName } from './schedulerJobNames';

/** The EnvConfig fields this module reads. */
export type SchedulerWindowConfig = Pick<
  EnvConfig,
  | 'schedulerEnabled'
  | 'leagueSchedule'
  | 'team2v2LeagueSchedule'
  | 'tournamentSchedule'
  | 'tagTeamSchedule'
  | 'kothSchedule'
  | 'team3v3LeagueSchedule'
  | 'team2v2TournamentSchedule'
  | 'grandMeleeSchedule'
  | 'team3v3TournamentSchedule'
  | 'settlementSchedule'
>;

export interface SchedulerJobSchedule {
  job: SchedulerJobName;
  schedule: string;
}

/** The ten cycle-scheduler job schedules (the ones `initScheduler` receives). */
export function schedulerJobSchedules(config: SchedulerWindowConfig): SchedulerJobSchedule[] {
  return [
    { job: 'league', schedule: config.leagueSchedule },
    { job: 'team2v2League', schedule: config.team2v2LeagueSchedule },
    { job: 'tournament', schedule: config.tournamentSchedule },
    { job: 'tagTeam', schedule: config.tagTeamSchedule },
    { job: 'koth', schedule: config.kothSchedule },
    { job: 'team3v3League', schedule: config.team3v3LeagueSchedule },
    { job: 'team2v2Tournament', schedule: config.team2v2TournamentSchedule },
    { job: 'grandMelee', schedule: config.grandMeleeSchedule },
    { job: 'team3v3Tournament', schedule: config.team3v3TournamentSchedule },
    { job: 'settlement', schedule: config.settlementSchedule },
  ];
}

const PLAIN_INTEGER = /^\d+$/;

/** Whether the minute and hour fields are plain integers (`getNextCronOccurrence` can read them). */
function hasFixedTimeOfDay(schedule: string): boolean {
  const [minute, hour] = schedule.trim().split(/\s+/);
  return minute !== undefined && hour !== undefined && PLAIN_INTEGER.test(minute) && PLAIN_INTEGER.test(hour);
}

/**
 * Epoch ms of the next scheduled cycle-scheduler job after `nowMs`, or null
 * when the scheduler is disabled or no schedule has a fixed time of day.
 *
 * Every schedule is treated as daily: a day-of-week or day-of-month
 * restriction is ignored, which can only make the answer earlier
 * (conservative). Schedules whose minute or hour field is not a plain
 * integer are skipped with one warning.
 */
export function nextScheduledJobRunAt(config: SchedulerWindowConfig, nowMs: number): number | null {
  if (!config.schedulerEnabled) return null;
  const now = new Date(nowMs);
  const skipped: string[] = [];
  let next: number | null = null;
  for (const { job, schedule } of schedulerJobSchedules(config)) {
    if (!hasFixedTimeOfDay(schedule)) {
      skipped.push(`${job} "${schedule}"`);
      continue;
    }
    const at = getNextCronOccurrence(schedule, now).getTime();
    if (next === null || at < next) next = at;
  }
  if (skipped.length > 0) {
    logger.warn(`[scheduler-window] schedules without a fixed time of day are ignored for the Turn_Step deadline: ${skipped.join(', ')}`);
  }
  return next;
}
