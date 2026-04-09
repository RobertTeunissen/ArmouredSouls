import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import matchesRoutes from '../src/routes/matches';
import { createTestUser, createTestRobot, deleteTestUser } from './testHelpers';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/matches', matchesRoutes);

describe('Tag Team Battle Log', () => {
  let testUserIds: number[] = [];
  let user1: any, user2: any;
  let robot1: any, robot2: any, robot3: any, robot4: any;
  let authToken: string;
  let tagTeam1: any, tagTeam2: any;
  let tagTeamBattle: any;
  let tagTeamMatch: any;

  beforeAll(async () => {
    await prisma.$connect();

    // Create two users, each with two robots for tag team
    user1 = await createTestUser();
    user2 = await createTestUser();
    testUserIds.push(user1.id, user2.id);

    robot1 = await createTestRobot(user1.id, 'TT_Active1');
    robot2 = await createTestRobot(user1.id, 'TT_Reserve1');
    robot3 = await createTestRobot(user2.id, 'TT_Active2');
    robot4 = await createTestRobot(user2.id, 'TT_Reserve2');

    authToken = jwt.sign(
      { userId: user1.id, username: user1.username },
      process.env.JWT_SECRET || 'test-secret'
    );

    // Create tag teams
    tagTeam1 = await prisma.tagTeam.create({
      data: {
        stableId: user1.id,
        activeRobotId: robot1.id,
        reserveRobotId: robot2.id,
      },
    });

    tagTeam2 = await prisma.tagTeam.create({
      data: {
        stableId: user2.id,
        activeRobotId: robot3.id,
        reserveRobotId: robot4.id,
      },
    });

    // Create a tag team battle
    // robot1Id/robot2Id are required fields; for tag team they represent the active robots
    tagTeamBattle = await prisma.battle.create({
      data: {
        robot1Id: robot1.id,
        robot2Id: robot3.id,
        winnerId: tagTeam1.id, // For tag team, winnerId is the team ID
        battleType: 'tag_team',
        leagueType: 'bronze',
        robot1ELOBefore: 1200,
        robot2ELOBefore: 1200,
        robot1ELOAfter: 1210,
        robot2ELOAfter: 1190,
        eloChange: 10,
        winnerReward: 1000,
        loserReward: 500,
        durationSeconds: 45,
        battleLog: {
          events: [
            { timestamp: 0, type: 'battle_start', message: 'Tag team battle begins!' },
            { timestamp: 10.5, type: 'attack', message: 'TT_Active1 attacks TT_Active2 for 25 damage' },
            { timestamp: 20.0, type: 'tag_out', message: 'TT_Active2 tags out!' },
            { timestamp: 20.1, type: 'tag_in', message: 'TT_Reserve2 tags in!' },
            { timestamp: 45.0, type: 'battle_end', message: 'Team 1 wins!' },
          ],
        },
        team1ActiveRobotId: robot1.id,
        team1ReserveRobotId: robot2.id,
        team2ActiveRobotId: robot3.id,
        team2ReserveRobotId: robot4.id,
        team1TagOutTime: null,
        team2TagOutTime: BigInt(20000), // 20 seconds in ms
        team1ActiveDamageDealt: 80,
        team1ReserveDamageDealt: 0,
        team2ActiveDamageDealt: 30,
        team2ReserveDamageDealt: 20,
        team1ActiveFameAwarded: 15,
        team1ReserveFameAwarded: 0,
        team2ActiveFameAwarded: 5,
        team2ReserveFameAwarded: 3,
        participants: {
          create: [
            {
              robotId: robot1.id,
              team: 1,
              credits: 600,
              eloBefore: 1200,
              eloAfter: 1210,
              damageDealt: 80,
              finalHP: 60,
              fameAwarded: 15,
              prestigeAwarded: 10,
              streamingRevenue: 200,
            },
            {
              robotId: robot3.id,
              team: 2,
              credits: 300,
              eloBefore: 1200,
              eloAfter: 1190,
              damageDealt: 30,
              finalHP: 0,
              fameAwarded: 5,
              prestigeAwarded: 3,
              streamingRevenue: 100,
            },
            {
              robotId: robot4.id,
              team: 2,
              credits: 200,
              eloBefore: 1200,
              eloAfter: 1190,
              damageDealt: 20,
              finalHP: 10,
              fameAwarded: 3,
              prestigeAwarded: 2,
              streamingRevenue: 50,
            },
          ],
        },
      },
    });

    // Create the TagTeamMatch linking teams to the battle
    tagTeamMatch = await prisma.scheduledTagTeamMatch.create({
      data: {
        team1Id: tagTeam1.id,
        team2Id: tagTeam2.id,
        tagTeamLeague: 'bronze',
        scheduledFor: new Date(),
        status: 'completed',
        battleId: tagTeamBattle.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (tagTeamMatch) {
      await prisma.scheduledTagTeamMatch.deleteMany({ where: { id: tagTeamMatch.id } });
    }
    if (tagTeamBattle) {
      await prisma.battleParticipant.deleteMany({ where: { battleId: tagTeamBattle.id } });
      await prisma.battle.deleteMany({ where: { id: tagTeamBattle.id } });
    }
    if (tagTeam1) {
      await prisma.tagTeam.deleteMany({ where: { id: tagTeam1.id } });
    }
    if (tagTeam2) {
      await prisma.tagTeam.deleteMany({ where: { id: tagTeam2.id } });
    }
    for (const userId of testUserIds) {
      await deleteTestUser(userId);
    }
    await prisma.$disconnect();
  });

  it('should return tag team battle log with team summaries instead of robot1/robot2', async () => {
    const response = await request(app)
      .get(`/api/matches/battles/${tagTeamBattle.id}/log`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);

    const body = response.body;

    // Should have battleType tag_team
    expect(body.battleType).toBe('tag_team');

    // Should NOT have robot1/robot2 (this was the bug - frontend crashed accessing these)
    expect(body.robot1).toBeUndefined();
    expect(body.robot2).toBeUndefined();

    // Should have tagTeam data
    expect(body.tagTeam).toBeDefined();
    expect(body.tagTeam.team1).toBeDefined();
    expect(body.tagTeam.team2).toBeDefined();

    // Team 1 should have active and reserve robots
    expect(body.tagTeam.team1.activeRobot).toBeDefined();
    expect(body.tagTeam.team1.activeRobot.name).toBe('TT_Active1');
    expect(body.tagTeam.team1.reserveRobot).toBeDefined();
    expect(body.tagTeam.team1.reserveRobot.name).toBe('TT_Reserve1');

    // Team 2 should have active and reserve robots
    expect(body.tagTeam.team2.activeRobot).toBeDefined();
    expect(body.tagTeam.team2.activeRobot.name).toBe('TT_Active2');
    expect(body.tagTeam.team2.reserveRobot).toBeDefined();
    expect(body.tagTeam.team2.reserveRobot.name).toBe('TT_Reserve2');

    // Team 2 tag out time should be converted to seconds
    expect(body.tagTeam.team1.tagOutTime).toBeNull();
    expect(body.tagTeam.team2.tagOutTime).toBe(20);
  });

  it('should return team summaries with aggregated stats', async () => {
    const response = await request(app)
      .get(`/api/matches/battles/${tagTeamBattle.id}/log`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);

    const body = response.body;

    // Team 1 summary (only robot1 participated on team 1)
    expect(body.team1Summary).toBeDefined();
    expect(body.team1Summary.reward).toBe(600);
    expect(body.team1Summary.prestige).toBe(10);
    expect(body.team1Summary.totalDamage).toBe(80);
    expect(body.team1Summary.totalFame).toBe(15);
    expect(body.team1Summary.streamingRevenue).toBe(200);

    // Team 2 summary (robot3 + robot4 on team 2)
    expect(body.team2Summary).toBeDefined();
    expect(body.team2Summary.reward).toBe(500); // 300 + 200
    expect(body.team2Summary.prestige).toBe(5); // 3 + 2
    expect(body.team2Summary.totalDamage).toBe(50); // 30 + 20
    expect(body.team2Summary.totalFame).toBe(8); // 5 + 3
    expect(body.team2Summary.streamingRevenue).toBe(150); // 100 + 50
  });

  it('should determine winner correctly for tag team battles', async () => {
    const response = await request(app)
      .get(`/api/matches/battles/${tagTeamBattle.id}/log`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);

    // winnerId is tagTeam1.id, which matches team1Id in TagTeamMatch
    expect(response.body.winner).toBe('robot1');
  });

  it('should include battle log events for tag team battles', async () => {
    const response = await request(app)
      .get(`/api/matches/battles/${tagTeamBattle.id}/log`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);

    const events = response.body.battleLog.events;
    expect(events).toBeDefined();
    expect(events.length).toBe(5);

    // Verify tag-specific event types are present
    const tagOutEvent = events.find((e: any) => e.type === 'tag_out');
    expect(tagOutEvent).toBeDefined();

    const tagInEvent = events.find((e: any) => e.type === 'tag_in');
    expect(tagInEvent).toBeDefined();
  });
});
