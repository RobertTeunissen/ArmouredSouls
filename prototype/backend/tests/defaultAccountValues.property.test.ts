import * as fc from 'fast-check';
import { createUser, CreateUserData } from '../src/services/userService';
import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';

// Test configuration
const NUM_RUNS = 25;

describe('Default Account Values - Property Tests', () => {
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

  describe('Property 4: Default Account Values', () => {
    /**
     * **Validates: Requirements 1.6, 1.7, 1.8**
     * For any newly created user account, the initial values should be:
     * currency set to the default amount (3000000 per Prisma schema),
     * prestige set to zero, and role set to 'user'.
     */
    test('newly created users have correct default currency, prestige, and role', async () => {
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

            const passwordHash = await bcrypt.hash(password, 10);
            const userData: CreateUserData = {
              username: uniqueUsername,
              email: uniqueEmail,
              passwordHash,
            };

            const user = await createUser(userData);
            createdUserIds.push(user.id);

            // Property: currency defaults to 3000000
            expect(user.currency).toBe(3000000);

            // Property: prestige defaults to 0
            expect(user.prestige).toBe(0);

            // Property: role defaults to 'user'
            expect(user.role).toBe('user');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('default values persist correctly in the database', async () => {
      let runIndex = 0;

      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          async (username, email, password) => {
            const suffix = `${Date.now()}${runIndex++}`;
            const uniqueUsername = `${username.slice(0, 10)}${suffix}`.slice(0, 20);
            const uniqueEmail = `${email.split('@')[0]}${suffix}@t.co`.slice(0, 20);

            const passwordHash = await bcrypt.hash(password, 10);
            const user = await createUser({
              username: uniqueUsername,
              email: uniqueEmail,
              passwordHash,
            });
            createdUserIds.push(user.id);

            // Verify defaults are persisted by re-reading from database
            const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
            expect(dbUser).not.toBeNull();
            expect(dbUser!.currency).toBe(3000000);
            expect(dbUser!.prestige).toBe(0);
            expect(dbUser!.role).toBe('user');
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
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$'.split('')
      ),
      { minLength: 8, maxLength: 32 }
    )
    .map((chars) => chars.join(''));
}
