import * as fc from 'fast-check';
import request from 'supertest';
import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import userRoutes from '../src/routes/user';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/user', userRoutes);

// Test configuration
const NUM_RUNS = 25;

describe('Profile Update Endpoint - Property Tests', () => {
  let testUsers: any[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    // Cleanup all test users after each test
    for (const user of testUsers) {
      await prisma.user.deleteMany({ where: { id: user.id } }).catch(() => {});
    }
    testUsers = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Property 2: Stable name update round-trip', () => {
    /**
     * **Validates: Requirements 1.3**
     * For any valid stable name, when a user updates their stable name and then fetches
     * their profile, the returned stable name should match the submitted value.
     */
    test('stable name round-trip preserves the submitted value', async () => {
      await fc.assert(
        fc.asyncProperty(
          validStableNameGenerator(),
          async (stableName) => {
            // Trim the stable name (backend trims it)
            const trimmedName = stableName.trim();
            
            // Make stable name unique by adding timestamp and random suffix, ensure it stays within 30 chars
            const suffix = `_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const maxBaseLength = 30 - suffix.length;
            const baseName = trimmedName.substring(0, maxBaseLength);
            const uniqueStableName = `${baseName}${suffix}`;
            
            // Create test user
            const passwordHash = await bcrypt.hash('TestPass123', 10);
            const user = await prisma.user.create({
              data: {
                username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                passwordHash,
                role: 'user',
              },
            });

            testUsers.push(user);

            // Generate auth token
            const authToken = jwt.sign(
              { userId: user.id, username: user.username, role: user.role },
              JWT_SECRET
            );

            // Update stable name
            const updateResponse = await request(app)
              .put('/api/user/profile')
              .set('Authorization', `Bearer ${authToken}`)
              .send({ stableName: uniqueStableName });

            expect(updateResponse.status).toBe(200);

            // Fetch profile
            const getResponse = await request(app)
              .get('/api/user/profile')
              .set('Authorization', `Bearer ${authToken}`);

            expect(getResponse.status).toBe(200);
            expect(getResponse.body.stableName).toBe(uniqueStableName);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 5: Password change round-trip', () => {
    /**
     * **Validates: Requirements 3.8**
     * For any valid new password, when a user successfully changes their password with
     * correct current password, they should be able to authenticate with the new password
     * immediately.
     */
    test('password change allows authentication with new password', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPasswordGenerator(),
          validPasswordGenerator(),
          async (currentPassword, newPassword) => {
            // Skip if passwords are the same
            fc.pre(currentPassword !== newPassword);

            // Create test user with current password
            const passwordHash = await bcrypt.hash(currentPassword, 10);
            const user = await prisma.user.create({
              data: {
                username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                passwordHash,
                role: 'user',
              },
            });

            testUsers.push(user);

            // Generate auth token
            const authToken = jwt.sign(
              { userId: user.id, username: user.username, role: user.role },
              JWT_SECRET
            );

            // Change password
            const updateResponse = await request(app)
              .put('/api/user/profile')
              .set('Authorization', `Bearer ${authToken}`)
              .send({ currentPassword, newPassword });

            expect(updateResponse.status).toBe(200);

            // Verify new password works by checking the hash in database
            const updatedUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { passwordHash: true },
            });

            expect(updatedUser).not.toBeNull();
            const passwordMatches = await bcrypt.compare(newPassword, updatedUser!.passwordHash);
            expect(passwordMatches).toBe(true);

            // Verify old password no longer works
            const oldPasswordMatches = await bcrypt.compare(currentPassword, updatedUser!.passwordHash);
            expect(oldPasswordMatches).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    }, 60000); // Increase timeout to 60 seconds for bcrypt operations
  });

  describe('Property 6: Visibility setting round-trip', () => {
    /**
     * **Validates: Requirements 4.5**
     * For any valid visibility setting ("public" or "private"), when a user updates their
     * profile visibility and then fetches their profile, the returned visibility should
     * match the submitted value.
     */
    test('visibility setting round-trip preserves the submitted value', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('public' as const, 'private' as const),
          async (visibility) => {
            // Create test user
            const passwordHash = await bcrypt.hash('TestPass123', 10);
            const user = await prisma.user.create({
              data: {
                username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                passwordHash,
                role: 'user',
              },
            });

            testUsers.push(user);

            // Generate auth token
            const authToken = jwt.sign(
              { userId: user.id, username: user.username, role: user.role },
              JWT_SECRET
            );

            // Update visibility
            const updateResponse = await request(app)
              .put('/api/user/profile')
              .set('Authorization', `Bearer ${authToken}`)
              .send({ profileVisibility: visibility });

            expect(updateResponse.status).toBe(200);

            // Fetch profile
            const getResponse = await request(app)
              .get('/api/user/profile')
              .set('Authorization', `Bearer ${authToken}`);

            expect(getResponse.status).toBe(200);
            expect(getResponse.body.profileVisibility).toBe(visibility);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 8: Partial updates preserve unchanged fields', () => {
    /**
     * **Validates: Requirements 6.5**
     * For any profile update request that modifies only a subset of editable fields,
     * all fields not included in the request should remain unchanged in the database.
     */
    test('partial updates preserve unchanged fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          partialUpdateGenerator(),
          async (updateData) => {
            // Filter out undefined values (don't send them in request)
            const cleanUpdateData: any = {};
            Object.keys(updateData).forEach(key => {
              if (updateData[key] !== undefined) {
                cleanUpdateData[key] = updateData[key];
              }
            });

            // Create test user with initial values (make stable name unique and within 30 chars)
            const passwordHash = await bcrypt.hash('TestPass123', 10);
            const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const suffix = `_${uniqueSuffix}`;
            const maxBaseLength = 30 - suffix.length;
            const baseName = 'InitialStable'.substring(0, maxBaseLength);
            const initialStableName = `${baseName}${suffix}`;
            const initialVisibility = 'public';
            const initialBattleNotif = true;
            const initialLeagueNotif = true;
            const initialTheme = 'dark';

            const user = await prisma.user.create({
              data: {
                username: `testuser_${uniqueSuffix}`,
                passwordHash,
                role: 'user',
                stableName: initialStableName,
                profileVisibility: initialVisibility,
                notificationsBattle: initialBattleNotif,
                notificationsLeague: initialLeagueNotif,
                themePreference: initialTheme,
              },
            });

            testUsers.push(user);

            // Generate auth token
            const authToken = jwt.sign(
              { userId: user.id, username: user.username, role: user.role },
              JWT_SECRET
            );

            // Update only the fields in cleanUpdateData
            const updateResponse = await request(app)
              .put('/api/user/profile')
              .set('Authorization', `Bearer ${authToken}`)
              .send(cleanUpdateData);

            expect(updateResponse.status).toBe(200);

            // Fetch profile
            const getResponse = await request(app)
              .get('/api/user/profile')
              .set('Authorization', `Bearer ${authToken}`);

            expect(getResponse.status).toBe(200);

            // Verify updated fields match (only check fields that were sent)
            if ('stableName' in cleanUpdateData) {
              expect(getResponse.body.stableName).toBe(cleanUpdateData.stableName);
            } else {
              expect(getResponse.body.stableName).toBe(initialStableName);
            }

            if ('profileVisibility' in cleanUpdateData) {
              expect(getResponse.body.profileVisibility).toBe(cleanUpdateData.profileVisibility);
            } else {
              expect(getResponse.body.profileVisibility).toBe(initialVisibility);
            }

            if ('notificationsBattle' in cleanUpdateData) {
              expect(getResponse.body.notificationsBattle).toBe(cleanUpdateData.notificationsBattle);
            } else {
              expect(getResponse.body.notificationsBattle).toBe(initialBattleNotif);
            }

            if ('notificationsLeague' in cleanUpdateData) {
              expect(getResponse.body.notificationsLeague).toBe(cleanUpdateData.notificationsLeague);
            } else {
              expect(getResponse.body.notificationsLeague).toBe(initialLeagueNotif);
            }

            if ('themePreference' in cleanUpdateData) {
              expect(getResponse.body.themePreference).toBe(cleanUpdateData.themePreference);
            } else {
              expect(getResponse.body.themePreference).toBe(initialTheme);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 9: Successful update returns updated profile', () => {
    /**
     * **Validates: Requirements 6.6**
     * For any valid profile update request, the API response should contain the complete
     * updated profile data with all modified fields reflecting their new values.
     */
    test('successful update returns complete updated profile', async () => {
      await fc.assert(
        fc.asyncProperty(
          validProfileUpdateGenerator(),
          async (updateData) => {
            // Filter out undefined values (don't send them in request)
            const cleanUpdateData: any = {};
            Object.keys(updateData).forEach(key => {
              if (updateData[key] !== undefined) {
                cleanUpdateData[key] = updateData[key];
              }
            });

            // Create test user
            const passwordHash = await bcrypt.hash('TestPass123', 10);
            const user = await prisma.user.create({
              data: {
                username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                passwordHash,
                role: 'user',
              },
            });

            testUsers.push(user);

            // Generate auth token
            const authToken = jwt.sign(
              { userId: user.id, username: user.username, role: user.role },
              JWT_SECRET
            );

            // Update profile
            const updateResponse = await request(app)
              .put('/api/user/profile')
              .set('Authorization', `Bearer ${authToken}`)
              .send(cleanUpdateData);

            expect(updateResponse.status).toBe(200);

            // Verify response contains all required fields
            expect(updateResponse.body).toHaveProperty('id');
            expect(updateResponse.body).toHaveProperty('username');
            expect(updateResponse.body).toHaveProperty('role');
            expect(updateResponse.body).toHaveProperty('currency');
            expect(updateResponse.body).toHaveProperty('prestige');
            expect(updateResponse.body).toHaveProperty('createdAt');
            expect(updateResponse.body).toHaveProperty('totalBattles');
            expect(updateResponse.body).toHaveProperty('totalWins');
            expect(updateResponse.body).toHaveProperty('highestELO');
            expect(updateResponse.body).toHaveProperty('championshipTitles');
            expect(updateResponse.body).toHaveProperty('stableName');
            expect(updateResponse.body).toHaveProperty('profileVisibility');
            expect(updateResponse.body).toHaveProperty('notificationsBattle');
            expect(updateResponse.body).toHaveProperty('notificationsLeague');
            expect(updateResponse.body).toHaveProperty('themePreference');

            // Verify updated fields match the request (only check fields that were sent)
            if ('stableName' in cleanUpdateData) {
              expect(updateResponse.body.stableName).toBe(cleanUpdateData.stableName);
            }
            if ('profileVisibility' in cleanUpdateData) {
              expect(updateResponse.body.profileVisibility).toBe(cleanUpdateData.profileVisibility);
            }
            if ('notificationsBattle' in cleanUpdateData) {
              expect(updateResponse.body.notificationsBattle).toBe(cleanUpdateData.notificationsBattle);
            }
            if ('notificationsLeague' in cleanUpdateData) {
              expect(updateResponse.body.notificationsLeague).toBe(cleanUpdateData.notificationsLeague);
            }
            if ('themePreference' in cleanUpdateData) {
              expect(updateResponse.body.themePreference).toBe(cleanUpdateData.themePreference);
            }
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
 * Generate valid stable names (3-30 characters, alphanumeric + spaces/hyphens/underscores)
 * Excludes profanity to ensure valid names
 */
function validStableNameGenerator(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
        'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
        'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        ' ', '_', '-'
      ),
      { minLength: 3, maxLength: 30 }
    )
    .map((chars) => chars.join(''))
    .filter((s) => {
      // Ensure it matches the valid pattern
      if (!/^[a-zA-Z0-9 _-]+$/.test(s)) return false;
      
      // Exclude profanity
      const profanityList = [
        'damn', 'hell', 'crap', 'shit', 'fuck', 'bitch', 'ass', 'bastard',
        'dick', 'cock', 'pussy', 'whore', 'slut', 'fag', 'nigger', 'nigga',
        'retard', 'rape', 'nazi', 'hitler'
      ];
      const lowerText = s.toLowerCase();
      return !profanityList.some((word) => lowerText.includes(word));
    });
}

/**
 * Generate valid passwords (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
 */
function validPasswordGenerator(): fc.Arbitrary<string> {
  return fc
    .tuple(
      fc.array(fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'), { minLength: 1, maxLength: 3 }),
      fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'), { minLength: 1, maxLength: 3 }),
      fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 1, maxLength: 3 }),
      fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 5, maxLength: 15 })
    )
    .map(([upper, lower, digit, rest]) => {
      // Shuffle all characters together
      const chars = [...upper, ...lower, ...digit, ...rest];
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.join('');
    })
    .filter((s) => s.length >= 8);
}

/**
 * Generate partial update data (random subset of editable fields)
 */
function partialUpdateGenerator(): fc.Arbitrary<any> {
  return fc.record(
    {
      stableName: fc.option(
        validStableNameGenerator().map(name => {
          const suffix = `_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const maxBaseLength = 30 - suffix.length;
          const baseName = name.trim().substring(0, maxBaseLength);
          return `${baseName}${suffix}`;
        }), 
        { nil: undefined }
      ),
      profileVisibility: fc.option(fc.constantFrom('public' as const, 'private' as const), { nil: undefined }),
      notificationsBattle: fc.option(fc.boolean(), { nil: undefined }),
      notificationsLeague: fc.option(fc.boolean(), { nil: undefined }),
      themePreference: fc.option(fc.constantFrom('dark' as const, 'light' as const, 'auto' as const), { nil: undefined }),
    },
    { requiredKeys: [] }
  ).filter((obj) => {
    // Ensure at least one field is present
    return Object.keys(obj).some((key) => (obj as Record<string, unknown>)[key] !== undefined);
  });
}

/**
 * Generate valid profile update data (at least one field)
 */
function validProfileUpdateGenerator(): fc.Arbitrary<any> {
  return fc.record(
    {
      stableName: fc.option(
        validStableNameGenerator().map(name => {
          const suffix = `_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const maxBaseLength = 30 - suffix.length;
          const baseName = name.trim().substring(0, maxBaseLength);
          return `${baseName}${suffix}`;
        }), 
        { nil: undefined }
      ),
      profileVisibility: fc.option(fc.constantFrom('public' as const, 'private' as const), { nil: undefined }),
      notificationsBattle: fc.option(fc.boolean(), { nil: undefined }),
      notificationsLeague: fc.option(fc.boolean(), { nil: undefined }),
      themePreference: fc.option(fc.constantFrom('dark' as const, 'light' as const, 'auto' as const), { nil: undefined }),
    },
    { requiredKeys: [] }
  ).filter((obj) => {
    // Ensure at least one field is present
    return Object.keys(obj).some((key) => (obj as Record<string, unknown>)[key] !== undefined);
  });
}
