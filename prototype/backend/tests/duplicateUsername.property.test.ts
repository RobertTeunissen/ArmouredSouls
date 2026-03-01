// Feature: user-registration-module, Property 5: Duplicate Username Rejection
import * as fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from '../src/routes/auth';
import prisma from '../src/lib/prisma';

dotenv.config();

// Create test app with auth routes
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// Test configuration
const NUM_RUNS = 25;

describe('Duplicate Username Rejection - Property Tests', () => {
  const createdUserIds: number[] = [];

  afterEach(async () => {
    // Clean up all created users after each test
    for (const id of createdUserIds) {
      try {
        await prisma.robot.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } });
      } catch {
        // Ignore if already deleted
      }
    }
    createdUserIds.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Property 5: Duplicate Username Rejection', () => {
    /**
     * **Validates: Requirements 2.1**
     * For any username that already exists in the database, attempting to register
     * with that username should be rejected with a descriptive error message.
     */
    test('registering with an already-taken username is rejected with error', async () => {
      let runIndex = 0;

      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          validPasswordArbitrary(),
          async (username, email1, email2, password1, password2) => {
            // Make values unique per run to avoid collisions across iterations
            const suffix = `${Date.now()}${runIndex++}`;
            const uniqueUsername = `${username.slice(0, 10)}${suffix}`.slice(0, 20);
            const uniqueEmail1 = `${email1.split('@')[0]}a${suffix}@t.co`.slice(0, 20);
            const uniqueEmail2 = `${email2.split('@')[0]}b${suffix}@t.co`.slice(0, 20);

            // Ensure generated values still meet validation rules after truncation
            if (uniqueUsername.length < 3 || uniqueEmail1.length < 3 || uniqueEmail2.length < 3) return;
            // Ensure the two emails are different
            if (uniqueEmail1 === uniqueEmail2) return;

            // Step 1: Register a user with the username
            const firstResponse = await request(app)
              .post('/api/auth/register')
              .send({
                username: uniqueUsername,
                email: uniqueEmail1,
                password: password1,
              });

            expect(firstResponse.status).toBe(201);

            // Track for cleanup
            if (firstResponse.body.user?.id) {
              createdUserIds.push(firstResponse.body.user.id);
            }

            // Step 2: Attempt to register again with the SAME username but different email
            const secondResponse = await request(app)
              .post('/api/auth/register')
              .send({
                username: uniqueUsername,
                email: uniqueEmail2,
                password: password2,
              });

            // Should be rejected with 400
            expect(secondResponse.status).toBe(400);
            expect(secondResponse.body.error).toBe('Username is already taken');
            expect(secondResponse.body.code).toBe('DUPLICATE_USERNAME');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate valid usernames (3-10 chars, alphanumeric + underscore + hyphen)
 * Kept short to leave room for uniqueness suffix
 */
function validUsernameArbitrary(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')
      ),
      { minLength: 3, maxLength: 10 }
    )
    .map((chars) => chars.join(''));
}

/**
 * Generate valid emails (e.g. ab3@x.co) fitting within 20 chars
 * Kept short to leave room for uniqueness suffix
 */
function validEmailArbitrary(): fc.Arbitrary<string> {
  const localPart = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 3 })
    .map((chars) => chars.join(''));
  const domain = fc.constantFrom('a', 'b', 'x', 'z');
  const tld = fc.constantFrom('co', 'io');
  return fc.tuple(localPart, domain, tld).map(([l, d, t]) => `${l}@${d}.${t}`);
}

/**
 * Generate valid passwords (8-32 chars)
 */
function validPasswordArbitrary(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'.split('')
      ),
      { minLength: 8, maxLength: 32 }
    )
    .map((chars) => chars.join(''));
}
