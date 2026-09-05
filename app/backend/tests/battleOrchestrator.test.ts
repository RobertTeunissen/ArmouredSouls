import { MatchType } from '../generated/prisma';
import prisma from '../src/lib/prisma';
import logger from '../src/config/logger';
import {
  processBattle,
  executeScheduledBattles,
} from '../src/services/league/leagueBattleOrchestrator';
import schedulingService from '../src/services/scheduling/schedulingService';
import { calculateELOChange } from '../src/utils/battleMath';
import { usePostCutoverFinancialRollout } from './financialRolloutTestHelper';

usePostCutoverFinancialRollout();

/**
 * Book a queued 1v1 match and return it in the shape `processBattle` takes.
 *
 * Spec #41 replaced `scheduled_matches.robot1_id` / `robot2_id` with participant
 * rows, so the row goes through the scheduling service. `processBattle` still
 * accepts the *mapped* 1v1 view -- the object `executeScheduledBattles` assembles
 * before delegating -- so that is what the helper returns.
 *
 * `robot2Id` may be negative: a bye books the fabricated bye robot's id (-1),
 * which exists only in memory, and bye detection is exactly that sign test.
 */
async function createScheduledMatch(
  robot1Id: number,
  robot2Id: number,
  options: { leagueType?: string; scheduledFor?: Date; isByeMatch?: boolean } = {},
) {
  const leagueType = options.leagueType ?? 'bronze';
  const match = await schedulingService.createMatch({
    matchType: MatchType.league_1v1,
    scheduledFor: options.scheduledFor ?? new Date(),
    leagueType,
    isByeMatch: options.isByeMatch ?? false,
    participants: [
      { participantType: 'robot', participantId: robot1Id, slot: 1 },
      { participantType: 'robot', participantId: robot2Id, slot: 2 },
    ],
  });

  return {
    id: match.id,
    robot1Id,
    robot2Id,
    leagueType,
    scheduledFor: match.scheduledFor,
    status: match.status,
    battleId: match.battleId,
    createdAt: match.createdAt,
    _unifiedMatchId: match.id,
  };
}

/**
 * The bye robot matchmaking fabricates in memory. It is never inserted, and a
 * negative id is exactly how `processBattle` recognises a walkover.
 * @see createByeRobot in services/analytics/matchmakingService.ts
 */
const BYE_ROBOT_ID = -1;

describe('Battle Orchestrator', () => {
  const testUserIds: number[] = [];
  const testRobotIds: number[] = [];
  const testWeaponIds: number[] = [];
  const testWeaponInvIds: number[] = [];
  const testBattleIds: number[] = [];
  let testUser: any;
  let practiceSword: any;

  async function createOpponentUser(): Promise<{ id: number }> {
    return prisma.user.create({
      data: {
        username: `battle_test_opponent_${Date.now()}`,
        passwordHash: 'hash',
        currency: 1000000,
      },
    });
  }

  beforeAll(async () => {
    // Clean up in correct order to respect foreign key constraints
    await prisma.financialLedger.deleteMany({});
    await prisma.scheduledMatch.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.weapon.deleteMany({});

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `battle_test_user_${Date.now()}`,
        passwordHash: 'hash',
        currency: 1000000,
      },
    });
    testUserIds.push(testUser.id);

    // Create practice sword
    practiceSword = await prisma.weapon.create({
      data: {
        name: `Test Sword ${Date.now()}`,
        weaponType: 'melee',
        baseDamage: 5,
        cooldown: 3,
        cost: 0,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        rangeBand: 'melee',
      },
    });
    testWeaponIds.push(practiceSword.id);
  });

  afterEach(async () => {
    // FinancialLedger has no foreign key to the source records. Delete its rows
    // with the paired audits so a later test cannot reuse an orphaned event id.
    await prisma.financialLedger.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.scheduledMatch.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.user.deleteMany({
      where: { id: { not: testUser.id } },
    });
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.financialLedger.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.scheduledMatch.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.weapon.deleteMany({});

    await prisma.$disconnect();
  });

  describe('calculateELOChange', () => {
    it('should calculate ELO changes for equal-rated players', () => {
      const { winnerChange, loserChange } = calculateELOChange(1200, 1200);
      expect(winnerChange).toBe(16);
      expect(loserChange).toBe(-16);
    });

    it('should give smaller ELO gain when favorite wins', () => {
      const { winnerChange } = calculateELOChange(1400, 1200);
      expect(winnerChange).toBeLessThan(16);
    });

    it('should give larger ELO gain when underdog wins', () => {
      const { winnerChange } = calculateELOChange(1200, 1400);
      expect(winnerChange).toBeGreaterThan(16);
    });

    it('should calculate ELO changes for draw', () => {
      const { winnerChange, loserChange } = calculateELOChange(1200, 1200, true);
      expect(winnerChange).toBe(0);
      expect(loserChange).toBe(0);
    });
  });

  describe('processBattle', () => {
    it('should execute a battle and create records', async () => {
      const opponentUser = await createOpponentUser();
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: opponentUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });

      const robot1 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Test Fighter 1',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
        },
      });

      const robot2 = await prisma.robot.create({
        data: {
          userId: opponentUser.id,
          name: 'Test Fighter 2',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv2.id,
        },
      });

      const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);
      const result = await processBattle(scheduledMatch);

      expect(result.battleId).toBeGreaterThan(0);
      expect(result.winnerId).toBeDefined();

      const battle = await prisma.battle.findUnique({
        where: { id: result.battleId },
        include: { participants: true },
      });
      expect(battle).toBeDefined();

      const participantRobotIds = battle!.participants.map(p => p.robotId).sort();
      expect(participantRobotIds).toEqual([robot1.id, robot2.id].sort());
      battle!.participants.forEach(p => {
        expect([null, 'solo']).toContain(p.role);
        expect(p.team).toBeGreaterThanOrEqual(1);
        expect(p.team).toBeLessThanOrEqual(2);
      });

      const updatedMatch = await prisma.scheduledMatch.findUnique({
        where: { id: scheduledMatch.id },
      });
      expect(updatedMatch?.status).toBe('completed');
      expect(updatedMatch?.battleId).toBe(result.battleId);

      const updatedRobot1 = await prisma.robot.findUnique({ where: { id: robot1.id } });
      const updatedRobot2 = await prisma.robot.findUnique({ where: { id: robot2.id } });
      expect(updatedRobot1?.totalBattles).toBe(1);
      expect(updatedRobot2?.totalBattles).toBe(1);

      const winnerId = battle!.winnerId;
      if (winnerId === null) {
        expect(updatedRobot1!.wins + updatedRobot2!.wins).toBe(0);
        expect(updatedRobot1!.losses + updatedRobot2!.losses).toBe(0);
        expect(updatedRobot1!.draws).toBe(1);
        expect(updatedRobot2!.draws).toBe(1);
      } else {
        expect(updatedRobot1!.wins + updatedRobot2!.wins).toBe(1);
        expect(updatedRobot1!.losses + updatedRobot2!.losses).toBe(1);
        expect(updatedRobot1!.draws + updatedRobot2!.draws).toBe(0);
        const winner = winnerId === robot1.id ? updatedRobot1! : updatedRobot2!;
        const loser = winnerId === robot1.id ? updatedRobot2! : updatedRobot1!;
        expect(winner.wins).toBe(1);
        expect(loser.losses).toBe(1);
      }
    });

    it('should handle bye-robot battles correctly', async () => {
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });

      const playerRobot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Player Robot',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
        },
      });

      const scheduledMatch = await createScheduledMatch(playerRobot.id, BYE_ROBOT_ID, {
        isByeMatch: true,
      });
      const result = await processBattle(scheduledMatch);

      expect(result.winnerId).toBe(playerRobot.id);
      expect(result.isByeMatch).toBe(true);

      const updatedPlayer = await prisma.robot.findUnique({
        where: { id: playerRobot.id },
      });
      expect(updatedPlayer!.currentHP).toBe(playerRobot.currentHP);

      const participants = await prisma.battleParticipant.findMany({
        where: { battleId: result.battleId },
      });
      expect(participants.map(p => p.robotId)).toEqual([playerRobot.id]);
      expect(updatedPlayer?.wins).toBe(1);
      expect(updatedPlayer?.losses).toBe(0);
    });

    it('should increment kills when a robot destroys its opponent', async () => {
      const opponentUser = await createOpponentUser();
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: opponentUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });

      const robot1 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Killer Robot',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          kills: 5,
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
          yieldThreshold: 0,
        },
      });

      const robot2 = await prisma.robot.create({
        data: {
          userId: opponentUser.id,
          name: 'Victim Robot',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          kills: 3,
          loadoutType: 'single',
          mainWeaponId: weaponInv2.id,
          yieldThreshold: 0,
        },
      });

      const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);
      const result = await processBattle(scheduledMatch);

      const updatedRobot1 = await prisma.robot.findUnique({ where: { id: robot1.id } });
      const updatedRobot2 = await prisma.robot.findUnique({ where: { id: robot2.id } });
      const battle = await prisma.battle.findUnique({
        where: { id: result.battleId },
        include: { participants: true },
      });

      const robot1Participant = battle?.participants.find(p => p.robotId === robot1.id);
      const robot2Participant = battle?.participants.find(p => p.robotId === robot2.id);
      if (result.winnerId === robot1.id && robot2Participant?.destroyed) {
        expect(updatedRobot1?.kills).toBe(6);
        expect(updatedRobot2?.kills).toBe(3);
      } else if (result.winnerId === robot2.id && robot1Participant?.destroyed) {
        expect(updatedRobot2?.kills).toBe(4);
        expect(updatedRobot1?.kills).toBe(5);
      } else {
        expect(updatedRobot1?.kills).toBe(5);
        expect(updatedRobot2?.kills).toBe(3);
      }
      expect(robot1Participant?.destroyed || robot2Participant?.destroyed).toBeTruthy();
    });
  });

  describe('executeScheduledBattles', () => {
    it('should execute multiple scheduled battles', async () => {
      const opponentUser = await createOpponentUser();
      const robots = [];
      for (let i = 0; i < 4; i++) {
        const userId = i % 2 === 0 ? testUser.id : opponentUser.id;
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId, weaponId: practiceSword.id, pricePaid: 0 },
        });
        const robot = await prisma.robot.create({
          data: {
            userId,
            name: `Batch Robot ${i}`,
            currentHP: 10,
            maxHP: 10,
            currentShield: 2,
            maxShield: 2,
            elo: 1200,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      const scheduledTime = new Date();
      await createScheduledMatch(robots[0].id, robots[1].id, { scheduledFor: scheduledTime });
      await createScheduledMatch(robots[2].id, robots[3].id, { scheduledFor: scheduledTime });

      const summary = await executeScheduledBattles(scheduledTime);
      expect(summary.totalBattles).toBe(2);
      expect(summary.successfulBattles).toBe(2);
      expect(summary.failedBattles).toBe(0);

      const battles = await prisma.battle.findMany({});
      expect(battles.length).toBe(2);

      const completedMatches = await prisma.scheduledMatch.findMany({
        where: { status: 'completed' },
      });
      expect(completedMatches.length).toBe(2);
    });
  });

  describe('Streaming Revenue Integration', () => {
    it('should calculate and award streaming revenue after battle', async () => {
      const opponentUser = await createOpponentUser();
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: opponentUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });

      const robot1 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Streaming Test Robot 1',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
          totalBattles: 100,
          fame: 500,
        },
      });
      const robot2 = await prisma.robot.create({
        data: {
          userId: opponentUser.id,
          name: 'Streaming Test Robot 2',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv2.id,
          totalBattles: 50,
          fame: 250,
        },
      });

      const userBefore = await prisma.user.findUnique({ where: { id: testUser.id } });
      const opponentBefore = await prisma.user.findUnique({ where: { id: opponentUser.id } });
      const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);
      await processBattle(scheduledMatch);

      const userAfter = await prisma.user.findUnique({ where: { id: testUser.id } });
      const opponentAfter = await prisma.user.findUnique({ where: { id: opponentUser.id } });
      expect(userAfter!.currency).toBeGreaterThan(userBefore!.currency);
      expect(opponentAfter!.currency).toBeGreaterThan(opponentBefore!.currency);

      // Revenue is paid per robot to its owning stable. The two expected streaming
      // components are 1,211 and 1,103 credits respectively; each stable also
      // receives its separate battle-income outcome for this two-stable match.
      expect(userAfter!.currency - userBefore!.currency).toBeGreaterThan(1200);
      expect(opponentAfter!.currency - opponentBefore!.currency).toBeGreaterThan(1100);
    });

    it('should not award streaming revenue for bye matches', async () => {
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const playerRobot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Bye Test Player',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
          totalBattles: 100,
          fame: 500,
        },
      });

      const playerUserBefore = await prisma.user.findUnique({ where: { id: testUser.id } });
      const scheduledMatch = await createScheduledMatch(playerRobot.id, BYE_ROBOT_ID, {
        isByeMatch: true,
      });
      const result = await processBattle(scheduledMatch);
      expect(result.isByeMatch).toBe(true);

      const playerUserAfter = await prisma.user.findUnique({ where: { id: testUser.id } });
      const playerBalanceChange = playerUserAfter!.currency - playerUserBefore!.currency;
      const battle = await prisma.battle.findUnique({
        where: { id: result.battleId },
        include: { participants: true },
      });
      expect(playerBalanceChange).toBe(battle!.winnerReward);
      expect(battle!.participants).toHaveLength(1);
      expect(battle!.participants[0].streamingRevenue).toBe(0);
    });

    it('should add streaming revenue to audit log', async () => {
      const opponentUser = await createOpponentUser();
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: opponentUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const robot1 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Audit Log Test 1',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
          totalBattles: 100,
          fame: 500,
        },
      });
      const robot2 = await prisma.robot.create({
        data: {
          userId: opponentUser.id,
          name: 'Audit Log Test 2',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv2.id,
          totalBattles: 50,
          fame: 250,
        },
      });

      const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);
      const result = await processBattle(scheduledMatch);
      const auditEvents = await prisma.auditLog.findMany({
        where: {
          eventType: 'battle_complete',
          battleId: result.battleId,
        },
      });

      expect(auditEvents).toHaveLength(2);
      auditEvents.forEach((event) => {
        const payload = event.payload as any;
        expect(payload.streamingRevenue).toBeDefined();
        expect(payload.streamingRevenue).toBeGreaterThan(0);
      });
    });

    it('should log streaming revenue to terminal', async () => {
      const opponentUser = await createOpponentUser();
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: opponentUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const robot1 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Terminal Log Test 1',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
          totalBattles: 100,
          fame: 500,
        },
      });
      const robot2 = await prisma.robot.create({
        data: {
          userId: opponentUser.id,
          name: 'Terminal Log Test 2',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv2.id,
          totalBattles: 50,
          fame: 250,
        },
      });

      const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);
      const logMessages: string[] = [];
      const infoSpy = jest.spyOn(logger, 'info').mockImplementation(((message: unknown) => {
        logMessages.push(String(message));
        return logger;
      }) as typeof logger.info);

      try {
        await processBattle(scheduledMatch);
        const streamingLogs = logMessages.filter(msg => msg.includes('[Streaming]'));
        expect(streamingLogs.length).toBeGreaterThanOrEqual(2);

        const robot1Log = streamingLogs.find(msg => msg.includes(robot1.name));
        const robot2Log = streamingLogs.find(msg => msg.includes(robot2.name));
        expect(robot1Log).toBeDefined();
        expect(robot2Log).toBeDefined();
        expect(robot1Log).toMatch(/\[Streaming\].*earned ₡[\d,]+.*from Battle #\d+/);
        expect(robot2Log).toMatch(/\[Streaming\].*earned ₡[\d,]+.*from Battle #\d+/);
      } finally {
        infoSpy.mockRestore();
      }
    });
  });
});
