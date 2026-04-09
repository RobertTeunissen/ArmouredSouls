import request from 'supertest';
import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import adminRoutes from '../src/routes/admin';
import authRoutes from '../src/routes/auth';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

describe('GET /api/admin/audit-log/repairs', () => {
  let adminToken: string;
  let testUserId: number;
  let testRobotId: number;
  const testUserIds: number[] = [];
  const testAuditLogIds: bigint[] = [];

  beforeAll(async () => {
    await prisma.$connect();

    // Create admin user
    const adminUsername = `admin_repair_audit_${Date.now()}`;
    const adminPassword = 'adminpass123';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const adminUser = await prisma.user.create({
      data: {
        username: adminUsername,
        stableName: `TestStable_${Date.now()}`,
        passwordHash,
        role: 'admin',
        currency: 1000000,
      },
    });
    testUserId = adminUser.id;
    testUserIds.push(adminUser.id);

    // Login to get admin token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: adminUsername, password: adminPassword });
    adminToken = loginResponse.body.token;

    // Create a test robot
    const robot = await prisma.robot.create({
      data: {
        userId: testUserId,
        name: `RepairAuditBot_${Date.now()}`,
        currentHP: 100,
        maxHP: 100,
        currentShield: 0,
        maxShield: 0,
      },
    });
    testRobotId = robot.id;

    // Get a unique cycle number for test data
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const testCycleNumber = (cycleMetadata?.totalCycles || 0) + 9000; // Use high number to avoid conflicts

    // Create test audit log entries
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const manualEntry1 = await prisma.auditLog.create({
      data: {
        cycleNumber: testCycleNumber,
        eventType: 'robot_repair',
        sequenceNumber: 1,
        userId: testUserId,
        robotId: testRobotId,
        eventTimestamp: now,
        payload: {
          cost: 2500,
          damageRepaired: 50,
          discountPercent: 14,
          repairType: 'manual',
          manualRepairDiscount: 50,
          preDiscountCost: 5000,
        },
      },
    });
    testAuditLogIds.push(manualEntry1.id);

    const manualEntry2 = await prisma.auditLog.create({
      data: {
        cycleNumber: testCycleNumber,
        eventType: 'robot_repair',
        sequenceNumber: 2,
        userId: testUserId,
        robotId: testRobotId,
        eventTimestamp: oneDayAgo,
        payload: {
          cost: 1000,
          damageRepaired: 30,
          discountPercent: 0,
          repairType: 'manual',
          manualRepairDiscount: 50,
          preDiscountCost: 2000,
        },
      },
    });
    testAuditLogIds.push(manualEntry2.id);

    const automaticEntry = await prisma.auditLog.create({
      data: {
        cycleNumber: testCycleNumber,
        eventType: 'robot_repair',
        sequenceNumber: 3,
        userId: testUserId,
        robotId: testRobotId,
        eventTimestamp: twoDaysAgo,
        payload: {
          cost: 5000,
          damageRepaired: 50,
          discountPercent: 14,
          repairType: 'automatic',
        },
      },
    });
    testAuditLogIds.push(automaticEntry.id);
  });

  afterAll(async () => {
    // Cleanup audit log entries
    if (testAuditLogIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { id: { in: testAuditLogIds } },
      });
    }

    // Cleanup robot
    if (testRobotId) {
      await prisma.robot.deleteMany({ where: { id: testRobotId } });
    }

    // Cleanup users
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }

    await prisma.$disconnect();
  });

  it('should require authentication', async () => {
    const response = await request(app).get('/api/admin/audit-log/repairs');
    expect(response.status).toBe(401);
  });

  it('should require admin role', async () => {
    const regularUsername = `user_repair_audit_${Date.now()}`;
    const regularPassword = 'userpass123';
    const passwordHash = await bcrypt.hash(regularPassword, 10);

    const regularUser = await prisma.user.create({
      data: { username: regularUsername, passwordHash, role: 'user' },
    });
    testUserIds.push(regularUser.id);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: regularUsername, password: regularPassword });

    const response = await request(app)
      .get('/api/admin/audit-log/repairs')
      .set('Authorization', `Bearer ${loginResponse.body.token}`);

    expect(response.status).toBe(403);
  });

  it('should return repair events with correct response shape', async () => {
    const response = await request(app)
      .get('/api/admin/audit-log/repairs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('events');
    expect(response.body).toHaveProperty('summary');
    expect(response.body).toHaveProperty('pagination');

    // Check summary shape
    expect(response.body.summary).toHaveProperty('totalManualRepairs');
    expect(response.body.summary).toHaveProperty('totalAutomaticRepairs');
    expect(response.body.summary).toHaveProperty('totalSavings');

    // Check pagination shape
    expect(response.body.pagination).toHaveProperty('page');
    expect(response.body.pagination).toHaveProperty('limit');
    expect(response.body.pagination).toHaveProperty('totalEvents');
    expect(response.body.pagination).toHaveProperty('totalPages');
    expect(response.body.pagination).toHaveProperty('hasMore');
  });

  it('should return events with correct event shape', async () => {
    const response = await request(app)
      .get('/api/admin/audit-log/repairs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.events.length).toBeGreaterThan(0);

    const event = response.body.events[0];
    expect(event).toHaveProperty('userId');
    expect(event).toHaveProperty('stableName');
    expect(event).toHaveProperty('robotId');
    expect(event).toHaveProperty('robotName');
    expect(event).toHaveProperty('repairType');
    expect(event).toHaveProperty('cost');
    expect(event).toHaveProperty('preDiscountCost');
    expect(event).toHaveProperty('manualRepairDiscount');
    expect(event).toHaveProperty('eventTimestamp');
  });

  it('should filter by repairType=manual', async () => {
    const response = await request(app)
      .get('/api/admin/audit-log/repairs?repairType=manual')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    for (const event of response.body.events) {
      expect(event.repairType).toBe('manual');
    }
  });

  it('should filter by repairType=automatic', async () => {
    const response = await request(app)
      .get('/api/admin/audit-log/repairs?repairType=automatic')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    for (const event of response.body.events) {
      expect(event.repairType).toBe('automatic');
    }
  });

  it('should return 400 for invalid repairType', async () => {
    const response = await request(app)
      .get('/api/admin/audit-log/repairs?repairType=invalid')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid repairType');
  });

  it('should default page to 1 and limit to 25', async () => {
    const response = await request(app)
      .get('/api/admin/audit-log/repairs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(25);
  });

  it('should respect custom page and limit params', async () => {
    const response = await request(app)
      .get('/api/admin/audit-log/repairs?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination.limit).toBe(2);
    expect(response.body.events.length).toBeLessThanOrEqual(2);
  });

  it('should calculate summary stats correctly', async () => {
    const response = await request(app)
      .get('/api/admin/audit-log/repairs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const { summary } = response.body;

    // We created 2 manual + 1 automatic entries (at minimum)
    expect(summary.totalManualRepairs).toBeGreaterThanOrEqual(2);
    expect(summary.totalAutomaticRepairs).toBeGreaterThanOrEqual(1);
    // Savings = (5000 - 2500) + (2000 - 1000) = 3500 (at minimum from our test data)
    expect(summary.totalSavings).toBeGreaterThanOrEqual(3500);
  });

  it('should filter by date range', async () => {
    const now = new Date();
    const startDate = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(); // 12 hours ago

    const response = await request(app)
      .get(`/api/admin/audit-log/repairs?startDate=${startDate}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    // Should include the most recent entry but potentially exclude older ones
    for (const event of response.body.events) {
      expect(new Date(event.eventTimestamp).getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime());
    }
  });

  it('should include stableName and robotName from joined tables', async () => {
    const response = await request(app)
      .get('/api/admin/audit-log/repairs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    // Find an event from our test user
    const testEvent = response.body.events.find(
      (e: { userId: number }) => e.userId === testUserId
    );

    if (testEvent) {
      expect(testEvent.stableName).toBeTruthy();
      expect(testEvent.stableName).not.toBe('Unknown');
      expect(testEvent.robotName).toBeTruthy();
      expect(testEvent.robotName).not.toBe('Unknown');
    }
  });

  it('should return null for preDiscountCost and manualRepairDiscount on automatic repairs', async () => {
    const response = await request(app)
      .get('/api/admin/audit-log/repairs?repairType=automatic')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    for (const event of response.body.events) {
      expect(event.preDiscountCost).toBeNull();
      expect(event.manualRepairDiscount).toBeNull();
    }
  });
});
