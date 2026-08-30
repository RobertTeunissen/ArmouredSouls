// Feature: user-registration-module, Property 6: Duplicate Email Rejection
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

describe('Duplicate Email Rejection - Property Tests', () => {
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

  describe('Property 6: Duplicate Email Rejection', () => {
    /**
     * **Validates: Requirements 2.2**
     * For any email address that already exists in the database, attempting to register
     * with that email should be rejected with a descriptive error message.
     */
    test('registering with an already-taken email is rejected with error', async () => {
      let runIndex = 0;

      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          validPasswordArbitrary(),
          async (username1, username2, email, password1, password2) => {
            // Spec #51: unique values come from a shared helper that budgets the
            // email local part. The old inline version sliced the composed
            // address to 20 chars, cutting into `@t.co` once the suffix grew, so
            // the FIRST registration returned 400 and the suite failed on 201 —
            // before it ever got to test the duplicate-email behaviour it exists
            // to cover.
            const suffix = `${Date.now()}${runIndex++}`;
            const { username: uniqueUsername1, email: uniqueEmail } = uniqueRegistration(
              { username: username1, email },
              `a${suffix}`,
            );
            const { username: uniqueUsername2 } = uniqueRegistration(
              { username: username2 },
              `b${suffix}`,
            );

            // The two usernames must differ for this property to mean anything.
            if (uniqueUsername1 === uniqueUsername2) return;

            // Step 1: Register a user with the email
            const firstResponse = await request(app)
              .post('/api/auth/register')
              .send({
                username: uniqueUsername1,
                email: uniqueEmail,
                password: password1,
                stableName: `s1_${suffix}`.slice(0, 30),
              });

            expect(firstResponse.status).toBe(201);

            // Track for cleanup
            if (firstResponse.body.user?.id) {
              createdUserIds.push(firstResponse.body.user.id);
            }

            // Step 2: Attempt to register again with a DIFFERENT username but the SAME email
            const secondResponse = await request(app)
              .post('/api/auth/register')
              .send({
                username: uniqueUsername2,
                email: uniqueEmail,
                password: password2,
                stableName: `s2_${suffix}`.slice(0, 30),
              });

            // Should be rejected with 400
            expect(secondResponse.status).toBe(409);
            expect(secondResponse.body.error).toBe('Email is already registered');
            expect(secondResponse.body.code).toBe('DUPLICATE_EMAIL');
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
 * Generate valid usernames (3-5 chars, alphanumeric + underscore + hyphen)
 * Kept short to leave room for uniqueness suffix
 */
function validUsernameArbitrary(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')
      ),
      { minLength: 3, maxLength: 5 }
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
