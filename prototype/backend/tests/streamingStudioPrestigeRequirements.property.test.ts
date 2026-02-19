/**
 * Property-Based Tests for Streaming Studio Prestige Requirements
 * Property 9: Streaming Studio Prestige Requirements
 * 
 * **Validates: Requirements 6.1-6.9**
 * 
 * For any Streaming Studio upgrade to level L, the system should enforce the 
 * prestige requirement: [0, 0, 0, 1000, 2500, 5000, 10000, 15000, 25000, 50000][L-1],
 * and reject upgrades when the user's prestige is below the requirement
 */

import fc from 'fast-check';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import facilityRoutes from '../src/routes/facility';
import { createTestUser, deleteTestUser } from './testHelpers';
import { getFacilityConfig } from '../src/config/facilities';

dotenv.config();

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/facility', facilityRoutes);

// Prestige requirements for Streaming Studio levels 1-10
const PRESTIGE_REQUIREMENTS = [0, 0, 0, 1000, 2500, 5000, 10000, 15000, 25000, 50000];

describe('Property 9: Streaming Studio Prestige Requirements', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test user with sufficient credits
    testUser = await createTestUser();
    
    // Give user enough credits for all upgrades
    await prisma.user.update({
      where: { id: testUser.id },
      data: { currency: 10000000, prestige: 0 },
    });

    // Generate JWT token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterEach(async () => {
    // Cleanup
    if (testUser) {
      await deleteTestUser(testUser.id);
    }
  });

  /**
   * Helper function to upgrade facility to a specific level
   */
  async function upgradeFacilityToLevel(targetLevel: number, userPrestige: number): Promise<void> {
    // Set user prestige
    await prisma.user.update({
      where: { id: testUser.id },
      data: { prestige: userPrestige },
    });

    // Upgrade facility level by level
    for (let i = 0; i < targetLevel; i++) {
      await request(app)
        .post('/api/facility/upgrade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ facilityType: 'streaming_studio' });
    }
  }

  /**
   * Property 9: For any Streaming Studio upgrade to level L, the system should
   * enforce the prestige requirement and reject upgrades when prestige is insufficient
   */
  test('Property 9: Prestige requirements enforced for all levels', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // target level (1-10)
        fc.integer({ min: 0, max: 60000 }), // user prestige
        async (targetLevel, userPrestige) => {
          // Clean up any existing facility
          await prisma.facility.deleteMany({
            where: {
              userId: testUser.id,
              facilityType: 'streaming_studio',
            },
          });

          // Reset user prestige and currency
          await prisma.user.update({
            where: { id: testUser.id },
            data: { prestige: userPrestige, currency: 10000000 },
          });

          // Get the prestige requirement for the target level
          const requiredPrestige = PRESTIGE_REQUIREMENTS[targetLevel - 1];

          // Upgrade to level before target (if target > 1)
          if (targetLevel > 1) {
            // For levels before target, we need enough prestige to reach them
            // Find the maximum prestige requirement up to (targetLevel - 1)
            const maxPrestigeNeeded = Math.max(
              ...PRESTIGE_REQUIREMENTS.slice(0, targetLevel - 1)
            );
            
            // If user doesn't have enough prestige to reach the level before target,
            // we need to give them enough to get there
            if (userPrestige < maxPrestigeNeeded) {
              await prisma.user.update({
                where: { id: testUser.id },
                data: { prestige: maxPrestigeNeeded },
              });
            }

            // Upgrade to level before target
            for (let i = 0; i < targetLevel - 1; i++) {
              const response = await request(app)
                .post('/api/facility/upgrade')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ facilityType: 'streaming_studio' });
              
              // Should succeed since we have enough prestige
              expect(response.status).toBe(200);
            }

            // Now set the user's prestige to the test value
            await prisma.user.update({
              where: { id: testUser.id },
              data: { prestige: userPrestige },
            });
          }

          // Attempt to upgrade to target level
          const response = await request(app)
            .post('/api/facility/upgrade')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ facilityType: 'streaming_studio' });

          // Property: If user prestige >= required prestige, upgrade should succeed
          if (userPrestige >= requiredPrestige) {
            expect(response.status).toBe(200);
            expect(response.body.facility.level).toBe(targetLevel);
          } else {
            // Property: If user prestige < required prestige, upgrade should fail
            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Insufficient prestige');
            expect(response.body.required).toBe(requiredPrestige);
            expect(response.body.current).toBe(userPrestige);
            expect(response.body.message).toContain(`Streaming Studio Level ${targetLevel}`);
            expect(response.body.message).toContain(`${requiredPrestige.toLocaleString()} prestige`);
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 60000);

  /**
   * Property 9.1: Levels 1-3 should never require prestige
   */
  test('Property 9.1: Levels 1-3 require no prestige', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(1, 2, 3), // levels 1-3
        fc.integer({ min: 0, max: 60000 }), // any prestige value
        async (targetLevel, userPrestige) => {
          // Clean up any existing facility
          await prisma.facility.deleteMany({
            where: {
              userId: testUser.id,
              facilityType: 'streaming_studio',
            },
          });

          // Set user prestige
          await prisma.user.update({
            where: { id: testUser.id },
            data: { prestige: userPrestige, currency: 10000000 },
          });

          // Upgrade to target level
          for (let i = 0; i < targetLevel; i++) {
            const response = await request(app)
              .post('/api/facility/upgrade')
              .set('Authorization', `Bearer ${authToken}`)
              .send({ facilityType: 'streaming_studio' });

            // Property: Should always succeed regardless of prestige
            expect(response.status).toBe(200);
          }

          // Verify final level
          const facility = await prisma.facility.findFirst({
            where: {
              userId: testUser.id,
              facilityType: 'streaming_studio',
            },
          });

          expect(facility?.level).toBe(targetLevel);
        }
      ),
      { numRuns: 30 }
    );
  }, 30000);

  /**
   * Property 9.2: Levels 4-10 should enforce progressive prestige requirements
   */
  test('Property 9.2: Levels 4-10 enforce progressive prestige requirements', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(4, 5, 6, 7, 8, 9, 10), // levels 4-10
        async (targetLevel) => {
          // Clean up any existing facility
          await prisma.facility.deleteMany({
            where: {
              userId: testUser.id,
              facilityType: 'streaming_studio',
            },
          });

          const requiredPrestige = PRESTIGE_REQUIREMENTS[targetLevel - 1];

          // Test with prestige just below requirement
          const insufficientPrestige = requiredPrestige - 1;
          
          // Upgrade to level before target with sufficient prestige
          const maxPrestigeNeeded = Math.max(
            ...PRESTIGE_REQUIREMENTS.slice(0, targetLevel - 1)
          );
          await prisma.user.update({
            where: { id: testUser.id },
            data: { prestige: maxPrestigeNeeded, currency: 10000000 },
          });

          for (let i = 0; i < targetLevel - 1; i++) {
            await request(app)
              .post('/api/facility/upgrade')
              .set('Authorization', `Bearer ${authToken}`)
              .send({ facilityType: 'streaming_studio' });
          }

          // Set prestige to insufficient amount
          await prisma.user.update({
            where: { id: testUser.id },
            data: { prestige: insufficientPrestige },
          });

          // Attempt upgrade with insufficient prestige
          const failResponse = await request(app)
            .post('/api/facility/upgrade')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ facilityType: 'streaming_studio' });

          // Property: Should fail with insufficient prestige
          expect(failResponse.status).toBe(403);
          expect(failResponse.body.required).toBe(requiredPrestige);

          // Now set prestige to exactly the requirement
          await prisma.user.update({
            where: { id: testUser.id },
            data: { prestige: requiredPrestige },
          });

          // Attempt upgrade with exact prestige
          const successResponse = await request(app)
            .post('/api/facility/upgrade')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ facilityType: 'streaming_studio' });

          // Property: Should succeed with exact prestige requirement
          expect(successResponse.status).toBe(200);
          expect(successResponse.body.facility.level).toBe(targetLevel);
        }
      ),
      { numRuns: 30 }
    );
  }, 60000);

  /**
   * Property 9.3: Prestige requirements should match the configuration
   */
  test('Property 9.3: Prestige requirements match facility configuration', async () => {
    // Get the facility configuration
    const config = getFacilityConfig('streaming_studio');
    expect(config).toBeDefined();
    expect(config!.prestigeRequirements).toBeDefined();

    // Property: Configuration should match expected requirements
    expect(config!.prestigeRequirements).toEqual(PRESTIGE_REQUIREMENTS);

    // Property: Each level should have a prestige requirement defined
    expect(config!.prestigeRequirements!.length).toBe(10);

    // Property: Requirements should be monotonically non-decreasing
    for (let i = 1; i < config!.prestigeRequirements!.length; i++) {
      expect(config!.prestigeRequirements![i]).toBeGreaterThanOrEqual(
        config!.prestigeRequirements![i - 1]
      );
    }
  });

  /**
   * Property 9.4: Error messages should contain required prestige information
   */
  test('Property 9.4: Error messages contain required prestige information', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(4, 5, 6, 7, 8, 9, 10), // levels with prestige requirements
        async (targetLevel) => {
          // Clean up any existing facility
          await prisma.facility.deleteMany({
            where: {
              userId: testUser.id,
              facilityType: 'streaming_studio',
            },
          });

          const requiredPrestige = PRESTIGE_REQUIREMENTS[targetLevel - 1];

          // Upgrade to level before target
          const maxPrestigeNeeded = Math.max(
            ...PRESTIGE_REQUIREMENTS.slice(0, targetLevel - 1)
          );
          await prisma.user.update({
            where: { id: testUser.id },
            data: { prestige: maxPrestigeNeeded, currency: 10000000 },
          });

          for (let i = 0; i < targetLevel - 1; i++) {
            await request(app)
              .post('/api/facility/upgrade')
              .set('Authorization', `Bearer ${authToken}`)
              .send({ facilityType: 'streaming_studio' });
          }

          // Set prestige to 0
          await prisma.user.update({
            where: { id: testUser.id },
            data: { prestige: 0 },
          });

          // Attempt upgrade
          const response = await request(app)
            .post('/api/facility/upgrade')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ facilityType: 'streaming_studio' });

          // Property: Error response should contain all required fields
          expect(response.status).toBe(403);
          expect(response.body).toHaveProperty('error');
          expect(response.body).toHaveProperty('required');
          expect(response.body).toHaveProperty('current');
          expect(response.body).toHaveProperty('message');

          // Property: Required prestige should match configuration
          expect(response.body.required).toBe(requiredPrestige);

          // Property: Current prestige should match user's prestige
          expect(response.body.current).toBe(0);

          // Property: Message should contain level and prestige information
          expect(response.body.message).toMatch(/Streaming Studio Level \d+/);
          expect(response.body.message).toMatch(/[\d,]+ prestige/);
        }
      ),
      { numRuns: 30 }
    );
  }, 60000);

  /**
   * Property 9.5: Prestige check should occur before currency check
   */
  test('Property 9.5: Prestige validation occurs regardless of currency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(4, 5, 6, 7, 8, 9, 10), // levels with prestige requirements
        fc.integer({ min: 0, max: 1000 }), // insufficient currency
        async (targetLevel, insufficientCurrency) => {
          // Clean up any existing facility
          await prisma.facility.deleteMany({
            where: {
              userId: testUser.id,
              facilityType: 'streaming_studio',
            },
          });

          const requiredPrestige = PRESTIGE_REQUIREMENTS[targetLevel - 1];

          // Upgrade to level before target
          const maxPrestigeNeeded = Math.max(
            ...PRESTIGE_REQUIREMENTS.slice(0, targetLevel - 1)
          );
          await prisma.user.update({
            where: { id: testUser.id },
            data: { prestige: maxPrestigeNeeded, currency: 10000000 },
          });

          for (let i = 0; i < targetLevel - 1; i++) {
            await request(app)
              .post('/api/facility/upgrade')
              .set('Authorization', `Bearer ${authToken}`)
              .send({ facilityType: 'streaming_studio' });
          }

          // Set prestige to 0 and currency to insufficient amount
          await prisma.user.update({
            where: { id: testUser.id },
            data: { prestige: 0, currency: insufficientCurrency },
          });

          // Attempt upgrade
          const response = await request(app)
            .post('/api/facility/upgrade')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ facilityType: 'streaming_studio' });

          // Property: Should fail with prestige error (not currency error)
          // This validates that prestige is checked first
          expect(response.status).toBe(403);
          expect(response.body.error).toBe('Insufficient prestige');
          expect(response.body.required).toBe(requiredPrestige);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);
});
