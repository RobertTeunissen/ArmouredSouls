/**
 * Test Cycle Helper
 * Provides utilities for managing unique cycle numbers in tests
 * to avoid sequence number conflicts in the auditLog table
 */

import { clearSequenceCache } from '../src/services/eventLogger';
import { PrismaClient } from '@prisma/client';

// Counter for generating unique cycle numbers within INT4 range
let cycleCounter = 100000;

/**
 * Generate a unique cycle number for testing
 * Uses a counter starting at 100000 to ensure uniqueness while staying within INT4 range
 * INT4 max value is 2,147,483,647, so we have plenty of room
 */
export function generateTestCycleNumber(): number {
  return cycleCounter++;
}

/**
 * Clean up test cycle data from database
 * Removes all audit log entries for the given cycle number
 */
export async function cleanupTestCycle(cycleNumber: number, prismaClient?: PrismaClient): Promise<void> {
  // Use provided client or import the shared one
  const prisma = prismaClient || (await import('../src/lib/prisma')).default;
  
  // Clear sequence cache first
  clearSequenceCache(cycleNumber);
  
  // Delete audit log entries for this cycle
  await prisma.auditLog.deleteMany({
    where: { cycleNumber }
  });
}

/**
 * Clean up multiple test cycles at once
 */
export async function cleanupTestCycles(cycleNumbers: number[], prismaClient?: PrismaClient): Promise<void> {
  // Use provided client or import the shared one
  const prisma = prismaClient || (await import('../src/lib/prisma')).default;
  
  // Clear sequence caches
  cycleNumbers.forEach(clearSequenceCache);
  
  // Delete audit log entries for all cycles
  await prisma.auditLog.deleteMany({
    where: {
      cycleNumber: {
        in: cycleNumbers
      }
    }
  });
}

/**
 * Setup function for tests using event logging
 * Returns a unique cycle number and cleanup function
 */
export function setupTestCycle(prismaClient?: PrismaClient): {
  cycleNumber: number;
  cleanup: () => Promise<void>;
} {
  const cycleNumber = generateTestCycleNumber();
  
  return {
    cycleNumber,
    cleanup: async () => {
      await cleanupTestCycle(cycleNumber, prismaClient);
    }
  };
}
