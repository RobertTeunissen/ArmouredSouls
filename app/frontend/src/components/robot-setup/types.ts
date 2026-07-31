/**
 * Shared types for the Robot Setup Wizard feature (Spec #47).
 */

export interface SchedulingEligibilityGate {
  id: 'weapon_equipped' | 'event_subscribed' | 'tuning_allocated';
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

export interface StepProps {
  robotId: number;
  loadoutType: string;
  onComplete: () => void;
  onSkip?: () => void;
}
