/**
 * KotH Matchmaking Service
 *
 * Distributes eligible robots into ELO-balanced groups of 5-6 for
 * King of the Hill matches using snake-draft ordering.
 *
 * Requirements: 16.1-16.7, 17.1-17.4, 18.7, 18.8
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface EligibleRobot {
  id: number;
  userId: number;
  elo: number;
  name: string;
}

export interface KothMatchGroup {
  robots: EligibleRobot[];
  totalElo: number;
  rotatingZone: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_GROUP_SIZE = 5;
const IDEAL_GROUP_SIZE = 6;
const LOG_PREFIX = '[KotH Matchmaking]';

// ─── Functions ───────────────────────────────────────────────────────────────

/**
 * Query all robots eligible for KotH matchmaking.
 *
 * Eligibility criteria:
 *  - Has at least one weapon equipped (mainWeaponId IS NOT NULL)
 *  - Not already scheduled for a KotH match (status = 'scheduled')
 *
 * All eligible robots participate. Multiple robots from the same stable (user)
 * are allowed, but will be separated into different groups by the post-draft
 * stable-conflict resolution step.
 *
 * Returns sorted by ELO descending.
 */
export async function getEligibleRobots(): Promise<EligibleRobot[]> {
  // Find robot IDs already scheduled for a KotH match
  const scheduledParticipants = await prisma.scheduledKothMatchParticipant.findMany({
    where: {
      match: { status: 'scheduled' },
    },
    select: { robotId: true },
  });
  const alreadyScheduledIds = new Set(scheduledParticipants.map((p) => p.robotId));

  // Fetch all weapon-ready robots (exclude system Bye Robot)
  const robots = await prisma.robot.findMany({
    where: {
      mainWeaponId: { not: null },
      name: { not: 'Bye Robot' },
    },
    select: {
      id: true,
      userId: true,
      elo: true,
      name: true,
    },
    orderBy: { elo: 'desc' },
  });

  // Exclude already-scheduled robots
  const eligible = robots
    .filter((r) => !alreadyScheduledIds.has(r.id))
    .map((r) => ({ id: r.id, userId: r.userId, elo: r.elo, name: r.name }));

  logger.info(
    `${LOG_PREFIX} ${eligible.length} eligible robots (${robots.length} weapon-ready, ${alreadyScheduledIds.size} already scheduled)`
  );

  return eligible;
}

/**
 * Distribute robots into ELO-balanced groups using snake-draft ordering.
 *
 * This is a PURE function (no DB access) — exported for testing.
 *
 * Snake-draft:
 *  - Sort by ELO descending
 *  - Round 1 (L→R): robot[0]→group[0], robot[1]→group[1], ..., robot[N-1]→group[N-1]
 *  - Round 2 (R→L): robot[N]→group[N-1], robot[N+1]→group[N-2], ..., robot[2N-1]→group[0]
 *  - Repeat until all robots assigned
 */
export function distributeIntoGroups(
  robots: EligibleRobot[],
  groupCount: number
): KothMatchGroup[] {
  if (groupCount <= 0) {
    return [];
  }

  // Sort by ELO descending (copy to avoid mutating input)
  const sorted = [...robots].sort((a, b) => b.elo - a.elo);

  // Initialise empty groups
  const groups: KothMatchGroup[] = Array.from({ length: groupCount }, () => ({
    robots: [],
    totalElo: 0,
    rotatingZone: false,
  }));

  // Snake-draft distribution
  // Pass 1 (L→R): groups 0,1,2,...,N-1
  // Pass 2 (R→L): groups N-2,N-3,...,0  (skip boundary — already got one)
  // Pass 3 (L→R): groups 1,2,...,N-1    (skip boundary — already got one)
  // This ensures even distribution across all groups.
  let groupIndex = 0;
  let direction = 1; // 1 = left-to-right, -1 = right-to-left

  for (const robot of sorted) {
    groups[groupIndex].robots.push(robot);
    groups[groupIndex].totalElo += robot.elo;

    // Advance index; reverse direction at boundaries
    const nextIndex = groupIndex + direction;
    if (nextIndex >= groupCount || nextIndex < 0) {
      direction *= -1;
    } else {
      groupIndex = nextIndex;
    }
  }

  return groups;
}

/**
 * Resolve stable conflicts: ensure no two robots from the same user (stable)
 * share a group. When a conflict is found, swap the duplicate with a robot
 * from another group that doesn't create a new conflict.
 *
 * This is a PURE function — exported for testing.
 * Mutates the groups in place. Best-effort: if a swap is impossible
 * (e.g. a user has more robots than groups), the conflict remains.
 */
export function resolveStableConflicts(groups: KothMatchGroup[]): void {
  const maxPasses = groups.length * 2; // safety limit
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
            // candidate must not share userId with current group (after swap)
            // and robot must not share userId with otherGroup (after swap)
            const candidateConflictsHere = seenUsers.has(candidate.userId);
            const robotConflictsThere = otherGroup.robots.some(
              (r, idx) => idx !== oj && r.userId === robot.userId,
            );

            if (!candidateConflictsHere && !robotConflictsThere) {
              // Swap
              group.robots[ri] = candidate;
              otherGroup.robots[oj] = robot;
              // Update totalElo
              group.totalElo += candidate.elo - robot.elo;
              otherGroup.totalElo += robot.elo - candidate.elo;
              seenUsers.add(candidate.userId);
              resolved = true;
              swapped = true;
              break;
            }
          }
        }
      }
    }

    if (!swapped) break; // No more conflicts
  }
}

/**
 * Orchestrate KotH matchmaking: eligibility → grouping → DB record creation.
 *
 * Group count calculation (no sit-outs):
 *  - eligible < 5 → skip
 *  - groupCount = ceil(eligible / 6)
 *  - All robots participate; most groups get 6, at most one gets 5
 *
 * Zone variant by day of week of scheduledFor:
 *  - Monday (1), Friday (5) → rotatingZone: false
 *  - Wednesday (3) → rotatingZone: true
 *
 * Returns number of matches created.
 */
export async function runKothMatchmaking(scheduledFor: Date): Promise<number> {
  logger.info(`${LOG_PREFIX} Starting matchmaking run for ${scheduledFor.toISOString()}`);

  // 1. Get eligible robots
  const eligible = await getEligibleRobots();

  if (eligible.length < MIN_GROUP_SIZE) {
    logger.info(
      `${LOG_PREFIX} Insufficient eligible robots (${eligible.length}/${MIN_GROUP_SIZE} required) — skipping`
    );
    return 0;
  }

  // 2. Calculate group count — no sit-outs, every eligible robot plays.
  // Target 6 robots per group. Use ceil(eligible / 6) groups.
  // Snake draft distributes evenly: most groups get 6, at most one gets 5.
  const groupCount = Math.ceil(eligible.length / IDEAL_GROUP_SIZE);

  logger.info(
    `${LOG_PREFIX} ${eligible.length} robots → ${groupCount} groups (target ${IDEAL_GROUP_SIZE}/group, sizes: ${groupCount > 0 ? `${Math.floor(eligible.length / groupCount)}-${Math.ceil(eligible.length / groupCount)}` : '0'})`
  );

  // 3. Distribute into groups
  const groups = distributeIntoGroups(eligible, groupCount);

  // 3b. Resolve stable conflicts — no two robots from the same user in one group
  resolveStableConflicts(groups);

  // Log actual group sizes
  const groupSizes = groups.map(g => g.robots.length);
  logger.info(`${LOG_PREFIX} Group sizes after distribution + stable resolution: [${groupSizes.join(', ')}]`);

  // 4. Determine zone variant by day of week
  const dayOfWeek = scheduledFor.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // getDay() returns 0-6 but getUTCDay() would be more predictable;
  // we use getDay() to match the scheduledFor's local interpretation
  const rotatingZone = dayOfWeek === 3; // Wednesday

  // Apply zone variant to all groups
  for (const group of groups) {
    group.rotatingZone = rotatingZone;
  }

  // 5. Create DB records in a transaction
  const matchesCreated = await prisma.$transaction(async (tx) => {
    let created = 0;

    for (const group of groups) {
      const match = await tx.scheduledKothMatch.create({
        data: {
          scheduledFor,
          status: 'scheduled',
          rotatingZone: group.rotatingZone,
        },
      });

      await tx.scheduledKothMatchParticipant.createMany({
        data: group.robots.map((robot) => ({
          matchId: match.id,
          robotId: robot.id,
        })),
      });

      created += 1;
    }

    return created;
  });

  logger.info(`${LOG_PREFIX} ========================================`);
  logger.info(`${LOG_PREFIX} COMPLETE: ${matchesCreated} KotH matches created`);
  logger.info(`${LOG_PREFIX} ========================================`);

  return matchesCreated;
}
