import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import matchesRoutes from '../src/routes/matches';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/matches', matchesRoutes);

// Test configuration
const NUM_RUNS = 20;

/**
 * Property 25: Match List Inclusion
 * **Validates: Requirements 9.4, 9.5**
 * 
 * For any player's upcoming matches and battle history, tag team matches should be 
 * included alongside 1v1 matches with appropriate indicators.
 */
describe('Feature: tag-team-matches, Property 25: Match List Inclusion', () => {
  let testUserId: number;
  let testToken: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        username: `match_list_test_${Date.now()}`,
        passwordHash: 'hashedpassword',
        currency: 1000000,
      },
    });
    testUserId = user.id;
    testToken = jwt.sign(
      { userId: user.id, username: user.username, role: 'user' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.tagTeamMatch.deleteMany({ 
      where: { 
        OR: [
          { team1: { stableId: testUserId } },
          { team2: { stableId: testUserId } },
        ],
      },
    });
    await prisma.scheduledMatch.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUserId } },
          { robot2: { userId: testUserId } },
        ],
      },
    });
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUserId } },
          { robot2: { userId: testUserId } },
        ],
      },
    });
    await prisma.tagTeam.deleteMany({ where: { stableId: testUserId } });
    await prisma.weaponInventory.deleteMany({ where: { userId: testUserId } });
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it('should include tag team matches in upcoming matches list with tag_team indicator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          numRobots: fc.integer({ min: 2, max: 4 }),
          numTeams: fc.integer({ min: 1, max: 2 }),
          num1v1Matches: fc.integer({ min: 0, max: 2 }),
          numTagTeamMatches: fc.integer({ min: 0, max: 2 }),
        }),
        async (config) => {
          // Get a weapon from the database
          const weapon = await prisma.weapon.findFirst();
          if (!weapon) {
            throw new Error('No weapons found in database. Run seed first.');
          }

          // Create robots
          const robots = [];
          for (let i = 0; i < config.numRobots; i++) {
            const robot = await prisma.robot.create({
              data: {
                userId: testUserId,
                name: `Test Robot ${Date.now()}_${i}`,
                elo: 1200,
                currentHP: 100,
                maxHP: 100,
                currentShield: 10,
                maxShield: 10,
                yieldThreshold: 20,
              },
            });

            // Create and equip weapon
            const weaponInv = await prisma.weaponInventory.create({
              data: {
                userId: testUserId,
                weaponId: weapon.id,
              },
            });

            await prisma.robot.update({
              where: { id: robot.id },
              data: { mainWeaponId: weaponInv.id },
            });

            robots.push(robot);
          }

          // Create tag teams
          const teams = [];
          for (let i = 0; i < Math.min(config.numTeams, Math.floor(robots.length / 2)); i++) {
            const team = await prisma.tagTeam.create({
              data: {
                stableId: testUserId,
                activeRobotId: robots[i * 2].id,
                reserveRobotId: robots[i * 2 + 1].id,
                tagTeamLeague: 'bronze',
                tagTeamLeagueId: 'bronze_1',
                tagTeamLeaguePoints: 0,
                cyclesInTagTeamLeague: 0,
                totalTagTeamWins: 0,
                totalTagTeamLosses: 0,
                totalTagTeamDraws: 0,
              },
            });
            teams.push(team);
          }

          // Create 1v1 scheduled matches
          const scheduledMatches = [];
          for (let i = 0; i < Math.min(config.num1v1Matches, robots.length - 1); i++) {
            const match = await prisma.scheduledMatch.create({
              data: {
                robot1Id: robots[i].id,
                robot2Id: robots[i + 1].id,
                leagueType: 'bronze',
                scheduledFor: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
                status: 'scheduled',
              },
            });
            scheduledMatches.push(match);
          }

          // Create tag team scheduled matches
          const tagTeamMatches = [];
          if (teams.length >= 2) {
            for (let i = 0; i < Math.min(config.numTagTeamMatches, teams.length - 1); i++) {
              const match = await prisma.tagTeamMatch.create({
                data: {
                  team1Id: teams[i].id,
                  team2Id: teams[i + 1].id,
                  tagTeamLeague: 'bronze',
                  scheduledFor: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
                  status: 'scheduled',
                },
              });
              tagTeamMatches.push(match);
            }
          }

          // Fetch upcoming matches via API
          const response = await request(app)
            .get('/api/matches/upcoming')
            .set('Authorization', `Bearer ${testToken}`);

          expect(response.status).toBe(200);
          expect(response.body.matches).toBeDefined();
          expect(Array.isArray(response.body.matches)).toBe(true);

          // Verify all scheduled 1v1 matches are included
          const leagueMatchesInResponse = response.body.matches.filter(
            (m: any) => m.matchType === 'league'
          );
          expect(leagueMatchesInResponse.length).toBe(scheduledMatches.length);

          // Verify all scheduled tag team matches are included with tag_team indicator
          const tagTeamMatchesInResponse = response.body.matches.filter(
            (m: any) => m.matchType === 'tag_team'
          );
          expect(tagTeamMatchesInResponse.length).toBe(tagTeamMatches.length);

          // Verify tag team matches have proper structure
          tagTeamMatchesInResponse.forEach((match: any) => {
            expect(match.matchType).toBe('tag_team');
            expect(match.team1).toBeDefined();
            expect(match.team2).toBeDefined();
            expect(match.team1.activeRobot).toBeDefined();
            expect(match.team1.reserveRobot).toBeDefined();
            expect(match.team2.activeRobot).toBeDefined();
            expect(match.team2.reserveRobot).toBeDefined();
            expect(match.team1.combinedELO).toBeDefined();
            expect(match.team2.combinedELO).toBeDefined();
          });

          // Verify total count
          expect(response.body.total).toBe(scheduledMatches.length + tagTeamMatches.length);
          expect(response.body.tagTeamMatches).toBe(tagTeamMatches.length);

          // Clean up
          await prisma.tagTeamMatch.deleteMany({
            where: { id: { in: tagTeamMatches.map(m => m.id) } },
          });
          await prisma.scheduledMatch.deleteMany({
            where: { id: { in: scheduledMatches.map(m => m.id) } },
          });
          await prisma.tagTeam.deleteMany({
            where: { id: { in: teams.map(t => t.id) } },
          });
          await prisma.weaponInventory.deleteMany({
            where: { userId: testUserId },
          });
          await prisma.robot.deleteMany({
            where: { id: { in: robots.map(r => r.id) } },
          });
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('should include tag team battles in history with battleType indicator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          numRobots: fc.integer({ min: 4, max: 6 }),
          num1v1Battles: fc.integer({ min: 0, max: 2 }),
          numTagTeamBattles: fc.integer({ min: 0, max: 2 }),
        }),
        async (config) => {
          // Get a weapon from the database
          const weapon = await prisma.weapon.findFirst();
          if (!weapon) {
            throw new Error('No weapons found in database. Run seed first.');
          }

          // Create robots
          const robots = [];
          for (let i = 0; i < config.numRobots; i++) {
            const robot = await prisma.robot.create({
              data: {
                userId: testUserId,
                name: `Test Robot ${Date.now()}_${i}`,
                elo: 1200,
                currentHP: 100,
                maxHP: 100,
                currentShield: 10,
                maxShield: 10,
                yieldThreshold: 20,
              },
            });

            // Create and equip weapon
            const weaponInv = await prisma.weaponInventory.create({
              data: {
                userId: testUserId,
                weaponId: weapon.id,
              },
            });

            await prisma.robot.update({
              where: { id: robot.id },
              data: { mainWeaponId: weaponInv.id },
            });

            robots.push(robot);
          }

          // Create 1v1 battles
          const battles1v1 = [];
          for (let i = 0; i < Math.min(config.num1v1Battles, Math.floor(robots.length / 2)); i++) {
            const battle = await prisma.battle.create({
              data: {
                userId: testUserId,
                robot1Id: robots[i * 2].id,
                robot2Id: robots[i * 2 + 1].id,
                winnerId: robots[i * 2].id,
                leagueType: 'bronze',
                battleType: 'league',
                durationSeconds: 30,
                robot1ELOBefore: 1200,
                robot1ELOAfter: 1216,
                robot2ELOBefore: 1200,
                robot2ELOAfter: 1184,
                eloChange: 16,
                robot1FinalHP: 50,
                robot2FinalHP: 0,
                robot1FinalShield: 5,
                robot2FinalShield: 0,
                robot1DamageDealt: 100,
                robot2DamageDealt: 50,
                winnerReward: 1000,
                loserReward: 500,
                robot1PrestigeAwarded: 5,
                robot2PrestigeAwarded: 0,
                robot1FameAwarded: 10,
                robot2FameAwarded: 5,
                battleLog: {},
              },
            });
            battles1v1.push(battle);
          }

          // Create tag team battles
          const battlesTagTeam = [];
          for (let i = 0; i < Math.min(config.numTagTeamBattles, Math.floor(robots.length / 4)); i++) {
            const battle = await prisma.battle.create({
              data: {
                userId: testUserId,
                robot1Id: robots[i * 4].id,
                robot2Id: robots[i * 4 + 2].id,
                winnerId: robots[i * 4].id,
                leagueType: 'bronze',
                battleType: 'tag_team',
                team1ActiveRobotId: robots[i * 4].id,
                team1ReserveRobotId: robots[i * 4 + 1].id,
                team2ActiveRobotId: robots[i * 4 + 2].id,
                team2ReserveRobotId: robots[i * 4 + 3].id,
                durationSeconds: 45,
                robot1ELOBefore: 1200,
                robot1ELOAfter: 1216,
                robot2ELOBefore: 1200,
                robot2ELOAfter: 1184,
                eloChange: 16,
                robot1FinalHP: 50,
                robot2FinalHP: 0,
                robot1FinalShield: 5,
                robot2FinalShield: 0,
                robot1DamageDealt: 150,
                robot2DamageDealt: 75,
                winnerReward: 2000,
                loserReward: 1000,
                robot1PrestigeAwarded: 8,
                robot2PrestigeAwarded: 0,
                robot1FameAwarded: 15,
                robot2FameAwarded: 8,
                battleLog: {},
              },
            });
            battlesTagTeam.push(battle);
          }

          // Fetch battle history via API
          const response = await request(app)
            .get('/api/matches/history')
            .set('Authorization', `Bearer ${testToken}`);

          expect(response.status).toBe(200);
          expect(response.body.data).toBeDefined();
          expect(Array.isArray(response.body.data)).toBe(true);

          // Verify all 1v1 battles are included
          const battles1v1InResponse = response.body.data.filter(
            (b: any) => b.battleType === 'league'
          );
          expect(battles1v1InResponse.length).toBe(battles1v1.length);

          // Verify all tag team battles are included with tag_team battleType
          const battlesTagTeamInResponse = response.body.data.filter(
            (b: any) => b.battleType === 'tag_team'
          );
          expect(battlesTagTeamInResponse.length).toBe(battlesTagTeam.length);

          // Verify tag team battles have proper battleType indicator
          battlesTagTeamInResponse.forEach((battle: any) => {
            expect(battle.battleType).toBe('tag_team');
          });

          // Verify total count
          expect(response.body.pagination.total).toBe(battles1v1.length + battlesTagTeam.length);

          // Clean up
          await prisma.battle.deleteMany({
            where: { id: { in: [...battles1v1.map(b => b.id), ...battlesTagTeam.map(b => b.id)] } },
          });
          await prisma.weaponInventory.deleteMany({
            where: { userId: testUserId },
          });
          await prisma.robot.deleteMany({
            where: { id: { in: robots.map(r => r.id) } },
          });
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
