import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import { validateStableName, validatePassword, containsProfanity, isStableNameUnique } from '../src/utils/validation';


describe('Validation Service - Unit Tests', () => {
  describe('Profanity Filter', () => {
    /**
     * Test profanity filter with known bad words
     * Requirements: 1.7
     */
    test('should detect profanity in stable names', () => {
      const profaneNames = [
        'BadShitName',
        'FuckThis',
        'AssHole123',
        'damn_it',
        'hell-yeah',
        'CrapName',
        'BitchPlease',
        'DickHead',
        'NaziSymbol',
      ];

      profaneNames.forEach((name) => {
        expect(containsProfanity(name)).toBe(true);
      });
    });

    test('should not flag clean names as profane', () => {
      const cleanNames = [
        'GoodName',
        'MyStable',
        'RobotWarrior',
        'Champion2024',
        'Elite_Squad',
        'Thunder-Strike',
      ];

      cleanNames.forEach((name) => {
        expect(containsProfanity(name)).toBe(false);
      });
    });

    test('should be case-insensitive', () => {
      expect(containsProfanity('SHIT')).toBe(true);
      expect(containsProfanity('ShIt')).toBe(true);
      expect(containsProfanity('shit')).toBe(true);
    });

    test('should detect profanity within words', () => {
      expect(containsProfanity('BadShittyName')).toBe(true);
      expect(containsProfanity('AssassinClan')).toBe(true);
    });
  });

  describe('Stable Name Validation - Boundary Conditions', () => {
    /**
     * Test boundary conditions (exactly 3 chars, exactly 30 chars)
     * Requirements: 1.4, 1.5
     */
    test('should accept stable name with exactly 3 characters', () => {
      const result = validateStableName('abc');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should accept stable name with exactly 30 characters', () => {
      const name = 'a'.repeat(30); // Exactly 30 characters
      const result = validateStableName(name);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject stable name with 2 characters (just below minimum)', () => {
      const result = validateStableName('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Stable name must be at least 3 characters');
    });

    test('should reject stable name with 31 characters (just above maximum)', () => {
      const name = 'a'.repeat(31); // 31 characters
      const result = validateStableName(name);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Stable name must be 30 characters or less');
    });

    test('should accept stable name with valid special characters', () => {
      const validNames = [
        'My_Stable',
        'Robot-Squad',
        'Team 123',
        'Elite_Warriors-2024',
        'A-B_C D',
      ];

      validNames.forEach((name) => {
        const result = validateStableName(name);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    test('should reject stable name with invalid special characters', () => {
      const invalidNames = [
        'Test@Name',
        'Name!',
        'My#Stable',
        'Robot$Squad',
        'Team%123',
        'Elite&Warriors',
        'Name*',
        'Test(Name)',
        'Name+Plus',
        'Test=Name',
      ];

      invalidNames.forEach((name) => {
        const result = validateStableName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          'Stable name can only contain letters, numbers, spaces, hyphens, and underscores'
        );
      });
    });
  });

  describe('Stable Name Uniqueness Check', () => {
    /**
     * Test stable name uniqueness check
     * Requirements: 1.6
     */
    let testUserIds: number[] = [];

    beforeAll(async () => {
      await prisma.$connect();
    });

    afterEach(async () => {
      // Cleanup after each test
      if (testUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: testUserIds } },
        });
      }
      testUserIds = [];
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    test('should return false when stable name is already taken by another user', async () => {
      const passwordHash = await bcrypt.hash('TestPass123', 10);
      const timestamp = Date.now();
      
      const testUser1 = await prisma.user.create({
        data: {
          username: `utest1_${timestamp}`,
          passwordHash,
          role: 'user',
          currency: 10000,
          prestige: 100,
          stableName: `UniqueStableName_${timestamp}`,
        },
      });
      testUserIds.push(testUser1.id);

      const testUser2 = await prisma.user.create({
        data: {
          username: `utest2_${timestamp}`,
          passwordHash,
          role: 'user',
          currency: 10000,
          prestige: 100,
          stableName: null,
        },
      });
      testUserIds.push(testUser2.id);

      const isUnique = await isStableNameUnique(testUser1.stableName!, testUser2.id);
      expect(isUnique).toBe(false);
    });

    test('should return true when stable name is not taken', async () => {
      const passwordHash = await bcrypt.hash('TestPass123', 10);
      const timestamp = Date.now();
      
      const testUser = await prisma.user.create({
        data: {
          username: `utest3_${timestamp}`,
          passwordHash,
          role: 'user',
          currency: 10000,
          prestige: 100,
          stableName: null,
        },
      });
      testUserIds.push(testUser.id);

      const isUnique = await isStableNameUnique(`BrandNewStableName_${timestamp}`, testUser.id);
      expect(isUnique).toBe(true);
    });

    test('should return true when stable name is owned by the current user', async () => {
      const passwordHash = await bcrypt.hash('TestPass123', 10);
      const timestamp = Date.now();
      
      const testUser = await prisma.user.create({
        data: {
          username: `utest4_${timestamp}`,
          passwordHash,
          role: 'user',
          currency: 10000,
          prestige: 100,
          stableName: `OwnStableName_${timestamp}`,
        },
      });
      testUserIds.push(testUser.id);

      // User should be able to keep their own stable name
      const isUnique = await isStableNameUnique(testUser.stableName!, testUser.id);
      expect(isUnique).toBe(true);
    });

    test('should be case-sensitive for uniqueness', async () => {
      const passwordHash = await bcrypt.hash('TestPass123', 10);
      const rand = Math.floor(Math.random() * 10000);
      
      const testUser1 = await prisma.user.create({
        data: {
          username: `utest5_${rand}`,
          passwordHash,
          role: 'user',
          currency: 10000,
          prestige: 100,
          stableName: `CaseName_${rand}`,
        },
      });
      testUserIds.push(testUser1.id);

      const testUser2 = await prisma.user.create({
        data: {
          username: `utest6_${rand}`,
          passwordHash,
          role: 'user',
          currency: 10000,
          prestige: 100,
          stableName: null,
        },
      });
      testUserIds.push(testUser2.id);

      // Different case should be considered different names
      const isUnique = await isStableNameUnique(testUser1.stableName!.toLowerCase(), testUser2.id);
      expect(isUnique).toBe(true);
    });
  });

  describe('Password Validation - Edge Cases', () => {
    /**
     * Test password validation edge cases
     * Requirements: 3.3, 3.4, 3.5, 3.6
     */
    test('should accept password with exactly 8 characters meeting all requirements', () => {
      const result = validatePassword('Pass123A');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject password with 7 characters (just below minimum)', () => {
      const result = validatePassword('Pass12A');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters');
    });

    test('should accept very long password meeting all requirements', () => {
      const longPassword = 'A1' + 'a'.repeat(100);
      const result = validatePassword(longPassword);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject password with only one missing requirement at a time', () => {
      // Missing uppercase
      let result = validatePassword('password123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must contain at least one uppercase letter');

      // Missing lowercase
      result = validatePassword('PASSWORD123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must contain at least one lowercase letter');

      // Missing number
      result = validatePassword('PasswordABC');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must contain at least one number');
    });

    test('should accept password with special characters', () => {
      const result = validatePassword('Pass123!@#$%');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should accept password with multiple uppercase, lowercase, and numbers', () => {
      const result = validatePassword('ABCabc123456');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
