// Feature: user-registration-module, Property 17: Dual Login Support
import * as fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from '../src/routes/auth';
import prisma from '../src/lib/prisma';
import { uniqueRegistration } from './helpers/uniqueRegistration';
import { errorHandler } from '../src/middleware/errorHandler';

dotenv.config();

// Create test app with auth routes
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// Spec #51: without the errorHandler mounted, a thrown AppError falls through
// to Express's default handler, which sends the right status with an EMPTY
// body. That is why these suites saw 400 but no `body.error` or `body.code`.
app.use(errorHandler);

// Test configuration
const NUM_RUNS = 10;

describe('Dual Login Support - Property Tests', () => {
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

  describe('Property 17: Dual Login Support', () => {
    /**
     * **Validates: Requirements 6.6**
     * For any registered user, logging in with their username and password should
     * succeed, and logging in with their email and password should also succeed,
     * producing equivalent authentication states.
     */
    test('login with username and login with email both succeed with equivalent user data', async () => {
      let runIndex = 0;

      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          async (username, email, password) => {
            // Spec #51: unique values come from a shared helper that budgets the
            // email local part. The old inline version sliced the composed address
            // to 20 chars, cutting into `@t.co` once the suffix grew, so
            // registration correctly returned 400 and this suite failed on 201.
            const suffix = `${Date.now()}${runIndex++}`;
            const { username: uniqueUsername, email: uniqueEmail } = uniqueRegistration(
              { username, email },
              suffix,
            );

            // Step 1: Register a user with valid credentials
            const registerResponse = await request(app)
              .post('/api/auth/register')
              .send({
                username: uniqueUsername,
                email: uniqueEmail,
                password,
                stableName: `s_${uniqueUsername}`.slice(0, 30),
              });

            expect(registerResponse.status).toBe(201);

            // Track for cleanup
            if (registerResponse.body.user?.id) {
              createdUserIds.push(registerResponse.body.user.id);
            }

            // Step 2: Login with the username as identifier
            const loginByUsername = await request(app)
              .post('/api/auth/login')
              .send({
                identifier: uniqueUsername,
                password,
              });

            expect(loginByUsername.status).toBe(200);

            // Step 3: Login with the email as identifier
            const loginByEmail = await request(app)
              .post('/api/auth/login')
              .send({
                identifier: uniqueEmail,
                password,
              });

            expect(loginByEmail.status).toBe(200);

            // Step 4: Verify both responses contain valid tokens
            expect(loginByUsername.body).toHaveProperty('token');
            expect(typeof loginByUsername.body.token).toBe('string');
            const usernameParts = loginByUsername.body.token.split('.');
            expect(usernameParts).toHaveLength(3);

            expect(loginByEmail.body).toHaveProperty('token');
            expect(typeof loginByEmail.body.token).toBe('string');
            const emailParts = loginByEmail.body.token.split('.');
            expect(emailParts).toHaveLength(3);

            // Step 5: Verify both responses contain matching user profiles
            const userByUsername = loginByUsername.body.user;
            const userByEmail = loginByEmail.body.user;

            expect(userByUsername).toHaveProperty('id');
            expect(userByEmail).toHaveProperty('id');

            // The user data from both logins must be equivalent
            expect(userByUsername.id).toBe(userByEmail.id);
            expect(userByUsername.username).toBe(userByEmail.username);
            expect(userByUsername.email).toBe(userByEmail.email);
            expect(userByUsername.currency).toBe(userByEmail.currency);
            expect(userByUsername.prestige).toBe(userByEmail.prestige);
            expect(userByUsername.role).toBe(userByEmail.role);

            // Verify the data matches what was registered
            expect(userByUsername.username).toBe(uniqueUsername);
            expect(userByUsername.email).toBe(uniqueEmail);
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
