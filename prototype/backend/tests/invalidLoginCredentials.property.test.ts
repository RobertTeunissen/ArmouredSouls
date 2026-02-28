// Feature: user-registration-module, Property 16: Invalid Login Credentials
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

describe('Invalid Login Credentials - Property Tests', () => {
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

  describe('Property 16: Invalid Login Credentials', () => {
    /**
     * **Validates: Requirements 6.5**
     * For any non-existent login identifier, the system should return a 401
     * with a generic authentication error message without revealing that the user does not exist.
     */
    test('login with non-existent identifier returns 401 with generic error', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonExistentIdentifierArbitrary(),
          validPasswordArbitrary(),
          async (identifier, password) => {
            const response = await request(app)
              .post('/api/auth/login')
              .send({ identifier, password });

            // Should return 401 Unauthorized
            expect(response.status).toBe(401);

            // Should return a generic error message
            expect(response.body).toHaveProperty('error');
            expect(typeof response.body.error).toBe('string');
            expect(response.body.error).toBe('Invalid credentials');

            // The error message must NOT reveal whether the identifier was wrong
            const errorLower = response.body.error.toLowerCase();
            expect(errorLower).not.toContain('not found');
            expect(errorLower).not.toContain('does not exist');
            expect(errorLower).not.toContain('no user');
            expect(errorLower).not.toContain('unknown user');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * **Validates: Requirements 6.5**
     * For any valid user, logging in with the correct identifier but a wrong password
     * should return a 401 with the SAME generic error message as a non-existent identifier,
     * without revealing that the password was incorrect.
     */
    test('login with valid identifier but wrong password returns 401 with same generic error', async () => {
      let runIndex = 0;

      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          wrongPasswordArbitrary(),
          async (username, email, correctPassword, wrongPassword) => {
            // Ensure wrong password differs from correct password
            if (wrongPassword === correctPassword) return;

            // Make username and email unique per run
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
                password: correctPassword,
              });

            expect(registerResponse.status).toBe(201);

            // Track for cleanup
            if (registerResponse.body.user?.id) {
              createdUserIds.push(registerResponse.body.user.id);
            }

            // Step 2: Attempt login with correct identifier but wrong password
            const loginResponse = await request(app)
              .post('/api/auth/login')
              .send({
                identifier: uniqueUsername,
                password: wrongPassword,
              });

            // Should return 401 Unauthorized
            expect(loginResponse.status).toBe(401);

            // Should return the SAME generic error message as non-existent user
            expect(loginResponse.body).toHaveProperty('error');
            expect(typeof loginResponse.body.error).toBe('string');
            expect(loginResponse.body.error).toBe('Invalid credentials');

            // The error message must NOT reveal that the password was wrong
            const errorLower = loginResponse.body.error.toLowerCase();
            expect(errorLower).not.toContain('wrong password');
            expect(errorLower).not.toContain('incorrect password');
            expect(errorLower).not.toContain('password mismatch');
            expect(errorLower).not.toContain('password is');
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
 * Generate non-existent identifiers that are unlikely to match any real user.
 * Uses a prefix to ensure uniqueness.
 */
function nonExistentIdentifierArbitrary(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
      ),
      { minLength: 3, maxLength: 10 }
    )
    .map((chars) => `nx_${Date.now()}_${chars.join('')}`);
}

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

/**
 * Generate wrong passwords (8-32 chars) that are valid format but different from the correct one
 */
function wrongPasswordArbitrary(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'.split('')
      ),
      { minLength: 8, maxLength: 32 }
    )
    .map((chars) => chars.join(''));
}
