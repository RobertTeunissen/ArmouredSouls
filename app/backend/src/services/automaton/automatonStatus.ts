/**
 * Status_Bar data (Spec #55, R11.11, design §17.1 `GET /status`, §19,
 * task 9.6).
 *
 * - the Program_Switch;
 * - the most recent Turn_Step: the `(seasonNumber, trigger, slot)` group of
 *   Turn_Records with the latest `startedAt`; time = latest `finishedAt`,
 *   processed = rows in the group, duration = latest `finishedAt` − earliest
 *   `startedAt`, label `Cycle {slot}` / `Prep {slot}` / `Season start`
 *   (PLAYER_FACING_TEXT §6.2);
 * - the number of Active_Automatons whose most recent Turn_Record is
 *   `failed`, and the number that Need_Attention.
 *
 * No aggregated Saving or Blocked counts (R11.7).
 */
import prisma from '../../lib/prisma';
import type { AutomatonTurnTrigger } from '../../../generated/prisma';
import { getProgramSwitch } from './programSwitch';
import { loadActiveNeedAttention } from './needAttention';

export interface LastTurnStep {
  seasonNumber: number;
  trigger: AutomatonTurnTrigger;
  slot: number;
  /** "Cycle {n}", "Prep {n}" or "Season start". */
  label: string;
  /** Latest `finishedAt` of the group; null while every record is in progress. */
  finishedAt: string | null;
  /** Turn_Records in the group. */
  processed: number;
  /** Latest `finishedAt` − earliest `startedAt`; null while nothing has finished. */
  durationMs: number | null;
}

export interface AutomatonStatusBar {
  program: { turnsEnabled: boolean; updatedAt: string };
  /** Null before the first Turn_Step ("Never"). */
  lastStep: LastTurnStep | null;
  /** Active_Automatons whose most recent Turn_Record is `failed`. */
  failedCount: number;
  /** Active_Automatons with at least one Need_Attention reason. */
  needAttentionCount: number;
}

/** The Turn_Trigger label with its Turn_Slot (PLAYER_FACING_TEXT §6.2). */
export function turnStepLabel(trigger: AutomatonTurnTrigger, slot: number): string {
  switch (trigger) {
    case 'settlement':
      return `Cycle ${slot}`;
    case 'preparation':
      return `Prep ${slot}`;
    case 'season_open':
      return 'Season start';
  }
}

async function readLastTurnStep(): Promise<LastTurnStep | null> {
  const latest = await prisma.automatonTurn.findFirst({
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    select: { seasonNumber: true, trigger: true, slot: true },
  });
  if (!latest) return null;
  const group = await prisma.automatonTurn.aggregate({
    where: { seasonNumber: latest.seasonNumber, trigger: latest.trigger, slot: latest.slot },
    _count: { _all: true },
    _min: { startedAt: true },
    _max: { finishedAt: true },
  });
  const started = group._min.startedAt;
  const finished = group._max.finishedAt;
  return {
    seasonNumber: latest.seasonNumber,
    trigger: latest.trigger,
    slot: latest.slot,
    label: turnStepLabel(latest.trigger, latest.slot),
    finishedAt: finished?.toISOString() ?? null,
    processed: group._count._all,
    durationMs: finished && started ? Math.max(0, finished.getTime() - started.getTime()) : null,
  };
}

/** Everything the Status_Bar shows (R11.11). */
export async function getAutomatonStatus(): Promise<AutomatonStatusBar> {
  const [program, lastStep, attention] = await Promise.all([getProgramSwitch(), readLastTurnStep(), loadActiveNeedAttention()]);
  let failedCount = 0;
  let needAttentionCount = 0;
  for (const reasons of attention.values()) {
    if (reasons.length > 0) needAttentionCount++;
    if (reasons.some((r) => r.code === 'last_cycle_failed')) failedCount++;
  }
  return {
    program: { turnsEnabled: program.turnsEnabled, updatedAt: program.updatedAt.toISOString() },
    lastStep,
    failedCount,
    needAttentionCount,
  };
}
