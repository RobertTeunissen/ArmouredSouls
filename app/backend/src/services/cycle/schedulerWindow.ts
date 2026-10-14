/**
 * When the cycle scheduler next runs a job, from configuration only.
 *
 * The Automaton Turn_Step runs inside the settlement job and holds the
 * scheduler's job mutex, so it must stop starting turns before the next job
 * is due (docs/implementation_notes/AUTOMATON_TURN_STEP_DEADLINE.md,
 * "Deadline"; supersedes spec 55 R7.10).
 *
 * A leaf module, like `schedulerJobNames.ts`: it reads the same EnvConfig
 * schedules `src/index.ts` passes to `initScheduler` instead of scheduler
 * state, so the automaton module never imports `cycleScheduler.ts` and its
 * orchestrator graph. The scheduler is initialised exactly when
 * `schedulerEnabled` is true, so the two cannot disagree.
 */
import cron from 'node-cron';
import logger from '../../config/logger';
import type { EnvConfig } from '../../config/env';
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

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Epoch ms of the next UTC minute strictly after `nowMs` whose hour and
 * minute both match. Uses node-cron's own parser, so every form the
 * scheduler accepts (`*`, steps, ranges, lists) is handled exactly.
 */
function nextTimeOfDayMatch(schedule: string, nowMs: number): number | null {
  const { minute, hour } = cron.parse(schedule);
  const dayStart = Math.floor(nowMs / DAY_MS) * DAY_MS;
  let next: number | null = null;
  for (const h of hour) {
    for (const m of minute) {
      let at = dayStart + h * 60 * MINUTE_MS + m * MINUTE_MS;
      if (at <= nowMs) at += DAY_MS;
      if (next === null || at < next) next = at;
    }
  }
  return next;
}

/**
 * Epoch ms of the next scheduled cycle-scheduler job after `nowMs`, or null
 * when the scheduler is disabled or no schedule parses.
 *
 * Every schedule is treated as daily: seconds and day-of-week, day-of-month
 * and month restrictions are ignored, which can only make the answer earlier
 * (conservative). A schedule that does not parse is skipped with a warning;
 * `env.ts` validates schedules at startup, so that should not happen.
 */
export function nextScheduledJobRunAt(config: SchedulerWindowConfig, nowMs: number): number | null {
  if (!config.schedulerEnabled) return null;
  const skipped: string[] = [];
  let next: number | null = null;
  for (const { job, schedule } of schedulerJobSchedules(config)) {
    let at: number | null;
    try {
      at = nextTimeOfDayMatch(schedule, nowMs);
    } catch {
      at = null;
    }
    if (at === null) {
      skipped.push(`${job} "${schedule}"`);
      continue;
    }
    if (next === null || at < next) next = at;
  }
  if (skipped.length > 0) {
    logger.warn(`[scheduler-window] unparseable schedules ignored for the Turn_Step deadline: ${skipped.join(', ')}`);
  }
  return next;
}
