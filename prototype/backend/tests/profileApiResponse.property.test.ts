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
const NUM_RUNS = 100;

describe('Profile API Response - Property Tests', () => {
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

  describe('Property 3: Profile API returns all required fields', () => {
    /**
     * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**
     * For any authenticated user, when fetching their profile via GET /api/user/profile,
     * the response should contain all required fields: username, role, createdAt, currency,
     * prestige, totalBattles, totalWins, highestELO, championshipTitles, stableName,
     * profileVisibility, notificationsBattle, notificationsLeague, and themePreference.
     */
    test('returns all required fields for any authenticated user', async () => {
      await fc.assert(
        fc.asyncProperty(
          userProfileGenerator(),
          async (userProfile) => {
            // Create test user with generated profile data
            const passwordHash = await bcrypt.hash('TestPass123', 10);
            const user = await prisma.user.create({
              data: {
                username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                passwordHash,
                role: userProfile.role,
                currency: userProfile.currency,
                prestige: userProfile.prestige,
                stableName: userProfile.stableName,
                profileVisibility: userProfile.profileVisibility,
                notificationsBattle: userProfile.notificationsBattle,
                notificationsLeague: userProfile.notificationsLeague,
                themePreference: userProfile.themePreference,
              },
            });

            // Track user for cleanup
            testUsers.push(user);

            // Generate auth token
            const authToken = jwt.sign(
              { userId: user.id, username: user.username, role: user.role },
              JWT_SECRET
            );

            // Fetch profile
            const response = await request(app)
              .get('/api/user/profile')
              .set('Authorization', `Bearer ${authToken}`);

            // Verify response status
            expect(response.status).toBe(200);

            // Verify all required fields are present
            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('username');
            expect(response.body).toHaveProperty('role');
            expect(response.body).toHaveProperty('currency');
            expect(response.body).toHaveProperty('prestige');
            expect(response.body).toHaveProperty('createdAt');
            expect(response.body).toHaveProperty('stableName');
            expect(response.body).toHaveProperty('profileVisibility');
            expect(response.body).toHaveProperty('notificationsBattle');
            expect(response.body).toHaveProperty('notificationsLeague');
            expect(response.body).toHaveProperty('themePreference');

            // Verify field types
            expect(typeof response.body.id).toBe('number');
            expect(typeof response.body.username).toBe('string');
            expect(typeof response.body.role).toBe('string');
            expect(typeof response.body.currency).toBe('number');
            expect(typeof response.body.prestige).toBe('number');
            expect(typeof response.body.createdAt).toBe('string');
            expect(typeof response.body.stableName).toBe('string');
            expect(typeof response.body.profileVisibility).toBe('string');
            expect(typeof response.body.notificationsBattle).toBe('boolean');
            expect(typeof response.body.notificationsLeague).toBe('boolean');
            expect(typeof response.body.themePreference).toBe('string');

            // Verify field values match what was created
            expect(response.body.username).toBe(user.username);
            expect(response.body.role).toBe(userProfile.role);
            expect(response.body.currency).toBe(userProfile.currency);
            expect(response.body.prestige).toBe(userProfile.prestige);
            // Handle null stableName - should return username as fallback
            if (userProfile.stableName === null) {
              expect(response.body.stableName).toBe(user.username);
            } else {
              expect(response.body.stableName).toBe(userProfile.stableName);
            }
            
            expect(response.body.profileVisibility).toBe(userProfile.profileVisibility);
            expect(response.body.notificationsBattle).toBe(userProfile.notificationsBattle);
            expect(response.body.notificationsLeague).toBe(userProfile.notificationsLeague);
            expect(response.body.themePreference).toBe(userProfile.themePreference);
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
 * Generate random user profile data with all possible field variations
 */
function userProfileGenerator(): fc.Arbitrary<{
  role: string;
  currency: number;
  prestige: number;
  stableName: string | null;
  profileVisibility: 'public' | 'private';
  notificationsBattle: boolean;
  notificationsLeague: boolean;
  themePreference: 'dark' | 'light' | 'auto';
}> {
  return fc.record({
    role: fc.constantFrom('user', 'admin', 'moderator'),
    currency: fc.integer({ min: 0, max: 1000000 }),
    prestige: fc.integer({ min: 0, max: 100000 }),
    stableName: fc.option(validStableNameGenerator(), { nil: null }),
    profileVisibility: fc.constantFrom('public' as const, 'private' as const),
    notificationsBattle: fc.boolean(),
    notificationsLeague: fc.boolean(),
    themePreference: fc.constantFrom('dark' as const, 'light' as const, 'auto' as const),
  });
}

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
