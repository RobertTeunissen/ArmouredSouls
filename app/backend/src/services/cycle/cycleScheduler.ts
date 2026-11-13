import cron, { ScheduledTask } from 'node-cron';
import logger from '../../config/logger';
import { getConfig } from '../../config/env';
import { getNextCronOccurrence } from '../../utils/scheduleUtils';
import { JobContext } from '../notifications/integration';
import { buildSuccessMessage, buildErrorMessage, getActiveIntegrations, dispatchNotification } from '../notifications/notification-service';
import { SCHEDULER_JOB_NAMES } from './schedulerJobNames';
import {
  executeGrandMeleeCycle,
  executeKothCycle,
  executeLeagueCycle,
  executeTagTeamCycle,
  executeTeam2v2LeagueCycle,
  executeTeam2v2TournamentCycle,
  executeTeam3v3LeagueCycle,
  executeTeam3v3TournamentCycle,
  executeTournamentCycle,
} from './cycleEventJobs';
import { executeSettlement } from './cycleSettlementJob';
import { formatProcessMemoryUsage } from '../../utils/process-memory';
import {
  resolveCanonicalCycleIdentity,
} from './canonicalCycleIdentity';
import { markFinished, markRunning, recordQueued } from './schedulerRunStore';
import { SchedulerError, SchedulerErrorCode } from '../../errors/schedulerErrors';
import type { SchedulerJobName, SchedulerRunSummary, SchedulerRunTrigger } from '../../shared/types';


// --- Interfaces ---

export interface SchedulerConfig {
  enabled: boolean;
  leagueSchedule: string;      // cron: default '0 8 * * *'
  tournamentSchedule: string;   // cron: default '0 10 * * *'
  tagTeamSchedule: string;      // cron: default '0 11 * * *'
  settlementSchedule: string;   // cron: default '0 0 * * *'
  kothSchedule: string;          // cron: default '0 13 * * *'
  // Reserved slots for future battle events
  team2v2LeagueSchedule: string;       // cron: default '0 9 * * *'
  team3v3LeagueSchedule: string;       // cron: default '0 14 * * *'
  team2v2TournamentSchedule: string;   // cron: default '0 15 * * *'
  team3v3TournamentSchedule: string;   // cron: default '0 18 * * *'
  grandMeleeSchedule: string;          // cron: default '0 17 * * *'
}

// Re-exported for the many existing importers. The declaration lives in its own
// module so that mocking this one cannot erase it — see schedulerJobNames.ts.
export { SCHEDULER_JOB_NAMES };
export type { SchedulerJobName };

export interface JobState {
  name: SchedulerJobName;
  schedule: string;
  lastRunAt: Date | null;
  lastRunDurationMs: number | null;
  lastRunStatus: 'success' | 'failed' | null;
  lastError: string | null;
  nextRunAt: Date | null;
}

export interface SchedulerState {
  active: boolean;
  runningJob: string | null;
  queue: string[];
  jobs: JobState[];
}

// --- In-memory state ---

let schedulerActive = false;

const jobStates: Map<JobState['name'], JobState> = new Map();
const jobHandlers: Map<JobState['name'], () => Promise<JobContext>> = new Map();

let runningJob: string | null = null;
const jobQueue: string[] = [];
let lockResolve: (() => void) | null = null;

// --- Concurrency lock (in-memory mutex with queue) ---

async function acquireLock(jobName: string): Promise<void> {
  if (runningJob === null) {
    runningJob = jobName;
    return;
  }

  // Another job is running — queue this one and wait
  jobQueue.push(jobName);
  logger.info(`Scheduler: job "${jobName}" queued (waiting for "${runningJob}" to finish)`);

  await new Promise<void>((resolve) => {
    const checkLock = () => {
      const idx = jobQueue.indexOf(jobName);
      if (runningJob === null && idx === 0) {
        jobQueue.shift();
        runningJob = jobName;
        resolve();
      }
    };

    // Store a reference so releaseLock can notify waiters
    const originalRelease = lockResolve;
    lockResolve = () => {
      if (originalRelease) originalRelease();
      checkLock();
    };

    // Check immediately in case lock was released between check and wait
    checkLock();
  });
}

function releaseLock(): void {
  runningJob = null;
  if (lockResolve) {
    const notify = lockResolve;
    lockResolve = null;
    notify();
  }
}

// --- Job runner with concurrency lock, logging, and error handling ---

/**
 * Battle_Event_Jobs — the jobs that schedule or execute battles.
 *
 * Spec #45: every one of these returns early during a Preparation_Phase. The
 * gate lives here rather than in the nine handlers so that adding a tenth
 * battle event cannot accidentally skip it. Infrastructure jobs (settlement,
 * health report, retention, backup) are deliberately absent from this set.
 */
const BATTLE_EVENT_JOBS: ReadonlySet<JobState['name']> = new Set<JobState['name']>([
  'league',
  'tournament',
  'tagTeam',
  'koth',
  'grandMelee',
  'team2v2League',
  'team3v3League',
  'team2v2Tournament',
  'team3v3Tournament',
]);

/** How a run was started, and the history row it already has (manual runs). */
export interface RunJobOptions {
  trigger?: SchedulerRunTrigger;
  triggeredByUserId?: number | null;
  /** A row recorded by the caller (`startManualRun`); otherwise one is recorded here. */
  runId?: number | null;
}

/** The one-line result kept in `scheduler_job_runs.summary`. */
export function toRunSummary(context: JobContext | void | null | undefined): SchedulerRunSummary | null {
  if (!context) return null;
  const summary: SchedulerRunSummary = {};
  if (context.matchesCompleted !== undefined) summary.matchesCompleted = context.matchesCompleted;
  if (context.tournamentName !== undefined) summary.tournamentName = context.tournamentName;
  if (context.tournamentRound !== undefined) summary.tournamentRound = context.tournamentRound;
  if (context.tournamentMaxRounds !== undefined) summary.tournamentMaxRounds = context.tournamentMaxRounds;
  if (context.cycleNumber !== undefined) summary.cycleNumber = context.cycleNumber;
  return Object.keys(summary).length > 0 ? summary : null;
}

export async function runJob(
  jobName: JobState['name'],
  handler: () => Promise<JobContext | void>,
  options: RunJobOptions = {},
): Promise<void> {
  // The history write is started, not awaited, so the lock below is still the
  // first await: it keeps the queue FIFO (see the next comment). It is awaited
  // once the lock is held.
  const runIdPromise: Promise<number | null> = options.runId !== undefined
    ? Promise.resolve(options.runId)
    : recordQueued({ jobName, trigger: options.trigger ?? 'manual', triggeredByUserId: options.triggeredByUserId });

  // The lock is taken first, before any await. Spec #45's preparation gate used to
  // sit above this line and it does an `await import(...)`, so a battle-event job
  // yielded before reaching `acquireLock` and an infrastructure job called later
  // could take the lock ahead of it. That cost the queue its FIFO property, and it
  // also let the skip path below write `jobStates` while another run of the same
  // job held the lock. Both go away by gating under the lock: the gate returns
  // inside the try, so the `finally` releases it.
  await acquireLock(jobName);

  const state = jobStates.get(jobName);
  const startTime = new Date();
  const runId = await runIdPromise;
  await markRunning(runId, startTime);

  try {
    // Spec #45 R3.1–R3.3: suspend every battle event during the preparation
    // window so no player forfeits a battle while rebuilding a stable.
    if (BATTLE_EVENT_JOBS.has(jobName)) {
      // Fail open: if the season state cannot be read, run the job. Suspending
      // every battle event because one read failed would silently stop the game,
      // which is worse than running a cycle during a preparation window.
      let season: { phase: string; seasonNumber: number; preparationDay: number;
        remainingPreparationCycles: number } | null = null;
      try {
        const { getCurrentSeason } = await import('../season/seasonService');
        season = await getCurrentSeason();
      } catch (error) {
        logger.error(
          `Scheduler: could not read season state for "${jobName}" — running anyway. ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (season && season.phase === 'preparation') {
        if (state) {
          state.lastRunAt = startTime;
          state.lastRunDurationMs = 0;
          state.lastRunStatus = 'success';
          state.lastError = null;
        }
        logger.info(
          `Scheduler: job "${jobName}" skipped — season_preparation ` +
          `(Season ${season.seasonNumber}, preparation day ${season.preparationDay}, ` +
          `${season.remainingPreparationCycles} preparation cycle(s) remaining)`,
        );
        await markFinished(runId, {
          status: 'skipped',
          startedAt: startTime,
          finishedAt: new Date(),
          summary: { skippedReason: 'season_preparation' },
        });
        return;
      }
    }

    logger.info(`Scheduler: job "${jobName}" started at ${startTime.toISOString()}`);

    const jobContext = await handler();

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    if (state) {
      state.lastRunAt = startTime;
      state.lastRunDurationMs = durationMs;
      state.lastRunStatus = 'success';
      state.lastError = null;
    }

    logger.info(`Scheduler: job "${jobName}" completed at ${endTime.toISOString()} (duration: ${durationMs}ms)`);
    await markFinished(runId, { status: 'success', startedAt: startTime, finishedAt: endTime, summary: toRunSummary(jobContext) });

    // Structured log entry for telemetry (R7.1)
    logger.info({
      event: 'battle_event_complete',
      eventName: jobName,
      startTimestamp: startTime.toISOString(),
      durationMs,
      matchesProcessed: jobContext?.matchesCompleted ?? 0,
      failures: 0,
    });

    // Dispatch success notification
    try {
      if (jobContext) {
        const appBaseUrl = getConfig().appBaseUrl ?? '';
        const message = buildSuccessMessage(jobContext, appBaseUrl);
        if (message) {
          const integrations = getActiveIntegrations();
          await dispatchNotification(message, integrations);
        }
      }
    } catch (notifyError) {
      logger.error(`Scheduler: notification dispatch failed for "${jobName}" — ${notifyError instanceof Error ? notifyError.message : String(notifyError)}`);
    }
  } catch (error) {
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (state) {
      state.lastRunAt = startTime;
      state.lastRunDurationMs = durationMs;
      state.lastRunStatus = 'failed';
      state.lastError = errorMessage;
    }

    logger.error(`Scheduler: job "${jobName}" failed at ${endTime.toISOString()} (duration: ${durationMs}ms) — ${errorMessage}`);
    await markFinished(runId, { status: 'failed', startedAt: startTime, finishedAt: endTime, error: errorMessage });

    // Structured log entry for telemetry (R7.1, R7.4)
    logger.info({
      event: 'battle_event_complete',
      eventName: jobName,
      startTimestamp: startTime.toISOString(),
      durationMs,
      matchesProcessed: 0,
      failures: 1,
      error: errorMessage,
    });

    // Dispatch error notification
    try {
      const appBaseUrl = getConfig().appBaseUrl ?? '';
      const errorMsg = buildErrorMessage(jobName, appBaseUrl);
      const integrations = getActiveIntegrations();
      await dispatchNotification(errorMsg, integrations);
    } catch (notifyError) {
      logger.error(`Scheduler: error notification dispatch failed for "${jobName}" — ${notifyError instanceof Error ? notifyError.message : String(notifyError)}`);
    }
  } finally {
    releaseLock();
  }
}

// --- Scheduler initialization ---

const scheduledTasks: ScheduledTask[] = [];

/** Resume a durable close marker left behind by an uncatchable process exit. */
export async function resumeInterruptedSettlement(): Promise<boolean> {
  const identity = await resolveCanonicalCycleIdentity();
  if (!identity.isClosing || identity.closingCycle === null) return false;

  logger.warn(
    `Scheduler: resuming interrupted financial cycle ${identity.closingCycle} `
    + `— ${formatProcessMemoryUsage()}`,
  );
  await runJob('settlement', executeSettlement, { trigger: 'resume' });
  return true;
}

/**
 * Register the ten jobs. Their handlers and state are registered whether or
 * not automated scheduling is enabled, so an admin can always run a job by
 * hand (locally and in CI the scheduler is disabled). Only the cron
 * registration depends on `config.enabled`.
 */
export function initScheduler(config: SchedulerConfig): void {
  schedulerActive = config.enabled;

  // Define all 10 jobs in canonical slot map order (R1.1)
  const jobs: Array<{ name: JobState['name']; schedule: string; handler: () => Promise<JobContext> }> = [
    { name: 'league', schedule: config.leagueSchedule, handler: executeLeagueCycle },                           // 08:00
    { name: 'team2v2League', schedule: config.team2v2LeagueSchedule, handler: executeTeam2v2LeagueCycle }, // 09:00
    { name: 'tournament', schedule: config.tournamentSchedule, handler: executeTournamentCycle },                // 10:00
    { name: 'tagTeam', schedule: config.tagTeamSchedule, handler: executeTagTeamCycle },                        // 11:00
    { name: 'koth', schedule: config.kothSchedule, handler: executeKothCycle },                                 // 13:00
    { name: 'team3v3League', schedule: config.team3v3LeagueSchedule, handler: executeTeam3v3LeagueCycle }, // 14:00
    { name: 'team2v2Tournament', schedule: config.team2v2TournamentSchedule, handler: executeTeam2v2TournamentCycle }, // 15:00
    { name: 'grandMelee', schedule: config.grandMeleeSchedule, handler: executeGrandMeleeCycle },         // 17:00
    { name: 'team3v3Tournament', schedule: config.team3v3TournamentSchedule, handler: executeTeam3v3TournamentCycle }, // 18:00
    { name: 'settlement', schedule: config.settlementSchedule, handler: executeSettlement },                     // 00:00
  ];

  for (const job of jobs) {
    // Initialize job state
    jobStates.set(job.name, {
      name: job.name,
      schedule: job.schedule,
      lastRunAt: null,
      lastRunDurationMs: null,
      lastRunStatus: null,
      lastError: null,
      nextRunAt: null,
    });

    // Store handler for manual triggering via triggerJob() / startManualRun()
    jobHandlers.set(job.name, job.handler);

    if (!config.enabled) continue;

    // Register cron job (UTC timezone)
    const task = cron.schedule(job.schedule, () => {
      void runJob(job.name, job.handler, { trigger: 'cron' });
    }, {
      timezone: 'UTC',
      name: job.name,
    });

    scheduledTasks.push(task);

    logger.info(`Scheduler: registered "${job.name}" job with schedule "${job.schedule}" (UTC)`);
  }

  if (config.enabled) {
    logger.info('Scheduler: all 10 jobs registered and active');
  } else {
    logger.info('Scheduler: automated scheduling is disabled (SCHEDULER_ENABLED is not true); jobs can still be run by hand');
  }
}

// --- State query ---

export function getSchedulerState(): SchedulerState {
  // Compute nextRunAt dynamically from each job's cron schedule
  const jobs = Array.from(jobStates.values()).map(job => ({
    ...job,
    nextRunAt: schedulerActive ? getNextCronOccurrence(job.schedule) : null,
  }));

  return {
    active: schedulerActive,
    runningJob,
    queue: [...jobQueue],
    jobs,
  };
}

// --- Manual trigger (same path as cron: repair, execute, notify, track state) ---

/**
 * Trigger a job by name, using the same handler as the cron scheduler.
 * Runs through runJob() so it gets: mutex lock, state tracking, notifications, error handling.
 * Throws if the job name is not registered.
 */
export async function triggerJob(jobName: JobState['name'], triggeredByUserId?: number | null): Promise<void> {
  const handler = jobHandlers.get(jobName);
  if (!handler) {
    throw new Error(`Unknown job name: ${jobName}. Scheduler may not be initialized.`);
  }
  await runJob(jobName, handler, { trigger: 'manual', triggeredByUserId });
}

/** Jobs holding or waiting for the lock right now, by name. */
export function getActiveJobNames(): string[] {
  return runningJob === null ? [...jobQueue] : [runningJob, ...jobQueue];
}

/** Job names reserved by a manual start that has not reached the lock yet. */
const pendingManualStarts = new Set<string>();

/**
 * Start a job by hand and return at once with its history row, while the job
 * waits for the lock and runs in the background (Cycle Controls). The run goes
 * through `runJob`, so it is identical to a cron run: lock, preparation gate,
 * state, notifications.
 *
 * Throws `SchedulerError` 400 for an unknown job and 409 when that job is
 * already queued or running, so a double click cannot run it twice.
 */
export async function startManualRun(
  jobName: JobState['name'],
  triggeredByUserId: number,
): Promise<{ runId: number | null; jobName: JobState['name']; queuedAt: Date }> {
  const handler = jobHandlers.get(jobName);
  if (!handler) {
    throw new SchedulerError(SchedulerErrorCode.UNKNOWN_JOB, `Unknown scheduler job: ${jobName}`, 400);
  }
  // Synchronous check-and-reserve: two requests cannot both pass it.
  if (pendingManualStarts.has(jobName) || getActiveJobNames().includes(jobName)) {
    throw new SchedulerError(SchedulerErrorCode.JOB_ALREADY_ACTIVE, `${jobName} is already queued or running`, 409);
  }
  pendingManualStarts.add(jobName);
  const queuedAt = new Date();
  try {
    const runId = await recordQueued({ jobName, trigger: 'manual', triggeredByUserId, queuedAt });
    // Not awaited: runJob reaches the lock synchronously (running or queued),
    // so the reservation can be dropped right after.
    void runJob(jobName, handler, { trigger: 'manual', triggeredByUserId, runId });
    return { runId, jobName, queuedAt };
  } finally {
    pendingManualStarts.delete(jobName);
  }
}

/**
 * Run work under the scheduler's lock (the admin bulk runner), so it never
 * overlaps a cron or manual job.
 */
export async function runExclusive<T>(lockName: string, work: () => Promise<T>): Promise<T> {
  await acquireLock(lockName);
  try {
    return await work();
  } finally {
    releaseLock();
  }
}



// --- Reset (for testing) ---

export function resetScheduler(): void {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;
  jobStates.clear();
  jobHandlers.clear();
  pendingManualStarts.clear();
  runningJob = null;
  jobQueue.length = 0;
  lockResolve = null;
  schedulerActive = false;
}
