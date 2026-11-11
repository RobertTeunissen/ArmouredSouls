/**
 * Wire contract for `GET /api/robots/:id/scheduling-eligibility` (Spec #47).
 *
 * The checklist only renders unmet gates, so every `label` is phrased as the
 * task still to do ("Equip a weapon"), never as the finished state.
 */
export type SchedulingEligibilityGateId = 'weapon_equipped' | 'event_subscribed' | 'tuning_allocated';

export interface SchedulingEligibilityGate {
  id: SchedulingEligibilityGateId;
  label: string;
  /** Hard gates block scheduling; soft gates are recommendations. */
  severity: 'hard' | 'soft';
  met: boolean;
  detail: string | null;
}

export interface SchedulingEligibilityReport {
  robotId: number;
  /** Every hard gate is met: the matchmaker can schedule the robot. */
  isEligible: boolean;
  /** Every gate, soft ones included, is met. */
  isFullyConfigured: boolean;
  gates: SchedulingEligibilityGate[];
}
