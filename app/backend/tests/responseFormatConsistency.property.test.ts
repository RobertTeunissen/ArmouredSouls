// Feature: user-registration-module, Property 19: Response Format Consistency
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

describe('Response Format Consistency - Property Tests', () => {
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

  describe('Property 19: Response Format Consistency', () => {
    /**
     * **Validates: Requirements 8.3**
     * For any user account, the user data returned by the registration endpoint
     * should have the same structure and field names as the user data returned
     * by the login endpoint.
     */
    test('registration and login endpoints return user data with the same structure and values', async () => {
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
                stableName: `stb_${suffix}`.slice(0, 30),
              });

            expect(registerResponse.status).toBe(201);

            // Track for cleanup
            if (registerResponse.body.user?.id) {
              createdUserIds.push(registerResponse.body.user.id);
            }

            const registrationUser = registerResponse.body.user;

            // Step 2: Login with the same credentials
            const loginResponse = await request(app)
              .post('/api/auth/login')
              .send({
                identifier: uniqueUsername,
                password,
              });

            expect(loginResponse.status).toBe(200);

            const loginUser = loginResponse.body.user;

            // Step 3: Verify both user objects share the common fields
            // Registration may include additional fields like stableName
            const commonFields = ['id', 'username', 'email', 'currency', 'prestige', 'role'];
            for (const field of commonFields) {
              expect(registrationUser).toHaveProperty(field);
              expect(loginUser).toHaveProperty(field);
            }

            // Step 4: Verify the common field values match
            expect(registrationUser.id).toBe(loginUser.id);
            expect(registrationUser.username).toBe(loginUser.username);
            expect(registrationUser.email).toBe(loginUser.email);
            expect(registrationUser.currency).toBe(loginUser.currency);
            expect(registrationUser.prestige).toBe(loginUser.prestige);
            expect(registrationUser.role).toBe(loginUser.role);
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
