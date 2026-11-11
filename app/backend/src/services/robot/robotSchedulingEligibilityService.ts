import prisma from '../../lib/prisma';
import { checkSchedulingReadiness } from '../analytics/matchmakingService';
import { getPoolSize, ROBOT_ATTRIBUTES } from '../tuning-pool/tuningPoolConfig';
import type { SchedulingEligibilityGate, SchedulingEligibilityReport } from '../../shared/types';

/** Tuning points the robot has allocated, from its allocation row (0 without one). */
function allocatedTuningPoints(row: Record<string, unknown> | null): number {
  if (!row) return 0;
  const total = ROBOT_ATTRIBUTES.reduce((sum, attr) => sum + Math.max(0, Number(row[attr]) || 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Computes the scheduling eligibility report for a robot.
 *
 * Returns a report with exactly 3 gates:
 * - weapon_equipped (hard) — delegated to checkSchedulingReadiness()
 * - event_subscribed (hard) — active subscription count > 0
 * - tuning_allocated (soft) — no tuning points left unallocated (#582: an
 *   allocation row holding 0 points used to count as tuned)
 *
 * The checklist shows only unmet gates, so labels name the task to do.
 *
 * This function performs ONLY read operations — no database writes.
 */
export async function computeSchedulingEligibility(robotId: number): Promise<SchedulingEligibilityReport> {
  const robot = await prisma.robot.findUniqueOrThrow({
    where: { id: robotId },
    include: { mainWeapon: true, offhandWeapon: true },
  });

  const gates: SchedulingEligibilityGate[] = [];

  // HARD GATE 1: Weapon equipped per loadout type
  const weaponReadiness = checkSchedulingReadiness(robot);
  gates.push({
    id: 'weapon_equipped',
    label: 'Equip a weapon',
    severity: 'hard',
    met: weaponReadiness.weaponCheck,
    detail: weaponReadiness.reasons.length > 0 ? weaponReadiness.reasons.join('; ') : null,
  });

  // HARD GATE 2: At least one event subscription active
  const subscriptionCount = await prisma.subscription.count({
    where: { robotId, status: 'active' },
  });
  gates.push({
    id: 'event_subscribed',
    label: 'Enter at least one battle event',
    severity: 'hard',
    met: subscriptionCount > 0,
    detail: subscriptionCount === 0
      ? 'No event subscriptions — robot will never be scheduled for battles'
      : null,
  });

  // SOFT GATE 3: every tuning point allocated
  const [tuningAllocation, tuningBay] = await Promise.all([
    prisma.tuningAllocation.findUnique({ where: { robotId } }),
    prisma.facility.findFirst({ where: { userId: robot.userId, facilityType: 'tuning_bay' }, select: { level: true } }),
  ]);
  const poolSize = getPoolSize(tuningBay?.level ?? 0);
  const unallocated = Math.max(0, Math.round((poolSize - allocatedTuningPoints(tuningAllocation as unknown as Record<string, unknown> | null)) * 100) / 100);
  gates.push({
    id: 'tuning_allocated',
    label: 'Allocate your tuning points',
    severity: 'soft',
    met: unallocated === 0,
    detail: unallocated > 0 ? `${unallocated} of ${poolSize} free tuning points unallocated` : null,
  });

  const hardGates = gates.filter((g) => g.severity === 'hard');
  return {
    robotId,
    isEligible: hardGates.every((g) => g.met),
    isFullyConfigured: gates.every((g) => g.met),
    gates,
  };
}
