/**
 * Wire contracts of the robot settings pages: tuning allocation
 * (`GET/PUT /api/robots/:id/tuning-allocation`, stable summaries) and the image
 * moderation availability the upload panel reads.
 */

import type { RobotAttribute } from '../utils/robotAttributes';

/** Sparse map of attribute → tuning bonus. Only non-zero attributes included. */
export type TuningAttributeMap = Partial<Record<RobotAttribute, number>>;

/** Full state returned to the frontend */
export interface TuningAllocationState {
  robotId: number;
  facilityLevel: number;
  poolSize: number;
  allocated: number;
  remaining: number;
  perAttributeMaxes: Record<RobotAttribute, number>;
  allocations: TuningAttributeMap;
}

/**
 * Pool budget only — no per-attribute detail.
 *
 * Enough to answer "does this robot have points left to spend?", which is all
 * the dashboard needs. See `getTuningAllocationSummaries`.
 */
export interface TuningAllocationSummary {
  robotId: number;
  poolSize: number;
  allocated: number;
  remaining: number;
}

export type ModerationAvailabilityStatus = 'starting' | 'ready' | 'unavailable';

/** Player-safe availability data; operational failures are never exposed here. */
export interface ModerationAvailability {
  status: ModerationAvailabilityStatus;
  changedAt: string;
}
