import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';


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


/**
 * Creates a test battle with BattleParticipant records (new schema).
 * This replaces the old pattern of setting robot1DamageDealt, robot1FameAwarded, etc.
 * directly on the Battle model.
 */
export async function createTestBattle(opts: {
  robot1Id: number;
  robot2Id: number;
  winnerId?: number | null;
  battleType?: string;
  leagueType?: string;
  robot1ELOBefore?: number;
  robot2ELOBefore?: number;
  robot1ELOAfter?: number;
  robot2ELOAfter?: number;
  eloChange?: number;
  winnerReward?: number | null;
  loserReward?: number | null;
  durationSeconds?: number;
  battleLog?: any;
  // Per-participant data (moved from old Battle fields)
  robot1DamageDealt?: number;
  robot2DamageDealt?: number;
  robot1FinalHP?: number;
  robot2FinalHP?: number;
  robot1FameAwarded?: number;
  robot2FameAwarded?: number;
  robot1PrestigeAwarded?: number;
  robot2PrestigeAwarded?: number;
  robot1StreamingRevenue?: number;
  robot2StreamingRevenue?: number;
  robot1Credits?: number;
  robot2Credits?: number;
  robot1Yielded?: boolean;
  robot2Yielded?: boolean;
  robot1Destroyed?: boolean;
  robot2Destroyed?: boolean;
}) {
  const battle = await prisma.battle.create({
    data: {
      robot1Id: opts.robot1Id,
      robot2Id: opts.robot2Id,
      winnerId: opts.winnerId ?? null,
      battleType: opts.battleType || 'league',
      leagueType: opts.leagueType || 'bronze',
      robot1ELOBefore: opts.robot1ELOBefore ?? 1200,
      robot2ELOBefore: opts.robot2ELOBefore ?? 1200,
      robot1ELOAfter: opts.robot1ELOAfter ?? 1210,
      robot2ELOAfter: opts.robot2ELOAfter ?? 1190,
      eloChange: opts.eloChange ?? 10,
      winnerReward: opts.winnerReward ?? 1000,
      loserReward: opts.loserReward ?? 500,
      durationSeconds: opts.durationSeconds ?? 30,
      battleLog: opts.battleLog || { events: [] },
      participants: {
        create: [
          {
            robotId: opts.robot1Id,
            team: 1,
            credits: opts.robot1Credits ?? (opts.winnerId === opts.robot1Id ? (opts.winnerReward ?? 1000) : (opts.loserReward ?? 500)),
            eloBefore: opts.robot1ELOBefore ?? 1200,
            eloAfter: opts.robot1ELOAfter ?? 1210,
            damageDealt: opts.robot1DamageDealt ?? 100,
            finalHP: opts.robot1FinalHP ?? 50,
            fameAwarded: opts.robot1FameAwarded ?? 20,
            prestigeAwarded: opts.robot1PrestigeAwarded ?? 10,
            streamingRevenue: opts.robot1StreamingRevenue ?? 0,
            yielded: opts.robot1Yielded ?? false,
            destroyed: opts.robot1Destroyed ?? false,
          },
          {
            robotId: opts.robot2Id,
            team: 2,
            credits: opts.robot2Credits ?? (opts.winnerId === opts.robot2Id ? (opts.winnerReward ?? 1000) : (opts.loserReward ?? 500)),
            eloBefore: opts.robot2ELOBefore ?? 1200,
            eloAfter: opts.robot2ELOAfter ?? 1190,
            damageDealt: opts.robot2DamageDealt ?? 50,
            finalHP: opts.robot2FinalHP ?? 0,
            fameAwarded: opts.robot2FameAwarded ?? 10,
            prestigeAwarded: opts.robot2PrestigeAwarded ?? 5,
            streamingRevenue: opts.robot2StreamingRevenue ?? 0,
            yielded: opts.robot2Yielded ?? false,
            destroyed: opts.robot2Destroyed ?? false,
          },
        ],
      },
    },
    include: { participants: true },
  });
  return battle;
}

/**
 * Cleans up test battle data (battle + participants)
 */
export async function deleteTestBattle(battleId: number) {
  try {
    await prisma.battleParticipant.deleteMany({ where: { battleId } });
    await prisma.battle.delete({ where: { id: battleId } });
  } catch (error) {
    // Ignore errors if already deleted
  }
}
