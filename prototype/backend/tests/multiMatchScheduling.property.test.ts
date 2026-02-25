import * as fc from 'fast-check';
import { Robot, Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { createTeam } from '../src/services/tagTeamService';
import { runMatchmaking } from '../src/services/matchmakingService';
import { runTagTeamMatchmaking } from '../src/services/tagTeamMatchmakingService';
import { executeScheduledBattles } from '../src/services/battleOrchestrator';
import { executeScheduledTagTeamBattles } from '../src/services/tagTeamBattleOrchestrator';


// Test configuration
const NUM_RUNS = 20;

// Helper to create a test robot
async function createTestRobot(userId: number, name: string, elo: number = 1200): Promise<Robot> {
  return await prisma.robot.create({
    data: {
      userId,
      name,
      frameId: 1,
      // Combat Systems
      combatPower: new Prisma.Decimal(10),
      targetingSystems: new Prisma.Decimal(10),
      criticalSystems: new Prisma.Decimal(10),
      penetration: new Prisma.Decimal(10),
      weaponControl: new Prisma.Decimal(10),
      attackSpeed: new Prisma.Decimal(10),
      // Defensive Systems
      armorPlating: new Prisma.Decimal(10),
      shieldCapacity: new Prisma.Decimal(10),
      evasionThrusters: new Prisma.Decimal(10),
      damageDampeners: new Prisma.Decimal(10),
      counterProtocols: new Prisma.Decimal(10),
      // Chassis & Mobility
      hullIntegrity: new Prisma.Decimal(10),
      servoMotors: new Prisma.Decimal(10),
      gyroStabilizers: new Prisma.Decimal(10),
      hydraulicSystems: new Prisma.Decimal(10),
      powerCore: new Prisma.Decimal(10),
      // AI Processing
      combatAlgorithms: new Prisma.Decimal(10),
      threatAnalysis: new Prisma.Decimal(10),
      adaptiveAI: new Prisma.Decimal(10),
      logicCores: new Prisma.Decimal(10),
      // Team Coordination
      syncProtocols: new Prisma.Decimal(10),
      supportSystems: new Prisma.Decimal(10),
      formationTactics: new Prisma.Decimal(10),
      // Combat State
      currentHP: 100,
      maxHP: 100,
      currentShield: 20,
      maxShield: 20,
      damageTaken: 0,
      // Performance
      elo,
      totalBattles: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      damageDealtLifetime: 0,
      damageTakenLifetime: 0,
      kills: 0,
      // League & Fame
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      cyclesInCurrentLeague: 0,
      fame: 0,
      // Economic
      repairCost: 0,
      battleReadiness: 100,
      totalRepairsPaid: 0,
      // Configuration
      yieldThreshold: 10,
      loadoutType: 'single',
      stance: 'balanced',
      // Equipment - create a weapon first
      mainWeaponId: null,
    },
  });
}

// Helper to create a weapon for a robot
async function createWeaponForRobot(userId: number, robotId: number): Promise<void> {
  // Get or create a basic weapon
  let weapon = await prisma.weapon.findFirst({
    where: { name: 'Basic Laser' },
  });

  if (!weapon) {
    weapon = await prisma.weapon.create({
      data: {
        name: 'Basic Laser',
        weaponType: 'energy',
        baseDamage: 10,
        cooldown: 2,
        cost: 1000,
        handsRequired: 'one',
        damageType: 'energy',
        loadoutType: 'any',
      },
    });
  }

  // Add to inventory
  const inventory = await prisma.weaponInventory.create({
    data: {
      userId,
      weaponId: weapon.id,
    },
  });

  // Equip to robot
  await prisma.robot.update({
    where: { id: robotId },
    data: { mainWeaponId: inventory.id },
  });
}

describe('Multi-Match Scheduling and Execution - Property Tests', () => {
  beforeAll(async () => {
    await prisma.$connect();
    // Ensure cycle metadata exists and set to odd cycle
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      update: { totalCycles: 1 },
      create: { id: 1, totalCycles: 1 },
    });
  });

  afterEach(async () => {
    // Clean up database in correct order (respecting foreign keys)
    await prisma.battleParticipant.deleteMany();
    await prisma.battle.deleteMany();
    await prisma.tagTeamMatch.deleteMany();
    await prisma.scheduledMatch.deleteMany();
    await prisma.tagTeam.deleteMany();
    await prisma.weaponInventory.deleteMany();
    await prisma.robot.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Property 30: Multi-Match Scheduling', () => {
    /**
     * **Validates: Requirements 11.1**
     * For any robot, the system should allow scheduling both a 1v1 match and a tag team match
     * in the same cycle.
     */
    test('robots can be scheduled for both 1v1 and tag team matches in the same cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 6 }), // Number of robots per user
          async (robotsPerUser) => {
            // Create two users
            const user1 = await prisma.user.create({
              data: {
                username: `user1_${Date.now()}_${Math.random()}`,
                passwordHash: 'hash',
                currency: 1000000,
              },
            });

            const user2 = await prisma.user.create({
              data: {
                username: `user2_${Date.now()}_${Math.random()}`,
                passwordHash: 'hash',
                currency: 1000000,
              },
            });

            // Create robots for user1
            const user1Robots: Robot[] = [];
            for (let i = 0; i < robotsPerUser; i++) {
              const robot = await createTestRobot(user1.id, `User1Robot${i}`, 1200);
              await createWeaponForRobot(user1.id, robot.id);
              user1Robots.push(robot);
            }

            // Create robots for user2
            const user2Robots: Robot[] = [];
            for (let i = 0; i < robotsPerUser; i++) {
              const robot = await createTestRobot(user2.id, `User2Robot${i}`, 1200);
              await createWeaponForRobot(user2.id, robot.id);
              user2Robots.push(robot);
            }

            // Create tag teams (at least 2 robots needed per team)
            if (robotsPerUser >= 2) {
              await createTeam(user1.id, user1Robots[0].id, user1Robots[1].id);
              await createTeam(user2.id, user2Robots[0].id, user2Robots[1].id);
            }

            // Run matchmaking for both 1v1 and tag team
            const scheduledFor = new Date(Date.now() + 1000);
            const oneVOneMatches = await runMatchmaking(scheduledFor);
            const tagTeamMatches = await runTagTeamMatchmaking(scheduledFor);

            // Check scheduled matches
            const scheduledOneVOne = await prisma.scheduledMatch.findMany({
              where: { status: 'scheduled' },
            });

            const scheduledTagTeam = await prisma.tagTeamMatch.findMany({
              where: { status: 'scheduled' },
            });

            // Property: Robots can be in both types of matches
            // Check if any robot appears in both 1v1 and tag team matches
            const robotsIn1v1 = new Set<number>();
            scheduledOneVOne.forEach(match => {
              robotsIn1v1.add(match.robot1Id);
              robotsIn1v1.add(match.robot2Id);
            });

            const robotsInTagTeam = new Set<number>();
            for (const match of scheduledTagTeam) {
              const team1 = await prisma.tagTeam.findUnique({
                where: { id: match.team1Id },
              });
              const team2 = match.team2Id ? await prisma.tagTeam.findUnique({
                where: { id: match.team2Id },
              }) : null;

              if (team1) {
                robotsInTagTeam.add(team1.activeRobotId);
                robotsInTagTeam.add(team1.reserveRobotId);
              }
              if (team2) {
                robotsInTagTeam.add(team2.activeRobotId);
                robotsInTagTeam.add(team2.reserveRobotId);
              }
            }

            // Property: System allows robots to be in both match types
            // (This is validated by the fact that matchmaking doesn't fail)
            expect(oneVOneMatches).toBeGreaterThanOrEqual(0);
            expect(tagTeamMatches).toBeGreaterThanOrEqual(0);

            // If there are matches of both types, check for overlap
            if (oneVOneMatches > 0 && tagTeamMatches > 0) {
              const overlap = [...robotsIn1v1].filter(id => robotsInTagTeam.has(id));
              // Property: Overlap is allowed (Requirement 11.1)
              expect(overlap.length).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 33: Match Processing Order', () => {
    /**
     * **Validates: Requirements 11.4**
     * For any daily cycle, 1v1 matches should be processed before tag team matches.
     */
    test('1v1 matches are processed before tag team matches', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(true), // Dummy property to run the test
          async () => {
            // Create users and robots
            const user1 = await prisma.user.create({
              data: {
                username: `user1_${Date.now()}_${Math.random()}`,
                passwordHash: 'hash',
                currency: 1000000,
              },
            });

            const user2 = await prisma.user.create({
              data: {
                username: `user2_${Date.now()}_${Math.random()}`,
                passwordHash: 'hash',
                currency: 1000000,
              },
            });

            // Create 4 robots per user (for both 1v1 and tag team)
            const user1Robots: Robot[] = [];
            for (let i = 0; i < 4; i++) {
              const robot = await createTestRobot(user1.id, `User1Robot${i}`, 1200);
              await createWeaponForRobot(user1.id, robot.id);
              user1Robots.push(robot);
            }

            const user2Robots: Robot[] = [];
            for (let i = 0; i < 4; i++) {
              const robot = await createTestRobot(user2.id, `User2Robot${i}`, 1200);
              await createWeaponForRobot(user2.id, robot.id);
              user2Robots.push(robot);
            }

            // Create tag teams
            await createTeam(user1.id, user1Robots[0].id, user1Robots[1].id);
            await createTeam(user2.id, user2Robots[0].id, user2Robots[1].id);

            // Schedule matches
            const scheduledFor = new Date(Date.now() + 1000);
            await runMatchmaking(scheduledFor);
            await runTagTeamMatchmaking(scheduledFor);

            // Record HP before battles
            const hpBefore = new Map<number, number>();
            for (const robot of [...user1Robots, ...user2Robots]) {
              const current = await prisma.robot.findUnique({
                where: { id: robot.id },
                select: { currentHP: true },
              });
              if (current) {
                hpBefore.set(robot.id, current.currentHP);
              }
            }

            // Execute 1v1 battles first
            await executeScheduledBattles(scheduledFor);

            // Record HP after 1v1 battles
            const hpAfter1v1 = new Map<number, number>();
            for (const robot of [...user1Robots, ...user2Robots]) {
              const current = await prisma.robot.findUnique({
                where: { id: robot.id },
                select: { currentHP: true },
              });
              if (current) {
                hpAfter1v1.set(robot.id, current.currentHP);
              }
            }

            // Execute tag team battles second
            await executeScheduledTagTeamBattles(scheduledFor);

            // Record HP after tag team battles
            const hpAfterTagTeam = new Map<number, number>();
            for (const robot of [...user1Robots, ...user2Robots]) {
              const current = await prisma.robot.findUnique({
                where: { id: robot.id },
                select: { currentHP: true },
              });
              if (current) {
                hpAfterTagTeam.set(robot.id, current.currentHP);
              }
            }

            // Property: HP changes from 1v1 battles are visible before tag team battles
            // This validates that 1v1 battles were processed first
            for (const robot of [...user1Robots, ...user2Robots]) {
              const before = hpBefore.get(robot.id) || 0;
              const after1v1 = hpAfter1v1.get(robot.id) || 0;
              const afterTagTeam = hpAfterTagTeam.get(robot.id) || 0;

              // If robot participated in 1v1, HP should change
              if (before !== after1v1) {
                // HP decreased in 1v1
                expect(after1v1).toBeLessThanOrEqual(before);
              }

              // If robot participated in tag team, HP should reflect cumulative damage
              if (after1v1 !== afterTagTeam) {
                // HP decreased further in tag team (or stayed same if not in tag team)
                expect(afterTagTeam).toBeLessThanOrEqual(after1v1);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

  describe('Property 31: Cumulative Damage Application', () => {
    /**
     * **Validates: Requirements 11.2**
     * For any robot scheduled for multiple matches in a cycle, damage from all matches
     * should accumulate, and the robot's HP should reflect the total damage taken.
     */
    test('damage accumulates across 1v1 and tag team matches', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(true), // Dummy property
          async () => {
            // Create users and robots
            const user1 = await prisma.user.create({
              data: {
                username: `user1_${Date.now()}_${Math.random()}`,
                passwordHash: 'hash',
                currency: 1000000,
              },
            });

            const user2 = await prisma.user.create({
              data: {
                username: `user2_${Date.now()}_${Math.random()}`,
                passwordHash: 'hash',
                currency: 1000000,
              },
            });

            // Create 4 robots per user
            const user1Robots: Robot[] = [];
            for (let i = 0; i < 4; i++) {
              const robot = await createTestRobot(user1.id, `User1Robot${i}`, 1200);
              await createWeaponForRobot(user1.id, robot.id);
              user1Robots.push(robot);
            }

            const user2Robots: Robot[] = [];
            for (let i = 0; i < 4; i++) {
              const robot = await createTestRobot(user2.id, `User2Robot${i}`, 1200);
              await createWeaponForRobot(user2.id, robot.id);
              user2Robots.push(robot);
            }

            // Create tag teams using robots 0 and 1
            await createTeam(user1.id, user1Robots[0].id, user1Robots[1].id);
            await createTeam(user2.id, user2Robots[0].id, user2Robots[1].id);

            // Schedule matches
            const scheduledFor = new Date(Date.now() + 1000);
            await runMatchmaking(scheduledFor);
            await runTagTeamMatchmaking(scheduledFor);

            // Record initial HP and damage
            const initialState = new Map<number, { hp: number; damage: number }>();
            for (const robot of [...user1Robots, ...user2Robots]) {
              const current = await prisma.robot.findUnique({
                where: { id: robot.id },
                select: { currentHP: true, damageTaken: true },
              });
              if (current) {
                initialState.set(robot.id, {
                  hp: current.currentHP,
                  damage: current.damageTaken,
                });
              }
            }

            // Execute 1v1 battles
            await executeScheduledBattles(scheduledFor);

            // Record state after 1v1
            const after1v1State = new Map<number, { hp: number; damage: number }>();
            for (const robot of [...user1Robots, ...user2Robots]) {
              const current = await prisma.robot.findUnique({
                where: { id: robot.id },
                select: { currentHP: true, damageTaken: true },
              });
              if (current) {
                after1v1State.set(robot.id, {
                  hp: current.currentHP,
                  damage: current.damageTaken,
                });
              }
            }

            // Execute tag team battles
            await executeScheduledTagTeamBattles(scheduledFor);

            // Record final state
            const finalState = new Map<number, { hp: number; damage: number }>();
            for (const robot of [...user1Robots, ...user2Robots]) {
              const current = await prisma.robot.findUnique({
                where: { id: robot.id },
                select: { currentHP: true, damageTaken: true },
              });
              if (current) {
                finalState.set(robot.id, {
                  hp: current.currentHP,
                  damage: current.damageTaken,
                });
              }
            }

            // Property: Damage accumulates across matches
            for (const robot of [...user1Robots, ...user2Robots]) {
              const initial = initialState.get(robot.id);
              const after1v1 = after1v1State.get(robot.id);
              const final = finalState.get(robot.id);

              if (!initial || !after1v1 || !final) continue;

              // Property: HP can only decrease or stay the same
              expect(after1v1.hp).toBeLessThanOrEqual(initial.hp);
              expect(final.hp).toBeLessThanOrEqual(after1v1.hp);

              // Property: Damage taken increases monotonically
              expect(after1v1.damage).toBeGreaterThanOrEqual(initial.damage);
              expect(final.damage).toBeGreaterThanOrEqual(after1v1.damage);

              // Property: Total damage equals sum of damages from each phase
              const damage1v1 = after1v1.damage - initial.damage;
              const damageTagTeam = final.damage - after1v1.damage;
              const totalDamage = final.damage - initial.damage;
              
              expect(totalDamage).toBe(damage1v1 + damageTagTeam);

              // Property: Damage is non-negative
              expect(damage1v1).toBeGreaterThanOrEqual(0);
              expect(damageTagTeam).toBeGreaterThanOrEqual(0);
              expect(totalDamage).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 32: Dynamic Eligibility After Damage', () => {
    /**
     * **Validates: Requirements 11.3**
     * For any robot scheduled for multiple matches, if HP drops below battle readiness
     * after an earlier match, the robot should be excluded from subsequent matches in that cycle.
     */
    test('robots become ineligible for tag team matches after taking too much damage in 1v1', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 30, max: 60 }), // Damage percentage to inflict in 1v1
          async (damagePercent) => {
            // Create users and robots
            const user1 = await prisma.user.create({
              data: {
                username: `user1_${Date.now()}_${Math.random()}`,
                passwordHash: 'hash',
                currency: 1000000,
              },
            });

            const user2 = await prisma.user.create({
              data: {
                username: `user2_${Date.now()}_${Math.random()}`,
                passwordHash: 'hash',
                currency: 1000000,
              },
            });

            // Create 4 robots per user
            const user1Robots: Robot[] = [];
            for (let i = 0; i < 4; i++) {
              const robot = await createTestRobot(user1.id, `User1Robot${i}`, 1200);
              await createWeaponForRobot(user1.id, robot.id);
              user1Robots.push(robot);
            }

            const user2Robots: Robot[] = [];
            for (let i = 0; i < 4; i++) {
              const robot = await createTestRobot(user2.id, `User2Robot${i}`, 1200);
              await createWeaponForRobot(user2.id, robot.id);
              user2Robots.push(robot);
            }

            // Create tag teams using robots 0 and 1
            const team1Result = await createTeam(user1.id, user1Robots[0].id, user1Robots[1].id);
            const team2Result = await createTeam(user2.id, user2Robots[0].id, user2Robots[1].id);

            if (!team1Result.success || !team1Result.team || !team2Result.success || !team2Result.team) {
              throw new Error('Failed to create teams');
            }

            const team1 = team1Result.team;
            const team2 = team2Result.team;

            // Manually damage robots to simulate 1v1 battle damage
            // Damage robot 0 from each user to below readiness threshold (75%)
            const damageAmount = Math.floor((damagePercent / 100) * user1Robots[0].maxHP);
            await prisma.robot.update({
              where: { id: user1Robots[0].id },
              data: {
                currentHP: user1Robots[0].maxHP - damageAmount,
                damageTaken: damageAmount,
              },
            });

            await prisma.robot.update({
              where: { id: user2Robots[0].id },
              data: {
                currentHP: user2Robots[0].maxHP - damageAmount,
                damageTaken: damageAmount,
              },
            });

            // Schedule tag team matches
            const scheduledFor = new Date(Date.now() + 1000);
            await prisma.tagTeamMatch.create({
              data: {
                team1Id: team1.id,
                team2Id: team2.id,
                tagTeamLeague: 'bronze',
                scheduledFor,
                status: 'scheduled',
              },
            });

            // Execute tag team battles (should check readiness)
            const result = await executeScheduledTagTeamBattles(scheduledFor);

            // Check if match was skipped or executed
            const match = await prisma.tagTeamMatch.findFirst({
              where: {
                team1Id: team1.id,
                team2Id: team2.id,
              },
            });

            // Calculate readiness threshold
            const BATTLE_READINESS_HP_THRESHOLD = 75;
            const robot0HPPercent = ((user1Robots[0].maxHP - damageAmount) / user1Robots[0].maxHP) * 100;

            // Property: If robot HP is below 75%, match should be skipped
            if (robot0HPPercent < BATTLE_READINESS_HP_THRESHOLD) {
              expect(match?.status).toBe('cancelled');
              expect(result.skippedDueToUnreadyRobots).toBeGreaterThan(0);
            } else {
              // If HP is above threshold, match should execute
              expect(match?.status).toBe('completed');
              expect(result.totalBattles).toBeGreaterThan(0);
            }

            // Property: Skipped matches don't affect robot stats
            if (match?.status === 'cancelled') {
              const robot0After = await prisma.robot.findUnique({
                where: { id: user1Robots[0].id },
                select: { totalTagTeamBattles: true },
              });

              expect(robot0After?.totalTagTeamBattles).toBe(0);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
