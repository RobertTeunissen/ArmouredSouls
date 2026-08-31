import { MatchType } from '../generated/prisma';
import prisma from '../src/lib/prisma';
import logger from '../src/config/logger';
import {
  processBattle,
  executeScheduledBattles,
} from '../src/services/league/leagueBattleOrchestrator';
import schedulingService from '../src/services/scheduling/schedulingService';
import { calculateELOChange } from '../src/utils/battleMath';

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

  beforeAll(async () => {
    // Clean up in correct order to respect foreign key constraints
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
    // Clean up test data between tests
    await prisma.auditLog.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.scheduledMatch.deleteMany({});
    await prisma.robot.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.weaponInventory.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.user.deleteMany({
      where: { 
        id: { not: testUser.id },
      },
    });
  });

  afterAll(async () => {
    // Final cleanup
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
      
      expect(winnerChange).toBe(16); // K * (1 - 0.5) = 32 * 0.5 = 16
      expect(loserChange).toBe(-16); // K * (0 - 0.5) = 32 * -0.5 = -16
    });

    it('should give smaller ELO gain when favorite wins', () => {
      const { winnerChange } = calculateELOChange(1400, 1200);
      
      expect(winnerChange).toBeLessThan(16); // Less than equal match
    });

    it('should give larger ELO gain when underdog wins', () => {
      const { winnerChange } = calculateELOChange(1200, 1400);
      
      expect(winnerChange).toBeGreaterThan(16); // More than equal match
    });

    it('should calculate ELO changes for draw', () => {
      const { winnerChange, loserChange } = calculateELOChange(1200, 1200, true);
      
      expect(winnerChange).toBe(0); // Both at 0.5 expected, 0.5 actual
      expect(loserChange).toBe(0);
    });
  });

  describe('processBattle', () => {
    it('should execute a battle and create records', async () => {
      // Create two test robots
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
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
          userId: testUser.id,
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

      // Create scheduled match
      const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);

      // Execute battle
      const result = await processBattle(scheduledMatch);

      // Verify battle was created
      expect(result.battleId).toBeGreaterThan(0);
      expect(result.winnerId).toBeDefined();

      // Verify battle record exists with participants
      const battle = await prisma.battle.findUnique({
        where: { id: result.battleId },
        include: { participants: true },
      });
      expect(battle).toBeDefined();

      // Verify participants reference the correct robots with solo role
      const participantRobotIds = battle!.participants.map(p => p.robotId).sort();
      expect(participantRobotIds).toEqual([robot1.id, robot2.id].sort());
      battle!.participants.forEach(p => {
        // `role` marks a tag-team slot. Every other orchestrator writes null,
        // and the consumers (matchHistoryService, robotQueryService) treat null
        // and 'solo' as the same "this is the robot that fought" case — so accept
        // either rather than pinning the one the schema comment happens to name.
        expect([null, 'solo']).toContain(p.role);
        expect(p.team).toBeGreaterThanOrEqual(1);
        expect(p.team).toBeLessThanOrEqual(2);
      });

      // Verify scheduled match was marked completed
      const updatedMatch = await prisma.scheduledMatch.findUnique({
        where: { id: scheduledMatch.id },
      });
      expect(updatedMatch?.status).toBe('completed');
      expect(updatedMatch?.battleId).toBe(result.battleId);

      // Verify robot stats were updated
      const updatedRobot1 = await prisma.robot.findUnique({ where: { id: robot1.id } });
      const updatedRobot2 = await prisma.robot.findUnique({ where: { id: robot2.id } });
      
      expect(updatedRobot1?.totalBattles).toBe(1);
      expect(updatedRobot2?.totalBattles).toBe(1);
      
      // The outcome must be recorded consistently — for EITHER outcome.
      //
      // This used to assert one win and one loss unconditionally, which fails on a draw:
      // a drawn battle increments `draws` and leaves both `wins` and `losses` at 0, so the
      // sums are 0 and the test read "Expected 1, Received 0". Combat is stochastic and
      // these robots have 10 HP, so a draw is rare but perfectly legal — rare enough that it
      // passed every local run and the pull request's CI, and then blocked a deploy from
      // main. Asserting "somebody won" was an assumption about the RNG, not about the
      // orchestrator.
      //
      // What the orchestrator actually guarantees is that the battle's recorded winner and
      // the robots' counters agree, so that is what is asserted. Note `result.winnerId` is
      // `null` on a draw, which is why the `toBeDefined()` check above does not catch it.
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
        // The robot the battle names as winner is the one whose win was counted.
        const winner = winnerId === robot1.id ? updatedRobot1! : updatedRobot2!;
        const loser = winnerId === robot1.id ? updatedRobot2! : updatedRobot1!;
        expect(winner.wins).toBe(1);
        expect(loser.losses).toBe(1);
      }
    });

    it('should handle bye-robot battles correctly', async () => {
      // Create player robot
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

      // Book the bye the way matchmaking does: the opponent is the fabricated bye
      // robot (id -1), which is never persisted. This test used to insert a real
      // robot row named 'Bye Robot' and lean on the name; detection is the id
      // sign, so that row was just an ordinary opponent and a real fight ran.
      // Booking a negative id is possible because the unified schedule puts no
      // foreign key on `participantId`.
      const scheduledMatch = await createScheduledMatch(playerRobot.id, BYE_ROBOT_ID, {
        isByeMatch: true,
      });

      // Execute battle
      const result = await processBattle(scheduledMatch);

      // Verify player won
      expect(result.winnerId).toBe(playerRobot.id);
      expect(result.isByeMatch).toBe(true);

      // A walkover is not simulated, so the player takes no damage at all —
      // stronger than the "under 15%" this asserted while a real fight happened.
      const updatedPlayer = await prisma.robot.findUnique({
        where: { id: playerRobot.id },
      });
      expect(updatedPlayer!.currentHP).toBe(playerRobot.currentHP);

      // Only the real robot gets a participant row.
      const participants = await prisma.battleParticipant.findMany({
        where: { battleId: result.battleId },
      });
      expect(participants.map(p => p.robotId)).toEqual([playerRobot.id]);

      // Verify player won the battle
      expect(updatedPlayer?.wins).toBe(1);
      expect(updatedPlayer?.losses).toBe(0);
    });

    it('should increment kills when a robot destroys its opponent', async () => {
      // Create two test robots
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
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
          kills: 5, // Start with 5 kills
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
          // Never yield, so the fight can only end in a destruction. shouldYield
          // is `hpPercent <= yieldThreshold && hpPercent > 0`, which 0 can never
          // satisfy. With the default 10 the loser surrendered at 1 HP and no
          // kill was recorded, making this test's outcome a coin flip.
          yieldThreshold: 0,
        },
      });

      const robot2 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Victim Robot',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          kills: 3, // Start with 3 kills
          loadoutType: 'single',
          mainWeaponId: weaponInv2.id,
          yieldThreshold: 0, // see above
        },
      });

      // Create scheduled match
      const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);

      // Execute battle
      const result = await processBattle(scheduledMatch);

      // Get updated robots
      const updatedRobot1 = await prisma.robot.findUnique({ where: { id: robot1.id } });
      const updatedRobot2 = await prisma.robot.findUnique({ where: { id: robot2.id } });

      // Get battle with participants to check who was destroyed
      const battle = await prisma.battle.findUnique({
        where: { id: result.battleId },
        include: { participants: true },
      });
      
      // Find destroyed participants
      const robot1Participant = battle?.participants.find(p => p.robotId === robot1.id);
      const robot2Participant = battle?.participants.find(p => p.robotId === robot2.id);
      
      // Verify that the winner's kills incremented if opponent was destroyed
      if (result.winnerId === robot1.id && robot2Participant?.destroyed) {
        expect(updatedRobot1?.kills).toBe(6); // Should increment from 5 to 6
        expect(updatedRobot2?.kills).toBe(3); // Should stay at 3
      } else if (result.winnerId === robot2.id && robot1Participant?.destroyed) {
        expect(updatedRobot2?.kills).toBe(4); // Should increment from 3 to 4
        expect(updatedRobot1?.kills).toBe(5); // Should stay at 5
      } else {
        // No robot was destroyed (unlikely but possible in draws)
        // Both should maintain their original kill counts
        expect(updatedRobot1?.kills).toBe(5);
        expect(updatedRobot2?.kills).toBe(3);
      }

      // Verify one of the robots was marked as destroyed (in most cases)
      expect(robot1Participant?.destroyed || robot2Participant?.destroyed).toBeTruthy();
    });
  });

  describe('executeScheduledBattles', () => {
    it('should execute multiple scheduled battles', async () => {
      // Create robots and scheduled matches
      const robots = [];
      for (let i = 0; i < 4; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
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

      // Create 2 scheduled matches
      const scheduledTime = new Date();
      // createMany cannot express participant rows, so book each match through
      // the scheduling service instead.
      await createScheduledMatch(robots[0].id, robots[1].id, { scheduledFor: scheduledTime });
      await createScheduledMatch(robots[2].id, robots[3].id, { scheduledFor: scheduledTime });

      // Execute all battles
      const summary = await executeScheduledBattles(scheduledTime);

      expect(summary.totalBattles).toBe(2);
      expect(summary.successfulBattles).toBe(2);
      expect(summary.failedBattles).toBe(0);

      // Verify all battles were created
      const battles = await prisma.battle.findMany({});
      expect(battles.length).toBe(2);

      // Verify all matches marked as completed
      const completedMatches = await prisma.scheduledMatch.findMany({
        where: { status: 'completed' },
      });
      expect(completedMatches.length).toBe(2);
    });
  });

  describe('Streaming Revenue Integration', () => {
    it('should calculate and award streaming revenue after battle', async () => {
      // Create test robots with some fame and battles
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
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
          totalBattles: 100, // 100 battles
          fame: 500, // 500 fame
        },
      });

      const robot2 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Streaming Test Robot 2',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv2.id,
          totalBattles: 50, // 50 battles
          fame: 250, // 250 fame
        },
      });

      // Get initial user balance
      const userBefore = await prisma.user.findUnique({ where: { id: testUser.id } });
      const initialBalance = userBefore!.currency;

      // Create scheduled match
      const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);

      // Execute battle
      const result = await processBattle(scheduledMatch);

      // Verify user balance increased (battle winnings + streaming revenue)
      const userAfter = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(userAfter!.currency).toBeGreaterThan(initialBalance);

      // Calculate expected streaming revenue for both robots
      // Robot 1: 1000 × (1 + 101/1000) × (1 + 500/5000) × 1.0 = 1000 × 1.101 × 1.1 × 1.0 = 1211.1 = 1211
      // Robot 2: 1000 × (1 + 51/1000) × (1 + 250/5000) × 1.0 = 1000 × 1.051 × 1.05 × 1.0 = 1103.55 = 1103
      // Total streaming revenue: 1211 + 1103 = 2314

      // The balance increase should include both battle winnings and streaming revenue
      const balanceIncrease = userAfter!.currency - initialBalance;
      expect(balanceIncrease).toBeGreaterThan(2000); // Should be at least streaming revenue
    });

    it('should not award streaming revenue for bye matches', async () => {
      // Create player robot
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

      // Get initial balance
      const playerUserBefore = await prisma.user.findUnique({ where: { id: testUser.id } });

      // Book against the fabricated bye robot (id -1) — see the note in
      // 'should handle bye-robot battles correctly'. There is no bye owner to
      // create or assert on, so the old bye-balance check is gone with it.
      const scheduledMatch = await createScheduledMatch(playerRobot.id, BYE_ROBOT_ID, {
        isByeMatch: true,
      });

      // Execute battle
      const result = await processBattle(scheduledMatch);

      // Verify it was a bye match
      expect(result.isByeMatch).toBe(true);

      // Get final balance
      const playerUserAfter = await prisma.user.findUnique({ where: { id: testUser.id } });
      const playerBalanceChange = playerUserAfter!.currency - playerUserBefore!.currency;

      // The player gets the participation reward and nothing else. Asserting the
      // exact figure the battle recorded says "no streaming revenue" directly,
      // where the old "< 2000" only said "less than the streaming estimate" and
      // would have passed on a partial award.
      const battle = await prisma.battle.findUnique({
        where: { id: result.battleId },
        include: { participants: true },
      });
      expect(playerBalanceChange).toBe(battle!.winnerReward);
      expect(battle!.participants).toHaveLength(1);
      expect(battle!.participants[0].streamingRevenue).toBe(0);
    });

    it('should add streaming revenue to audit log', async () => {
      // Create test robots
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
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
          userId: testUser.id,
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

      // Create scheduled match
      const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);

      // Execute battle
      const result = await processBattle(scheduledMatch);

      // Find the battle_complete events in audit log (one per robot)
      const auditEvents = await prisma.auditLog.findMany({
        where: {
          eventType: 'battle_complete',
          battleId: result.battleId,
        },
      });

      // Should have two events (one per robot)
      expect(auditEvents).toHaveLength(2);

      // Verify streaming revenue is in both event payloads
      auditEvents.forEach((event) => {
        const payload = event.payload as any;
        expect(payload.streamingRevenue).toBeDefined();
        expect(payload.streamingRevenue).toBeGreaterThan(0);
      });
    });

    it('should log streaming revenue to terminal', async () => {
      // Create test robots
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id, pricePaid: 0 },
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
          userId: testUser.id,
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

      // Create scheduled match
      const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);

      // Capture the logger, not console.log. The orchestrator emits these through
      // winston (`logger.info`), which writes to the stream directly, so a
      // console.log stub saw nothing at all and this assertion was unreachable.
      const logMessages: string[] = [];
      const infoSpy = jest.spyOn(logger, 'info').mockImplementation(((message: unknown) => {
        logMessages.push(String(message));
        return logger;
      }) as typeof logger.info);

      try {
        // Execute battle
        const result = await processBattle(scheduledMatch);

        // Verify terminal log contains streaming revenue messages
        const streamingLogs = logMessages.filter(msg => msg.includes('[Streaming]'));
        expect(streamingLogs.length).toBeGreaterThanOrEqual(2); // One for each robot

        // Verify log format: "[Streaming] RobotName earned ₡X,XXX from Battle #123"
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
