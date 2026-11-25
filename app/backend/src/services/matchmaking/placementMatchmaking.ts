/**
 * Placement-mode matchmaking (King of the Hill and Grand Melee).
 *
 * Both modes group eligible robots into LP-banded free-for-all matches within
 * each tier/instance and share one pipeline: tier→instance iteration from
 * Standing records, checkSchedulingReadiness, subscription gating, LP-primary
 * grouping, same-stable swaps, recent-opponent swaps, thin-instance byes and
 * persistence via schedulingService. The modes differ only in the values of
 * {@link PlacementMatchmakingMode}.
 *
 * Spec #41: Unified Match Scheduling; Spec #44: Grand Melee
 */

import { MatchType, StandingsMode } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import schedulingService from '../scheduling/schedulingService';
import { createThinInstanceByes } from '../scheduling/thinInstanceByes';
import { checkSchedulingReadiness } from '../analytics/matchmakingService';
import { TEAM_BATTLE_LEAGUE_TIERS } from '../team-battle/teamBattleAdapter';
import {
  createRecentOpponentQueryFn,
  getRecentOpponentsBatch,
  defaultScheduledFor,
} from './teamMatchmakingUtils';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface EligibleRobot {
  id: number;
  userId: number;
  elo: number;
  name: string;
  createdAt: Date;
}

export interface PlacementMatchGroup {
  robots: EligibleRobot[];
}

/** What sets one placement mode apart from the other. */
export interface PlacementMatchmakingMode {
  /** Match type, standings mode and subscription event share this name. */
  mode: 'koth' | 'grand_melee';
  /** Mode name for log lines, e.g. "KotH". */
  label: string;
  /** Smallest group that can run a match; fewer eligible robots get byes. */
  minGroupSize: number;
  /** Largest group the banding aims for. */
  idealGroupSize: number;
  /** KotH only: zone radius stored on every scheduled match. */
  zoneRadius?: number;
}

/** Largest LP gap between two robots swapped to break up recent opponents. */
const RECENT_OPPONENT_SWAP_MAX_LP_DIFF = 30;

function logPrefix(config: PlacementMatchmakingMode): string {
  return `[${config.label} Matchmaking]`;
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

/**
 * Get eligible robots within one tier instance.
 *
 * Eligibility criteria:
 *  - Has a Standing record in the instance for the mode
 *  - Passes checkSchedulingReadiness (weapon check per loadout type)
 *  - Has an active subscription to the mode
 *  - Not already scheduled for a pending match of the mode
 */
export async function getEligiblePlacementRobots(
  config: PlacementMatchmakingMode,
  leagueInstanceId: string,
): Promise<EligibleRobot[]> {
  const prefix = logPrefix(config);
  const standingsInInstance = await prisma.standing.findMany({
    where: { mode: StandingsMode[config.mode], leagueInstanceId },
    select: { entityId: true },
  });
  const robotIdsInInstance = standingsInInstance.map(s => s.entityId);

  if (robotIdsInInstance.length === 0) {
    return [];
  }

  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIdsInInstance } },
    orderBy: { elo: 'desc' },
  });

  const readyRobots = robots.filter(robot => checkSchedulingReadiness(robot).isReady);

  const subscribedRobotIds = await prisma.subscription.findMany({
    where: { eventType: config.mode, robotId: { in: readyRobots.map(r => r.id) }, status: 'active' },
    select: { robotId: true },
  });
  const subscribedSet = new Set(subscribedRobotIds.map(s => s.robotId));
  const subscribedRobots = readyRobots.filter(r => subscribedSet.has(r.id));

  const excludedBySubscription = readyRobots.length - subscribedRobots.length;
  if (excludedBySubscription > 0) {
    logger.info(`${prefix} Excluded ${excludedBySubscription} robots without ${config.mode} subscription`, { leagueInstanceId });
  }

  const alreadyScheduledIds = await schedulingService.getAlreadyScheduledIds(
    'robot',
    subscribedRobots.map(r => r.id),
    [MatchType[config.mode]],
  );

  const availableRobots = subscribedRobots.filter(robot => !alreadyScheduledIds.has(robot.id));

  logger.info(
    `${prefix} ${leagueInstanceId}: ${availableRobots.length} eligible robots ` +
    `(${robots.length} total, ${readyRobots.length} ready, ${alreadyScheduledIds.size} already scheduled)`
  );

  return availableRobots.map(r => ({
    id: r.id,
    userId: r.userId,
    elo: r.elo,
    name: r.name,
    createdAt: r.createdAt,
  }));
}

// ─── LP-Banding Grouping ─────────────────────────────────────────────────────

/**
 * Group robots into LP-banded groups of `minGroupSize`–`idealGroupSize`.
 *
 * Algorithm:
 * 1. Sort by LP descending (from standings), ties by createdAt
 * 2. Divide into contiguous bands (groupCount = ceil(count / idealGroupSize),
 *    reduced until every band reaches minGroupSize)
 * 3. Apply same-stable swaps (no two robots from same user in one group)
 * 4. Apply recent-opponent swaps (avoid recently-grouped robots together)
 *
 * Pure function (no DB access).
 */
export function groupPlacementRobotsByLP(
  config: Pick<PlacementMatchmakingMode, 'minGroupSize' | 'idealGroupSize'>,
  robots: EligibleRobot[],
  standingsLPMap: Map<number, number>,
  recentOpponentsMap: Map<number, number[]>,
): PlacementMatchGroup[] {
  const { minGroupSize, idealGroupSize } = config;
  if (robots.length < minGroupSize) {
    return [];
  }

  const sorted = [...robots].sort((a, b) => {
    const lpDiff = (standingsLPMap.get(b.id) ?? 0) - (standingsLPMap.get(a.id) ?? 0);
    if (lpDiff !== 0) return lpDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let groupCount = Math.ceil(sorted.length / idealGroupSize);
  while (groupCount > 1 && Math.floor(sorted.length / groupCount) < minGroupSize) {
    groupCount--;
  }

  const groups: PlacementMatchGroup[] = Array.from({ length: groupCount }, () => ({ robots: [] }));

  // Contiguous bands as even as possible: the first `remainder` get one extra
  const baseSize = Math.floor(sorted.length / groupCount);
  const remainder = sorted.length % groupCount;
  let offset = 0;
  for (let gi = 0; gi < groupCount; gi++) {
    const size = baseSize + (gi < remainder ? 1 : 0);
    groups[gi].robots.push(...sorted.slice(offset, offset + size));
    offset += size;
  }

  resolveStableConflicts(groups);
  resolveRecentOpponentConflicts(groups, recentOpponentsMap, standingsLPMap);

  return groups;
}

/**
 * Ensure no two robots from the same stable share a group. On a conflict, swap
 * the robot with the first robot in another group that creates no new conflict.
 *
 * Best-effort: if a swap is impossible (e.g., a user has more robots than groups),
 * the conflict remains.
 */
function resolveStableConflicts(groups: PlacementMatchGroup[]): void {
  const maxPasses = groups.length * 2;
  for (let pass = 0; pass < maxPasses; pass++) {
    let swapped = false;

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const seenUsers = new Set<number>();

      for (let ri = 0; ri < group.robots.length; ri++) {
        const robot = group.robots[ri];
        if (!seenUsers.has(robot.userId)) {
          seenUsers.add(robot.userId);
          continue;
        }

        let resolved = false;
        for (let oi = 0; oi < groups.length && !resolved; oi++) {
          if (oi === gi) continue;
          const otherGroup = groups[oi];

          for (let oj = 0; oj < otherGroup.robots.length; oj++) {
            const candidate = otherGroup.robots[oj];
            const candidateConflictsHere = seenUsers.has(candidate.userId);
            const robotConflictsThere = otherGroup.robots.some(
              (r, idx) => idx !== oj && r.userId === robot.userId,
            );

            if (!candidateConflictsHere && !robotConflictsThere) {
              group.robots[ri] = candidate;
              otherGroup.robots[oj] = robot;
              seenUsers.add(candidate.userId);
              resolved = true;
              swapped = true;
              break;
            }
          }
        }
      }
    }

    if (!swapped) break;
  }
}

/**
 * If two robots that recently met are in the same band, swap one with a robot
 * from an adjacent band, provided the swap creates no new recent-opponent or
 * same-stable conflict and the two robots are within
 * {@link RECENT_OPPONENT_SWAP_MAX_LP_DIFF} LP of each other.
 */
function resolveRecentOpponentConflicts(
  groups: PlacementMatchGroup[],
  recentOpponentsMap: Map<number, number[]>,
  standingsLPMap: Map<number, number>,
): void {
  const recentOf = (id: number): number[] => recentOpponentsMap.get(id) ?? [];
  const maxPasses = groups.length * 2;
  for (let pass = 0; pass < maxPasses; pass++) {
    let swapped = false;

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];

      for (let ri = 0; ri < group.robots.length; ri++) {
        const robot = group.robots[ri];
        const robotRecent = recentOf(robot.id);
        const conflictInGroup = group.robots.some(
          (other, idx) => idx !== ri && robotRecent.includes(other.id),
        );
        if (!conflictInGroup) continue;

        let resolved = false;
        const adjacentIndices = [gi + 1, gi - 1].filter(i => i >= 0 && i < groups.length);

        for (const oi of adjacentIndices) {
          if (resolved) break;
          const otherGroup = groups[oi];

          for (let oj = 0; oj < otherGroup.robots.length; oj++) {
            const candidate = otherGroup.robots[oj];
            const candidateRecent = recentOf(candidate.id);

            const candidateConflictsHere = group.robots.some(
              (other, idx) => idx !== ri && candidateRecent.includes(other.id),
            );
            const robotConflictsThere = otherGroup.robots.some(
              (other, idx) => idx !== oj && recentOf(other.id).includes(robot.id),
            );
            const candidateStableConflict = group.robots.some(
              (other, idx) => idx !== ri && other.userId === candidate.userId,
            );
            const robotStableConflict = otherGroup.robots.some(
              (other, idx) => idx !== oj && other.userId === robot.userId,
            );
            if (candidateConflictsHere || robotConflictsThere || candidateStableConflict || robotStableConflict) {
              continue;
            }

            const lpDiff = Math.abs(
              (standingsLPMap.get(robot.id) ?? 0) - (standingsLPMap.get(candidate.id) ?? 0)
            );
            if (lpDiff <= RECENT_OPPONENT_SWAP_MAX_LP_DIFF) {
              group.robots[ri] = candidate;
              otherGroup.robots[oj] = robot;
              resolved = true;
              swapped = true;
              break;
            }
          }
        }
      }
    }

    if (!swapped) break;
  }
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run matchmaking for every tier/instance of the mode.
 *
 * @param scheduledFor - When the matches run (default: 24h from now, rounded to the hour)
 * @returns Matches plus bye events created
 */
export async function runPlacementMatchmaking(
  config: PlacementMatchmakingMode,
  scheduledFor?: Date,
): Promise<number> {
  const prefix = logPrefix(config);
  const matchType = MatchType[config.mode];
  const standingsMode = StandingsMode[config.mode];
  const matchTime = scheduledFor ?? defaultScheduledFor();
  let totalMatches = 0;

  logger.info(`${prefix} Starting matchmaking for all tiers (scheduledFor: ${matchTime.toISOString()})...`);

  for (const tier of TEAM_BATTLE_LEAGUE_TIERS) {
    try {
      const instances = await prisma.standing.findMany({
        where: { mode: standingsMode, tier },
        select: { leagueInstanceId: true },
        distinct: ['leagueInstanceId'],
      });

      for (const { leagueInstanceId: instanceId } of instances) {
        try {
          const eligible = await getEligiblePlacementRobots(config, instanceId);

          if (eligible.length < config.minGroupSize) {
            // A Thin_Instance cannot run a match, but a subscribed robot has
            // still allocated its slot, so each eligible robot gets a
            // Bye_Event (Spec #49).
            const byesCreated = await createThinInstanceByes({
              matchType,
              tier,
              leagueInstanceId: instanceId,
              robots: eligible,
              scheduledFor: matchTime,
            });
            logger.info(
              `${prefix} ${instanceId}: Thin instance — ` +
              `${eligible.length}/${config.minGroupSize} eligible robots, ${byesCreated} bye events created`,
            );
            totalMatches += byesCreated;
            continue;
          }

          const standingsLPMap = new Map(
            (await prisma.standing.findMany({
              where: { mode: standingsMode, entityId: { in: eligible.map(r => r.id) } },
              select: { entityId: true, leaguePoints: true },
            })).map(s => [s.entityId, s.leaguePoints])
          );

          const recentOpponentsMap = await getRecentOpponentsBatch(
            eligible.map(r => r.id),
            createRecentOpponentQueryFn(matchType, 'robot'),
          );

          const groups = groupPlacementRobotsByLP(config, eligible, standingsLPMap, recentOpponentsMap);

          for (const group of groups) {
            await schedulingService.createMatch({
              matchType,
              scheduledFor: matchTime,
              leagueType: tier,
              leagueInstanceId: instanceId,
              ...(config.zoneRadius !== undefined ? { zoneRadius: config.zoneRadius } : {}),
              participants: group.robots.map((robot, index) => ({
                participantType: 'robot' as const,
                participantId: robot.id,
                slot: index + 1,
              })),
            });
            totalMatches++;
          }

          if (groups.length > 0) {
            logger.info(`${prefix} ${instanceId}: Created ${groups.length} matches (${eligible.length} robots)`);
          }
        } catch (instanceError) {
          logger.error(`${prefix} Error in instance ${instanceId}:`, instanceError);
        }
      }
    } catch (tierError) {
      logger.error(`${prefix} Error in ${tier} tier:`, tierError);
    }
  }

  logger.info(`${prefix} COMPLETE: ${totalMatches} ${config.label} matches created`);

  return totalMatches;
}
