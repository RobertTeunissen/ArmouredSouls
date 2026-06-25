/**
 * Battle Summary Computer
 *
 * Computes a pre-computed battle summary from combat events at battle creation time.
 * Wraps the shared `computeBattleStatistics` function with metadata resolution
 * (robot IDs, positions, KotH data) and produces the shape expected by the
 * `BattleSummary` Prisma model.
 *
 * Called by all battle orchestrators after simulation completes.
 */

import { computeBattleStatistics } from '../../shared/utils/battleStatistics';
import type { BattleLogEvent, BattleStatistics } from '../../shared/utils/battleStatistics';
import type { Prisma } from '../../../generated/prisma';
import logger from '../../config/logger';

export interface BattleSummaryInput {
  /** Raw simulator events (detailedCombatEvents) */
  events: BattleLogEvent[];
  /** Battle duration in seconds */
  duration: number;
  /** Battle type string */
  battleType: string;
  /** Robot name → max HP mapping for hit grade classification */
  robotMaxHP: Record<string, number>;
  /** Robot name → database ID mapping for participant summary */
  robotNameToId: Record<string, number>;
  /** Robot name → team number mapping */
  robotNameToTeam: Record<string, number>;
  /** Tag team / team battle info for team aggregates */
  tagTeamInfo?: { team1Robots: string[]; team2Robots: string[] };
  /** KotH placement data (if applicable) */
  kothPlacements?: Array<{
    robotId: number;
    robotName: string;
    placement: number;
    zoneScore: number;
    zoneTime: number;
    kills: number;
    destroyed: boolean;
  }>;
  /** KotH metadata (if applicable) */
  kothData?: { participantCount: number; scoreThreshold: number };
  /** Arena spatial data */
  startingPositions?: Record<string, { x: number; y: number }>;
  endingPositions?: Record<string, { x: number; y: number }>;
  arenaRadius?: number;
}

export interface BattleSummaryCreateData {
  perRobot: Prisma.InputJsonValue;
  perTeam: Prisma.InputJsonValue | undefined;
  damageFlows: Prisma.InputJsonValue;
  participants: Prisma.InputJsonValue;
  kothPlacements: Prisma.InputJsonValue | undefined;
  kothData: Prisma.InputJsonValue | undefined;
  startingPositions: Prisma.InputJsonValue | undefined;
  endingPositions: Prisma.InputJsonValue | undefined;
  arenaRadius: number | undefined;
  battleDuration: number;
  totalEvents: number;
  hasData: boolean;
}

/**
 * Computes a battle summary from raw combat events.
 * Returns the data shape ready for `prisma.battleSummary.create({ data: ... })`.
 *
 * This function never throws — on failure it returns null and logs the error.
 */
export function computeBattleSummary(input: BattleSummaryInput): BattleSummaryCreateData | null {
  try {
    const statistics: BattleStatistics = computeBattleStatistics(
      input.events,
      input.duration,
      input.battleType,
      input.tagTeamInfo,
      input.robotMaxHP,
    );

    // Build participant survival summary
    const participants = statistics.perRobot.map(robot => ({
      robotId: input.robotNameToId[robot.robotName] ?? 0,
      team: input.robotNameToTeam[robot.robotName] ?? 1,
      survivalSeconds: robot.exitTime !== null
        ? Math.max(0, robot.activeDuration)
        : input.duration,
    }));

    return {
      perRobot: statistics.perRobot as unknown as Prisma.InputJsonValue,
      perTeam: statistics.perTeam
        ? (statistics.perTeam.map(t => ({
            teamName: t.teamName,
            robots: t.robots.map(r => r.robotName),
            totalDamageDealt: t.totalDamageDealt,
            totalDamageReceived: t.totalDamageReceived,
            totalHits: t.totalHits,
            totalMisses: t.totalMisses,
            totalCriticals: t.totalCriticals,
          })) as unknown as Prisma.InputJsonValue)
        : undefined,
      damageFlows: statistics.damageFlows as unknown as Prisma.InputJsonValue,
      participants: participants as unknown as Prisma.InputJsonValue,
      kothPlacements: input.kothPlacements
        ? (input.kothPlacements as unknown as Prisma.InputJsonValue)
        : undefined,
      kothData: input.kothData
        ? (input.kothData as unknown as Prisma.InputJsonValue)
        : undefined,
      startingPositions: input.startingPositions
        ? (input.startingPositions as unknown as Prisma.InputJsonValue)
        : undefined,
      endingPositions: input.endingPositions
        ? (input.endingPositions as unknown as Prisma.InputJsonValue)
        : undefined,
      arenaRadius: input.arenaRadius,
      battleDuration: input.duration,
      totalEvents: statistics.totalEvents,
      hasData: statistics.hasData,
    };
  } catch (err) {
    logger.error('[battleSummaryComputer] Failed to compute summary', {
      error: err instanceof Error ? err.message : String(err),
      battleType: input.battleType,
      eventCount: input.events.length,
    });
    return null;
  }
}
