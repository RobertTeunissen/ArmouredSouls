/**
 * Battle summary write step shared by the fought-battle orchestrators (Spec #39).
 *
 * The summary is permanent overview data, written after the battle row. A
 * failed write is logged and never fails the battle: the battle and its
 * rewards are already durable.
 *
 * Bye and forfeit writers keep their own error handling and do not use this.
 *
 * @module services/battle/battleSummaryWriter
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { BattleLogEvent } from '../../shared/utils/battleStatistics';
import { computeBattleSummary, type BattleSummaryInput } from './battleSummaryComputer';

/** The summary maps keyed by robot name. */
export interface SummaryRobotMaps {
  robotMaxHP: Record<string, number>;
  robotNameToId: Record<string, number>;
  robotNameToTeam: Record<string, number>;
}

/**
 * Build the name-keyed maps `computeBattleSummary` needs.
 *
 * @param robots - The robots whose events are summarised
 * @param teamOf - The side each robot fought on (1 for placement modes)
 */
export function buildSummaryRobotMaps<T extends { id: number; name: string; maxHP: number }>(
  robots: T[],
  teamOf: (robot: T) => number,
): SummaryRobotMaps {
  const maps: SummaryRobotMaps = { robotMaxHP: {}, robotNameToId: {}, robotNameToTeam: {} };
  for (const robot of robots) {
    maps.robotMaxHP[robot.name] = robot.maxHP;
    maps.robotNameToId[robot.name] = robot.id;
    maps.robotNameToTeam[robot.name] = teamOf(robot);
  }
  return maps;
}

/** Summary input with the simulator's untyped event list. */
export type BattleSummaryWriteInput = Omit<BattleSummaryInput, 'events'> & {
  events: unknown[] | null | undefined;
};

/**
 * Compute and store the battle summary. A compute that returns null writes
 * nothing; a failed insert is logged as `${logTag} Failed to write battle summary`.
 */
export async function writeBattleSummary(
  battleId: number,
  input: BattleSummaryWriteInput,
  logTag: string,
): Promise<void> {
  const summaryData = computeBattleSummary({
    ...input,
    events: (input.events || []) as unknown as BattleLogEvent[],
  });
  if (!summaryData) return;
  await prisma.battleSummary.create({
    data: { battleId, ...summaryData },
  }).catch((err: unknown) => {
    logger.warn(`${logTag} Failed to write battle summary`, {
      battleId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
