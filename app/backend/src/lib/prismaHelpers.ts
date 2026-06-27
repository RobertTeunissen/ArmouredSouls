import { Prisma } from '../../generated/prisma';

/**
 * Convert a Prisma Decimal value (or plain number) to a JavaScript number.
 *
 * Prisma 7 sometimes returns Decimal objects for numeric fields depending
 * on the database driver adapter. This utility normalizes both cases.
 *
 * Usage:
 *   import { toNumber } from '../lib/prismaHelpers';
 *   const value = toNumber(robot.combatPower);
 */
export function toNumber(value: number | Prisma.Decimal): number {
  if (typeof value === 'number') return value;
  return Number(value);
}
