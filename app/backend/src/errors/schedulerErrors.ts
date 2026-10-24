/**
 * Scheduler error codes and error class (Cycle Controls manual runs).
 *
 * @module errors/schedulerErrors
 */

import { AppError } from './AppError';

export const SchedulerErrorCode = {
  /** The job name is not one of the scheduler's jobs. */
  UNKNOWN_JOB: 'SCHEDULER_UNKNOWN_JOB',
  /** That job already has a queued or running run; a second would double it. */
  JOB_ALREADY_ACTIVE: 'SCHEDULER_JOB_ALREADY_ACTIVE',
  /** No run with that id exists. */
  RUN_NOT_FOUND: 'SCHEDULER_RUN_NOT_FOUND',
} as const;

export type SchedulerErrorCodeType = typeof SchedulerErrorCode[keyof typeof SchedulerErrorCode];

/**
 * Structured scheduler error. Extends AppError so the error middleware returns
 * the standard `{ error, code, details? }` shape.
 */
export class SchedulerError extends AppError {
  constructor(code: SchedulerErrorCodeType, message: string, statusCode = 400, details?: unknown) {
    super(code, message, statusCode, details);
    this.name = 'SchedulerError';
  }
}
