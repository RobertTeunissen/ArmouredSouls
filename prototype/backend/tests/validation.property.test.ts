import * as fc from 'fast-check';
import { validateStableName, validatePassword } from '../src/utils/validation';

// Test configuration
const NUM_RUNS = 100;

describe('Validation Service - Property Tests', () => {
  describe('Property 1: Valid stable names are accepted', () => {
    /**
     * **Validates: Requirements 1.2, 1.4, 1.5**
     * For any valid stable name (3-30 characters, alphanumeric plus spaces/hyphens/underscores),
     * when submitted through the validation service, the system should accept it.
     */
    test('accepts all valid stable names', () => {
      fc.assert(
        fc.property(
          validStableNameGenerator(),
          (stableName) => {
            const result = validateStableName(stableName);
            
            // Valid stable names should be accepted
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('rejects stable names that are too short', () => {
      fc.assert(
        fc.property(
          tooShortStableNameGenerator(),
          (stableName) => {
            const result = validateStableName(stableName);
            
            // Too short names should be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Stable name must be at least 3 characters');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('rejects stable names that are too long', () => {
      fc.assert(
        fc.property(
          tooLongStableNameGenerator(),
          (stableName) => {
            const result = validateStableName(stableName);
            
            // Too long names should be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Stable name must be 30 characters or less');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('rejects stable names with invalid characters', () => {
      fc.assert(
        fc.property(
          invalidCharsStableNameGenerator(),
          (stableName) => {
            const result = validateStableName(stableName);
            
            // Names with invalid characters should be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toBe(
              'Stable name can only contain letters, numbers, spaces, hyphens, and underscores'
            );
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 4: Password validation enforces all strength requirements', () => {
    /**
     * **Validates: Requirements 3.3, 3.4, 3.5, 3.6**
     * For any password string, the validation service should reject it if it fails any of these
     * requirements: minimum 8 characters, at least one uppercase letter, at least one lowercase
     * letter, at least one number.
     */
    test('accepts all valid passwords', () => {
      fc.assert(
        fc.property(
          validPasswordGenerator(),
          (password) => {
            const result = validatePassword(password);
            
            // Valid passwords should be accepted
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('rejects passwords that are too short', () => {
      fc.assert(
        fc.property(
          tooShortPasswordGenerator(),
          (password) => {
            const result = validatePassword(password);
            
            // Too short passwords should be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Password must be at least 8 characters');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('rejects passwords without uppercase letters', () => {
      fc.assert(
        fc.property(
          noUppercasePasswordGenerator(),
          (password) => {
            const result = validatePassword(password);
            
            // Passwords without uppercase should be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Password must contain at least one uppercase letter');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('rejects passwords without lowercase letters', () => {
      fc.assert(
        fc.property(
          noLowercasePasswordGenerator(),
          (password) => {
            const result = validatePassword(password);
            
            // Passwords without lowercase should be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Password must contain at least one lowercase letter');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('rejects passwords without numbers', () => {
      fc.assert(
        fc.property(
          noNumberPasswordGenerator(),
          (password) => {
            const result = validatePassword(password);
            
            // Passwords without numbers should be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Password must contain at least one number');
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
 * Generate stable names that are too short (0-2 characters)
 */
function tooShortStableNameGenerator(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom('a', 'b', 'c', 'A', 'B', 'C', '0', '1', '2', ' ', '_', '-'),
      { minLength: 0, maxLength: 2 }
    )
    .map((chars) => chars.join(''));
}

/**
 * Generate stable names that are too long (31+ characters)
 */
function tooLongStableNameGenerator(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom('a', 'b', 'c', 'A', 'B', 'C', '0', '1', '2', ' ', '_', '-'),
      { minLength: 31, maxLength: 50 }
    )
    .map((chars) => chars.join(''));
}

/**
 * Generate stable names with invalid characters (3-30 chars but with special chars)
 */
function invalidCharsStableNameGenerator(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.oneof(
        fc.constantFrom('!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '[', ']'),
        fc.constantFrom('a', 'b', 'c') // Mix in some valid chars
      ),
      { minLength: 3, maxLength: 30 }
    )
    .map((chars) => chars.join(''))
    .filter((s) => /[^a-zA-Z0-9 _-]/.test(s)); // Ensure it has at least one invalid char
}

/**
 * Generate valid passwords (8+ chars, uppercase, lowercase, number)
 */
function validPasswordGenerator(): fc.Arbitrary<string> {
  return fc
    .tuple(
      fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'), // At least one uppercase
      fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'), // At least one lowercase
      fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), // At least one number
      fc.array(
        fc.constantFrom(
          'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
          'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
          '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
        ),
        { minLength: 5, maxLength: 20 }
      )
    )
    .map(([upper, lower, num, rest]) => {
      // Shuffle the characters to create a valid password
      const chars = [upper, lower, num, ...rest];
      return chars.sort(() => Math.random() - 0.5).join('');
    });
}

/**
 * Generate passwords that are too short (0-7 characters)
 */
function tooShortPasswordGenerator(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
      ),
      { minLength: 0, maxLength: 7 }
    )
    .map((chars) => chars.join(''));
}

/**
 * Generate passwords without uppercase letters (8+ chars, lowercase + numbers only)
 */
function noUppercasePasswordGenerator(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
      ),
      { minLength: 8, maxLength: 20 }
    )
    .map((chars) => chars.join(''));
}

/**
 * Generate passwords without lowercase letters (8+ chars, uppercase + numbers only)
 */
function noLowercasePasswordGenerator(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
      ),
      { minLength: 8, maxLength: 20 }
    )
    .map((chars) => chars.join(''));
}

/**
 * Generate passwords without numbers (8+ chars, letters only)
 */
function noNumberPasswordGenerator(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
      ),
      { minLength: 8, maxLength: 20 }
    )
    .map((chars) => chars.join(''));
}
