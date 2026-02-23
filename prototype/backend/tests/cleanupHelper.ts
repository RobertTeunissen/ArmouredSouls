/**
 * Test Cleanup Helper
 * 
 * Provides a centralized cleanup function that handles foreign key constraints
 * in the correct order.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clean up all test data in the correct order to avoid foreign key constraint violations
 * 
 * Order matters! Delete in reverse dependency order:
 * 1. Scheduled matches (references battles, robots)
 * 2. Battle participants (references battles, robots)
 * 3. Battles (references robots, tournaments)
 * 4. Tag team matches (references tag teams, battles)
 * 5. Tag teams (references robots)
 * 6. Tournament matches (references tournaments, robots)
 * 7. Tournaments (references users)
 * 8. Weapon inventory (references robots, weapons)
 * 9. Robots (references users, league instances)
 * 10. Facilities (references users)
 * 11. Audit logs (references users, robots)
 * 12. Cycle snapshots
 * 13. Users
 * 14. Weapons (base data)
 */
export async function cleanupTestData() {
  try {
    // Delete in dependency order
    await prisma.scheduledMatch.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.tagTeamMatch.deleteMany({});
    await prisma.tagTeam.deleteMany({});
    await prisma.tournamentMatch.deleteMany({});
    await prisma.tournament.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.facility.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.cycleSnapshot.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.weapon.deleteMany({});
  } catch (error) {
    console.error('Error during test cleanup:', error);
    throw error;
  }
}

/**
 * Clean up test data for a specific user and their related entities
 */
export async function cleanupUserTestData(userId: number) {
  try {
    // Get all robots for this user
    const robots = await prisma.robot.findMany({
      where: { userId },
      select: { id: true },
    });
    const robotIds = robots.map(r => r.id);

    // Delete in dependency order
    if (robotIds.length > 0) {
      await prisma.scheduledMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: robotIds } },
            { robot2Id: { in: robotIds } },
          ],
        },
      });

      await prisma.battleParticipant.deleteMany({
        where: { robotId: { in: robotIds } },
      });

      await prisma.battle.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: robotIds } },
            { robot2Id: { in: robotIds } },
          ],
        },
      });

      await prisma.tagTeamMatch.deleteMany({
        where: {
          OR: [
            { team1: { activeRobotId: { in: robotIds } } },
            { team1: { reserveRobotId: { in: robotIds } } },
            { team2: { activeRobotId: { in: robotIds } } },
            { team2: { reserveRobotId: { in: robotIds } } },
          ],
        },
      });

      await prisma.tagTeam.deleteMany({
        where: {
          OR: [
            { activeRobotId: { in: robotIds } },
            { reserveRobotId: { in: robotIds } },
          ],
        },
      });

      await prisma.weaponInventory.deleteMany({
        where: { userId },
      });
    }

    await prisma.tournament.deleteMany({ where: { winner: { userId } } });
    await prisma.robot.deleteMany({ where: { userId } });
    await prisma.facility.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    console.error(`Error during user ${userId} cleanup:`, error);
    throw error;
  }
}

export { prisma };
