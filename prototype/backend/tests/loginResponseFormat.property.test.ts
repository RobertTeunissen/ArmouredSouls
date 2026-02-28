// Feature: user-registration-module, Property 15: Login Response Format
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
const NUM_RUNS = 100;

describe('Login Response Format - Property Tests', () => {
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

  describe('Property 15: Login Response Format', () => {
    /**
     * **Validates: Requirements 6.3, 6.4**
     * For any valid login identifier (username or email) and password combination,
     * the response should contain both a valid JWT token and a user profile object
     * with id, username, email, currency, prestige, and role fields.
     */
    test('successful login returns valid JWT token and complete user profile', async () => {
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

            // Step 1: Register a user with valid credentials
            const registerResponse = await request(app)
              .post('/api/auth/register')
              .send({
                username: uniqueUsername,
                email: uniqueEmail,
                password,
              });

            expect(registerResponse.status).toBe(201);

            // Track for cleanup
            if (registerResponse.body.user?.id) {
              createdUserIds.push(registerResponse.body.user.id);
            }

            // Step 2: Login with the registered username and password
            const loginResponse = await request(app)
              .post('/api/auth/login')
              .send({
                identifier: uniqueUsername,
                password,
              });

            // Login should succeed with 200
            expect(loginResponse.status).toBe(200);

            const body = loginResponse.body;

            // Step 3: Verify the login response contains a valid JWT token (3 dot-separated parts)
            expect(body).toHaveProperty('token');
            expect(typeof body.token).toBe('string');
            expect(body.token.length).toBeGreaterThan(0);
            const jwtParts = body.token.split('.');
            expect(jwtParts).toHaveLength(3);
            expect(jwtParts[0].length).toBeGreaterThan(0);
            expect(jwtParts[1].length).toBeGreaterThan(0);
            expect(jwtParts[2].length).toBeGreaterThan(0);

            // Step 4: Verify the login response contains a user object with all required fields
            expect(body).toHaveProperty('user');
            expect(typeof body.user).toBe('object');
            expect(body.user).not.toBeNull();
            expect(body.user).toHaveProperty('id');
            expect(body.user).toHaveProperty('username');
            expect(body.user).toHaveProperty('email');
            expect(body.user).toHaveProperty('currency');
            expect(body.user).toHaveProperty('prestige');
            expect(body.user).toHaveProperty('role');

            // Step 5: Verify the user data matches the registered user
            expect(body.user.username).toBe(uniqueUsername);
            expect(body.user.email).toBe(uniqueEmail);
            expect(typeof body.user.id).toBe('number');
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
