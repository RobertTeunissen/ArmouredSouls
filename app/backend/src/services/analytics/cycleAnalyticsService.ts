/**
 * Cycle Analytics Service
 *
 * Handles cycle-related analytics queries (current cycle, performance metrics).
 *
 * Requirements: 12.1, 15.4, 15.5
 */

import prisma from '../../lib/prisma';

export interface CurrentCycleInfo {
  cycleNumber: number;
  lastCycleAt: Date | null;
}

export async function getCurrentCycle(): Promise<CurrentCycleInfo> {
  const metadata = await prisma.cycleMetadata.findUnique({
    where: { id: 1 },
  });

  if (!metadata) {
    return { cycleNumber: 0, lastCycleAt: null };
  }

  return {
    cycleNumber: metadata.totalCycles,
    lastCycleAt: metadata.lastCycleAt,
  };
}
