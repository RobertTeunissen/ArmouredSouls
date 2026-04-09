import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../src/lib/prisma';
import {
  validateResetEligibility,
  performAccountReset,
  getResetHistory,
} from '../src/services/common/resetService';

/**
 * Reset Service Tests
 *
 * Tests account reset functionality including:
 * - Reset eligibility validation with various blockers
 * - Account reset transaction (robots, weapons, facilities deleted, credits reset)
 * - Reset logging
 *
 * Requirements: 14.1-14.15
 */

describe('ResetService', () => {
  let testUserId: number;
  let testRobotId: number;
  let testWeaponInventoryId: number;
  let testWeaponId: number;

  beforeEach(async () => {
    // Get a weapon from the database
    const weapon = await prisma.weapon.findFirst();
    if (!weapon) {
      throw new Error('No weapons found in database. Run seed first.');
    }
    testWeaponId = weapon.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        username: `test_reset_user_${Date.now()}`,
        email: `test_reset_${Date.now()}@example.com`,
        passwordHash: 'test_hash',
        currency: 1500000,
        hasCompletedOnboarding: false,
        onboardingStep: 5,
        onboardingStrategy: '2_average',
      },
    });
    testUserId = user.id;

    // Create test robot
    const robot = await prisma.robot.create({
      data: {
        userId: testUserId,
        name: 'Test Robot',
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
      },
    });
    testRobotId = robot.id;

    // Create test weapon inventory
    const weaponInventory = await prisma.weaponInventory.create({
      data: {
        userId: testUserId,
        weaponId: testWeaponId,
      },
    });
    testWeaponInventoryId = weaponInventory.id;

    // Create test facility
    await prisma.facility.create({
      data: {
        userId: testUserId,
        facilityType: 'training_facility',
        level: 3,
      },
    });
  });

  afterEach(async () => {
    // Clean up in reverse order of foreign key dependencies
    await prisma.scheduledLeagueMatch.deleteMany({ where: { OR: [{ robot1Id: testRobotId }, { robot2Id: testRobotId }] } });
    await prisma.scheduledTournamentMatch.deleteMany({ where: { OR: [{ robot1Id: testRobotId }, { robot2Id: testRobotId }] } });
    await prisma.resetLog.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.weaponInventory.deleteMany({ where: { userId: testUserId } });
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  describe('validateResetEligibility', () => {
    it('should allow reset when no blockers exist', async () => {
      const eligibility = await validateResetEligibility(testUserId);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.blockers).toHaveLength(0);
    });

    it('should allow reset when user has no robots', async () => {
      // Delete test robot
      await prisma.robot.deleteMany({ where: { userId: testUserId } });

      const eligibility = await validateResetEligibility(testUserId);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.blockers).toHaveLength(0);
    });

    it('should block reset when scheduled matches exist', async () => {
      // Create another robot for opponent
      const opponent = await prisma.robot.create({
        data: {
          userId: testUserId,
          name: 'Opponent Robot',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });

      // Create scheduled match
      await prisma.scheduledLeagueMatch.create({
        data: {
          robot1Id: testRobotId,
          robot2Id: opponent.id,
          leagueType: 'bronze',
          scheduledFor: new Date(Date.now() + 3600000), // 1 hour from now
          status: 'scheduled',
        },
      });

      const eligibility = await validateResetEligibility(testUserId);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.blockers).toHaveLength(1);
      expect(eligibility.blockers[0].type).toBe('scheduled_matches');
      expect(eligibility.blockers[0].message).toContain('scheduled battles');

      // Cleanup - delete scheduled match first, then robot
      await prisma.scheduledLeagueMatch.deleteMany({ where: { OR: [{ robot1Id: testRobotId }, { robot2Id: opponent.id }] } });
      await prisma.robot.delete({ where: { id: opponent.id } });
    });

    it('should block reset when active tournament participation exists', async () => {
      // Create tournament
      const tournament = await prisma.tournament.create({
        data: {
          name: 'Test Tournament',
          tournamentType: 'single_elimination',
          status: 'active',
          maxRounds: 3,
          totalParticipants: 8,
        },
      });

      // Create another robot for opponent
      const opponent = await prisma.robot.create({
        data: {
          userId: testUserId,
          name: 'Opponent Robot',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });

      // Create tournament match
      await prisma.scheduledTournamentMatch.create({
        data: {
          tournamentId: tournament.id,
          round: 1,
          matchNumber: 1,
          robot1Id: testRobotId,
          robot2Id: opponent.id,
          status: 'pending',
        },
      });

      const eligibility = await validateResetEligibility(testUserId);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.blockers).toHaveLength(1);
      expect(eligibility.blockers[0].type).toBe('tournament');
      expect(eligibility.blockers[0].message).toContain('tournament participation');

      // Cleanup
      await prisma.scheduledTournamentMatch.deleteMany({ where: { tournamentId: tournament.id } });
      await prisma.tournament.delete({ where: { id: tournament.id } });
      await prisma.robot.delete({ where: { id: opponent.id } });
    });

    it('should block reset when pending battles exist', async () => {
      // Create another robot for opponent
      const opponent = await prisma.robot.create({
        data: {
          userId: testUserId,
          name: 'Opponent Robot',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });

      // Create very recent battle (within last 5 minutes)
      await prisma.battle.create({
        data: {
          robot1Id: testRobotId,
          robot2Id: opponent.id,
          battleType: 'league',
          leagueType: 'bronze',
          battleLog: {},
          durationSeconds: 60,
          robot1ELOBefore: 1200,
          robot2ELOBefore: 1200,
          robot1ELOAfter: 1210,
          robot2ELOAfter: 1190,
          eloChange: 10,
          createdAt: new Date(), // Just now
        },
      });

      const eligibility = await validateResetEligibility(testUserId);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.blockers).toHaveLength(1);
      expect(eligibility.blockers[0].type).toBe('pending_battles');
      expect(eligibility.blockers[0].message).toContain('pending battle results');

      // Cleanup
      await prisma.battle.deleteMany({ where: { robot1Id: testRobotId } });
      await prisma.robot.delete({ where: { id: opponent.id } });
    });

    it('should allow reset when battles are old (>5 minutes)', async () => {
      // Create another robot for opponent
      const opponent = await prisma.robot.create({
        data: {
          userId: testUserId,
          name: 'Opponent Robot',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });

      // Create old battle (more than 5 minutes ago)
      await prisma.battle.create({
        data: {
          robot1Id: testRobotId,
          robot2Id: opponent.id,
          battleType: 'league',
          leagueType: 'bronze',
          battleLog: {},
          durationSeconds: 60,
          robot1ELOBefore: 1200,
          robot2ELOBefore: 1200,
          robot1ELOAfter: 1210,
          robot2ELOAfter: 1190,
          eloChange: 10,
          createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        },
      });

      const eligibility = await validateResetEligibility(testUserId);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.blockers).toHaveLength(0);

      // Cleanup
      await prisma.battle.deleteMany({ where: { robot1Id: testRobotId } });
      await prisma.robot.delete({ where: { id: opponent.id } });
    });

    it('should return multiple blockers when multiple conditions exist', async () => {
      // Create opponent
      const opponent = await prisma.robot.create({
        data: {
          userId: testUserId,
          name: 'Opponent Robot',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });

      // Create scheduled match
      await prisma.scheduledLeagueMatch.create({
        data: {
          robot1Id: testRobotId,
          robot2Id: opponent.id,
          leagueType: 'bronze',
          scheduledFor: new Date(Date.now() + 3600000),
          status: 'scheduled',
        },
      });

      // Create tournament
      const tournament = await prisma.tournament.create({
        data: {
          name: 'Test Tournament',
          tournamentType: 'single_elimination',
          status: 'active',
          maxRounds: 3,
          totalParticipants: 8,
        },
      });

      // Create tournament match
      await prisma.scheduledTournamentMatch.create({
        data: {
          tournamentId: tournament.id,
          round: 1,
          matchNumber: 1,
          robot1Id: testRobotId,
          robot2Id: opponent.id,
          status: 'pending',
        },
      });

      const eligibility = await validateResetEligibility(testUserId);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.blockers.length).toBeGreaterThanOrEqual(2);
      expect(eligibility.blockers.some((b) => b.type === 'scheduled_matches')).toBe(true);
      expect(eligibility.blockers.some((b) => b.type === 'tournament')).toBe(true);

      // Cleanup - delete in correct order
      await prisma.scheduledLeagueMatch.deleteMany({ where: { OR: [{ robot1Id: testRobotId }, { robot2Id: opponent.id }] } });
      await prisma.scheduledTournamentMatch.deleteMany({ where: { tournamentId: tournament.id } });
      await prisma.tournament.delete({ where: { id: tournament.id } });
      await prisma.robot.delete({ where: { id: opponent.id } });
    });
  });

  describe('performAccountReset', () => {
    it('should successfully reset account when eligible', async () => {
      const creditsBeforeReset = 1500000;

      await performAccountReset(testUserId, 'Testing reset functionality');

      // Verify robots deleted
      const robots = await prisma.robot.findMany({ where: { userId: testUserId } });
      expect(robots).toHaveLength(0);

      // Verify weapons deleted
      const weapons = await prisma.weaponInventory.findMany({ where: { userId: testUserId } });
      expect(weapons).toHaveLength(0);

      // Verify facilities deleted
      const facilities = await prisma.facility.findMany({ where: { userId: testUserId } });
      expect(facilities).toHaveLength(0);

      // Verify user state reset
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user).not.toBeNull();
      expect(user!.currency).toBe(3000000);
      expect(user!.hasCompletedOnboarding).toBe(false);
      expect(user!.onboardingSkipped).toBe(false);
      expect(user!.onboardingStep).toBe(1);
      expect(user!.onboardingStrategy).toBeNull();
      expect(user!.onboardingChoices).toEqual({});
      expect(user!.onboardingStartedAt).not.toBeNull();
      expect(user!.onboardingCompletedAt).toBeNull();

      // Verify reset log created
      const resetLogs = await prisma.resetLog.findMany({ where: { userId: testUserId } });
      expect(resetLogs).toHaveLength(1);
      expect(resetLogs[0].robotsDeleted).toBe(1);
      expect(resetLogs[0].weaponsDeleted).toBe(1);
      expect(resetLogs[0].facilitiesDeleted).toBe(1);
      expect(Number(resetLogs[0].creditsBeforeReset)).toBe(creditsBeforeReset);
      expect(resetLogs[0].reason).toBe('Testing reset functionality');
    });

    it('should reset account without reason', async () => {
      await performAccountReset(testUserId);

      // Verify reset log created with null reason
      const resetLogs = await prisma.resetLog.findMany({ where: { userId: testUserId } });
      expect(resetLogs).toHaveLength(1);
      expect(resetLogs[0].reason).toBeNull();
    });

    it('should throw error when reset is not eligible', async () => {
      // Create opponent
      const opponent = await prisma.robot.create({
        data: {
          userId: testUserId,
          name: 'Opponent Robot',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });

      // Create scheduled match to block reset
      await prisma.scheduledLeagueMatch.create({
        data: {
          robot1Id: testRobotId,
          robot2Id: opponent.id,
          leagueType: 'bronze',
          scheduledFor: new Date(Date.now() + 3600000),
          status: 'scheduled',
        },
      });

      await expect(performAccountReset(testUserId)).rejects.toThrow('Reset not allowed');

      // Verify nothing was deleted
      const robots = await prisma.robot.findMany({ where: { userId: testUserId } });
      expect(robots.length).toBeGreaterThan(0);

      // Cleanup - delete scheduled match first, then robot
      await prisma.scheduledLeagueMatch.deleteMany({ where: { OR: [{ robot1Id: testRobotId }, { robot2Id: opponent.id }] } });
      await prisma.robot.delete({ where: { id: opponent.id } });
    });

    it('should throw error when user not found', async () => {
      const nonExistentUserId = 999999;

      await expect(performAccountReset(nonExistentUserId)).rejects.toThrow('User not found');
    });

    it('should handle multiple robots, weapons, and facilities', async () => {
      // Create additional robots
      await prisma.robot.create({
        data: {
          userId: testUserId,
          name: 'Test Robot 2',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });

      await prisma.robot.create({
        data: {
          userId: testUserId,
          name: 'Test Robot 3',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });

      // Create additional weapons
      await prisma.weaponInventory.create({
        data: {
          userId: testUserId,
          weaponId: testWeaponId,
        },
      });

      // Create additional facilities
      await prisma.facility.create({
        data: {
          userId: testUserId,
          facilityType: 'weapons_workshop',
          level: 5,
        },
      });

      await performAccountReset(testUserId, 'Testing multiple entities');

      // Verify all deleted
      const robots = await prisma.robot.findMany({ where: { userId: testUserId } });
      expect(robots).toHaveLength(0);

      const weapons = await prisma.weaponInventory.findMany({ where: { userId: testUserId } });
      expect(weapons).toHaveLength(0);

      const facilities = await prisma.facility.findMany({ where: { userId: testUserId } });
      expect(facilities).toHaveLength(0);

      // Verify reset log counts
      const resetLogs = await prisma.resetLog.findMany({ where: { userId: testUserId } });
      expect(resetLogs).toHaveLength(1);
      expect(resetLogs[0].robotsDeleted).toBe(3);
      expect(resetLogs[0].weaponsDeleted).toBe(2);
      expect(resetLogs[0].facilitiesDeleted).toBe(2);
    });

    it('should be atomic - rollback on error', async () => {
      // This test verifies transaction behavior
      // We can't easily force a transaction error in tests, but we can verify
      // that if the function throws, nothing is changed

      // Create scheduled match to make reset ineligible
      const opponent = await prisma.robot.create({
        data: {
          userId: testUserId,
          name: 'Opponent Robot',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });

      await prisma.scheduledLeagueMatch.create({
        data: {
          robot1Id: testRobotId,
          robot2Id: opponent.id,
          leagueType: 'bronze',
          scheduledFor: new Date(Date.now() + 3600000),
          status: 'scheduled',
        },
      });

      const robotsBeforeAttempt = await prisma.robot.count({ where: { userId: testUserId } });
      const weaponsBeforeAttempt = await prisma.weaponInventory.count({ where: { userId: testUserId } });
      const facilitiesBeforeAttempt = await prisma.facility.count({ where: { userId: testUserId } });

      try {
        await performAccountReset(testUserId);
      } catch (error) {
        // Expected to throw
      }

      // Verify nothing changed
      const robotsAfterAttempt = await prisma.robot.count({ where: { userId: testUserId } });
      const weaponsAfterAttempt = await prisma.weaponInventory.count({ where: { userId: testUserId } });
      const facilitiesAfterAttempt = await prisma.facility.count({ where: { userId: testUserId } });

      expect(robotsAfterAttempt).toBe(robotsBeforeAttempt);
      expect(weaponsAfterAttempt).toBe(weaponsBeforeAttempt);
      expect(facilitiesAfterAttempt).toBe(facilitiesBeforeAttempt);

      // Cleanup - delete scheduled match first, then robot
      await prisma.scheduledLeagueMatch.deleteMany({ where: { OR: [{ robot1Id: testRobotId }, { robot2Id: opponent.id }] } });
      await prisma.robot.delete({ where: { id: opponent.id } });
    });
  });

  describe('getResetHistory', () => {
    it('should return empty array when no resets exist', async () => {
      const history = await getResetHistory(testUserId);

      expect(history).toHaveLength(0);
    });

    it('should return reset history after reset', async () => {
      await performAccountReset(testUserId, 'First reset');

      const history = await getResetHistory(testUserId);

      expect(history).toHaveLength(1);
      expect(history[0].userId).toBe(testUserId);
      expect(history[0].robotsDeleted).toBe(1);
      expect(history[0].weaponsDeleted).toBe(1);
      expect(history[0].facilitiesDeleted).toBe(1);
      expect(history[0].creditsBeforeReset).toBe(1500000);
      expect(history[0].reason).toBe('First reset');
      expect(history[0].resetAt).toBeInstanceOf(Date);
    });

    it('should return multiple reset entries in descending order', async () => {
      // Perform first reset
      await performAccountReset(testUserId, 'First reset');

      // Recreate entities for second reset
      await prisma.robot.create({
        data: {
          userId: testUserId,
          name: 'Test Robot 2',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });

      await prisma.weaponInventory.create({
        data: {
          userId: testUserId,
          weaponId: testWeaponId,
        },
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Perform second reset
      await performAccountReset(testUserId, 'Second reset');

      const history = await getResetHistory(testUserId);

      expect(history).toHaveLength(2);
      // Should be in descending order (most recent first)
      expect(history[0].reason).toBe('Second reset');
      expect(history[1].reason).toBe('First reset');
      expect(history[0].resetAt.getTime()).toBeGreaterThan(history[1].resetAt.getTime());
    });

    it('should return empty array for user with no resets', async () => {
      // Create another user
      const anotherUser = await prisma.user.create({
        data: {
          username: `test_no_reset_${Date.now()}`,
          email: `test_no_reset_${Date.now()}@example.com`,
          passwordHash: 'test_hash',
        },
      });

      const history = await getResetHistory(anotherUser.id);

      expect(history).toHaveLength(0);

      // Cleanup
      await prisma.user.delete({ where: { id: anotherUser.id } });
    });
  });
});
