/**
 * Grand Melee Matchmaking Service
 *
 * Groups eligible robots into LP-banded groups of 8-20 for Grand Melee
 * matches within each tier/instance. Uses the same unified pipeline as all
 * other matchmaking services: tier→instance iteration from Standing records,
 * checkSchedulingReadiness, subscription gating, LP-primary grouping,
 * same-stable swaps, recent-opponent swaps, and persistence via schedulingService.
 *
 * Spec #44: Grand Melee
 * Requirements: 1.1–1.4, 2.1–2.4, 3.1–3.6, 4.1–4.4
 */

import { Robot, MatchType } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import schedulingService from '../scheduling/schedulingService';
import { checkSchedulingReadiness } from '../analytics/matchmakingService';
import { TEAM_BATTLE_LEAGUE_TIERS } from '../team-battle/teamBattleAdapter';
import {
  calculateMatchScore,
  MatchScoreInput,
  RECENT_OPPONENT_LIMIT,
  createRecentOpponentQueryFn,
  getRecentOpponentsBatch,
  defaultScheduledFor,
} from '../matchmaking/teamMatchmakingUtils';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface EligibleRobot {
  id: number;
  userId: number;
  elo: number;
  name: string;
  createdAt: Date;
}

export interface GrandMeleeMatchGroup {
  robots: EligibleRobot[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_GROUP_SIZE = 8;
const IDEAL_GROUP_SIZE = 20;
const LOG_PREFIX = '[Grand Melee Matchmaking]';

// ─── Eligibility ─────────────────────────────────────────────────────────────

/**
 * Get eligible robots for Grand Melee matchmaking within a specific tier instance.
 *
 * Eligibility criteria:
 *  - Has a Standing record in the given tier/instance with mode='grand_melee'
 *  - Passes checkSchedulingReadiness (weapon check per loadout type)
 *  - Has an active 'grand_melee' subscription
 *  - Not already scheduled for a pending Grand Melee match
 *
 * Requirements: 1.2, 2.1, 2.2, 2.3, 2.4
 */
export async function getEligibleRobots(tier: string, leagueInstanceId: string): Promise<EligibleRobot[]> {
  // Get robot IDs in this instance from standings (source of truth)
  const standingsInInstance = await prisma.standing.findMany({
    where: { mode: 'grand_melee' as any, leagueInstanceId },
    select: { entityId: true },
  });
  const robotIdsInInstance = standingsInInstance.map(s => s.entityId);

  if (robotIdsInInstance.length === 0) {
    return [];
  }

  // Load robots by those IDs
  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIdsInInstance } },
    orderBy: { elo: 'desc' },
  });

  // Filter for scheduling-ready robots (weapon check per loadout type)
  const readyRobots = robots.filter(robot => {
    const readiness = checkSchedulingReadiness(robot);
    return readiness.isReady;
  });

  // Activate pending subscriptions for robots that have room under cap
  const { batchActivatePendingSubscriptions } = await import('../subscription/subscriptionService');
  await batchActivatePendingSubscriptions(readyRobots.map(r => r.id), 'grand_melee');

  // Filter by grand_melee subscription — only active subscriptions
  const subscribedRobotIds = await prisma.subscription.findMany({
    where: { eventType: 'grand_melee', robotId: { in: readyRobots.map(r => r.id) }, status: 'active' },
    select: { robotId: true },
  });
  const subscribedSet = new Set(subscribedRobotIds.map(s => s.robotId));
  const subscribedRobots = readyRobots.filter(r => subscribedSet.has(r.id));

  const excludedBySubscription = readyRobots.length - subscribedRobots.length;
  if (excludedBySubscription > 0) {
    logger.info(`${LOG_PREFIX} Excluded ${excludedBySubscription} robots without grand_melee subscription`, { leagueInstanceId });
  }

  // Check if robots are already scheduled for a Grand Melee match (via unified scheduling table)
  const schedulingResults = await Promise.all(
    subscribedRobots.map(r => schedulingService.getUpcomingForRobot(r.id, [MatchType.grand_melee]))
  );
  const alreadyScheduledIds = new Set<number>();
  subscribedRobots.forEach((r, i) => {
    if (schedulingResults[i].length > 0) {
      alreadyScheduledIds.add(r.id);
    }
  });

  // Filter out already scheduled robots
  const availableRobots = subscribedRobots.filter(robot => !alreadyScheduledIds.has(robot.id));

  logger.info(
    `${LOG_PREFIX} ${leagueInstanceId}: ${availableRobots.length} eligible robots ` +
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
 * Group robots into LP-banded groups of 8-20.
 *
 * Algorithm:
 * 1. Sort by LP descending (from standings)
 * 2. Divide into contiguous bands (groupCount = ceil(count / 20))
 * 3. Apply same-stable swaps (no two robots from same user in one group)
 * 4. Apply recent-opponent swaps (avoid recently-grouped robots together)
 *
 * This is a PURE function (no DB access) — exported for testing.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export function groupByLPBanding(
  robots: EligibleRobot[],
  standingsLPMap: Map<number, number>,
  recentOpponentsMap: Map<number, number[]>,
): GrandMeleeMatchGroup[] {
  if (robots.length < MIN_GROUP_SIZE) {
    return [];
  }

  // 1. Sort by LP descending
  const sorted = [...robots].sort((a, b) => {
    const lpDiff = (standingsLPMap.get(b.id) ?? 0) - (standingsLPMap.get(a.id) ?? 0);
    if (lpDiff !== 0) return lpDiff;
    return a.createdAt.getTime() - b.createdAt.getTime(); // tie-break by createdAt
  });

  // 2. Calculate group count and divide into contiguous bands
  // Use ceil(count / 20) to ensure no group exceeds 20 when possible.
  // Then verify the smallest group is still >= 8. If not, reduce groupCount.
  let groupCount = Math.ceil(sorted.length / IDEAL_GROUP_SIZE);
  // Ensure no group is smaller than MIN_GROUP_SIZE
  while (groupCount > 1 && Math.floor(sorted.length / groupCount) < MIN_GROUP_SIZE) {
    groupCount--;
  }

  const groups: GrandMeleeMatchGroup[] = Array.from({ length: groupCount }, () => ({
    robots: [],
  }));

  // Distribute robots into groups as evenly as possible (contiguous bands)
  const baseSize = Math.floor(sorted.length / groupCount);
  const remainder = sorted.length % groupCount;
  let offset = 0;
  for (let gi = 0; gi < groupCount; gi++) {
    // First `remainder` groups get baseSize+1, rest get baseSize
    const size = baseSize + (gi < remainder ? 1 : 0);
    for (let i = 0; i < size; i++) {
      groups[gi].robots.push(sorted[offset + i]);
    }
    offset += size;
  }

  // 3. Apply same-stable swaps
  resolveStableConflicts(groups, standingsLPMap);

  // 4. Apply recent-opponent swaps
  resolveRecentOpponentConflicts(groups, recentOpponentsMap, standingsLPMap);

  return groups;
}

/**
 * Resolve stable conflicts: ensure no two robots from the same user (stable)
 * share a group. When a conflict is found, swap the lower-LP robot with the
 * highest-LP robot from the adjacent band that doesn't create a new conflict.
 *
 * Best-effort: if a swap is impossible (e.g., a user has more robots than groups),
 * the conflict remains.
 */
function resolveStableConflicts(groups: GrandMeleeMatchGroup[], standingsLPMap: Map<number, number>): void {
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

        // Conflict: robot.userId already in this group. Find a swap partner.
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
              // Swap
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
 * Resolve recent-opponent conflicts: if two robots that recently fought in Grand Melee
 * are in the same band, swap the lower-LP one with a non-conflicting robot from
 * an adjacent band. Only swap if it doesn't degrade group LP-variance significantly.
 */
function resolveRecentOpponentConflicts(
  groups: GrandMeleeMatchGroup[],
  recentOpponentsMap: Map<number, number[]>,
  standingsLPMap: Map<number, number>,
): void {
  const maxPasses = groups.length * 2;
  for (let pass = 0; pass < maxPasses; pass++) {
    let swapped = false;

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];

      for (let ri = 0; ri < group.robots.length; ri++) {
        const robot = group.robots[ri];
        const robotRecent = recentOpponentsMap.get(robot.id) || [];

        // Check if this robot has a recent opponent in the same group
        const conflictInGroup = group.robots.some(
          (other, idx) => idx !== ri && robotRecent.includes(other.id),
        );

        if (!conflictInGroup) continue;

        // Find a swap partner in an adjacent group
        let resolved = false;
        const adjacentIndices = [gi + 1, gi - 1].filter(i => i >= 0 && i < groups.length);

        for (const oi of adjacentIndices) {
          if (resolved) break;
          const otherGroup = groups[oi];

          for (let oj = 0; oj < otherGroup.robots.length; oj++) {
            const candidate = otherGroup.robots[oj];
            const candidateRecent = recentOpponentsMap.get(candidate.id) || [];

            // Check swap doesn't create new conflict in target group
            const candidateConflictsHere = group.robots.some(
              (other, idx) => idx !== ri && candidateRecent.includes(other.id),
            );
            const robotConflictsThere = otherGroup.robots.some(
              (other, idx) => idx !== oj && (recentOpponentsMap.get(other.id) || []).includes(robot.id),
            );

            // Check same-stable constraint isn't violated
            const candidateStableConflict = group.robots.some(
              (other, idx) => idx !== ri && other.userId === candidate.userId,
            );
            const robotStableConflict = otherGroup.robots.some(
              (other, idx) => idx !== oj && other.userId === robot.userId,
            );

            if (!candidateConflictsHere && !robotConflictsThere && !candidateStableConflict && !robotStableConflict) {
              // Evaluate LP-variance impact — only swap if it doesn't make things much worse
              const currentLPDiff = Math.abs(
                (standingsLPMap.get(robot.id) ?? 0) - (standingsLPMap.get(candidate.id) ?? 0)
              );
              // Allow swaps with up to 30 LP difference between the swapped robots
              if (currentLPDiff <= 30) {
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
    }

    if (!swapped) break;
  }
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run Grand Melee matchmaking for all tier/instances.
 *
 * Iterates tier → instance (from Standing where mode='grand_melee'), gets eligible
 * robots, groups using LP-banding, and persists via schedulingService.
 *
 * Requirements: 1.1, 4.1, 4.2, 4.3, 4.4
 *
 * @param scheduledFor - When the matches should be executed (default: 24h from now, rounded to hour)
 * @returns Total number of matches created
 */
export async function runGrandMeleeMatchmaking(scheduledFor?: Date): Promise<number> {
  const matchTime = scheduledFor ?? defaultScheduledFor();
  let totalMatches = 0;

  logger.info(`${LOG_PREFIX} Starting matchmaking for all tiers (scheduledFor: ${matchTime.toISOString()})...`);

  for (const tier of TEAM_BATTLE_LEAGUE_TIERS) {
    try {
      // Get all Grand Melee league instances for this tier from standings
      const instances = await prisma.standing.findMany({
        where: { mode: 'grand_melee' as any, tier },
        select: { leagueInstanceId: true },
        distinct: ['leagueInstanceId'],
      });

      const instanceIds = instances.map(i => i.leagueInstanceId);

      for (const instanceId of instanceIds) {
        try {
          // Get eligible robots for this instance
          const eligible = await getEligibleRobots(tier, instanceId);

          if (eligible.length < MIN_GROUP_SIZE) {
            logger.info(`${LOG_PREFIX} ${instanceId}: Insufficient eligible robots (${eligible.length}/${MIN_GROUP_SIZE}) — skipping`);
            continue;
          }

          // Build LP lookup map from standings
          const standingsLPMap = new Map(
            (await prisma.standing.findMany({
              where: { mode: 'grand_melee' as any, entityId: { in: eligible.map(r => r.id) } },
              select: { entityId: true, leaguePoints: true },
            })).map(s => [s.entityId, s.leaguePoints])
          );

          // Batch-fetch recent opponents using unified query
          const recentOpponentQueryFn = createRecentOpponentQueryFn(MatchType.grand_melee, 'robot');
          const recentOpponentsMap = await getRecentOpponentsBatch(
            eligible.map(r => r.id),
            recentOpponentQueryFn,
          );

          // Group robots using LP-banding
          const groups = groupByLPBanding(eligible, standingsLPMap, recentOpponentsMap);

          // Persist each group as a scheduled match
          for (const group of groups) {
            await schedulingService.createMatch({
              matchType: MatchType.grand_melee,
              scheduledFor: matchTime,
              leagueType: tier,
              leagueInstanceId: instanceId,
              participants: group.robots.map((robot, index) => ({
                participantType: 'robot' as const,
                participantId: robot.id,
                slot: index + 1,
              })),
            });
            totalMatches++;
          }

          if (groups.length > 0) {
            logger.info(`${LOG_PREFIX} ${instanceId}: Created ${groups.length} matches (${eligible.length} robots)`);
          }
        } catch (instanceError) {
          // Per-instance error isolation — log and continue
          logger.error(`${LOG_PREFIX} Error in instance ${instanceId}:`, instanceError);
        }
      }
    } catch (tierError) {
      // Per-tier error isolation — log and continue
      logger.error(`${LOG_PREFIX} Error in ${tier} tier:`, tierError);
    }
  }

  logger.info(`${LOG_PREFIX} ========================================`);
  logger.info(`${LOG_PREFIX} COMPLETE: ${totalMatches} Grand Melee matches created`);
  logger.info(`${LOG_PREFIX} ========================================`);

  return totalMatches;
}
