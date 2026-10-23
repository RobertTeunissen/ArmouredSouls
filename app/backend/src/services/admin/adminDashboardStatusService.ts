/**
 * Admin dashboard status: the status strip and the "Needs attention" facts.
 *
 * Read-only and system-wide (no user filter). It returns facts only; the
 * frontend derives severity and wording. It never sends alerts: monitoring
 * alerts have a single emitter each, and that is not this page.
 *
 * Cycle health deliberately leans on persistent signals. `getSchedulerState()`
 * is in-memory and every job reads `null` after a restart or deploy, so a
 * missed cron job is also detected from the database: an overdue settlement
 * (the later of `cycle_metadata.last_cycle_at` and the season's
 * `last_settlement_at`, so both phases count) and matches left `scheduled`
 * past their slot.
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { buildUserFilter } from '../../utils/buildUserFilter';
import { getSchedulerState, type SchedulerState } from '../cycle/cycleScheduler';
import { getCurrentSeason } from '../season/seasonService';
import { securityMonitor } from '../security/securityMonitor';
import { SecuritySeverity } from '../security/securityLogger';
import { getAutomatonStatus } from '../automaton/automatonStatus';
import { countQueuedMatchesByMode, totalQueued } from './adminQueuedMatches';
import {
  BANKRUPTCY_RISK_THRESHOLD,
  SETTLEMENT_OVERDUE_AFTER_MS,
  STUCK_MATCH_GRACE_MS,
} from './adminThresholds';

const SETTLEMENT_JOB = 'settlement';

export interface DashboardSchedulerSummary {
  active: boolean;
  runningJob: string | null;
  queueLength: number;
  jobsTotal: number;
  jobsSucceeded: number;
  jobsFailed: string[];
  /** Jobs with no recorded run since the process started. */
  jobsNotYetReported: number;
  processStartedAt: string;
}

export interface DashboardCycleHealth {
  /** Scheduler active and the last settlement is missing or older than 26 h. */
  settlementOverdue: boolean;
  failedJobs: string[];
  /** Matches still `scheduled` more than 2 h after their slot. */
  stuckMatches: number;
}

export interface DashboardStatus {
  cycle: { number: number; lastSettlementAt: string | null; nextSettlementAt: string | null };
  season: { number: number; phase: string; seasonCycle: number } | null;
  scheduler: DashboardSchedulerSummary;
  queuedMatches: number | null;
  attention: {
    bankruptcyRisk: { count: number; threshold: number } | null;
    security: { activeAlerts: number; critical: number } | null;
    automatons: { needAttention: number; failed: number } | null;
    cycleHealth: DashboardCycleHealth;
  };
  timestamp: string;
}

/** Summarise the in-memory scheduler state. Pure. */
export function summarizeScheduler(state: SchedulerState, processStartedAt: Date): DashboardSchedulerSummary {
  const jobs = state.jobs ?? [];
  return {
    active: state.active,
    runningJob: state.runningJob,
    queueLength: state.queue?.length ?? 0,
    jobsTotal: jobs.length,
    jobsSucceeded: jobs.filter((job) => job.lastRunStatus === 'success').length,
    jobsFailed: jobs.filter((job) => job.lastRunStatus === 'failed').map((job) => job.name),
    jobsNotYetReported: jobs.filter((job) => job.lastRunStatus === null).length,
    processStartedAt: processStartedAt.toISOString(),
  };
}

export interface CycleHealthInput {
  schedulerActive: boolean;
  lastSettlementAt: Date | null;
  failedJobs: string[];
  stuckMatches: number;
  now: Date;
}

/**
 * Cycle health from persistent and in-memory signals. Pure.
 *
 * A disabled scheduler (local or a paused environment) never makes the
 * settlement "overdue": cycles there are run by hand.
 */
export function computeCycleHealth(input: CycleHealthInput): DashboardCycleHealth {
  const settlementOverdue = input.schedulerActive && (
    input.lastSettlementAt === null
    || input.now.getTime() - input.lastSettlementAt.getTime() > SETTLEMENT_OVERDUE_AFTER_MS
  );
  return {
    settlementOverdue,
    failedJobs: [...input.failedJobs],
    stuckMatches: input.stuckMatches,
  };
}

/**
 * The most recent persistent evidence of a successful settlement. Pure.
 *
 * `cycle_metadata.last_cycle_at` moves only on competitive settlements (and is
 * reset at rollover); `seasons.last_settlement_at` is stamped by every
 * settlement in both phases. Taking the later of the two keeps the overdue
 * check honest through a Preparation_Phase without disabling it there, so a
 * missed preparation settlement still shows.
 */
export function latestSettlement(lastCycleAt: Date | null, seasonLastSettlementAt: Date | null): Date | null {
  if (lastCycleAt === null) return seasonLastSettlementAt;
  if (seasonLastSettlementAt === null) return lastCycleAt;
  return seasonLastSettlementAt.getTime() > lastCycleAt.getTime() ? seasonLastSettlementAt : lastCycleAt;
}

/** Resolve one section; log and return null when its source fails. */
async function settle<T>(label: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    logger.error(`[AdminDashboard] ${label} unavailable — ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** Everything the status strip and the "Needs attention" panel show. */
export async function getDashboardStatus(now: Date = new Date()): Promise<DashboardStatus> {
  const processStartedAt = new Date(now.getTime() - Math.round(process.uptime() * 1000));
  const schedulerState = getSchedulerState();
  const scheduler = summarizeScheduler(schedulerState, processStartedAt);
  const settlementJob = (schedulerState.jobs ?? []).find((job) => job.name === SETTLEMENT_JOB);

  const [cycleMetadata, seasonSettlement, season, queuedByMode, bankruptcyCount, automatonStatus, stuckMatches] = await Promise.all([
    prisma.cycleMetadata.findUnique({ where: { id: 1 }, select: { totalCycles: true, lastCycleAt: true } }),
    prisma.season.findFirst({ orderBy: { seasonNumber: 'desc' }, select: { lastSettlementAt: true } }),
    settle('season', () => getCurrentSeason()),
    settle('queued matches', () => countQueuedMatchesByMode()),
    settle('bankruptcy risk', () => prisma.user.count({
      where: { AND: [buildUserFilter('real'), { currency: { lt: BANKRUPTCY_RISK_THRESHOLD } }] },
    })),
    settle('automaton status', () => getAutomatonStatus()),
    prisma.scheduledMatch.count({
      where: { status: 'scheduled', scheduledFor: { lt: new Date(now.getTime() - STUCK_MATCH_GRACE_MS) } },
    }),
  ]);

  let security: DashboardStatus['attention']['security'] = null;
  try {
    const summary = securityMonitor.getSummary();
    security = { activeAlerts: summary.activeAlerts, critical: summary.bySeverity[SecuritySeverity.CRITICAL] };
  } catch (error) {
    logger.error(`[AdminDashboard] security summary unavailable — ${error instanceof Error ? error.message : String(error)}`);
  }

  const lastSettlementAt = latestSettlement(cycleMetadata?.lastCycleAt ?? null, seasonSettlement?.lastSettlementAt ?? null);

  return {
    cycle: {
      number: cycleMetadata?.totalCycles ?? 0,
      lastSettlementAt: lastSettlementAt?.toISOString() ?? null,
      nextSettlementAt: settlementJob?.nextRunAt ? new Date(settlementJob.nextRunAt).toISOString() : null,
    },
    season: season ? { number: season.seasonNumber, phase: season.phase, seasonCycle: season.seasonCycle } : null,
    scheduler,
    queuedMatches: queuedByMode ? totalQueued(queuedByMode) : null,
    attention: {
      bankruptcyRisk: bankruptcyCount === null ? null : { count: bankruptcyCount, threshold: BANKRUPTCY_RISK_THRESHOLD },
      security,
      automatons: automatonStatus
        ? { needAttention: automatonStatus.needAttentionCount, failed: automatonStatus.failedCount }
        : null,
      cycleHealth: computeCycleHealth({
        schedulerActive: scheduler.active,
        lastSettlementAt,
        failedJobs: scheduler.jobsFailed,
        stuckMatches,
        now,
      }),
    },
    timestamp: now.toISOString(),
  };
}
