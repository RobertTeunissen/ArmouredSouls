import { AppError } from '../errors/AppError';

/**
 * Parse a cycle range string in format "[startCycle,endCycle]" into a tuple.
 * Validates that both values are positive integers and start <= end.
 */
export function parseCycleRange(param: string): [number, number] {
  const match = param.match(/^\[(-?\d+),(-?\d+)\]$/);
  if (!match) {
    throw new AppError('INVALID_CYCLE_RANGE_FORMAT', 'cycleRange must be in format [startCycle,endCycle], e.g., [1,10]', 400);
  }
  const start = parseInt(match[1]);
  const end = parseInt(match[2]);
  if (start < 1 || end < 1) {
    throw new AppError('INVALID_CYCLE_NUMBERS', 'Cycle numbers must be positive integers', 400);
  }
  if (start > end) {
    throw new AppError('INVALID_CYCLE_RANGE', 'startCycle must be less than or equal to endCycle', 400);
  }
  return [start, end];
}
