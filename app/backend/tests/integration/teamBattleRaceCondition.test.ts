/**
 * Race Condition Stress Test: Team Battles
 *
 * Fires parallel operations against the Team Battle system to verify that
 * concurrent access does not cause data corruption. The system uses
 * `pg_advisory_xact_lock` and Prisma interactive transactions for serialization.
 *
 * Key concurrency mechanisms tested:
 * - pg_advisory_xact_lock(2, robotId) prevents a robot from being placed on two teams
 * - Prisma interactive transactions ensure atomicity of multi-step operations
 * - isTeamLockedForBattle check prevents modifications during scheduled battles
 * - getEligibleTeams filters out already-scheduled teams
 *
 * Requirements: R13.7, R10.3
 */

import prisma from '../../src/lib/prisma';
import { registerTeam, swapTeamMember, disbandTeam } from '../../src/services/team-battle/teamBattleService';
import { runTeamBattleMatchmaking } from '../../src/services/team-battle/teamBattleMatchmakingService';
import { TeamBattleError, TeamBattleErrorCode } from '../../src/errors/teamBattleErrors';

// ─── Test Helpers ────────────────────────────────────────────────────────────

const TEST_PREFIX = `race_test_${Date.now()}`;
let cleanupUserIds: number[] = [];
let cleanupTeamIds: number[] = [];

async function createTestStableWithRobots(
  robotCount: number,
  options?: { elo?: number; league?: string; leagueId?: string },
): Promise<{ userId: number; robotIds: number[] }> {
  const user = await prisma.user.create({
    data: {
      username: `${TEST_PREFIX}_${Math.random().toString(36).slice(2, 8)}`,
      passwordHash: 'test_hash',
      currency: 10_000_000,
      prestige: 1000,
    },
  });
  cleanupUserIds.push(user.id);

  const weapon = await prisma.weapon.findFirst();
  if (!weapon) throw new Error('No weapons found. Run seed first.');

  const robotIds: number[] = [];
  for (let i = 0; i < robotCount; i++) {
    const weaponInv = await prisma.weaponInventory.create({
      data: { userId: user.id, weaponId: weapon.id, pricePaid: 0 },
    });

    const robot = await prisma.robot.create({
      data: {
        userId: user.id,
        name: `${TEST_PREFIX}_robot_${i}_${Math.random().toString(36).slice(2, 8)}`,
        elo: options?.elo ?? 1000,
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
        yieldThreshold: 20,
        loadoutType: 'single',
        mainWeaponId: weaponInv.id,
      },
    });
    robotIds.push(robot.id);
  }

  return { userId: user.id, robotIds };
}

async function subscribeRobots(robotIds: number[], eventType: string): Promise<void> {
  for (const robotId of robotIds) {
    await prisma.subscription.create({
      data: { robotId, eventType, status: 'active' },
    });
  }
}

async function cleanup(): Promise<void> {
  // Clean up in reverse dependency order
  if (cleanupTeamIds.length > 0) {
    await prisma.scheduledTeamBattleMatch.deleteMany({
      where: {
        OR: [
          { team1Id: { in: cleanupTeamIds } },
          { team2Id: { in: cleanupTeamIds } },
        ],
      },
    });
    await prisma.teamBattleMember.deleteMany({
      where: { teamId: { in: cleanupTeamIds } },
    });
    await prisma.teamBattle.deleteMany({
      where: { id: { in: cleanupTeamIds } },
    });
  }

  if (cleanupUserIds.length > 0) {
    // Clean up any remaining team battle data for these users
    const userTeams = await prisma.teamBattle.findMany({
      where: { stableId: { in: cleanupUserIds } },
      select: { id: true },
    });
    const userTeamIds = userTeams.map(t => t.id);

    if (userTeamIds.length > 0) {
      await prisma.scheduledTeamBattleMatch.deleteMany({
        where: {
          OR: [
            { team1Id: { in: userTeamIds } },
            { team2Id: { in: userTeamIds } },
          ],
        },
      });
      await prisma.teamBattleMember.deleteMany({
        where: { teamId: { in: userTeamIds } },
      });
      await prisma.teamBattle.deleteMany({
        where: { id: { in: userTeamIds } },
      });
    }

    // Clean up battle participants and subscriptions
    const userRobots = await prisma.robot.findMany({
      where: { userId: { in: cleanupUserIds } },
      select: { id: true },
    });
    const userRobotIds = userRobots.map(r => r.id);

    if (userRobotIds.length > 0) {
      await prisma.battleParticipant.deleteMany({
        where: { robotId: { in: userRobotIds } },
      });
      await prisma.subscription.deleteMany({
        where: { robotId: { in: userRobotIds } },
      });
    }

    await prisma.weaponInventory.deleteMany({
      where: { userId: { in: cleanupUserIds } },
    });
    await prisma.robot.deleteMany({
      where: { userId: { in: cleanupUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: cleanupUserIds } },
    });
  }

  cleanupUserIds = [];
  cleanupTeamIds = [];
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Team Battle Race Condition Stress Test', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  // ─── Test 1: Concurrent Registration with Same Robots ───────────────────

  describe('Concurrent team registration with the same robots', () => {
    it('should allow at most one registration to succeed when multiple attempts use the same robot', async () => {
      // Create a stable with 2 robots
      const { userId, robotIds } = await createTestStableWithRobots(2);
      await subscribeRobots(robotIds, 'league_2v2');

      // Fire 3 concurrent registration attempts with the same robots.
      // The advisory lock serializes access — one wins, others get TEAM_MEMBER_CONFLICT
      // or transaction timeout (both are acceptable failure modes).
      const attempts = Array.from({ length: 3 }, (_, i) =>
        registerTeam(userId, robotIds, `RaceTeam_${i}`, 2, userId)
          .then(team => ({ success: true as const, team }))
          .catch(err => ({ success: false as const, error: err })),
      );

      const results = await Promise.all(attempts);

      // At most one should succeed (advisory lock prevents double-registration)
      const successes = results.filter(r => r.success);
      expect(successes.length).toBeLessThanOrEqual(1);

      // Track for cleanup
      for (const s of successes) {
        if (s.success) cleanupTeamIds.push(s.team.id);
      }

      // All failures should be either TEAM_MEMBER_CONFLICT or transaction timeout
      const failures = results.filter(r => !r.success);
      for (const failure of failures) {
        if (!failure.success) {
          // Either a TeamBattleError (conflict detected) or a Prisma transaction error (timeout)
          const isConflict = failure.error instanceof TeamBattleError &&
            failure.error.code === TeamBattleErrorCode.TEAM_MEMBER_CONFLICT;
          const isTransactionError = failure.error?.message?.includes('transaction') ||
            failure.error?.message?.includes('timeout') ||
            failure.error?.message?.includes('expired');
          expect(isConflict || isTransactionError).toBe(true);
        }
      }

      // KEY INVARIANT: Regardless of which operations succeeded/failed,
      // each robot should be on at most one 2v2 team in the database.
      const memberships = await prisma.teamBattleMember.findMany({
        where: {
          robotId: { in: robotIds },
          team: { teamSize: 2 },
        },
      });

      // Group by robot — each should appear at most once
      const robotCounts = new Map<number, number>();
      for (const m of memberships) {
        robotCounts.set(m.robotId, (robotCounts.get(m.robotId) || 0) + 1);
      }
      for (const [_robotId, count] of robotCounts) {
        expect(count).toBeLessThanOrEqual(1);
      }

      // If any team was created, it should have exactly 2 members
      if (successes.length === 1 && successes[0].success) {
        const teamMembers = await prisma.teamBattleMember.findMany({
          where: { teamId: successes[0].team.id },
        });
        expect(teamMembers.length).toBe(2);
      }
    }, 30000);

    it('should prevent a robot from being on two teams of the same size under concurrent registration', async () => {
      // Create a stable with 4 robots, all subscribed to league_2v2
      const { userId, robotIds } = await createTestStableWithRobots(4);
      await subscribeRobots(robotIds, 'league_2v2');

      // Try to register two teams that share robot[1]:
      // Team A: [robot0, robot1], Team B: [robot1, robot2]
      // The advisory lock on robot[1] serializes these — at most one succeeds.
      const [resultA, resultB] = await Promise.all([
        registerTeam(userId, [robotIds[0], robotIds[1]], 'TeamA', 2, userId)
          .then(team => ({ success: true as const, team }))
          .catch(err => ({ success: false as const, error: err })),
        registerTeam(userId, [robotIds[1], robotIds[2]], 'TeamB', 2, userId)
          .then(team => ({ success: true as const, team }))
          .catch(err => ({ success: false as const, error: err })),
      ]);

      // At most one should succeed (the one that acquires the lock on robot[1] first)
      const successes = [resultA, resultB].filter(r => r.success);
      expect(successes.length).toBeLessThanOrEqual(1);

      // Track for cleanup
      for (const s of successes) {
        if (s.success) cleanupTeamIds.push(s.team.id);
      }

      // KEY INVARIANT: robot[1] is on at most one 2v2 team
      const robot1Memberships = await prisma.teamBattleMember.findMany({
        where: {
          robotId: robotIds[1],
          team: { teamSize: 2 },
        },
      });
      expect(robot1Memberships.length).toBeLessThanOrEqual(1);
    }, 30000);
  });

  // ─── Test 2: Concurrent Member Swap While Battle Scheduled ──────────────

  describe('Concurrent member swap while a battle is scheduled', () => {
    it('should block all swap attempts when team has a scheduled battle', async () => {
      // Create stable with 3 robots (2 on team + 1 spare)
      const { userId, robotIds } = await createTestStableWithRobots(3);
      await subscribeRobots(robotIds, 'league_2v2');

      // Register a team with first 2 robots
      const team = await registerTeam(userId, [robotIds[0], robotIds[1]], 'LockedTeam', 2, userId);
      cleanupTeamIds.push(team.id);

      // Create a scheduled match to lock the team
      await prisma.scheduledTeamBattleMatch.create({
        data: {
          team1Id: team.id,
          teamSize: 2,
          matchMode: 'league_2v2',
          teamBattleLeague: 'bronze',
          teamBattleLeagueId: 'bronze_1',
          scheduledFor: new Date(Date.now() + 86400000),
          status: 'scheduled',
        },
      });

      // Fire 10 concurrent swap attempts
      const swapAttempts = Array.from({ length: 10 }, () =>
        swapTeamMember(team.id, robotIds[0], robotIds[2], userId)
          .then(() => ({ success: true as const }))
          .catch(err => ({ success: false as const, error: err })),
      );

      const results = await Promise.all(swapAttempts);

      // All should fail with TEAM_LOCKED_FOR_BATTLE
      const successes = results.filter(r => r.success);
      expect(successes.length).toBe(0);

      for (const result of results) {
        if (!result.success) {
          expect(result.error).toBeInstanceOf(TeamBattleError);
          expect(result.error.code).toBe(TeamBattleErrorCode.TEAM_LOCKED_FOR_BATTLE);
        }
      }

      // Verify team composition unchanged
      const members = await prisma.teamBattleMember.findMany({
        where: { teamId: team.id },
        orderBy: { slotIndex: 'asc' },
      });
      expect(members.map(m => m.robotId)).toEqual([robotIds[0], robotIds[1]]);
    }, 30000);
  });

  // ─── Test 3: Concurrent Matchmaking Runs ────────────────────────────────

  describe('Concurrent matchmaking runs', () => {
    it('should not produce corrupt match records when matchmaking runs concurrently', async () => {
      // Create 4 stables with 2 robots each, all in bronze_1
      const stables: { userId: number; robotIds: number[] }[] = [];
      for (let i = 0; i < 4; i++) {
        const stable = await createTestStableWithRobots(2, {
          elo: 1000 + i * 50,
          league: 'bronze',
        });
        stables.push(stable);
        await subscribeRobots(stable.robotIds, 'league_2v2');
      }

      // Register teams
      const teams = [];
      for (let i = 0; i < stables.length; i++) {
        const team = await registerTeam(
          stables[i].userId,
          stables[i].robotIds,
          `MatchTeam_${i}`,
          2,
          stables[i].userId,
        );
        teams.push(team);
        cleanupTeamIds.push(team.id);
      }

      // Fire 3 concurrent matchmaking runs
      const matchmakingAttempts = Array.from({ length: 3 }, () =>
        runTeamBattleMatchmaking(2)
          .then(count => ({ success: true as const, count }))
          .catch(err => ({ success: false as const, error: err })),
      );

      const results = await Promise.all(matchmakingAttempts);

      // Verify data integrity: all scheduled matches should be well-formed
      const allScheduled = await prisma.scheduledTeamBattleMatch.findMany({
        where: {
          status: 'scheduled',
          teamSize: 2,
          OR: [
            { team1Id: { in: teams.map(t => t.id) } },
            { team2Id: { in: teams.map(t => t.id) } },
          ],
        },
        include: {
          team1: { include: { members: true } },
          team2: { include: { members: true } },
        },
      });

      // KEY INVARIANT 1: Every match record references valid teams with correct member counts
      for (const match of allScheduled) {
        expect(match.team1).toBeDefined();
        expect(match.team1.members.length).toBe(2);
        expect(match.teamSize).toBe(2);
        expect(match.status).toBe('scheduled');
        if (match.team2) {
          expect(match.team2.members.length).toBe(2);
        }
      }

      // KEY INVARIANT 2: No match references a team that doesn't exist
      const matchTeamIds = allScheduled.flatMap(m => [m.team1Id, m.team2Id].filter(Boolean)) as number[];
      const existingTeams = await prisma.teamBattle.findMany({
        where: { id: { in: matchTeamIds } },
        select: { id: true },
      });
      const existingTeamIdSet = new Set(existingTeams.map(t => t.id));
      for (const teamId of matchTeamIds) {
        expect(existingTeamIdSet.has(teamId)).toBe(true);
      }

      // KEY INVARIANT 3: No BattleParticipant links to a robot not in the producing team
      // (This is verified at execution time, but we can verify match structure here)
      for (const match of allScheduled) {
        const team1RobotIds = match.team1.members.map(m => m.robotId);
        // All team1 robots should belong to the team's stable
        const team1Robots = await prisma.robot.findMany({
          where: { id: { in: team1RobotIds } },
          select: { id: true, userId: true },
        });
        const stableId = match.team1.stableId;
        for (const robot of team1Robots) {
          expect(robot.userId).toBe(stableId);
        }
      }
    }, 60000);
  });

  // ─── Test 4: Concurrent Subscription Change During Matchmaking ──────────

  describe('Concurrent subscription changes while team is being matched', () => {
    it('should not produce matches with corrupt team data when subscriptions change concurrently', async () => {
      // Create 4 stables with 2 robots each
      const stables: { userId: number; robotIds: number[] }[] = [];
      for (let i = 0; i < 4; i++) {
        const stable = await createTestStableWithRobots(2, {
          elo: 1000,
          league: 'bronze',
        });
        stables.push(stable);
        await subscribeRobots(stable.robotIds, 'league_2v2');
      }

      // Register teams
      const teams = [];
      for (let i = 0; i < stables.length; i++) {
        const team = await registerTeam(
          stables[i].userId,
          stables[i].robotIds,
          `SubTeam_${i}`,
          2,
          stables[i].userId,
        );
        teams.push(team);
        cleanupTeamIds.push(team.id);
      }

      // Concurrently: run matchmaking AND remove subscription from team[0]'s first robot
      const [matchResult, _unsubResult] = await Promise.all([
        runTeamBattleMatchmaking(2)
          .then(count => ({ success: true as const, count }))
          .catch(err => ({ success: false as const, error: err })),
        prisma.subscription.deleteMany({
          where: {
            robotId: stables[0].robotIds[0],
            eventType: 'league_2v2',
          },
        }),
      ]);

      // KEY INVARIANT: All scheduled matches reference teams with correct member counts.
      // The system may or may not have matched team[0] depending on timing —
      // either outcome is acceptable, but no data corruption should exist.
      const allMatches = await prisma.scheduledTeamBattleMatch.findMany({
        where: {
          status: 'scheduled',
          teamSize: 2,
          OR: [
            { team1Id: { in: teams.map(t => t.id) } },
            { team2Id: { in: teams.map(t => t.id) } },
          ],
        },
        include: {
          team1: { include: { members: true } },
          team2: { include: { members: true } },
        },
      });

      for (const match of allMatches) {
        // Team 1 should have exactly 2 members
        expect(match.team1.members.length).toBe(2);
        // Team 2 (if not bye) should have exactly 2 members
        if (match.team2) {
          expect(match.team2.members.length).toBe(2);
        }
        // Match record should be well-formed
        expect(match.teamSize).toBe(2);
        expect(match.teamBattleLeague).toBeDefined();
        expect(match.teamBattleLeagueId).toBeDefined();
      }
    }, 60000);
  });

  // ─── Test 5: Concurrent Disband While Battle Scheduled ──────────────────

  describe('Concurrent disband while battle is scheduled', () => {
    it('should block all disband attempts when team has a scheduled battle', async () => {
      const { userId, robotIds } = await createTestStableWithRobots(2);
      await subscribeRobots(robotIds, 'league_2v2');

      const team = await registerTeam(userId, robotIds, 'DisbandRaceTeam', 2, userId);
      cleanupTeamIds.push(team.id);

      // Schedule a battle for this team
      await prisma.scheduledTeamBattleMatch.create({
        data: {
          team1Id: team.id,
          teamSize: 2,
          matchMode: 'league_2v2',
          teamBattleLeague: 'bronze',
          teamBattleLeagueId: 'bronze_1',
          scheduledFor: new Date(Date.now() + 86400000),
          status: 'scheduled',
        },
      });

      // Fire 10 concurrent disband attempts
      const disbandAttempts = Array.from({ length: 10 }, () =>
        disbandTeam(team.id, userId)
          .then(() => ({ success: true as const }))
          .catch(err => ({ success: false as const, error: err })),
      );

      const results = await Promise.all(disbandAttempts);

      // All should fail with TEAM_LOCKED_FOR_BATTLE
      const successes = results.filter(r => r.success);
      expect(successes.length).toBe(0);

      for (const result of results) {
        if (!result.success) {
          expect(result.error).toBeInstanceOf(TeamBattleError);
          expect(result.error.code).toBe(TeamBattleErrorCode.TEAM_LOCKED_FOR_BATTLE);
        }
      }

      // Verify team still exists with correct members
      const teamExists = await prisma.teamBattle.findUnique({
        where: { id: team.id },
        include: { members: true },
      });
      expect(teamExists).not.toBeNull();
      expect(teamExists!.members.length).toBe(2);
    }, 30000);
  });

  // ─── Test 6: High-Volume Sequential Registration Stress ─────────────────

  describe('High-volume registration stress', () => {
    it('should maintain data integrity across batched parallel registrations with unique robots', async () => {
      // Create 10 stables, each with 2 robots subscribed to league_2v2.
      // Each stable has unique robots, so all registrations should succeed.
      // We batch in groups of 5 to avoid overwhelming the connection pool.
      const stables: { userId: number; robotIds: number[] }[] = [];
      for (let i = 0; i < 10; i++) {
        const stable = await createTestStableWithRobots(2);
        stables.push(stable);
        await subscribeRobots(stable.robotIds, 'league_2v2');
      }

      // Register in batches of 5 to avoid transaction timeout from connection pool exhaustion
      const batchSize = 5;
      const allResults: { success: boolean; team?: any; error?: any }[] = [];

      for (let batch = 0; batch < stables.length; batch += batchSize) {
        const batchStables = stables.slice(batch, batch + batchSize);
        const batchResults = await Promise.all(
          batchStables.map((stable, i) =>
            registerTeam(stable.userId, stable.robotIds, `StressTeam_${batch + i}`, 2, stable.userId)
              .then(team => ({ success: true as const, team }))
              .catch(err => ({ success: false as const, error: err })),
          ),
        );
        allResults.push(...batchResults);
      }

      // All should succeed since each uses unique robots (no lock contention on same robot)
      const successes = allResults.filter(r => r.success);
      const failures = allResults.filter(r => !r.success);

      // Track for cleanup
      for (const s of successes) {
        if (s.success) cleanupTeamIds.push(s.team.id);
      }

      // All 10 should succeed — unique robots means no advisory lock contention
      expect(successes.length).toBe(10);
      expect(failures.length).toBe(0);

      // Verify data integrity invariants:

      // 1. No robot appears on more than one 2v2 team
      const allRobotIds = stables.flatMap(s => s.robotIds);
      const allMemberships = await prisma.teamBattleMember.findMany({
        where: {
          robotId: { in: allRobotIds },
          team: { teamSize: 2 },
        },
      });

      const robotTeamCount = new Map<number, number>();
      for (const membership of allMemberships) {
        robotTeamCount.set(membership.robotId, (robotTeamCount.get(membership.robotId) || 0) + 1);
      }
      for (const [_robotId, count] of robotTeamCount) {
        expect(count).toBe(1);
      }

      // 2. Each team has exactly 2 members
      const createdTeamIds = successes
        .filter((r): r is { success: true; team: any } => r.success)
        .map(r => r.team.id);

      for (const teamId of createdTeamIds) {
        const members = await prisma.teamBattleMember.findMany({
          where: { teamId },
        });
        expect(members.length).toBe(2);
      }

      // 3. Total memberships = 10 teams × 2 members = 20
      expect(allMemberships.length).toBe(20);
    }, 120000);
  });

  // ─── Test 7: Concurrent Registration + Disband Race ─────────────────────

  describe('Concurrent registration and disband on same robots', () => {
    it('should not leave orphaned members or corrupt state', async () => {
      const { userId, robotIds } = await createTestStableWithRobots(2);
      await subscribeRobots(robotIds, 'league_2v2');

      // Register a team first
      const team = await registerTeam(userId, robotIds, 'OrphanTest', 2, userId);
      cleanupTeamIds.push(team.id);

      // Verify subscription exists before concurrent operations
      const subCount = await prisma.subscription.count({
        where: { robotId: { in: robotIds }, eventType: 'league_2v2', status: 'active' },
      });
      expect(subCount).toBe(2);

      // Concurrently: try to disband AND try to register a new team with same robots.
      // The advisory lock on the robots serializes these operations.
      // Possible outcomes:
      //   - Disband succeeds, register gets MEMBER_CONFLICT (robots still on team when checked)
      //   - Disband succeeds, register succeeds (robots freed before register checks)
      //   - Both fail due to transaction timeout (acceptable under contention)
      //   - Register fails with subscription error (isRobotSubscribedTo uses global client)
      const [disbandResult, registerResult] = await Promise.all([
        disbandTeam(team.id, userId)
          .then(() => ({ success: true as const }))
          .catch(err => ({ success: false as const, error: err })),
        // Small delay to let disband acquire locks first, making the race more interesting
        new Promise(resolve => setTimeout(resolve, 10)).then(() =>
          registerTeam(userId, robotIds, 'NewTeam', 2, userId)
            .then(newTeam => ({ success: true as const, team: newTeam }))
            .catch(err => ({ success: false as const, error: err })),
        ),
      ]);

      // Track new team for cleanup if created
      if (registerResult.success) {
        cleanupTeamIds.push(registerResult.team.id);
      }

      // KEY INVARIANT: No orphaned state — verify database consistency
      const remainingMembers = await prisma.teamBattleMember.findMany({
        where: { robotId: { in: robotIds } },
        include: { team: true },
      });

      // Each robot should be on at most one team
      const robotMembershipCount = new Map<number, number>();
      for (const member of remainingMembers) {
        robotMembershipCount.set(member.robotId, (robotMembershipCount.get(member.robotId) || 0) + 1);
      }
      for (const [_robotId, count] of robotMembershipCount) {
        expect(count).toBeLessThanOrEqual(1);
      }

      // If a team exists for this user, it should have exactly 2 members (no partial state)
      const existingTeams = await prisma.teamBattle.findMany({
        where: { stableId: userId, teamSize: 2 },
        include: { members: true },
      });
      for (const existingTeam of existingTeams) {
        expect(existingTeam.members.length).toBe(2);
        cleanupTeamIds.push(existingTeam.id);
      }

      // Verify: either the original team was disbanded or it still exists intact
      const originalTeam = await prisma.teamBattle.findUnique({
        where: { id: team.id },
        include: { members: true },
      });
      if (originalTeam) {
        // If it still exists, it should have exactly 2 members
        expect(originalTeam.members.length).toBe(2);
      }
    }, 30000);
  });
});
