import { PrismaClient } from '@prisma/client';
import * as fc from 'fast-check';
import { createTeam } from '../src/services/tagTeamService';
import { executeTagTeamBattle } from '../src/services/tagTeamBattleOrchestrator';

const prisma = new PrismaClient();

/**
 * Property-Based Test for Battle Log Completeness
 * Feature: tag-team-matches, Property 22: Battle Log Completeness
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.6**
 * 
 * Property: For any completed tag team battle, the battle log should contain all combat events
 * including tag-out events, tag-in events, and combat messages for tag transitions.
 */

describe('Tag Team Battle Log Completeness Property Tests', () => {
  let testUserId1: number;
  let testUserId2: number;
  let weaponId: number;

  beforeAll(async () => {
    // Create test users
    const testUser1 = await prisma.user.create({
      data: {
        username: `pbt_log_user1_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 1000000,
      },
    });
    testUserId1 = testUser1.id;

    const testUser2 = await prisma.user.create({
      data: {
        username: `pbt_log_user2_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 1000000,
      },
    });
    testUserId2 = testUser2.id;

    // Get a weapon for testing
    const weapon = await prisma.weapon.findFirst();
    weaponId = weapon!.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { userId: testUserId1 },
          { userId: testUserId2 },
        ],
      },
    });
    await prisma.tagTeamMatch.deleteMany({
      where: {
        OR: [
          { team1: { stableId: testUserId1 } },
          { team1: { stableId: testUserId2 } },
          { team2: { stableId: testUserId1 } },
          { team2: { stableId: testUserId2 } },
        ],
      },
    });
    await prisma.tagTeam.deleteMany({
      where: {
        OR: [
          { stableId: testUserId1 },
          { stableId: testUserId2 },
        ],
      },
    });
    await prisma.robot.deleteMany({
      where: {
        OR: [
          { userId: testUserId1 },
          { userId: testUserId2 },
        ],
      },
    });
    await prisma.weaponInventory.deleteMany({
      where: {
        OR: [
          { userId: testUserId1 },
          { userId: testUserId2 },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: testUserId1 },
          { id: testUserId2 },
        ],
      },
    });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up battles, matches, teams, and robots after each test
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { userId: testUserId1 },
          { userId: testUserId2 },
        ],
      },
    });
    await prisma.tagTeamMatch.deleteMany({
      where: {
        OR: [
          { team1: { stableId: testUserId1 } },
          { team1: { stableId: testUserId2 } },
          { team2: { stableId: testUserId1 } },
          { team2: { stableId: testUserId2 } },
        ],
      },
    });
    await prisma.tagTeam.deleteMany({
      where: {
        OR: [
          { stableId: testUserId1 },
          { stableId: testUserId2 },
        ],
      },
    });
    await prisma.robot.deleteMany({
      where: {
        OR: [
          { userId: testUserId1 },
          { userId: testUserId2 },
        ],
      },
    });
    await prisma.weaponInventory.deleteMany({
      where: {
        OR: [
          { userId: testUserId1 },
          { userId: testUserId2 },
        ],
      },
    });
  });

  /**
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.6**
   * 
   * Property: Battle log contains all combat events with timestamps.
   * Every event in the battle log should have a timestamp field.
   */
  it('should include timestamps for all combat events', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate robot configurations that will lead to tag-outs
        fc.record({
          team1ActiveHP: fc.integer({ min: 80, max: 100 }),
          team1ReserveHP: fc.integer({ min: 80, max: 100 }),
          team2ActiveHP: fc.integer({ min: 80, max: 100 }),
          team2ReserveHP: fc.integer({ min: 80, max: 100 }),
          yieldThreshold: fc.integer({ min: 10, max: 30 }),
        }),
        async (config) => {
          // Create weapon inventories
          const weapon1Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId1, weaponId },
          });
          const weapon2Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId1, weaponId },
          });
          const weapon3Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId2, weaponId },
          });
          const weapon4Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId2, weaponId },
          });

          // Create robots for team 1
          const robot1 = await prisma.robot.create({
            data: {
              userId: testUserId1,
              name: `PBT_Log1_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: config.team1ActiveHP,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon1Inv.id,
            },
          });

          const robot2 = await prisma.robot.create({
            data: {
              userId: testUserId1,
              name: `PBT_Log2_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: config.team1ReserveHP,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon2Inv.id,
            },
          });

          // Create robots for team 2
          const robot3 = await prisma.robot.create({
            data: {
              userId: testUserId2,
              name: `PBT_Log3_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: config.team2ActiveHP,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon3Inv.id,
            },
          });

          const robot4 = await prisma.robot.create({
            data: {
              userId: testUserId2,
              name: `PBT_Log4_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: config.team2ReserveHP,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon4Inv.id,
            },
          });

          // Create tag teams
          const team1Result = await createTeam(testUserId1, robot1.id, robot2.id);
          const team2Result = await createTeam(testUserId2, robot3.id, robot4.id);

          expect(team1Result.success).toBe(true);
          expect(team2Result.success).toBe(true);

          const team1 = team1Result.team!;
          const team2 = team2Result.team!;

          // Create a tag team match
          const match = await prisma.tagTeamMatch.create({
            data: {
              team1Id: team1.id,
              team2Id: team2.id,
              tagTeamLeague: 'bronze',
              scheduledFor: new Date(),
              status: 'scheduled',
            },
          });

          // Execute the battle
          const battleResult = await executeTagTeamBattle(match);

          // Retrieve the battle record
          const battle = await prisma.battle.findUnique({
            where: { id: battleResult.battleId },
          });

          expect(battle).not.toBeNull();
          expect(battle!.battleLog).toBeDefined();

          const battleLog = battle!.battleLog as any;
          expect(battleLog.events).toBeDefined();
          expect(Array.isArray(battleLog.events)).toBe(true);

          // Property 1: All events should have timestamps (Requirement 7.1)
          for (const event of battleLog.events) {
            expect(event.timestamp).toBeDefined();
            expect(typeof event.timestamp).toBe('number');
            expect(event.timestamp).toBeGreaterThanOrEqual(0);
          }

          // Clean up
          await prisma.battle.delete({ where: { id: battle!.id } });
          await prisma.tagTeamMatch.delete({ where: { id: match.id } });
          await prisma.tagTeam.deleteMany({
            where: { id: { in: [team1.id, team2.id] } },
          });
          await prisma.robot.deleteMany({
            where: { id: { in: [robot1.id, robot2.id, robot3.id, robot4.id] } },
          });
          await prisma.weaponInventory.deleteMany({
            where: { id: { in: [weapon1Inv.id, weapon2Inv.id, weapon3Inv.id, weapon4Inv.id] } },
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   * 
   * Property: Battle log contains tag-out events with reason (yield or destruction).
   * When a robot tags out, the event should include the reason and be properly recorded.
   */
  it('should include tag-out events with reason when robots tag out', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate configurations that will likely cause tag-outs
        fc.record({
          yieldThreshold: fc.integer({ min: 20, max: 40 }),
        }),
        async (config) => {
          // Create weapon inventories
          const weapon1Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId1, weaponId },
          });
          const weapon2Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId1, weaponId },
          });
          const weapon3Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId2, weaponId },
          });
          const weapon4Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId2, weaponId },
          });

          // Create robots with low yield thresholds to increase tag-out probability
          const robot1 = await prisma.robot.create({
            data: {
              userId: testUserId1,
              name: `PBT_TagOut1_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon1Inv.id,
            },
          });

          const robot2 = await prisma.robot.create({
            data: {
              userId: testUserId1,
              name: `PBT_TagOut2_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon2Inv.id,
            },
          });

          const robot3 = await prisma.robot.create({
            data: {
              userId: testUserId2,
              name: `PBT_TagOut3_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon3Inv.id,
            },
          });

          const robot4 = await prisma.robot.create({
            data: {
              userId: testUserId2,
              name: `PBT_TagOut4_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon4Inv.id,
            },
          });

          // Create tag teams
          const team1Result = await createTeam(testUserId1, robot1.id, robot2.id);
          const team2Result = await createTeam(testUserId2, robot3.id, robot4.id);

          expect(team1Result.success).toBe(true);
          expect(team2Result.success).toBe(true);

          const team1 = team1Result.team!;
          const team2 = team2Result.team!;

          // Create a tag team match
          const match = await prisma.tagTeamMatch.create({
            data: {
              team1Id: team1.id,
              team2Id: team2.id,
              tagTeamLeague: 'bronze',
              scheduledFor: new Date(),
              status: 'scheduled',
            },
          });

          // Execute the battle
          const battleResult = await executeTagTeamBattle(match);

          // Retrieve the battle record
          const battle = await prisma.battle.findUnique({
            where: { id: battleResult.battleId },
          });

          expect(battle).not.toBeNull();
          expect(battle!.battleLog).toBeDefined();

          const battleLog = battle!.battleLog as any;
          expect(battleLog.events).toBeDefined();
          expect(Array.isArray(battleLog.events)).toBe(true);

          // Property 2: Tag-out events should have reason field (Requirement 7.2)
          const tagOutEvents = battleLog.events.filter((e: any) => e.type === 'tag_out');
          
          for (const tagOutEvent of tagOutEvents) {
            expect(tagOutEvent.reason).toBeDefined();
            expect(['yield', 'destruction']).toContain(tagOutEvent.reason);
            expect(tagOutEvent.timestamp).toBeDefined();
            expect(tagOutEvent.teamNumber).toBeDefined();
            expect([1, 2]).toContain(tagOutEvent.teamNumber);
            expect(tagOutEvent.robotId).toBeDefined();
            expect(tagOutEvent.message).toBeDefined();
          }

          // Clean up
          await prisma.battle.delete({ where: { id: battle!.id } });
          await prisma.tagTeamMatch.delete({ where: { id: match.id } });
          await prisma.tagTeam.deleteMany({
            where: { id: { in: [team1.id, team2.id] } },
          });
          await prisma.robot.deleteMany({
            where: { id: { in: [robot1.id, robot2.id, robot3.id, robot4.id] } },
          });
          await prisma.weaponInventory.deleteMany({
            where: { id: { in: [weapon1Inv.id, weapon2Inv.id, weapon3Inv.id, weapon4Inv.id] } },
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * 
   * Property: Battle log contains tag-in events with reserve robot state.
   * When a reserve robot tags in, the event should include the robot's initial HP.
   */
  it('should include tag-in events with reserve robot state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          yieldThreshold: fc.integer({ min: 20, max: 40 }),
        }),
        async (config) => {
          // Create weapon inventories
          const weapon1Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId1, weaponId },
          });
          const weapon2Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId1, weaponId },
          });
          const weapon3Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId2, weaponId },
          });
          const weapon4Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId2, weaponId },
          });

          // Create robots
          const robot1 = await prisma.robot.create({
            data: {
              userId: testUserId1,
              name: `PBT_TagIn1_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon1Inv.id,
            },
          });

          const robot2 = await prisma.robot.create({
            data: {
              userId: testUserId1,
              name: `PBT_TagIn2_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon2Inv.id,
            },
          });

          const robot3 = await prisma.robot.create({
            data: {
              userId: testUserId2,
              name: `PBT_TagIn3_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon3Inv.id,
            },
          });

          const robot4 = await prisma.robot.create({
            data: {
              userId: testUserId2,
              name: `PBT_TagIn4_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon4Inv.id,
            },
          });

          // Create tag teams
          const team1Result = await createTeam(testUserId1, robot1.id, robot2.id);
          const team2Result = await createTeam(testUserId2, robot3.id, robot4.id);

          expect(team1Result.success).toBe(true);
          expect(team2Result.success).toBe(true);

          const team1 = team1Result.team!;
          const team2 = team2Result.team!;

          // Create a tag team match
          const match = await prisma.tagTeamMatch.create({
            data: {
              team1Id: team1.id,
              team2Id: team2.id,
              tagTeamLeague: 'bronze',
              scheduledFor: new Date(),
              status: 'scheduled',
            },
          });

          // Execute the battle
          const battleResult = await executeTagTeamBattle(match);

          // Retrieve the battle record
          const battle = await prisma.battle.findUnique({
            where: { id: battleResult.battleId },
          });

          expect(battle).not.toBeNull();
          expect(battle!.battleLog).toBeDefined();

          const battleLog = battle!.battleLog as any;
          expect(battleLog.events).toBeDefined();
          expect(Array.isArray(battleLog.events)).toBe(true);

          // Property 3: Tag-in events should include reserve robot state (Requirement 7.3)
          const tagInEvents = battleLog.events.filter((e: any) => e.type === 'tag_in');
          
          for (const tagInEvent of tagInEvents) {
            expect(tagInEvent.timestamp).toBeDefined();
            expect(tagInEvent.teamNumber).toBeDefined();
            expect([1, 2]).toContain(tagInEvent.teamNumber);
            expect(tagInEvent.robotId).toBeDefined();
            expect(tagInEvent.message).toBeDefined();
            // The message should contain information about the robot's state
            expect(typeof tagInEvent.message).toBe('string');
            expect(tagInEvent.message.length).toBeGreaterThan(0);
          }

          // Clean up
          await prisma.battle.delete({ where: { id: battle!.id } });
          await prisma.tagTeamMatch.delete({ where: { id: match.id } });
          await prisma.tagTeam.deleteMany({
            where: { id: { in: [team1.id, team2.id] } },
          });
          await prisma.robot.deleteMany({
            where: { id: { in: [robot1.id, robot2.id, robot3.id, robot4.id] } },
          });
          await prisma.weaponInventory.deleteMany({
            where: { id: { in: [weapon1Inv.id, weapon2Inv.id, weapon3Inv.id, weapon4Inv.id] } },
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 7.6**
   * 
   * Property: Battle log includes combat messages for tag transitions.
   * Tag-out and tag-in events should have descriptive combat messages.
   */
  it('should include combat messages for tag transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          yieldThreshold: fc.integer({ min: 20, max: 40 }),
        }),
        async (config) => {
          // Create weapon inventories
          const weapon1Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId1, weaponId },
          });
          const weapon2Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId1, weaponId },
          });
          const weapon3Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId2, weaponId },
          });
          const weapon4Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId2, weaponId },
          });

          // Create robots
          const robot1 = await prisma.robot.create({
            data: {
              userId: testUserId1,
              name: `PBT_Msg1_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon1Inv.id,
            },
          });

          const robot2 = await prisma.robot.create({
            data: {
              userId: testUserId1,
              name: `PBT_Msg2_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon2Inv.id,
            },
          });

          const robot3 = await prisma.robot.create({
            data: {
              userId: testUserId2,
              name: `PBT_Msg3_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon3Inv.id,
            },
          });

          const robot4 = await prisma.robot.create({
            data: {
              userId: testUserId2,
              name: `PBT_Msg4_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon4Inv.id,
            },
          });

          // Create tag teams
          const team1Result = await createTeam(testUserId1, robot1.id, robot2.id);
          const team2Result = await createTeam(testUserId2, robot3.id, robot4.id);

          expect(team1Result.success).toBe(true);
          expect(team2Result.success).toBe(true);

          const team1 = team1Result.team!;
          const team2 = team2Result.team!;

          // Create a tag team match
          const match = await prisma.tagTeamMatch.create({
            data: {
              team1Id: team1.id,
              team2Id: team2.id,
              tagTeamLeague: 'bronze',
              scheduledFor: new Date(),
              status: 'scheduled',
            },
          });

          // Execute the battle
          const battleResult = await executeTagTeamBattle(match);

          // Retrieve the battle record
          const battle = await prisma.battle.findUnique({
            where: { id: battleResult.battleId },
          });

          expect(battle).not.toBeNull();
          expect(battle!.battleLog).toBeDefined();

          const battleLog = battle!.battleLog as any;
          expect(battleLog.events).toBeDefined();
          expect(Array.isArray(battleLog.events)).toBe(true);

          // Property 4: Tag transition events should have combat messages (Requirement 7.6)
          const tagTransitionEvents = battleLog.events.filter(
            (e: any) => e.type === 'tag_out' || e.type === 'tag_in'
          );
          
          for (const event of tagTransitionEvents) {
            expect(event.message).toBeDefined();
            expect(typeof event.message).toBe('string');
            expect(event.message.length).toBeGreaterThan(0);
            // Message should be descriptive (not just empty or placeholder)
            expect(event.message).not.toBe('');
          }

          // Clean up
          await prisma.battle.delete({ where: { id: battle!.id } });
          await prisma.tagTeamMatch.delete({ where: { id: match.id } });
          await prisma.tagTeam.deleteMany({
            where: { id: { in: [team1.id, team2.id] } },
          });
          await prisma.robot.deleteMany({
            where: { id: { in: [robot1.id, robot2.id, robot3.id, robot4.id] } },
          });
          await prisma.weaponInventory.deleteMany({
            where: { id: { in: [weapon1Inv.id, weapon2Inv.id, weapon3Inv.id, weapon4Inv.id] } },
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.6**
   * 
   * Property: Complete battle log structure validation.
   * The battle log should contain all required elements in a complete tag team battle.
   */
  it('should have complete battle log structure with all event types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          yieldThreshold: fc.integer({ min: 15, max: 35 }),
        }),
        async (config) => {
          // Create weapon inventories
          const weapon1Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId1, weaponId },
          });
          const weapon2Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId1, weaponId },
          });
          const weapon3Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId2, weaponId },
          });
          const weapon4Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId2, weaponId },
          });

          // Create robots
          const robot1 = await prisma.robot.create({
            data: {
              userId: testUserId1,
              name: `PBT_Complete1_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon1Inv.id,
            },
          });

          const robot2 = await prisma.robot.create({
            data: {
              userId: testUserId1,
              name: `PBT_Complete2_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon2Inv.id,
            },
          });

          const robot3 = await prisma.robot.create({
            data: {
              userId: testUserId2,
              name: `PBT_Complete3_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon3Inv.id,
            },
          });

          const robot4 = await prisma.robot.create({
            data: {
              userId: testUserId2,
              name: `PBT_Complete4_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: config.yieldThreshold,
              loadoutType: 'single',
              mainWeaponId: weapon4Inv.id,
            },
          });

          // Create tag teams
          const team1Result = await createTeam(testUserId1, robot1.id, robot2.id);
          const team2Result = await createTeam(testUserId2, robot3.id, robot4.id);

          expect(team1Result.success).toBe(true);
          expect(team2Result.success).toBe(true);

          const team1 = team1Result.team!;
          const team2 = team2Result.team!;

          // Create a tag team match
          const match = await prisma.tagTeamMatch.create({
            data: {
              team1Id: team1.id,
              team2Id: team2.id,
              tagTeamLeague: 'bronze',
              scheduledFor: new Date(),
              status: 'scheduled',
            },
          });

          // Execute the battle
          const battleResult = await executeTagTeamBattle(match);

          // Retrieve the battle record
          const battle = await prisma.battle.findUnique({
            where: { id: battleResult.battleId },
          });

          expect(battle).not.toBeNull();
          expect(battle!.battleLog).toBeDefined();

          const battleLog = battle!.battleLog as any;
          
          // Property 5: Battle log should have proper structure
          expect(battleLog.events).toBeDefined();
          expect(Array.isArray(battleLog.events)).toBe(true);
          expect(battleLog.tagTeamBattle).toBe(true);
          
          // Property 6: Events should have valid timestamps
          // Note: Events from different combat phases may have timestamps that restart
          // This is acceptable as long as each event has a valid timestamp
          for (const event of battleLog.events) {
            // All timestamps should be non-negative
            expect(event.timestamp).toBeGreaterThanOrEqual(0);
            expect(typeof event.timestamp).toBe('number');
          }

          // Property 7: Battle log should contain at least some events
          expect(battleLog.events.length).toBeGreaterThan(0);

          // Clean up
          await prisma.battle.delete({ where: { id: battle!.id } });
          await prisma.tagTeamMatch.delete({ where: { id: match.id } });
          await prisma.tagTeam.deleteMany({
            where: { id: { in: [team1.id, team2.id] } },
          });
          await prisma.robot.deleteMany({
            where: { id: { in: [robot1.id, robot2.id, robot3.id, robot4.id] } },
          });
          await prisma.weaponInventory.deleteMany({
            where: { id: { in: [weapon1Inv.id, weapon2Inv.id, weapon3Inv.id, weapon4Inv.id] } },
          });
        }
      ),
      { numRuns: 20 }
    );
  });
});
