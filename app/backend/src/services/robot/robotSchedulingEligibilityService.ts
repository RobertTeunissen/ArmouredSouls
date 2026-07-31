import prisma from '../../lib/prisma';
import { checkSchedulingReadiness } from '../analytics/matchmakingService';

export type SchedulingEligibilityGateId =
  | 'weapon_equipped'
  | 'event_subscribed'
  | 'tuning_allocated';

export interface SchedulingEligibilityGate {
  id: SchedulingEligibilityGateId;
  label: string;
  severity: 'hard' | 'soft';
  met: boolean;
  detail: string | null;
}

export interface SchedulingEligibilityReport {
  robotId: number;
  isEligible: boolean;
  isFullyConfigured: boolean;
  gates: SchedulingEligibilityGate[];
}

/**
 * Computes the scheduling eligibility report for a robot.
 *
 * Returns a report with exactly 3 gates:
 * - weapon_equipped (hard) — delegated to checkSchedulingReadiness()
 * - event_subscribed (hard) — active subscription count > 0
 * - tuning_allocated (soft) — tuning allocation record exists
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
    label: 'Weapon equipped',
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
    label: 'Subscribed to at least one battle event',
    severity: 'hard',
    met: subscriptionCount > 0,
    detail: subscriptionCount === 0
      ? 'No event subscriptions — robot will never be scheduled for battles'
      : null,
  });

  // SOFT GATE 3: Tuning points allocated
  const tuningAllocation = await prisma.tuningAllocation.findUnique({ where: { robotId } });
  gates.push({
    id: 'tuning_allocated',
    label: 'Tuning points allocated',
    severity: 'soft',
    met: tuningAllocation !== null,
    detail: tuningAllocation === null ? 'Free stat bonuses available via Tuning Bay' : null,
  });

  const hardGates = gates.filter((g) => g.severity === 'hard');
  return {
    robotId,
    isEligible: hardGates.every((g) => g.met),
    isFullyConfigured: gates.every((g) => g.met),
    gates,
  };
}
