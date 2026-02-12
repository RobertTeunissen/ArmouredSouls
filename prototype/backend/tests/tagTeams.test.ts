import request from 'supertest';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import tagTeamsRoutes from '../src/routes/tagTeams';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use('/api/tag-teams', tagTeamsRoutes);

describe('Tag Teams API Endpoints', () => {
  let testUserId: number;
  let testToken: string;
  let robot1Id: number;
  let robot2Id: number;
  let robot3Id: number;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        username: `tagteam_test_${Date.now()}`,
        passwordHash: 'hashedpassword',
        currency: 1000000,
      },
    });
    testUserId = user.id;
    testToken = jwt.sign(
      { userId: user.id, username: user.username, role: 'user' },
      process.env.JWT_SECRET || 'test-secret'
    );

    // Get a weapon from the database
    const weapon = await prisma.weapon.findFirst();
    if (!weapon) {
      throw new Error('No weapons found in database. Run seed first.');
    }

    // Create test robots with battle readiness
    robot1Id = (await prisma.robot.create({
      data: {
        userId: testUserId,
        name: 'Test Robot 1',
        elo: 1200,
        currentHP: 100,
        maxHP: 100,
        currentShield: 10,
        maxShield: 10,
        yieldThreshold: 20,
      },
    })).id;

    robot2Id = (await prisma.robot.create({
      data: {
        userId: testUserId,
        name: 'Test Robot 2',
        elo: 1300,
        currentHP: 100,
        maxHP: 100,
        currentShield: 10,
        maxShield: 10,
        yieldThreshold: 20,
      },
    })).id;

    robot3Id = (await prisma.robot.create({
      data: {
        userId: testUserId,
        name: 'Test Robot 3',
        elo: 1100,
        currentHP: 100,
        maxHP: 100,
        currentShield: 10,
        maxShield: 10,
        yieldThreshold: 20,
      },
    })).id;

    // Create weapons for robots
    const weapon1 = await prisma.weaponInventory.create({
      data: {
        userId: testUserId,
        weaponId: weapon.id,
      },
    });

    const weapon2 = await prisma.weaponInventory.create({
      data: {
        userId: testUserId,
        weaponId: weapon.id,
      },
    });

    const weapon3 = await prisma.weaponInventory.create({
      data: {
        userId: testUserId,
        weaponId: weapon.id,
      },
    });

    // Equip weapons to make robots battle ready
    await prisma.robot.update({
      where: { id: robot1Id },
      data: { mainWeaponId: weapon1.id },
    });

    await prisma.robot.update({
      where: { id: robot2Id },
      data: { mainWeaponId: weapon2.id },
    });

    await prisma.robot.update({
      where: { id: robot3Id },
      data: { mainWeaponId: weapon3.id },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.tagTeam.deleteMany({ where: { stableId: testUserId } });
    await prisma.weaponInventory.deleteMany({ where: { userId: testUserId } });
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('POST /api/tag-teams', () => {
    it('should create a tag team with valid robots', async () => {
      const response = await request(app)
        .post('/api/tag-teams')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          activeRobotId: robot1Id,
          reserveRobotId: robot2Id,
        });

      expect(response.status).toBe(201);
      expect(response.body.team).toBeDefined();
      expect(response.body.team.activeRobotId).toBe(robot1Id);
      expect(response.body.team.reserveRobotId).toBe(robot2Id);
      expect(response.body.team.tagTeamLeague).toBe('bronze');
      expect(response.body.message).toBe('Tag team created successfully');
    });

    it('should reject team creation without authentication', async () => {
      const response = await request(app)
        .post('/api/tag-teams')
        .send({
          activeRobotId: robot1Id,
          reserveRobotId: robot3Id,
        });

      expect(response.status).toBe(401);
    });

    it('should reject team creation with missing robot IDs', async () => {
      const response = await request(app)
        .post('/api/tag-teams')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          activeRobotId: robot1Id,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject team creation with same robot in both positions', async () => {
      const response = await request(app)
        .post('/api/tag-teams')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          activeRobotId: robot1Id,
          reserveRobotId: robot1Id,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('different');
    });

    it('should reject duplicate team creation', async () => {
      // First team already created in previous test
      const response = await request(app)
        .post('/api/tag-teams')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          activeRobotId: robot1Id,
          reserveRobotId: robot2Id,
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('A team with these robots already exists');
    });
  });

  describe('GET /api/tag-teams', () => {
    it('should list all teams for the user', async () => {
      const response = await request(app)
        .get('/api/tag-teams')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.teams).toBeDefined();
      expect(Array.isArray(response.body.teams)).toBe(true);
      expect(response.body.teams.length).toBeGreaterThan(0);
      expect(response.body.total).toBe(response.body.teams.length);
    });

    it('should include robot details and readiness status', async () => {
      const response = await request(app)
        .get('/api/tag-teams')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      const team = response.body.teams[0];
      expect(team.activeRobot).toBeDefined();
      expect(team.reserveRobot).toBeDefined();
      expect(team.readiness).toBeDefined();
      expect(team.readiness.isReady).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/tag-teams');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/tag-teams/:id', () => {
    let teamId: number;

    beforeAll(async () => {
      // Get the team ID from the first team
      const teams = await prisma.tagTeam.findMany({
        where: { stableId: testUserId },
      });
      teamId = teams[0].id;
    });

    it('should get team details by ID', async () => {
      const response = await request(app)
        .get(`/api/tag-teams/${teamId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.team).toBeDefined();
      expect(response.body.team.id).toBe(teamId);
      expect(response.body.team.activeRobot).toBeDefined();
      expect(response.body.team.reserveRobot).toBeDefined();
      expect(response.body.team.readiness).toBeDefined();
    });

    it('should reject request for non-existent team', async () => {
      const response = await request(app)
        .get('/api/tag-teams/999999')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject request with invalid team ID', async () => {
      const response = await request(app)
        .get('/api/tag-teams/invalid')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/tag-teams/:id', () => {
    let teamToDeleteId: number;

    beforeAll(async () => {
      // Create a team to delete
      const team = await prisma.tagTeam.create({
        data: {
          stableId: testUserId,
          activeRobotId: robot2Id,
          reserveRobotId: robot3Id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_1',
          tagTeamLeaguePoints: 0,
          cyclesInTagTeamLeague: 0,
          totalTagTeamWins: 0,
          totalTagTeamLosses: 0,
          totalTagTeamDraws: 0,
        },
      });
      teamToDeleteId = team.id;
    });

    it('should disband a team', async () => {
      const response = await request(app)
        .delete(`/api/tag-teams/${teamToDeleteId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Team disbanded successfully');

      // Verify team is deleted
      const team = await prisma.tagTeam.findUnique({
        where: { id: teamToDeleteId },
      });
      expect(team).toBeNull();
    });

    it('should reject request for non-existent team', async () => {
      const response = await request(app)
        .delete('/api/tag-teams/999999')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject request with invalid team ID', async () => {
      const response = await request(app)
        .delete('/api/tag-teams/invalid')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(400);
    });
  });
});
