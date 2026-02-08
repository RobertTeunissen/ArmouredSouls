import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Creates a test user with default values
 */
export async function createTestUser(username?: string) {
  return await prisma.user.create({
    data: {
      username: username || `test_user_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      passwordHash: await bcrypt.hash('password123', 10),
      prestige: 1000,
      currency: 10000,
    },
  });
}

/**
 * Creates a test robot for a given user
 */
export async function createTestRobot(userId: number, name?: string) {
  return await prisma.robot.create({
    data: {
      name: name || `TestRobot_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      userId,
      currentHP: 100,
      maxHP: 100,
      currentShield: 10,
      maxShield: 10,
      // All 23 attributes set to 5.0
      combatPower: 5,
      targetingSystems: 5,
      criticalSystems: 5,
      penetration: 5,
      weaponControl: 5,
      attackSpeed: 5,
      armorPlating: 5,
      shieldCapacity: 5,
      evasionThrusters: 5,
      damageDampeners: 5,
      counterProtocols: 5,
      hullIntegrity: 5,
      servoMotors: 5,
      gyroStabilizers: 5,
      hydraulicSystems: 5,
      powerCore: 5,
      combatAlgorithms: 5,
      threatAnalysis: 5,
      adaptiveAI: 5,
      logicCores: 5,
      syncProtocols: 5,
      supportSystems: 5,
      formationTactics: 5,
    },
  });
}

/**
 * Deletes a test robot
 */
export async function deleteTestRobot(robotId: number) {
  try {
    await prisma.robot.delete({ where: { id: robotId } });
  } catch (error) {
    // Ignore errors if robot already deleted
  }
}

/**
 * Deletes a test user and all their robots
 */
export async function deleteTestUser(userId: number) {
  try {
    // Delete all robots first
    await prisma.robot.deleteMany({ where: { userId } });
    // Then delete user
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    // Ignore errors if user already deleted
  }
}
