/**
 * @module utils/validation
 *
 * Profile and registration validation utilities for user input.
 * Provides functions to validate usernames, emails, passwords, and complete
 * registration requests against the rules defined in the design specification.
 *
 * @see {@link ../services/userService} for duplicate-checking at the database level
 */

// Profile validation utilities for user input

import prisma from '../lib/prisma';

/**
 * Result of a validation check.
 *
 * @property isValid - `true` when all validation rules pass
 * @property errors  - Array of human-readable error messages (empty when valid)
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Basic profanity word list for stable name filtering
 * Production systems should use more sophisticated filtering libraries
 */
const PROFANITY_LIST = [
  'damn',
  'hell',
  'crap',
  'shit',
  'fuck',
  'bitch',
  'ass',
  'bastard',
  'dick',
  'cock',
  'pussy',
  'whore',
  'slut',
  'fag',
  'nigger',
  'nigga',
  'retard',
  'rape',
  'nazi',
  'hitler',
];

/**
 * Validate a username against the registration rules.
 *
 * **Validation rules:**
 * - Length must be between 3 and 20 characters (inclusive)
 * - Only alphanumeric characters, underscores (`_`), and hyphens (`-`) are allowed
 *
 * This function does **not** check uniqueness — that is handled by the user service
 * at the database level.
 *
 * @param username - The username string to validate
 * @returns A {@link ValidationResult} with `isValid` flag and any error messages
 *
 * @example
 * validateUsername('ab');
 * // → { isValid: false, errors: ['Username must be at least 3 characters long'] }
 *
 * validateUsername('player_1');
 * // → { isValid: true, errors: [] }
 *
 * Requirements: 2.3, 2.4, 2.5, 2.6
 */
export function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];

  // Length bounds: 3–20 chars. Both checks run independently so the user
  // sees all applicable errors in a single response.
  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  if (username.length > 20) {
    errors.push('Username must not exceed 20 characters');
  }

  // Restrict to safe characters only — prevents injection vectors and
  // ensures usernames are URL-safe and display consistently across UIs.
  const validCharPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validCharPattern.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate an email against the registration rules.
 *
 * **Validation rules:**
 * - Length must be between 3 and 20 characters (inclusive)
 * - Only alphanumeric characters, underscores (`_`), and hyphens (`-`) are allowed
 *
 * Note: This is a simplified email format for the game system, **not** standard
 * RFC 5322. The character and length rules mirror username validation.
 *
 * This function does **not** check uniqueness — that is handled by the user service
 * at the database level.
 *
 * @param email - The email string to validate
 * @returns A {@link ValidationResult} with `isValid` flag and any error messages
 *
 * @example
 * validateEmail('ok');
 * // → { isValid: false, errors: ['Email must be at least 3 characters long'] }
 *
 * validateEmail('player_mail');
 * // → { isValid: true, errors: [] }
 *
 * Requirements: 2.7, 2.8, 2.9, 2.10
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (email.length < 3) {
    errors.push('Email must be at least 3 characters long');
  } else if (email.length > 20) {
    errors.push('Email must not exceed 20 characters');
  } else {
    // Only check format/characters when length is valid
    const validCharPattern = /^[a-zA-Z0-9._@-]+$/;
    if (!validCharPattern.test(email)) {
      errors.push('Email contains invalid characters');
    } else if (!/^[^@]+@[^@]+$/.test(email)) {
      errors.push('Email must contain exactly one @ symbol with text on both sides');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate stable name format and content
 * Requirements: 1.4, 1.5, 1.7
 */
export function validateStableName(name: string): { valid: boolean; error?: string } {
  // Check length (3-30 characters)
  if (name.length < 3) {
    return { valid: false, error: 'Stable name must be at least 3 characters' };
  }
  if (name.length > 30) {
    return { valid: false, error: 'Stable name must be 30 characters or less' };
  }

  // Check allowed characters (alphanumeric + spaces, hyphens, underscores)
  const validCharPattern = /^[a-zA-Z0-9 _-]+$/;
  if (!validCharPattern.test(name)) {
    return {
      valid: false,
      error: 'Stable name can only contain letters, numbers, spaces, hyphens, and underscores',
    };
  }

  // Check for profanity
  if (containsProfanity(name)) {
    return { valid: false, error: 'Stable name contains inappropriate content' };
  }

  return { valid: true };
}

/**
 * Check if stable name is unique in the database
 * Excludes the current user from the uniqueness check
 * Requirements: 1.6
 */
export async function isStableNameUnique(name: string, userId: number): Promise<boolean> {
  const existingUser = await prisma.user.findFirst({
    where: {
      stableName: name,
      NOT: {
        id: userId,
      },
    },
  });

  return existingUser === null;
}

/**
 * Validate a password for user registration.
 *
 * **Validation rules:**
 * - Minimum length: 8 characters
 * - Maximum length: 128 characters
 * - No character-type restrictions (special characters, uppercase, etc. are all allowed)
 *
 * @param password - The password string to validate
 * @returns A {@link ValidationResult} with `isValid` flag and any error messages
 *
 * @example
 * validateRegistrationPassword('short');
 * // → { isValid: false, errors: ['Password must be at least 8 characters long'] }
 *
 * validateRegistrationPassword('validPassword123');
 * // → { isValid: true, errors: [] }
 *
 * Requirements: 3.1, 3.2
 */
export function validateRegistrationPassword(password: string): ValidationResult {
  const errors: string[] = [];

  // Check minimum length (8 characters)
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Check maximum length (128 characters)
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Data shape expected by {@link validateRegistrationRequest}.
 *
 * @property username - The desired username
 * @property email    - The desired email
 * @property password - The desired password
 */
export interface RegistrationRequest {
  username: string;
  email: string;
  password: string;
}

/**
 * Validate a complete registration request.
 *
 * Orchestrates all validation checks for a registration request:
 * 1. Checks that all required fields (`username`, `email`, `password`) are present.
 *    If any are missing, returns immediately with a single error.
 * 2. Validates username via {@link validateUsername}
 * 3. Validates email via {@link validateEmail}
 * 4. Validates password via {@link validateRegistrationPassword}
 *
 * All validation errors are aggregated into a single {@link ValidationResult}.
 *
 * @param request - The registration request containing username, email, and password
 * @returns A {@link ValidationResult} with `isValid` flag and all collected error messages
 *
 * @example
 * validateRegistrationRequest({ username: '', email: 'ok_email', password: 'longEnough1' });
 * // → { isValid: false, errors: ['Username, email, and password are required'] }
 *
 * @example
 * validateRegistrationRequest({ username: 'ab', email: 'ok_email', password: 'short' });
 * // → { isValid: false, errors: [
 * //     'Username must be at least 3 characters long',
 * //     'Password must be at least 8 characters long'
 * //   ] }
 *
 * Requirements: 3.3, 9.2
 */
export function validateRegistrationRequest(request: RegistrationRequest): ValidationResult {
  const errors: string[] = [];

  // Early return on missing fields: if any required field is absent, skip
  // individual validation to avoid confusing "too short" errors on empty strings.
  if (!request.username || !request.email || !request.password) {
    errors.push('Username, email, and password are required');
    return {
      isValid: false,
      errors,
    };
  }

  // Run all three validators and aggregate errors so the user sees every
  // problem at once, rather than fixing them one at a time.
  const usernameResult = validateUsername(request.username);
  if (!usernameResult.isValid) {
    errors.push(...usernameResult.errors);
  }

  const emailResult = validateEmail(request.email);
  if (!emailResult.isValid) {
    errors.push(...emailResult.errors);
  }

  const passwordResult = validateRegistrationPassword(request.password);
  if (!passwordResult.isValid) {
    errors.push(...passwordResult.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate password strength
 * Requirements: 3.3, 3.4, 3.5, 3.6
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  // Check minimum length (8 characters)
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  return { valid: true };
}

/**
 * Basic profanity filter using word list
 * Checks if text contains any prohibited words (case-insensitive)
 * Requirements: 1.7
 */
export function containsProfanity(text: string): boolean {
  const lowerText = text.toLowerCase();
  return PROFANITY_LIST.some((word) => lowerText.includes(word));
}
