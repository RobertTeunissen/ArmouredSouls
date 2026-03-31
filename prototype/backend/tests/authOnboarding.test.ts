import request from 'supertest';
import prisma from '../src/lib/prisma';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from '../src/routes/auth';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Registration - Onboarding Initialization', () => {
  const createdUserIds: number[] = [];

  let counter = 0;
  function uid() {
    return `ao${++counter}${Math.random().toString(36).substring(2, 6)}`;
  }

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await prisma.weaponInventory.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.facility.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.robot.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    createdUserIds.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should initialize onboarding state after registration', async () => {
    const id = uid();
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: `u${id}`,
        email: `e${id}@test.com`,
        password: 'testpass123',
        stableName: `stb${id}`,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');

    const userId = response.body.user.id;
    createdUserIds.push(userId);

    // Verify onboarding state was initialized in the database
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.onboardingStep).toBe(1);
    expect(dbUser!.hasCompletedOnboarding).toBe(false);
    expect(dbUser!.onboardingSkipped).toBe(false);
    expect(dbUser!.onboardingStartedAt).toBeInstanceOf(Date);
    expect(dbUser!.onboardingCompletedAt).toBeNull();
    expect(dbUser!.onboardingStrategy).toBeNull();
    expect(dbUser!.onboardingChoices).toEqual({});
  });

  it('should set onboardingStartedAt timestamp during registration', async () => {
    const before = new Date();
    const id = uid();

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: `u${id}`,
        email: `e${id}@test.com`,
        password: 'testpass123',
        stableName: `stb${id}`,
      });

    const after = new Date();
    expect(response.status).toBe(201);

    const userId = response.body.user.id;
    createdUserIds.push(userId);

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(dbUser!.onboardingStartedAt).toBeInstanceOf(Date);
    expect(dbUser!.onboardingStartedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(dbUser!.onboardingStartedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should still return correct user data after registration', async () => {
    const id = uid();
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: `u${id}`,
        email: `e${id}@test.com`,
        password: 'testpass123',
        stableName: `stb${id}`,
      });

    expect(response.status).toBe(201);
    createdUserIds.push(response.body.user.id);

    const { user } = response.body;
    expect(user).toHaveProperty('id');
    expect(user.username).toBe(`u${id}`);
    expect(user.email).toBe(`e${id}@test.com`);
    expect(user).toHaveProperty('currency');
    expect(user).toHaveProperty('prestige');
    expect(user).toHaveProperty('role');
    expect(user.role).toBe('user');
  });

  it('should still reject duplicate usernames', async () => {
    const id = uid();
    const registerData = {
      username: `u${id}`,
      email: `e${id}@test.com`,
      password: 'testpass123',
      stableName: `stb${id}`,
    };

    const first = await request(app).post('/api/auth/register').send(registerData);
    expect(first.status).toBe(201);
    createdUserIds.push(first.body.user.id);

    const second = await request(app)
      .post('/api/auth/register')
      .send({ ...registerData, email: `e2${id}@test.com`, stableName: `stb2${id}` });
    expect(second.status).toBe(400);
    expect(second.body.code).toBe('DUPLICATE_USERNAME');
  });

  it('should still reject invalid input', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'ab', // too short
        email: 'e_test',
        password: 'testpass123',
        stableName: 'MyStable',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
