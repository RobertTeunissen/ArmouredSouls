/**
 * What Season Control's timeline and rollover card read in one request
 * (`GET /api/admin/seasons/state`): the season state, the configuration, when
 * the season started, when the next settlement runs, and the rollover that is
 * queued or executing right now.
 *
 * @module services/season/adminSeasonStateService
 */

import prisma from '../../lib/prisma';
import { loadEnvConfig } from '../../config/env';
import { getSchedulerState } from '../cycle/cycleScheduler';
import { getCurrentSeason } from './seasonService';
import { getActiveRolloverProgress } from './seasonRolloverService';
import { getQueuedAdminRollover, isRolloverActive } from './adminSeasonRolloverRunService';
import type {
  AdminActiveRollover,
  AdminSeasonState,
  RolloverRunSummary,
  SeasonState,
} from '../../shared/types';

async function usernameOf(userId: number | null): Promise<AdminActiveRollover['triggeredBy']> {
  if (userId === null) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  return { userId, username: user?.username ?? null };
}

async function activeRollover(): Promise<AdminActiveRollover | null> {
  const running = getActiveRolloverProgress();
  if (running) {
    return {
      runId: running.runId,
      status: 'running',
      trigger: running.trigger === 'admin' ? 'manual' : 'cron',
      triggeredBy: await usernameOf(running.adminUserId),
      queuedAt: null,
      startedAt: running.startedAt,
      progress: running.progress,
    };
  }
  const queued = getQueuedAdminRollover();
  if (queued) {
    return {
      runId: queued.runId,
      status: 'queued',
      trigger: 'manual',
      triggeredBy: await usernameOf(queued.adminUserId),
      queuedAt: queued.queuedAt.toISOString(),
      startedAt: null,
      progress: null,
    };
  }
  return null;
}

export async function getAdminSeasonState(): Promise<AdminSeasonState> {
  const config = loadEnvConfig();
  const [state, row, rollover] = await Promise.all([
    getCurrentSeason(),
    prisma.season.findFirst({
      where: { phase: { not: 'completed' } },
      orderBy: { seasonNumber: 'desc' },
      select: { startedAt: true },
    }),
    activeRollover(),
  ]);
  const settlement = getSchedulerState().jobs.find((job) => job.name === 'settlement');

  return {
    ...state,
    rolloverInProgress: isRolloverActive(),
    // Balance changes belong in a preparation window (convention, not enforced).
    balanceChangesAppropriate: state.phase === 'preparation',
    config: {
      seasonLengthCycles: config.seasonLengthCycles,
      preparationLengthCycles: config.preparationLengthCycles,
      countdownCycles: config.countdownCycles,
      accoladeDepth: config.accoladeDepth,
      retainedImagesPerStable: config.retainedImagesPerStable,
    },
    startedAt: row?.startedAt.toISOString() ?? null,
    nextSettlementAt: settlement?.nextRunAt ? new Date(settlement.nextRunAt).toISOString() : null,
    activeRollover: rollover,
  };
}
