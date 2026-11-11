/**
 * Shared types for the Robot Setup Wizard feature (Spec #47).
 */
export type { SchedulingEligibilityGate, SchedulingEligibilityReport } from '@shared/types';

export interface StepProps {
  robotId: number;
  loadoutType: string;
  onComplete: () => void;
  onSkip?: () => void;
}
