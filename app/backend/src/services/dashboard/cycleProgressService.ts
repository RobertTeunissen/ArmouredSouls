/**
 * Cycle_Progress_Summary — every changing figure the Dashboard's Overview_Row needs
 * for the Current_Cycle, in one authenticated read.
 *
 * Spec #48 Requirement 8.
 *
 * Two things here are easy to get wrong and are therefore spelled out:
 *
 * 1. **Matches live in two tables.** `EVENT_SCHEDULE_SCOPES` declares six modes as
 *    `unified` (rows in `scheduled_matches_v2`) and the three tournament modes as
 *    `tournament` (rows in `tournament_matches`). Counting only the first would omit
 *    the 10:00, 15:00 and 18:00 Battle_Slots from `matchesScheduled` while
 *    `battlesFought` still counted their battles — so the tile would report more
 *    fought than scheduled on an ordinary day, and would announce the day finished
 *    while a tournament round was pending (Requirement 4 criteria 9 and 10).
 *
 * 2. **Outcomes are per battle SIDE, not per participant row.** A 3v3 victory with
 *    three of the player's robots on one side is ONE win, not three — otherwise the
 *    two halves of the tile contradict each other on five of the nine modes
 *    (Requirement 5 criterion 1).
 *
 * @module services/dashboard/cycleProgressService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { currentCycleWindow } from './cycleWindow';
import { PLACEMENT_MODE_BATTLE_TYPES } from '../auth/userProfileService';
import { readRepairChargedCredits } from '../economy/repairPayloadKeys';
import { EVENT_SCHEDULE_SCOPES } from '../scheduling/eventScheduleScope';
import { getNextSchedulingMoment } from '../scheduling/eventCronSchedule';
import { SUBSCRIBABLE_EVENT_TYPES } from '../subscription/eventRegistry';
import type {
  CycleProgressSummary,
  CycleComparison,
  RepairSpendByType,
  BestPlacement,
  WinLossDraw,
} from '../../types/dashboardTypes';
import type { StableMetric } from '../../types/snapshotTypes';

/** Outcome of one `(battleId, team)` pair. */
export type SideOutcome = 'win' | 'loss' | 'draw';

/**
 * Resolve the outcome of one battle side.
 *
 * `battles.winningSide` first, then `battles.winnerId` membership, then draw
 * (Requirement 5 criterion 11). The fallback is load-bearing rather than defensive:
 * the schema documents `winningSide` as null for BOTH a draw and a 1v1, so it cannot
 * distinguish those two cases on its own.
 *
 * Reads only these columns plus `battle_participants.team` — never `battle_log`,
 * which is NULLed seven days after a battle under the Spec #39 retention rule
 * (criterion 12).
 */
export function resolveSideOutcome(
  team: number,
  winningSide: number | null,
  winnerId: number | null,
  robotIdsOnSide: Set<number>,
): SideOutcome {
  if (winningSide !== null) {
    return team === winningSide ? 'win' : 'loss';
  }
  if (winnerId !== null) {
    return robotIdsOnSide.has(winnerId) ? 'win' : 'loss';
  }
  return 'draw';
}

/** Read the Last_Completed_Cycle comparison, or null if it cannot be established. */
async function readComparison(
  userId: number,
  currentCycleNumber: number,
): Promise<CycleComparison | null> {
  const snapshot = await prisma.cycleSnapshot.findFirst({
    where: { cycleNumber: { lt: currentCycleNumber } },
    orderBy: { cycleNumber: 'desc' },
    select: { cycleNumber: true, startTime: true, endTime: true, stableMetrics: true },
  });

  if (snapshot === null) return null;

  const metrics = (snapshot.stableMetrics as unknown as StableMetric[]) ?? [];
  const mine = Array.isArray(metrics)
    ? metrics.find((m) => m.userId === userId)
    : undefined;

  // Passive income emits `streaming: 0`, so `streamingIncome` on a snapshot is purely
  // per-battle streaming revenue. Battle_Earnings can therefore be read as
  // `totalCreditsEarned + streamingIncome` without picking up facility income, which
  // is what keeps Requirement 6 criterion 8 true for the comparison as well as the
  // Current_Cycle figure.
  const prestigeEarned = mine?.totalPrestigeEarned ?? 0;
  const battleEarnings = (mine?.totalCreditsEarned ?? 0) + (mine?.streamingIncome ?? 0);

  // Repair_Spend for that window comes from Repair_Spend_Source, scoped to the
  // snapshot's own boundaries rather than recomputed from the current one.
  let repairSpend: RepairSpendByType | null = null;
  try {
    repairSpend = await aggregateRepairSpend(userId, snapshot.startTime, snapshot.endTime);
  } catch (error) {
    // Requirement 10 criterion 6: the repair comparison is omitted INDEPENDENTLY of
    // the other two, e.g. after a Season_Rollover purged `audit_logs`.
    logger.debug(
      `[CycleProgress] Repair comparison unavailable for user ${userId}, cycle ${snapshot.cycleNumber}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return {
    cycleNumber: snapshot.cycleNumber,
    prestigeEarned,
    battleEarnings,
    repairSpend,
  };
}

/**
 * Sum Repair_Spend per `repairType` over a window.
 *
 * Fetches only `robot_repair` rows for this user inside the window and sums in
 * application code, because Prisma cannot `_sum` a field inside a `Json` column
 * (Requirement 9 criterion 4). Only the charged figure is read. The pre-manual-discount
 * figure — `creditsBeforeManualDiscount`, present on manual rows only — is never an
 * input here: summing it would report manual spend at roughly double what was charged
 * and drop automatic spend entirely, since automatic rows do not carry it. A row with
 * no `repairType` or a non-numeric charged figure is skipped and
 * the remaining aggregation completes (criterion 10).
 */
async function aggregateRepairSpend(
  userId: number,
  start: Date,
  end: Date,
): Promise<RepairSpendByType> {
  const rows = await prisma.auditLog.findMany({
    where: {
      userId,
      eventType: 'robot_repair',
      eventTimestamp: { gte: start, lt: end },
    },
    select: { payload: true },
  });

  const totals: RepairSpendByType = { manual: 0, automatic: 0 };

  for (const row of rows) {
    const payload = row.payload as unknown as Record<string, unknown>;
    const charged = readRepairChargedCredits(payload);
    if (charged === null) continue;

    const repairType = payload.repairType;
    if (repairType === 'manual') totals.manual += charged;
    else if (repairType === 'automatic') totals.automatic += charged;
    // A row with neither is excluded from both totals, per criterion 10.
  }

  return totals;
}

/**
 * Every changing figure the Overview_Row needs for the Current_Cycle.
 *
 * Read-only: writes to no table and creates no audit entry (Requirement 8
 * criterion 6).
 */
export async function getCycleProgressSummary(
  userId: number,
  now: Date = new Date(),
): Promise<CycleProgressSummary> {
  const { start, end, nextBoundary } = currentCycleWindow(now);

  const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  const currentCycleNumber = (cycleMetadata?.totalCycles ?? 0) + 1;

  // ── Wave 1: roster, teams, participation, earnings, schedules, repair ──
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
  });
  const robotIds = robots.map((r) => r.id);

  if (robotIds.length === 0) {
    // Nothing to aggregate. The comparison is still worth reading: a stable that
    // sold its last robot today still earned prestige and credits earlier.
    const comparison = await readComparison(userId, currentCycleNumber).catch(() => null);
    return {
      window: { start: start.toISOString(), end: end.toISOString(), cycleNumber: currentCycleNumber },
      battlesFought: 0,
      matchesScheduled: 0,
      winLossDraw: { wins: 0, losses: 0, draws: 0 },
      bestPlacement: null,
      remainingSlotsUtc: [],
      nextSettlementAt: nextBoundary.toISOString(),
      prestigeEarned: 0,
      battleEarnings: 0,
      repairSpend: { manual: 0, automatic: 0 },
      comparison,
    };
  }

  const memberships = await prisma.teamBattleMember.findMany({
    where: { robotId: { in: robotIds } },
    select: { teamId: true },
  });
  const teamIds = [...new Set(memberships.map((m) => m.teamId))];

  const [participantRows, earnings, unifiedRows, bracketRows, repairSpend] = await Promise.all([
    // Battles fought, outcomes, placements.
    prisma.battleParticipant.findMany({
      where: {
        robotId: { in: robotIds },
        battle: { createdAt: { gte: start, lt: end } },
      },
      select: {
        battleId: true,
        robotId: true,
        team: true,
        placement: true,
        battle: {
          select: { battleType: true, winnerId: true, winningSide: true },
        },
      },
    }),

    // Battle_Earnings and prestige earned — real columns, so a `_sum` is available.
    prisma.battleParticipant.aggregate({
      where: {
        robotId: { in: robotIds },
        battle: { createdAt: { gte: start, lt: end } },
      },
      _sum: { credits: true, streamingRevenue: true, prestigeAwarded: true },
    }),

    // Match_Schedule_Source 1: the unified schedule.
    prisma.scheduledMatchParticipant.findMany({
      where: {
        OR: [
          { participantType: 'robot', participantId: { in: robotIds } },
          ...(teamIds.length > 0
            ? [{ participantType: 'team', participantId: { in: teamIds } }]
            : []),
        ],
        scheduledMatch: { scheduledFor: { gte: start, lt: end } },
      },
      select: {
        scheduledMatchId: true,
        scheduledMatch: { select: { matchType: true, status: true, scheduledFor: true } },
      },
    }),

    // Match_Schedule_Source 2: tournament brackets.
    //
    // `tournament_matches` has NO `scheduledFor` column — a bracket row is fought at
    // the next occurrence of its mode's Battle_Slot, and each handler runs one round
    // per cycle. So an outstanding row for an active tournament IS this cycle's
    // match, and its slot time comes from the cron config via
    // `getNextSchedulingMoment`, not from a column. The filter mirrors
    // `resolveOutstandingEventsForRobots` so the two cannot disagree about what
    // "queued" means (Requirement 8 criterion 13).
    prisma.scheduledTournamentMatch.findMany({
      where: {
        status: { in: ['pending', 'scheduled'] },
        winnerId: null,
        tournament: { status: 'active' },
        OR: [
          { participantType: 'robot', participant1Id: { in: robotIds } },
          { participantType: 'robot', participant2Id: { in: robotIds } },
          ...(teamIds.length > 0
            ? [
                { participantType: { in: ['team_2v2', 'team_3v3'] }, participant1Id: { in: teamIds } },
                { participantType: { in: ['team_2v2', 'team_3v3'] }, participant2Id: { in: teamIds } },
              ]
            : []),
        ],
      },
      select: { id: true, participantType: true },
    }),

    aggregateRepairSpend(userId, start, end),
  ]);

  // ── Battles fought: distinct battles, once per stable ──
  const battlesFought = new Set(participantRows.map((r) => r.battleId)).size;

  // ── Outcomes: once per (battleId, team) pair the player holds a row on ──
  const sides = new Map<
    string,
    {
      battleType: string;
      team: number;
      winnerId: number | null;
      winningSide: number | null;
      robotIdsOnSide: Set<number>;
    }
  >();

  for (const row of participantRows) {
    const key = `${row.battleId}:${row.team}`;
    const existing = sides.get(key);
    if (existing) {
      existing.robotIdsOnSide.add(row.robotId);
    } else {
      sides.set(key, {
        battleType: row.battle.battleType,
        team: row.team,
        winnerId: row.battle.winnerId,
        winningSide: row.battle.winningSide,
        robotIdsOnSide: new Set([row.robotId]),
      });
    }
  }

  const winLossDraw: WinLossDraw = { wins: 0, losses: 0, draws: 0 };
  for (const side of sides.values()) {
    // Placement modes resolve by finishing position, not win/loss, and are excluded
    // (Requirement 5 criterion 2, and criterion 15 for the multi-robot case).
    if (PLACEMENT_MODE_BATTLE_TYPES.includes(side.battleType)) continue;

    const outcome = resolveSideOutcome(
      side.team,
      side.winningSide,
      side.winnerId,
      side.robotIdsOnSide,
    );
    if (outcome === 'win') winLossDraw.wins += 1;
    else if (outcome === 'loss') winLossDraw.losses += 1;
    else winLossDraw.draws += 1;
  }

  // ── Best_Placement: lowest position, ties broken by the largest field ──
  const placementRows = participantRows.filter(
    (r) => PLACEMENT_MODE_BATTLE_TYPES.includes(r.battle.battleType) && r.placement !== null,
  );

  let bestPlacement: BestPlacement | null = null;
  if (placementRows.length > 0) {
    const fieldSizes = await prisma.battleParticipant.groupBy({
      by: ['battleId'],
      where: { battleId: { in: [...new Set(placementRows.map((r) => r.battleId))] } },
      _count: { id: true },
    });
    const fieldSizeByBattle = new Map(fieldSizes.map((f) => [f.battleId, f._count.id]));

    for (const row of placementRows) {
      const position = row.placement as number;
      const fieldSize = fieldSizeByBattle.get(row.battleId) ?? 0;

      if (
        bestPlacement === null ||
        position < bestPlacement.position ||
        // Requirement 5 criterion 9: a tie on the lowest placement is broken by the
        // largest field, so the rendered pair is deterministic.
        (position === bestPlacement.position && fieldSize > bestPlacement.fieldSize)
      ) {
        bestPlacement = { position, fieldSize };
      }
    }
  }

  // ── Matches scheduled and remaining slots, across BOTH sources ──
  const unifiedMatchIds = new Set(unifiedRows.map((r) => r.scheduledMatchId));
  const matchesScheduled = unifiedMatchIds.size + bracketRows.length;

  const remainingSlots = new Set<string>();

  // Unified: an unfought match contributes its own scheduled time.
  const seenUnified = new Set<number>();
  for (const row of unifiedRows) {
    if (seenUnified.has(row.scheduledMatchId)) continue;
    seenUnified.add(row.scheduledMatchId);
    if (row.scheduledMatch.status !== 'scheduled') continue;
    if (row.scheduledMatch.scheduledFor <= now) continue;
    remainingSlots.add(formatUtcTime(row.scheduledMatch.scheduledFor));
  }

  // Tournament: the slot comes from the mode's cron configuration.
  const tournamentEventByParticipantType = new Map<string, (typeof SUBSCRIBABLE_EVENT_TYPES)[number]>();
  for (const eventType of SUBSCRIBABLE_EVENT_TYPES) {
    const scope = EVENT_SCHEDULE_SCOPES[eventType];
    if (scope.source === 'tournament') {
      tournamentEventByParticipantType.set(scope.participantType, eventType);
    }
  }

  for (const row of bracketRows) {
    const eventType = tournamentEventByParticipantType.get(row.participantType);
    if (eventType === undefined) continue;

    // `getNextSchedulingMoment` returns an absolute instant computed from the real
    // clock. Only its TIME OF DAY is wanted here — the slot is a daily one, and the
    // question is whether it still falls ahead of `now` within THIS window. Using the
    // absolute instant directly would make the result depend on the wall clock rather
    // than on the window being reported.
    const slotTimeOfDay = getNextSchedulingMoment(eventType);
    const slotToday = new Date(
      start.getTime() +
        (slotTimeOfDay.getUTCHours() * 60 + slotTimeOfDay.getUTCMinutes()) * 60 * 1000,
    );

    if (slotToday > now && slotToday < nextBoundary) {
      remainingSlots.add(formatUtcTime(slotToday));
    }
  }

  const comparison = await readComparison(userId, currentCycleNumber).catch((error) => {
    // Requirement 2 criterion 9: the Current_Cycle figures still return; the frontend
    // renders an unavailable indication distinct from a zero.
    logger.debug(
      `[CycleProgress] Comparison read failed for user ${userId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  });

  return {
    window: {
      start: start.toISOString(),
      end: end.toISOString(),
      cycleNumber: currentCycleNumber,
    },
    battlesFought,
    matchesScheduled,
    winLossDraw,
    bestPlacement,
    remainingSlotsUtc: [...remainingSlots].sort(),
    nextSettlementAt: nextBoundary.toISOString(),
    prestigeEarned: earnings._sum.prestigeAwarded ?? 0,
    battleEarnings: (earnings._sum.credits ?? 0) + (earnings._sum.streamingRevenue ?? 0),
    repairSpend,
    comparison,
  };
}

/** `HH:MM` in UTC — the form the Overview_Row renders. */
function formatUtcTime(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
