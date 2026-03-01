import * as fc from 'fast-check';
import { hashPassword } from '../src/services/passwordService';
import bcrypt from 'bcrypt';

// Test configuration
const NUM_RUNS = 10;

describe('Password Hashing - Property Tests', () => {
  afterAll(() => {
    // Pure unit test - no cleanup needed
  });

  describe('Property 2: Password Hashing', () => {
    /**
     * **Validates: Requirements 1.2**
     * For any registration request, the password stored in the database should be a valid bcrypt 
     * hash and should not match the plaintext password provided.
     */
    test('hashed passwords are valid bcrypt hashes and differ from plaintext', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPasswordGenerator(),
          async (password) => {
            const hash = await hashPassword(password);
            
            // Property 1: Hash should be a valid bcrypt hash format
            // Bcrypt hashes start with $2a$, $2b$, or $2y$ followed by cost factor
            expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
            
            // Property 2: Hash should not match the plaintext password
            expect(hash).not.toBe(password);
            
            // Property 3: Hash should be verifiable with bcrypt
            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);
            
            // Property 4: Hash should have reasonable length (bcrypt hashes are 60 chars)
            expect(hash.length).toBe(60);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('same password produces different hashes (salt randomization)', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPasswordGenerator(),
          async (password) => {
            const hash1 = await hashPassword(password);
            const hash2 = await hashPassword(password);
            
            // Each hash should be different due to random salt
            expect(hash1).not.toBe(hash2);
            
            // But both should verify against the original password
            const isValid1 = await bcrypt.compare(password, hash1);
            const isValid2 = await bcrypt.compare(password, hash2);
            expect(isValid1).toBe(true);
            expect(isValid2).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('hashes are deterministically verifiable', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPasswordGenerator(),
          async (password) => {
            const hash = await hashPassword(password);
            
            // Verifying the same password multiple times should always succeed
            const verify1 = await bcrypt.compare(password, hash);
            const verify2 = await bcrypt.compare(password, hash);
            const verify3 = await bcrypt.compare(password, hash);
            
            expect(verify1).toBe(true);
            expect(verify2).toBe(true);
            expect(verify3).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('different passwords produce different hashes', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPasswordGenerator(),
          validPasswordGenerator(),
          async (password1, password2) => {
            // Skip if passwords are the same
            fc.pre(password1 !== password2);
            
            const hash1 = await hashPassword(password1);
            const hash2 = await hashPassword(password2);
            
            // Different passwords should produce different hashes
            expect(hash1).not.toBe(hash2);
            
            // Each hash should only verify its own password
            const verify1with1 = await bcrypt.compare(password1, hash1);
            const verify1with2 = await bcrypt.compare(password1, hash2);
            const verify2with1 = await bcrypt.compare(password2, hash1);
            const verify2with2 = await bcrypt.compare(password2, hash2);
            
            expect(verify1with1).toBe(true);
            expect(verify1with2).toBe(false);
            expect(verify2with1).toBe(false);
            expect(verify2with2).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('hashes work with passwords containing special characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          passwordWithSpecialCharsGenerator(),
          async (password) => {
            const hash = await hashPassword(password);
            
            // Should produce valid bcrypt hash
            expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
            expect(hash).not.toBe(password);
            
            // Should verify correctly
            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('hashes work with maximum length passwords', async () => {
      await fc.assert(
        fc.asyncProperty(
          maxLengthPasswordGenerator(),
          async (password) => {
            const hash = await hashPassword(password);
            
            // Should produce valid bcrypt hash
            expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
            expect(hash).not.toBe(password);
            
            // Should verify correctly
            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);
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
 * Generate valid passwords (8-128 characters, any characters allowed)
 * Based on Requirements 3.1, 3.2 from the spec
 */
function validPasswordGenerator(): fc.Arbitrary<string> {
  return fc.string({ minLength: 8, maxLength: 128 });
}

/**
 * Generate passwords with special characters
 */
function passwordWithSpecialCharsGenerator(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.oneof(
        fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'),
        fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'),
        fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
        fc.constantFrom('!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '=', '[', ']', '{', '}', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '.', '?', '/')
      ),
      { minLength: 8, maxLength: 64 }
    )
    .map((chars) => chars.join(''))
    .filter((s) => /[!@#$%^&*()_+\-=\[\]{}|\\:;"'<>,.?/]/.test(s)); // Ensure at least one special char
}

/**
 * Generate passwords at maximum allowed length (128 characters)
 */
function maxLengthPasswordGenerator(): fc.Arbitrary<string> {
  return fc.string({ minLength: 128, maxLength: 128 });
}
