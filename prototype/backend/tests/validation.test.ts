import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import { validateStableName, validatePassword, containsProfanity, isStableNameUnique, validateUsername, validateEmail, validateRegistrationPassword, validateRegistrationRequest, RegistrationRequest } from '../src/utils/validation';
import * as fc from 'fast-check';


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

  describe('Registration Password Validation - Boundary Conditions', () => {
    /**
     * Test registration password validation boundary conditions
     * Requirements: 3.1, 3.2
     */
    test('should accept password with exactly 8 characters', () => {
      const result = validateRegistrationPassword('12345678');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept password with exactly 128 characters', () => {
      const password = 'a'.repeat(128);
      const result = validateRegistrationPassword(password);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject password with 7 characters (just below minimum)', () => {
      const result = validateRegistrationPassword('1234567');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('should reject password with 129 characters (just above maximum)', () => {
      const password = 'a'.repeat(129);
      const result = validateRegistrationPassword(password);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must not exceed 128 characters');
    });

    test('should accept password with only lowercase letters', () => {
      const result = validateRegistrationPassword('abcdefgh');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept password with only numbers', () => {
      const result = validateRegistrationPassword('12345678');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept password with special characters only', () => {
      const result = validateRegistrationPassword('!@#$%^&*');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept password with mixed characters and special symbols', () => {
      const result = validateRegistrationPassword('Pass123!@#$%');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept password with spaces', () => {
      const result = validateRegistrationPassword('my pass word');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept password with unicode characters', () => {
      const result = validateRegistrationPassword('pässwörd123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept password with emojis', () => {
      const result = validateRegistrationPassword('pass🔒word');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Registration Request Validation', () => {
    /**
     * Test validateRegistrationRequest function
     * Requirements: 3.3, 9.2
     */
    test('should accept valid registration request', () => {
      const request: RegistrationRequest = {
        username: 'validuser',
        email: 'me@test.co',
        password: 'password123',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject request with missing username', () => {
      const request: RegistrationRequest = {
        username: '',
        email: 'me@test.co',
        password: 'password123',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username, email, and password are required');
    });

    test('should reject request with missing email', () => {
      const request: RegistrationRequest = {
        username: 'validuser',
        email: '',
        password: 'password123',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username, email, and password are required');
    });

    test('should reject request with missing password', () => {
      const request: RegistrationRequest = {
        username: 'validuser',
        email: 'me@test.co',
        password: '',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username, email, and password are required');
    });

    test('should reject request with all fields missing', () => {
      const request: RegistrationRequest = {
        username: '',
        email: '',
        password: '',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username, email, and password are required');
    });

    test('should aggregate multiple validation errors', () => {
      const request: RegistrationRequest = {
        username: 'ab', // Too short
        email: 'x', // Too short
        password: '1234567', // Too short
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username must be at least 3 characters long');
      expect(result.errors).toContain('Email must be at least 3 characters long');
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors.length).toBe(3);
    });

    test('should aggregate errors for invalid characters', () => {
      const request: RegistrationRequest = {
        username: 'user@name', // Invalid character
        email: 'email#test', // Invalid character
        password: 'password123', // Valid
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username can only contain letters, numbers, underscores, and hyphens');
      expect(result.errors).toContain('Email contains invalid characters');
      expect(result.errors.length).toBe(2);
    });

    test('should accept request with boundary values', () => {
      const request: RegistrationRequest = {
        username: 'abc', // Exactly 3 characters
        email: 'a@b', // Exactly 3 characters, valid email format
        password: '12345678', // Exactly 8 characters
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept request with maximum valid lengths', () => {
      const request: RegistrationRequest = {
        username: 'a'.repeat(20), // Exactly 20 characters
        email: 'b'.repeat(14) + '@c.com', // Exactly 20 characters
        password: 'c'.repeat(128), // Exactly 128 characters
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject request with values exceeding maximum lengths', () => {
      const request: RegistrationRequest = {
        username: 'a'.repeat(21), // 21 characters
        email: 'b'.repeat(15) + '@c.com', // 21 characters
        password: 'c'.repeat(129), // 129 characters
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username must not exceed 20 characters');
      expect(result.errors).toContain('Email must not exceed 20 characters');
      expect(result.errors).toContain('Password must not exceed 128 characters');
      expect(result.errors.length).toBe(3);
    });
  });
});

describe('Registration Validation Service - Unit Tests', () => {
  /**
   * Unit tests for registration validation service
   * Requirements: 11.2
   * 
   * These tests focus on:
   * - Boundary values (length 3, 20, 8, 128)
   * - Invalid characters
   * - Error message content
   */

  describe('validateUsername - Boundary Values', () => {
    test('should accept username with exactly 3 characters (minimum boundary)', () => {
      const result = validateUsername('abc');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept username with exactly 20 characters (maximum boundary)', () => {
      const username = 'a'.repeat(20);
      const result = validateUsername(username);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject username with 2 characters (below minimum)', () => {
      const result = validateUsername('ab');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username must be at least 3 characters long');
    });

    test('should reject username with 21 characters (above maximum)', () => {
      const username = 'a'.repeat(21);
      const result = validateUsername(username);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username must not exceed 20 characters');
    });
  });

  describe('validateUsername - Invalid Characters', () => {
    test('should reject username with @ symbol', () => {
      const result = validateUsername('user@name');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username can only contain letters, numbers, underscores, and hyphens');
    });

    test('should reject username with # symbol', () => {
      const result = validateUsername('user#name');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username can only contain letters, numbers, underscores, and hyphens');
    });

    test('should reject username with space', () => {
      const result = validateUsername('user name');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username can only contain letters, numbers, underscores, and hyphens');
    });

    test('should reject username with dot', () => {
      const result = validateUsername('user.name');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username can only contain letters, numbers, underscores, and hyphens');
    });

    test('should accept username with valid characters (alphanumeric, underscore, hyphen)', () => {
      const validUsernames = ['user_name', 'user-name', 'user123', 'User_Name-123'];
      validUsernames.forEach(username => {
        const result = validateUsername(username);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('validateEmail - Boundary Values', () => {
    test('should accept email with exactly 3 characters (minimum boundary)', () => {
      const result = validateEmail('a@b');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept email with exactly 20 characters (maximum boundary)', () => {
      const email = 'a'.repeat(14) + '@b.com';  // 14 + 6 = 20
      const result = validateEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject email with 2 characters (below minimum)', () => {
      const result = validateEmail('ab');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email must be at least 3 characters long');
    });

    test('should reject email with 21 characters (above maximum)', () => {
      const email = 'a'.repeat(15) + '@b.com';  // 15 + 6 = 21
      const result = validateEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email must not exceed 20 characters');
    });
  });

  describe('validateEmail - Invalid Characters', () => {
    test('should accept email with @ and dot (standard email format)', () => {
      const result = validateEmail('user@email.com');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject email without @ symbol', () => {
      const result = validateEmail('useremail');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email must contain exactly one @ symbol with text on both sides');
    });

    test('should reject email with space', () => {
      const result = validateEmail('user email');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email contains invalid characters');
    });

    test('should reject email with special characters', () => {
      const invalidEmails = ['email!', 'email#test', 'email$', 'email%', 'email&'];
      invalidEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Email contains invalid characters');
      });
    });

    test('should reject email with multiple @ symbols', () => {
      const result = validateEmail('a@b@c.com');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email must contain exactly one @ symbol with text on both sides');
    });

    test('should accept email with valid characters (alphanumeric, underscore, hyphen, @, dot)', () => {
      const validEmails = ['a@b.co', 'user_1@test.co', 'hi@x.io'];
      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('validateRegistrationPassword - Boundary Values', () => {
    test('should accept password with exactly 8 characters (minimum boundary)', () => {
      const result = validateRegistrationPassword('12345678');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept password with exactly 128 characters (maximum boundary)', () => {
      const password = 'a'.repeat(128);
      const result = validateRegistrationPassword(password);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject password with 7 characters (below minimum)', () => {
      const result = validateRegistrationPassword('1234567');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('should reject password with 129 characters (above maximum)', () => {
      const password = 'a'.repeat(129);
      const result = validateRegistrationPassword(password);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must not exceed 128 characters');
    });
  });

  describe('validateRegistrationPassword - Character Acceptance', () => {
    test('should accept password with any characters (no character restrictions)', () => {
      const passwords = [
        'simple12',
        'UPPERCASE',
        'lowercase',
        '12345678',
        '!@#$%^&*',
        'Pass Word',
        'pässwörd',
        'emoji🔒pass',
        'mixed!@#123ABC',
      ];
      passwords.forEach(password => {
        const result = validateRegistrationPassword(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('validateRegistrationRequest - Error Message Content', () => {
    test('should return specific error message for missing fields', () => {
      const request: RegistrationRequest = {
        username: '',
        email: '',
        password: '',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username, email, and password are required');
    });

    test('should return specific error message for short username', () => {
      const request: RegistrationRequest = {
        username: 'ab',
        email: 'me@test.co',
        password: 'validpass',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username must be at least 3 characters long');
    });

    test('should return specific error message for long username', () => {
      const request: RegistrationRequest = {
        username: 'a'.repeat(21),
        email: 'me@test.co',
        password: 'validpass',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username must not exceed 20 characters');
    });

    test('should return specific error message for invalid username characters', () => {
      const request: RegistrationRequest = {
        username: 'user@name',
        email: 'me@test.co',
        password: 'validpass',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username can only contain letters, numbers, underscores, and hyphens');
    });

    test('should return specific error message for short email', () => {
      const request: RegistrationRequest = {
        username: 'validuser',
        email: 'ab',
        password: 'validpass',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email must be at least 3 characters long');
    });

    test('should return specific error message for long email', () => {
      const request: RegistrationRequest = {
        username: 'validuser',
        email: 'a'.repeat(21),
        password: 'validpass',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email must not exceed 20 characters');
    });

    test('should return specific error message for invalid email characters', () => {
      const request: RegistrationRequest = {
        username: 'validuser',
        email: 'email#test',
        password: 'validpass',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email contains invalid characters');
    });

    test('should return specific error message for short password', () => {
      const request: RegistrationRequest = {
        username: 'validuser',
        email: 'me@test.co',
        password: '1234567',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('should return specific error message for long password', () => {
      const request: RegistrationRequest = {
        username: 'validuser',
        email: 'me@test.co',
        password: 'a'.repeat(129),
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must not exceed 128 characters');
    });

    test('should aggregate multiple error messages', () => {
      const request: RegistrationRequest = {
        username: 'ab',
        email: 'x',
        password: '1234567',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('Username must be at least 3 characters long');
      expect(result.errors).toContain('Email must be at least 3 characters long');
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });
  });

  describe('validateRegistrationRequest - Boundary Value Integration', () => {
    test('should accept request with all fields at minimum boundaries', () => {
      const request: RegistrationRequest = {
        username: 'abc',
        email: 'a@b',
        password: '12345678',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should accept request with all fields at maximum boundaries', () => {
      const request: RegistrationRequest = {
        username: 'a'.repeat(20),
        email: 'b'.repeat(14) + '@c.com',
        password: 'c'.repeat(128),
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject request with all fields below minimum boundaries', () => {
      const request: RegistrationRequest = {
        username: 'ab',
        email: 'xy',
        password: '1234567',
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });

    test('should reject request with all fields above maximum boundaries', () => {
      const request: RegistrationRequest = {
        username: 'a'.repeat(21),
        email: 'b'.repeat(15) + '@c.com',
        password: 'c'.repeat(129),
      };
      const result = validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });
});

describe('Validation Service - Property-Based Tests', () => {
  describe('Username Validation Properties', () => {
    /**
     * Property 7: Valid Username Characters
     * **Validates: Requirements 2.5, 2.6**
     * 
     * For any string containing only alphanumeric characters, underscores, and hyphens,
     * and with length between 3-20 characters, the validation service should accept it
     * as a valid username format.
     */
    test('Property 7: Valid Username Characters - accepts all valid username formats', () => {
      // Create an arbitrary that generates valid usernames
      const validUsernameArbitrary = fc.array(
        fc.constantFrom(
          ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'
        ),
        { minLength: 3, maxLength: 20 }
      ).map(chars => chars.join(''));

      fc.assert(
        fc.property(validUsernameArbitrary, (username: string) => {
          const result = validateUsername(username);
          
          // The validation should pass for all valid usernames
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Email Validation Properties', () => {
    /**
     * Property 8: Valid Email Characters
     * **Validates: Requirements 2.9, 2.10**
     * 
     * For any string in valid email format (local@domain) with allowed characters
     * and length between 3-20 characters, the validation service should accept it.
     */
    test('Property 8: Valid Email Characters - accepts all valid email formats', () => {
      // Generate valid email-like strings: local@domain.tld, fitting within 3-20 chars
      const localPartArbitrary = fc.array(
        fc.constantFrom(
          ...'abcdefghijklmnopqrstuvwxyz0123456789_-'
        ),
        { minLength: 1, maxLength: 6 }
      ).map(chars => chars.join(''));

      const domainArbitrary = fc.array(
        fc.constantFrom(
          ...'abcdefghijklmnopqrstuvwxyz0123456789'
        ),
        { minLength: 1, maxLength: 4 }
      ).map(chars => chars.join(''));

      const tldArbitrary = fc.constantFrom('co', 'io', 'nl', 'de', 'uk');

      const validEmailArbitrary = fc.tuple(localPartArbitrary, domainArbitrary, tldArbitrary)
        .map(([local, domain, tld]) => `${local}@${domain}.${tld}`)
        .filter(email => email.length >= 3 && email.length <= 20);

      fc.assert(
        fc.property(validEmailArbitrary, (email: string) => {
          const result = validateEmail(email);
          
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Registration Request Validation Properties', () => {
    /**
     * Property 9: Missing Required Fields Rejection
     * **Validates: Requirements 3.3**
     * 
     * For any registration request missing one or more of the required fields
     * (username, email, password), the validation service should reject the request
     * with a descriptive error message.
     */
    test('Property 9: Missing Required Fields Rejection - rejects requests with missing fields', () => {
      // Create an arbitrary that generates registration requests with at least one missing field
      const registrationRequestWithMissingFieldsArbitrary = fc.record({
        username: fc.option(fc.string(), { nil: '' }),
        email: fc.option(fc.string(), { nil: '' }),
        password: fc.option(fc.string(), { nil: '' }),
      }).filter(req => {
        // Ensure at least one field is missing (empty string)
        return req.username === '' || req.email === '' || req.password === '';
      });

      fc.assert(
        fc.property(registrationRequestWithMissingFieldsArbitrary, (request: RegistrationRequest) => {
          const result = validateRegistrationRequest(request);
          
          // The validation should fail for requests with missing fields
          expect(result.isValid).toBe(false);
          
          // Should contain the descriptive error message about required fields
          expect(result.errors).toContain('Username, email, and password are required');
        }),
        { numRuns: 100 }
      );
    });
  });
});
