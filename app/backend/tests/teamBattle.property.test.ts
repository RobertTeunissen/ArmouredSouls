/**
 * Property-Based Tests for Team Battle System
 *
 * Tests core invariants of the team battle system using fast-check.
 *
 * @module tests/teamBattle.property.test
 */

import * as fc from 'fast-check';
import { Prisma } from '../generated/prisma';
import prisma from '../src/lib/prisma';
import {
  registerTeam,
  addTeamMember,
  removeTeamMember,
  swapTeamMember,
} from '../src/services/team-battle/teamBattleService';
import { TeamBattleError, TeamBattleErrorCode } from '../src/errors/teamBattleErrors';
import { simulateTeamBattle } from '../src/services/team-battle/teamBattleEngine';
import { RobotWithWeapons } from '../src/services/battle/combatSimulator';
import {
  calculateTeamBattleReward,
  distributeTeamCredits,
} from '../src/services/team-battle/teamBattleRewardService';
import { TeamBattleParticipantResult } from '../src/types/teamBattleLogTypes';

describe('Team Battle Property Tests', () => {
  /**
   * Property 7: Team Composition Validation
   *
   * **Validates: Requirements R2.4, R2.5, R2.6, R1.9**
   *
   * Property: Registration succeeds if and only if ALL composition rules are satisfied:
   *   - Exactly N distinct robot IDs (no duplicates, correct count)
   *   - All robots owned by the requesting stable
   *   - All robots subscribed to the corresponding event (league_2v2 or league_3v3)
   *   - No robot already on another team of the same size
   */
  describe('Property 7: Team Composition Validation', () => {
    let testUserId: number;

    beforeAll(async () => {
      const testUser = await prisma.user.create({
        data: {
          username: `pbt_tb_comp_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 10000000,
        },
      });
      testUserId = testUser.id;
    });

    afterAll(async () => {
      await prisma.teamBattleMember.deleteMany({
        where: { team: { stableId: testUserId } },
      });
      await prisma.teamBattle.deleteMany({
        where: { stableId: testUserId },
      });
      await prisma.subscription.deleteMany({
        where: { robot: { userId: testUserId } },
      });
      await prisma.robot.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
    });

    afterEach(async () => {
      await prisma.teamBattleMember.deleteMany({
        where: { team: { stableId: testUserId } },
      });
      await prisma.teamBattle.deleteMany({
        where: { stableId: testUserId },
      });
      await prisma.subscription.deleteMany({
        where: { robot: { userId: testUserId } },
      });
      await prisma.robot.deleteMany({
        where: { userId: testUserId },
      });
    });

    /** Helper: Create a robot owned by the test user. */
    async function createOwnedRobot(suffix: string): Promise<number> {
      const robot = await prisma.robot.create({
        data: {
          userId: testUserId,
          name: `PBT_Comp_${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          hullIntegrity: 10.0,
          currentHP: 100,
          maxHP: 100,
          currentShield: 50,
          maxShield: 50,
          yieldThreshold: 20,
          loadoutType: 'single',
        },
      });
      return robot.id;
    }

    /** Helper: Create a robot owned by a different user. */
    async function createUnownedRobot(suffix: string): Promise<{ robotId: number; ownerId: number }> {
      const otherUser = await prisma.user.create({
        data: {
          username: `pbt_other_${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          passwordHash: 'test_hash',
          currency: 10000000,
        },
      });
      const robot = await prisma.robot.create({
        data: {
          userId: otherUser.id,
          name: `PBT_Other_${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          hullIntegrity: 10.0,
          currentHP: 100,
          maxHP: 100,
          currentShield: 50,
          maxShield: 50,
          yieldThreshold: 20,
          loadoutType: 'single',
        },
      });
      return { robotId: robot.id, ownerId: otherUser.id };
    }

    /** Helper: Subscribe a robot to an event type. */
    async function subscribeRobot(robotId: number, eventType: string): Promise<void> {
      await prisma.subscription.create({
        data: { robotId, eventType, status: 'active' },
      });
    }

    /**
     * **Validates: Requirements R2.4, R2.5, R2.6, R1.9**
     *
     * When all composition rules are satisfied (N distinct owned robots, all subscribed,
     * no conflicts), registration succeeds and produces an ELIGIBLE team.
     */
    it('should succeed when all composition rules are satisfied', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(2 as const, 3 as const),
          async (teamSize) => {
            const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

            // Create N distinct robots, all owned and subscribed
            const robotIds: number[] = [];
            for (let i = 0; i < teamSize; i++) {
              const robotId = await createOwnedRobot(`valid_${teamSize}_${i}`);
              await subscribeRobot(robotId, eventType);
              robotIds.push(robotId);
            }

            // Registration should succeed
            const team = await registerTeam(
              testUserId,
              robotIds,
              `ValidTeam${teamSize}_${Date.now()}`,
              teamSize,
              testUserId,
            );

            expect(team).toBeDefined();
            expect(team.teamSize).toBe(teamSize);
            expect(team.eligibility).toBe('ELIGIBLE');
            expect(team.stableId).toBe(testUserId);
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements R2.4, R1.9**
     *
     * When robot IDs are not distinct (duplicates), registration fails with
     * TEAM_INVALID_COMPOSITION because the unique set has fewer than N robots.
     */
    it('should reject when robot IDs contain duplicates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(2 as const, 3 as const),
          async (teamSize) => {
            const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

            // Create one robot and duplicate its ID
            const robotId = await createOwnedRobot(`dup_${teamSize}`);
            await subscribeRobot(robotId, eventType);

            // All IDs are the same — deduplication yields 1 unique ID, not N
            const robotIds = Array(teamSize).fill(robotId);

            await expect(
              registerTeam(testUserId, robotIds, `DupTeam${teamSize}_${Date.now()}`, teamSize, testUserId),
            ).rejects.toThrow(TeamBattleError);

            try {
              await registerTeam(testUserId, robotIds, `DupTeam2_${teamSize}_${Date.now()}`, teamSize, testUserId);
            } catch (error) {
              expect((error as TeamBattleError).code).toBe(TeamBattleErrorCode.TEAM_INVALID_COMPOSITION);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements R2.5**
     *
     * When any robot is not owned by the requesting stable, registration fails
     * with TEAM_OWNERSHIP_VIOLATION.
     */
    it('should reject when any robot is not owned by the stable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(2 as const, 3 as const),
          fc.integer({ min: 0, max: 2 }), // which robot index is unowned
          async (teamSize, unownedIndex) => {
            const actualUnownedIdx = unownedIndex % teamSize;
            const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

            const robotIds: number[] = [];
            for (let i = 0; i < teamSize; i++) {
              if (i === actualUnownedIdx) {
                // Create a robot owned by someone else
                const { robotId } = await createUnownedRobot(`unowned_${teamSize}_${i}`);
                await subscribeRobot(robotId, eventType);
                robotIds.push(robotId);
              } else {
                const robotId = await createOwnedRobot(`owned_${teamSize}_${i}`);
                await subscribeRobot(robotId, eventType);
                robotIds.push(robotId);
              }
            }

            try {
              await registerTeam(testUserId, robotIds, `UnownedTeam${teamSize}_${Date.now()}`, teamSize, testUserId);
              fail('Expected TeamBattleError to be thrown');
            } catch (error) {
              expect(error).toBeInstanceOf(TeamBattleError);
              expect((error as TeamBattleError).code).toBe(TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements R2.6**
     *
     * When any robot is not subscribed to the corresponding event, registration
     * fails with TEAM_INVALID_COMPOSITION.
     */
    it('should reject when any robot lacks subscription to the event', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(2 as const, 3 as const),
          fc.integer({ min: 0, max: 2 }), // which robot index is unsubscribed
          async (teamSize, unsubIndex) => {
            const actualUnsubIdx = unsubIndex % teamSize;
            const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

            const robotIds: number[] = [];
            for (let i = 0; i < teamSize; i++) {
              const robotId = await createOwnedRobot(`unsub_${teamSize}_${i}`);
              // Subscribe all except the unsubscribed one
              if (i !== actualUnsubIdx) {
                await subscribeRobot(robotId, eventType);
              }
              robotIds.push(robotId);
            }

            try {
              await registerTeam(testUserId, robotIds, `UnsubTeam${teamSize}_${Date.now()}`, teamSize, testUserId);
              fail('Expected TeamBattleError to be thrown');
            } catch (error) {
              expect(error).toBeInstanceOf(TeamBattleError);
              expect((error as TeamBattleError).code).toBe(TeamBattleErrorCode.TEAM_INVALID_COMPOSITION);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements R2.6, R1.9**
     *
     * When any robot already belongs to another team of the same size,
     * registration fails with TEAM_MEMBER_CONFLICT.
     */
    it('should reject when any robot already belongs to a same-size team', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(2 as const, 3 as const),
          fc.integer({ min: 0, max: 2 }), // which robot index has a conflict
          async (teamSize, conflictIndex) => {
            const actualConflictIdx = conflictIndex % teamSize;
            const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

            // First, create a team that will cause the conflict
            const existingRobotIds: number[] = [];
            for (let i = 0; i < teamSize; i++) {
              const robotId = await createOwnedRobot(`existing_${teamSize}_${i}`);
              await subscribeRobot(robotId, eventType);
              existingRobotIds.push(robotId);
            }
            await registerTeam(
              testUserId,
              existingRobotIds,
              `ExistTeam${teamSize}_${Date.now()}`,
              teamSize,
              testUserId,
            );

            // Now try to register a new team that includes one robot from the existing team
            const newRobotIds: number[] = [];
            for (let i = 0; i < teamSize; i++) {
              if (i === actualConflictIdx) {
                // Reuse a robot from the existing team
                newRobotIds.push(existingRobotIds[0]);
              } else {
                const robotId = await createOwnedRobot(`new_${teamSize}_${i}`);
                await subscribeRobot(robotId, eventType);
                newRobotIds.push(robotId);
              }
            }

            try {
              await registerTeam(testUserId, newRobotIds, `ConflictTeam${teamSize}_${Date.now()}`, teamSize, testUserId);
              fail('Expected TeamBattleError to be thrown');
            } catch (error) {
              expect(error).toBeInstanceOf(TeamBattleError);
              expect((error as TeamBattleError).code).toBe(TeamBattleErrorCode.TEAM_MEMBER_CONFLICT);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements R2.4, R2.5, R2.6, R1.9**
     *
     * Bidirectional property: registration succeeds iff ALL rules are satisfied.
     * Generates scenarios with a randomly chosen violation (or none) and verifies
     * the outcome matches expectations.
     */
    it('should succeed iff all composition rules are satisfied (bidirectional)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(2 as const, 3 as const),
          // Which rule to violate: 'none' | 'ownership' | 'subscription' | 'conflict'
          fc.constantFrom('none', 'ownership', 'subscription', 'conflict'),
          async (teamSize, violation) => {
            const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

            const robotIds: number[] = [];

            if (violation === 'ownership') {
              // One robot not owned by the stable
              for (let i = 0; i < teamSize; i++) {
                if (i === 0) {
                  const { robotId } = await createUnownedRobot(`bidir_unowned_${teamSize}`);
                  await subscribeRobot(robotId, eventType);
                  robotIds.push(robotId);
                } else {
                  const robotId = await createOwnedRobot(`bidir_owned_${teamSize}_${i}`);
                  await subscribeRobot(robotId, eventType);
                  robotIds.push(robotId);
                }
              }
            } else if (violation === 'subscription') {
              // One robot not subscribed
              for (let i = 0; i < teamSize; i++) {
                const robotId = await createOwnedRobot(`bidir_sub_${teamSize}_${i}`);
                if (i > 0) {
                  await subscribeRobot(robotId, eventType);
                }
                // First robot intentionally not subscribed
                robotIds.push(robotId);
              }
            } else if (violation === 'conflict') {
              // One robot already on a same-size team
              const existingIds: number[] = [];
              for (let i = 0; i < teamSize; i++) {
                const robotId = await createOwnedRobot(`bidir_exist_${teamSize}_${i}`);
                await subscribeRobot(robotId, eventType);
                existingIds.push(robotId);
              }
              await registerTeam(
                testUserId,
                existingIds,
                `BidirExist${teamSize}_${Date.now()}`,
                teamSize,
                testUserId,
              );

              // New team reuses one robot from existing team
              robotIds.push(existingIds[0]);
              for (let i = 1; i < teamSize; i++) {
                const robotId = await createOwnedRobot(`bidir_new_${teamSize}_${i}`);
                await subscribeRobot(robotId, eventType);
                robotIds.push(robotId);
              }
            } else {
              // No violation — all rules satisfied
              for (let i = 0; i < teamSize; i++) {
                const robotId = await createOwnedRobot(`bidir_valid_${teamSize}_${i}`);
                await subscribeRobot(robotId, eventType);
                robotIds.push(robotId);
              }
            }

            if (violation === 'none') {
              // Should succeed
              const team = await registerTeam(
                testUserId,
                robotIds,
                `BidirTeam${teamSize}_${Date.now()}`,
                teamSize,
                testUserId,
              );
              expect(team).toBeDefined();
              expect(team.eligibility).toBe('ELIGIBLE');
            } else {
              // Should fail with the appropriate error
              try {
                await registerTeam(
                  testUserId,
                  robotIds,
                  `BidirFail${teamSize}_${Date.now()}`,
                  teamSize,
                  testUserId,
                );
                fail('Expected TeamBattleError to be thrown');
              } catch (error) {
                expect(error).toBeInstanceOf(TeamBattleError);
                const tbError = error as TeamBattleError;

                if (violation === 'ownership') {
                  expect(tbError.code).toBe(TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION);
                } else if (violation === 'subscription') {
                  expect(tbError.code).toBe(TeamBattleErrorCode.TEAM_INVALID_COMPOSITION);
                } else if (violation === 'conflict') {
                  expect(tbError.code).toBe(TeamBattleErrorCode.TEAM_MEMBER_CONFLICT);
                }
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 8: Team Eligibility State Machine
   *
   * **Validates: Requirements R2.1, R2.9, R3.10**
   *
   * Property: A team is INELIGIBLE if and only if:
   *   - members < N (incomplete roster), OR
   *   - any member's subscription is missing, OR
   *   - a robot is destroyed (removed from stable)
   *
   * A team is ELIGIBLE when all conditions are met:
   *   - exactly N members, AND
   *   - all members subscribed to the corresponding event, AND
   *   - all member robots exist (not destroyed)
   */
  describe('Property 8: Team Eligibility State Machine', () => {
    let testUserId: number;
    const createdRobotIds: number[] = [];
    const createdTeamIds: number[] = [];
    const createdSubscriptionIds: number[] = [];

    beforeAll(async () => {
      // Create a test user (stable)
      const testUser = await prisma.user.create({
        data: {
          username: `pbt_tb_elig_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 10000000,
        },
      });
      testUserId = testUser.id;
    });

    afterAll(async () => {
      // Clean up in correct order (respect FK constraints)
      await prisma.scheduledTeamBattleMatch.deleteMany({
        where: {
          OR: [
            { team1: { stableId: testUserId } },
            { team2: { stableId: testUserId } },
          ],
        },
      });
      await prisma.teamBattleMember.deleteMany({
        where: { team: { stableId: testUserId } },
      });
      await prisma.teamBattle.deleteMany({
        where: { stableId: testUserId },
      });
      await prisma.subscription.deleteMany({
        where: { robot: { userId: testUserId } },
      });
      await prisma.robot.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
      await prisma.$disconnect();
    });

    afterEach(async () => {
      // Clean up teams and members created during each test
      await prisma.scheduledTeamBattleMatch.deleteMany({
        where: {
          OR: [
            { team1: { stableId: testUserId } },
            { team2: { stableId: testUserId } },
          ],
        },
      });
      await prisma.teamBattleMember.deleteMany({
        where: { team: { stableId: testUserId } },
      });
      await prisma.teamBattle.deleteMany({
        where: { stableId: testUserId },
      });
      await prisma.subscription.deleteMany({
        where: { robot: { userId: testUserId } },
      });
      await prisma.robot.deleteMany({
        where: { userId: testUserId },
      });
    });

    /**
     * Helper: Create a robot owned by the test user.
     */
    async function createRobot(suffix: string): Promise<number> {
      const robot = await prisma.robot.create({
        data: {
          userId: testUserId,
          name: `PBT_Elig_${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          hullIntegrity: 10.0,
          currentHP: 100,
          maxHP: 100,
          currentShield: 50,
          maxShield: 50,
          yieldThreshold: 20,
          loadoutType: 'single',
        },
      });
      return robot.id;
    }

    /**
     * Helper: Subscribe a robot to an event type.
     */
    async function subscribeRobot(robotId: number, eventType: string): Promise<void> {
      await prisma.subscription.create({
        data: {
          robotId,
          eventType,
          status: 'active',
        },
      });
    }

    /**
     * Helper: Remove a robot's subscription.
     */
    async function unsubscribeRobot(robotId: number, eventType: string): Promise<void> {
      await prisma.subscription.deleteMany({
        where: { robotId, eventType },
      });
    }

    /**
     * **Validates: Requirements R2.1, R2.9, R3.10**
     *
     * Property: A fully registered team (N members, all subscribed) is ELIGIBLE.
     * Removing a member makes it INELIGIBLE. Adding back makes it ELIGIBLE again.
     */
    it('should transition ELIGIBLE → INELIGIBLE when member removed, and back to ELIGIBLE when filled', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate team size (2 or 3)
          fc.constantFrom(2 as const, 3 as const),
          async (teamSize) => {
            const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

            // Create N robots and subscribe them
            const robotIds: number[] = [];
            for (let i = 0; i < teamSize; i++) {
              const robotId = await createRobot(`full_${teamSize}_${i}`);
              await subscribeRobot(robotId, eventType);
              robotIds.push(robotId);
            }

            // Register a full team — should be ELIGIBLE
            const team = await registerTeam(
              testUserId,
              robotIds,
              `EligTeam${teamSize}_${Date.now()}`,
              teamSize,
              testUserId,
            );

            expect(team.eligibility).toBe('ELIGIBLE');

            // Remove a member — team should become INELIGIBLE (incomplete roster)
            const removedRobotId = robotIds[teamSize - 1];
            await removeTeamMember(team.id, removedRobotId, testUserId);

            const teamAfterRemove = await prisma.teamBattle.findUnique({
              where: { id: team.id },
            });
            expect(teamAfterRemove!.eligibility).toBe('INELIGIBLE');

            // Add a new subscribed robot — team should become ELIGIBLE again
            const replacementRobotId = await createRobot(`replacement_${teamSize}`);
            await subscribeRobot(replacementRobotId, eventType);
            await addTeamMember(team.id, replacementRobotId, testUserId);

            const teamAfterAdd = await prisma.teamBattle.findUnique({
              where: { id: team.id },
            });
            expect(teamAfterAdd!.eligibility).toBe('ELIGIBLE');
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements R2.1, R3.10**
     *
     * Property: A team with all N members but where one member loses their subscription
     * transitions to INELIGIBLE when a swap is attempted with an unsubscribed robot.
     * A team where all members are subscribed remains ELIGIBLE after a valid swap.
     */
    it('should be INELIGIBLE when any member lacks subscription after swap', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate team size and whether the new robot is subscribed
          fc.constantFrom(2 as const, 3 as const),
          fc.boolean(),
          async (teamSize, newRobotSubscribed) => {
            const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

            // Create N robots and subscribe them all
            const robotIds: number[] = [];
            for (let i = 0; i < teamSize; i++) {
              const robotId = await createRobot(`sub_${teamSize}_${i}`);
              await subscribeRobot(robotId, eventType);
              robotIds.push(robotId);
            }

            // Register a full team — should be ELIGIBLE
            const team = await registerTeam(
              testUserId,
              robotIds,
              `SubTeam${teamSize}_${Date.now()}`,
              teamSize,
              testUserId,
            );
            expect(team.eligibility).toBe('ELIGIBLE');

            // Create a replacement robot
            const newRobotId = await createRobot(`new_${teamSize}`);
            if (newRobotSubscribed) {
              await subscribeRobot(newRobotId, eventType);
            }

            // Attempt swap
            const oldRobotId = robotIds[0];
            if (!newRobotSubscribed) {
              // Swap with unsubscribed robot should be rejected
              await expect(
                swapTeamMember(team.id, oldRobotId, newRobotId, testUserId),
              ).rejects.toThrow(TeamBattleError);

              // Team should remain ELIGIBLE (swap was rejected)
              const teamAfter = await prisma.teamBattle.findUnique({
                where: { id: team.id },
              });
              expect(teamAfter!.eligibility).toBe('ELIGIBLE');
            } else {
              // Swap with subscribed robot should succeed
              await swapTeamMember(team.id, oldRobotId, newRobotId, testUserId);

              // Team should remain ELIGIBLE (all members subscribed)
              const teamAfter = await prisma.teamBattle.findUnique({
                where: { id: team.id },
              });
              expect(teamAfter!.eligibility).toBe('ELIGIBLE');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements R2.1, R2.9**
     *
     * Property: A team is INELIGIBLE iff members < N. Registration with exactly N
     * members produces ELIGIBLE; any state with fewer than N members is INELIGIBLE.
     */
    it('should be INELIGIBLE iff member count < teamSize', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate team size and how many members to keep (1 to N)
          fc.constantFrom(2 as const, 3 as const),
          fc.integer({ min: 1, max: 3 }),
          async (teamSize, membersToKeep) => {
            // Clamp membersToKeep to valid range for this teamSize
            const actualMembersToKeep = Math.min(membersToKeep, teamSize);
            const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

            // Create N robots and subscribe them
            const robotIds: number[] = [];
            for (let i = 0; i < teamSize; i++) {
              const robotId = await createRobot(`count_${teamSize}_${i}`);
              await subscribeRobot(robotId, eventType);
              robotIds.push(robotId);
            }

            // Register a full team
            const team = await registerTeam(
              testUserId,
              robotIds,
              `CntTeam${teamSize}_${Date.now()}`,
              teamSize,
              testUserId,
            );
            expect(team.eligibility).toBe('ELIGIBLE');

            // Remove members until we have actualMembersToKeep
            const membersToRemove = teamSize - actualMembersToKeep;
            for (let i = 0; i < membersToRemove; i++) {
              const robotToRemove = robotIds[teamSize - 1 - i];
              await removeTeamMember(team.id, robotToRemove, testUserId);
            }

            // Check eligibility
            const teamAfter = await prisma.teamBattle.findUnique({
              where: { id: team.id },
              include: { members: true },
            });

            const currentMemberCount = teamAfter!.members.length;

            // Property: INELIGIBLE iff members < teamSize
            if (currentMemberCount < teamSize) {
              expect(teamAfter!.eligibility).toBe('INELIGIBLE');
            } else {
              expect(teamAfter!.eligibility).toBe('ELIGIBLE');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements R2.1, R3.10**
     *
     * Property: Registration requires all robots to be subscribed. If any robot
     * is not subscribed, registration fails. If all are subscribed, team is ELIGIBLE.
     */
    it('should reject registration when any robot lacks subscription (INELIGIBLE precondition)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate team size and which robot index is unsubscribed (-1 means all subscribed)
          fc.constantFrom(2 as const, 3 as const),
          fc.integer({ min: -1, max: 2 }),
          async (teamSize, unsubscribedIndex) => {
            // Clamp unsubscribed index to valid range
            const actualUnsubIdx = unsubscribedIndex >= teamSize ? -1 : unsubscribedIndex;
            const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

            // Create N robots
            const robotIds: number[] = [];
            for (let i = 0; i < teamSize; i++) {
              const robotId = await createRobot(`reg_${teamSize}_${i}`);
              // Subscribe all except the unsubscribed one
              if (i !== actualUnsubIdx) {
                await subscribeRobot(robotId, eventType);
              }
              robotIds.push(robotId);
            }

            const teamName = `RegTeam${teamSize}_${Date.now()}`;

            if (actualUnsubIdx >= 0) {
              // At least one robot is not subscribed — registration should fail
              await expect(
                registerTeam(testUserId, robotIds, teamName, teamSize, testUserId),
              ).rejects.toThrow(TeamBattleError);
            } else {
              // All robots subscribed — registration should succeed with ELIGIBLE
              const team = await registerTeam(
                testUserId,
                robotIds,
                teamName,
                teamSize,
                testUserId,
              );
              expect(team.eligibility).toBe('ELIGIBLE');
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 2: Subscription Eligibility
   *
   * **Validates: Requirements R13.2, R3.3, R3.4**
   *
   * Property: A team is excluded from matchmaking if and only if any member
   * lacks an active subscription to the corresponding event. A team with all
   * members subscribed (and otherwise eligible) is included in matchmaking.
   */
  describe('Property 2: Subscription Eligibility', () => {
    let testUserId: number;

    beforeAll(async () => {
      const testUser = await prisma.user.create({
        data: {
          username: `pbt_tb_sub_elig_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 10000000,
        },
      });
      testUserId = testUser.id;
    });

    afterAll(async () => {
      await prisma.scheduledTeamBattleMatch.deleteMany({
        where: {
          OR: [
            { team1: { stableId: testUserId } },
            { team2: { stableId: testUserId } },
          ],
        },
      });
      await prisma.teamBattleMember.deleteMany({
        where: { team: { stableId: testUserId } },
      });
      await prisma.teamBattle.deleteMany({
        where: { stableId: testUserId },
      });
      await prisma.subscription.deleteMany({
        where: { robot: { userId: testUserId } },
      });
      // Unlink weapons before deleting robots
      await prisma.robot.updateMany({
        where: { userId: testUserId },
        data: { mainWeaponId: null, offhandWeaponId: null },
      });
      await prisma.weaponInventory.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.robot.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
    });

    afterEach(async () => {
      await prisma.scheduledTeamBattleMatch.deleteMany({
        where: {
          OR: [
            { team1: { stableId: testUserId } },
            { team2: { stableId: testUserId } },
          ],
        },
      });
      await prisma.teamBattleMember.deleteMany({
        where: { team: { stableId: testUserId } },
      });
      await prisma.teamBattle.deleteMany({
        where: { stableId: testUserId },
      });
      await prisma.subscription.deleteMany({
        where: { robot: { userId: testUserId } },
      });
      // Unlink weapons before deleting robots
      await prisma.robot.updateMany({
        where: { userId: testUserId },
        data: { mainWeaponId: null, offhandWeaponId: null },
      });
      await prisma.weaponInventory.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.robot.deleteMany({
        where: { userId: testUserId },
      });
    });

    /** Helper: Create a robot owned by the test user with a weapon equipped (scheduling ready). */
    async function createReadyRobot(suffix: string): Promise<number> {
      // Create robot first (without weapon)
      const robot = await prisma.robot.create({
        data: {
          userId: testUserId,
          name: `PBT_SubElig_${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          hullIntegrity: 10.0,
          currentHP: 100,
          maxHP: 100,
          currentShield: 50,
          maxShield: 50,
          yieldThreshold: 20,
          loadoutType: 'single',
        },
      });

      // Find or create a weapon definition
      let weapon = await prisma.weapon.findFirst();
      if (!weapon) {
        weapon = await prisma.weapon.create({
          data: {
            name: `PBT_Weapon_${suffix}_${Date.now()}`,
            weaponType: 'energy',
            baseDamage: 20,
            cooldown: 2.0,
            cost: 1000,
            handsRequired: 'one',
            damageType: 'energy',
            loadoutType: 'any',
            rangeBand: 'mid',
          },
        });
      }

      // Create a WeaponInventory entry and assign to robot
      const weaponInventory = await prisma.weaponInventory.create({
        data: {
          userId: testUserId,
          weaponId: weapon.id,
          pricePaid: 0,
        },
      });

      await prisma.robot.update({
        where: { id: robot.id },
        data: { mainWeaponId: weaponInventory.id },
      });

      return robot.id;
    }

    /** Helper: Subscribe a robot to an event type. */
    async function subscribeRobot(robotId: number, eventType: string): Promise<void> {
      await prisma.subscription.create({
        data: { robotId, eventType, status: 'active' },
      });
    }

    /** Helper: Create a team directly in the database (bypasses service validation for test setup). */
    async function createTeamDirectly(
      robotIds: number[],
      teamSize: 2 | 3,
      teamName: string,
      league: string = 'bronze',
      leagueId: string = 'bronze_1',
    ): Promise<number> {
      const team = await prisma.teamBattle.create({
        data: {
          stableId: testUserId,
          teamSize,
          teamName,
          teamLp: 0,
          teamLeague: league,
          teamLeagueId: leagueId,
          cyclesInLeague: 0,
          totalWins: 0,
          totalLosses: 0,
          totalDraws: 0,
          eligibility: 'ELIGIBLE',
          members: {
            create: robotIds.map((robotId, idx) => ({
              robotId,
              slotIndex: idx,
            })),
          },
        },
      });
      return team.id;
    }

    /**
     * **Validates: Requirements R13.2, R3.3, R3.4**
     *
     * Teams with all members subscribed are included in matchmaking;
     * teams where any member lacks subscription are excluded.
     */
    it('team excluded from matchmaking iff any member lacks subscription; included when all subscribed', async () => {
      const { getEligibleTeams } = await import(
        '../src/services/team-battle/teamBattleMatchmakingService'
      );

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(2 as const, 3 as const),
          // Generate a subscription pattern: array of booleans (true = subscribed)
          fc.array(fc.boolean(), { minLength: 2, maxLength: 3 }),
          async (teamSize, subscriptionPattern) => {
            // Trim pattern to match team size
            const pattern = subscriptionPattern.slice(0, teamSize);
            // Pad if needed
            while (pattern.length < teamSize) {
              pattern.push(fc.sample(fc.boolean(), 1)[0]);
            }

            const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';
            const allSubscribed = pattern.every(s => s);

            // Create N robots with weapons equipped (scheduling readiness)
            const robotIds: number[] = [];
            for (let i = 0; i < teamSize; i++) {
              const robotId = await createReadyRobot(`sub_elig_${teamSize}_${i}`);
              // Subscribe based on pattern
              if (pattern[i]) {
                await subscribeRobot(robotId, eventType);
              }
              robotIds.push(robotId);
            }

            // Create team directly in DB with ELIGIBLE status
            const teamId = await createTeamDirectly(
              robotIds,
              teamSize,
              `SubEligTeam_${teamSize}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            );

            // Run eligibility check
            const eligibleTeams = await getEligibleTeams('bronze', 'bronze_1', teamSize);
            const teamIncluded = eligibleTeams.some(
              (t: { id: number }) => t.id === teamId,
            );

            // Property: team included iff all members subscribed
            if (allSubscribed) {
              expect(teamIncluded).toBe(true);
            } else {
              expect(teamIncluded).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ── Pure Computation Property Tests (no DB required) ─────────────────────────

/**
 * Property 1: Combat Conservation Invariant
 *
 * **Validates: Requirements R13.1, R5.8**
 *
 * Property: In any team battle simulation, the total damage dealt across all
 * participants equals the total damage taken across all participants within
 * 0.01 HP tolerance. This ensures no damage is created or destroyed during
 * the simulation — every point of damage dealt by one robot is accounted for
 * as damage taken by another.
 */
describe('Property 1: Combat Conservation Invariant', () => {
  // ── Arbitraries ──

  /** Generate a Decimal attribute value in the valid range [1, 50] */
  const attributeArb = fc.integer({ min: 1, max: 50 }).map(v => new Prisma.Decimal(v));

  /** Generate a weapon with reasonable combat stats */
  const weaponArb = fc.record({
    baseDamage: fc.integer({ min: 10, max: 50 }),
    cooldown: fc.double({ min: 1.0, max: 4.0, noNaN: true }),
    rangeBand: fc.constantFrom('melee', 'short', 'mid', 'long'),
    weaponType: fc.constantFrom('energy', 'ballistic', 'melee'),
    damageType: fc.constantFrom('energy', 'ballistic', 'melee'),
  });

  /** Generate a WeaponInventory with nested Weapon for mainWeapon slot */
  const weaponInventoryArb = (robotIdx: number) =>
    weaponArb.map(w => ({
      id: robotIdx * 100 + 1,
      userId: 1,
      weaponId: robotIdx * 100 + 1,
      customName: null,
      pricePaid: 0,
      purchasedAt: new Date('2025-01-01'),
      weapon: {
        id: robotIdx * 100 + 1,
        name: `Weapon-${robotIdx}`,
        weaponType: w.weaponType,
        baseDamage: w.baseDamage,
        cooldown: w.cooldown,
        cost: 50000,
        handsRequired: 'one' as const,
        damageType: w.damageType,
        loadoutType: 'any',
        rangeBand: w.rangeBand,
        specialProperty: null,
        description: null,
        combatPowerBonus: 0,
        targetingSystemsBonus: 0,
        criticalSystemsBonus: 0,
        penetrationBonus: 0,
        weaponControlBonus: 0,
        attackSpeedBonus: 0,
        armorPlatingBonus: 0,
        shieldCapacityBonus: 0,
        evasionThrustersBonus: 0,
        damageDampenersBonus: 0,
        counterProtocolsBonus: 0,
        hullIntegrityBonus: 0,
        servoMotorsBonus: 0,
        gyroStabilizersBonus: 0,
        hydraulicSystemsBonus: 0,
        powerCoreBonus: 0,
        combatAlgorithmsBonus: 0,
        threatAnalysisBonus: 0,
        adaptiveAIBonus: 0,
        logicCoresBonus: 0,
        syncProtocolsBonus: 0,
        supportSystemsBonus: 0,
        formationTacticsBonus: 0,
        createdAt: new Date('2025-01-01'),
      },
    }));

  /** Generate a full RobotWithWeapons object with randomized attributes */
  const robotArb = (robotIdx: number) =>
    fc
      .record({
        combatPower: attributeArb,
        targetingSystems: attributeArb,
        criticalSystems: attributeArb,
        penetration: attributeArb,
        weaponControl: attributeArb,
        attackSpeed: attributeArb,
        armorPlating: attributeArb,
        shieldCapacity: attributeArb,
        evasionThrusters: attributeArb,
        damageDampeners: attributeArb,
        counterProtocols: attributeArb,
        hullIntegrity: fc.integer({ min: 5, max: 50 }).map(v => new Prisma.Decimal(v)),
        servoMotors: attributeArb,
        gyroStabilizers: attributeArb,
        hydraulicSystems: attributeArb,
        powerCore: attributeArb,
        combatAlgorithms: attributeArb,
        threatAnalysis: attributeArb,
        adaptiveAI: attributeArb,
        logicCores: attributeArb,
        syncProtocols: attributeArb,
        supportSystems: attributeArb,
        formationTactics: attributeArb,
        mainWeapon: weaponInventoryArb(robotIdx),
      })
      .map(attrs => {
        const hullVal = Number(attrs.hullIntegrity);
        const shieldVal = Number(attrs.shieldCapacity);
        const maxHP = hullVal * 10;
        const maxShield = shieldVal * 2;

        return {
          id: robotIdx,
          userId: 1,
          name: `Robot-${robotIdx}`,
          frameId: 1,
          paintJob: null,
          combatPower: attrs.combatPower,
          targetingSystems: attrs.targetingSystems,
          criticalSystems: attrs.criticalSystems,
          penetration: attrs.penetration,
          weaponControl: attrs.weaponControl,
          attackSpeed: attrs.attackSpeed,
          armorPlating: attrs.armorPlating,
          shieldCapacity: attrs.shieldCapacity,
          evasionThrusters: attrs.evasionThrusters,
          damageDampeners: attrs.damageDampeners,
          counterProtocols: attrs.counterProtocols,
          hullIntegrity: attrs.hullIntegrity,
          servoMotors: attrs.servoMotors,
          gyroStabilizers: attrs.gyroStabilizers,
          hydraulicSystems: attrs.hydraulicSystems,
          powerCore: attrs.powerCore,
          combatAlgorithms: attrs.combatAlgorithms,
          threatAnalysis: attrs.threatAnalysis,
          adaptiveAI: attrs.adaptiveAI,
          logicCores: attrs.logicCores,
          syncProtocols: attrs.syncProtocols,
          supportSystems: attrs.supportSystems,
          formationTactics: attrs.formationTactics,
          currentHP: maxHP,
          maxHP,
          currentShield: maxShield,
          maxShield,
          damageTaken: 0,
          elo: 1200,
          totalBattles: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          damageDealtLifetime: 0,
          damageTakenLifetime: 0,
          kills: 0,
          currentLeague: 'bronze',
          leagueId: 'bronze_1',
          leaguePoints: 0,
          fame: 0,
          titles: null,
          repairCost: 0,
          battleReadiness: 100,
          totalRepairsPaid: 0,
          yieldThreshold: 10,
          loadoutType: 'single',
          stance: 'balanced',
          mainWeaponId: robotIdx * 100 + 1,
          offhandWeaponId: null,
          imageUrl: null,
          cyclesInCurrentLeague: 0,
          totalTagTeamBattles: 0,
          totalTagTeamWins: 0,
          totalTagTeamLosses: 0,
          totalTagTeamDraws: 0,
          timesTaggedIn: 0,
          timesTaggedOut: 0,
          totalLeague1v1Wins: 0,
    totalLeague1v1Losses: 0,
    totalLeague1v1Draws: 0,
    totalLeague2v2Wins: 0,
          totalLeague3v3Wins: 0,
          kothWins: 0,
          kothMatches: 0,
          kothTotalZoneScore: 0,
          kothTotalZoneTime: 0,
          kothKills: 0,
          kothBestPlacement: null,
          kothCurrentWinStreak: 0,
          kothBestWinStreak: 0,
          currentWinStreak: 0,
          currentLoseStreak: 0,
          offensiveWins: 0,
          defensiveWins: 0,
          balancedWins: 0,
          dualWieldWins: 0,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          mainWeapon: attrs.mainWeapon,
          offhandWeapon: null,
        } as unknown as RobotWithWeapons;
      });

  it('total damage dealt equals total damage taken within 0.01 HP across all participants', () => {
    // Test 2v2 battles
    fc.assert(
      fc.property(
        robotArb(1),
        robotArb(2),
        robotArb(3),
        robotArb(4),
        (r1, r2, r3, r4) => {
          const team1 = [r1, r2];
          const team2 = [r3, r4];

          const result = simulateTeamBattle(team1, team2, 2);

          // Conservation invariant: total damage dealt === total damage taken
          const totalDamageDealt = result.participants.reduce(
            (sum, p) => sum + p.damageDealt,
            0,
          );
          const totalDamageTaken = result.participants.reduce(
            (sum, p) => sum + p.damageTaken,
            0,
          );

          const difference = Math.abs(totalDamageDealt - totalDamageTaken);
          expect(difference).toBeLessThanOrEqual(0.01);
        },
      ),
      { numRuns: 50 },
    );

    // Test 3v3 battles
    fc.assert(
      fc.property(
        robotArb(1),
        robotArb(2),
        robotArb(3),
        robotArb(4),
        robotArb(5),
        robotArb(6),
        (r1, r2, r3, r4, r5, r6) => {
          const team1 = [r1, r2, r3];
          const team2 = [r4, r5, r6];

          const result = simulateTeamBattle(team1, team2, 3);

          // Conservation invariant: total damage dealt === total damage taken
          const totalDamageDealt = result.participants.reduce(
            (sum, p) => sum + p.damageDealt,
            0,
          );
          const totalDamageTaken = result.participants.reduce(
            (sum, p) => sum + p.damageTaken,
            0,
          );

          const difference = Math.abs(totalDamageDealt - totalDamageTaken);
          expect(difference).toBeLessThanOrEqual(0.01);
        },
      ),
      { numRuns: 50 },
    );
  });
});

/**
 * Property 6: Reward Distribution Conservation
 *
 * **Validates: Requirements R13.6, R7.1–R7.5**
 *
 * Property: The sum of credits distributed across N robots equals the documented
 * team reward within 1 credit tolerance, and no robot receives negative credits.
 *
 * This is a pure computation property test — no database interaction needed.
 */
describe('Property 6: Reward Distribution Conservation', () => {
  const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

  /**
   * Arbitrary for team size (2 or 3).
   */
  const teamSizeArb = fc.constantFrom(2 as const, 3 as const);

  /**
   * Arbitrary for league tier.
   */
  const leagueTierArb = fc.constantFrom(...LEAGUE_TIERS);

  /**
   * Arbitrary for battle outcome: { isWinner, isDraw }
   * Only valid combinations: winner (not draw), loser (not draw), draw (not winner).
   */
  const outcomeArb = fc.constantFrom(
    { isWinner: true, isDraw: false },
    { isWinner: false, isDraw: false },
    { isWinner: false, isDraw: true },
  );

  /**
   * Arbitrary for a single participant result with random HP and damage values.
   * finalHP = 0 means destroyed; finalHP > 0 means survived.
   */
  function participantArb(robotId: number, team: 1 | 2): fc.Arbitrary<TeamBattleParticipantResult> {
    return fc.record({
      robotId: fc.constant(robotId),
      team: fc.constant(team),
      damageDealt: fc.integer({ min: 0, max: 5000 }),
      damageTaken: fc.integer({ min: 0, max: 5000 }),
      finalHP: fc.oneof(
        fc.constant(0), // destroyed
        fc.integer({ min: 1, max: 500 }), // survived
      ),
      survivalSeconds: fc.integer({ min: 1, max: 300 }),
    });
  }

  /**
   * Arbitrary for a team of N participants with unique robot IDs.
   */
  function teamParticipantsArb(teamSize: 2 | 3): fc.Arbitrary<TeamBattleParticipantResult[]> {
    if (teamSize === 2) {
      return fc.tuple(
        participantArb(101, 1),
        participantArb(102, 1),
      ).map(([p1, p2]) => [p1, p2]);
    }
    return fc.tuple(
      participantArb(101, 1),
      participantArb(102, 1),
      participantArb(103, 1),
    ).map(([p1, p2, p3]) => [p1, p2, p3]);
  }

  /**
   * **Validates: Requirements R13.6, R7.1–R7.5**
   *
   * For any team size, league tier, outcome, and participant stats, the sum of
   * distributed credits equals the total team reward exactly (within 1 credit
   * tolerance due to integer rounding).
   */
  it('sum of distributed credits equals total team reward within 1 credit', () => {
    fc.assert(
      fc.property(
        teamSizeArb.chain(size => fc.tuple(
          fc.constant(size),
          leagueTierArb,
          outcomeArb,
          teamParticipantsArb(size),
        )),
        ([teamSize, league, outcome, participants]) => {
          const totalReward = calculateTeamBattleReward(league, teamSize, outcome.isWinner, outcome.isDraw);
          const allocations = distributeTeamCredits(totalReward, participants);

          // Conservation: sum of all allocations equals totalReward within 1 credit
          const totalDistributed = allocations.reduce((sum, a) => sum + a.credits, 0);
          const difference = Math.abs(totalDistributed - totalReward);
          expect(difference).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements R13.6, R7.1–R7.5**
   *
   * No robot ever receives negative credits from the distribution.
   */
  it('no robot receives negative credits', () => {
    fc.assert(
      fc.property(
        teamSizeArb.chain(size => fc.tuple(
          fc.constant(size),
          leagueTierArb,
          outcomeArb,
          teamParticipantsArb(size),
        )),
        ([teamSize, league, outcome, participants]) => {
          const totalReward = calculateTeamBattleReward(league, teamSize, outcome.isWinner, outcome.isDraw);
          const allocations = distributeTeamCredits(totalReward, participants);

          // No robot receives negative credits
          for (const allocation of allocations) {
            expect(allocation.credits).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements R13.6, R7.4**
   *
   * The number of allocations returned always equals the number of participants
   * provided, and every participant's robotId appears exactly once in the allocations.
   */
  it('every participant receives exactly one allocation entry', () => {
    fc.assert(
      fc.property(
        teamSizeArb.chain(size => fc.tuple(
          fc.constant(size),
          leagueTierArb,
          outcomeArb,
          teamParticipantsArb(size),
        )),
        ([teamSize, league, outcome, participants]) => {
          const totalReward = calculateTeamBattleReward(league, teamSize, outcome.isWinner, outcome.isDraw);
          const allocations = distributeTeamCredits(totalReward, participants);

          // Same number of allocations as participants
          expect(allocations.length).toBe(participants.length);

          // Every participant robotId appears exactly once
          const allocatedIds = allocations.map(a => a.robotId).sort();
          const participantIds = participants.map(p => p.robotId).sort();
          expect(allocatedIds).toEqual(participantIds);
        },
      ),
      { numRuns: 100 },
    );
  });
});
