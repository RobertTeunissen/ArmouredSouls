// Feature: user-registration-module, Property 20: Authentication Equivalence (Round-Trip Property)
import * as fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
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

describe('Authentication Equivalence - Property Tests', () => {
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

  describe('Property 20: Authentication Equivalence (Round-Trip Property)', () => {
    /**
     * **Validates: Requirements 8.4, 11.13**
     * For any valid registration data, registering a new user and then immediately
     * logging in with those credentials should produce equivalent authentication
     * states (same user data, valid tokens, same permissions).
     */
    test('register then login produces equivalent authentication states', async () => {
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

            // Step 2: Immediately login with the same credentials (username + password)
            const loginResponse = await request(app)
              .post('/api/auth/login')
              .send({
                identifier: uniqueUsername,
                password,
              });

            expect(loginResponse.status).toBe(200);

            const regBody = registerResponse.body;
            const loginBody = loginResponse.body;

            // Step 3: Verify both responses contain valid JWT tokens
            expect(regBody).toHaveProperty('token');
            expect(typeof regBody.token).toBe('string');
            const regTokenParts = regBody.token.split('.');
            expect(regTokenParts).toHaveLength(3);

            expect(loginBody).toHaveProperty('token');
            expect(typeof loginBody.token).toBe('string');
            const loginTokenParts = loginBody.token.split('.');
            expect(loginTokenParts).toHaveLength(3);

            // Step 4: Verify user data from both responses is equivalent
            const regUser = regBody.user;
            const loginUser = loginBody.user;

            expect(regUser).toBeDefined();
            expect(loginUser).toBeDefined();

            // Same user id
            expect(regUser.id).toBe(loginUser.id);
            // Same username
            expect(regUser.username).toBe(loginUser.username);
            expect(regUser.username).toBe(uniqueUsername);
            // Same email
            expect(regUser.email).toBe(loginUser.email);
            expect(regUser.email).toBe(uniqueEmail);
            // Same currency
            expect(regUser.currency).toBe(loginUser.currency);
            // Same prestige
            expect(regUser.prestige).toBe(loginUser.prestige);
            // Same role
            expect(regUser.role).toBe(loginUser.role);

            // Step 5: Decode both JWT tokens and verify they contain the same userId and username
            const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
            const regPayload = jwt.verify(regBody.token, jwtSecret) as Record<string, unknown>;
            const loginPayload = jwt.verify(loginBody.token, jwtSecret) as Record<string, unknown>;

            // Both tokens should reference the same user
            expect(regPayload.userId).toBeDefined();
            expect(loginPayload.userId).toBeDefined();
            expect(String(regPayload.userId)).toBe(String(loginPayload.userId));

            expect(regPayload.username).toBeDefined();
            expect(loginPayload.username).toBeDefined();
            expect(regPayload.username).toBe(loginPayload.username);
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
