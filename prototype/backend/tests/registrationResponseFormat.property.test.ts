// Feature: user-registration-module, Property 3: Registration Response Format
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

describe('Registration Response Format - Property Tests', () => {
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

  describe('Property 3: Registration Response Format', () => {
    /**
     * **Validates: Requirements 1.3, 1.4**
     * For any successful registration, the response should contain both a valid
     * JWT token and a user profile object with id, username, email, currency,
     * prestige, and role fields.
     */
    test('successful registration returns valid JWT token and complete user profile', async () => {
      let runIndex = 0;

      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          async (username, email, password) => {
            // Make username and email unique per run to avoid collisions
            const suffix = `${Date.now()}${runIndex++}`;
            const uniqueUsername = `${username.slice(0, 10)}${suffix}`.slice(0, 20);
            const uniqueEmail = `${email.split('@')[0]}${suffix}@t.co`.slice(0, 20);

            // Ensure generated values still meet validation rules after truncation
            if (uniqueUsername.length < 3 || uniqueEmail.length < 3) return;

            const response = await request(app)
              .post('/api/auth/register')
              .send({
                username: uniqueUsername,
                email: uniqueEmail,
                password,
              });

            // Registration should succeed
            expect(response.status).toBe(201);

            // Track for cleanup
            if (response.body.user?.id) {
              createdUserIds.push(response.body.user.id);
            }

            const body = response.body;

            // 1. Response contains a `token` field that is a non-empty string
            //    with valid JWT format (3 dot-separated parts)
            expect(body).toHaveProperty('token');
            expect(typeof body.token).toBe('string');
            expect(body.token.length).toBeGreaterThan(0);
            const jwtParts = body.token.split('.');
            expect(jwtParts).toHaveLength(3);
            // Each JWT part should be non-empty
            expect(jwtParts[0].length).toBeGreaterThan(0);
            expect(jwtParts[1].length).toBeGreaterThan(0);
            expect(jwtParts[2].length).toBeGreaterThan(0);

            // 2. Response contains a `user` object with all required fields
            expect(body).toHaveProperty('user');
            expect(typeof body.user).toBe('object');
            expect(body.user).not.toBeNull();
            expect(body.user).toHaveProperty('id');
            expect(body.user).toHaveProperty('username');
            expect(body.user).toHaveProperty('email');
            expect(body.user).toHaveProperty('currency');
            expect(body.user).toHaveProperty('prestige');
            expect(body.user).toHaveProperty('role');

            // 3. The user.username matches the submitted username
            expect(body.user.username).toBe(uniqueUsername);

            // 4. The user.email matches the submitted email
            expect(body.user.email).toBe(uniqueEmail);

            // 5. Field types: currency is a number, prestige is a number, role is a string
            expect(typeof body.user.currency).toBe('number');
            expect(typeof body.user.prestige).toBe('number');
            expect(typeof body.user.role).toBe('string');
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
